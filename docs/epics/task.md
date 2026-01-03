# Epic: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione

**Status**: 🚧 In Progress  
**Priority**: 🔴 HIGH  
**Start Date**: 2026-01-03  
**Owner**: Andrea Gelso

---

## 📋 Overview

Questo epic rimuove completamente il meccanismo di blocco basato su `RegistrationAttempts` (che bloccava utenti dopo 3 tentativi di registrazione falliti) e implementa un nuovo approccio:

**PRIMA** ⛔:
- Utenti bloccati dopo 3 tentativi di registrazione
- Limite di 5 messaggi in 24h per utenti non registrati
- Dopo registrazione: `isBlacklisted=true`, `activeChatbot=false` (serviva approvazione admin)

**DOPO** ✅:
- **Chat funziona SEMPRE** per tutti (nessun blocco preventivo)
- **Link registrazione appare SOLO** quando utente chiede operazioni personalizzate (carrello, ordini, fatture, profilo)
- Dopo registrazione: `isBlacklisted=false`, `activeChatbot=true` (utente attivo subito)

---

## 🎯 Obiettivi Principali

### 1. **Filosofia "Open Chat"**
Gli utenti devono poter **chiedere informazioni liberamente** senza registrazione. Il sistema invita a registrarsi SOLO quando necessario per operazioni personalizzate.

### 2. **Function-Level Protection**
10 function richiedono registrazione (`isActive=true`):
- **CART**: `addToCart`, `viewCart`, `clearCart`
- **ORDERS**: `getLinkOrderByCode`, `repeatOrder`, `getOrderDetails`, `confirmOrder`, `showCheckout`
- **PROFILE**: `handlePushNotifications`, `getProfileLink`

### 3. **LLM-Driven Messaging**
L'LLM decide la frase di invito alla registrazione, il sistema fornisce il token `[LINK_REGISTRATION_WITH_TOKEN]` che viene sostituito con link sicuro.

### 4. **Immediate Activation**
Dopo registrazione, l'utente è subito operativo (no approvazione admin).

---

## 🏗️ Architettura - Modifiche a 360°

### **Backend**
```
apps/backend/src/
├── services/
│   ├── function-executor.service.ts       ✏️ GUARD registrazione
│   ├── llm.service.ts                     ✏️ Token replacement
│   └── registration-attempts.service.ts   ❌ ELIMINA
├── interfaces/http/
│   ├── controllers/
│   │   ├── whatsapp-webhook.controller.ts ✏️ Rimuovi check
│   │   ├── registration.controller.ts     ✏️ Cambia defaults
│   │   ├── customers.controller.ts        ✏️ Rimuovi metodi
│   │   └── trash.controller.ts            ✏️ Rimuovi deleteMany
│   └── routes/
│       └── customers.routes.ts            ✏️ Rimuovi rotte
└── config/
    └── agent-functions.config.ts          ℹ️ Reference

packages/database/prisma/
├── schema.prisma                          ❌ Rimuovi model
└── migrations/
    └── YYYYMMDDHHMMSS_remove_registration_attempts/ ➕ CREA
```

### **Frontend**
Nessuna modifica necessaria (comportamento trasparente).

### **Chat Engine**
Il guard nel `FunctionExecutorService` intercetta PRIMA dell'esecuzione.

### **Test**
```
apps/backend/__tests__/
├── unit/
│   ├── services/
│   │   └── function-executor-registration-guard.spec.ts  ➕ NUOVO
│   └── controllers/
│       ├── registration-post-flow.spec.ts                ➕ NUOVO
│       ├── whatsapp-registration-attempts.spec.ts        ❌ ELIMINA
│       ├── whatsapp-webhook-plan-limit.spec.ts           ✏️ Rimuovi mock
│       └── trash.controller.spec.ts                      ✏️ Rimuovi mock
└── integration/                                          ✏️ Aggiorna
```

### **Docs**
```
docs/architecture/
├── blocking.md                            ✏️ Rimuovi sezione 7
├── welcome-message-edge-cases.md          ✏️ Rimuovi case #1,6,7
└── registration-flow.md                   ➕ NUOVO (flusso aggiornato)
```

---

## 📦 Tasks Breakdown

### Documentation (FIRST!)
1. **[Task 01](tasks/task01-update-documentation.md)** - Aggiornare Documentazione (blocking.md, edge-cases.md, registration-flow.md)

### Backend Implementation
2. **[Task 02](tasks/task02-function-executor-guard.md)** - Implementare Registration Guard nel FunctionExecutorService
3. **[Task 03](tasks/task03-link-token-replacement.md)** - Completare Token `[LINK_REGISTRATION_WITH_TOKEN]`
4. **[Task 04](tasks/task04-remove-registration-attempts.md)** - Rimuovere RegistrationAttempts Service & Model
5. **[Task 05](tasks/task05-remove-webhook-checks.md)** - Rimuovere Check Webhook (RegistrationAttempts + Limite 5 Msg)
6. **[Task 06](tasks/task06-post-registration-behavior.md)** - Modificare Comportamento Post-Registrazione

### Database
7. **[Task 07](tasks/task07-database-migration.md)** - Creare Migration Database

### Testing
8. **[Task 08](tasks/task08-update-existing-tests.md)** - Aggiornare Test Esistenti
9. **[Task 09](tasks/task09-create-new-tests.md)** - Creare Nuovi Test
9. **[Task 09](tasks/task09-update-documentation.md)** - Aggiornare Documentazione

---

## ✅ Acceptance Criteria (Epic-Level)

### Funzionali
- [ ] Utenti non registrati possono scrivere messaggi senza limiti
- [ ] Utenti non registrati ricevono welcome message al primo contatto
- [ ] Quando utente non registrato chiama function protetta → riceve link registrazione
- [ ] Link registrazione è sicuro (token JWT, validità 24h)
- [ ] Dopo registrazione utente è attivo (`isBlacklisted=false`, `activeChatbot=true`)
- [ ] Rate limiting generale (15 msg/min) funziona come protezione anti-spam

### Tecnici
- [ ] Nessuna traccia di `RegistrationAttempts` nel codice
- [ ] Nessuna tabella `registration_attempts` nel database
- [ ] Tutti i test passano: `npm run test`
- [ ] Build completa funziona: `npm run build`
- [ ] Nessun errore TypeScript
- [ ] Coverage test mantenuta o aumentata

### Documentazione
- [ ] Architettura aggiornata (blocking.md)
- [ ] Edge cases aggiornati (welcome-message-edge-cases.md)
- [ ] Nuovo flusso documentato (registration-flow.md)
- [ ] README aggiornato se necessario

---

## 🚨 Rischi & Mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Spam da bot non registrati | 🟠 MEDIO | Rate limiting (15 msg/min customer, 100 msg/min workspace) |
| Performance: query count messaggi | 🟡 BASSO | Indice su (customerId, workspaceId, role, createdAt) |
| Utenti esistenti in stato inconsistente | 🟠 MEDIO | Script cleanup post-migration |
| Test falliscono dopo rimozione | 🔴 ALTO | Aggiornare mock prima di rimuovere codice |

---

## 📊 Metriche di Successo

**Pre-Deploy**:
- ✅ Code coverage: >80% sui nuovi guard
- ✅ 0 errori TypeScript
- ✅ 0 test falliti

**Post-Deploy**:
- 📈 Registrazioni completate: +XX% (più utenti completano registrazione quando richiesto)
- 📉 Utenti bloccati: 0 (nessun blocco preventivo)
- 📈 Messaggi da non registrati: monitora trend (no limite)

---

## 🔗 References

- **Constitution**: `.specify/memory/constitution.md` - Principle XV (User Context Freedom)
- **PRD**: `docs/PRD.md` - E-commerce features
- **Agent Functions**: `apps/backend/src/config/agent-functions.config.ts`
- **WhatsApp Flow**: `docs/architecture/blocking.md`

---

## 📝 Notes

- **NO WhatsApp test durante sviluppo**: Verificare solo tramite unit/integration test
- **Backwards compatibility**: Seed script deve rimuovere dati RegistrationAttempts esistenti
- **Heroku deploy**: Run migration PRIMA del restart

---

**Last Updated**: 2026-01-03  
**Next Review**: After Task 09 completion
