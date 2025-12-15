# 189 Security Test Plan

## 🔐 Attack Vectors & Mitigations

Questo documento elenca tutti gli attacchi possibili e come li preveniamo.

---

## 1. Token Security Attacks

### Attack: Brute Force Token
**Scenario**: Hacker prova a indovinare il token
**Mitigation**: 
- UUID v4 = 122 bits di entropia = 5.3×10³⁶ combinazioni
- Rate limit: 5 tentativi/IP/ora
- Token valido solo 1 ora

**Test**:
```typescript
it('should use UUID v4 with 122 bits entropy', () => {
  const token = service.generateToken()
  expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})
```

### Attack: Token Replay
**Scenario**: Hacker intercetta email e usa token più volte
**Mitigation**: 
- Token marcato `usedAt` dopo primo uso
- Secondo uso = "Token already used"

**Test**:
```typescript
it('should reject token on second use', async () => {
  const token = await service.createResetToken(userId, adminId)
  await service.verifyPassword(token, email, password) // OK
  await expect(service.verifyPassword(token, email, password))
    .rejects.toThrow('Token already used')
})
```

### Attack: Token in Logs
**Scenario**: Hacker accede ai log e trova token completi
**Mitigation**: 
- Mai loggare token completo
- Solo `token.substring(0,8)...`

**Test**:
```typescript
it('should never log full token', async () => {
  const logSpy = jest.spyOn(logger, 'info')
  const token = await service.createResetToken(userId, adminId)
  const calls = logSpy.mock.calls.map(c => JSON.stringify(c))
  expect(calls.join('')).not.toContain(token)
})
```

---

## 2. Password Verification Attacks

### Attack: Password Brute Force
**Scenario**: Hacker ha token, prova password casuali
**Mitigation**: 
- Dopo 5 tentativi: lockout 15 minuti
- Counter resettato dopo successo

**Test**:
```typescript
it('should lock after 5 failed attempts', async () => {
  for (let i = 0; i < 5; i++) {
    await service.verifyPassword(token, email, 'wrong').catch(() => {})
  }
  await expect(service.verifyPassword(token, email, 'correct'))
    .rejects.toThrow('Account temporarily locked')
})
```

### Attack: User Enumeration
**Scenario**: Hacker scopre quali email esistono
**Mitigation**: 
- Messaggio generico: "Invalid credentials"
- Stesso messaggio per email wrong e password wrong

**Test**:
```typescript
it('should not reveal if email exists', async () => {
  const err1 = await service.verifyPassword(token, 'nonexistent@x.com', 'pass').catch(e => e)
  const err2 = await service.verifyPassword(token, email, 'wrongpass').catch(e => e)
  expect(err1.message).toBe(err2.message)
  expect(err1.message).toBe('Invalid credentials')
})
```

### Attack: Timing Attack
**Scenario**: Hacker misura tempo risposta per capire se password giusta
**Mitigation**: 
- Usa `bcrypt.compare()` che è constant-time
- Aggiungi delay random 50-100ms

**Test**:
```typescript
it('should have similar response times', async () => {
  const times: number[] = []
  for (let i = 0; i < 10; i++) {
    const start = Date.now()
    await service.verifyPassword(token, email, 'wrong').catch(() => {})
    times.push(Date.now() - start)
  }
  const variance = Math.max(...times) - Math.min(...times)
  expect(variance).toBeLessThan(100) // Max 100ms variance
})
```

---

## 3. Admin Endpoint Attacks

### Attack: Privilege Escalation
**Scenario**: User normale chiama endpoint admin
**Mitigation**: 
- Middleware `requirePlatformAdmin` su tutte le route
- Doppio check in controller

**Test**:
```typescript
it('should reject non-admin users', async () => {
  const res = await request(app)
    .post(`/api/users/admin/${userId}/reset-2fa`)
    .set('Authorization', `Bearer ${regularUserToken}`)
  expect(res.status).toBe(403)
})
```

### Attack: Admin Self-Reset
**Scenario**: Admin resetta il proprio 2FA per bypassare
**Mitigation**: 
- Check: `if (adminId === targetUserId) throw 400`

**Test**:
```typescript
it('should prevent admin self-reset', async () => {
  const res = await request(app)
    .post(`/api/users/admin/${adminUserId}/reset-2fa`)
    .set('Authorization', `Bearer ${adminToken}`)
  expect(res.status).toBe(400)
  expect(res.body.error).toContain('Cannot reset your own')
})
```

### Attack: Mass Reset (DoS)
**Scenario**: Admin malevolo resetta tutti gli utenti
**Mitigation**: 
- Rate limit: 10 reset/admin/ora
- Audit log per ogni reset

**Test**:
```typescript
it('should rate limit admin', async () => {
  for (let i = 0; i < 10; i++) {
    await request(app)
      .post(`/api/users/admin/${userIds[i]}/reset-2fa`)
      .set('Authorization', `Bearer ${adminToken}`)
  }
  const res = await request(app)
    .post(`/api/users/admin/${userIds[10]}/reset-2fa`)
    .set('Authorization', `Bearer ${adminToken}`)
  expect(res.status).toBe(429)
})
```

---

## 4. Flow Security Attacks

### Attack: Skip 2FA Setup
**Scenario**: User riceve tempToken e lo usa per accedere senza 2FA
**Mitigation**: 
- tempToken ha `pendingAction: 'require-2fa-setup'`
- Middleware blocca TUTTE le route tranne 2FA setup

**Test**:
```typescript
it('should block all routes except 2FA setup', async () => {
  const { tempToken } = await service.verifyPassword(token, email, password)
  
  const routes = ['/api/dashboard', '/api/products', '/api/orders', '/api/profile']
  for (const route of routes) {
    const res = await request(app)
      .get(route)
      .set('Authorization', `Bearer ${tempToken}`)
    expect(res.status).toBe(403)
    expect(res.body.pendingAction).toBe('require-2fa-setup')
  }
})
```

### Attack: Use Old 2FA Codes
**Scenario**: Hacker conosce vecchi codici TOTP, prova dopo reset
**Mitigation**: 
- `twoFactorSecret = null` quando admin clicca Reset
- `twoFactorEnabled = false` immediatamente

**Test**:
```typescript
it('should invalidate old TOTP immediately', async () => {
  const oldSecret = user.twoFactorSecret
  const oldCode = generateTOTP(oldSecret)
  
  await adminService.reset2FA(userId)
  
  const user = await prisma.user.findUnique({ where: { id: userId } })
  expect(user.twoFactorSecret).toBeNull()
  expect(user.twoFactorEnabled).toBe(false)
  
  // Old code should fail
  const result = await authService.verify2FA(userId, oldCode)
  expect(result.success).toBe(false)
})
```

---

## 5. Set Password Attacks

### Attack: Overwrite Existing Password
**Scenario**: Hacker chiama set-password su account con password
**Mitigation**: 
- Check: `if (user.passwordHash) throw 400`

**Test**:
```typescript
it('should reject if password exists', async () => {
  const res = await request(app)
    .post('/api/users/set-password')
    .set('Authorization', `Bearer ${emailUserToken}`)
    .send({ newPassword: 'HackerPass123!' })
  expect(res.status).toBe(400)
})
```

### Attack: Weak Password
**Scenario**: User imposta password debole
**Mitigation**: 
- Minimo 8 caratteri
- Almeno: 1 maiuscola, 1 minuscola, 1 numero, 1 speciale

**Test**:
```typescript
it('should enforce password rules', async () => {
  const weakPasswords = ['short', '12345678', 'onlylower', 'ONLYUPPER', 'NoSpecial1']
  for (const pwd of weakPasswords) {
    const res = await request(app)
      .post('/api/users/set-password')
      .set('Authorization', `Bearer ${oauthUserToken}`)
      .send({ newPassword: pwd })
    expect(res.status).toBe(400)
  }
})
```

---

## 6. Implementation Checklist

Per ogni endpoint, verificare:

### Reset 2FA Endpoint (`POST /api/users/admin/:userId/reset-2fa`)
- [ ] `authMiddleware` applicato
- [ ] `requirePlatformAdmin` middleware applicato
- [ ] Check self-reset (`adminId !== targetUserId`)
- [ ] Rate limit per admin
- [ ] Audit log creato
- [ ] `twoFactorSecret` nullificato immediatamente
- [ ] Email inviata solo a indirizzo verificato

### Token Validation (`GET /api/auth/2fa-reset/:token`)
- [ ] Rate limit per IP
- [ ] Token esistenza check
- [ ] Token expiry check
- [ ] Token used check
- [ ] Return minimal info (no user details)

### Password Verification (`POST /api/auth/2fa-reset/:token/verify`)
- [ ] Token validation first
- [ ] Account lockout after 5 attempts
- [ ] Constant-time password comparison
- [ ] Generic error messages
- [ ] Return tempToken, NOT JWT
- [ ] Set `pendingAction` in token claims

### 2FA Complete (`POST /api/auth/2fa-reset/:token/complete`)
- [ ] Validate tempToken
- [ ] Check pendingAction
- [ ] Verify new TOTP code
- [ ] Store new secret
- [ ] Set `twoFactorEnabled = true`
- [ ] Mark original token as used
- [ ] Invalidate tempToken
- [ ] Create audit log

### Set Password (`POST /api/users/set-password`)
- [ ] `authMiddleware` required
- [ ] Check `passwordHash === null`
- [ ] Validate password strength
- [ ] Hash with bcrypt (cost 10)
- [ ] Update `authProvider` to "multi"
- [ ] Audit log

---

## 7. Penetration Test Scenarios

Prima del deploy, testare manualmente:

1. **Token Fuzzing**: Provare token malformati, SQL injection, XSS nel token
2. **Rate Limit Bypass**: Usare proxy/VPN per cambiare IP
3. **Session Fixation**: Provare a riusare vecchi tempToken
4. **CSRF**: Verificare che tutti gli endpoint hanno token protection
5. **Timing Analysis**: Misurare tempi risposta con strumenti dedicati
