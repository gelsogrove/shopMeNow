# Task 05: Modificare Comportamento Post-Registrazione

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 30min  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Modificare i defaults nel `RegistrationController` quando un utente completa la registrazione. Attualmente i nuovi utenti vengono creati con `isBlacklisted=true` e `activeChatbot=false` (richiedendo approvazione admin). Dobbiamo cambiarli a `false` e `true` rispettivamente per permettere utilizzo immediato.

---

## 🎯 Obiettivo

Dopo la registrazione, l'utente deve essere **immediatamente operativo**:
- ✅ Può scrivere messaggi WhatsApp
- ✅ Riceve risposte dal chatbot LLM
- ✅ Può usare tutte le function (cart, orders, profile)

---

## 💻 File da Modificare

**Path**: `apps/backend/src/interfaces/http/controllers/registration.controller.ts`

### Modifiche al Metodo `register()`

**BEFORE** (circa linee 210-212 e 235-237):
```typescript
// Caso 1: Update existing customer
await prisma.customers.update({
  where: { id: existingCustomer.id },
  data: {
    name: `${first_name} ${last_name}`,
    email: email,
    company,
    language: language || "ENG",
    currency: currency || "USD",
    last_privacy_version_accepted: "1.0.0",
    privacy_accepted_at: new Date(),
    push_notifications_consent: push_notifications_consent || false,
    push_notifications_consent_at: push_notifications_consent ? new Date() : null,
    isActive: true,                   // ✅ OK - already correct
    isBlacklisted: true,              // ❌ WRONG - change to false
    activeChatbot: false,             // ❌ WRONG - change to true
  },
})

// Caso 2: Create new customer
customer = await prisma.customers.create({
  data: {
    name: `${first_name} ${last_name}`,
    email: email,
    phone,
    company,
    workspaceId: workspace_id,
    language: language || "ENG",
    currency: currency || "USD",
    last_privacy_version_accepted: "1.0.0",
    privacy_accepted_at: new Date(),
    push_notifications_consent: push_notifications_consent || false,
    push_notifications_consent_at: push_notifications_consent ? new Date() : null,
    isActive: true,                   // ✅ OK - already correct
    isBlacklisted: true,              // ❌ WRONG - change to false
    activeChatbot: false,             // ❌ WRONG - change to true
  },
})
```

**AFTER**:
```typescript
// Caso 1: Update existing customer
await prisma.customers.update({
  where: { id: existingCustomer.id },
  data: {
    name: `${first_name} ${last_name}`,
    email: email,
    company,
    language: language || "ENG",
    currency: currency || "USD",
    last_privacy_version_accepted: "1.0.0",
    privacy_accepted_at: new Date(),
    push_notifications_consent: push_notifications_consent || false,
    push_notifications_consent_at: push_notifications_consent ? new Date() : null,
    isActive: true,                   // ✅ Account active
    isBlacklisted: false,             // ✅ NOT blocked (immediate access)
    activeChatbot: true,              // ✅ Chatbot ENABLED (can receive LLM responses)
  },
})

// Caso 2: Create new customer
customer = await prisma.customers.create({
  data: {
    name: `${first_name} ${last_name}`,
    email: email,
    phone,
    company,
    workspaceId: workspace_id,
    language: language || "ENG",
    currency: currency || "USD",
    last_privacy_version_accepted: "1.0.0",
    privacy_accepted_at: new Date(),
    push_notifications_consent: push_notifications_consent || false,
    push_notifications_consent_at: push_notifications_consent ? new Date() : null,
    isActive: true,                   // ✅ Account active
    isBlacklisted: false,             // ✅ NOT blocked (immediate access)
    activeChatbot: true,              // ✅ Chatbot ENABLED (can receive LLM responses)
  },
})
```

### Aggiornare Commenti

**BEFORE**:
```typescript
// 🚨 NEW USERS ARE BLOCKED until admin approval!
// 🚨 CHATBOT DISABLED after registration (admin must enable)
```

**AFTER**:
```typescript
// ✅ NEW USERS ARE ACTIVE immediately (no admin approval needed)
// ✅ CHATBOT ENABLED for instant LLM responses
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Utente che completa registrazione ha `isBlacklisted=false`
- [ ] Utente che completa registrazione ha `activeChatbot=true`
- [ ] Utente può scrivere messaggi WhatsApp immediatamente
- [ ] Utente riceve risposte LLM dal chatbot
- [ ] Utente può usare function protette (cart, orders)

### Tecnici
- [ ] Modifica in `UPDATE` caso (existing customer) - linea ~212
- [ ] Modifica in `CREATE` caso (new customer) - linea ~237
- [ ] Commenti aggiornati per riflettere nuovo comportamento
- [ ] No altri campi modificati (solo `isBlacklisted` e `activeChatbot`)
- [ ] No errori TypeScript: `npm run build`

### Test
- [ ] Test registrazione verifica `isBlacklisted=false` nel result
- [ ] Test registrazione verifica `activeChatbot=true` nel result
- [ ] Tutti i test passano: `npm run test`

---

## 🔗 File Correlati

- `apps/backend/src/interfaces/http/controllers/registration.controller.ts` - File principale
- Task 08: Creare test `registration-post-flow.spec.ts`

---

## 📋 Checklist Implementazione

- [ ] Aprire `apps/backend/src/interfaces/http/controllers/registration.controller.ts`
- [ ] Trovare metodo `register()` (circa linea 124)
- [ ] Trovare blocco UPDATE existing customer (circa linea 195)
- [ ] Cambiare `isBlacklisted: true` → `isBlacklisted: false` (linea ~212)
- [ ] Cambiare `activeChatbot: false` → `activeChatbot: true` (linea ~212)
- [ ] Trovare blocco CREATE new customer (circa linea 220)
- [ ] Cambiare `isBlacklisted: true` → `isBlacklisted: false` (linea ~237)
- [ ] Cambiare `activeChatbot: false` → `activeChatbot: true` (linea ~237)
- [ ] Aggiornare commenti (linee ~211, 236) da "BLOCKED" a "ACTIVE"
- [ ] Verificare nessun altro punto nel file crea customer con isBlacklisted=true
- [ ] Compilare: `npm run build` - verificare 0 errori
- [ ] Testare: `npm run test` - verificare 0 test falliti

---

**Dependencies**: Nessuna (può essere eseguito in parallelo)  
**Blocks**: Task 08 (test post-registration)  
**Last Updated**: 2026-01-03
