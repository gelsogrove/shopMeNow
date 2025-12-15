# 🚀 Terraform AWS Deployment Guide

## 📋 Credenziali e Configurazione

### Account AWS
- **Account ID**: `006217752970`
- **Utente**: `gelso`
- **Access Key ID**: `AKIAQC4U3MGFIUTN4JHJ`
- **Secret Access Key**: `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`
- **Region**: `eu-west-1` (Irlanda)

### Database Credentials
- **Database**: `shopme`
- **Username**: `shopme_user`
- **Password**: `ShopMe2024!Secure`

### SSH Key
- **Private Key**: `~/.ssh/shopme-key`
- **Public Key**: `~/.ssh/shopme-key.pub`

## 🛠️ Setup e Deploy

### 1. Configura AWS CLI
```bash
cd /Users/gelso/workspace/shopME/terraform
aws configure
```

Inserisci:
- AWS Access Key ID: `AKIAQC4U3MGFIUTN4JHJ`
- AWS Secret Access Key: `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`
- Default region: `eu-west-1`
- Default output format: `json`

### 2. Inizializza Terraform
```bash
terraform init
```

### 3. Verifica il piano
```bash
terraform plan
```

### 4. Applica l'infrastruttura
```bash
terraform apply
```

### 5. Connettiti al server
```bash
ssh -i ~/.ssh/shopme-key ec2-user@[IP_PUBBLICO]
```

## 🏗️ Infrastruttura Creata

### Risorse AWS
- **VPC**: `shopme-vpc` (10.0.0.0/16)
- **Subnets**: 
  - Public: `10.0.1.0/24`, `10.0.2.0/24`
  - Private: `10.0.3.0/24`, `10.0.4.0/24`
- **EC2**: `t3.micro` (Amazon Linux 2023)
- **RDS**: `db.t3.micro` PostgreSQL 15.4
- **Security Groups**: Web + Database
- **Internet Gateway**: Per accesso pubblico

### Porte Aperte
- **22**: SSH
- **80**: HTTP
- **443**: HTTPS
- **3000**: Frontend React
- **3001**: Backend API
- **5432**: PostgreSQL (solo da EC2)

## 💰 Costi Stimati
- **EC2 t3.micro**: ~€8/mese (free tier 12 mesi)
- **RDS db.t3.micro**: ~€15/mese
- **Storage**: ~€2/mese
- **Totale**: ~€25/mese

## 🔧 Post-Deploy

### Accesso alle Applicazioni
- **Frontend**: `http://[IP_PUBBLICO]:3000`
- **Backend**: `http://[IP_PUBBLICO]:3001`
- **SSH**: `ssh -i ~/.ssh/shopme-key ec2-user@[IP_PUBBLICO]`

### Deploy del Codice
```bash
# Connettiti al server
ssh -i ~/.ssh/shopme-key ec2-user@[IP_PUBBLICO]

# Esegui il deploy
./deploy.sh
```

### Configurazione Ambiente
Il file `.env` è già configurato con:
- Database URL
- JWT Secret
- Configurazioni SMTP
- Variabili di produzione

### Servizi Attivi
- **PM2**: Gestione processi Node.js
- **Nginx**: Reverse proxy
- **Docker**: Per servizi aggiuntivi

## 🔐 Sicurezza

### File Protetti (.gitignore)
- `*.tfvars` (credenziali)
- `.env` (variabili ambiente)
- `*.tfstate` (stato Terraform)
- `*.key`, `*.pem` (chiavi SSH)

### Accesso SSH
- Solo tramite chiave privata
- Nessun accesso password
- Porta 22 aperta (considera cambiarla in produzione)

## 🚨 Comandi Utili

### Terraform
```bash
# Vedi stato attuale
terraform show

# Distruggi tutto
terraform destroy

# Aggiorna risorse
terraform apply -auto-approve

# Vedi output
terraform output
```

### AWS CLI
```bash
# Lista istanze EC2
aws ec2 describe-instances

# Lista database RDS
aws rds describe-db-instances

# Vedi security groups
aws ec2 describe-security-groups
```

### Server Management
```bash
# Stato servizi
pm2 status

# Log applicazioni
pm2 logs

# Restart servizi
pm2 restart all

# Nginx status
sudo systemctl status nginx
```

## 🔄 Backup e Manutenzione

### Database Backup
```bash
# Backup automatico RDS (7 giorni retention)
# Backup manuale
aws rds create-db-snapshot --db-instance-identifier shopme-db --db-snapshot-identifier shopme-backup-$(date +%Y%m%d)
```

### Aggiornamenti
```bash
# Aggiorna codice
cd /home/ec2-user/shopme
git pull origin main
npm run build
pm2 restart all
```

## 📞 Troubleshooting

### Problemi Comuni
1. **Connessione SSH fallita**: Verifica security group e chiave SSH
2. **Database non raggiungibile**: Controlla security group database
3. **Applicazione non risponde**: Verifica PM2 status e logs
4. **Nginx errori**: Controlla configurazione in `/etc/nginx/conf.d/`

### Log Files
- **Setup**: `/var/log/shopme-setup.log`
- **Nginx**: `/var/log/nginx/error.log`
- **PM2**: `pm2 logs`
- **Sistema**: `journalctl -u nginx`