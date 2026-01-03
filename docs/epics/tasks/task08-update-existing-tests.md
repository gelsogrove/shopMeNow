# Task 07: Aggiornare Test Esistenti

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🟡 MEDIUM  
**Estimated**: 1h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Aggiornare i test esistenti che fanno riferimento a `RegistrationAttempts`. Alcuni test mockano questo servizio e devono essere aggiornati per riflettere il nuovo comportamento (assenza di blocking preventivo).

---

## 🎯 Obiettivo

Tutti i test devono:
- ✅ Non fare riferimento a `RegistrationAttemptsService`
- ✅ Non mockare `checkRegistrationAttempts()`
- ✅ Riflettere il nuovo comportamento (no blocking, solo function-level guard)
- ✅ Passare dopo tutte le modifiche

---

## 💻 File da Modificare

### 1. Test Webhook WhatsApp

**Path**: `apps/backend/__tests__/integration/whatsapp-webhook-plan-limit.spec.ts`

**BEFORE**:
```typescript
import { RegistrationAttemptsService } from '../../src/application/services/registration-attempts.service'

describe('WhatsApp Webhook - Registration Attempts', () => {
  let registrationAttemptsService: RegistrationAttemptsService

  beforeEach(() => {
    registrationAttemptsService = new RegistrationAttemptsService(prisma)
    // Mock checkRegistrationAttempts
    jest.spyOn(registrationAttemptsService, 'checkRegistrationAttempts')
      .mockResolvedValue({
        isBlocked: false,
        attemptsCount: 1,
        message: 'OK'
      })
  })

  it('should block after 3 registration attempts', async () => {
    jest.spyOn(registrationAttemptsService, 'checkRegistrationAttempts')
      .mockResolvedValue({
        isBlocked: true,
        attemptsCount: 3,
        message: 'Blocked'
      })
    
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send(webhookPayload)
    
    expect(response.status).toBe(200)
    expect(response.body.message).toContain('Blocked')
  })

  it('should NOT block before 3 attempts', async () => {
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send(webhookPayload)
    
    expect(response.status).toBe(200)
    expect(registrationAttemptsService.checkRegistrationAttempts).toHaveBeenCalled()
  })
})
```

**AFTER**:
```typescript
// ✅ NO MORE import RegistrationAttemptsService

describe('WhatsApp Webhook - Message Processing', () => {
  // ✅ NO MORE registrationAttemptsService variable

  beforeEach(() => {
    // ✅ NO MORE mock for checkRegistrationAttempts
  })

  it('should allow non-registered user to send unlimited messages', async () => {
    // Send 10 messages (old limit was 5)
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/api/whatsapp/webhook')
        .send({
          ...webhookPayload,
          message: { text: `Message ${i}` }
        })
      
      expect(response.status).toBe(200)
      // ✅ All messages should be processed (no blocking)
    }
  })

  it('should process messages for non-registered customer', async () => {
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send(webhookPayload)
    
    expect(response.status).toBe(200)
    // ✅ NO MORE check for registrationAttemptsService
  })
})
```

### 2. Test Trash Controller

**Path**: `apps/backend/__tests__/unit/trash.controller.spec.ts`

**BEFORE**:
```typescript
describe('TrashController - Registration Attempts', () => {
  it('should soft delete registration attempt', async () => {
    const result = await trashController.softDelete({
      tableName: 'RegistrationAttempts',
      id: 'attempt-123'
    })
    
    expect(result.success).toBe(true)
  })
})
```

**AFTER**:
```typescript
describe('TrashController', () => {
  // ✅ Remove test for RegistrationAttempts soft delete
  // (table no longer exists)

  it('should soft delete customer', async () => {
    const result = await trashController.softDelete({
      tableName: 'Customers',
      id: 'customer-123'
    })
    
    expect(result.success).toBe(true)
  })

  it('should reject unknown table name', async () => {
    const result = await trashController.softDelete({
      tableName: 'RegistrationAttempts', // ❌ Should not be allowed
      id: 'attempt-123'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown table')
  })
})
```

### 3. Test Registration Controller

**Path**: `apps/backend/__tests__/integration/registration.controller.spec.ts`

**BEFORE**:
```typescript
describe('Registration Flow', () => {
  it('should create customer with isBlacklisted=true', async () => {
    const response = await request(app)
      .post('/api/workspaces/:workspaceId/registration/register')
      .send(registrationPayload)
    
    expect(response.status).toBe(200)
    expect(response.body.customer.isBlacklisted).toBe(true)  // ❌ OLD behavior
    expect(response.body.customer.activeChatbot).toBe(false) // ❌ OLD behavior
  })
})
```

**AFTER**:
```typescript
describe('Registration Flow', () => {
  it('should create customer with isBlacklisted=false (immediate activation)', async () => {
    const response = await request(app)
      .post('/api/workspaces/:workspaceId/registration/register')
      .send(registrationPayload)
    
    expect(response.status).toBe(200)
    expect(response.body.customer.isBlacklisted).toBe(false)  // ✅ NEW behavior
    expect(response.body.customer.activeChatbot).toBe(true)   // ✅ NEW behavior
    expect(response.body.customer.isActive).toBe(true)
  })

  it('should allow customer to use chatbot immediately after registration', async () => {
    // Register
    await request(app)
      .post('/api/workspaces/:workspaceId/registration/register')
      .send(registrationPayload)
    
    // Send message (should work)
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send({
        from: registrationPayload.phone,
        message: { text: 'Ciao' }
      })
    
    expect(response.status).toBe(200)
    // ✅ Should receive LLM response (not blocked)
  })
})
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Nessun test fa riferimento a `RegistrationAttemptsService`
- [ ] Nessun test mocka `checkRegistrationAttempts()`
- [ ] Test webhook verificano unlimited messages per non-registrati
- [ ] Test registrazione verificano `isBlacklisted=false` e `activeChatbot=true`
- [ ] Test trash controller NON permettono delete di RegistrationAttempts

### Tecnici
- [ ] Rimosse tutte le import di `RegistrationAttemptsService`
- [ ] Rimossi tutti i mock di `checkRegistrationAttempts()`
- [ ] Aggiunti test per nuovo comportamento (unlimited messages)
- [ ] Aggiunti test per post-registration immediato
- [ ] No errori TypeScript: `npm run build`
- [ ] Tutti i test passano: `npm run test`

### Coverage
- [ ] Coverage >= 80% su `function-executor.service.ts`
- [ ] Coverage >= 80% su `registration.controller.ts`
- [ ] Nessuna funzione critica non testata

---

## 🔗 File Correlati

- `apps/backend/__tests__/integration/whatsapp-webhook-plan-limit.spec.ts`
- `apps/backend/__tests__/unit/trash.controller.spec.ts`
- `apps/backend/__tests__/integration/registration.controller.spec.ts`
- Task 08: Creare nuovi test (function-executor guard, post-registration flow)

---

## 📋 Checklist Implementazione

### Pre-Check
- [ ] Identificare tutti i test con `grep -r "RegistrationAttempts" apps/backend/__tests__/`
- [ ] Identificare tutti i mock con `grep -r "checkRegistrationAttempts" apps/backend/__tests__/`

### 1. Aggiornare Test Webhook
- [ ] Aprire `apps/backend/__tests__/integration/whatsapp-webhook-plan-limit.spec.ts`
- [ ] Rimuovere import `RegistrationAttemptsService`
- [ ] Rimuovere variabile `registrationAttemptsService`
- [ ] Rimuovere mock `checkRegistrationAttempts` nel `beforeEach()`
- [ ] Rimuovere test "should block after 3 registration attempts"
- [ ] Modificare test "should NOT block before 3 attempts" → "should allow unlimited messages"
- [ ] Aggiungere loop test (10 messaggi non-registrato)
- [ ] Eseguire test: `npm run test whatsapp-webhook-plan-limit.spec.ts`

### 2. Aggiornare Test Trash Controller
- [ ] Aprire `apps/backend/__tests__/unit/trash.controller.spec.ts`
- [ ] Rimuovere test "should soft delete registration attempt"
- [ ] Aggiungere test "should reject RegistrationAttempts table" (negative test)
- [ ] Eseguire test: `npm run test trash.controller.spec.ts`

### 3. Aggiornare Test Registration Controller
- [ ] Aprire `apps/backend/__tests__/integration/registration.controller.spec.ts`
- [ ] Modificare aspettative: `isBlacklisted=true` → `isBlacklisted=false`
- [ ] Modificare aspettative: `activeChatbot=false` → `activeChatbot=true`
- [ ] Aggiungere test "should allow customer to use chatbot immediately"
- [ ] Eseguire test: `npm run test registration.controller.spec.ts`

### 4. Verifica Globale
- [ ] Compilare: `cd apps/backend && npm run build`
- [ ] Test unit: `npm run test:unit` - tutti devono passare
- [ ] Test integration: `npm run test:integration` - tutti devono passare
- [ ] Coverage: `npm run test:coverage` - verificare >= 80%
- [ ] Grep finale: `grep -r "RegistrationAttempts" __tests__/` - ZERO risultati

---

**Dependencies**: Task 03 (rimozione service), Task 04 (rimozione webhook checks), Task 05 (post-registration behavior)  
**Blocks**: Task 08 (nuovi test)  
**Last Updated**: 2026-01-03
