# Feature Specification: Auth Recovery & Multi-Provider Support

**Feature ID**: 189-admin-2fa-reset  
**Created**: 2025-11-30  
**Status**: Draft  
**Priority**: High

---

## 1. Overview

### Problem Statement
1. **2FA Recovery**: When users lose access to their 2FA device (lost phone), the recovery codes system is unreliable (users don't save them)
2. **OAuth Password**: Users who register via Google cannot later add email+password login option

### Proposed Solution

#### Part A: Admin-Controlled 2FA Reset
1. **Remove** the recovery codes feature entirely (generation, storage, verification)
2. **Add** an admin-initiated 2FA reset that sends a secure email link
3. User clicks link, **enters password to verify identity**, then re-configures 2FA

#### Part B: OAuth Set Password
1. **Add** ability for OAuth users (Google) to set a password in ProfilePage
2. This enables login via both Google AND email+password
3. `authProvider` changes from `"google"` to `"multi"`

### Business Value
- Simplified user experience during 2FA setup (no recovery codes to save)
- Centralized recovery control for admins
- Better audit trail of account recovery events
- OAuth users can have backup login method
- Reduced support burden from lost recovery codes

---

## 2. User Scenarios & Testing

### PART A: 2FA Reset Scenarios

### Scenario A1: User Loses Phone, Requests 2FA Reset (has password)
**Actor**: End User + Platform Admin

**Flow**:
1. User cannot login because they lost their phone with authenticator app
2. User contacts support (email/phone)
3. Admin verifies user identity (email confirmation, security questions, etc.)
4. Admin opens Backoffice → ClientsPage → finds user
5. Admin clicks "Reset 2FA" button on user card
6. System sends email to user's registered email with temporary link (1 hour expiry)
7. User clicks link → **enters email + password to verify identity**
8. After password verified → User is redirected to 2FA setup page
9. User scans QR code with new authenticator
10. User completes 2FA verification
11. User can now login normally

**Acceptance Criteria**:
- [ ] Admin can reset 2FA for any non-admin user
- [ ] Email is sent within 30 seconds of admin action
- [ ] Link expires after 1 hour
- [ ] User MUST enter correct password before 2FA setup
- [ ] User MUST complete 2FA setup before accessing any other page
- [ ] Audit log records: who reset, for whom, when

### Scenario A2: User Loses Phone AND Forgot Password (worst case)
**Actor**: End User + Platform Admin

**Flow**:
1. User contacts admin: "Ho perso telefono e non ricordo password"
2. Admin: "Prima resetta la password con Forgot Password"
3. User clicks "Forgot Password" on login page → receives email → sets new password
4. User contacts admin again: "Fatto, ora ho la password ma non il 2FA"
5. Admin clicks "Reset 2FA" → System sends email with link
6. User clicks link → enters email + NEW password → Setup 2FA
7. ✅ Account fully recovered

**Acceptance Criteria**:
- [ ] Password reset flow works independently
- [ ] 2FA reset requires valid password (new or old)
- [ ] Both flows can be used in sequence

### Scenario A3: Normal Registration (Simplified - No Recovery Codes)
**Actor**: New User

**Flow**:
1. User registers with email + password
2. User verifies email (if enabled)
3. User logs in first time
4. User is redirected to 2FA setup
5. User scans QR code
6. User enters 6-digit code to verify
7. ~~User sees recovery codes~~ **REMOVED**
8. User is logged in and can access dashboard

**Acceptance Criteria**:
- [ ] No recovery codes are generated
- [ ] No recovery codes page is shown
- [ ] 2FA setup flow ends after code verification

### Scenario A4: Normal Login with 2FA
**Actor**: Existing User

**Flow**:
1. User enters email + password
2. System validates credentials
3. User is redirected to 2FA verification page
4. User opens authenticator app
5. User enters 6-digit code
6. ~~"Use recovery code instead" link~~ **REMOVED**
7. Login successful

**Acceptance Criteria**:
- [ ] No recovery code option on 2FA verification page
- [ ] "Lost access? Contact admin" message shown instead

---

### PART B: OAuth Set Password Scenarios

### Scenario B1: Google User Sets Password
**Actor**: User registered via Google OAuth

**Flow**:
1. User logged in (via Google)
2. User goes to ProfilePage → Security section
3. User sees "Set Password" button (not "Change Password")
4. User clicks → Modal opens with only:
   - New Password field
   - Confirm Password field
   - (NO current password field - they don't have one)
5. User enters and confirms new password
6. System updates:
   - `passwordHash` = hashed new password
   - `authProvider` = "multi"
7. User now can login via Google OR email+password+2FA

**Acceptance Criteria**:
- [ ] Only shown if `authProvider` is "google" (or other OAuth)
- [ ] No "current password" field required
- [ ] Password validation rules applied (8+ chars, etc.)
- [ ] After success, `authProvider` changes to "multi"
- [ ] User can login with both methods

### Scenario B2: Multi-Auth User Changes Password
**Actor**: User with `authProvider = "multi"`

**Flow**:
1. User already has both Google AND password login
2. User goes to ProfilePage → Security section
3. User sees "Change Password" button (standard flow)
4. User must enter CURRENT password + new password
5. Standard password change flow

**Acceptance Criteria**:
- [ ] Current password required
- [ ] Existing change password flow works

---

## 3. Functional Requirements

### 3.1 Recovery Codes Removal (Backend)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-1 | Remove `recoveryCodes` field from User entity | Field no longer exists in schema |
| FR-2 | Remove `/api/auth/verify-recovery-code` endpoint | Endpoint returns 404 |
| FR-3 | Remove recovery code generation in `enable2FA()` | Function no longer returns codes |
| FR-4 | Remove recovery code storage in database | No codes in User table |

### 3.2 Recovery Codes Removal (Frontend)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-5 | Remove recovery codes page/component | Page/route no longer exists |
| FR-6 | Remove "Use recovery code" link from 2FA verify page | Link not present |
| FR-7 | Update 2FA setup success page | No codes displayed |
| FR-8 | Add "Contact admin for help" message on 2FA page | Message visible |

### 3.3 Admin 2FA Reset (Backend)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-9 | Add `POST /api/users/admin/:userId/reset-2fa` endpoint | Endpoint exists, requires platformAdmin |
| FR-10 | Generate secure reset token (UUID + expiry) | Token is cryptographically random, 1hr expiry |
| FR-11 | Store reset token in database | Token persisted with userId, expiry, used flag |
| FR-12 | Send reset email via email service | Email sent with correct link |
| FR-13 | Add `GET /api/auth/2fa-reset/:token` to validate token | Returns success if valid |
| FR-14 | Add `POST /api/auth/2fa-reset/:token/verify` - verify password | Requires email+password, returns temp session |
| FR-15 | Add `POST /api/auth/2fa-reset/:token/complete` for 2FA setup | Enables 2FA after setup |
| FR-16 | Mark token as used after successful reset | Token cannot be reused |
| FR-17 | Create audit log entry | Log contains admin, user, timestamp |

### 3.4 Admin 2FA Reset (Frontend - Backoffice)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-18 | Add "Reset 2FA" button to user cards in ClientsPage | Button visible for users with 2FA enabled |
| FR-19 | Confirmation dialog before reset | Dialog asks for confirmation |
| FR-20 | Success/error toast after action | Appropriate feedback shown |
| FR-21 | Show 2FA status badge on user cards | Badge shows enabled/disabled |

### 3.5 2FA Reset Flow (Frontend)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-22 | Create `/auth/2fa-reset/:token` page | Page loads with valid token |
| FR-23 | Show error for invalid/expired token | Clear error message |
| FR-24 | Password verification form (email + password) | Form validates credentials |
| FR-25 | After password verified → redirect to 2FA setup | Setup page loads |
| FR-26 | Force 2FA completion before any navigation | Cannot skip setup |
| FR-27 | Redirect to login after successful setup | Login page with success message |

### 3.6 OAuth Set Password (Backend)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-28 | Add `POST /api/users/set-password` endpoint | Endpoint exists |
| FR-29 | Only allow if `passwordHash` is null | Error if user already has password |
| FR-30 | Validate new password (8+ chars, rules) | Validation applied |
| FR-31 | Update `authProvider` to "multi" | Field updated in database |
| FR-32 | Hash and store password | passwordHash populated |

### 3.7 OAuth Set Password (Frontend - ProfilePage)

| ID | Requirement | Testable Criteria |
|----|-------------|-------------------|
| FR-33 | Show "Set Password" if OAuth user without password | Button visible |
| FR-34 | Show "Change Password" if user has password | Button visible |
| FR-35 | Set Password modal: only newPassword + confirm | No current password field |
| FR-36 | Success toast after setting password | Feedback shown |

---

## 4. Success Criteria

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Recovery codes removed from codebase | 100% | No references in code |
| Admin can reset 2FA | Works | Manual test |
| Email delivery time | < 30 seconds | Email timestamp vs action timestamp |
| Reset link security | 1 hour expiry | Token expires correctly |
| Password required for 2FA reset | 100% | Cannot proceed without valid password |
| User must complete 2FA after reset | 100% | Cannot access app without 2FA |
| OAuth users can set password | Works | Manual test |
| Audit trail complete | All resets logged | Database audit records |

---

## 5. Data Model Changes

### Remove from User entity:
```
- recoveryCodes: String[]  // REMOVE
```

### Add new table: TwoFactorResetToken
```prisma
model TwoFactorResetToken {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token           String    @unique  // UUID v4
  expiresAt       DateTime  // 1 hour from creation
  usedAt          DateTime? // NULL until used
  createdAt       DateTime  @default(now())
  createdByAdminId String   // Who initiated the reset
  
  @@map("two_factor_reset_tokens")
}
```

### Modify User.authProvider values:
- `"email"` - Registered with email+password
- `"google"` - Registered with Google OAuth only
- `"facebook"` - Registered with Facebook OAuth only
- `"apple"` - Registered with Apple OAuth only
- `"multi"` - Has both OAuth AND password (can login either way)

---

## 6. Security Considerations & Attack Prevention

### 6.1 Token Security

| Attack Vector | Prevention | Implementation |
|---------------|------------|----------------|
| Token brute force | UUID v4 (122 bits entropy) | `crypto.randomUUID()` |
| Token guessing | Rate limit validation attempts | Max 5 attempts per IP per hour |
| Token replay | Single-use tokens | Set `usedAt` after verification |
| Token interception | HTTPS only + short expiry | 1 hour expiry, TLS required |
| Token in logs | Never log full token | Log only first 8 chars: `token.substring(0,8)...` |

### 6.2 Password Verification Security

| Attack Vector | Prevention | Implementation |
|---------------|------------|----------------|
| Password brute force on reset | Account lockout | After 5 failed attempts, lock for 15 min |
| Timing attack | Constant-time comparison | Use `bcrypt.compare()` |
| Email enumeration | Generic error messages | "Invalid credentials" (not "user not found") |
| Session hijacking | No session before 2FA complete | Temp token only, no JWT until 2FA done |

### 6.3 Admin Endpoint Security

| Attack Vector | Prevention | Implementation |
|---------------|------------|----------------|
| Unauthorized admin access | platformAdmin check | `if (!user.isPlatformAdmin) throw 403` |
| Admin impersonation | JWT validation | Full auth middleware stack |
| Mass reset attack | Rate limit per admin | Max 10 resets per admin per hour |
| Admin resetting own 2FA | Block self-reset | `if (adminId === targetUserId) throw 400` |

### 6.4 Email Security

| Attack Vector | Prevention | Implementation |
|---------------|------------|----------------|
| Email spoofing | Only send to verified email | Check `user.emailVerified` or verified OAuth |
| Link manipulation | Signed tokens | Token contains userId, cannot change target |
| Phishing detection | Clear email template | Show "initiated by [admin email]" |

### 6.5 Flow Security

| Attack Vector | Prevention | Implementation |
|---------------|------------|----------------|
| Skip 2FA setup after reset | Force completion | `pendingAction: 'require-2fa-setup'` in temp token |
| Navigate away during setup | Guard routes | Redirect to setup if `pendingAction` present |
| Use old 2FA codes | Invalidate immediately | Clear `twoFactorSecret` when reset initiated |

### 6.6 Set Password Security (OAuth users)

| Attack Vector | Prevention | Implementation |
|---------------|------------|----------------|
| Set password when already exists | Check `passwordHash` | `if (user.passwordHash) throw 400` |
| Weak password | Validation rules | 8+ chars, upper, lower, number, special |
| CSRF attack | Auth required | JWT token must be valid |

---

## 7. Security Test Cases (MANDATORY)

### 7.1 Token Security Tests

```typescript
describe('2FA Reset Token Security', () => {
  // SEC-1: Token must be cryptographically random
  it('should generate UUID v4 tokens', async () => {
    const token = await service.createResetToken(userId, adminId)
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  // SEC-2: Token expires after 1 hour
  it('should reject expired tokens', async () => {
    const token = await createExpiredToken() // created 2 hours ago
    await expect(service.validateToken(token)).rejects.toThrow('Token expired')
  })

  // SEC-3: Token can only be used once
  it('should reject already-used tokens', async () => {
    const token = await service.createResetToken(userId, adminId)
    await service.verifyPassword(token, email, password) // First use
    await expect(service.verifyPassword(token, email, password)).rejects.toThrow('Token already used')
  })

  // SEC-4: Rate limit token validation
  it('should rate limit after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await service.validateToken('invalid-token').catch(() => {})
    }
    await expect(service.validateToken('another-invalid')).rejects.toThrow('Too many attempts')
  })

  // SEC-5: Token not logged in full
  it('should only log partial token', async () => {
    const logSpy = jest.spyOn(logger, 'info')
    await service.createResetToken(userId, adminId)
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringMatching(/[0-9a-f]{36}/))
  })
})
```

### 7.2 Password Verification Tests

```typescript
describe('Password Verification Security', () => {
  // SEC-6: Account lockout after 5 failed attempts
  it('should lock account after 5 failed password attempts', async () => {
    const token = await service.createResetToken(userId, adminId)
    for (let i = 0; i < 5; i++) {
      await service.verifyPassword(token, email, 'wrong').catch(() => {})
    }
    await expect(service.verifyPassword(token, email, 'correct'))
      .rejects.toThrow('Account temporarily locked')
  })

  // SEC-7: Generic error for invalid credentials
  it('should not reveal if user exists', async () => {
    const token = await service.createResetToken(userId, adminId)
    const error1 = await service.verifyPassword(token, 'wrong@email.com', 'pass').catch(e => e)
    const error2 = await service.verifyPassword(token, email, 'wrongpass').catch(e => e)
    expect(error1.message).toBe('Invalid credentials')
    expect(error2.message).toBe('Invalid credentials')
  })

  // SEC-8: No JWT issued until 2FA complete
  it('should not issue JWT token before 2FA setup', async () => {
    const token = await service.createResetToken(userId, adminId)
    const result = await service.verifyPassword(token, email, password)
    expect(result.jwt).toBeUndefined()
    expect(result.tempToken).toBeDefined()
    expect(result.pendingAction).toBe('require-2fa-setup')
  })
})
```

### 7.3 Admin Endpoint Tests

```typescript
describe('Admin Reset Endpoint Security', () => {
  // SEC-9: Only platform admin can reset
  it('should reject non-admin users', async () => {
    const res = await request(app)
      .post(`/api/users/admin/${targetUserId}/reset-2fa`)
      .set('Authorization', `Bearer ${regularUserToken}`)
    expect(res.status).toBe(403)
  })

  // SEC-10: Admin cannot reset own 2FA
  it('should prevent admin from resetting own 2FA', async () => {
    const res = await request(app)
      .post(`/api/users/admin/${adminUserId}/reset-2fa`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Cannot reset your own 2FA')
  })

  // SEC-11: Rate limit per admin
  it('should rate limit admin resets', async () => {
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

  // SEC-12: Audit log created
  it('should create audit log entry', async () => {
    await request(app)
      .post(`/api/users/admin/${targetUserId}/reset-2fa`)
      .set('Authorization', `Bearer ${adminToken}`)
    
    const log = await prisma.auditLog.findFirst({
      where: { action: '2fa-reset-initiated', targetUserId }
    })
    expect(log).toBeDefined()
    expect(log.performedBy).toBe(adminUserId)
  })
})
```

### 7.4 Flow Security Tests

```typescript
describe('2FA Reset Flow Security', () => {
  // SEC-13: Cannot skip 2FA setup
  it('should force 2FA setup before any navigation', async () => {
    const resetToken = await service.createResetToken(userId, adminId)
    const { tempToken } = await service.verifyPassword(resetToken, email, password)
    
    // Try to access dashboard with temp token
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tempToken}`)
    expect(res.status).toBe(403)
    expect(res.body.pendingAction).toBe('require-2fa-setup')
  })

  // SEC-14: Old 2FA codes invalidated immediately
  it('should invalidate old 2FA secret on reset initiation', async () => {
    const oldSecret = user.twoFactorSecret
    await service.createResetToken(userId, adminId)
    
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } })
    expect(updatedUser.twoFactorSecret).toBeNull()
    expect(updatedUser.twoFactorEnabled).toBe(false)
    
    // Old TOTP code should not work
    const oldCode = generateTOTP(oldSecret)
    const loginResult = await authService.login(email, password, oldCode)
    expect(loginResult.success).toBe(false)
  })

  // SEC-15: Complete flow only works once
  it('should complete 2FA setup only once per token', async () => {
    const resetToken = await service.createResetToken(userId, adminId)
    const { tempToken } = await service.verifyPassword(resetToken, email, password)
    
    await service.complete2FASetup(tempToken, newSecret, validCode)
    
    await expect(service.complete2FASetup(tempToken, newSecret, validCode))
      .rejects.toThrow('Setup already completed')
  })
})
```

### 7.5 Set Password Security Tests

```typescript
describe('OAuth Set Password Security', () => {
  // SEC-16: Cannot set password if already exists
  it('should reject if user already has password', async () => {
    const res = await request(app)
      .post('/api/users/set-password')
      .set('Authorization', `Bearer ${emailUserToken}`) // User with password
      .send({ newPassword: 'NewPass123!' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('already has a password')
  })

  // SEC-17: Validate password strength
  it('should enforce password rules', async () => {
    const res = await request(app)
      .post('/api/users/set-password')
      .set('Authorization', `Bearer ${googleUserToken}`)
      .send({ newPassword: 'weak' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Password must be at least 8 characters')
  })

  // SEC-18: Auth required
  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/users/set-password')
      .send({ newPassword: 'StrongPass123!' })
    expect(res.status).toBe(401)
  })
})
```

---

## 8. Out of Scope

- Self-service 2FA reset (user-initiated without admin)
- SMS-based 2FA recovery
- Hardware security key support
- 2FA backup via phone number
- Social login linking (add Google to existing email account)

---

## 8. Assumptions

- Email service is already configured and working
- Users have verified email addresses
- Backoffice is accessible only to platform admins
- 1 hour is sufficient time for user to complete reset

---

## 9. Dependencies

- Email notification system (existing)
- Backoffice ClientsPage (existing)
- 2FA setup flow (existing, will be modified)

---

## 10. Implementation Plan

### Phase 1: Remove Recovery Codes
1. Remove backend endpoints and logic
2. Remove frontend components and pages
3. Database migration to remove recoveryCodes field
4. Update tests

### Phase 2: Add Admin 2FA Reset
1. Create database migration for TwoFactorResetToken table
2. Implement backend endpoints (reset-2fa, validate, verify password, complete)
3. Add email template for reset link
4. Add button and logic to Backoffice ClientsPage

### Phase 3: 2FA Reset Flow with Password Verification
1. Create reset token validation page
2. Add password verification step
3. Integrate with existing 2FA setup
4. Force 2FA completion guard
5. End-to-end testing

### Phase 4: OAuth Set Password
1. Add backend `POST /api/users/set-password` endpoint
2. Update ProfilePage with conditional UI
3. Create Set Password modal (no current password)
4. Update authProvider to "multi" on success

---

## 11. Rollback Plan

If issues arise:
1. Recovery codes can be re-added via migration
2. Reset token table can remain (no harm)
3. Feature flag can disable admin reset button
4. Set Password can be hidden via feature flag

---

## 12. API Endpoints Summary

### New Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/admin/:userId/reset-2fa` | platformAdmin | Initiate 2FA reset, send email |
| GET | `/api/auth/2fa-reset/:token` | Public | Validate reset token |
| POST | `/api/auth/2fa-reset/:token/verify` | Public | Verify email + password |
| POST | `/api/auth/2fa-reset/:token/complete` | Temp session | Complete 2FA setup |
| POST | `/api/users/set-password` | Auth | OAuth user sets password |

### Removed Endpoints

| Method | Endpoint | Reason |
|--------|----------|--------|
| POST | `/api/auth/verify-recovery-code` | Recovery codes removed |
