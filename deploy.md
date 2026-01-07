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

# STEP 5: Heroku DB reset (⚠️ DESTROYS DATA)
heroku pg:reset DATABASE --app echatbot-app --confirm echatbot-app

# STEP 6: Push to all Heroku apps (in order)
git push heroku-app main
git push heroku-backoffice main
git push heroku-scheduler main

# STEP 7: Monitor builds
heroku logs -n 200 --app echatbot-app
```

---

## ✅ Cosa Abbiamo Imparato

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

---

## ❌ Cosa NON Fare (Lessons from Near-Failures)

### 1. **NON pushare codice senza local test**
```bash
# ❌ WRONG
git commit && git push heroku-app main
# → Builds fail, wasted 5 min

# ✅ CORRECT
npm run build  # test locally first
git commit && git push origin main && git push heroku-app main
# → Instant success
```

### 2. **NON assumere che i valori enum siano "ovvi"**
```typescript
// ❌ WRONG
source: "FAST_PATH"  // feels right, but NOT in enum definition

// ✅ CORRECT
// Verify enum first:
// source: "PATTERN" | "KEYWORD" | "LLM_FALLBACK" | "LLM_CONTEXT"
source: "PATTERN"  // safe and documented
```

### 3. **NON commitare file temporanei**
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

### 4. **NON modificare schema senza test locale**
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

### 5. **NON eseguire seed su Heroku via CLI**
```bash
# ❌ WRONG (dotenv-cli missing in production)
heroku run "npm run seed" --app echatbot-app

# ✅ CORRECT
Test seed locally first
→ heroku pg:reset (if needed)
→ Database will have data from app startup
```

### 6. **NON skippare il reset database senza ragione**
```bash
# ❌ WRONG
Deploy new schema without pg:reset
→ Old DB schema + new code = 500 error

# ✅ CORRECT
schema changes → pg:reset → deploy
```

### 7. **NON toccare import/export patterns che funzionano**
```typescript
// ❌ WRONG (if it was working before)
export default MyComponent  // was export function MyComponent
// → imports break, app crashes

// ✅ CORRECT
If it works, DON'T change it
Only fix what's actually broken
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
5. **`heroku pg:reset DATABASE --app echatbot-app --confirm echatbot-app`** (if schema changed)
6. **`git push heroku-app main`** (watch logs)
7. **`git push heroku-backoffice main`** (wait for success)
8. **`git push heroku-scheduler main`** (wait for success)
9. **Verify URLs alive** and check `heroku logs -n 50 --app echatbot-app`

**Total time**: ~8-10 minutes. Non più di questo!

---

## 📚 Reference Files
- Schema: `apps/backend/prisma/schema.prisma`
- Seeds: `apps/backend/prisma/data/*.ts`
- Config: `apps/backend/package.json` (scripts)
- Heroku: `Procfile`, `Procfile.backoffice`, `Procfile.scheduler`
