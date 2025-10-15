# 📚 GESTIONE DATABASE - GUIDA COMPLETA

## 🎯 PROBLEMA

Hai **2 problemi**:

1. **Seed completo** cancella tutto (`npm run seed`) → perdi i dati inseriti manualmente
2. **Update manuale** del seed.ts è un lavoraccio

---

## ✅ SOLUZIONI

### **SCENARIO A: Sviluppo/Test**

Vuoi testare cambiamenti e ripartire da zero:

```bash
npm run seed          # Cancella tutto e ricrea da zero
```

**Quando usare**: Prima deploy, test, reset completo

---

### **SCENARIO B: Produzione - Aggiungi dati**

Hai già dati nel DB e vuoi aggiungere nuovi prodotti/categorie senza perdere niente:

```bash
npm run seed:update   # NON cancella, fa UPSERT (crea se non esiste, aggiorna se esiste)
```

**Quando usare**: Aggiungere nuovi prodotti mantenendo i vecchi

**Come funziona**:

- Categoria esiste? → La lascia com'è
- Categoria non esiste? → La crea
- Prodotto esiste (stesso ProductCode)? → Aggiorna solo prezzo/stock/descrizione
- Prodotto non esiste? → Lo crea nuovo

---

### **SCENARIO C: Backup dei dati attuali**

Hai inserito prodotti/foto/descrizioni manualmente e vuoi salvarli:

```bash
npm run db:backup     # Legge DB → Crea JSON in backups/
```

**Output**:

```
backups/
  └── 2025-10-15_16-30-00/
      ├── cm9hjgq9v00014qk8fsdy4ujv/    ← WorkspaceID
      │   ├── categories.json            ← Tutte le categorie
      │   ├── products.json              ← Tutti i prodotti
      │   ├── services.json              ← Tutti i servizi
      │   ├── faqs.json                  ← Tutte le FAQ
      │   ├── offers.json                ← Tutte le offerte
      │   └── settings.json              ← Impostazioni workspace
      └── summary.json                   ← Riepilogo backup
```

**Quando usare**: Prima di fare modifiche importanti, prima di aggiornare seed

---

### **SCENARIO D: Restore da backup**

Hai fatto casino e vuoi ripristinare un backup precedente:

```bash
npm run db:restore 2025-10-15_16-30-00   # Ripristina da backup specifico
```

**Quando usare**: Hai cancellato dati per errore, vuoi tornare indietro

---

## 🔄 WORKFLOW CONSIGLIATO

### 1️⃣ **Setup Iniziale**

```bash
npm run seed              # Crea struttura base
```

### 2️⃣ **Lavoro Manuale**

- Inserisci prodotti via CRUD
- Carica foto
- Scrivi descrizioni
- Configura servizi

### 3️⃣ **Backup Prima di Modifiche**

```bash
npm run db:backup         # Salva tutto prima di cambiare
```

### 4️⃣ **Aggiornamenti**

```bash
npm run seed:update       # Aggiungi nuovi prodotti senza perdere i vecchi
```

### 5️⃣ **Se Qualcosa Va Storto**

```bash
npm run db:restore 2025-10-15_16-30-00
```

---

## 🤔 DOMANDE FREQUENTI

### ❓ "Se cancello un prodotto dal DB, cosa succede con seed:update?"

**Risposta**: seed:update NON ricrea prodotti cancellati. Crea solo quelli che non esistono.

**Soluzione**: Se vuoi che seed:update ricrei anche prodotti cancellati, devi:

1. O fare `npm run seed` (reset completo)
2. O ricrearli manualmente via CRUD
3. O usare `npm run db:restore` da un backup

---

### ❓ "Voglio aggiornare i file .ts (products.ts, categories.ts) con i dati del DB"

**Non ancora implementato**, ma posso creare uno script che:

```bash
npm run db:export-to-seed   # DB → Aggiorna prisma/data/*.ts
```

Ti serve?

---

### ❓ "Come gestisco le foto?"

Le foto sono in `backend/uploads/products/` e `backend/uploads/services/`.

**Backup foto**:

```bash
# Backup manuale
cp -r backend/uploads backups/uploads-$(date +%Y%m%d)

# Restore manuale
cp -r backups/uploads-20251015/* backend/uploads/
```

---

## 📊 CONFRONTO SCRIPT

| Script                      | Cancella DB?   | Crea JSON? | Modifica .ts? | Uso            |
| --------------------------- | -------------- | ---------- | ------------- | -------------- |
| `npm run seed`              | ✅ Sì          | ❌ No      | ❌ No         | Setup iniziale |
| `npm run seed:update`       | ❌ No          | ❌ No      | ❌ No         | Aggiornamenti  |
| `npm run db:backup`         | ❌ No          | ✅ Sì      | ❌ No         | Salvataggio    |
| `npm run db:restore`        | ⚠️ Sovrascrive | ❌ No      | ❌ No         | Ripristino     |
| `npm run db:export-to-seed` | ❌ No          | ❌ No      | ✅ Sì         | DB → Code      |

---

## 🚀 PROSSIMI PASSI

1. ✅ Seed incrementale creato
2. ⏳ Backup script da completare
3. ⏳ Restore script da creare
4. ⏳ Export to seed (DB → .ts) da creare

**Quale vuoi che implemento per primo Andrea?**
