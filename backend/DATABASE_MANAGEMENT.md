# 📦 Database Management Scripts

Andrea, questi script ti permettono di gestire il database senza perdere i dati!

## 🎯 Script Disponibili

### 1. **Seed Completo** (Cancella tutto e ricrea)

```bash
npm run seed
```

- ⚠️ **ATTENZIONE**: Cancella TUTTI i dati
- Usa solo per setup iniziale o reset completo
- Crea workspace, categorie, prodotti, utenti di test

### 2. **Seed Incrementale** (CONSIGLIATO) ✅

```bash
npm run seed:update
```

- ✅ **NON cancella** dati esistenti
- ✅ Aggiorna solo se necessario (nome, prezzo, descrizione)
- ✅ Preserva immagini, isActive, stock modificati manualmente
- ✅ Sicuro da eseguire più volte
- ✅ Aggiunge nuovi prodotti/categorie se mancanti

**Quando usarlo:**

- Dopo aver modificato `categories.ts` o `products.ts`
- Per sincronizzare nuovi prodotti dal seed
- Quando vuoi aggiornare descrizioni/prezzi base

**Cosa preserva:**

- Immagini caricate manualmente
- Stock modificato tramite admin
- Status isActive cambiato tramite UI
- Ordini, clienti, chat, feedback

### 3. **Backup Database**

```bash
npm run db:backup
```

- 💾 Crea un backup completo del database
- 📁 Salvato in `backend/backups/backup-YYYY-MM-DD.sql`
- 📊 Mostra dimensione e lista backup disponibili

**Quando usarlo:**

- Prima di fare seed completo
- Prima di modifiche importanti
- Ogni settimana per sicurezza
- Prima di deployment

### 4. **Restore Database**

```bash
npm run db:restore backup-2025-10-15.sql
```

- 🔄 Ripristina database da backup
- ⚠️ Sovrascrive database corrente
- ⏱️ 5 secondi di attesa per annullare

---

## 📋 Workflow Consigliato

### Scenario 1: Aggiornare Prodotti da Seed

```bash
# 1. Modifica backend/prisma/data/products.ts
# 2. Esegui seed incrementale
npm run seed:update

# Risultato: Solo prodotti modificati vengono aggiornati
# Le tue foto e modifiche manuali restano intatte!
```

### Scenario 2: Backup Prima di Reset Completo

```bash
# 1. Backup database corrente
npm run db:backup

# 2. Reset completo (se necessario)
npm run seed

# 3. Se qualcosa va male, ripristina
npm run db:restore backup-2025-10-15.sql
```

### Scenario 3: Backup Settimanale

```bash
# Ogni lunedì mattina
npm run db:backup

# Conserva gli ultimi 5 backup automaticamente
```

---

## 🔍 Dettagli Tecnici

### Seed Incrementale - Logica di Aggiornamento

**Categorie:**

- Ricerca per `slug` + `workspaceId`
- Aggiorna se `name` o `description` cambiano
- Crea se non esiste

**Prodotti:**

- Ricerca per `ProductCode` + `workspaceId`
- Aggiorna se cambiano:
  - `name`
  - `description`
  - `price`
  - `stock`
  - `formato`
  - `categoryId`
- **NON aggiorna**:
  - `imageUrl` (preserva foto caricate)
  - `isActive` (preserva stato attivo/inattivo)
  - Ordini collegati

---

## ⚠️ Avvertenze

### Seed Completo (`npm run seed`)

- ❌ Cancella TUTTO (workspace, ordini, clienti, chat)
- ❌ Perde foto caricate
- ❌ Perde modifiche manuali
- ✅ Usa SOLO per setup iniziale

### Seed Incrementale (`npm run seed:update`)

- ✅ Sicuro per produzione
- ✅ Preserva dati importanti
- ⚠️ Richiede workspace esistente (esegui `npm run seed` la prima volta)

### Backup/Restore

- 💾 Backup include TUTTO (100% fedele)
- ⚠️ Restore SOVRASCRIVE database
- 📁 Backup non versionati in git (troppo grandi)

---

## 🎯 Esempi Pratici

### Esempio 1: Aggiungere 10 Nuovi Prodotti

```bash
# 1. Aggiungi prodotti in backend/prisma/data/products.ts

# 2. Esegui seed incrementale
npm run seed:update

# Output:
# 📦 Products: 10 created, 0 updated, 0 skipped
```

### Esempio 2: Aggiornare Prezzo di Prodotto Esistente

```bash
# 1. Modifica price in products.ts

# 2. Esegui seed incrementale
npm run seed:update

# Output:
# 📦 Products: 0 created, 1 updated, 44 no changes
```

### Esempio 3: Reset Completo con Backup

```bash
# 1. Backup attuale
npm run db:backup
# Output: backup-2025-10-15T14-30-00.sql (12.5 MB)

# 2. Reset completo
npm run seed

# 3. Se serve ripristinare
npm run db:restore backup-2025-10-15T14-30-00.sql
```

---

## 📊 Monitoraggio

### Check Prodotti nel DB

```bash
# Lista prodotti
cd backend
npx prisma studio
# Apre UI su http://localhost:5555
```

### Query Manuali

```bash
docker exec -it shop_db psql -U shopmefy -d shopmefy

# Conta prodotti
SELECT COUNT(*) FROM "Products";

# Lista categorie
SELECT name, COUNT(*) as products
FROM "Categories" c
LEFT JOIN "Products" p ON p."categoryId" = c.id
GROUP BY c.name;
```

---

## 🚀 Setup Iniziale (Prima Volta)

```bash
# 1. Avvia database
docker-compose up -d

# 2. Seed completo
npm run seed

# 3. Da ora usa sempre seed incrementale
npm run seed:update
```

---

## 💡 Tips

1. **Backup Automatico**: Aggiungi al crontab:

   ```bash
   0 2 * * 1 cd /path/to/shop/backend && npm run db:backup
   # Ogni lunedì alle 2 AM
   ```

2. **Prima di Deploy**: Sempre backup!

   ```bash
   npm run db:backup
   # Poi deploy
   ```

3. **Sviluppo**: Usa seed incrementale

   ```bash
   npm run seed:update
   ```

4. **Produzione**: Mai `npm run seed`, solo backup/restore

---

## 🆘 Troubleshooting

### "Workspace not found"

```bash
# Esegui seed completo prima
npm run seed

# Poi usa incrementale
npm run seed:update
```

### "Category not found for product X"

```bash
# Verifica che categoryName in products.ts corrisponda a name in categories.ts
# Esempio: "Cured Meats" (non "Salumi")
```

### Backup fallisce

```bash
# Verifica che Docker sia avviato
docker ps | grep shop_db

# Verifica permessi directory
ls -la backend/backups
```

---

**Andrea, ricorda:**

- 🟢 `npm run seed:update` → Sicuro, usa sempre questo
- 🔴 `npm run seed` → Pericoloso, solo setup iniziale
- 💾 `npm run db:backup` → Prima di cose importanti

Buon lavoro! 🚀
