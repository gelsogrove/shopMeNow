# 🤖 CI/CD - Auto-Deploy con GitHub Actions

Configurazione per deploy automatico su Heroku con test prima del deploy.

---

## 🎯 Come Funziona

```
1. Tu: git push origin main
   ↓
2. GitHub Actions: Parte workflow automatico
   ↓
3. Test Backend: npm run test:unit + test:security
   ↓
4. Test Frontend: npm run test:fe
   ↓
5. Build Check: npm run build
   ↓
6. ✅ SE TUTTO PASSA → Deploy automatico su Heroku
   ❌ SE QUALCOSA FALLISCE → Deploy BLOCCATO
```

---

## 📋 Setup Iniziale (UNA VOLTA SOLA)

### 1. Crea Secrets su GitHub

Vai su GitHub: **Settings → Secrets and variables → Actions → New repository secret**

Aggiungi 3 secrets:

```bash
# 1. HEROKU_API_KEY
# Ottienilo con: heroku auth:token
Name: HEROKU_API_KEY
Value: [il tuo token Heroku]

# 2. HEROKU_APP_NAME
Name: HEROKU_APP_NAME
Value: echatbot-production

# 3. HEROKU_EMAIL
Name: HEROKU_EMAIL
Value: tua-email@esempio.com
```

### 2. Verifica Workflow Attivo

Il file `.github/workflows/test-and-deploy.yml` è già pronto!

```bash
# Commit e push per attivarlo
git add .github/workflows/test-and-deploy.yml
git commit -m "ci: add GitHub Actions auto-deploy"
git push origin main
```

### 3. Monitora Deploy

- **GitHub Actions**: https://github.com/[tuousername]/[tuorepo]/actions
- **Heroku Logs**: `heroku logs --tail -a echatbot-production`

---

## ✅ Cosa Testa Prima di Deployare

### Backend Tests
- ✅ Unit tests (`npm run test:unit`)
- ✅ Security tests (`npm run test:security`)
- ✅ Database migrations
- ✅ Prisma generate

### Frontend Tests
- ✅ Component tests (`npm run test:fe`)

### Build Check
- ✅ Backend build (`apps/backend/dist/`)
- ✅ Frontend build (`apps/frontend/dist/`)

### Post-Deploy
- ✅ Health check (`/health` endpoint)

---

## 🚀 Workflow Automatico

### Push su `main`
```bash
git add .
git commit -m "feat: nuova funzione"
git push origin main  # ← PARTE TUTTO AUTOMATICAMENTE
```

**Cosa succede:**
1. GitHub Actions esegue test
2. Se test passano → Deploy su Heroku
3. Se test falliscono → Deploy BLOCCATO (main resta COM'ERA)

### Pull Request
```bash
git checkout -b feature/nuova-feature
git push origin feature/nuova-feature
# Crea PR su GitHub
```

**Cosa succede:**
1. GitHub Actions esegue SOLO test (NO deploy)
2. Vedi se test passano prima del merge
3. Se test OK → Puoi fare merge
4. Merge su main → Deploy automatico

---

## 📊 Monitoraggio

### Durante il Deploy
```bash
# Guarda GitHub Actions (real-time)
# https://github.com/[tuorepo]/actions

# Guarda logs Heroku (dopo deploy)
heroku logs --tail -a echatbot-production
```

### Se Deploy Fallisce
```bash
# 1. Vedi errore su GitHub Actions
# 2. Vedi quale test è fallito
# 3. Fix in locale
# 4. Push again → Deploy riprova automaticamente
```

---

## 🔧 Configurazione Avanzata

### Cambia Branch per Auto-Deploy

Modifica `.github/workflows/test-and-deploy.yml`:
```yaml
on:
  push:
    branches:
      - production  # Cambia da 'main' a 'production'
```

### Aggiungi Staging Environment

```yaml
deploy-staging:
  # Deploy su staging per branch 'develop'
  if: github.ref == 'refs/heads/develop'
  # ...
  heroku_app_name: echatbot-staging

deploy-production:
  # Deploy su production per branch 'main'
  if: github.ref == 'refs/heads/main'
  # ...
  heroku_app_name: echatbot-production
```

### Disabilita Auto-Deploy Temporaneamente

**Opzione 1: Commenta il workflow**
```bash
# Rinomina file per disabilitare
mv .github/workflows/test-and-deploy.yml .github/workflows/test-and-deploy.yml.disabled
```

**Opzione 2: Skip CI**
```bash
git commit -m "fix: quick fix [skip ci]"
# [skip ci] = salta GitHub Actions
```

---

## 🐛 Troubleshooting

### "Heroku API Key Invalid"
```bash
# Rigenera token
heroku auth:token

# Aggiorna secret su GitHub
# Settings → Secrets → HEROKU_API_KEY → Update
```

### "Tests Failed"
```bash
# Test in locale prima di pushare
npm run test:unit
npm run test:security
npm run test:fe
npm run build
```

### "Deploy Failed - App Not Found"
```bash
# Verifica nome app su Heroku
heroku apps:info -a echatbot-production

# Aggiorna HEROKU_APP_NAME su GitHub secrets
```

### "Build Timeout"
```bash
# Aumenta timeout nel workflow (default 60min è OK)
# Se serve più tempo, aggiungi:
timeout-minutes: 90
```

---

## 💡 Best Practices

1. ✅ **Sempre testa in locale** prima di pushare
2. ✅ **Usa branch feature** per sviluppo
3. ✅ **PR review** prima di merge su main
4. ✅ **Monitora GitHub Actions** dopo ogni push
5. ✅ **Rollback veloce** se deploy rompe qualcosa:
   ```bash
   heroku rollback -a echatbot-production
   ```

---

## 🎯 Comandi Utili

```bash
# Vedi status ultimo workflow
gh run list --limit 1

# Vedi logs workflow
gh run view --log

# Re-run workflow fallito
gh run rerun [run-id]

# Disabilita workflow
gh workflow disable test-and-deploy.yml

# Riabilita workflow
gh workflow enable test-and-deploy.yml
```

---

## ✅ Checklist Setup

- [ ] File `.github/workflows/test-and-deploy.yml` committed
- [ ] Secret `HEROKU_API_KEY` aggiunto su GitHub
- [ ] Secret `HEROKU_APP_NAME` aggiunto su GitHub
- [ ] Secret `HEROKU_EMAIL` aggiunto su GitHub
- [ ] Push su main e verifica workflow parte
- [ ] Verifica test passano
- [ ] Verifica deploy completa
- [ ] Health check OK su `/health`

---

**Pronto! Ora ogni push su `main` → Auto-Deploy se test passano!** ✅
