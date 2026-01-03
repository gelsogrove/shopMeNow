# Task 06: Creare Migration Database

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 30min  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Creare una migration Prisma per eliminare fisicamente la tabella `registration_attempts` dal database PostgreSQL. La migration deve essere compatibile con il deployment Heroku.

---

## 🎯 Obiettivo

Rimuovere la tabella `registration_attempts` dal database mantenendo tutti gli altri dati intatti. La migration deve essere:
- ✅ Reversibile (down migration)
- ✅ Sicura (no data loss su altre tabelle)
- ✅ Compatibile Heroku

---

## 💻 Comandi e File

### 1. Creare Migration

```bash
# Posizionarsi nella directory database
cd packages/database

# Creare migration con Prisma
npx prisma migrate dev --name remove_registration_attempts

# Output atteso:
# ✔ Migration `YYYYMMDDHHMMSS_remove_registration_attempts` created
```

### 2. Verificare Migration Generata

**Path**: `packages/database/prisma/migrations/YYYYMMDDHHMMSS_remove_registration_attempts/migration.sql`

```sql
-- DropTable
DROP TABLE IF EXISTS "registration_attempts";
```

### 3. Test Migration Locale

```bash
# Apply migration
npx prisma migrate deploy

# Verify table removed
npx prisma studio
# → Check "registration_attempts" table is gone

# Test rollback (optional)
npx prisma migrate reset
npx prisma migrate deploy
```

### 4. Deploy su Heroku

```bash
# Method 1: Via heroku run
heroku run "cd packages/database && npx prisma migrate deploy" --app echatbot-app

# Method 2: Via deploy script (automatic)
./scripts/deploy-all-heroku.sh
# → Script includes migration step

# Verify on Heroku
heroku pg:psql --app echatbot-app
\dt  # List tables - verify registration_attempts is gone
\q   # Exit psql
```

---

## 💻 Esempi di Codice

### Migration File (Auto-Generated)

**Path**: `packages/database/prisma/migrations/YYYYMMDDHHMMSS_remove_registration_attempts/migration.sql`

```sql
-- CreateTable removed, DropTable added
-- Migration: remove_registration_attempts
-- Date: 2026-01-03

BEGIN;

-- Drop table registration_attempts
DROP TABLE IF EXISTS "registration_attempts";

COMMIT;
```

### Verificare Schema

**Path**: `packages/database/prisma/schema.prisma`

```prisma
// ✅ VERIFY: Model RegistrationAttempts should NOT be present
// (removed in Task 03)

model Workspace {
  id   String @id @default(cuid())
  name String
  // ... other fields
}

model Customer {
  id    String  @id @default(cuid())
  name  String
  phone String
  // ... other fields
}

// ❌ NO RegistrationAttempts model here
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Tabella `registration_attempts` eliminata dal database locale
- [ ] Tabella `registration_attempts` eliminata dal database Heroku
- [ ] Tutti gli altri dati (customers, workspaces, orders) intatti
- [ ] Applicazione funziona normalmente dopo migration

### Tecnici
- [ ] Migration file generato in `prisma/migrations/`
- [ ] Migration contiene `DROP TABLE IF EXISTS "registration_attempts";`
- [ ] `npx prisma migrate deploy` completa con successo (locale)
- [ ] `heroku run "... migrate deploy"` completa con successo (produzione)
- [ ] Prisma Studio non mostra tabella `registration_attempts`
- [ ] No errori nel log Heroku dopo deployment

### Database
- [ ] Locale: `\dt` in psql non mostra `registration_attempts`
- [ ] Heroku: `\dt` in psql non mostra `registration_attempts`
- [ ] Database backup creato prima della migration (Heroku auto-backup)

---

## 🔗 File Correlati

- Task 03: Rimuovere model da schema (MUST essere fatto PRIMA)
- `packages/database/prisma/schema.prisma` - Schema aggiornato
- `packages/database/prisma/migrations/` - Directory migrations

---

## 📋 Checklist Implementazione

### Pre-Migration
- [ ] ✅ Task 03 completato (model rimosso da schema.prisma)
- [ ] `npx prisma generate` funziona senza errori
- [ ] Backup database locale: `pg_dump echatbot > backup_pre_migration.sql`
- [ ] Commit changes: `git add . && git commit -m "chore: remove RegistrationAttempts model"`

### Migration Locale
- [ ] `cd packages/database`
- [ ] `npx prisma migrate dev --name remove_registration_attempts`
- [ ] Verificare file migration creato correttamente
- [ ] `npx prisma migrate deploy` - apply migration
- [ ] `npx prisma studio` - verificare tabella rimossa
- [ ] Test app locale: `cd ../../apps/backend && npm run dev`
- [ ] Verificare nessun errore query Prisma

### Migration Heroku (Produzione)
- [ ] `git push heroku main` (deploy nuovo codice)
- [ ] `heroku run "cd packages/database && npx prisma migrate deploy" --app echatbot-app`
- [ ] Verificare output: "✔ Migration ... applied"
- [ ] `heroku pg:psql --app echatbot-app` → `\dt` → verificare no registration_attempts
- [ ] `heroku logs --tail --app echatbot-app` → verificare nessun errore Prisma
- [ ] `heroku restart --app echatbot-app` (se necessario)

### Post-Migration
- [ ] Test webhook WhatsApp (non deve cercare tabella registration_attempts)
- [ ] Test registrazione nuovo utente (deve funzionare)
- [ ] Monitorare Heroku logs per 10 minuti
- [ ] Compilare: `npm run build` - verificare 0 errori
- [ ] Testare: `npm run test` - verificare 0 test falliti

---

**Dependencies**: Task 03 (model rimosso da schema) - MUST essere completato PRIMA  
**Blocks**: Nessuno (ultimo task backend)  
**Last Updated**: 2026-01-03

---

## 🚨 Rollback Plan (Emergency)

Se qualcosa va storto su Heroku:

```bash
# 1. Revert schema.prisma (git)
git revert HEAD

# 2. Recreate table manually
heroku pg:psql --app echatbot-app

CREATE TABLE registration_attempts (
  id TEXT PRIMARY KEY,
  "phoneNumber" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "attemptCount" INTEGER DEFAULT 0,
  "lastAttemptAt" TIMESTAMP DEFAULT NOW(),
  "isBlocked" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("phoneNumber", "workspaceId")
);

# 3. Redeploy old code
git push heroku HEAD~1:main --force

# 4. Restart
heroku restart --app echatbot-app
```
