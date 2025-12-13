# 🔐 Gestione Variabili d'Ambiente - Strategia Completa

## 📋 Panoramica

**Problema**: Come gestire le variabili d'ambiente in modo sicuro tra sviluppo e produzione?

**Soluzione**: 3 livelli separati
1. **Locale** (`.env` in repo) - Development
2. **GitHub Secrets** - CI/CD
3. **EC2** (`.env` generato) - Production

---

## 🏠 LIVELLO 1: Development (.env locale)

### File: `.env` (root del progetto)

```bash
# ⚠️ QUESTO FILE È GIÀ NEL .gitignore - NON VIENE COMMITTATO

# Database locale (Docker)
DATABASE_URL="postgresql://echatbotfy:echatbotfy@localhost:5434/echatbotfy?schema=public"

# JWT
JWT_SECRET="a38fa4911b7fdb4aebe1911677792b35599ce990b13b563580e6fad1d2a120ea43e41ba630c9915822fe5bf92449e17a231b99168aa8b5cd18adce3b47b7f3d8"

# OpenRouter
OPENROUTER_API_KEY="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"

# SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="gelsogrove@gmail.com"
SMTP_PASS="skvf saqx fryt xeem"
SMTP_FROM="noreplay@echatbot.ai"

# Google OAuth
GOOGLE_CLIENT_ID="988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"

# App Config
NODE_ENV="development"
PORT="3001"
CORS_ORIGIN="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"
ADMIN_EMAIL="admin@echatbot.ai"
ADMIN_PASSWORD="Venezia44"

# Security
TOKEN_EXPIRATION="15m"
TOKEN_ENCRYPTION_KEY="193b20c983cfeca68ab22230a2097899efbb0574bab7c43e6ec13b86a33edadc"
SKIP_HMAC_VERIFICATION="true"
```

---

## 🔐 LIVELLO 2: GitHub Secrets (CI/CD)

### Setup una volta sola

```bash
# Installa GitHub CLI
brew install gh
gh auth login

# Imposta tutti i secrets
gh secret set DATABASE_URL --body "postgresql://echatbot_admin:PASSWORD@echatbot-db.xxx.rds.amazonaws.com:5432/echatbot"
gh secret set JWT_SECRET --body "a38fa4911b7fdb4aebe1911677792b35599ce990b13b563580e6fad1d2a120ea43e41ba630c9915822fe5bf92449e17a231b99168aa8b5cd18adce3b47b7f3d8"
gh secret set OPENROUTER_API_KEY --body "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"
gh secret set SMTP_HOST --body "smtp.gmail.com"
gh secret set SMTP_PORT --body "465"
gh secret set SMTP_SECURE --body "true"
gh secret set SMTP_USER --body "gelsogrove@gmail.com"
gh secret set SMTP_PASS --body "skvf saqx fryt xeem"
gh secret set SMTP_FROM --body "noreplay@echatbot.ai"
gh secret set GOOGLE_CLIENT_ID --body "988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com"
gh secret set GOOGLE_CLIENT_SECRET --body "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"
gh secret set ADMIN_EMAIL --body "admin@echatbot.ai"
gh secret set ADMIN_PASSWORD --body "Venezia44"
gh secret set TOKEN_ENCRYPTION_KEY --body "193b20c983cfeca68ab22230a2097899efbb0574bab7c43e6ec13b86a33edadc"

# Secrets per SSH/Deploy
gh secret set EC2_HOST --body "$(terraform output -raw ec2_public_ip)"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set AWS_ACCESS_KEY_ID --body "AKIAQC4U3MGFIUTN4JHJ"
gh secret set AWS_SECRET_ACCESS_KEY --body "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"

# Verifica
gh secret list
```

### Lista completa secrets GitHub

| Secret Name | Valore da usare | Dove prenderlo |
|-------------|-----------------|----------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Terraform output dopo apply |
| `JWT_SECRET` | `a38fa4911b7fdb4aebe1911677792b35...` | Dal tuo `.env` locale |
| `OPENROUTER_API_KEY` | `sk-or-v1-e297e258a59714296503647eff54fa43...` | Dal tuo `.env` locale |
| `SMTP_HOST` | `smtp.gmail.com` | Dal tuo `.env` locale |
| `SMTP_PORT` | `465` | Dal tuo `.env` locale |
| `SMTP_SECURE` | `true` | Dal tuo `.env` locale |
| `SMTP_USER` | `gelsogrove@gmail.com` | Dal tuo `.env` locale |
| `SMTP_PASS` | `skvf saqx fryt xeem` | Dal tuo `.env` locale |
| `SMTP_FROM` | `noreplay@echatbot.ai` | Dal tuo `.env` locale |
| `GOOGLE_CLIENT_ID` | `988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln...` | Dal tuo `.env` locale |
| `GOOGLE_CLIENT_SECRET` | `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` | Dal tuo `.env` locale |
| `ADMIN_EMAIL` | `admin@echatbot.ai` | Dal tuo `.env` locale |
| `ADMIN_PASSWORD` | `Venezia44` | Dal tuo `.env` locale |
| `TOKEN_ENCRYPTION_KEY` | `193b20c983cfeca68ab22230a2097899efbb0574...` | Dal tuo `.env` locale |
| `EC2_HOST` | IP pubblico EC2 | `terraform output ec2_public_ip` |
| `EC2_SSH_KEY` | Chiave SSH privata | `cat ~/.ssh/echatbot-key` |
| `AWS_ACCESS_KEY_ID` | `AKIAQC4U3MGFIUTN4JHJ` | Già ce l'hai |
| `AWS_SECRET_ACCESS_KEY` | `J9Cc074xEquBwga50mj3rOwQ7ceCPFTl9dC0FiYY` | Già ce l'hai |

---

## ☁️ LIVELLO 3: Production (.env su EC2)

### Generato automaticamente da GitHub Actions

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Build backend
        run: |
          cd apps/backend
          npm ci --production
          npm run build
      
      - name: Build frontend
        run: |
          cd apps/frontend
          npm ci
          npm run build
      
      - name: Upload to S3
        run: |
          aws s3 sync apps/frontend/dist s3://echatbot-frontend-prod/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      
      - name: Deploy backend to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            
            # Stop services
            pm2 stop all || true
            
            # Backup old version
            cd /opt/echatbot
            [ -d backend ] && mv backend backend.backup.$(date +%Y%m%d_%H%M%S)
            
            # Create new directory
            mkdir -p backend
            cd backend
            
            # Download from S3 (uploaded by previous step)
            aws s3 cp s3://echatbot-deployment/backend-latest.tar.gz .
            tar -xzf backend-latest.tar.gz
            rm backend-latest.tar.gz
            
            # Generate .env from GitHub Secrets
            cat > .env << 'EOF'
            # Database
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            
            # JWT
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            JWT_EXPIRES_IN=7d
            
            # OpenRouter
            OPENROUTER_API_KEY=${{ secrets.OPENROUTER_API_KEY }}
            
            # SMTP
            SMTP_HOST=${{ secrets.SMTP_HOST }}
            SMTP_PORT=${{ secrets.SMTP_PORT }}
            SMTP_SECURE=${{ secrets.SMTP_SECURE }}
            SMTP_USER=${{ secrets.SMTP_USER }}
            SMTP_PASS=${{ secrets.SMTP_PASS }}
            SMTP_FROM=${{ secrets.SMTP_FROM }}
            
            # Google OAuth
            GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}
            GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}
            
            # App Config
            NODE_ENV=production
            PORT=3001
            CORS_ORIGIN=https://echatbot.ai
            FRONTEND_URL=https://echatbot.ai
            ADMIN_EMAIL=${{ secrets.ADMIN_EMAIL }}
            ADMIN_PASSWORD=${{ secrets.ADMIN_PASSWORD }}
            
            # Security
            TOKEN_EXPIRATION=15m
            TOKEN_ENCRYPTION_KEY=${{ secrets.TOKEN_ENCRYPTION_KEY }}
            SKIP_HMAC_VERIFICATION=false
            EOF
            
            chmod 600 .env
            
            # Run migrations
            npx prisma migrate deploy
            
            # Restart services
            pm2 restart all || pm2 start ecosystem.config.js
            pm2 save
            
            echo "✅ Deploy completed successfully"
```

---

## 🔄 Workflow Completo

### 1️⃣ **Prima volta** (Setup iniziale)

```bash
# 1. Terraform crea infrastruttura
cd terraform
terraform init
terraform apply

# 2. Salva output
terraform output > ../terraform-outputs.txt

# 3. Configura GitHub Secrets (copia da .env locale)
gh secret set DATABASE_URL --body "$(terraform output -raw database_url)"
gh secret set JWT_SECRET --body "$(grep JWT_SECRET ../.env | cut -d'=' -f2 | tr -d '\"')"
gh secret set OPENROUTER_API_KEY --body "$(grep OPENROUTER_API_KEY ../.env | cut -d'=' -f2 | tr -d '\"')"
# ... tutti gli altri secrets

# 4. Primo deploy manuale
git push origin main
# GitHub Actions fa tutto automaticamente
```

### 2️⃣ **Deploy successivi** (Automatico)

```bash
# Fai modifiche al codice
git add .
git commit -m "feat: nuova feature"
git push origin main

# GitHub Actions:
# 1. Build backend + frontend
# 2. Upload artifacts su S3
# 3. SSH su EC2
# 4. Genera .env da secrets
# 5. Deploy + restart PM2
```

### 3️⃣ **Aggiornare un secret**

```bash
# Esempio: cambiare OPENROUTER_API_KEY
gh secret set OPENROUTER_API_KEY --body "sk-or-v1-NEW-KEY"

# Redeploy
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

---

## 🛡️ Sicurezza

### ✅ Cosa è protetto

- `.env` locale → `.gitignore` ✅
- `terraform.tfvars` → `.gitignore` ✅
- GitHub Secrets → Criptati da GitHub ✅
- `.env` su EC2 → `chmod 600` (solo owner) ✅

### ❌ Mai fare

- ❌ Committare `.env` nel repo
- ❌ Hardcodare secrets nel codice
- ❌ Condividere secrets via chat/email
- ❌ Usare stessi secrets per dev/prod

---

## 📝 Checklist Setup

- [ ] `.env` locale configurato
- [ ] Terraform apply completato
- [ ] GitHub Secrets configurati (tutti i 17 secrets)
- [ ] `.github/workflows/deploy.yml` creato
- [ ] Primo deploy testato
- [ ] Verificato che `.env` su EC2 sia corretto
- [ ] PM2 running e logs ok

---

## 🆘 Troubleshooting

### Errore: "Secret not found"
```bash
# Verifica che il secret esista
gh secret list

# Se manca, aggiungilo
gh secret set SECRET_NAME --body "value"
```

### Errore: "Permission denied" su .env
```bash
# SSH su EC2
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_HOST

# Verifica permessi
ls -la /opt/echatbot/backend/.env
# Dovrebbe essere: -rw------- (600)

# Se sbagliato, correggi
chmod 600 /opt/echatbot/backend/.env
```

### Errore: "DATABASE_URL invalid"
```bash
# Formato corretto
postgresql://username:password@host:port/database

# Esempio
postgresql://echatbot_admin:MyPass123@echatbot-db.xxx.eu-west-1.rds.amazonaws.com:5432/echatbot

# Aggiorna secret
gh secret set DATABASE_URL --body "postgresql://..."
```
