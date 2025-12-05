# 🚀 Guida Migrazione Prisma 7.1 + TypeScript 5.9

> **Progetto**: shopME / eChatbot  
> **Data**: Dicembre 2024  
> **Branch**: `195-prisma-7-upgrade`

Questa guida documenta tutti i passaggi, trucchi e problemi risolti durante la migrazione.

---

## 📋 Indice

1. [Overview delle Modifiche](#overview-delle-modifiche)
2. [Migrazione Prisma 7.1](#migrazione-prisma-71)
3. [Migrazione TypeScript 5.9](#migrazione-typescript-59)
4. [Fix per i Test (Jest)](#fix-per-i-test-jest)
5. [Problemi Comuni e Soluzioni](#problemi-comuni-e-soluzioni)
6. [Checklist di Migrazione](#checklist-di-migrazione)

---

## Overview delle Modifiche

### Pacchetti Aggiornati

```json
{
  "dependencies": {
    "@prisma/client": "^7.1.0",
    "@prisma/adapter-pg": "^7.1.0",
    "typescript": "^5.9.0-dev.20250603"
  },
  "devDependencies": {
    "prisma": "^7.1.0"
  }
}
```

### File Modificati (131 file totali)

- **Backend**: 90+ file (services, repositories, controllers, middlewares)
- **Scheduler**: 5 file
- **Database Package**: 5 file
- **Test**: 30+ file

---

## Migrazione Prisma 7.1

### 1. Cambiamento Principale: Driver Adapters

**Prisma 7 richiede un driver adapter obbligatorio.** Non puoi più usare `new PrismaClient()` senza configurazione.

```typescript
// ❌ VECCHIO (Prisma 5/6)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ✅ NUOVO (Prisma 7.1)
import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})
```

### 2. Crea `prisma.config.ts`

Crea questo file nella root del package database:

```typescript
// packages/database/prisma.config.ts
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
})
```

### 3. Modifica `schema.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"  // ← AGGIUNGI QUESTO
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 4. Struttura Package Database (Monorepo)

Crea un package centralizzato per il database:

**`packages/database/src/index.ts`:**

```typescript
import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Initialize the PostgreSQL adapter
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

// Singleton Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Re-export Prisma types and enums
export { PrismaClient, Prisma } from './generated/prisma/client'

// Re-export enums (IMPORTANTE!)
export * from './generated/prisma/enums'

// Export common types
export type {
  User,
  Workspace,
  Products,
  Orders,
  Customers,
  // ... tutti i tuoi modelli
} from './generated/prisma/client'

export default prisma
```

### 5. Aggiorna Tutti gli Import

**Cerca e sostituisci in tutto il progetto:**

```typescript
// ❌ VECCHIO
import { PrismaClient } from '@prisma/client'
import { UserRole, OrderStatus } from '@prisma/client'
const prisma = new PrismaClient()

// ✅ NUOVO
import { prisma, UserRole, OrderStatus } from '@echatbot/database'
// oppure
import { prisma, Prisma, PlanType } from '../config/database'
```

**Comandi per trovare import da aggiornare:**

```bash
# Trova tutti gli import da @prisma/client
grep -r "from '@prisma/client'" --include="*.ts" .
grep -r "from \"@prisma/client\"" --include="*.ts" .

# Trova tutte le istanze di new PrismaClient()
grep -r "new PrismaClient()" --include="*.ts" .
```

### 6. Gitignore per File Generati

```gitignore
# Prisma Generated Files (regenerated on prisma generate)
packages/database/src/generated/
**/generated/prisma/
```

---

## Migrazione TypeScript 5.9

### 1. Configurazione tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

### 2. Problemi Risolti con TS 5.9

#### Import Type vs Import Value

TypeScript 5.9 è più rigoroso sugli import di tipi:

```typescript
// ❌ Può causare errori
import { UserRole } from '@prisma/client'

// ✅ Più esplicito (consigliato)
import type { UserRole } from '@echatbot/database'
// oppure
import { type UserRole, prisma } from '@echatbot/database'
```

#### Strict Null Checks

TS 5.9 è più rigoroso sui null checks:

```typescript
// ❌ Errore in TS 5.9
const user = await prisma.user.findFirst({ where: { id } })
console.log(user.name) // Error: user might be null

// ✅ Corretto
const user = await prisma.user.findFirst({ where: { id } })
if (!user) throw new Error('User not found')
console.log(user.name)
```

#### Decimal Type Handling

```typescript
// ❌ Vecchio approccio (non funziona più)
import { Decimal } from '@prisma/client/runtime/library'
const price = new Decimal(10.5)

// ✅ Nuovo approccio
import { Prisma } from '@echatbot/database'
const price = new Prisma.Decimal(10.5)
```

---

## Fix per i Test (Jest)

### 1. Mock di Prisma con Namespace

I test devono mockare anche il namespace `Prisma` per supportare `Prisma.Decimal`:

```typescript
// ❌ Mock incompleto
jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}))

// ✅ Mock completo
const mockPrismaNamespace = {
  Decimal: class {
    value: number
    constructor(val: number | string) {
      this.value = typeof val === 'string' ? parseFloat(val) : val
    }
    lessThan(other: { value: number }): boolean {
      return this.value < other.value
    }
    minus(other: { value: number }) {
      return new mockPrismaNamespace.Decimal(this.value - other.value)
    }
    negated() {
      return new mockPrismaNamespace.Decimal(-this.value)
    }
    toString(): string {
      return this.value.toString()
    }
  },
}

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
  Prisma: mockPrismaNamespace,  // ← FONDAMENTALE!
  PlanType: { FREE_TRIAL: 'FREE_TRIAL', BASIC: 'BASIC', PREMIUM: 'PREMIUM' },
  CampaignFrequency: { DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' },
}))
```

### 2. Mock di `$transaction`

Prisma 7 supporta sia callback che array style per `$transaction`:

```typescript
// ✅ Mock che supporta entrambi gli stili
mockPrisma.$transaction = jest.fn(async (input: unknown) => {
  // Callback style: prisma.$transaction(async (tx) => { ... })
  if (typeof input === 'function') {
    return await input(mockPrisma)
  }
  // Array style: prisma.$transaction([promise1, promise2])
  if (Array.isArray(input)) {
    return await Promise.all(input)
  }
  return undefined
})
```

### 3. Jest Setup per Prisma

**`jest.setup.js`:**

```javascript
// Aumenta timeout per test con database
jest.setTimeout(30000)

// Mock globale per evitare connessioni reali
jest.mock('@echatbot/database', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    // ... altri mock
  }
}))
```

### 4. Configurazione Jest

**`jest.config.js`:**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,  // Velocizza i test
    }],
  },
  moduleNameMapper: {
    '^@echatbot/database$': '<rootDir>/../../packages/database/src',
  },
}
```

---

## Problemi Comuni e Soluzioni

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| `PrismaClient needs non-empty PrismaClientOptions` | Prisma 7 richiede adapter | Aggiungi `PrismaPg` adapter |
| `Cannot find module './generated/prisma/client'` | File non generati | Esegui `prisma generate` |
| `Decimal is not a constructor` | Import sbagliato | Usa `new Prisma.Decimal()` |
| Import enums non funziona | Export mancante | Esporta da `./generated/prisma/enums` |
| Test falliscono con mock | Mock incompleto | Aggiungi `Prisma` namespace al mock |
| `Type 'X' is not assignable to type 'Y'` | TS 5.9 più strict | Aggiungi null checks espliciti |
| `$transaction` non funziona nei test | Mock non supporta array | Aggiorna mock per supportare entrambi gli stili |
| `isolatedModules` warning | ts-jest config deprecata | Sposta in `transform` options |

---

## Checklist di Migrazione

### Pre-Migrazione

- [ ] Backup del database
- [ ] Commit di tutto il codice corrente
- [ ] Crea un branch dedicato (`feature/prisma-7-upgrade`)

### Installazione Pacchetti

```bash
# Rimuovi vecchi pacchetti
npm uninstall @prisma/client prisma

# Installa nuovi
npm install @prisma/client@^7.1.0 @prisma/adapter-pg@^7.1.0
npm install -D prisma@^7.1.0

# Per TypeScript 5.9
npm install typescript@^5.9.0-dev.20250603
```

### Configurazione

- [ ] Crea `prisma.config.ts`
- [ ] Modifica `schema.prisma` (aggiungi `output`)
- [ ] Esegui `npx prisma generate`
- [ ] Crea/aggiorna package database centralizzato
- [ ] Aggiorna `.gitignore`

### Codice

- [ ] Sostituisci tutti `import { ... } from '@prisma/client'`
- [ ] Sostituisci tutti `new PrismaClient()` standalone
- [ ] Aggiorna import di `Decimal` a `Prisma.Decimal`
- [ ] Fix null checks dove richiesto da TS 5.9

### Test

- [ ] Aggiorna mock con `Prisma` namespace
- [ ] Aggiorna mock `$transaction` per supportare array
- [ ] Esegui tutti i test: `npm run test`

### Verifica Finale

- [ ] `npm run build` passa senza errori
- [ ] `npm run test` passa (tutti i test)
- [ ] Applicazione si avvia correttamente
- [ ] Operazioni CRUD funzionano

---

## Script Utili

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "npx ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "postinstall": "prisma generate"
  }
}
```

---

## Comandi di Ricerca Utili

```bash
# Trova tutti gli import da @prisma/client
grep -rn "from '@prisma/client'" --include="*.ts" apps/

# Trova tutte le istanze di new PrismaClient()
grep -rn "new PrismaClient()" --include="*.ts" apps/

# Trova import di Decimal
grep -rn "import.*Decimal" --include="*.ts" apps/

# Trova file che potrebbero avere problemi
grep -rn "../../generated/prisma" --include="*.ts" apps/
```

---

## Tempo Stimato

| Fase | Tempo |
|------|-------|
| Setup iniziale | 1-2 ore |
| Sostituzione import | 2-4 ore |
| Fix test | 2-4 ore |
| Debug e fix vari | 2-4 ore |
| **Totale** | **7-14 ore** |

> **Nota**: Il tempo può variare significativamente in base alla dimensione del progetto e al numero di test.

---

## Risorse

- [Prisma 7 Release Notes](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Driver Adapters Documentation](https://www.prisma.io/docs/orm/overview/databases/driver-adapters)
- [TypeScript 5.9 Release Notes](https://devblogs.microsoft.com/typescript/)

---

**Autore**: GitHub Copilot + Andrea  
**Ultimo aggiornamento**: Dicembre 2024
