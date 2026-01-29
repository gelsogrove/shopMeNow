# 🚀 Deploy Production Script

## Uso

```bash
bash scripts/deploy-production.sh
```

## Cosa fa lo script

Lo script ti guida interattivamente attraverso tutti i passaggi necessari per un deploy sicuro in produzione:

### 1️⃣ Check Git Status
- Verifica se ci sono modifiche non committate
- Opzione per committare con messaggio custom
- Opzione RESET per scartare modifiche (con doppia conferma)

### 2️⃣ Check Branch
- Verifica che sei su `main`
- Permette deploy da altri branch con conferma

### 3️⃣ Database Migration
- Chiede se devi eseguire migrazioni Prisma
- Mostra preview SQL delle modifiche
- Esegue `prisma migrate deploy` su Heroku (con conferma)

### 4️⃣ Prisma Generate
- Chiede se rigenerare Prisma client
- Esegue `npx prisma generate` se necessario

### 5️⃣ Run Tests
- Opzionale: esegue `npm run test:unit`
- Blocca deploy se test falliscono (con override opzionale)

### 6️⃣ Build Check
- Test build locale di backend e frontend
- Verifica che il codice compili correttamente

### 7️⃣ Environment Check
- Verifica esistenza `.env`
- Controlla presenza variabili critiche:
  - `DATABASE_URL`
  - `OPENROUTER_API_KEY`
  - `JWT_SECRET`

### 8️⃣ Heroku Check
- Verifica connessione a `echatbot-app`

### 9️⃣ Final Confirmation
- Mostra riepilogo deploy:
  - App target
  - Branch corrente
  - Ultimo commit
- **Doppia conferma** prima del deploy

### 🔟 Deploy
- Esegue `git push heroku main`
- Mostra output completo

### 1️⃣1️⃣ Post-Deployment
- Opzione per vedere logs in tempo reale
- Riepilogo finale con timestamp e URL app

## Safety Features

✅ **Exit on error**: Script si ferma al primo errore  
✅ **Double confirmation**: Reset e migrations richiedono doppia conferma  
✅ **Preview SQL**: Mostra modifiche database prima di applicarle  
✅ **Test guard**: Blocca deploy se test falliscono  
✅ **Build verification**: Verifica che il codice compili  
✅ **Environment validation**: Controlla variabili critiche  

## Esempio Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 PRODUCTION DEPLOYMENT WIZARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 STEP 1: Checking git status...
⚠️  You have uncommitted changes:
 M .github/copilot-instructions.md
 A scripts/deploy-production.sh

Do you want to commit these changes? [y/n]: y
Enter commit message: feat: Add interactive deployment script
✅ Changes committed

📋 STEP 2: Checking current branch...
Current branch: main
✅ On main branch

📋 STEP 3: Database migration check...
Do you need to run Prisma MIGRATE in production? [y/n]: n
✅ No migrations needed

📋 STEP 4: Prisma client generation...
Do you need to regenerate Prisma client? [y/n]: n
✅ Using existing Prisma client

📋 STEP 5: Running tests...
Run unit tests before deploy? [y/n]: y
🧪 Running backend tests...
✅ All tests passed (1655 passed)

📋 STEP 6: Build verification...
Test build locally before deploy? [y/n]: y
🔨 Building backend...
✅ Backend builds successfully
🔨 Building frontend...
✅ Frontend builds successfully

📋 STEP 7: Environment check...
✅ .env file exists
✅ Critical environment variables present

📋 STEP 8: Heroku connection check...
✅ Connected to Heroku app: echatbot-app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  FINAL CONFIRMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are about to deploy to PRODUCTION:
  • App: echatbot-app
  • Branch: main
  • Last commit: abc1234 - feat: Add interactive deployment script

🚀 DEPLOY TO PRODUCTION NOW? [y/n]: y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 DEPLOYING TO PRODUCTION...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[...Heroku deploy output...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DEPLOYMENT COMPLETED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View Heroku logs now? [y/n]: y
[...logs in real-time...]

📝 Deployment summary:
  • Time: Wed Jan 29 23:45:00 CET 2026
  • Branch: main
  • Commit: abc1234 - feat: Add interactive deployment script
  • App URL: https://echatbot-app-1cba28556df2.herokuapp.com/

🎉 Have a great day, Andrea!
```

## Note

- Lo script usa colori per output leggibile
- Ogni step può essere saltato se non necessario
- Doppia conferma per operazioni pericolose
- Exit su errore per prevenire deploy parziali
