# 🚀 Guida Produzione - Migrazioni Database

## ⚠️ CRITICAL: Migrazioni in Produzione = Irreversibili

**Una volta fai `npx prisma migrate deploy` in produzione, NON puoi più:**
- ❌ Reset database
- ❌ Revert migrations
- ❌ Tornare a schema precedente

**Se qualcosa va male: i dati rimangono.**

---

## 📋 Procedura Corretta per Produzione

### PRIMA di qualsiasi deploy in produzione:

#### Step 1: Creare Backup del Database
```bash
# Nel server produzione:
pg_dump -h localhost -p 5434 -U echatbotfy echatbotfy > backup_$(date +%Y%m%d_%H%M%S).sql

# Verifica backup è creato
ls -lh backup_*.sql

# 💡 Memorizza path: /var/backups/echatbot/backup_20260124_143000.sql
```

#### Step 2: Testare Migrazione Localmente PRIMA (CRITICO!)
```bash
# Nel tuo laptop con DB di test identico a produzione:

# 1. Clone schema da produzione
pg_dump -h prod.example.com -U echatbotfy echatbotfy --schema-only > schema.sql
psql -h localhost -p 5434 -U echatbotfy -d echatbotfy < schema.sql

# 2. Applica la migrazione locale
cd backend && npx prisma migrate deploy

# 3. Verifica dati rimangono intatti
npx prisma studio  # browser a localhost:5555
# Controlla: 10+ record in ogni tabella importantes

# 4. Se tutto OK → vai a Step 3
# Se errore → FIX lokale prima di toccare produzione
```

#### Step 3: Documentare Migrazione
```bash
# File: docs/deployments/migration_20260124.md
```
**migration_20260124.md:**
```markdown
# Migration: [Nome Descrittivo]

## Data: 2026-01-24
## Ambiente: Production

### Descrizione
- Schema changes: [es. Aggiunti 3 campi a Product table]
- Data migration: [es. Nessuna - solo schema]
- Breaking changes: [es. Campo 'sku' non nullable dal 24/1]
- Tempo stimato: 5 minuti
- Downtime: 2-3 minuti (durante apply)

### Rollback Plan
Se errore:
```bash
# 1. Stop application
systemctl stop echatbot-backend

# 2. Restore backup
psql -h localhost -p 5434 -U echatbotfy echatbotfy < backup_20260124_143000.sql

# 3. Restart
systemctl start echatbot-backend
```

### Pre-Flight Checklist
- [x] Tested locally
- [x] Backup taken
- [x] Communication sent to team
- [x] Scheduled window 02:00-02:30 UTC (no users)

### Post-Deployment
- [ ] Verify schema with: `npx prisma db push --dry-run`
- [ ] Check application logs: `tail -f /var/log/echatbot/backend.log`
- [ ] Smoke test: Login + create order
- [ ] Monitor for 1 hour
```
---

#### Step 4: Scegliere Finestra di Deploy
```
⚠️ SEMPRE in finestra a basso traffico:
- 02:00-02:30 UTC (middle of night global)
- Comunicare team 48h prima
- Preparare rollback procedure

❌ MAI: During business hours
❌ MAI: Venerdì pomeriggio
❌ MAI: Giorno prima weekend
```

#### Step 5: Eseguire Deploy
```bash
# 1. Connettiti al server produzione
ssh deploy@prod.example.com

# 2. Backup immediato (double-check)
pg_dump -h localhost -p 5434 -U echatbotfy echatbotfy > /var/backups/echatbot/backup_$(date +%Y%m%d_%H%M%S).sql
echo "✅ Backup created at: /var/backups/echatbot/backup_*.sql"

# 3. Stop applicazione
systemctl stop echatbot-backend echatbot-scheduler

# 4. Applica migrazione
cd /app/echatbot && npx prisma migrate deploy

# 5. Verifica stata
npx prisma db execute --stdin < << 'EOF'
SELECT COUNT(*) as total_products FROM "Product";
SELECT COUNT(*) as total_orders FROM "Order";
EOF
# Expected: numeri uguali a prima (nessun dato perso)

# 6. Riavvia applicazione
systemctl start echatbot-backend echatbot-scheduler

# 7. Verifica logs
tail -f /var/log/echatbot/backend.log
# Aspetta 30 secondi, verifica "✅ Connected to database"

# 8. Test manuale
curl -X POST http://localhost:3001/api/workspaces/test/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-product"}'
# Expected: 201 status

echo "✅ Migration deployed successfully"
```

---

## 📝 Tipi di Migrazioni per Produzione

### Tipo 1: Schema-Only (NO Data Impact)
```prisma
// Esempio: Aggiungi nuovo campo non-nullable con default
model Product {
  id       String  @id
  name     String
  sku      String  @default(cuid())  // ← NUOVO campo
}
```

**Procedura:**
```bash
npx prisma migrate dev --name add_sku_to_product
npx prisma migrate deploy  # ✅ Safe - default value fornito
```

**Risk Level:** 🟢 LOW

---

### Tipo 2: Data Migration (Richiede Attenzione)
```prisma
// Esempio: Rinominare colonna + popolare dati nuovi
model Product {
  // sku è nuovo nome per 'productCode'
  sku      String  
  // productCode rimosso
}
```

**Procedura:**
```bash
# 1. Backup
pg_dump ... > backup.sql

# 2. Crea migration
npx prisma migrate dev --name rename_productcode_to_sku

# 3. Apri migration file generato
cat prisma/migrations/xxx_rename_productcode_to_sku/migration.sql
# Dovrà contenere:
# ALTER TABLE "Product" RENAME COLUMN "productCode" TO "sku";

# 4. Verifica è corretta, poi deploy
npx prisma migrate deploy
```

**Risk Level:** 🟡 MEDIUM - Test prima!

---

### Tipo 3: Eliminare Colonna/Tabella (PERICOLO!)
```prisma
// ❌ Rimuovere campo da schema
model Product {
  id       String  @id
  name     String
  // deletedAt  String?  ← RIMOSSO
}
```

**STOP! PRIMA:**
1. Verifica che `deletedAt` non sia usato nel codice
   ```bash
   grep -r "deletedAt\|deleted_at" apps/backend/src
   # Se output → non rimuovere!
   ```

2. Verifica quanti record lo usano
   ```sql
   SELECT COUNT(*) FROM "Product" WHERE "deletedAt" IS NOT NULL;
   # Se > 0 → esportare dati prima di rimuovere
   ```

3. Se safe per rimuovere:
   ```bash
   npx prisma migrate dev --name remove_deletedAt_from_product
   npx prisma migrate deploy
   ```

**Risk Level:** 🔴 CRITICAL - 1 errore = dati persi!

---

## 🔄 Se Migrazione Fallisce in Produzione

### Step 1: FERMA TUTTO
```bash
# Interrompi applicazione
systemctl stop echatbot-backend echatbot-scheduler

# Verifica stato migration
npx prisma migrate status
# Expected: "Migration X is pending"
```

### Step 2: RESTORE Backup
```bash
# Restore database
psql -h localhost -p 5434 -U echatbotfy echatbotfy < /var/backups/echatbot/backup_20260124_143000.sql

# Verifica dati ripristinati
psql -h localhost -p 5434 -U echatbotfy -d echatbotfy -c "SELECT COUNT(*) FROM \"Product\";"

# Reset migration state
npx prisma migrate resolve --rolled-back add_new_field_migration_name
```

### Step 3: FIX Localmente
```bash
# Nel tuo laptop:
cd backend

# 1. Reset local DB to match restored state
npx prisma migrate reset --force

# 2. Identifica problema nella migration
cat prisma/migrations/xxx_add_new_field/migration.sql

# 3. Crea migration corretta
npx prisma migrate dev --name add_new_field_fixed

# 4. Test completo
npm run test:unit

# 5. Commit fix to git
git commit -am "Fix: Migration for adding new field"
```

### Step 4: DEPLOY FISSO
```bash
# Pull fix dal repo
git pull

# Deploy migration fissa
npx prisma migrate deploy

# Verifica
npx prisma studio
```

---

## 📊 Checklist Pre-Deploy

```markdown
### Migration: [Nome]

#### 48 Ore Prima
- [ ] Migration creata e testata localmente
- [ ] Team informato su data/ora deploy
- [ ] Backup procedure documentata
- [ ] Rollback plan preparato

#### 1 Ora Prima
- [ ] Deploy window confermato
- [ ] Backup recente di produzione
- [ ] SSH access verificato
- [ ] Tutti gli step documentati

#### Deploy
- [ ] Backup taken: backup_20260124_143000.sql
- [ ] Backend stopped
- [ ] Scheduler stopped
- [ ] Migration deployed: `npx prisma migrate deploy`
- [ ] Data integrity verified
- [ ] Backend started
- [ ] Scheduler started
- [ ] Logs checked (no errors)
- [ ] Smoke tests passed

#### Post-Deploy
- [ ] Monitor logs for 1 hour
- [ ] Check for ECONNREFUSED errors
- [ ] Verify user reports no issues
- [ ] Mark deployment as ✅ SUCCESS
```

---

## 🆘 Contatti Emergency

**Se migrazione fallisce:**

1. **Immediato**: Stop applicazione
   ```bash
   systemctl stop echatbot-backend echatbot-scheduler
   ```

2. **Restoration**: Restore database
   ```bash
   psql ... < backup.sql
   ```

3. **Communication**: Notify team
   ```
   Slack: "Database migration issue on [time]. Rolled back to [time]. ETA recovery: 15 minutes"
   ```

4. **Analysis**: Cosa è andato male?
   ```bash
   # Controlla migration file
   cat prisma/migrations/xxx/migration.sql
   
   # Controlla logs
   journalctl -u echatbot-backend -n 100
   ```

---

## ✅ Best Practices

1. **Sempre:** Backup → Test → Deploy → Monitor
2. **Mai:** Migrazioni durante business hours
3. **Mai:** Migrazioni senza rollback plan
4. **Mai:** Deploy il Venerdì
5. **Sempre:** Documenta reason + changes
6. **Sempre:** Team communication 48h prima
7. **Sempre:** Monitor 1+ ore dopo deploy
