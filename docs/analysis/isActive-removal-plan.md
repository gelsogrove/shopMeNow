# 🔍 ANALISI COMPLETA 360° - Rimozione `isActive` e Unificazione su `channelStatus`

**Data**: 2026-01-14  
**Richiesta**: Andrea vuole usare SOLO `channelStatus` + `debugMode`, eliminare `isActive`  
**Scope**: Backend, Frontend, Backoffice, Scheduler, Tests, Database

---

## 📊 SITUAZIONE ATTUALE

### **Campi nel Database (Workspace model)**

```prisma
isActive      Boolean   @default(true)   // ❌ DA RIMUOVERE
deletedAt     DateTime?                  // ✅ MANTENERE (soft-delete)
isDelete      Boolean   @default(false)  // ❌ RIDONDANTE (già coperto da deletedAt)
channelStatus Boolean   @default(false)  // ✅ USARE QUESTO
debugMode     Boolean   @default(true)   // ✅ MANTENERE
```

### **Significato Attuale**

| Campo | Significato | Usato Da | Problema |
|-------|-------------|----------|----------|
| `isActive` | Workspace attivo globalmente | Widget, Messages, Security | ❌ RIDONDANTE con `deletedAt` |
| `isDelete` | Flag soft-delete | Entity methods | ❌ RIDONDANTE con `deletedAt` |
| `deletedAt` | Timestamp soft-delete (Prisma standard) | Trash system, Filters | ✅ STANDARD PRISMA |
| `channelStatus` | Chatbot ON/OFF (queue processing) | WhatsApp Queue | ✅ UNICO NECESSARIO |
| `debugMode` | Modalità debug (no addebiti) | Billing, Queue | ✅ UTILE |

---

## 🎯 LOGICA SOFT-DELETE ATTUALE

### **buildTrashFilter() - SOLO deletedAt**

```typescript
// ✅ GIÀ CORRETTO - usa deletedAt
export function buildTrashFilter(): any {
  return {
    deletedAt: { not: null }
  }
}

export function buildSoftDeleteFilter(): any {
  return {
    deletedAt: null
  }
}
```

**NESSUN CAMBIO NECESSARIO** - La logica trash usa correttamente `deletedAt`, NON `isActive`!

---

## 🔍 CHI USA `isActive` NEL BACKEND

### **1. Widget Chat Controller** ❌ DA SOSTITUIRE

**File**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts:142`

```typescript
if (!workspace.isActive) {
  return res.status(503).json({
    error: "SERVICE_UNAVAILABLE",
    message: "Chat service is temporarily unavailable"
  })
}
```

**SOLUZIONE**:
```typescript
if (workspace.deletedAt !== null) { // Workspace cancellato
  return res.status(503).json({
    error: "SERVICE_UNAVAILABLE",
    message: "Chat service is temporarily unavailable"
  })
}
// channelStatus controlla se bot risponde o blocca (no WIP)
```

---

### **2. Workspace Access Service** ❌ DA SOSTITUIRE

**File**: `apps/backend/src/application/services/workspace-access.service.ts:106`

```typescript
if (!workspace.isActive || workspace.deletedAt) {
  return {
    canProcess: false,
    blockReason: "WORKSPACE_INACTIVE",
    message: "Workspace is not active"
  }
}
```

**SOLUZIONE**:
```typescript
if (workspace.deletedAt !== null) { // Basta controllare deletedAt
  return {
    canProcess: false,
    blockReason: "WORKSPACE_DELETED",
    message: "Workspace has been deleted"
  }
}
```

---

### **3. Security Check Service** ❌ DA SOSTITUIRE

**File**: `apps/backend/src/application/services/security-check.service.ts:220`

```typescript
if (!workspace.isActive) {
  return {
    passed: false,
    reason: "Workspace is inactive",
    retryAfter: 3600 * 1000
  }
}
```

**SOLUZIONE**:
```typescript
if (workspace.deletedAt !== null) {
  return {
    passed: false,
    reason: "Workspace has been deleted",
    retryAfter: null // Non ha senso retry se cancellato
  }
}
```

---

### **4. Message Repository** ❌ DA SOSTITUIRE

**File**: `apps/backend/src/repositories/message.repository.ts:740`

```typescript
if (!workspace.isActive) {
  logger.warn(`Workspace ${workspaceId} is inactive`)
  throw new Error(`Workspace ${workspaceId} is not active`)
}
```

**SOLUZIONE**:
```typescript
if (workspace.deletedAt !== null) {
  logger.warn(`Workspace ${workspaceId} has been deleted`)
  throw new Error(`Workspace ${workspaceId} has been deleted`)
}
```

---

### **5. Platform Config Controller** ❌ DA SOSTITUIRE

**File**: `apps/backend/src/interfaces/http/controllers/platform-config.controller.ts:246,306`

```typescript
if (!workspace || !workspace.isActive) {
  // Blocca configurazioni
}
```

**SOLUZIONE**:
```typescript
if (!workspace || workspace.deletedAt !== null) {
  // Blocca configurazioni se workspace cancellato
}
```

---

### **6. Workspace Validation Middleware** ⚠️ SOLO LOGGING

**File**: `apps/backend/src/interfaces/http/middlewares/workspace-validation.middleware.ts:178`

```typescript
if (!workspace.isActive) {
  logger.warn(`Workspace ${workspaceId} is DISABLED - Admin access allowed, WhatsApp blocked`)
}
```

**SOLUZIONE**: Rimuovere completamente - usa solo `deletedAt`

---

### **7. Domain Entity Methods** ❌ DA RIMUOVERE

**File**: `apps/backend/src/domain/entities/workspace.entity.ts:276,280`

```typescript
get isActive(): boolean {
  return this.props.isActive
}

deactivate(): void {
  this.props.isActive = false
  this.props.updatedAt = new Date()
}

softDelete(): void {
  this.props.isDelete = true
  this.props.isActive = false // ❌ RIDONDANTE
  this.props.updatedAt = new Date()
}
```

**SOLUZIONE**:
```typescript
// Rimuovere isActive getter e setter completamente

softDelete(): void {
  this.props.deletedAt = new Date() // ✅ Solo questo
  this.props.updatedAt = new Date()
}

// isDelete non serve più - usa deletedAt !== null
```

---

## 🖥️ FRONTEND - CHI USA `isActive`

### **WorkspaceSelectionPage.tsx** ❌ DA SOSTITUIRE

**Righe**: 680, 1044, 1057, 1069, 1121

```typescript
// Toggle activation
isActive: !workspace.isActive, // ❌ NON SERVE PIÙ

// Card background verde/grigio
workspace.isActive ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gray-100"

// WhatsApp number color
workspace.isActive ? "text-green-600" : "text-gray-400"
```

**SOLUZIONE**:
```typescript
// Card background basato su channelStatus (bot ON/OFF)
workspace.channelStatus ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gray-100"

// WhatsApp number basato su channelStatus
workspace.channelStatus ? "text-green-600" : "text-gray-400"

// NON SERVE toggle activation - channelStatus lo gestisce Settings
```

---

## 🎨 BACKOFFICE - CHI USA `isActive`

### **SchedulersPage.tsx** ✅ OK - Job Scheduler

**Righe**: 184, 189, 308, 314, 372, 375, 376

```typescript
// ✅ OK - isActive per scheduler jobs (NON workspace)
job.isActive // Toggle job ON/OFF
```

**NESSUN CAMBIO** - Questo `isActive` è per scheduler jobs, NON workspace!

---

## 📋 PIANO DI MIGRAZIONE STEP-BY-STEP

### **FASE 1: ANALISI COMPLETATA** ✅

- [x] Mappati tutti i punti che usano `isActive`
- [x] Verificata logica soft-delete (usa già `deletedAt`)
- [x] Confermato che `isDelete` è ridondante

---

### **FASE 2: BACKEND CHANGES** 🔄

#### **Step 2.1: Aggiornare Entity**

**File**: `apps/backend/src/domain/entities/workspace.entity.ts`

```typescript
// RIMUOVERE:
- isActive: boolean
- get isActive()
- activate()
- deactivate()
- isDelete: boolean (usare deletedAt !== null invece)

// MANTENERE:
- channelStatus: boolean
- debugMode: boolean
- deletedAt: DateTime?

// MODIFICARE:
softDelete(): void {
  this.props.deletedAt = new Date()
  this.props.updatedAt = new Date()
}

restore(): void {
  this.props.deletedAt = null
  this.props.updatedAt = new Date()
}
```

---

#### **Step 2.2: Sostituire Tutti i Check**

**Pattern di sostituzione**:

```typescript
// ❌ VECCHIO
if (!workspace.isActive) { ... }

// ✅ NUOVO
if (workspace.deletedAt !== null) { ... }
```

**File da modificare**:
1. `widget-chat.controller.ts:142`
2. `workspace-access.service.ts:106`
3. `security-check.service.ts:220`
4. `message.repository.ts:740`
5. `platform-config.controller.ts:246,306`
6. `workspace-validation.middleware.ts:178` (rimuovere log)

---

#### **Step 2.3: Repository & Controllers**

**File**: `workspace.repository.ts`, `workspace.controller.ts`

```typescript
// RIMUOVERE dai SELECT:
- isActive: true

// RIMUOVERE dalle serializzazioni:
- isActive: workspace.isActive

// Controllers DEVONO serializzare:
- channelStatus: workspace.channelStatus ✅
- debugMode: workspace.debugMode ✅
- deletedAt: workspace.deletedAt ✅ (per sapere se in trash)
```

---

### **FASE 3: FRONTEND CHANGES** 🔄

#### **Step 3.1: WorkspaceSelectionPage.tsx**

```typescript
// SOSTITUIRE:
workspace.isActive 
// CON:
workspace.channelStatus

// RIMUOVERE:
Toggle activation button (riga 680) - non serve più

// LOGICA VISUAL:
- Card verde = channelStatus: true (bot attivo)
- Card grigia = channelStatus: false (bot OFF / blocked)
- Badge "Disabled" = channelStatus: false (già corretto)
```

---

#### **Step 3.2: TypeScript Interfaces**

**File**: `frontend/src/services/workspaceApi.ts`

```typescript
export interface Workspace {
  // RIMUOVERE:
  isActive: boolean

  // MANTENERE:
  channelStatus?: boolean ✅
  debugMode?: boolean ✅
  deletedAt?: string | null ✅ // Per sapere se in trash
}
```

---

### **FASE 4: DATABASE MIGRATION** 🔄

#### **Step 4.1: Prisma Migration**

```typescript
// packages/database/prisma/schema.prisma

model Workspace {
  // RIMUOVERE:
  // isActive Boolean @default(true)
  // isDelete Boolean @default(false)

  // MANTENERE:
  channelStatus Boolean @default(false)
  debugMode     Boolean @default(true)
  deletedAt     DateTime?
}
```

**Comando**:
```bash
cd packages/database
npx prisma migrate dev --name remove-isActive-isDelete
```

---

#### **Step 4.2: Data Migration Script**

**File**: `packages/database/prisma/migrations/XXXXXX_remove-isActive-isDelete/data-migration.sql`

```sql
-- Nessuna data migration necessaria:
-- deletedAt è già popolato correttamente
-- channelStatus è indipendente da isActive
-- isDelete non serve più
```

---

### **FASE 5: TESTS** 🧪

#### **Step 5.1: Unit Tests**

```bash
# File da aggiornare:
- workspace.entity.spec.ts (rimuovere test activate/deactivate)
- workspace-access.service.spec.ts (usare deletedAt invece isActive)
- security-check.service.spec.ts (usare deletedAt)
```

---

#### **Step 5.2: Integration Tests**

```bash
# Verificare:
- Soft-delete workspace → deletedAt popolato
- Restore workspace → deletedAt = null
- Widget chat blocca se deletedAt !== null
- WhatsApp queue usa channelStatus
```

---

### **FASE 6: BACKOFFICE** ✅

**NESSUN CAMBIO NECESSARIO** - Backoffice già usa `channelStatus` correttamente dopo fix precedente!

---

## 🚨 PUNTI CRITICI DA VERIFICARE

### **1. Quando si Cancella un Utente (User)**

**File**: `apps/backend/src/interfaces/http/controllers/trash.controller.ts`

```typescript
// Soft-delete utente:
await tx.user.update({
  where: { id: userId },
  data: { deletedAt: new Date() } // ✅ USA deletedAt
})

// ❌ NON usa isActive - CORRETTO!
```

**NESSUN PROBLEMA** - Già usa `deletedAt`

---

### **2. Quando si Cancella un Canale (Workspace)**

**File**: Workspace entity `softDelete()`

```typescript
// PRIMA:
softDelete(): void {
  this.props.isDelete = true      // ❌ RIDONDANTE
  this.props.isActive = false     // ❌ RIDONDANTE
  this.props.updatedAt = new Date()
}

// DOPO:
softDelete(): void {
  this.props.deletedAt = new Date() // ✅ UNICO NECESSARIO
  this.props.updatedAt = new Date()
}
```

---

### **3. Cosa Mette in Trash**

**File**: `apps/backend/src/utils/soft-delete.helper.ts`

```typescript
export function buildTrashFilter(): any {
  return {
    deletedAt: { not: null } // ✅ USA deletedAt
  }
}
```

**NESSUN PROBLEMA** - Già corretto!

---

### **4. Filtri per Trash**

**File**: `trash.controller.ts`

```typescript
// Lista workspace in trash:
const workspaces = await prisma.workspace.findMany({
  where: {
    ...buildTrashFilter(), // deletedAt !== null
    // ❌ NON usa isActive: false
  }
})
```

**NESSUN PROBLEMA** - Già usa solo `deletedAt`!

---

### **5. Approvazione/Restore**

**File**: `trash.controller.ts` - `restoreItem()`

```typescript
// Restore workspace:
await tx.workspace.update({
  where: { id },
  data: { 
    deletedAt: null, // ✅ CORRETTO
    // ❌ NON serve isActive: true
  }
})
```

**POSSIBILE PROBLEMA** - Verificare se dopo restore `channelStatus` torna ON o rimane OFF

---

## ✅ CHECKLIST FINALE

### **Database**
- [ ] Rimuovere `isActive` da schema Prisma
- [ ] Rimuovere `isDelete` da schema Prisma
- [ ] Creare migration `remove-isActive-isDelete`
- [ ] Run migration su dev/staging/production
- [ ] Verificare seed funziona senza `isActive`

### **Backend**
- [ ] Rimuovere `isActive` da Entity interface
- [ ] Rimuovere metodi `activate()`, `deactivate()`
- [ ] Modificare `softDelete()` per usare solo `deletedAt`
- [ ] Sostituire check `!workspace.isActive` con `workspace.deletedAt !== null` (6 file)
- [ ] Rimuovere `isActive` da tutti i SELECT Prisma
- [ ] Rimuovere `isActive` da tutti i serializer/controller
- [ ] Aggiornare Swagger docs

### **Frontend**
- [ ] Rimuovere `isActive` da Workspace interface
- [ ] Sostituire `workspace.isActive` con `workspace.channelStatus` (WorkspaceSelectionPage)
- [ ] Rimuovere toggle activation button
- [ ] Testare visual verde/grigio basato su `channelStatus`

### **Backoffice**
- [ ] ✅ Già usa `channelStatus` - NESSUN CAMBIO

### **Tests**
- [ ] Aggiornare unit tests Entity
- [ ] Aggiornare integration tests
- [ ] Aggiornare security tests
- [ ] Verificare soft-delete workflow completo

### **Scheduler**
- [ ] ✅ Scheduler jobs usano proprio `isActive` - NESSUN CAMBIO
- [ ] Verificare `soft-delete-cleanup.job.ts` usa `deletedAt`

---

## 🎯 RISULTATO FINALE

### **PRIMA** (3 campi confusi):
```typescript
isActive: boolean      // ❌ Ridondante con deletedAt
isDelete: boolean      // ❌ Ridondante con deletedAt
deletedAt: DateTime?   // ✅ Standard Prisma
channelStatus: boolean // ✅ Bot ON/OFF
debugMode: boolean     // ✅ Debug mode
```

### **DOPO** (Solo 2 campi chiari):
```typescript
deletedAt: DateTime?   // ✅ Workspace cancellato/attivo
channelStatus: boolean // ✅ Bot ON/OFF (blocked when OFF)
debugMode: boolean     // ✅ Debug mode
```

---

## 📝 NOTE FINALI

**ANDREA, PUNTI CHIAVE**:

1. **`isActive` È TOTALMENTE RIDONDANTE** - `deletedAt !== null` fa lo stesso lavoro
2. **`isDelete` È TOTALMENTE RIDONDANTE** - `deletedAt !== null` fa lo stesso lavoro
3. **TRASH SYSTEM GIÀ CORRETTO** - Usa solo `deletedAt`, non tocca `isActive`
4. **6 FILE BACKEND DA MODIFICARE** - Tutti i check `!workspace.isActive` → `workspace.deletedAt !== null`
5. **1 FILE FRONTEND DA MODIFICARE** - WorkspaceSelectionPage usa `channelStatus` invece `isActive`
6. **BACKOFFICE GIÀ OK** - Nessun cambio necessario
7. **MIGRATION SEMPLICE** - Drop 2 colonne, nessuna data migration

**PRONTO PER INIZIARE?** Conferma e partiamo con la FASE 2!
