# 🏗️ Terraform AWS Infrastructure - MVP Fase 1

## 📋 Contesto Progetto

**Nome**: eChatbot  
**Stack**: Node.js Backend + React Frontend + PostgreSQL  
**Fase**: MVP (Minimum Viable Product)  
**Budget**: €37/mese running, €9.60/mese paused

## 🎯 Architettura MVP (1 EC2 Unico)

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNET (Users)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌──────────────┐
│  CloudFront   │         │   Route53    │
│  (CDN + SSL)  │         │    (DNS)     │
│  Frontend     │         │              │
└───────┬───────┘         └──────┬───────┘
        │                        │
        ▼                        ▼
┌───────────────┐         ┌──────────────────────┐
│   S3 Bucket   │         │   Elastic IP (FISSO) │
│  (Frontend)   │         │   54.xxx.xxx.xxx     │
└───────────────┘         └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  EC2 t3.medium       │
                          │  (Public Subnet)     │
                          │  ├── Nginx (SSL)     │
                          │  ├── Node.js + PM2   │
                          │  └── PostgreSQL 15   │
                          └──────────────────────┘
```

## 🎯 Cosa Deployare

### 1. **EC2 - Server Unico** (€30/mese)
- **Tipo**: t3.medium (4GB RAM, 2 vCPU)
- **OS**: Ubuntu 22.04 LTS
- **Disco**: 30GB EBS gp3 (persistente)
- **Software**:
  - PostgreSQL 15 (database locale)
  - Node.js 18 + PM2 (backend + scheduler)
  - Nginx (reverse proxy + SSL)

### 2. **Elastic IP** (€0 running, €3.60 paused)
- IP pubblico fisso
- Non cambia mai (anche con pause/resume)
- Associato a EC2

### 3. **S3 Buckets** (€2/mese)
- Frontend: File React compilati
- Uploads: Immagini/file utenti
- Backups: Dump database + uploads (retention 7 giorni)

### 4. **CloudFront** (€1/mese)
- CDN globale per frontend
- SSL automatico (ACM)
- Cache per velocità

### 5. **Route53** (€0.50/mese)
- Hosted Zone per echatbot.ai
- Record DNS automatici

### 6. **VPC + Networking** (€0 - GRATIS)
- 1 VPC
- 1 Subnet pubblica
- 1 Internet Gateway
- 1 Security Group

### 7. **Monitoring** (€0 - GRATIS)
- CloudWatch Alarms (CPU, Disk)
- AWS Budgets (alert costi)

## ❌ Cosa NON Deployare

| Servizio | Perché NO | Risparmio |
|----------|-----------|-----------|
| ALB | Non serve con 1 EC2 | €18/mese |
| NAT Gateway | Non serve con 1 EC2 | €5/mese |
| RDS | PostgreSQL su EC2 | €15/mese |
| EC2 DB separato | Database su stesso EC2 | €15/mese |

**Totale risparmiato: €53/mese**

## 💰 Costi Dettagliati

### Running (EC2 Acceso 24/7)

| Servizio | Costo/mese | Note |
|----------|------------|------|
| EC2 t3.medium | €30.00 | 4GB RAM, 2 vCPU |
| EBS 30GB | €2.50 | Disco persistente |
| Elastic IP | €0.00 | Gratis se associato |
| S3 Storage | €2.00 | ~100GB |
| CloudFront | €1.00 | CDN |
| Route53 | €0.50 | DNS |
| Data Transfer | €1.00 | Traffico |
| **TOTALE** | **€37/mese** | **€444/anno** |

### Paused (EC2 Spento)

| Servizio | Costo/mese | Note |
|----------|------------|------|
| EC2 t3.medium | €0.00 | Spento |
| EBS 30GB | €2.50 | Dati preservati |
| Elastic IP | €3.60 | Associato ma EC2 spento |
| S3 Storage | €2.00 | Sempre attivo |
| CloudFront | €1.00 | Sempre attivo |
| Route53 | €0.50 | Sempre attivo |
| **TOTALE** | **€9.60/mese** | **€115/anno** |

**Risparmio con Pause: €27.40/mese (74%)**

## 🔐 Secrets Management

### GitHub Actions Secrets (8 secrets)

```bash
# Infrastructure
EC2_HOST=54.xxx.xxx.xxx              # Elastic IP (non cambia mai)
EC2_SSH_KEY=<contenuto echatbot-key.pem>
AWS_ACCESS_KEY_ID=<IAM user>
AWS_SECRET_ACCESS_KEY=<IAM secret>

# Application
DATABASE_URL=postgresql://echatbot:pass@localhost:5432/echatbot
JWT_SECRET=$(openssl rand -base64 32)
OPENROUTER_API_KEY=sk-or-v1-xxx
SMTP_PASS=<Gmail app password>
```

### Setup Secrets

```bash
gh secret set EC2_HOST --body "54.xxx.xxx.xxx"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set DATABASE_URL --body "postgresql://..."
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set OPENROUTER_API_KEY --body "sk-or-v1-xxx"
gh secret set SMTP_PASS --body "your-gmail-app-password"
```

## 🌍 Dominio e DNS

### Setup GoDaddy → AWS Route53

**Dominio**: echatbot.ai (registrato su GoDaddy)

### 1. Terraform Crea Hosted Zone

```hcl
resource "aws_route53_zone" "main" {
  name = "echatbot.ai"
}

output "nameservers" {
  value = aws_route53_zone.main.name_servers
}
```

### 2. Record DNS Automatici

```hcl
# Frontend (CloudFront)
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

# Backend (Elastic IP)
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.echatbot.ai"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app_server.public_ip]
}

resource "aws_route53_record" "admin" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "admin.echatbot.ai"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app_server.public_ip]
}
```

### 3. Setup GoDaddy

```bash
# 1. Esegui terraform
terraform apply

# 2. Copia nameservers
terraform output nameservers

# 3. Vai su GoDaddy:
# - Login → echatbot.ai → Manage DNS
# - Nameservers → Change → Custom
# - Incolla i 4 nameservers AWS
# - Save

# 4. Attendi propagazione (15-60 minuti)
dig echatbot.ai +short
```

## 🔒 SSL Certificates (ACM)

### Certificate per CloudFront (us-east-1)

```hcl
resource "aws_acm_certificate" "frontend" {
  provider          = aws.us_east_1
  domain_name       = "echatbot.ai"
  validation_method = "DNS"
  
  subject_alternative_names = ["www.echatbot.ai"]
  
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
```

### Certificate per Nginx (eu-west-1)

```hcl
resource "aws_acm_certificate" "backend" {
  domain_name       = "api.echatbot.ai"
  validation_method = "DNS"
  
  subject_alternative_names = ["admin.echatbot.ai"]
  
  lifecycle {
    create_before_destroy = true
  }
}
```

## 🖥️ EC2 Configuration

### Instance

```hcl
resource "aws_instance" "app" {
  ami           = "ami-0c55b159cbfafe1f0"  # Ubuntu 22.04
  instance_type = "t3.medium"
  
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  key_name              = var.ssh_key_name
  
  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    encrypted   = true
  }
  
  user_data = file("${path.module}/scripts/user-data.sh")
  
  tags = {
    Name = "echatbot-app-server"
  }
}
```

### Elastic IP

```hcl
resource "aws_eip" "app_server" {
  domain = "vpc"
  
  tags = {
    Name = "echatbot-app-eip"
  }
}

resource "aws_eip_association" "app_server" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app_server.id
}

output "elastic_ip" {
  value       = aws_eip.app_server.public_ip
  description = "IP pubblico fisso (non cambia mai)"
}
```

### Security Group

```hcl
resource "aws_security_group" "app" {
  name        = "echatbot-app-sg"
  description = "Security group for eChatbot app server"
  vpc_id      = aws_vpc.main.id
  
  # HTTP (redirect to HTTPS)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # SSH (solo da tuo IP)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_ip]
  }
  
  # Outbound (tutto)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### User Data Script

```bash
#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PostgreSQL 15
apt-get install -y postgresql-15 postgresql-contrib-15

# Install Nginx
apt-get install -y nginx

# Install PM2
npm install -g pm2

# Install AWS CLI
apt-get install -y awscli

# Create directories
mkdir -p /opt/echatbot/{backend,uploads,scripts}
mkdir -p /var/log/echatbot

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE USER echatbot WITH PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE echatbot OWNER echatbot;"
sudo -u postgres psql -c "ALTER USER echatbot WITH SUPERUSER;"

# Configure Nginx (placeholder)
cat > /etc/nginx/sites-available/echatbot << 'EOF'
server {
    listen 80;
    server_name api.echatbot.ai admin.echatbot.ai;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.echatbot.ai;
    
    ssl_certificate /etc/ssl/certs/echatbot.crt;
    ssl_certificate_key /etc/ssl/private/echatbot.key;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/echatbot /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

echo "✅ EC2 setup completed"
```

## 💾 Backup Strategy

### S3 Bucket per Backup

```hcl
resource "aws_s3_bucket" "backups" {
  bucket = "echatbot-backups-prod"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    id     = "delete-old-backups"
    status = "Enabled"
    
    expiration {
      days = 7
    }
  }
}
```

### Script Backup Database

```bash
#!/bin/bash
# /opt/echatbot/scripts/backup-database.sh
set -e

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="echatbot-db-$DATE.sql.gz"
S3_BUCKET="echatbot-backups-prod"

echo "🔄 Starting database backup: $BACKUP_FILE"

# Dump database
sudo -u postgres pg_dump echatbot | gzip > /tmp/$BACKUP_FILE

# Upload to S3
aws s3 cp /tmp/$BACKUP_FILE s3://$S3_BUCKET/database/$BACKUP_FILE

# Cleanup
rm /tmp/$BACKUP_FILE

echo "✅ Backup completed: s3://$S3_BUCKET/database/$BACKUP_FILE"
```

### Cron Job

```bash
# Aggiungi a crontab
crontab -e

# Database backup - ogni giorno alle 23:00
0 23 * * * /opt/echatbot/scripts/backup-database.sh >> /var/log/echatbot/backup.log 2>&1

# Uploads backup - ogni giorno alle 23:30
30 23 * * * /opt/echatbot/scripts/backup-uploads.sh >> /var/log/echatbot/backup.log 2>&1
```

## ⏸️ Pause/Resume Infrastructure

### GitHub Actions Workflows

#### 1. aws-pause.yml

```yaml
name: ⏸️ Pause AWS (Save €27/month)

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "PAUSE" to confirm'
        required: true

jobs:
  pause:
    runs-on: ubuntu-latest
    if: github.event.inputs.confirm == 'PAUSE'
    steps:
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1

      - name: Backup Before Pause
        run: |
          echo "🔄 Creating backup before pause..."
          # SSH to EC2 and run backup
          
      - name: Stop EC2
        run: |
          INSTANCE_ID=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=echatbot-app-server" \
            --query 'Reservations[0].Instances[0].InstanceId' \
            --output text)
          
          aws ec2 stop-instances --instance-ids $INSTANCE_ID
          echo "✅ EC2 stopped - Saving €27.40/month"
```

#### 2. aws-resume.yml

```yaml
name: ▶️ Resume AWS

on:
  workflow_dispatch:

jobs:
  resume:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1

      - name: Start EC2
        run: |
          INSTANCE_ID=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=echatbot-app-server" \
            --query 'Reservations[0].Instances[0].InstanceId' \
            --output text)
          
          aws ec2 start-instances --instance-ids $INSTANCE_ID
          aws ec2 wait instance-running --instance-ids $INSTANCE_ID
          
          echo "✅ EC2 started - Cost: €37/month"
```

## 💰 Cost Monitoring

### AWS Budget

```hcl
resource "aws_budgets_budget" "monthly" {
  name              = "echatbot-monthly-budget"
  budget_type       = "COST"
  limit_amount      = "60"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2024-01-01_00:00"
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["andrea_gelsomino@hotmail.com"]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["andrea_gelsomino@hotmail.com"]
  }
}
```

### CloudWatch Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "echatbot-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU > 80% for 10 minutes"
  
  dimensions = {
    InstanceId = aws_instance.app.id
  }
}
```

## 🚀 Deployment Guide

### Step 1: Prerequisites

```bash
# Install Terraform
brew install terraform

# Configure AWS CLI
aws configure

# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/echatbot-key
```

### Step 2: Terraform Apply

```bash
cd terraform

# Create tfvars
cat > terraform.tfvars << EOF
project_name   = "echatbot"
aws_region     = "eu-west-1"
domain_name    = "echatbot.ai"
alert_email    = "andrea_gelsomino@hotmail.com"
admin_ip       = "$(curl -s ifconfig.me)/32"
ssh_public_key = "$(cat ~/.ssh/echatbot-key.pub)"
EOF

# Initialize
terraform init

# Apply
terraform apply

# Save outputs
terraform output > outputs.txt
```

### Step 3: Setup GitHub Secrets

```bash
gh secret set EC2_HOST --body "$(terraform output -raw elastic_ip)"
gh secret set EC2_SSH_KEY --body "$(cat ~/.ssh/echatbot-key)"
gh secret set DATABASE_URL --body "postgresql://echatbot:pass@localhost:5432/echatbot"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
```

### Step 4: First Deploy

```bash
# Deploy
gh workflow run deploy.yml

# Verify
curl https://api.echatbot.ai/health
```

## 🔐 Variables

```hcl
variable "project_name" {
  default = "echatbot"
}

variable "aws_region" {
  default = "eu-west-1"
}

variable "domain_name" {
  default = "echatbot.ai"
}

variable "alert_email" {
  type = string
}

variable "admin_ip" {
  description = "Your IP for SSH access"
  type        = string
}

variable "ssh_public_key" {
  type = string
}
```
