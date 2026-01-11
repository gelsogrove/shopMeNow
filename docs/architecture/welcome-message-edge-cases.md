# Welcome Message - Analisi Casi Edge

**Version**: 2.0.0  
**Last Updated**: January 3, 2026  
**Status**: ACTIVE - Post RegistrationAttempts Removal

---

## 📊 Flusso Webhook WhatsApp (Ordine Esecuzione)

```
INCOMING MESSAGE
    ↓
1. 🆕 NUOVO UTENTE (customer === null)
    ├─ ✅ Billing check → Welcome message
    └─ ✅ Nessun limite messaggi (invito registrazione in LLM se funzioni protette)
    
2. 👤 UTENTE ESISTENTE (customer found)
    ├─ Rate limit check (15/min per customer, 100/min per workspace)
    ├─ 🚫 BLACKLIST CHECK (isBlacklisted = true)
    │   └─ ❌ BLOCCO SILENZIOSO (return 200, no message)
    ├─ 🤖 CHATBOT DISABLED (activeChatbot = false)
    │   └─ ⚠️ Salva messaggio, NO LLM, NO risposta
    ├─ 💾 Get/Create ChatSession
    ├─ 🔒 WORKSPACE ACCESS CHECK
    │   ├─ channelStatus = false (WIP) → Salva + WIP message + enqueue WhatsApp
    │   └─ PAUSED/CREDIT_EXHAUSTED → SILENT BLOCK
    ├─ 💰 BILLING CHECK (credit availability)
    │   └─ ❌ No credit → return 402
    └─ ✅ Passa a ChatEngine
            ↓
        🎯 ChatEngine.routeMessage()
            ↓
        **CHECK count = 0**
            ↓
        Se count = 0 → Welcome Message
            ↓
        🔐 Function Execution → Registration Guard
            ↓
        Se function protetta + !isActive → REGISTRATION_REQUIRED error
```

---

## 🎯 Casi Edge da Testare

| # | Caso | count=0 | Riceve Welcome? | Return Code | Test Priority |
|---|------|---------|-----------------|-------------|---------------|
| 1 | ❌ ~~Utente bloccato (attemptCount >= 4)~~ | - | - | - | **REMOVED** |
| 2 | Canale disabilitato (channelStatus=false) | ✅ | ❌ (WIP msg + enqueue) | 200 "channel_disabled" | 🔴 HIGH |
| 3 | Workspace senza credito | ✅ | ❌ | 402 SILENT | 🔴 HIGH |
| 4 | Workspace cancellato | ✅ | ❌ | 402 SILENT | 🟡 MEDIUM |
| 5 | activeChatbot=false | ✅ | ❌ | 200 "message_saved" | 🔴 HIGH |
| 6 | ❌ ~~isActive=false + count>=5 (24h)~~ | - | - | - | **REMOVED** |
| 7 | isActive=false (non registrato) | ✅ | ✅ | 200 + welcome | 🟢 HAPPY PATH |
| 8 | Customer soft-deleted | ✅ | ✅ (nuovo) | 200 + welcome | 🟡 MEDIUM |
| 9 | Rate limit exceeded | ✅ | ❌ | 429 | 🔴 HIGH |
| **10** | **isActive=false + Protected Function** | ✅ | ✅ (+ link) | 200 + registration link | 🔴 **NEW** |

---

## 📋 Edge Case Dettagliati

### Edge Case 10: Non-Registered User Attempts Protected Function (NEW)

**Scenario**: Customer non registrato (`isActive=false`) cerca di usare function protetta (es. `addToCart`)

**Behavior**:
1. Webhook riceve messaggio: "Aggiungi al carrello"
2. ChatEngine elabora → LLM rileva intent `ADD_TO_CART`
3. LLM chiama function: `addToCart(productId, quantity)`
4. `FunctionExecutorService.execute()` esegue guard check
5. Guard rileva `customerIsActive=false`
6. Return error: `{ success: false, error: "REGISTRATION_REQUIRED", message: "..." }`
7. LLM riceve error e formula messaggio: "Per aggiungere al carrello devi registrarti: [LINK_REGISTRATION]"
8. `LinkReplacementService` sostituisce token con JWT link valido 24h
9. Customer riceve messaggio con link registrazione

**Expected Message**:
- **IT**: "Per utilizzare il carrello devi registrarti. Completa qui: https://..."
- **EN**: "To use the cart you need to register. Complete here: https://..."
- **ES**: "Para usar el carrito debes registrarte. Completa aquí: https://..."
- **PT**: "Para usar o carrinho você deve se registrar. Complete aqui: https://..."

**Implementation**:
- Guard: `function-executor.service.ts` (linea ~50)
- Token replacement: `apps/backend/src/application/services/link-replacement.service.ts`
- Link generation: `TokenService.createRegistrationToken()`

**Protected Functions (10)**:
| Category | Functions |
|----------|-----------|
| Cart | `addToCart`, `viewCart`, `clearCart` |
| Orders | `getLinkOrderByCode`, `repeatOrder`, `getOrderDetails`, `confirmOrder`, `showCheckout` |
| Profile | `handlePushNotifications`, `getProfileLink` |

**Public Functions** (sempre disponibili):
- `getProductDetails`, `getServiceDetails`, `searchProductForStatistic`, `contactOperator`

---

## ✅ Comportamento Post-Registrazione

**NUOVO (dal 2026-01-03)**:

Quando customer completa registrazione:
- `isActive`: `true` (attivazione immediata)
- `isBlacklisted`: `false` (NO blocco)
- `activeChatbot`: `true` (chatbot abilitato)

**VECCHIO** (deprecato):
- ~~`isBlacklisted`: `true` (richiedeva approvazione admin)~~
- ~~`activeChatbot`: `false` (chatbot disabilitato)~~

**Effetto**:
- ✅ Customer può usare TUTTE le function protette immediatamente
- ✅ Nessun intervento admin necessario
- ✅ UX fluida: registrazione → utilizzo immediato

---

## 🔍 Testing

### Test Prioritari (dopo rimozione RegistrationAttempts)

```typescript
// Test 1: Non-registered user can send unlimited messages
it('should allow non-registered user to send 10+ messages', async () => {
  for (let i = 0; i < 10; i++) {
    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send({ from: '+39333', message: { text: `Message ${i}` } })
    
    expect(response.status).toBe(200)
  }
})

// Test 2: Protected function requires registration
it('should block addToCart for non-registered user', async () => {
  const result = await functionExecutor.execute({
    functionName: 'addToCart',
    customerIsActive: false,
    // ... context
  })
  
  expect(result.success).toBe(false)
  expect(result.error).toBe('REGISTRATION_REQUIRED')
  expect(result.message).toContain('[LINK_REGISTRATION]')
})

// Test 3: Post-registration immediate activation
it('should activate customer immediately after registration', async () => {
  const response = await request(app)
    .post('/api/workspaces/:id/registration/register')
    .send({ phone: '+39333', email: 'test@test.com', ... })
  
  expect(response.body.customer.isActive).toBe(true)
  expect(response.body.customer.isBlacklisted).toBe(false)
  expect(response.body.customer.activeChatbot).toBe(true)
})
```

---

## 🗑️ Rimosso

### ❌ Edge Case 1: Registration Attempts Blocking (REMOVED)

**Motivo rimozione**: Approccio troppo restrittivo. Gli utenti devono poter esplorare liberamente il chatbot. La registrazione viene richiesta solo quando necessaria (function protette).

**Cosa è stato rimosso**:
- `RegistrationAttemptsService` (231 righe)
- Model `RegistrationAttempts` dal database
- Check pre-webhook (STEP 1&2 - linee 317-377)
- Blocco dopo 3 tentativi

### ❌ Edge Case 6: Unregistered User 5-Message Limit (REMOVED)

**Motivo rimozione**: Limite troppo basso impediva esplo razione. Gli utenti possono ora inviare messaggi illimitati e ricevere risposte LLM anche senza registrazione.

**Cosa è stato rimosso**:
- Check `MAX_UNREGISTERED_MESSAGES = 5` (webhook controller linee 804-838)
- Logica conteggio messaggi 24h per non registrati

---

## 📚 Related Documentation

- [blocking.md](./blocking.md) - Sistema blocking aggiornato
- [registration-flow.md](./registration-flow.md) - Nuovo flusso registrazione
- Task 01: Update Documentation (epic corrente)

---

Status: **ACTIVE** - Documento aggiornato post-rimozione RegistrationAttempts
