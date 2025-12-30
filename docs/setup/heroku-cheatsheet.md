# 🚀 Heroku Deployment - Quick Reference

Comandi rapidi per deploy e gestione Heroku.

---

## 📋 Setup Iniziale (UNA VOLTA SOLA)

```bash
# 1. Login Heroku
heroku login

# 2. Crea app
heroku create echatbot-production

# 3. Aggiungi Postgres
heroku addons:create heroku-postgresql:mini -a echatbot-production

# 4. Configura storage (Cloudinary)
heroku config:set CLOUDINARY_URL='cloudinary://api_key:api_secret@cloud_name' -a echatbot-production

# 5. Configura security
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET=$(openssl rand -hex 64) \
  -a echatbot-production

# 6. Copia TUTTE le altre variabili da .env
./scripts/sync-env-to-heroku.sh echatbot-production
```

**OPPURE usa lo script automatico:**
```bash
./scripts/heroku-setup.sh
# Ti guida step-by-step con wizard interattivo
```

---

## 🚀 Deploy

```bash
# Deploy su Heroku
git push heroku main

# Oppure se il tuo branch è diverso
git push heroku your-branch:main
```

---

## 📊 Monitoring

```bash
# Logs in tempo reale
heroku logs --tail -a echatbot-production

# Solo errori
heroku logs --tail -a echatbot-production | grep ERROR

# Ultime 100 righe
heroku logs -n 100 -a echatbot-production

# Status app
heroku ps -a echatbot-production

# Apri app nel browser
heroku open -a echatbot-production
```

---

## ⚙️ Configurazione

```bash
# Lista tutte le variabili
heroku config -a echatbot-production

# Leggi una variabile specifica
heroku config:get JWT_SECRET -a echatbot-production

# Imposta una variabile
heroku config:set VARIABLE_NAME=value -a echatbot-production

# Rimuovi una variabile
heroku config:unset VARIABLE_NAME -a echatbot-production

# Sync tutte le variabili da .env locale
./scripts/sync-env-to-heroku.sh echatbot-production
```

---

## 🗄️ Database

```bash
# Info database
heroku pg:info -a echatbot-production

# Connetti al database (psql)
heroku pg:psql -a echatbot-production

# Backup database
heroku pg:backups:capture -a echatbot-production

# Lista backup
heroku pg:backups -a echatbot-production

# Download backup
heroku pg:backups:download -a echatbot-production

# Restore backup (ATTENZIONE: sovrascrive DB!)
heroku pg:backups:restore b001 DATABASE_URL -a echatbot-production

# Run migrations
heroku run "npx prisma migrate deploy" -a echatbot-production

# Run seed (ATTENZIONE: cancella dati!)
heroku run "ALLOW_DESTRUCTIVE_OPERATIONS=true npm run prisma:seed" -a echatbot-production
```

---

## 🔧 Troubleshooting

```bash
# Build fallito?
heroku logs --tail -a echatbot-production | grep "Build failed"

# App crasha?
heroku restart -a echatbot-production

# Controlla releases
heroku releases -a echatbot-production

# Rollback all'ultima versione funzionante
heroku rollback -a echatbot-production

# Esegui comando custom
heroku run "npm run build" -a echatbot-production

# Shell interattiva
heroku run bash -a echatbot-production
```

---

## 🔄 Aggiornamenti

```bash
# Deploy nuova versione
git add .
git commit -m "feat: new feature"
git push heroku main

# Build locale (test prima di deploy)
npm run build
NODE_ENV=production npm run start:all

# Verifica che funzioni in locale su http://localhost:3001
```

---

## 📈 Scaling

```bash
# Info dyno
heroku ps -a echatbot-production

# Upgrade dyno
heroku dyno:resize web=standard-1x -a echatbot-production  # $25/mese

# Scala orizzontalmente (più istanze)
heroku ps:scale web=2 -a echatbot-production

# Upgrade database
heroku addons:upgrade heroku-postgresql:standard-0 -a echatbot-production  # $50/mese
```

---

## 🔐 Security

```bash
# Rigenera JWT_SECRET (logout tutti gli utenti)
heroku config:set JWT_SECRET=$(openssl rand -hex 64) -a echatbot-production

# Lista tutte le variabili sensibili
heroku config -a echatbot-production | grep -E "SECRET|PASSWORD|TOKEN|KEY"

# Cambia admin password
heroku config:set ADMIN_PASSWORD="NewSecurePassword123!" -a echatbot-production
```

---

## 🗑️ Cleanup

```bash
# Elimina app (ATTENZIONE: permanente!)
heroku apps:destroy echatbot-production

# Rimuovi addon
heroku addons:destroy bucketeer -a echatbot-production
heroku addons:destroy heroku-postgresql -a echatbot-production
```

---

## 💡 Tips

1. **Always check logs first**: `heroku logs --tail -a echatbot-production`
2. **Test locally before deploy**: `npm run build && NODE_ENV=production npm run start:all`
3. **Backup DB before major changes**: `heroku pg:backups:capture -a echatbot-production`
4. **Use staging environment**: Create `echatbot-staging` for testing
5. **Monitor costs**: https://dashboard.heroku.com/account/billing

---

## 📚 Riferimenti

- **Heroku CLI Docs**: https://devcenter.heroku.com/articles/heroku-cli
- **Postgres Addon**: https://devcenter.heroku.com/articles/heroku-postgresql
- **Node.js on Heroku**: https://devcenter.heroku.com/articles/nodejs-support
- **Dashboard**: https://dashboard.heroku.com/
