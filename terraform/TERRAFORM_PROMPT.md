# 🏗️ Terraform AWS Infrastructure Prompt - eChatbot

## 📋 Contesto Progetto

**Nome**: eChatbot  
**Stack**: Node.js Backend + React Frontend + PostgreSQL  
**Porte**: Backend 3001, Frontend 3000  
**Dominio**: echatbot.ai (GoDaddy)

---

## 🏢 MULTI-TENANT ARCHITECTURE

### Strategia: Terraform Workspaces + Sottodomini Isolati

**Obiettivo**: Replicare infrastruttura completa per ogni cliente

```
echatbot.ai              → Prodotto base (workspace: default)
altraita.echatbot.ai     → Cliente 1 (workspace: altraita)  
cliente2.echatbot.ai     → Cliente 2 (workspace: cliente2)
```

### Ogni cliente ha:
- ✅ Sottodominio dedicato (`cliente.echatbot.ai`)
- ✅ Repository GitHub separato (fork di shopME)
- ✅ Database PostgreSQL isolato
- ✅ Server EC2 dedicato
- ✅ Codice personalizzabile (logo, colori, testi)
- ✅ Costi tracciabili (~€25/mese per cliente)
- ✅ Backup separati
- ✅ GitHub Secrets separati

### Comandi Multi-Tenant:

```bash
# Deploy prodotto base (echatbot.ai)
terraform workspace select default
terraform apply

# Crea nuovo cliente
terraform workspace new altraita
terraform apply -var-file="terraform.altraita.tfvars"
# Crea: altraita.echatbot.ai con infrastruttura dedicata

# Switch tra clienti
terraform workspace list
terraform workspace select altraita

# Elimina cliente
terraform workspace select altraita
terraform destroy -var-file="terraform.altraita.tfvars"
terraform workspace select default
terraform workspace delete altraita
```

### Workflow Nuovo Cliente (Step-by-Step):

```bash
# 1. Fork repository per cliente
cd /Users/gelso/workspace
git clone https://github.com/YOUR_USERNAME/shopME.git shopME-altraita
cd shopME-altraita
gh repo create shopME-altraita --private --source=. --remote=origin --push

# 2. Personalizza codice cliente (logo, colori, testi)
git commit -am "feat: personalizzazione altraita"
git push

# 3. Crea workspace Terraform
cd /Users/gelso/workspace/shopME/terraform
terraform workspace new altraita

# 4. Crea file terraform.altraita.tfvars
cat > terraform.altraita.tfvars << EOF
subdomain    = "altraita"
domain_name  = "echatbot.ai"
project_name = "echatbot-altraita"
db_username  = "echatbot_altraita"
db_password  = "$(openssl rand -base64 24)"
db_name      = "echatbot_altraita"
ssh_public_key = "$(cat ~/.ssh/echatbot-key.pub)"
EOF

# 5. Deploy infrastruttura cliente
terraform apply -var-file="terraform.altraita.tfvars"

# 6. Configura GitHub Secrets (repository cliente)
cd /Users/gelso/workspace/shopME-altraita
gh secret set DATABASE_URL --body "$(cd ../shopME/terraform && terraform output -raw database_url)"
# ... tutti gli altri 14 secrets

# 7. Deploy automatico
git push origin main  # GitHub Actions fa tutto

# 8. Verifica
curl https://altraita.echatbot.ai/health
```

### Costi per Cliente:
- **EC2 t3.micro**: ~€8/mese
- **RDS db.t3.micro**: ~€15/mese
- **S3 + CloudFront**: ~€2/mese
- **Route 53**: €0.50/mese
- **Totale**: ~€25-30/mese per cliente

### Isolamento Sicurezza:
- ✅ Database separato (no data leakage)
- ✅ EC2 separato (no resource contention)
- ✅ Security Groups dedicati
- ✅ Secrets GitHub separati
- ✅ Repository Git separato
- ✅ Backup separati

---

## 🎯 Cosa Deployare (Per Ogni Cliente)

1. **VPC + Networking** - Rete isolata
2. **EC2 Instance** - Backend Node.js + PM2
3. **RDS PostgreSQL** - Database dedicato
4. **Route 53** - DNS sottodominio
5. **ACM Certificate** - SSL automatico
6. **S3 Bucket** - Backup
7. **Security Groups** - Firewall

---

## 📦 Requisiti Minimi

### Database
- PostgreSQL 15
- db.t3.micro (Free Tier)
- 20GB storage
- Backup automatico 7 giorni

### Backend
- Ubuntu 22.04
- t3.micro (1GB RAM)
- Node.js 18 + PM2 + Nginx

### Networking
- VPC dedicata
- 2 subnet pubbliche
- 2 subnet private
- Internet Gateway

---

## 🔐 Secrets Management Strategy

### ⚠️ IMPORTANTE: Terraform NON gestisce secrets applicativi

**Separazione netta**:
- 🏗️ **Terraform**: Crea solo infrastruttura (EC2, RDS, VPC)
- 🔐 **GitHub Secrets**: Gestisce credenziali applicative
- 🚀 **GitHub Actions**: Genera `.env` su EC2 durante deploy

**Vantaggi**:
- ✅ Secrets mai nel codice Terraform
- ✅ Facile rotazione credenziali
- ✅ Deploy automatico ad ogni push
- ✅ Audit log su GitHub

### Lista Completa Secrets GitHub (14 totali):

| Secret Name | Valore | Dove prenderlo |
|-------------|--------|----------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | `terraform output -raw database_url` |
| `JWT_SECRET` | `a38fa4911b7fdb4aebe1911677792b35...` | Dal `.env` locale |
| `OPENROUTER_API_KEY` | `sk-or-v1-e297e258a59714296503647eff54fa43...` | Dal `.env` locale |
| `SMTP_USER` | `gelsogrove@gmail.com` | Dal `.env` locale |
| `SMTP_PASS` | `skvf saqx fryt xeem` | Dal `.env` locale |
| `GOOGLE_CLIENT_ID` | `988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln...` | Dal `.env` locale |
| `GOOGLE_CLIENT_SECRET` | `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` | Dal `.env` locale |
| `ADMIN_EMAIL` | `admin@echatbot.ai` | Dal `.env` locale |
| `ADMIN_PASSWORD` | `Venezia44` | Dal `.env` locale |
| `TOKEN_ENCRYPTION_KEY` | `193b20c983cfeca68ab22230a2097899efbb0574...` | Dal `.env` locale |
| `EC2_HOST` | IP pubblico | `terraform output -raw ec2_public_ip` |
| `EC2_SSH_KEY` | Chiave privata | `cat ~/.ssh/echatbot-key` |
| `AWS_ACCESS_KEY_ID` | `AKIAQC4U3MGFIUTN4JHJ` | Già disponibile |
| `AWS_SECRET_ACCESS_KEY` | `J9Cc074xEquBwga50mj3rOwQ7ceCPFTl9dC0FiYY` | Già disponibile |

### Setup GitHub Secrets (Dopo terraform apply):

```bash
# Configura tutti i secrets in un colpo
gh secret set DATABASE_URL --body "$(terraform output -raw database_url)"
gh secret set JWT_SECRET --body "a38fa4911b7fdb4aebe1911677792b35599ce990b13b563580e6fad1d2a120ea43e41ba630c9915822fe5bf92449e17a231b99168aa8b5cd18adce3b47b7f3d8"
gh secret set OPENROUTER_API_KEY --body "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"
gh secret set SMTP_USER --body "gelsogrove@gmail.com"
gh secret set SMTP_PASS --body "skvf saqx fryt xeem"
gh secret set GOOGLE_CLIENT_ID --body "988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com"
gh secret set GOOGLE_CLIENT_SECRET --body "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"
gh secret set ADMIN_EMAIL --body "admin@echatbot.ai"
gh secret set ADMIN_PASSWORD --body "Venezia44"
gh secret set TOKEN_ENCRYPTION_KEY --body "193b20c983cfeca68ab22230a2097899efbb0574bab7c43e6ec13b86a33edadc"
gh secret set EC2_HOST --body "$(terraform output -raw ec2_public_ip)"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set AWS_ACCESS_KEY_ID --body "AKIAQC4U3MGFIUTN4JHJ"
gh secret set AWS_SECRET_ACCESS_KEY --body "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"

# Verifica
gh secret list
```

---

## 🌍 Dominio e DNS

### Setup: GoDaddy → AWS Route 53

**Dominio**: `echatbot.ai` (registrato su GoDaddy)

**Processo**:
1. Terraform crea **Route53 Hosted Zone**
2. Terraform output mostra **4 nameservers AWS**
3. Tu copi i nameservers in **GoDaddy** (una volta)
4. Terraform gestisce tutti i **record DNS automaticamente**

### Dopo terraform apply:

```bash
# 1. Copia i nameservers
terraform output domain_nameservers

# Output esempio:
# [
#   "ns-123.awsdns-12.com",
#   "ns-456.awsdns-45.net",
#   "ns-789.awsdns-78.org",
#   "ns-012.awsdns-01.co.uk"
# ]

# 2. Vai su GoDaddy:
# - Login → My Products → echatbot.ai → DNS
# - Nameservers → Change → Custom
# - Incolla i 4 nameservers AWS
# - Save

# 3. Attendi propagazione DNS (15-60 minuti)
watch -n 300 'dig echatbot.ai +short'
```

### SSL Certificates (Automatico):
- Terraform crea certificati ACM
- Validazione DNS automatica
- HTTPS attivo dopo propagazione DNS

---

## 💾 Backup Strategy

### Backup Giornaliero Automatico:
- ✅ Database PostgreSQL (dump completo)
- ✅ S3 Uploads (file utenti)
- ✅ Retention: 7 giorni
- ✅ Storage: S3 bucket dedicato
- ✅ Cron job: 23:00 ogni giorno

### Script inclusi:
- `/opt/echatbot/scripts/backup-database.sh`
- `/opt/echatbot/scripts/backup-uploads.sh`

### Restore da backup:

```bash
# Lista backup disponibili
aws s3 ls s3://echatbot-backups-prod/database/

# Download e restore
aws s3 cp s3://echatbot-backups-prod/database/echatbot-db-2024-01-15.sql.gz .
gunzip echatbot-db-2024-01-15.sql.gz
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < echatbot-db-2024-01-15.sql
```

---

## 💰 Cost Monitoring & Alerts

### Budget Alert: €60/mese

Terraform configura:
- ✅ Alert al 80% (€48)
- ✅ Alert al 100% (€60)
- ✅ Alert forecast 120% (€72)
- ✅ Email notifiche

### CloudWatch Alarms:
- CPU > 80%
- Disk > 85%
- Database connections > 80

---

## 🔄 PM2 Process Manager

### Comandi Essenziali:

```bash
# Status
pm2 status
pm2 list

# Logs
pm2 logs
pm2 logs backend --lines 100

# Restart
pm2 restart all
pm2 restart backend

# Monitoring
pm2 monit

# Startup auto-restart
pm2 startup
pm2 save
```

**IMPORTANTE**: In produzione usa SEMPRE PM2, mai `npm run dev`!

---

## 🚀 GUIDA DEPLOY STEP-BY-STEP

### STEP 1: Prerequisiti (5 min)

```bash
# Installa tools
brew install terraform awscli gh

# Configura AWS CLI
aws configure
# Access Key ID: AKIAQC4U3MGFIUTN4JHJ
# Secret Access Key: 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
# Region: eu-west-1
# Output: json

# Genera SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/echatbot-key -N ""
```

### STEP 2: Deploy Infrastruttura (20 min)

```bash
# Vai in terraform directory
cd /Users/gelso/workspace/shopME/terraform

# Inizializza
terraform init

# Valida
terraform validate

# Vedi cosa verrà creato
terraform plan

# Crea infrastruttura (conferma con 'yes')
terraform apply

# Salva output
terraform output > ../terraform-outputs.txt
```

### STEP 3: Configura DNS GoDaddy (10 min)

```bash
# Copia nameservers
terraform output domain_nameservers

# Vai su GoDaddy e aggiorna nameservers
# Attendi propagazione (15-60 min)
```

### STEP 4: Setup GitHub Secrets (5 min)

```bash
# Login GitHub
gh auth login

# Configura tutti i secrets (copia-incolla tutto)
gh secret set DATABASE_URL --body "$(terraform output -raw database_url)"
gh secret set JWT_SECRET --body "a38fa4911b7fdb4aebe1911677792b35599ce990b13b563580e6fad1d2a120ea43e41ba630c9915822fe5bf92449e17a231b99168aa8b5cd18adce3b47b7f3d8"
gh secret set OPENROUTER_API_KEY --body "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"
gh secret set SMTP_USER --body "gelsogrove@gmail.com"
gh secret set SMTP_PASS --body "skvf saqx fryt xeem"
gh secret set GOOGLE_CLIENT_ID --body "988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com"
gh secret set GOOGLE_CLIENT_SECRET --body "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"
gh secret set ADMIN_EMAIL --body "admin@echatbot.ai"
gh secret set ADMIN_PASSWORD --body "Venezia44"
gh secret set TOKEN_ENCRYPTION_KEY --body "193b20c983cfeca68ab22230a2097899efbb0574bab7c43e6ec13b86a33edadc"
gh secret set EC2_HOST --body "$(terraform output -raw ec2_public_ip)"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set AWS_ACCESS_KEY_ID --body "AKIAQC4U3MGFIUTN4JHJ"
gh secret set AWS_SECRET_ACCESS_KEY --body "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"

# Verifica
gh secret list
```

### STEP 5: Setup EC2 (10 min)

```bash
# Connetti a EC2
EC2_IP=$(terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_IP

# Installa Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installa PM2
sudo npm install -g pm2

# Installa AWS CLI
sudo apt-get install -y awscli
aws configure  # Stesse credenziali

# Crea directory
sudo mkdir -p /opt/echatbot/{backend,uploads,scripts}
sudo chown -R ubuntu:ubuntu /opt/echatbot

# Configura PM2 startup
pm2 startup
# Esegui comando suggerito
pm2 save

# Esci
exit
```

### STEP 6: Crea GitHub Actions (5 min)

```bash
# Crea workflow file
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            cd /opt/echatbot/backend
            
            # Clone/update repo
            if [ ! -d ".git" ]; then
              git clone https://github.com/YOUR_USERNAME/shopME.git .
            else
              git pull origin main
            fi
            
            # Generate .env
            cat > .env << 'ENVFILE'
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            OPENROUTER_API_KEY=${{ secrets.OPENROUTER_API_KEY }}
            SMTP_HOST=smtp.gmail.com
            SMTP_PORT=465
            SMTP_SECURE=true
            SMTP_USER=${{ secrets.SMTP_USER }}
            SMTP_PASS=${{ secrets.SMTP_PASS }}
            SMTP_FROM=noreplay@echatbot.ai
            GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}
            GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}
            NODE_ENV=production
            PORT=3001
            CORS_ORIGIN=https://echatbot.ai
            FRONTEND_URL=https://echatbot.ai
            ADMIN_EMAIL=${{ secrets.ADMIN_EMAIL }}
            ADMIN_PASSWORD=${{ secrets.ADMIN_PASSWORD }}
            TOKEN_EXPIRATION=15m
            TOKEN_ENCRYPTION_KEY=${{ secrets.TOKEN_ENCRYPTION_KEY }}
            SKIP_HMAC_VERIFICATION=false
            ENVFILE
            
            chmod 600 .env
            npm install
            npx prisma generate
            npx prisma migrate deploy
            pm2 restart all || pm2 start npm --name "backend" -- run prod:backend
            pm2 save
EOF

# Sostituisci YOUR_USERNAME
sed -i '' 's/YOUR_USERNAME/il-tuo-username/g' .github/workflows/deploy.yml

# Commit e push
git add .github/workflows/deploy.yml
git commit -m "feat: add deploy workflow"
git push origin main
```

### STEP 7: Primo Deploy (5 min)

```bash
# Trigger deploy
gh workflow run deploy.yml

# Monitora
gh run watch

# Verifica
curl http://$(terraform output -raw ec2_public_ip):3001/health
```

### STEP 8: Verifica Finale

```bash
# Backend
curl https://echatbot.ai/health

# Frontend (dopo DNS propagato)
open https://echatbot.ai

# PM2 status
ssh -i ~/.ssh/echatbot-key ubuntu@$(terraform output -raw ec2_public_ip)
pm2 status
pm2 logs
exit
```

---

## 🎉 DEPLOY COMPLETATO!

### URL Attivi:
- **Frontend**: https://echatbot.ai
- **Backend API**: https://echatbot.ai/api
- **Admin Panel**: https://echatbot.ai/admin

### Deploy Successivi:
```bash
# Fai modifiche
git add .
git commit -m "feat: nuova feature"
git push origin main

# GitHub Actions fa tutto automaticamente!
```

---

## 📚 Documenti di Riferimento

- `DEPLOY_GUIDE.md` - Guida step-by-step dettagliata
- `ENV_MANAGEMENT.md` - Gestione variabili d'ambiente
- `MULTI_TENANT_GUIDE.md` - Architettura multi-cliente
- `terraform-outputs.txt` - Output Terraform (dopo apply)

---

## 🆘 Troubleshooting

### Terraform apply fallisce
```bash
aws sts get-caller-identity  # Verifica credenziali
```

### DNS non propaga
```bash
dig echatbot.ai NS +short  # Verifica nameservers
```

### GitHub Actions fallisce
```bash
gh secret list  # Verifica secrets (devono essere 14)
```

### Backend non risponde
```bash
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_IP
pm2 logs backend
pm2 restart backend
```
