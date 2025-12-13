# 🚀 Guida Deploy Step-by-Step - eChatbot

## 📋 Panoramica

Questa guida ti accompagna **passo dopo passo** nel deploy completo di eChatbot su AWS.

**Tempo stimato**: 45-60 minuti  
**Costo mensile**: ~€50-60

---

## ✅ STEP 1: Verifica Prerequisiti (5 min)

### Controlla di avere:

```bash
# 1. Terraform installato
terraform --version
# Se manca: brew install terraform

# 2. AWS CLI installato
aws --version
# Se manca: brew install awscli

# 3. GitHub CLI installato
gh --version
# Se manca: brew install gh

# 4. Node.js 18+
node --version
# Se manca: brew install node@18

# 5. Git configurato
git config --global user.name
git config --global user.email
```

### ✅ Checklist:
- [ ] Terraform installato
- [ ] AWS CLI installato
- [ ] GitHub CLI installato
- [ ] Node.js 18+ installato
- [ ] Account AWS attivo
- [ ] Repository GitHub creato
- [ ] Dominio echatbot.ai su GoDaddy

**Tutto ok? Procedi allo STEP 2**

---

## 🔐 STEP 2: Configura AWS CLI (5 min)

```bash
# Configura credenziali AWS
aws configure

# Inserisci quando richiesto:
# AWS Access Key ID: AKIAQC4U3MGFIUTN4JHJ
# AWS Secret Access Key: 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
# Default region name: eu-west-1
# Default output format: json
```

### Verifica configurazione:
```bash
# Test connessione AWS
aws sts get-caller-identity

# Dovresti vedere:
# {
#   "UserId": "...",
#   "Account": "006217752970",
#   "Arn": "arn:aws:iam::006217752970:user/gelso"
# }
```

### ✅ Checklist:
- [ ] AWS CLI configurato
- [ ] Test connessione riuscito
- [ ] Account ID: 006217752970

**Tutto ok? Procedi allo STEP 3**

---

## 🔑 STEP 3: Genera SSH Key (2 min)

```bash
# Genera chiave SSH per EC2
ssh-keygen -t rsa -b 4096 -f ~/.ssh/echatbot-key -N ""

# Verifica che sia stata creata
ls -la ~/.ssh/echatbot-key*

# Dovresti vedere:
# ~/.ssh/echatbot-key      (chiave privata)
# ~/.ssh/echatbot-key.pub  (chiave pubblica)
```

### ⚠️ IMPORTANTE:
**Salva la chiave privata in un posto sicuro!** Se la perdi, non potrai più accedere al server.

### ✅ Checklist:
- [ ] Chiave SSH generata
- [ ] File ~/.ssh/echatbot-key esiste
- [ ] File ~/.ssh/echatbot-key.pub esiste

**Tutto ok? Procedi allo STEP 4**

---

## 🏗️ STEP 4: Deploy Infrastruttura con Terraform (20 min)

```bash
# 1. Vai nella directory terraform
cd /Users/gelso/workspace/shopME/terraform

# 2. Inizializza Terraform
terraform init

# Dovresti vedere:
# "Terraform has been successfully initialized!"

# 3. Valida configurazione
terraform validate

# Dovresti vedere:
# "Success! The configuration is valid."

# 4. Vedi cosa verrà creato (IMPORTANTE: leggi l'output!)
terraform plan

# Dovresti vedere ~20 risorse da creare:
# - VPC, Subnets, Internet Gateway
# - Security Groups
# - EC2 Instance
# - RDS Database
# - Route 53 Hosted Zone
# - ACM Certificate

# 5. Crea l'infrastruttura (conferma con 'yes')
terraform apply

# ⏱️ Questo richiede 15-20 minuti
# AWS sta creando:
# - Database PostgreSQL (più lento)
# - Server EC2
# - Networking
# - DNS
```

### Durante l'apply vedrai:

```
aws_vpc.shopme_vpc: Creating...
aws_vpc.shopme_vpc: Creation complete after 3s
aws_subnet.public_subnet_1: Creating...
...
aws_db_instance.shopme_db: Still creating... [10m0s elapsed]
...
Apply complete! Resources: 20 added, 0 changed, 0 destroyed.
```

### 6. Salva gli output IMPORTANTI:

```bash
# Salva tutti gli output in un file
terraform output > ../terraform-outputs.txt

# Visualizza output principali
terraform output ec2_public_ip
terraform output database_endpoint
terraform output domain_nameservers

# Copia questi valori, ti serviranno dopo!
```

### ✅ Checklist:
- [ ] `terraform init` completato
- [ ] `terraform validate` ok
- [ ] `terraform apply` completato (20 risorse create)
- [ ] Output salvati in terraform-outputs.txt
- [ ] IP pubblico EC2 copiato
- [ ] Nameservers Route 53 copiati

**Tutto ok? Procedi allo STEP 5**

---

## 🌐 STEP 5: Configura DNS su GoDaddy (10 min)

```bash
# 1. Copia i nameservers AWS
terraform output domain_nameservers

# Output esempio:
# [
#   "ns-123.awsdns-12.com",
#   "ns-456.awsdns-45.net",
#   "ns-789.awsdns-78.org",
#   "ns-012.awsdns-01.co.uk"
# ]
```

### 2. Vai su GoDaddy:

1. **Login**: https://dcc.godaddy.com
2. **My Products** → **echatbot.ai** → **DNS**
3. **Nameservers** → **Change** → **Custom**
4. **Incolla i 4 nameservers AWS** (uno per riga)
5. **Save**

### 3. Attendi propagazione DNS (15-60 minuti):

```bash
# Controlla propagazione ogni 5 minuti
watch -n 300 'dig echatbot.ai +short'

# Quando vedi l'IP pubblico EC2, è pronto!
```

### ✅ Checklist:
- [ ] Nameservers copiati da Terraform
- [ ] Nameservers aggiornati su GoDaddy
- [ ] DNS propagato (dig mostra IP EC2)

**Tutto ok? Procedi allo STEP 6**

---

## 🐙 STEP 6: Configura GitHub Secrets (10 min)

```bash
# 1. Login GitHub CLI
gh auth login
# Seleziona: GitHub.com → HTTPS → Login with browser

# 2. Vai nella directory del progetto
cd /Users/gelso/workspace/shopME

# 3. Configura TUTTI i secrets (copia-incolla tutto insieme)
gh secret set DATABASE_URL --body "$(cd terraform && terraform output -raw database_url)"
gh secret set JWT_SECRET --body "a38fa4911b7fdb4aebe1911677792b35599ce990b13b563580e6fad1d2a120ea43e41ba630c9915822fe5bf92449e17a231b99168aa8b5cd18adce3b47b7f3d8"
gh secret set OPENROUTER_API_KEY --body "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"
gh secret set SMTP_USER --body "gelsogrove@gmail.com"
gh secret set SMTP_PASS --body "skvf saqx fryt xeem"
gh secret set GOOGLE_CLIENT_ID --body "988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com"
gh secret set GOOGLE_CLIENT_SECRET --body "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"
gh secret set ADMIN_EMAIL --body "admin@echatbot.ai"
gh secret set ADMIN_PASSWORD --body "Venezia44"
gh secret set TOKEN_ENCRYPTION_KEY --body "193b20c983cfeca68ab22230a2097899efbb0574bab7c43e6ec13b86a33edadc"
gh secret set EC2_HOST --body "$(cd terraform && terraform output -raw ec2_public_ip)"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set AWS_ACCESS_KEY_ID --body "AKIAQC4U3MGFIUTN4JHJ"
gh secret set AWS_SECRET_ACCESS_KEY --body "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"

# 4. Verifica che siano stati creati (dovresti vederne 14)
gh secret list
```

### ✅ Checklist:
- [ ] GitHub CLI autenticato
- [ ] 14 secrets configurati
- [ ] `gh secret list` mostra tutti i secrets

**Tutto ok? Procedi allo STEP 7**

---

## 📝 STEP 7: Crea GitHub Actions Workflow (5 min)

```bash
# 1. Crea directory
mkdir -p .github/workflows

# 2. Crea file deploy.yml
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            
            # Create app directory
            sudo mkdir -p /opt/echatbot/backend
            sudo chown -R ubuntu:ubuntu /opt/echatbot
            
            # Clone or update repository
            cd /opt/echatbot/backend
            if [ ! -d ".git" ]; then
              git clone https://github.com/YOUR_USERNAME/shopME.git .
            else
              git pull origin main
            fi
            
            # Generate .env from GitHub Secrets
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
            
            # Install dependencies
            npm install
            
            # Run database migrations
            npx prisma generate
            npx prisma migrate deploy
            
            # Restart services
            pm2 restart all || pm2 start npm --name "backend" -- run prod:backend
            pm2 save
            
            echo "✅ Deploy completed"
EOF

# 3. Sostituisci YOUR_USERNAME con il tuo username GitHub
# Apri il file e modifica manualmente:
nano .github/workflows/deploy.yml
# Oppure usa sed:
sed -i '' 's/YOUR_USERNAME/il-tuo-username-github/g' .github/workflows/deploy.yml

# 4. Commit e push
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow"
git push origin main
```

### ✅ Checklist:
- [ ] Directory .github/workflows creata
- [ ] File deploy.yml creato
- [ ] Username GitHub sostituito
- [ ] File committato e pushato

**Tutto ok? Procedi allo STEP 8**

---

## 🖥️ STEP 8: Setup Iniziale EC2 (10 min)

```bash
# 1. Connettiti al server EC2
EC2_IP=$(cd terraform && terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_IP

# Ora sei dentro il server EC2!

# 2. Installa Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Installa PM2
sudo npm install -g pm2

# 4. Installa AWS CLI
sudo apt-get install -y awscli

# 5. Configura AWS CLI (per backup S3)
aws configure
# Inserisci le stesse credenziali di prima

# 6. Crea directory applicazione
sudo mkdir -p /opt/echatbot/{backend,uploads,scripts}
sudo chown -R ubuntu:ubuntu /opt/echatbot

# 7. Configura PM2 startup (auto-restart al riavvio)
pm2 startup
# Copia ed esegui il comando suggerito (inizia con 'sudo env PATH=...')

# 8. Esci dal server
exit
```

### ✅ Checklist:
- [ ] Connessione SSH riuscita
- [ ] Node.js 18 installato
- [ ] PM2 installato
- [ ] AWS CLI configurato
- [ ] Directory /opt/echatbot creata
- [ ] PM2 startup configurato

**Tutto ok? Procedi allo STEP 9**

---

## 🚀 STEP 9: Primo Deploy (5 min)

```bash
# 1. Trigger deploy manuale da GitHub
gh workflow run deploy.yml

# 2. Monitora il deploy
gh run watch

# Vedrai:
# ✓ Checkout code
# ✓ Setup Node.js
# ✓ Deploy to EC2
# ✓ Deploy completed

# 3. Verifica che sia online
curl http://$EC2_IP:3001/health

# Dovresti vedere:
# {"status":"ok"}
```

### Se ci sono errori:

```bash
# Connettiti al server e controlla i logs
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_IP
pm2 logs backend
pm2 status
```

### ✅ Checklist:
- [ ] Deploy GitHub Actions completato
- [ ] Backend risponde su porta 3001
- [ ] PM2 mostra processo "backend" online

**Tutto ok? Procedi allo STEP 10**

---

## ✅ STEP 10: Verifica Finale (5 min)

```bash
# 1. Backend API
curl https://api.echatbot.ai/health
# Dovrebbe rispondere: {"status":"ok"}

# 2. Frontend (dopo DNS propagato)
open https://echatbot.ai

# 3. Database
EC2_IP=$(cd terraform && terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_IP
cd /opt/echatbot/backend
npx prisma studio
# Apri http://localhost:5555 (port forward)

# 4. PM2 Status
pm2 list
pm2 monit

# 5. Logs
pm2 logs backend --lines 50

# 6. Esci
exit
```

### ✅ Checklist Finale:
- [ ] Backend API risponde
- [ ] Frontend carica (dopo DNS)
- [ ] Database accessibile
- [ ] PM2 processi running
- [ ] Logs senza errori

---

## 🎉 DEPLOY COMPLETATO!

### 🌐 URL Attivi:
- **Frontend**: https://echatbot.ai
- **Backend API**: https://api.echatbot.ai
- **Admin Panel**: https://admin.echatbot.ai

### 📊 Monitoring:
- **AWS Console**: https://console.aws.amazon.com
- **GitHub Actions**: https://github.com/YOUR_REPO/actions
- **PM2**: `ssh ubuntu@$EC2_IP` → `pm2 monit`

### 🔄 Deploy Successivi:
```bash
# Fai modifiche al codice
git add .
git commit -m "feat: nuova feature"
git push origin main

# GitHub Actions fa tutto automaticamente!
```

---

## 🆘 Troubleshooting

### Problema: Terraform apply fallisce
```bash
# Controlla credenziali AWS
aws sts get-caller-identity

# Controlla permessi IAM user
# Deve avere: PowerUserAccess, IAMFullAccess
```

### Problema: DNS non propaga
```bash
# Controlla nameservers
dig echatbot.ai NS +short

# Devono essere quelli AWS (ns-xxx.awsdns-xx.com)
# Se no, ricontrolla GoDaddy
```

### Problema: GitHub Actions fallisce
```bash
# Controlla secrets
gh secret list

# Devono essere 14 secrets
# Se mancano, riesegui STEP 6
```

### Problema: Backend non risponde
```bash
# SSH su EC2
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_IP

# Controlla PM2
pm2 status
pm2 logs backend

# Controlla .env
cat /opt/echatbot/backend/.env

# Restart manuale
pm2 restart backend
```

---

## 📞 Supporto

**Hai problemi?** Controlla:
1. Logs GitHub Actions
2. Logs PM2 su EC2
3. CloudWatch Logs su AWS
4. terraform-outputs.txt

**Tutto funziona?** 🎉 Congratulazioni!
