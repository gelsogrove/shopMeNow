# Task 03: Rimuovere RegistrationAttempts Service & Model

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 1h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Rimuovere completamente il service `RegistrationAttemptsService` e il model `RegistrationAttempts` dal database schema. Questo include l'eliminazione del file service, la rimozione del model da Prisma schema, e la pulizia di tutti gli import correlati.

---

## 🎯 Obiettivo

Pulire il codebase eliminando il meccanismo obsoleto di blocco basato su tentativi di registrazione falliti. Il nuovo approccio non usa questo sistema.

---

## 💻 File da Rimuovere/Modificare

### 1. Eliminare Service
**Path**: `apps/backend/src/application/services/registration-attempts.service.ts`

```bash
# File da ELIMINARE completamente (231 righe)
rm apps/backend/src/application/services/registration-attempts.service.ts
```

Contiene:
- `RegistrationAttemptsService` class
- Metodi: `recordAttempt()`, `isBlocked()`, `clearAttempts()`, `blockCustomer()`
- `MAX_ATTEMPTS = 5` logic
- `ATTEMPT_WINDOW_HOURS = 24` logic

### 2. Rimuovere Model da Prisma Schema
**Path**: `packages/database/prisma/schema.prisma`

```prisma
// ❌ RIMUOVERE COMPLETAMENTE (linee 1011-1023)
model RegistrationAttempts {
  id            String   @id @default(cuid())
  phoneNumber   String
  workspaceId   String
  attemptCount  Int      @default(0)
  lastAttemptAt DateTime @default(now())
  isBlocked     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([phoneNumber, workspaceId])
  @@map("registration_attempts")
}
```

### 3. Rimuovere Import in Routes
**Path**: `apps/backend/src/routes/index.ts`

```typescript
// ❌ RIMUOVERE
import { RegistrationAttemptsService } from "../application/services/registration-attempts.service"
```

### 4. Rimuovere Rotte in Customers Routes
**Path**: `apps/backend/src/interfaces/http/routes/customers.routes.ts`

```typescript
// ❌ RIMUOVERE queste rotte (circa linee 80 e 149)
router.delete(
  "/:workspaceId/registration-attempts/:attemptId",
  authMiddleware,
  workspaceValidationMiddleware,
  asyncMiddleware(customersController.deleteRegistrationAttempt.bind(customersController))
)
```

### 5. Rimuovere Metodi in Customers Controller
**Path**: `apps/backend/src/interfaces/http/controllers/customers.controller.ts`

```typescript
// ❌ RIMUOVERE metodo deleteRegistrationAttempt (circa linea 483)
async deleteRegistrationAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const { attemptId } = req.params
    const workspaceId = (req as any).workspaceId

    const attempt = await prisma.registrationAttempts.findFirst({
      where: {
        id: attemptId,
        workspaceId: workspaceId,
      },
    })

    if (!attempt) {
      return res.status(404).json({ error: "Registration attempt not found" })
    }

    await prisma.registrationAttempts.delete({
      where: { id: attemptId },
    })

    res.json({ message: "Registration attempt deleted successfully" })
  } catch (error) {
    next(error)
  }
}
```

### 6. Rimuovere da Customer Service
**Path**: `apps/backend/src/application/services/customer.service.ts`

```typescript
// ❌ RIMUOVERE import dinamico e chiamata (circa linea 259-262)
const { RegistrationAttemptsService } = await import("./registration-attempts.service")
const registrationAttemptsService = new RegistrationAttemptsService(prisma)
await registrationAttemptsService.clearAttempts(customer.phone, workspaceId)
```

### 7. Rimuovere da Trash Controller
**Path**: `apps/backend/src/interfaces/http/controllers/trash.controller.ts`

```typescript
// ❌ RIMUOVERE deleteMany registrationAttempts (circa linea 590 e 695)
await tx.registrationAttempts.deleteMany({ where: { workspaceId: wsId } })
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Nessun codice nel progetto fa riferimento a `RegistrationAttempts`
- [ ] Nessuna rotta API espone endpoint `/registration-attempts`
- [ ] Nessun service importa `RegistrationAttemptsService`

### Tecnici
- [ ] File `registration-attempts.service.ts` eliminato
- [ ] Model `RegistrationAttempts` rimosso da `schema.prisma`
- [ ] Import rimossi da `routes/index.ts`
- [ ] Rotte rimosse da `customers.routes.ts`
- [ ] Metodi rimossi da `customers.controller.ts`
- [ ] Chiamate rimosse da `customer.service.ts`
- [ ] DeleteMany rimosso da `trash.controller.ts`
- [ ] No errori TypeScript: `npm run build`
- [ ] Prisma generate funziona: `npx prisma generate`

### Test
- [ ] Grep search per "RegistrationAttempts" ritorna 0 match nel codice
- [ ] Grep search per "registration-attempts" ritorna 0 match nel codice
- [ ] Tutti i test passano: `npm run test`

---

## 🔗 File Correlati

- Task 04: Rimuovere check nel webhook (dipende da questo)
- Task 06: Migration database (rimuove tabella fisica)
- Task 07: Aggiornare test (rimuove mock)

---

## 📋 Checklist Implementazione

- [ ] Backup file prima di eliminare: `cp registration-attempts.service.ts registration-attempts.service.ts.bak`
- [ ] Eliminare `apps/backend/src/application/services/registration-attempts.service.ts`
- [ ] Rimuovere model da `packages/database/prisma/schema.prisma` (linee 1011-1023)
- [ ] Rimuovere import da `apps/backend/src/routes/index.ts`
- [ ] Rimuovere rotte da `apps/backend/src/interfaces/http/routes/customers.routes.ts`
- [ ] Rimuovere metodo `deleteRegistrationAttempt` da `customers.controller.ts`
- [ ] Rimuovere import e chiamata da `customer.service.ts` (linee 259-262)
- [ ] Rimuovere deleteMany da `trash.controller.ts` (linee 590, 695)
- [ ] Grep finale: `grep -r "RegistrationAttempts" apps/backend/src` → deve essere vuoto
- [ ] Grep finale: `grep -r "registration-attempts" apps/backend/src` → deve essere vuoto
- [ ] Compilare: `npm run build` - verificare 0 errori
- [ ] Generate Prisma: `cd packages/database && npx prisma generate`
- [ ] Testare: `npm run test` - verificare 0 test falliti

---

**Dependencies**: Nessuna (può essere eseguito in parallelo con Task 01-02)  
**Blocks**: Task 04 (webhook), Task 06 (migration), Task 07 (test)  
**Last Updated**: 2026-01-03
