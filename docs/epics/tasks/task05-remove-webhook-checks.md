# Task 04: Rimuovere Check Webhook (RegistrationAttempts + Limite 5 Msg)

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 1.5h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Rimuovere dal webhook controller (`whatsapp-webhook.controller.ts`) due blocchi di codice:
1. **Check RegistrationAttempts** (linee 317-377): Verificava se utente bloccato dopo 3 tentativi
2. **Limite 5 Messaggi per Non Registrati** (linee 804-838): Bloccava utenti non registrati dopo 5 messaggi in 24h

---

## 🎯 Obiettivo

Permettere a TUTTI gli utenti di scrivere messaggi WhatsApp senza limiti preventivi. Il rate limiting generale (15 msg/min customer) rimane come protezione anti-spam.

---

## 💻 File da Modificare

**Path**: `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`

### 1. Rimuovere Check RegistrationAttempts (linee 317-377)

**BEFORE** (da rimuovere):
```typescript
// 🔒 STEP 1: Check/update RegistrationAttempts (with transaction for concurrency safety)
const registrationAttempt = await prisma.$transaction(async (tx) => {
  // Find or create RegistrationAttempts record
  let attempt = await tx.registrationAttempts.findUnique({
    where: {
      phoneNumber_workspaceId: {
        phoneNumber: phoneNumber,
        workspaceId: workspaceId,
      },
    },
  })

  if (!attempt) {
    // First message - create record with attemptCount=1
    attempt = await tx.registrationAttempts.create({
      data: {
        phoneNumber: phoneNumber,
        workspaceId: workspaceId,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        isBlocked: false,
      },
    })
    logger.info("[WEBHOOK] 📝 Created RegistrationAttempts record", {
      phoneNumber,
      attemptCount: 1,
    })
  } else {
    // Subsequent message - increment attemptCount
    attempt = await tx.registrationAttempts.update({
      where: {
        phoneNumber_workspaceId: {
          phoneNumber: phoneNumber,
          workspaceId: workspaceId,
        },
      },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        // Set isBlocked=true when attemptCount reaches 4 (after 3 welcome messages)
        isBlocked: attempt.attemptCount + 1 >= 4,
      },
    })
    logger.info(
      "[WEBHOOK] 🔄 Updated RegistrationAttempts record",
      {
        phoneNumber,
        attemptCount: attempt.attemptCount,
        isBlocked: attempt.isBlocked,
      }
    )
  }

  return attempt
})

// 🚫 STEP 2: Check if user is blocked (attemptCount >= 4)
if (registrationAttempt.isBlocked) {
  logger.warn(
    "[WEBHOOK] 🚫 User blocked after 3 registration attempts",
    {
      phoneNumber,
      attemptCount: registrationAttempt.attemptCount,
    }
  )
  return res.status(200).json({
    status: "blocked",
    message: "User blocked after too many registration attempts",
  })
}
```

**AFTER** (eliminato completamente):
```typescript
// ❌ REMOVED: RegistrationAttempts check (STEP 1 & 2)
// New approach: no preventive blocking - chat works for everyone
```

### 2. Rimuovere Limite 5 Messaggi per Non Registrati (linee 804-838)

**BEFORE** (da rimuovere):
```typescript
// 🚦 UNREGISTERED USER LIMIT: Max 5 messages for users not yet registered
// Feature: Block spam from unregistered users who refuse to register
const MAX_UNREGISTERED_MESSAGES = 5
if (customer && !customer.isActive) {
  // Count messages from this unregistered customer in last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const unregisteredMessageCount = await prisma.conversationMessage.count({
    where: {
      customerId: customer.id,
      role: "user", // Only count inbound messages
      createdAt: { gte: twentyFourHoursAgo },
    },
  })

  if (unregisteredMessageCount >= MAX_UNREGISTERED_MESSAGES) {
    logger.warn("[WEBHOOK] 🚫 Unregistered user exceeded message limit", {
      customerId: customer.id,
      messageCount: unregisteredMessageCount,
      limit: MAX_UNREGISTERED_MESSAGES,
    })

    // Get registration link from workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: customer.workspaceId },
      select: { welcomeMessage: true },
    })
    const registrationLink = (workspace?.welcomeMessage as any)?.registrationLink || 
      `${process.env.FRONTEND_URL}/registration`

    res.status(403).json({
      status: "registration_required",
      code: "UNREGISTERED_LIMIT_EXCEEDED",
      message: `Hai raggiunto il limite di ${MAX_UNREGISTERED_MESSAGES} messaggi. Per continuare, registrati qui: ${registrationLink}`,
      registrationLink,
    })
    return
  }
}
```

**AFTER** (eliminato completamente):
```typescript
// ❌ REMOVED: Unregistered user 5-message limit
// New approach: users can chat freely - registration required only for cart/orders/profile
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Utenti non registrati possono inviare messaggi illimitati (no blocco dopo 5)
- [ ] Nessun utente viene bloccato per "troppi tentativi di registrazione"
- [ ] Rate limiting generale (15 msg/min) continua a funzionare
- [ ] Welcome message viene inviato al primo messaggio (ChatEngine check rimane)

### Tecnici
- [ ] Blocco codice RegistrationAttempts (linee 317-377) eliminato
- [ ] Blocco codice limite 5 messaggi (linee 804-838) eliminato
- [ ] Nessun import di `RegistrationAttempts` nel file
- [ ] Nessuna query a `prisma.registrationAttempts` nel file
- [ ] No errori TypeScript: `npm run build`

### Test
- [ ] Webhook accetta messaggi da utenti non registrati senza limiti
- [ ] Nessun 403 "registration_required" response
- [ ] Nessun 200 "blocked" response per RegistrationAttempts
- [ ] Tutti i test passano: `npm run test`

---

## 🔗 File Correlati

- `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts` - File principale
- Task 03: Rimuovere service/model (deve essere fatto PRIMA o insieme)
- Task 07: Aggiornare test (rimuovere test dedicati)

---

## 📋 Checklist Implementazione

- [ ] Backup file: `cp whatsapp-webhook.controller.ts whatsapp-webhook.controller.ts.bak`
- [ ] Aprire file `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`
- [ ] Trovare blocco STEP 1 (linee ~317-352): Check/update RegistrationAttempts
- [ ] Trovare blocco STEP 2 (linee ~354-377): Check if user is blocked
- [ ] Eliminare ENTRAMBI i blocchi STEP 1 e STEP 2
- [ ] Aggiungere commento: `// ❌ REMOVED: RegistrationAttempts check (new approach)`
- [ ] Trovare blocco "UNREGISTERED USER LIMIT" (linee ~804-838)
- [ ] Eliminare blocco completo (incluso const MAX_UNREGISTERED_MESSAGES)
- [ ] Aggiungere commento: `// ❌ REMOVED: Unregistered user 5-message limit`
- [ ] Verificare nessun import `RegistrationAttempts` rimasto nel file
- [ ] Compilare: `npm run build` - verificare 0 errori
- [ ] Testare: `npm run test` - verificare 0 test falliti
- [ ] Grep: `grep -n "RegistrationAttempts" whatsapp-webhook.controller.ts` → deve essere vuoto

---

**Dependencies**: Task 03 (rimuovere service/model) - preferibilmente prima  
**Blocks**: Task 07 (test), Task 09 (docs)  
**Last Updated**: 2026-01-03
