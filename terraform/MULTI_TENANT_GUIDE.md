# 🏢 Multi-Tenant Architecture - Sottodomini Isolati

## 📋 Panoramica

**Obiettivo**: Replicare l'intera infrastruttura per ogni cliente con:
- ✅ Sottodominio dedicato (es: `altraita.echatbot.ai`)
- ✅ Repository GitHub separato
- ✅ Database PostgreSQL isolato
- ✅ Server EC2 dedicato
- ✅ Codice personalizzabile per cliente

---

## 🏗️ Architettura

```
echatbot.ai (BASE)
├── Repo: shopME
├── DB: echatbot-db-prod
├── EC2: echatbot-server-prod
└── S3: echatbot-frontend-prod

altraita.echatbot.ai (CLIENTE 1)
├── Repo: shopME-altraita (fork)
├── DB: echatbot-db-altraita
├── EC2: echatbot-server-altraita
└── S3: echatbot-frontend-altraita

cliente2.echatbot.ai (CLIENTE 2)
├── Repo: shopME-cliente2 (fork)
├── DB: echatbot-db-cliente2
├── EC2: echatbot-server-cliente2
└── S3: echatbot-frontend-cliente2
```

---

## 🚀 METODO 1: Terraform Workspaces (Consigliato)

### Vantaggi:
- ✅ Stesso codice Terraform
- ✅ Stato separato per ogni cliente
- ✅ Facile da gestire
- ✅ Costi isolati

### Come funziona:

```bash
# Workspace DEFAULT = echatbot.ai (prodotto base)
terraform workspace list
# * default

# Crea workspace per cliente
terraform workspace new altraita
terraform workspace new cliente2

# Cambia workspace
terraform workspace select altraita

# Deploy per cliente specifico
terraform apply -var="subdomain=altraita"
```

### File Terraform aggiornato:

```hcl
# terraform/variables.tf
variable "subdomain" {
  description = "Subdomain for this deployment"
  type        = string
  default     = ""  # Empty = echatbot.ai, "altraita" = altraita.echatbot.ai
}

variable "domain_name" {
  description = "Base domain"
  type        = string
  default     = "echatbot.ai"
}

# Computed values
locals {
  full_domain = var.subdomain == "" ? var.domain_name : "${var.subdomain}.${var.domain_name}"
  project_name = var.subdomain == "" ? "echatbot" : "echatbot-${var.subdomain}"
  workspace = terraform.workspace
}

# terraform/main.tf
resource "aws_instance" "shopme_server" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "t3.micro"
  
  tags = {
    Name        = "${local.project_name}-server"
    Environment = local.workspace
    Subdomain   = var.subdomain
  }
}

resource "aws_db_instance" "shopme_db" {
  identifier = "${local.project_name}-db"
  
  tags = {
    Name        = "${local.project_name}-db"
    Environment = local.workspace
    Subdomain   = var.subdomain
  }
}

resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.full_domain
  type    = "A"
  ttl     = 300
  records = [aws_instance.shopme_server.public_ip]
}
```

---

## 📝 STEP-BY-STEP: Deploy Nuovo Cliente

### STEP 1: Crea Repository Cliente

```bash
# 1. Fork repository base
cd /Users/gelso/workspace
git clone https://github.com/YOUR_USERNAME/shopME.git shopME-altraita
cd shopME-altraita

# 2. Crea nuovo repository su GitHub
gh repo create shopME-altraita --private --source=. --remote=origin --push

# 3. Personalizza codice per cliente
# - Logo cliente
# - Colori brand
# - Testi personalizzati
git add .
git commit -m "feat: personalizzazione altraita"
git push origin main
```

### STEP 2: Crea Workspace Terraform

```bash
# 1. Vai in terraform
cd /Users/gelso/workspace/shopME/terraform

# 2. Crea workspace per cliente
terraform workspace new altraita

# 3. Verifica workspace attivo
terraform workspace list
#   default
# * altraita

# 4. Crea file tfvars per cliente
cat > terraform.altraita.tfvars << EOF
subdomain    = "altraita"
domain_name  = "echatbot.ai"
project_name = "echatbot-altraita"

# Database
db_username = "echatbot_altraita"
db_password = "$(openssl rand -base64 24)"
db_name     = "echatbot_altraita"

# SSH (usa stessa chiave o generane una nuova)
ssh_public_key = "$(cat ~/.ssh/echatbot-key.pub)"
EOF
```

### STEP 3: Deploy Infrastruttura Cliente

```bash
# 1. Inizializza (se non fatto)
terraform init

# 2. Plan per cliente
terraform plan -var-file="terraform.altraita.tfvars"

# 3. Apply per cliente
terraform apply -var-file="terraform.altraita.tfvars"

# 4. Salva output
terraform output > ../terraform-outputs-altraita.txt
```

### STEP 4: Configura DNS Sottodominio

```bash
# DNS viene creato automaticamente da Terraform!
# Route 53 crea record: altraita.echatbot.ai → IP EC2 cliente

# Verifica
dig altraita.echatbot.ai +short
```

### STEP 5: Configura GitHub Secrets Cliente

```bash
# 1. Vai nel repository cliente
cd /Users/gelso/workspace/shopME-altraita

# 2. Configura secrets (stessi comandi, ma per repo cliente)
gh secret set DATABASE_URL --body "$(cd ../shopME/terraform && terraform output -raw database_url)"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set OPENROUTER_API_KEY --body "sk-or-v1-CLIENTE-KEY"
# ... tutti gli altri secrets

# 3. Verifica
gh secret list
```

### STEP 6: Deploy Applicazione Cliente

```bash
# 1. Crea GitHub Actions workflow (stesso file)
mkdir -p .github/workflows
cp ../shopME/.github/workflows/deploy.yml .github/workflows/

# 2. Aggiorna URL nel workflow
sed -i '' 's/echatbot.ai/altraita.echatbot.ai/g' .github/workflows/deploy.yml

# 3. Commit e push
git add .github/workflows/deploy.yml
git commit -m "feat: add deploy workflow"
git push origin main

# GitHub Actions fa il deploy automaticamente!
```

### STEP 7: Verifica Cliente Online

```bash
# Backend
curl https://altraita.echatbot.ai/health

# Frontend
open https://altraita.echatbot.ai
```

---

## 🔄 Gestione Multi-Cliente

### Switch tra clienti:

```bash
# Lista workspace
terraform workspace list
#   default
# * altraita
#   cliente2

# Switch a cliente specifico
terraform workspace select altraita

# Vedi risorse cliente
terraform state list

# Switch a produzione base
terraform workspace select default
```

### Aggiorna cliente specifico:

```bash
# 1. Switch workspace
terraform workspace select altraita

# 2. Modifica infrastruttura
terraform apply -var-file="terraform.altraita.tfvars"

# 3. Deploy codice
cd /Users/gelso/workspace/shopME-altraita
git push origin main  # GitHub Actions fa il resto
```

### Elimina cliente:

```bash
# 1. Switch workspace
terraform workspace select altraita

# 2. Distruggi infrastruttura
terraform destroy -var-file="terraform.altraita.tfvars"

# 3. Elimina workspace
terraform workspace select default
terraform workspace delete altraita

# 4. Elimina repository
cd /Users/gelso/workspace/shopME-altraita
gh repo delete shopME-altraita --yes
```

---

## 💰 Costi per Cliente

### Infrastruttura per cliente:
- **EC2 t3.micro**: ~€8/mese
- **RDS db.t3.micro**: ~€15/mese
- **S3 + CloudFront**: ~€2/mese
- **Route 53 hosted zone**: €0.50/mese
- **Totale**: ~€25-30/mese per cliente

### Ottimizzazione costi:

**Opzione 1: Condividi Database** (sconsigliato per isolamento)
```hcl
# Usa stesso RDS, database separati
resource "aws_db_instance" "shared_db" {
  identifier = "echatbot-shared-db"
  # Tutti i clienti usano questo, ma database diversi
}
```

**Opzione 2: EC2 più grande condiviso** (sconsigliato per isolamento)
```hcl
# Un EC2 t3.medium per tutti i clienti
# Nginx reverse proxy per routing
```

**Opzione 3: Infrastruttura dedicata** (consigliato) ✅
- Isolamento completo
- Scalabilità indipendente
- Nessun rischio cross-contamination

---

## 📊 Monitoring Multi-Cliente

### CloudWatch Dashboard per tutti i clienti:

```bash
# Crea dashboard aggregato
aws cloudwatch put-dashboard --dashboard-name echatbot-all-clients \
  --dashboard-body file://dashboard-config.json
```

### Tag-based billing:

```hcl
# Tutti i tag per cliente
resource "aws_instance" "shopme_server" {
  tags = {
    Project     = "echatbot"
    Client      = var.subdomain
    Environment = terraform.workspace
    CostCenter  = "client-${var.subdomain}"
  }
}
```

### Cost Explorer:
```bash
# Filtra costi per cliente
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --filter file://filter-altraita.json
```

---

## 🔐 Isolamento Sicurezza

### Ogni cliente ha:
- ✅ Database separato (no data leakage)
- ✅ EC2 separato (no resource contention)
- ✅ Security Groups dedicati
- ✅ IAM roles separati
- ✅ Secrets GitHub separati
- ✅ Repository Git separato

### Network isolation:
```hcl
# VPC separata per cliente (opzionale, più costoso)
resource "aws_vpc" "client_vpc" {
  cidr_block = "10.${var.client_id}.0.0/16"
  
  tags = {
    Name   = "${local.project_name}-vpc"
    Client = var.subdomain
  }
}
```

---

## 📋 Checklist Nuovo Cliente

- [ ] Repository GitHub creato (fork)
- [ ] Terraform workspace creato
- [ ] File terraform.CLIENTE.tfvars creato
- [ ] Infrastruttura deployata (`terraform apply`)
- [ ] DNS sottodominio verificato
- [ ] GitHub Secrets configurati
- [ ] GitHub Actions workflow creato
- [ ] Primo deploy completato
- [ ] Cliente online e funzionante
- [ ] Monitoring configurato
- [ ] Backup configurato

---

## 🆘 Troubleshooting Multi-Tenant

### Problema: Workspace sbagliato
```bash
# Verifica workspace attivo
terraform workspace show

# Se sbagliato, cambia
terraform workspace select NOME_CORRETTO
```

### Problema: Conflitto risorse
```bash
# Ogni risorsa deve avere nome unico
# Usa sempre: ${local.project_name}-resource-name
```

### Problema: Secrets cliente sbagliati
```bash
# Verifica repository attivo
git remote -v

# Verifica secrets
gh secret list

# Se sbagliati, riconfigura
gh secret set DATABASE_URL --body "VALORE_CORRETTO"
```

---

## 🎯 Best Practices

1. **Naming Convention**: `echatbot-{cliente}-{risorsa}`
2. **Tagging**: Sempre tag `Client` e `Environment`
3. **Backup**: Backup separati per cliente
4. **Monitoring**: Dashboard per cliente
5. **Costi**: Cost allocation tags
6. **Sicurezza**: Zero condivisione risorse
7. **Deploy**: GitHub Actions separati
8. **Secrets**: Mai condividere tra clienti

---

## 📚 Comandi Rapidi

```bash
# Nuovo cliente
terraform workspace new CLIENTE
terraform apply -var-file="terraform.CLIENTE.tfvars"

# Switch cliente
terraform workspace select CLIENTE

# Lista clienti
terraform workspace list

# Stato cliente
terraform state list

# Output cliente
terraform output

# Elimina cliente
terraform destroy -var-file="terraform.CLIENTE.tfvars"
terraform workspace delete CLIENTE
```
