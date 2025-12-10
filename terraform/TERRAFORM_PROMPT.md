# 🏗️ Terraform AWS Infrastructure Prompt

## 📋 Contesto Progetto

**Nome**: eChatbot  
**Stack**: Node.js Backend + React Frontend + PostgreSQL  
**Porte**: Backend 3001, Frontend 3000

## 🎯 Cosa Deployare

1. **RDS PostgreSQL** - Database
2. **EC2** - Backend Node.js
3. **S3 + CloudFront** - Frontend React
4. **VPC + Security Groups** - Networking
5. **ALB** - Load Balancer

## 📦 Requisiti Minimi

### Database
- PostgreSQL 15
- db.t3.micro (Free Tier)
- 20GB storage
- Backup 7 giorni

### Backend
- Ubuntu 22.04
- t3.small (2GB RAM)
- Node.js 18 + PM2 + Nginx

### Frontend
- S3 bucket static hosting
- CloudFront CDN
- SSL/TLS

## 🔐 Secrets Management Strategy

### Approccio: GitHub Actions Secrets (Semplice e Diretto)

**Vantaggi**:
- ✅ Tutto in un posto (GitHub)
- ✅ Nessun setup AWS aggiuntivo
- ✅ Deployment script più semplice
- ✅ Gratuito
- ✅ Facile da aggiornare

### 1. GitHub Actions Workflow (Genera .env durante deploy)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  workflow_dispatch: # Manual trigger only

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Backend to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            cd /opt/echatbot/backend
            
            # Download artifacts from S3
            aws s3 cp s3://echatbot-deployment-artifacts/backend-latest.tar.gz .
            tar -xzf backend-latest.tar.gz
            rm backend-latest.tar.gz
            
            # Install dependencies
            npm ci --production
            
            # Generate .env from GitHub secrets
            cat > .env << 'EOF'
            NODE_ENV=production
            PORT=3001
            
            # Database
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            
            # Authentication
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            JWT_EXPIRES_IN=7d
            
            # AI Integration
            OPENROUTER_API_KEY=${{ secrets.OPENROUTER_API_KEY }}
            
            # Email
            SMTP_HOST=smtp.gmail.com
            SMTP_PORT=587
            SMTP_USER=noreply@echatbot.ai
            SMTP_PASS=${{ secrets.SMTP_PASS }}
            
            # Frontend URL
            FRONTEND_URL=https://echatbot.ai
            
            # Uploads
            UPLOADS_DIR=/opt/echatbot/uploads
            MAX_FILE_SIZE=10485760
            EOF
            
            chmod 600 .env
            
            # Run database migrations
            npx prisma migrate deploy
            
            # Restart services
            pm2 restart backend
            pm2 restart scheduler
            
            echo "✅ Backend deployed successfully"
```

### 2. Setup Secrets in GitHub (Una Volta)

**Vai su: Repository → Settings → Secrets and Variables → Actions → New repository secret**

```bash
# Infrastructure Secrets
EC2_HOST=ec2-xx-xx-xx-xx.eu-west-1.compute.amazonaws.com
EC2_SSH_KEY=<contenuto completo di echatbot-key.pem>
AWS_ACCESS_KEY_ID=<IAM user per GitHub Actions>
AWS_SECRET_ACCESS_KEY=<IAM secret>

# Application Secrets
DATABASE_URL=postgresql://echatbot_admin:PASSWORD@db-host:5432/echatbot
JWT_SECRET=<genera con: openssl rand -base64 32>
OPENROUTER_API_KEY=sk-or-v1-your-real-key-here
SMTP_PASS=<Gmail app password: abcd efgh ijkl mnop>
```

### 3. Lista Completa Secrets GitHub

| Secret Name | Descrizione | Come Ottenerlo |
|-------------|-------------|----------------|
| `EC2_HOST` | IP pubblico EC2 | Terraform output dopo apply |
| `EC2_SSH_KEY` | Chiave SSH privata | Contenuto file `echatbot-key.pem` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | IAM user per GitHub Actions |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | IAM user secret |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT signing key | `openssl rand -base64 32` |
| `OPENROUTER_API_KEY` | OpenRouter API key | Dashboard OpenRouter |
| `SMTP_PASS` | Gmail app password | Google Account → Security → App passwords |

### 4. Generare JWT Secret

```bash
# Genera un secret sicuro
openssl rand -base64 32

# Output esempio:
# kX9mP2vL8nQ4rT6wY1zA3bC5dE7fG9hJ0iK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0d
```

### 5. Aggiornare Secrets

**Via GitHub UI:**
1. Repository → Settings → Secrets and Variables → Actions
2. Clicca sul secret da aggiornare
3. Update secret → Inserisci nuovo valore
4. Save

**Via GitHub CLI:**
```bash
# Installa gh CLI
brew install gh
gh auth login

# Aggiorna secret
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set OPENROUTER_API_KEY --body "sk-or-v1-new-key"

# Verifica secrets (mostra solo nomi, non valori)
gh secret list
```

### 6. Rotazione Secrets (Best Practice)

```bash
# 1. Genera nuovo secret
NEW_JWT=$(openssl rand -base64 32)

# 2. Aggiorna in GitHub
gh secret set JWT_SECRET --body "$NEW_JWT"

# 3. Redeploy
gh workflow run deploy.yml

# 4. Verifica che il backend sia ripartito
curl https://api.echatbot.ai/health
```

### 7. Backup Secrets (Locale, Criptato)

```bash
# Crea file secrets.txt (NON committare!)
cat > secrets.txt << EOF
DATABASE_URL=postgresql://...
JWT_SECRET=...
OPENROUTER_API_KEY=...
SMTP_PASS=...
EOF

# Cripta con GPG
gpg --symmetric --cipher-algo AES256 secrets.txt
# Output: secrets.txt.gpg (questo puoi salvare)

# Elimina file non criptato
rm secrets.txt

# Per decriptare in futuro
gpg --decrypt secrets.txt.gpg > secrets.txt
```

### 8. Security Best Practices

- ✅ **Mai committare secrets** nel codice
- ✅ **Rotazione periodica** (ogni 90 giorni)
- ✅ **Backup criptato** dei secrets
- ✅ **Accesso limitato** al repository (solo team necessario)
- ✅ **Audit log** - GitHub traccia chi modifica i secrets
- ✅ **Secrets separati** per staging/production

### 9. Troubleshooting

**Errore: "Secret not found"**
```bash
# Verifica che il secret esista
gh secret list

# Se manca, aggiungilo
gh secret set SECRET_NAME --body "value"
```

**Errore: "Invalid DATABASE_URL"**
```bash
# Formato corretto
postgresql://username:password@host:port/database

# Esempio
postgresql://echatbot_admin:MyPass123@echatbot-db.xxx.eu-west-1.rds.amazonaws.com:5432/echatbot
```

**Errore: "JWT verification failed"**
```bash
# Il JWT_SECRET è cambiato, rigenera e redeploy
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh workflow run deploy.yml
```

---

---

## 🌍 Dominio e DNS

### Setup: GoDaddy → AWS

**Dominio**: `echatbot.ai` (registrato su GoDaddy)

**Cosa fare**:
1. Terraform crea **Route53 Hosted Zone**
2. Tu copi i **nameservers AWS** in GoDaddy (una volta)
3. Terraform gestisce tutti i record DNS automaticamente

### 1. Terraform Crea Hosted Zone

```hcl
# terraform/modules/dns/main.tf
resource "aws_route53_zone" "main" {
  name = "echatbot.ai"
  
  tags = {
    Name        = "${var.project_name}-hosted-zone"
    Environment = "production"
  }
}

# Output nameservers da copiare in GoDaddy
output "nameservers" {
  value = aws_route53_zone.main.name_servers
  description = "Copia questi nameservers in GoDaddy"
}

# Record DNS automatici
resource "aws_route53_record" "frontend" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "echatbot.ai"
  type    = "A"
  
  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.echatbot.ai"
  type    = "CNAME"
  ttl     = 300
  records = ["echatbot.ai"]
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.echatbot.ai"
  type    = "A"
  
  alias {
    name                   = aws_lb.backend.dns_name
    zone_id                = aws_lb.backend.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "admin" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "admin.echatbot.ai"
  type    = "A"
  
  alias {
    name                   = aws_lb.backend.dns_name
    zone_id                = aws_lb.backend.zone_id
    evaluate_target_health = true
  }
}
```

### 2. Setup GoDaddy (Dopo terraform apply)

```bash
# 1. Esegui terraform
terraform apply

# 2. Copia i nameservers dall'output
terraform output nameservers
# Output:
# [
#   "ns-123.awsdns-12.com",
#   "ns-456.awsdns-45.net",
#   "ns-789.awsdns-78.org",
#   "ns-012.awsdns-01.co.uk"
# ]

# 3. Vai su GoDaddy:
# - Login → My Products → echatbot.ai → Manage DNS
# - Nameservers → Change → Custom
# - Incolla i 4 nameservers AWS
# - Save

# 4. Attendi propagazione DNS (15-60 minuti)
dig echatbot.ai +short
```

### 3. SSL Certificates (Automatico)

```hcl
# terraform/modules/ssl/main.tf

# Certificate per CloudFront (DEVE essere in us-east-1)
resource "aws_acm_certificate" "frontend" {
  provider          = aws.us_east_1
  domain_name       = "echatbot.ai"
  validation_method = "DNS"
  
  subject_alternative_names = [
    "www.echatbot.ai"
  ]
  
  lifecycle {
    create_before_destroy = true
  }
}

# Certificate per ALB (eu-west-1)
resource "aws_acm_certificate" "backend" {
  domain_name       = "api.echatbot.ai"
  validation_method = "DNS"
  
  subject_alternative_names = [
    "admin.echatbot.ai"
  ]
  
  lifecycle {
    create_before_destroy = true
  }
}

# Validazione automatica DNS
resource "aws_route53_record" "cert_validation_frontend" {
  for_each = {
    for dvo in aws_acm_certificate.frontend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  
  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "frontend" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation_frontend : record.fqdn]
}
```

---

## 💾 Backup Strategy

### Backup Giornaliero con Storico 7 Giorni

**Cosa viene backuppato**:
- ✅ Database PostgreSQL (dump completo)
- ✅ S3 Uploads (immagini, file)
- ✅ Retention: 7 giorni
- ✅ Storage: S3 bucket dedicato

### 1. S3 Bucket per Backup

```hcl
# terraform/modules/backup/main.tf
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-backups-prod"
  
  tags = {
    Name        = "${var.project_name}-backups"
    Environment = "production"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    id     = "delete-old-backups"
    status = "Enabled"
    
    expiration {
      days = 7  # Elimina backup dopo 7 giorni
    }
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  versioning_configuration {
    status = "Enabled"
  }
}
```

### 2. Script Backup Database

```bash
# /opt/echatbot/scripts/backup-database.sh
#!/bin/bash
set -e

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="echatbot-db-$DATE.sql.gz"
S3_BUCKET="echatbot-backups-prod"

echo "🔄 Starting database backup: $BACKUP_FILE"

# Leggi DATABASE_URL da .env
source /opt/echatbot/backend/.env

# Estrai credenziali da DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\(.*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\(.*\)/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\(.*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/.*:\(.*\)@.*/\1/p')

# Dump database
export PGPASSWORD="$DB_PASS"
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME | gzip > /tmp/$BACKUP_FILE

# Upload to S3
aws s3 cp /tmp/$BACKUP_FILE s3://$S3_BUCKET/database/$BACKUP_FILE

# Cleanup local file
rm /tmp/$BACKUP_FILE

echo "✅ Backup completed: s3://$S3_BUCKET/database/$BACKUP_FILE"
```

### 3. Script Backup Uploads

```bash
# /opt/echatbot/scripts/backup-uploads.sh
#!/bin/bash
set -e

DATE=$(date +%Y-%m-%d)
S3_BUCKET="echatbot-backups-prod"
UPLOADS_DIR="/opt/echatbot/uploads"

echo "🔄 Starting uploads backup"

# Sync uploads to S3 (incremental)
aws s3 sync $UPLOADS_DIR s3://$S3_BUCKET/uploads/$DATE/ \
  --delete \
  --storage-class STANDARD_IA

echo "✅ Uploads backup completed"
```

### 4. Cron Job (Ogni Giorno alle 23:00)

```bash
# Aggiungi a crontab su EC2
crontab -e

# Database backup - ogni giorno alle 23:00 (11 PM)
0 23 * * * /opt/echatbot/scripts/backup-database.sh >> /var/log/echatbot/backup.log 2>&1

# Uploads backup - ogni giorno alle 23:30 (11:30 PM)
30 23 * * * /opt/echatbot/scripts/backup-uploads.sh >> /var/log/echatbot/backup.log 2>&1
```

### 5. Restore da Backup

```bash
# Lista backup disponibili
aws s3 ls s3://echatbot-backups-prod/database/

# Download backup
aws s3 cp s3://echatbot-backups-prod/database/echatbot-db-2024-01-15_03-00-00.sql.gz .

# Restore database
gunzip echatbot-db-2024-01-15_03-00-00.sql.gz
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < echatbot-db-2024-01-15_03-00-00.sql

echo "✅ Database restored"
```

---

## 💰 Cost Monitoring & Alerts

### Budget Alert: €60/mese

```hcl
# terraform/modules/billing/main.tf
resource "aws_budgets_budget" "monthly_cost" {
  name              = "${var.project_name}-monthly-budget"
  budget_type       = "COST"
  limit_amount      = "60"
  limit_unit        = "USD"  # AWS usa USD, ~€60 = $65
  time_unit         = "MONTHLY"
  time_period_start = "2024-01-01_00:00"
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80  # Alert al 80% (€48)
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100  # Alert al 100% (€60)
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 120  # Alert al 120% (€72)
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
```

### CloudWatch Alarms

```hcl
# terraform/modules/monitoring/alarms.tf

# CPU Alta
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "${var.project_name}-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU > 80% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    InstanceId = aws_instance.app.id
  }
}

# Disk Pieno
resource "aws_cloudwatch_metric_alarm" "disk_full" {
  alarm_name          = "${var.project_name}-disk-full"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "disk_used_percent"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "Disk usage > 85%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Database Connection Errors
resource "aws_cloudwatch_metric_alarm" "db_connections" {
  alarm_name          = "${var.project_name}-db-connection-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Too many DB connections"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# SNS Topic per Email
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
```

---

## 🔄 PM2 Process Manager (Produzione)

### Cos'è PM2?

**PM2** gestisce i processi Node.js in produzione:
- ✅ **Auto-restart** se l'app crasha
- ✅ **Gestione logs** automatica con rotazione
- ✅ **Monitoring** CPU, memoria, uptime
- ✅ **Cluster mode** per scalare su più CPU
- ✅ **Startup script** per riavvio server

### Comandi PM2 Essenziali

```bash
# START - Prima volta o dopo stop
pm2 start ecosystem.config.js
pm2 start npm --name "backend" -- run prod

# RESTART - Dopo deploy (zero-downtime)
pm2 restart all
pm2 restart backend
pm2 restart scheduler

# RELOAD - Zero-downtime restart (cluster mode)
pm2 reload all

# STOP - Ferma processi
pm2 stop all
pm2 stop backend

# DELETE - Rimuove da PM2
pm2 delete all
pm2 delete backend

# STATUS - Vedi tutti i processi
pm2 status
pm2 list

# LOGS - Vedi logs in tempo reale
pm2 logs              # Tutti i processi
pm2 logs backend      # Solo backend
pm2 logs --lines 100  # Ultime 100 righe
pm2 logs --err        # Solo errori

# MONITORING - Dashboard interattiva
pm2 monit

# INFO - Dettagli processo
pm2 info backend
pm2 describe backend

# FLUSH - Pulisci logs vecchi
pm2 flush

# SAVE - Salva configurazione corrente
pm2 save

# STARTUP - Auto-start al riavvio server
pm2 startup
pm2 save
```

### PM2 vs npm run dev

| Feature | `npm run dev` | `pm2 start` |
|---------|---------------|-------------|
| **Uso** | Development | Production |
| **Hot-reload** | ✅ Sì | ❌ No |
| **Auto-restart** | ❌ No | ✅ Sì |
| **Cluster mode** | ❌ No | ✅ Sì |
| **Log management** | ❌ No | ✅ Sì |
| **Monitoring** | ❌ No | ✅ Sì |
| **Startup script** | ❌ No | ✅ Sì |

**IMPORTANTE**: In produzione usa SEMPRE PM2, mai `npm run dev`!

---

## 🚀 Guida Completa al Deployment

### Step 1: Prerequisiti

```bash
# 1. Installa Terraform
brew install terraform

# 2. Configura AWS CLI
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: eu-west-1
# Default output format: json

# 3. Genera SSH key per EC2
ssh-keygen -t rsa -b 4096 -f ~/.ssh/echatbot-key -C "echatbot-production"
# Salva la chiave in un posto sicuro!
```

### Step 2: Terraform Init & Apply

```bash
# 1. Vai nella directory terraform
cd terraform

# 2. Crea file terraform.tfvars
cat > terraform.tfvars << EOF
project_name = "echatbot"
aws_region   = "eu-west-1"
domain_name  = "echatbot.ai"
alert_email  = "andrea_gelsomino@hotmail.com"

# Database
db_username = "echatbot_admin"
db_password = "$(openssl rand -base64 24)"

# SSH
ssh_public_key = "$(cat ~/.ssh/echatbot-key.pub)"
EOF

# 3. Inizializza Terraform
terraform init

# 4. Valida configurazione
terraform validate

# 5. Vedi cosa verrà creato
terraform plan

# 6. Crea infrastruttura (15-20 minuti)
terraform apply
# Type 'yes' quando richiesto

# 7. Salva gli output importanti
terraform output > ../terraform-outputs.txt
```

### Step 3: Configura GoDaddy DNS

```bash
# 1. Copia i nameservers
terraform output nameservers

# 2. Vai su GoDaddy:
# - https://dcc.godaddy.com/manage/echatbot.ai/dns
# - Nameservers → Change → Custom
# - Incolla i 4 nameservers AWS
# - Save

# 3. Attendi propagazione (15-60 minuti)
watch -n 30 'dig echatbot.ai +short'
```

### Step 4: Setup EC2 (Prima Volta)

```bash
# 1. Connettiti a EC2
EC2_HOST=$(terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_HOST

# 2. Installa Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Installa PM2
sudo npm install -g pm2

# 4. Installa AWS CLI
sudo apt-get install -y awscli

# 5. Crea directory applicazione
sudo mkdir -p /opt/echatbot/{backend,uploads,scripts}
sudo chown -R ubuntu:ubuntu /opt/echatbot

# 6. Configura PM2 startup
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 7. Crea directory logs
sudo mkdir -p /var/log/echatbot
sudo chown ubuntu:ubuntu /var/log/echatbot

# 8. Crea script backup
cd /opt/echatbot/scripts
# Copia backup-database.sh e backup-uploads.sh
chmod +x *.sh

# 9. Configura cron
crontab -e
# Aggiungi:
# 0 23 * * * /opt/echatbot/scripts/backup-database.sh >> /var/log/echatbot/backup.log 2>&1
# 30 23 * * * /opt/echatbot/scripts/backup-uploads.sh >> /var/log/echatbot/backup.log 2>&1

# 10. Configura PM2 startup
pm2 startup
# Esegui il comando suggerito (con sudo)
pm2 save

# 11. Esci
exit
```

### Step 5: Setup GitHub Secrets

```bash
# 1. Installa GitHub CLI
brew install gh
gh auth login

# 2. Imposta secrets
gh secret set EC2_HOST --body "$(terraform output -raw ec2_public_ip)"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set AWS_ACCESS_KEY_ID --body "YOUR_AWS_KEY"
gh secret set AWS_SECRET_ACCESS_KEY --body "YOUR_AWS_SECRET"
gh secret set DATABASE_URL --body "$(terraform output -raw database_url)"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set OPENROUTER_API_KEY --body "sk-or-v1-YOUR-KEY"
gh secret set SMTP_PASS --body "YOUR_GMAIL_APP_PASSWORD"

# 3. Verifica
gh secret list
```

### Step 6: Primo Deploy

```bash
# 1. Crea migration logoUrl
cd packages/database
npx prisma migrate dev --name add_workspace_logo
git add prisma/migrations/
git commit -m "feat: add logoUrl to Workspace model"
git push origin main

# 2. Attendi CI build (GitHub Actions)
# Vai su: https://github.com/YOUR_REPO/actions

# 3. Deploy manuale
gh workflow run deploy.yml

# 4. Monitora deployment
gh run watch

# 5. Verifica che sia online
curl https://api.echatbot.ai/health
curl https://echatbot.ai
```

### Step 7: Verifica Tutto

```bash
# 1. Frontend
open https://echatbot.ai

# 2. Backend API
curl https://api.echatbot.ai/health

# 3. Admin Panel
open https://admin.echatbot.ai

# 4. Database
psql $(terraform output -raw database_url)
\dt  # Lista tabelle
\q

# 5. PM2 Status & Logs
ssh -i ~/.ssh/echatbot-key ubuntu@$EC2_HOST
pm2 list                    # Status
pm2 monit                   # Dashboard
pm2 logs backend --lines 50 # Logs
exit

# 6. Backup
aws s3 ls s3://echatbot-backups-prod/

# 7. Monitoring
open https://console.aws.amazon.com/cloudwatch/
```

---

## 🔐 Variabili Terraform

```hcl
# terraform/terraform.tfvars
project_name = "echatbot"
aws_region   = "eu-west-1"
domain_name  = "echatbot.ai"
alert_email  = "andrea_gelsomino@hotmail.com"

# Database
db_username = "echatbot_admin"
db_password = "GENERATE_STRONG_PASSWORD"
db_name     = "echatbot"

# SSH
ssh_public_key = "ssh-rsa AAAA... echatbot-production"
