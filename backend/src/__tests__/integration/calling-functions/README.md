# 🧪 Calling Functions Integration Tests

Test suite per validare le Calling Functions del sistema LLM senza eseguire le funzioni effettivamente.

## 📋 Panoramica

Questi test verificano che l'LLM **rilevi correttamente** le funzioni da chiamare in base al contesto, **SENZA eseguirle** per evitare di modificare dati di produzione, storico messaggi, o billing.

### Test Mode

Il sistema ha una **TEST MODE** che:

- Rileva quando una funzione dovrebbe essere chiamata
- Restituisce i dettagli della function call (nome, argomenti)
- **NON esegue** la funzione effettiva
- Previene modifiche a database, storico, billing

Attivazione: `INTEGRATION_TEST=true npx jest calling-functions/`

## 🗂️ Struttura Test

```
calling-functions/
├── cf-setup.ts                    # Configurazione condivisa
├── cf-who-are-you.spec.ts         # Test: NO function call per domande generiche
├── cf-search-product.spec.ts      # Test: searchProduct (BACKGROUND, P5)
├── cf-repeat-order.spec.ts        # Test: repeatOrder con conferma
├── cf-add-product.spec.ts         # Test: addProduct con conferma
├── cf-contact-operator.spec.ts    # Test: ContactOperator (PRIORITY 1)
├── cf-get-link-order.spec.ts      # Test: GetLinkOrderByCode (PRIORITY 2)
├── cf-ambiguity-priority.spec.ts  # Test: PRIORITY 1 vince su PRIORITY 2
├── cf-token-carrello.spec.ts      # Test: Link carrello (NO function call)
├── cf-token-orders.spec.ts        # Test: Link lista ordini (NO function call)
└── cf-token-profile.spec.ts       # Test: Link profilo (NO function call)
```

## 🚀 Come Eseguire i Test

### Tutti i test insieme (~20 secondi)

```bash
cd backend
INTEGRATION_TEST=true npx jest calling-functions/
```

### Test singolo (risparmio costi API)

```bash
INTEGRATION_TEST=true npx jest cf-who-are-you
INTEGRATION_TEST=true npx jest cf-search-product
INTEGRATION_TEST=true npx jest cf-contact-operator
# ... etc
```

### Con output verbose

```bash
INTEGRATION_TEST=true npx jest calling-functions/ --verbose
```

## 📊 Cosa Testano

### 1. **cf-who-are-you** ❓

- **Input**: "chi sei?"
- **Expected**: `functionCalled === null`
- **Verifica**: Domande generiche NON triggano function calls

### 2. **cf-search-product** 🔍

- **Input**: "avete la mozzarella di bufala?"
- **Expected**: `functionCalled === "searchProduct"`
- **Priority**: 5 (BACKGROUND - non blocca conversazione)

### 3. **cf-repeat-order** 🔄

- **Input**: "voglio rifare l'ultimo ordine"
- **Expected**: `functionCalled === "repeatOrder"` OR `asksConfirmation === true`
- **Verifica**: LLM chiede conferma prima di ripetere ordine

### 4. **cf-add-product** 🛒

- **Input**: "voglio aggiungere il panettone nel carrello"
- **Expected**: `asksConfirmation === true`
- **Verifica**: LLM chiede conferma prima di aggiungere prodotto

### 5. **cf-contact-operator** 📞

- **Input**: "voglio parlare con un operatore"
- **Expected**: `functionCalled === "ContactOperator"`
- **Priority**: 1 (MASSIMA - sempre precedenza)

### 6. **cf-get-link-order** 🔗

- **Input**: "dammi ultimo ordine"
- **Expected**: `functionCalled === "GetLinkOrderByCode"` OR link presente in response
- **Priority**: 2 (Alta, ma sotto ContactOperator)

### 7. **cf-ambiguity-priority** ⚠️

- **Input**: "sono stufo, dammi ultimo ordine"
- **Expected**: `functionCalled === "ContactOperator"`
- **Verifica**: "sono stufo" (P1) batte "dammi ordine" (P2)
- **Test critico**: Priorità funzionano correttamente

### 8. **cf-token-carrello** 🛒

- **Input**: "mostra carrello"
- **Expected**:
  - `functionCalled === null` (NO function call!)
  - Response contiene `http://` o `https://`
- **Verifica**: LLM genera link direttamente (non chiama funzione)

### 9. **cf-token-orders** 🔗

- **Input**: "dammi la lista degli ordini"
- **Expected**:
  - `functionCalled === null`
  - Response contiene link tipo `http://localhost:3000/s/xxxxx`
- **Verifica**: LLM genera secure token link direttamente

### 10. **cf-token-profile** 👤

- **Input**: "voglio cambiare indirizzo di spedizione"
- **Expected**:
  - `functionCalled === null`
  - Response contiene profile link
- **Verifica**: LLM genera link profilo direttamente

## ⚙️ Configurazione

### cf-setup.ts

```typescript
export const TEST_CONFIG = {
  workspaceId: "", // Auto-populated dal primo workspace
  customerPhone: "+34666777888", // Cliente test spagnolo dal seed
  customerId: "", // Auto-populated
  model: "openai/gpt-4o-mini", // Stesso modello di produzione
  language: "it", // Lingua italiana (prompt)
  sessionId: "test-session",
  maxTokens: 5000,
  timeout: 30000, // 30 secondi per LLM call
}
```

### Requisiti

- Database con seed eseguito: `npm run seed`
- Cliente test presente: +34666777888 (María García - spagnola)
- Workspace attivo nel database
- OPENROUTER_API_KEY configurato in `.env`

## 💰 Costi e Performance

### Costi API

- **Tutti i test (10)**: ~$0.015 - $0.025 (dipende da token usage)
- **Test singolo**: ~$0.0015 - $0.003
- **Strategia risparmio**: Eseguire solo test relativi alle modifiche

### Performance

- **Suite completa**: ~20 secondi (test in parallelo)
- **Test singolo**: 5-12 secondi (dipende da complessità prompt)
- **Indicatore sano**: Se test finisce in <100ms → LLM non chiamato!

## 🔍 Debugging

### Test fallisce troppo velocemente (<100ms)

```bash
# Verifica che INTEGRATION_TEST sia settato
echo $INTEGRATION_TEST

# Deve essere "true"
export INTEGRATION_TEST=true
```

### Test non trova workspace

```bash
# Esegui seed
cd backend
npm run seed

# Verifica workspace nel DB
npx prisma studio
# Controlla tabella Workspace → deve avere almeno 1 record attivo
```

### Test non trova customer

```bash
# Il customer test è +34666777888 (dal seed)
# Verifica nella tabella Customers che esista
```

### "Cannot read properties of undefined (reading 'findFirst')"

- Problema: Prisma client non correttamente generato
- Fix: `npx prisma generate`
- Nota: Usare `prisma.workspace` (singolare) NON `prisma.workspaces` (plurale)

## ✅ Success Criteria

### Tutti i test devono:

1. **Durare almeno 5 secondi** (indica LLM call reale)
2. **NON modificare database** (verificare tabelle messages, orders, carts dopo run)
3. **Rilevare function calls corrette** (o assenza di calls quando appropriato)
4. **Gestire priorità** (test ambiguity-priority critico)

### Output atteso

```bash
Test Suites: 10 passed, 10 total
Tests:       10 passed, 10 total
Time:        ~20s
```

## 📝 Aggiungere Nuovi Test

1. Crea file `cf-nome-funzione.spec.ts`
2. Importa da `cf-setup.ts`:
   ```typescript
   import {
     TEST_CONFIG,
     setupTestCustomer,
     callLLMAndGetFunctionInfo,
     cleanup,
   } from "./cf-setup"
   ```
3. Template:

   ```typescript
   describe("🔹 CF: NomeFunzione", () => {
     beforeAll(async () => {
       await setupTestCustomer()
     }, 10000)

     afterAll(async () => {
       await cleanup()
     })

     it(
       "should call NomeFunzione for 'input test'",
       async () => {
         const result = await callLLMAndGetFunctionInfo("input test")

         expect(result.functionCalled).toBe("NomeFunzione")
         expect(result.success).toBe(true)
       },
       TEST_CONFIG.timeout
     )
   })
   ```

## 🎯 Best Practices

1. **Run test prima di commit**: Validare che modifiche non rompano detection
2. **Test singoli durante sviluppo**: Risparmiare costi API
3. **Full suite prima di deploy**: Validare tutto funziona
4. **Non verificare response content in TEST MODE**: L'LLM potrebbe non generare content quando rileva function call
5. **Focus su function detection**: L'importante è che la funzione GIUSTA venga rilevata

## 🚨 Note Importanti

- **TEST MODE non esegue funzioni**: Safe per run frequenti
- **Customer test è spagnolo**: Responses potrebbero essere in spagnolo
- **Prompt in italiano**: Language setting è "it" ma customer parla spagnolo
- **Links reali generati**: Token tests mostrano link veri anche in TEST MODE
- **Timing variabile**: API calls possono variare 5-15 secondi (normale)

---

**Autore**: Andrea (@gelsogrove)  
**Ultimo aggiornamento**: 23 Ottobre 2025  
**Status**: ✅ 10/10 tests passing
