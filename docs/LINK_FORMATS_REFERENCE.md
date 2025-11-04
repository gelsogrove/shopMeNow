# 🔗 LINK FORMATS - REFERENCE DEFINITIVA

**Data creazione**: 4 Novembre 2025  
**Autore**: Andrea Gelso  
**Stato**: ✅ CONGELATO - NON MODIFICARE SENZA APPROVAZIONE

---

## ⚠️ REGOLE FERREE

1. **QUESTI FORMATI SONO DEFINITIVI** - Non cambiarli mai senza approvazione esplicita di Andrea
2. **orderCode** va nel PATH solo per ordini specifici, MAI per liste
3. **token** va SEMPRE in query string `?token=...`
4. **Short URLs** (`/s/abc123`) devono reindirizzare a questi formati esatti

---

## 📋 FORMATI UFFICIALI

### 1. ORDINE SPECIFICO (Singolo Ordine)

```
http://localhost:3000/orders-public/ORD-048-2025-9?token=c34b3b814eb01a93e6cc0c845a98947b1913be792d90c5899fd1eb8a0bdf6831
```

**Quando usarlo**:

- Utente chiede "dammi ultimo ordine"
- Utente chiede "mostra ordine ORD-123"
- Fattura singolo ordine
- Tracking singolo ordine

**Pattern**: `/orders-public/{FULL_ORDER_CODE}?token={JWT_TOKEN}`

**Codice orderCode**: `ORD-048-2025-9` (COMPLETO, con anno e mese!)

---

### 2. LISTA ORDINI (Generale - TUTTI gli ordini del cliente)

```
http://localhost:3000/orders-public?token=c34b3b814eb01a93e6cc0c845a98947b1913be792d90c5899fd1eb8a0bdf6831
```

**Quando usarlo**:

- Utente chiede "dammi ordini" / "lista ordini"
- Mostra ultimi 3 ordini + link generale
- Storico completo ordini

**Pattern**: `/orders-public?token={JWT_TOKEN}` (SENZA orderCode nel path!)

**IMPORTANTE**: Se la risposta contiene MULTIPLI orderCode (ORD-048, ORD-044, ORD-040), usa questo formato!

---

### 3. CARRELLO / CHECKOUT

```
http://localhost:3000/checkout?token=c34b3b814eb01a93e6cc0c845a98947b1913be792d90c5899fd1eb8a0bdf6831
```

**Quando usarlo**:

- Utente chiede "vai al carrello"
- Checkout prodotti
- Conferma ordine

**Pattern**: `/checkout?token={JWT_TOKEN}`

---

## 🔧 LOGICA DI GENERAZIONE

### Nel Router (`llm-router.service.ts`)

```typescript
// Estrai TUTTI gli orderCode dalla risposta
const orderCodes = result.response.match(/ORD-[0-9-]+/g) || []

// REGOLA CHIAVE:
// - 1 orderCode → Link specifico con orderCode nel path
// - 0 o 2+ orderCodes → Link generale SENZA orderCode
const orderCode = orderCodes.length === 1 ? orderCodes[0] : undefined
```

### Nel LinkReplacementService

```typescript
// Se orderCode è presente → ordine specifico
if (orderCodeParam && orderCodeParam.trim() !== "") {
  const safeCode = encodeURIComponent(orderCodeParam.trim())
  url = `${config.frontendUrl}/orders-public/${safeCode}?token=${token}`
}
// Se orderCode è undefined → lista generale
else {
  url = `${config.frontendUrl}/orders-public?token=${token}`
}
```

---

## 🎯 ESEMPI DI USO

### Esempio 1: Ultimo Ordine (1 solo orderCode)

**Input utente**: "dammi ultimo ordine"

**Risposta Agent**:

```
Here is your last order ORD-048-2025-9! 📦
...
View details: [LINK_ORDERS_WITH_TOKEN]
```

**orderCode estratto**: `ORD-048-2025-9` (1 solo!)

**Link generato**: `http://localhost:3000/orders-public/ORD-048-2025-9?token=...`

✅ **Corretto**: Ordine specifico nel path

---

### Esempio 2: Lista Ultimi Ordini (3 orderCode)

**Input utente**: "dammi ordini"

**Risposta Agent**:

```
📦 Here are your last 3 orders:

1. Order #ORD-048-2025-9
2. Order #ORD-044-2025-9
3. Order #ORD-040-2025-8

👉 Click [here](LINK_ORDERS_WITH_TOKEN).
```

**orderCode estratti**: `['ORD-048-2025-9', 'ORD-044-2025-9', 'ORD-040-2025-8']` (3!)

**Link generato**: `http://localhost:3000/orders-public?token=...`

✅ **Corretto**: Lista generale SENZA orderCode nel path

---

### Esempio 3: Carrello

**Input utente**: "vai al carrello"

**Token usato**: `[LINK_CHECKOUT_WITH_TOKEN]`

**Link generato**: `http://localhost:3000/checkout?token=...`

✅ **Corretto**: Route checkout, NON orders-public

---

## 🧪 TESTING

### Test Manuale Rapido

```bash
# Test 1: Ordine specifico (deve avere /ORD-XXX nel path)
curl http://localhost:3000/orders-public/ORD-048-2025-9?token=TEST

# Test 2: Lista generale (NON deve avere /ORD-XXX)
curl http://localhost:3000/orders-public?token=TEST

# Test 3: Checkout
curl http://localhost:3000/checkout?token=TEST
```

### Test Automatico

```bash
cd backend && npm run test:unit -- link-replacement-formats.spec.ts
```

Devono passare **16/16 test**.

---

## 🚨 PROBLEMI COMUNI & SOLUZIONI

### ❌ Problema 1: Link con punto finale

**Sintomo**: `http://localhost:3000/s/abc123.` → 404

**Causa**: Punteggiatura inclusa nell'URL

**Soluzione**: Regex aggiornata cattura punteggiatura DOPO parentesi:

```typescript
;/\[([^\]]+)\]\(LINK_ORDERS_WITH_TOKEN\)([\.!?,;:]?)/g
```

---

### ❌ Problema 2: orderCode nel path quando non dovrebbe

**Sintomo**: Mostra 3 ordini ma link va a `/orders-public/ORD-048?token=...`

**Causa**: Router estrae primo orderCode anche con multipli

**Soluzione**: Conta orderCode, usa solo se ce n'è 1:

```typescript
const orderCodes = response.match(/ORD-[0-9-]+/g) || []
const orderCode = orderCodes.length === 1 ? orderCodes[0] : undefined
```

---

### ❌ Problema 3: Short URL non trovato (404)

**Sintomo**: `/s/yZsqey` → "Link Error"

**Causa**: Codice non esiste nel database `shortUrls`

**Debug**:

```sql
SELECT shortCode, originalUrl, createdAt
FROM shortUrls
WHERE shortCode = 'yZsqey';
```

**Soluzione**: Verificare che `UrlShortenerService.createShortUrl()` salvi effettivamente nel DB

---

## 📊 ARCHITETTURA DEL FLUSSO

```
1. Utente: "dammi ordini"
   ↓
2. Router Agent → ORDER_TRACKING Agent
   ↓
3. OrderTrackingAgent.getLastOrders() → ritorna 3 ordini
   ↓
4. Risposta contiene: [LINK_ORDERS_WITH_TOKEN]
   ↓
5. Router: Conta orderCode nella risposta
   - Se 1 → orderCode definito
   - Se 0 o 2+ → orderCode = undefined
   ↓
6. LinkReplacementService.replaceTokens({orderCode})
   - Se orderCode → /orders-public/{CODE}?token=...
   - Se undefined → /orders-public?token=...
   ↓
7. UrlShortenerService → Crea short URL /s/abc123
   ↓
8. Safety/Translation → Traduce + sostituisce {{nameUser}}
   ↓
9. WhatsApp → Invia messaggio con link corretto
```

---

## 🔐 TOKEN SECURITY

- **Tipo**: JWT con customerId, workspaceId
- **Scadenza**: 1 ora (configurabile via `TOKEN_EXPIRATION`)
- **Formato**: `c34b3b814eb01a93e6cc0c845a98947b1913be792d90c5899fd1eb8a0bdf6831`
- **Validazione**: Frontend verifica token, estrae customerId, filtra ordini

---

## 📝 CHANGELOG

### 2025-11-04 - v1.0 (Andrea Gelso)

- ✅ Creata documentazione definitiva
- ✅ Congelati formati link ufficiali
- ✅ Aggiunta logica conteggio orderCode
- ✅ Risolto problema punteggiatura
- ✅ Documentati test e troubleshooting

---

## 🎯 ACTION ITEMS per SVILUPPATORI

1. **LEGGERE QUESTO DOCUMENTO** prima di toccare qualsiasi cosa relativa ai link
2. **NON MODIFICARE** i formati senza approvazione di Andrea
3. **TESTARE** sempre con `npm run test:unit -- link-replacement-formats.spec.ts`
4. **VERIFICARE** manualmente su WhatsApp prima di committare
5. **AGGIORNARE** questo documento se si apportano modifiche approvate

---

**Fine Documento** 🏁
