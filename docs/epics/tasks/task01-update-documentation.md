# Task 01: Aggiornare Documentazione

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH (FIRST TASK!)  
**Estimated**: 1.5h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Aggiornare la documentazione esistente e creare nuovi documenti per riflettere il nuovo flusso di registrazione. La documentazione deve essere consistente con l'implementazione e fornire esempi chiari per sviluppatori.

---

## 🎯 Obiettivo

Documentazione completa e aggiornata:
- ✅ Aggiornare **PRD.md** (documento master - sezioni Registration & Blocking)
- ✅ Rimuovere riferimenti a RegistrationAttempts blocking
- ✅ Documentare function-level guard
- ✅ Documentare nuovo flusso post-registrazione
- ✅ Creare diagramma flusso registration

---

## 💻 File da Modificare/Creare

### 1. Aggiornare Blocking System Documentation

**Path**: `docs/architecture/blocking.md`

**BEFORE**:
```markdown
## Registration Attempts Blocking

Il sistema blocca utenti dopo 3 tentativi di registrazione falliti:

1. **Check Pre-Webhook**: `RegistrationAttemptsService.checkRegistrationAttempts()`
2. **Counter**: Incrementa dopo ogni tentativo
3. **Blocking**: Dopo 3 tentativi, utente bloccato per 24h
4. **Cleanup**: Cron job giornaliero pulisce tentativi vecchi

### Implementazione

```typescript
const result = await registrationAttemptsService.checkRegistrationAttempts(phone, workspaceId)
if (result.isBlocked) {
  return res.status(403).json({ error: 'Blocked' })
}
```
```

**AFTER**:
```markdown
## Registration System

Il sistema NON blocca preventivamente gli utenti. La registrazione è richiesta solo per function specifiche (cart, orders, profile).

### Function-Level Guard

10 function protette richiedono `customer.isActive=true`:

**Cart Management**:
- `addToCart`
- `viewCart`
- `clearCart`

**Order Tracking**:
- `getLinkOrderByCode`
- `repeatOrder`
- `getOrderDetails`
- `confirmOrder`
- `showCheckout`

**Profile Management**:
- `handlePushNotifications`
- `getProfileLink`

### Implementazione

```typescript
// In FunctionExecutorService.execute()
if (FUNCTIONS_REQUIRING_REGISTRATION.includes(context.functionName)) {
  if (!context.customerIsActive) {
    return {
      success: false,
      error: 'REGISTRATION_REQUIRED',
      message: `Per utilizzare "${context.functionName}" devi registrarti: [LINK_REGISTRATION_WITH_TOKEN]`
    }
  }
}
```

### Token Replacement

Il token `[LINK_REGISTRATION_WITH_TOKEN]` viene sostituito con link JWT valido 24h:

```typescript
// In LLMService.replaceLinkTokens()
case '[LINK_REGISTRATION_WITH_TOKEN]':
  const registrationLink = await this.generateRegistrationLink(customer.phone, workspace.id)
  finalMessage = finalMessage.replace(token, registrationLink)
  break
```
```

### 2. Aggiornare Welcome Message Edge Cases

**Path**: `docs/architecture/welcome-message-edge-cases.md`

Aggiungere sezione:

```markdown
## Edge Case 10: Non-Registered User Attempts Protected Function

**Scenario**: Customer non registrato cerca di usare function protetta (es. addToCart)

**Behavior**:
1. `FunctionExecutorService` esegue guard check
2. Guard rileva `customerIsActive=false`
3. Return error: `REGISTRATION_REQUIRED`
4. LLM riceve error e formula messaggio: "Per aggiungere al carrello devi registrarti: [link]"
5. `LLMService.replaceLinkTokens()` sostituisce `[LINK_REGISTRATION_WITH_TOKEN]` con JWT link
6. Customer riceve messaggio con link registrazione valido 24h

**Expected Message**:
- IT: "Per utilizzare il carrello devi registrarti. Completa qui: https://..."
- EN: "To use the cart you need to register. Complete here: https://..."

**Implementation**:
- Guard in `function-executor.service.ts` (linea ~50)
- Token replacement in `llm.service.ts` (linea ~577)
- Link generation via `SecureTokenService.generateToken()`
```

### 3. Creare Nuovo Documento Registration Flow

**Path**: `docs/architecture/registration-flow.md`

```markdown
# Registration Flow

## Overview

Il sistema eChatbot implementa un flusso di registrazione **permissivo**: gli utenti possono interagire liberamente con il chatbot senza registrarsi. La registrazione è richiesta solo per function specifiche che richiedono personalizzazione (cart, orders, profile).

---

## Architecture Decision

**OLD APPROACH (❌ Rimosso)**:
- Blocking preventivo dopo 3 tentativi registrazione
- Limite 5 messaggi per utenti non registrati
- Admin approval necessaria post-registrazione

**NEW APPROACH (✅ Corrente)**:
- Nessun blocking preventivo
- Messaggi illimitati per tutti gli utenti
- Registrazione richiesta solo per function specifiche
- Attivazione immediata post-registrazione

---

## Function Protection

### Protected Functions (10)

Richiedono `customer.isActive=true`:

| Category | Functions |
|----------|-----------|
| Cart Management | `addToCart`, `viewCart`, `clearCart` |
| Order Tracking | `getLinkOrderByCode`, `repeatOrder`, `getOrderDetails`, `confirmOrder`, `showCheckout` |
| Profile Management | `handlePushNotifications`, `getProfileLink` |

### Public Functions (4)

Funzionano sempre (anche per non registrati):

| Category | Functions |
|----------|-----------|
| Product Catalog | `getProductDetails`, `getServiceDetails`, `searchProductForStatistic` |
| Customer Support | `contactOperator` |

---

## Implementation Details

### 1. Function Executor Guard

**File**: `apps/backend/src/services/function-executor.service.ts`

```typescript
const FUNCTIONS_REQUIRING_REGISTRATION = [
  'addToCart', 'viewCart', 'clearCart',
  'getLinkOrderByCode', 'repeatOrder', 'getOrderDetails', 'confirmOrder', 'showCheckout',
  'handlePushNotifications', 'getProfileLink'
]

async execute(context: ExecutionContext): Promise<ExecutionResult> {
  // GUARD: Check registration requirement
  if (FUNCTIONS_REQUIRING_REGISTRATION.includes(context.functionName)) {
    if (!context.customerIsActive) {
      return {
        success: false,
        error: 'REGISTRATION_REQUIRED',
        message: `Per utilizzare "${context.functionName}" devi registrarti: [LINK_REGISTRATION_WITH_TOKEN]`
      }
    }
  }

  // Execute function normally
  switch (context.functionName) {
    case 'addToCart': return await this.addToCart(context)
    // ... other cases
  }
}
```

### 2. Token Replacement

**File**: `apps/backend/src/services/llm.service.ts`

```typescript
private async replaceLinkTokens(message: string, customer: Customer, workspace: Workspace): Promise<string> {
  const tokens = message.match(/\[LINK_[A-Z_]+\]/g) || []
  
  for (const token of tokens) {
    switch (token) {
      case '[LINK_REGISTRATION_WITH_TOKEN]':
        const registrationLink = await this.generateRegistrationLink(
          customer.phone,
          workspace.id
        )
        message = message.replace(token, registrationLink)
        break
      // ... other cases
    }
  }
  
  return message
}

private async generateRegistrationLink(phone: string, workspaceId: string): Promise<string> {
  const token = await this.secureTokenService.generateToken({
    type: 'registration',
    phone,
    workspaceId,
    expiresIn: '24h'
  })
  
  return `${process.env.FRONTEND_URL}/register?token=${token}`
}
```

### 3. Post-Registration Activation

**File**: `apps/backend/src/interfaces/http/controllers/registration.controller.ts`

```typescript
async register(req: Request, res: Response) {
  // ... validation

  const customer = await prisma.customers.create({
    data: {
      name: `${first_name} ${last_name}`,
      email,
      phone,
      workspaceId: workspace_id,
      isActive: true,          // ✅ Active immediately
      isBlacklisted: false,    // ✅ NOT blocked
      activeChatbot: true,     // ✅ Chatbot ENABLED
      // ... other fields
    }
  })

  return res.json({ customer })
}
```

---

## Flow Diagrams

### Non-Registered User Flow

```
Customer → Send Message "Voglio ordinare"
           ↓
       Chat Engine
           ↓
       LLM Router (Intent: ADD_TO_CART)
           ↓
   Function Executor → addToCart()
           ↓
       GUARD CHECK: customerIsActive?
           ├─ YES → Execute addToCart
           └─ NO  → Return REGISTRATION_REQUIRED
                    ↓
                LLM receives error
                    ↓
                LLM formats message
                    ↓
            Token Replacement
                    ↓
         Customer receives link
```

### Post-Registration Flow

```
Customer → Clicks registration link
           ↓
     Frontend → /register?token=xxx
           ↓
  Registration Controller
           ↓
    Create/Update Customer
    - isActive: true
    - isBlacklisted: false
    - activeChatbot: true
           ↓
  Customer can use ALL functions
  (cart, orders, profile)
```

---

## Testing

### Unit Tests

**File**: `apps/backend/__tests__/unit/function-executor-registration-guard.spec.ts`

Tests:
- ✅ Block 10 protected functions for `customerIsActive=false`
- ✅ Allow 10 protected functions for `customerIsActive=true`
- ✅ Allow 4 public functions for `customerIsActive=false`
- ✅ Error message includes `[LINK_REGISTRATION_WITH_TOKEN]`

### Integration Tests

**File**: `apps/backend/__tests__/integration/registration-post-flow.spec.ts`

Tests:
- ✅ Customer created with `isBlacklisted=false`, `activeChatbot=true`
- ✅ Customer can send messages immediately after registration
- ✅ Customer can use protected functions after registration

---

## Migration Notes

**Database**: Table `registration_attempts` removed via Prisma migration
**Service**: `RegistrationAttemptsService` deleted (231 lines)
**Routes**: Registration attempts routes removed
**Webhook**: Removed STEP 1&2 (registration attempts check) and 5-message limit

---

## Future Considerations

- **Fraud Prevention**: Monitor patterns (non più blocco preventivo)
- **Spam Protection**: Rate limiting a livello API gateway (non chat)
- **User Experience**: A/B testing conversione con/senza registration prompt
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] `blocking.md` aggiornato (RegistrationAttempts rimosso, guard documentato)
- [ ] `welcome-message-edge-cases.md` aggiornato (edge case 10 aggiunto)
- [ ] `registration-flow.md` creato (architettura completa, diagrammi, esempi)
- [ ] Tutti i riferimenti a RegistrationAttempts rimossi dalla docs

### Tecnici
- [ ] Markdown syntax corretto (linter passa)
- [ ] Code examples compilano senza errori
- [ ] Diagrammi chiari e leggibili
- [ ] Links interni funzionanti

### Completezza
- [ ] PRD.md aggiornato (sezione Registration + Blocking)
- [ ] Architecture decision documentata
- [ ] Implementation details con code examples
- [ ] Flow diagrams per user journey
- [ ] Testing section con file references
- [ ] Migration notes per deployment

---

## 🔗 File Correlati

- `docs/PRD.md` - PRD principale (MUST UPDATE - sezione Registration & Blocking)
- `docs/architecture/blocking.md` - Sistema blocking (da aggiornare)
- `docs/architecture/welcome-message-edge-cases.md` - Edge cases (da aggiornare)
- `docs/architecture/registration-flow.md` - Nuovo documento (da creare)

---

## 📋 Checklist Implementazione

### 0. Aggiornare PRD.md (MASTER DOCUMENT)
- [ ] Aprire `docs/PRD.md`
- [ ] Trovare sezione "Registration & Authentication" (circa linea 2000-2500)
- [ ] Aggiornare descrizione: rimuovere RegistrationAttempts blocking
- [ ] Documentare nuovo approccio: "Registration required only for 10 specific functions"
- [ ] Aggiungere lista 10 function protette (cart, orders, profile)
- [ ] Trovare sezione "Blocking System" (circa linea 3000-3500)
- [ ] Rimuovere paragrafo "Registration Attempts Blocking (3 attempts → 24h block)"
- [ ] Aggiungere paragrafo "Function-Level Registration Guard"
- [ ] Salvare e verificare consistenza con implementation

### 1. Aggiornare Blocking Documentation
- [ ] Aprire `docs/architecture/blocking.md`
- [ ] Trovare sezione "Registration Attempts Blocking"
- [ ] Rimuovere intera sezione RegistrationAttempts
- [ ] Aggiungere nuova sezione "Function-Level Guard"
- [ ] Includere lista 10 function protette
- [ ] Includere code example guard implementation
- [ ] Includere code example token replacement
- [ ] Salvare e verificare markdown syntax

### 2. Aggiornare Welcome Message Edge Cases
- [ ] Aprire `docs/architecture/welcome-message-edge-cases.md`
- [ ] Aggiungere "## Edge Case 10: Non-Registered User Attempts Protected Function"
- [ ] Documentare behavior step-by-step
- [ ] Includere expected messages (IT/EN)
- [ ] Includere implementation references (file + line number)
- [ ] Salvare e verificare markdown syntax

### 3. Creare Registration Flow Document
- [ ] Creare `docs/architecture/registration-flow.md`
- [ ] Sezione "Overview" con architecture decision
- [ ] Sezione "Function Protection" con tabelle (protected vs public)
- [ ] Sezione "Implementation Details" con 3 code examples
- [ ] Sezione "Flow Diagrams" con 2 diagrammi ASCII
- [ ] Sezione "Testing" con file references
- [ ] Sezione "Migration Notes" con changelog
- [ ] Sezione "Future Considerations"
- [ ] Salvare e verificare markdown syntax

### 4. Grep Verification
- [ ] `grep -r "RegistrationAttempts" docs/` - ZERO risultati (escluso archived/)
- [ ] `grep -r "checkRegistrationAttempts" docs/` - ZERO risultati
- [ ] `grep -r "registration attempts" docs/ -i` - Solo in archived/ o new docs
- [ ] `grep "RegistrationAttempts" docs/PRD.md` - ZERO risultati

### 5. Final Review
- [ ] PRD.md: Sezioni Registration e Blocking aggiornate e consistenti
- [ ] Markdown linter: `npx markdownlint docs/architecture/*.md docs/PRD.md`
- [ ] Links verification: click all internal links
- [ ] Code examples: copy-paste in VSCode, verify no TypeScript errors
- [ ] Diagrammi: verify leggibilità e accuratezza

---

**Dependencies**: Tutti i task 01-08 (implementation completata)  
**Blocks**: Nessuno (ultimo task dell'epic)  
**Last Updated**: 2026-01-03

---

## 📝 Notes

- Markdown deve seguire standard: titoli H2/H3, code blocks con syntax highlighting
- Diagrammi ASCII devono essere chiari anche senza rendering
- Code examples devono essere copy-pastable e compilabili
- Migration notes critiche per deployment team
