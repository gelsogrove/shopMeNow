# 📋 Heroku Deploy Playbook (Production Bible)

**Last Updated**: January 7, 2026  
**Lesson Learned From**: FAQ + Slogans + TypeScript Fix Deployment Cycle

---

## 🎯 Pre-Deploy Checklist (NON skippare!)

### 1. **Local Environment Validation**
- ✅ `npm run build --workspaces` → deve passare senza errori TypeScript
- ✅ `cd apps/backend && npm run test:unit` → min 106 test suites passed
- ✅ Nessun errore in `npx tsc -p ./tsconfig.json` (esegui se build fallisce)
- ✅ `.env` file presente e completo (backup con data prima di modificare)

### 2. **Code Quality Checks**
- ✅ NO hardcoded `"FAST_PATH"`, `"CUSTOM_TYPE"` in enums non definiti
- ✅ Cercari tutti i valori enum prima di assegnarli (`grep source:` o `grep intentSource:`)
- ✅ Nessun import/export rotto se il codice funziona già
- ✅ Nessun file temporaneo commitato (*.backup, temp.ts, test-old.js)

### 3. **Database & Seed**
- ✅ Se cambio schema: `npx prisma migrate dev --name descrizione`
- ✅ Se cambio seed: update sia `initialFAQs.ts` che `defaultFAQs.ts` (non una sola!)
- ✅ Test seed LOCALE: `cd apps/backend && npm run seed`
- ✅ Verifica che seed non crashi: `✨ Seed completed successfully!` log

---

## 🚀 Deploy Sequence (Copy-Paste this)

```bash
# STEP 1: Local build
cd /Users/gelso/workspace/shopME
npm run build --workspaces

# STEP 2: Local seed test
cd apps/backend && npm run seed && cd ../..

# STEP 3: Test suite
cd apps/backend && npm run test:unit && cd ../..

# STEP 4: Git commit & push origin
git add -A
git commit -m "✨ Feature name description"
git push origin main

# ⚠️⚠️⚠️ CRITICAL: DATABASE RESET DECISION ⚠️⚠️⚠️
# STOP HERE! Answer this BEFORE running pg:reset:
#
# Did you change schema.prisma?
#   - Added/removed models? Added/removed fields?
#   - Created new migrations in prisma/migrations/?
#   YES → Database reset needed, but ONLY if customer approved
#   NO → Skip pg:reset entirely! Don't touch production database
#
# NEVER reset database without:
# 1️⃣  Customer/Andrea explicit approval
# 2️⃣  BACKUP of current database (saved locally)
# 3️⃣  Understanding that ALL DATA WILL BE DESTROYED
#
# BACKUP COMMAND (run BEFORE pg:reset):
# heroku pg:backups:capture --app echatbot-app
# heroku pg:backups:download --app echatbot-app
#
# If you're unsure → ASK ANDREA FIRST!

# STEP 5: Heroku DB reset (⚠️⚠️⚠️ DESTROYS ALL DATA ⚠️⚠️⚠️)
# Only run this if:
# 1. Schema changed (schema.prisma modified)
# 2. Customer/Andrea approved
# 3. Backup has been saved
#
heroku pg:backups:capture --app echatbot-app  # BACKUP FIRST
heroku pg:reset DATABASE --app echatbot-app --confirm echatbot-app

# STEP 6: Push to all Heroku apps (in order)
git push heroku-app main
git push heroku-backoffice main
git push heroku-scheduler main

# 🚨 STEP 7: MANDATORY DATABASE MIGRATION CHECK (January 26, 2026 Lesson)
# NEVER skip this! Production DB can be out of sync with code
heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app

# If you see "migrations have not yet been applied":
heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app

# If migration fails with "relation already exists":
heroku run "cd packages/database && npx prisma migrate resolve --applied <migration_name>" -a echatbot-app
# Then retry: heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app

# Verify success (MUST say "Database schema is up to date!"):
heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app

# 🚨 IF MIGRATIONS WERE APPLIED: Database is now EMPTY → SEED REQUIRED!
# Check if platform_config table is empty (will cause "Missing platform flag config" errors):
echo "SELECT COUNT(*) FROM platform_config WHERE type = 'FLAG';" | heroku pg:psql DATABASE -a echatbot-app --command

# If count is 0 or migration was just applied → RUN SEED:
heroku run "cd packages/database && npx prisma db seed" -a echatbot-app

# 🔄 AFTER SEED: MANDATORY RESTART (cache needs refresh)
heroku restart -a echatbot-app

# Verify seed worked (should show 8 flags):
echo "SELECT key, type, value FROM platform_config WHERE type = 'FLAG' ORDER BY key;" | heroku pg:psql DATABASE -a echatbot-app --command

# 🚨 STEP 8: VERIFY ENV VARIABLES (January 26, 2026 Lesson)
# Check that critical env vars are set on Heroku:
heroku config --app echatbot-app | grep -E "GOOGLE_CLIENT_ID|OPENROUTER_API_KEY|DATABASE_URL|JWT_SECRET"

# If any are missing, set them:
heroku config:set VARIABLE_NAME="value" -a echatbot-app

# STEP 9: Monitor builds and verify no errors
heroku logs -n 200 --app echatbot-app | grep -E "error|Error|500"
```

---

## ✅ Cosa Abbiamo Imparato

### 🚨 DATABASE MIGRATION FAILURE (January 26, 2026 - CRITICAL LESSON)
- **Problema**: OAuth login → 500 error con `"The table public.users does not exist"`
- **Root Cause #1**: Push a Heroku completato MA 5 migration NON applicate al database
- **Root Cause #2**: Migration applicate → Database vuoto → Seed NON eseguito
- **Root Cause #3**: Seed eseguito → Backend cache NON ricaricata → "Missing platform flag config"
- **Diagnosi**: 
  1. `heroku run "npx prisma migrate status"` → "migrations have not yet been applied"
  2. `heroku run "npx prisma migrate deploy"` → OK, ma database ora vuoto
  3. API falliva: "Missing platform flag config" → cache vuota, seed non eseguito
  4. `heroku run "npx prisma db seed"` → OK, ma backend ancora con cache vecchia
  5. `heroku restart` → NECESSARIO per ricaricare cache dal DB seedato
- **Soluzione Completa**:
  ```bash
  # 1. Apply migrations
  heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app
  
  # 2. Seed database (popola platform_config e altre tabelle)
  heroku run "cd packages/database && npx prisma db seed" -a echatbot-app
  
  # 3. MANDATORY: Restart app to reload cache
  heroku restart -a echatbot-app
  
  # 4. Verify: Check flags endpoint
  curl "https://www.echatbot.ai/api/v1/platform-config/flags/check"
  ```
- **Tempo perso**: 25 min debug totale
- **Fix tempo**: 5 min se avessimo fatto deploy sequence corretta
- **REGOLA D'ORO**: 
  - Migration → Seed → Restart (ALWAYS this order!)
  - NEVER skip restart after seed (cache doesn't auto-refresh)

### 🔑 ENV VARIABLES MISSING ON HEROKU (January 26, 2026)
- **Problema**: OAuth error `"OAuth authentication failed"` PRIMA del database issue
- **Root Cause**: `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` NON erano configurate su Heroku
- **Soluzione**: `heroku config:set GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." -a echatbot-app`
- **Lezione**: **Locale .env ≠ Heroku env vars!** Devi sincronizzare manualmente
- **Fix tempo**: 1 min, ma 10 min persi cercando il problema
- **REGOLA**: Prima di deploy, verificare che tutte le env vars critiche siano su Heroku:
  ```bash
  # Confronta .env locale con Heroku config
  grep -E "^[A-Z_]+" .env | cut -d= -f1 | sort > /tmp/local_vars.txt
  heroku config -a echatbot-app | grep -E "^[A-Z_]+" | awk '{print $1}' | tr -d ':' | sort > /tmp/heroku_vars.txt
  diff /tmp/local_vars.txt /tmp/heroku_vars.txt
  # Se ci sono differenze → AGGIUNGI le mancanti
  ```
- **Nota CORS**: `CORS_ORIGINS` (o `CORS_ORIGIN`) permette una allowlist extra (comma-separated) valida sia per API che WebSocket. Se vuota usa default: echatbot.ai/backoffice in prod, localhost in dev.

### TypeScript Enum Traps
- **Problema**: `source: "FAST_PATH"` ma enum è `"PATTERN" | "KEYWORD" | "LLM_FALLBACK" | "LLM_CONTEXT"`
- **Soluzione**: SEMPRE verificare enum values prima di assignare
- **Comando**: `grep -r "source:" apps/backend/src/application/chat-engine/ | grep ":" | head -5`
- **Fix tempo**: 5 min di fix, 30 min di debugging se non fatto prima

### Database Reset is INSTANT
- Heroku `pg:reset` resetta database ma non fa seed
- Seed su Heroku non è automatico (dotenv-cli non in production)
- **→ Seed deve essere eseguito in locale prima di reset**, o via prisma migration

### Multi-App Deploy Order Matters
- App principale: `heroku-app` (backend + frontend + database) ← DEVE essere prima
- App satellite: `heroku-backoffice`, `heroku-scheduler` ← dipendono da DB sync
- **→ Non spammare tutti e 3 insieme, fai uno alla volta**

### TypeScript Local vs Heroku Mismatch
- Build locale può passare ma Heroku fallire se missing deps
- Heroku build esegue `npm run build` che chiama `tsc`
- **→ SEMPRE testare `npm run build` in locale prima di push**

### Test Timeout with External APIs
- Test con LLM (OpenRouter) causano timeout di 150+ secondi
- Soluzione: `describe.skip()` per integration tests con API external
- **→ Non far crashare test suite per una dependency flaky**

### Database Reset is DANGEROUS (January 26 Lesson)
- **NEVER reset database se non hai cambiato schema.prisma**
- Il 26 Gennaio ho fatto `pg:reset` per codice TypeScript senza schema change → **ERRORE**
- Schema change = quando aggiungi/rimuovi campi o tabelle in `schema.prisma`
- Codice TypeScript fix = quando tocci solo `src/**/*.ts` senza toccare Prisma
- **REGOLA FONDAMENTALE**: 
  - ✅ Schema changed? Allora sì, reset (ma dopo backup + Andrea approval)
  - ❌ Solo code fix? NO RESET! Codice nuovo auto-deploy, database stays intact
- **ALWAYS**:
  1. Ask Andrea if unsure
  2. Backup database with `heroku pg:backups:capture`
  3. Download backup: `heroku pg:backups:download`
  4. Only then reset: `heroku pg:reset`

---

## ❌ Cosa NON Fare (Lessons from Near-Failures)

### 🚨 1. **CRITICAL: NON deployare senza migrare il database (January 26, 2026 - OAuth Failure)**
```bash
# ❌ PROBLEMA REALE (January 26, 2026 @ 10:24 UTC)
# User tenta login OAuth → 500 error
# Root cause: "The table `public.users` does not exist in the current database"
# Diagnosi: 5 migration NON applicate su Heroku dopo push

# ✅ SEQUENZA CORRETTA (SEMPRE questa!):
heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app
heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app  
heroku run "cd packages/database && npx prisma db seed" -a echatbot-app
heroku restart -a echatbot-app

### 🚨 2. **NON resettare database per fix TypeScript**
```bash
# ❌ ERRORE COMUNE
# Fix TypeScript enum → pg:reset → DISTRUGGE DATI
# Schema.prisma NON cambiato → Database reset NON necessario

# ✅ REGOLA
# Solo code fix (.ts files) → Deploy normale, NO database reset
# Schema change (.prisma files) → Backup + Reset + Seed
```

### 🚨 3. **NON skippare env vars sync**
```bash
# ❌ PROBLEMA
# .env locale ha GOOGLE_CLIENT_ID, Heroku no → OAuth fail

# ✅ VERIFICA SEMPRE
heroku config --app echatbot-app | grep -E "GOOGLE_CLIENT_ID|OPENROUTER_API_KEY"
```

---

## 📊 RECENT ANALYSIS & IMPROVEMENTS (December 2024)

### 🎯 **47 Tasks Identified - 203h Total Effort**

**Priority Breakdown**:
- 🔴 **CRITICAL (12 tasks)**: Security, billing, new channel UX
- 🟠 **HIGH (20 tasks)**: Settings UI, mobile responsive, LLM optimization  
- 🟡 **MEDIUM (15 tasks)**: Performance, documentation, testing

**By Type**:
- **Backend (18 tasks - 73h)**: Security priority chain, billing migration, workspace isolation
- **Frontend (12 tasks - 56h)**: Settings UI complete, onboarding wizard, mobile responsive
- **LLM (8 tasks - 32h)**: Prompt file loading, variable validation, context management
- **Testing (5 tasks - 27h)**: Security testing suite, integration tests
- **Documentation (2 tasks - 7h)**: API docs, architecture
- **Search (2 tasks - 8h)**: Product search optimization

### 🔧 **Template Enhancement Strategy (NEW)**

**Problem Identified**: Current `{{products}}` variable only includes name + price, missing product characteristics needed for specific searches like "piso de 40mq".

**Solution**: **Additive approach** - enhance existing template without losing information:

```typescript
// NEW: Enhanced PromptVariableBuilder
const variables = {
  // ✅ KEEP existing variables
  products: this.buildProductsList(workspace.id), // Simple list
  categories: this.buildCategoriesList(workspace.id),
  
  // ➕ ADD new detailed variables
  productsWithDetails: await this.buildProductsWithCharacteristics(workspace.id),
  productsByCategory: await this.buildProductsByCategory(workspace.id),
  featuredProducts: await this.buildFeaturedProducts(workspace.id),
  productCharacteristics: await this.buildProductCharacteristics(workspace.id)
}
```

**Template Enhancement**:
```markdown
## 📦 CATALOGO PRODOTTI COMPLETO
{{productsWithDetails}}

## 🏷️ PRODOTTI PER CATEGORIA  
{{productsByCategory}}

## ⭐ PRODOTTI IN EVIDENZA
{{featuredProducts}}

## 🔍 CARATTERISTICHE DISPONIBILI
{{productCharacteristics}}

## 📋 LISTA PRODOTTI SEMPLICE (riferimento rapido)
{{products}}
```

**Benefits**:
- ✅ **Zero data loss**: Maintains all existing context
- ✅ **Enhanced search**: LLM can match specific characteristics (superficie, taglia, etc.)
- ✅ **Backward compatible**: Existing templates continue working
- ✅ **Flexible usage**: LLM can choose simple list OR detailed info

**Implementation Priority**: 🔴 **CRITICAL** - 3h effort

### 🚨 **Top 3 Immediate Blockers**

1. **New Channel Onboarding UX (12h)** - 80% user abandonment after creating empty workspace
2. **Settings UI Complete (8h)** - 15+ workspace fields not configurable in UI
3. **Security Priority Chain (6h)** - No P1/P2/P3 security checks implemented

### 📈 **4-Sprint Roadmap**

**Sprint 1 (Week 1-2)**: CRITICAL Foundation
- Security priority chain
- Billing owner-based migration  
- New channel onboarding UX
- Template enhancement with characteristics

**Sprint 2 (Week 3-4)**: HIGH Impact
- Settings UI complete implementation
- Mobile responsive fixes
- Workspace isolation audit

**Sprint 3 (Week 5-6)**: MEDIUM Stability  
- Caching layer implementation
- Real-time updates WebSocket
- Integration testing suite

**Sprint 4 (Week 7-8)**: Optimization
- Performance improvements
- Documentation completion
- Search optimization

---

## 🔄 **Updated Deploy Sequence with Analysis Integration**

```bash
# STEP 0: Pre-deploy Analysis Check
# Review current sprint tasks from Epics/analisi-per-tipo.md
# Ensure no CRITICAL blockers are being introduced

# STEP 1: Enhanced Template Check (if LLM changes)
if [[ $(git diff --name-only | grep -E "docs/prompts/|prompt-variable-builder") ]]; then
  echo "🔍 LLM/Template changes detected - verify variable replacement"
  cd apps/backend && npm run test:prompt-variables
fi CORRETTA (MANDATORY!)
# STEP 1: Check migration status PRIMA del deploy
heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app

# STEP 2: Se vedi "migrations have not yet been applied" → APPLICA SUBITO
heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app

# STEP 3: Verifica che database sia aggiornato
heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app
# DEVE dire: "Database schema is up to date!"

# STEP 4: Se migration fallisce con "relation already exists" (conflitto)
heroku run "cd packages/database && npx prisma migrate resolve --applied <migration_name>" -a echatbot-app
# Poi riprova migrate deploy

# 🎯 REGOLA D'ORO:
# DOPO OGNI GIT PUSH A HEROKU:
# 1. Check migration status
# 2. Apply pending migrations
# 3. Verify success
# NON fidarti che "funzionava in locale" - production DB può essere indietro!
```

### 📝 **CHECKLIST ENV VARIABLES SU HEROKU (January 26, 2026)**
```bash
# Problema: OAuth falliva con "OAuth authentication failed"
# Root cause: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET NON erano su Heroku

# ✅ PRIMA DI OGNI DEPLOY: Verifica che tutte le env vars siano su Heroku
# List all env vars nel locale .env:
grep -E "^[A-Z_]+" .env | cut -d= -f1 | sort

# List all env vars su Heroku:
heroku config --app echatbot-app | grep -E "^[A-Z_]+" | awk '{print $1}' | tr -d ':' | sort

# Confronta i due output! Se mancano variabili su Heroku → AGGIUNGI
heroku config:set VARIABILE="valore" -a echatbot-app

# 🎯 Env vars critiche da verificare SEMPRE:
# - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (OAuth)
# - ADMIN_EMAIL / ADMIN_PASSWORD (Seed user creation)
# - OPENROUTER_API_KEY (LLM)
# - DATABASE_URL (Prisma)
# - WHATSAPP_API_TOKEN / WHATSAPP_WEBHOOK_TOKEN
# - JWT_SECRET (auth)
# - PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET
```

### 🔧 **SEED USER DUPLICATION (January 26, 2026)**
```bash
# Problema: Utente creato con OAuth (gelsogrove@gmail.com) NON aveva permessi admin
# Root cause: Seed creava secondo utente perché ADMIN_EMAIL non era su Heroku
# Risultato: Due utenti (gelsogrove OAuth + gelsogrve seed) → workspaces su utente sbagliato

# ✅ SOLUZIONE PERMANENTE:
# 1. Set ADMIN_EMAIL su Heroku PRIMA del seed
heroku config:set ADMIN_EMAIL="gelsogrove@gmail.com" ADMIN_PASSWORD="Venezia44" -a echatbot-app

# 2. Seed ora usa env var invece di fallback hardcoded
# File: packages/database/prisma/seed.ts
# Line 170: const adminEmail = process.env.ADMIN_EMAIL || "gelsogrove@gmail.com"
# ✅ adminEmail usato in: user.email, user.paypalEmail, sales.email

# 🔄 Se già esiste duplicazione:
# Transfer workspaces to correct user:
heroku pg:psql DATABASE -a echatbot-app --command "
  UPDATE \"Workspace\" SET \"ownerId\" = '<correct_user_id>' WHERE \"ownerId\" = '<typo_user_id>';
  UPDATE \"UserWorkspace\" SET \"userId\" = '<correct_user_id>' WHERE \"userId\" = '<typo_user_id>';
  DELETE FROM users WHERE id = '<typo_user_id>';
"

# Update permissions for OAuth user:
heroku pg:psql DATABASE -a echatbot-app --command "
  UPDATE users 
  SET \"isPlatformAdmin\" = true, \"isDeveloperUser\" = true, role = 'ADMIN', \"planType\" = 'ENTERPRISE'
  WHERE email = 'gelsogrove@gmail.com';
"
```

### 2. **NON resettare database senza schema change**
```bash
# ❌ WRONG (January 26, 2026 mistake)
Only fixed TypeScript code → ran pg:reset anyway → WASTED reset, lost data by luck

# ✅ CORRECT CHECK
1. Did you edit schema.prisma? (Added/removed models or fields?)
   YES → Schema change detected, reset OK (but backup first!)
   NO → Don't reset! Just push code and deploy

# How to verify:
git diff HEAD~1 packages/database/prisma/schema.prisma
# If empty → NO schema change → skip pg:reset!
```

### 2. **NON pushare codice senza local test**
```bash
# ❌ WRONG
git commit && git push heroku-app main
# → Builds fail, wasted 5 min

# ✅ CORRECT
npm run build  # test locally first
git commit && git push origin main && git push heroku-app main
# → Instant success
```

### 3. **NON assumere che i valori enum siano "ovvi"**
```typescript
// ❌ WRONG
source: "FAST_PATH"  // feels right, but NOT in enum definition

// ✅ CORRECT
// Verify enum first:
// source: "PATTERN" | "KEYWORD" | "LLM_FALLBACK" | "LLM_CONTEXT"
source: "PATTERN"  // safe and documented
```

### 4. **NON commitare file temporanei**
```bash
# ❌ WRONG (git status shows these)
temp-script.ts
backup-old.sql
test-debug.js
.backup file

# ✅ CORRECT
git add -A  # but verify no temp files first
git status  # always double-check before commit
```

### 5. **NON modificare schema senza test locale**
```bash
# ❌ WRONG
Edit schema.prisma → push heroku → fail

# ✅ CORRECT
Edit schema.prisma
→ npx prisma migrate dev --name fix_field_type
→ npm run seed
→ npm run test:unit
→ commit & push
```

### 6. **NON eseguire seed su Heroku via CLI**
```bash
# ❌ WRONG (dotenv-cli missing in production)
heroku run "npm run seed" --app echatbot-app

# ✅ CORRECT
Test seed locally first
→ heroku pg:reset (if needed, with backup first!)
→ Database will have data from migrations
```

### 7. **NON skippare il backup prima di reset**
```bash
# ❌ WRONG
See schema change → immediately pg:reset → pray data is saved

# ✅ CORRECT (MANDATORY)
See schema change
→ heroku pg:backups:capture --app echatbot-app  # BACKUP FIRST
→ heroku pg:backups:download --app echatbot-app  # SAVE LOCALLY
→ Ask Andrea for confirmation
→ THEN run pg:reset
```

### 8. **NON toccare import/export patterns che funzionano**
```typescript
// ❌ WRONG (if it was working before)
export default MyComponent  // was export function MyComponent
// → imports break, app crashes

// ✅ CORRECT
If it works, DON'T change it
Only fix what's actually broken
```

### 9. **🚨 CRITICAL: NON reset database per code fixes (January 26, 2026)**
```
Esempio ERRORE:
- Changed TypeScript code only (src/**/*.ts)
- NO schema change in schema.prisma
- But ran pg:reset anyway → WASTED, could lose data

Cosa dovevo fare:
- Check schema change: git diff HEAD~1 packages/database/prisma/schema.prisma
- Empty diff → no schema change → just push code
- Code deployment is fast and safe, database stays intact

Remember: Code updates deploy automatically. Database changes are RARE.
If unsure whether schema changed: ASK ANDREA FIRST!
```

---

## 📊 Deploy Timings (Reality Check)

- **Local build**: ~30 sec
- **Local seed**: ~5 sec  
- **Local tests**: ~3.4 sec (with skipped suites)
- **Heroku compile (echatbot-app)**: ~40 sec
- **Heroku compile (backoffice)**: ~15 sec
- **Heroku compile (scheduler)**: ~10 sec
- **Total deploy cycle**: ~8 min (build + test + commit + push + heroku builds)

**⏱️ Pro tip**: Run build in background while doing other tasks: `npm run build --workspaces &`

---

## 🔗 App URLs (Heroku Live)

```
Main App:       https://echatbot-app-1cba28556df2.herokuapp.com/
Backoffice:     https://echatbot-backoffice-3497e777ec08.herokuapp.com/
Scheduler:      https://echatbot-scheduler-56cda430c2c4.herokuapp.com/ (worker, no UI)
```

---

## 🐛 Common Issues & Quick Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| "TypeScript error: type X not assignable" | Enum value mismatch | `grep -r "WRONG_VALUE"` + replace with valid enum |
| Build fails on Heroku but passes local | Missing deps or tsc config | `npm run build` locally to replicate |
| Database schema mismatch | Schema change without reset | `heroku pg:reset` then redeploy |
| "Seed not found" on `heroku run` | dotenv-cli not in production | Test seed locally, don't run on Heroku |
| Worker crashes after deploy | Old schema + new code | Reset DB AND re-seed |
| Backoffice 404 errors | Assets not built | Check `vite build` output, verify dist/ folder |

---

## 📝 Env Variables Checklist

**These MUST be set on `echatbot-app` (not scattered):**
- `OPENROUTER_API_KEY` ✓
- `DATABASE_URL` ✓
- `WHATSAPP_WEBHOOK_TOKEN` ✓
- `WHATSAPP_API_TOKEN` ✓
- `CLOUDINARY_CLOUD_NAME` ✓
- `SMTP_*` (email) ✓
- `JWT_SECRET` ✓

Verify: `heroku config --app echatbot-app | grep OPENROUTER`

---

## 🔑 PayPal (Prod & Dev)
- Set PAYPAL_CLIENT_ID/SECRET for sandbox and live
- Set PAYPAL_WEBHOOK_ID_SANDBOX / PAYPAL_WEBHOOK_ID_LIVE
- Optional: PAYPAL_REDIRECT_URI_SANDBOX / PAYPAL_REDIRECT_URI_LIVE (fallback PAYPAL_REDIRECT_URI)
- Optional: PAYPAL_PLAN_ID_SANDBOX / PAYPAL_PLAN_ID_LIVE (auto-created if empty; anchor $1, USD)
- Tokens are encrypted with PAYPAL_TOKEN_ENCRYPTION_KEY

## ✨ Deployment Success Signals

After `git push heroku-app main`, watch logs:
```
✅ Build succeeded!
✅ Releasing v154
✅ Released v154
https://echatbot-app-1cba28556df2.herokuapp.com/ deployed to Heroku
```

If you see:
- ❌ `failed to compile`
- ❌ `npm error code 2`
- ❌ `Push rejected`

→ Check local build with `npm run build`, fix TypeScript errors, recommit, retry push.

---

## 🎓 Next Deploy: Use This Exact Sequence

1. **Edit code** → commit locally
2. **Run `npm run build --workspaces`** (wait for success)
3. **Run `npm run test:unit`** (min 106 suites)
4. **`git push origin main`** (always to origin first)
5. **Check schema change**: `git diff HEAD~1 packages/database/prisma/schema.prisma`
   - If changed → `heroku pg:reset DATABASE --app echatbot-app --confirm echatbot-app` (backup first!)
   - If NOT changed → Skip reset, just push code
6. **`git push heroku-app main`** (watch logs)
7. **🚨 MANDATORY**: `heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app`
   - If pending migrations → `heroku run "cd packages/database && npx prisma migrate deploy" -a echatbot-app`
   - Verify: `heroku run "cd packages/database && npx prisma migrate status" -a echatbot-app`
8. **🚨 MANDATORY**: `heroku config --app echatbot-app | grep -E "GOOGLE_CLIENT_ID|OPENROUTER_API_KEY|DATABASE_URL|JWT_SECRET"`
   - If missing → `heroku config:set VARIABLE="value" -a echatbot-app`
9. **`git push heroku-backoffice main`** (wait for success)
10. **`git push heroku-scheduler main`** (wait for success)
11. **Verify URLs alive** and check `heroku logs -n 50 --app echatbot-app | grep -E "error|Error|500"`

**Total time**: ~10-12 minutes (including migration check). Non più di questo!

**🔴 NEVER SKIP STEPS 7 & 8!** These catch 90% of production failures!

---

## 📚 Reference Files
- Schema: `apps/backend/prisma/schema.prisma`
- Seeds: `apps/backend/prisma/data/*.ts`
- Config: `apps/backend/package.json` (scripts)
- Heroku: `Procfile`, `Procfile.backoffice`, `Procfile.scheduler`
