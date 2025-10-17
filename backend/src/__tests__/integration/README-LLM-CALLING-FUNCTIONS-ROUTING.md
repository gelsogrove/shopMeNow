# 🧪 LLM Calling Functions Routing - Integration Test Documentation

## 📋 Overview

File di test di integrazione che verifica il corretto routing delle calling functions da parte del LLM OpenRouter.

**File**: `backend/src/__tests__/integration/llm-calling-functions-routing.spec.ts`  
**Tipo**: Integration Test (COSTOSO - chiamate OpenRouter API reali)  
**Created**: 17 October 2025  
**Branch**: `84-design-implement-new-calling-functions-addproduct-repeatorder-full-befeprompt-integration`

---

## ⚠️ ATTENZIONE - Test Costoso

Questo test effettua **chiamate reali all'API OpenRouter** (GPT-4o-mini).

- **Costo stimato**: ~$0.05-0.10 per esecuzione completa (10 test cases)
- **Tempo esecuzione**: ~2-3 minuti
- **Eseguire solo quando necessario**: dopo modifiche alle calling functions o al prompt

---

## 🎯 Test Cases

### Test Matrix

| #   | Test Case                                  | Query Esempio                               | Expected Result                      | Priority |
| --- | ------------------------------------------ | ------------------------------------------- | ------------------------------------ | -------- |
| 1   | searchProduct (BACKGROUND)                 | "avete la mozzarella di bufala?"           | searchProduct chiamata in background | 5        |
| 2   | Token Return - Lista Ordini                | "dammi la lista degli ordini"               | [LINK_ORDERS_WITH_TOKEN]             | -        |
| 3   | GetLinkOrderByCode                         | "dammi ultimo ordine"                       | GetLinkOrderByCode chiamata          | 2        |
| 4   | ContactOperator                            | "voglio parlare con un operatore"           | ContactOperator chiamata             | 1        |
| 5   | Token Return - Mostra Carrello             | "mostra carrello"                           | [LINK_CHECKOUT_WITH_TOKEN]           | -        |
| 6   | Token Return - Cambia Indirizzo            | "voglio cambiare indirizzo di spedizione"   | [LINK_PROFILE_WITH_TOKEN]            | -        |
| 7   | repeatOrder                                | "voglio rifare l'ultimo ordine"             | repeatOrder o richiesta conferma     | 3        |
| 8   | addProduct                                 | "voglio aggiungere il panettone"            | Richiesta conferma (NO addProduct)   | 4        |
| 9   | No Function Call                           | "chi sei?"                                  | Nessuna function chiamata            | -        |
| 10  | Ambiguity Resolution (Priority 1 vince)    | "sono stufo, dammi ultimo ordine"           | ContactOperator (PRIORITY 1)         | 1        |

---

## 🚀 Come Eseguire

### Prerequisiti

1. **Database seeded**:
   ```bash
   cd backend
   npm run seed
   ```

2. **Environment variables** (`.env` o `.env.development`):
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-xxxxx
   DATABASE_URL=postgresql://...
   ```

3. **Test workspace** deve esistere:
   - Slug: `test-workspace`
   - Deve avere prompt configurato (dalla tabella `prompts`)

### Esecuzione

**Singolo test file** (raccomandato):
```bash
cd backend
npm run test:integration -- llm-calling-functions-routing
```

**Tutti gli integration tests**:
```bash
npm run test:integration
```

**Con verbose output**:
```bash
npm run test:integration -- --verbose llm-calling-functions-routing
```

### Watch Mode (⚠️ SCONSIGLIATO - Costo elevato)
```bash
npm run test:integration -- --watch llm-calling-functions-routing
```

---

## 📊 Expected Output

### Success Output Example

```
✅ Test setup complete
   Workspace ID: cm9hjgq9v00014qk8fsdy4ujv
   Customer ID: cm9hjgr9v00024qk8fsdy5xkw
   Customer Phone: +34600123456

🔍 Test: searchProduct
Query: 'avete la mozzarella di bufala?'
Function Called: searchProduct
Response: Sì! Abbiamo diverse opzioni di mozzarella di bufala...

📦 Test: GetLinkOrderByCode
Query: 'dammi ultimo ordine'
Function Called: GetLinkOrderByCode
Response: Ecco il dettaglio del tuo ultimo ordine...

📞 Test: ContactOperator
Query: 'voglio parlare con un operatore'
Function Called: ContactOperator
Response: Ti metto subito in contatto con un operatore...

⚠️ Test: Ambiguity - Priority 1 Wins
Query: 'sono stufo, dammi ultimo ordine'
Function Called: ContactOperator
Response: Mi dispiace per il disagio. Ti metto in contatto con un operatore...

================================================================================
📊 LLM CALLING FUNCTIONS ROUTING - TEST SUMMARY
================================================================================
✅ All tests completed successfully!

Verified:
  🚨 Priority 1: ContactOperator (frustration triggers)
  🚨 Priority 2: GetLinkOrderByCode (ultimo ordine)
  ⚙️ Priority 3: repeatOrder (with confirmation)
  ⚙️ Priority 4: addProduct (with confirmation)
  📊 Priority 5: searchProduct (BACKGROUND)
  🔗 Token Returns: orders, checkout, profile
  ❌ No Function: conversational queries
  ⚠️ Ambiguity Resolution: Priority system works
================================================================================
```

---

## 🔍 Cosa Verifica Ogni Test

### Test 1: searchProduct (BACKGROUND)
**Query**: `"avete la mozzarella di bufala?"`

**Verifica**:
- ✅ `functionCalled === "searchProduct"`
- ✅ `functionArgs.productName` contiene "mozzarella"
- ✅ Response è naturale (non contiene "searchProduct" o "registrato")

**Motivo**: searchProduct è BACKGROUND (PRIORITY 5), deve essere chiamata senza bloccare il flusso.

---

### Test 2: Token Return - Lista Ordini
**Query**: `"dammi la lista degli ordini"`

**Verifica**:
- ✅ `functionCalled === null` (nessuna calling function)
- ✅ Response contiene "orders" o "/o/" nel link

**Motivo**: Richieste di lista completa ordini usano token `[LINK_ORDERS_WITH_TOKEN]`, non calling functions.

---

### Test 3: GetLinkOrderByCode
**Query**: `"dammi ultimo ordine"`

**Verifica**:
- ✅ `functionCalled === "GetLinkOrderByCode"`
- ✅ Response contiene "ordine" o "order"

**Motivo**: Visualizzare ordine specifico è PRIORITY 2, ha priorità sulle FAQ.

---

### Test 4: ContactOperator
**Query**: `"voglio parlare con un operatore"`

**Verifica**:
- ✅ `functionCalled === "ContactOperator"`
- ✅ Response menziona "operatore" o "operator"

**Motivo**: Richiesta esplicita di operatore è PRIORITY 1 (massima).

---

### Test 5: Token Return - Mostra Carrello
**Query**: `"mostra carrello"`

**Verifica**:
- ✅ `functionCalled === null`
- ✅ Response contiene "checkout", "carrello" o "/c/"

**Motivo**: Mostrare carrello usa token `[LINK_CHECKOUT_WITH_TOKEN]`, non calling functions.

---

### Test 6: Token Return - Cambia Indirizzo
**Query**: `"voglio cambiare indirizzo di spedizione"`

**Verifica**:
- ✅ `functionCalled === null`
- ✅ Response contiene "profile", "profil" o "/p/"

**Motivo**: Modificare profilo usa token `[LINK_PROFILE_WITH_TOKEN]`.

---

### Test 7: repeatOrder
**Query**: `"voglio rifare l'ultimo ordine"`

**Verifica**:
- ✅ `functionCalled === "repeatOrder"` OR `response.includes("conferma")`
- ✅ Se non chiama subito, chiede conferma ("Ricreo il tuo ultimo ordine?")

**Motivo**: repeatOrder è PRIORITY 3, richiede conferma utente prima di eseguire.

---

### Test 8: addProduct
**Query**: `"voglio aggiungere il panettone nel carrello"`

**Verifica**:
- ✅ `functionCalled !== "addProduct"` (NON deve chiamare ancora)
- ✅ Response chiede conferma ("Vuoi aggiungerlo al carrello?")

**Motivo**: addProduct è PRIORITY 4, richiede flow obbligatorio: mostra prodotto → chiedi conferma → esegui.

---

### Test 9: No Function Call
**Query**: `"chi sei?"`

**Verifica**:
- ✅ `functionCalled === null`
- ✅ Response parla dell'assistente/azienda

**Motivo**: Domande conversazionali non attivano calling functions.

---

### Test 10: Ambiguity Resolution
**Query**: `"sono stufo, dammi ultimo ordine"`

**Verifica**:
- ✅ `functionCalled === "ContactOperator"` (NON GetLinkOrderByCode)
- ✅ Response menziona "operatore" o "assistenza"

**Motivo**: Test cruciale per priorità. "sono stufo" (frustrazione) → ContactOperator PRIORITY 1. "dammi ultimo ordine" → GetLinkOrderByCode PRIORITY 2. **PRIORITY 1 DEVE VINCERE**.

---

## 🛠️ Troubleshooting

### Test fallisce: "Test workspace not found"
**Soluzione**:
```bash
cd backend
npm run seed
```

### Test fallisce: "OPENROUTER_API_KEY not found"
**Soluzione**: Verifica `.env` o `.env.development`:
```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Test timeout dopo 30s
**Causa**: OpenRouter API lenta o rate limiting.  
**Soluzione**: 
- Aspetta qualche minuto
- Verifica API key valida
- Timeout configurabile in ogni test (`30000` ms)

### Function chiamata sbagliata
**Causa**: Prompt agent non aggiornato o priorità non rispettate.  
**Soluzione**:
1. Verifica `docs/prompt_agent.md` sezione "CALLING FUNCTIONS"
2. Verifica `backend/src/services/llm.service.ts::getAvailableFunctions()`
3. Descriptions devono includere priorità esplicita

### Response non contiene link atteso
**Causa**: Link replacement non funziona o token non sostituito.  
**Soluzione**:
1. Verifica `LinkReplacementService` in `application/services/link-replacement.service.ts`
2. Check logs per errori token generation

---

## 📈 Metriche di Successo

### ✅ Test PASSA se:
- Tutte le 10 test cases passano
- Priorità rispettate (test 10 cruciale)
- searchProduct eseguita in background
- Token returns corretti (orders, checkout, profile)
- addProduct e repeatOrder chiedono conferma

### ❌ Test FALLISCE se:
- Funzione sbagliata chiamata
- Priorità non rispettate (es: test 10 chiama GetLinkOrderByCode invece di ContactOperator)
- searchProduct blocca flusso conversazionale
- addProduct chiamata senza conferma
- Token non sostituiti correttamente

---

## 🔄 Manutenzione

### Quando eseguire questo test:

1. **OBBLIGATORIO**:
   - Dopo modifiche a `docs/prompt_agent.md` sezione CALLING FUNCTIONS
   - Dopo modifiche a `llm.service.ts::getAvailableFunctions()`
   - Dopo modifiche a priorità calling functions
   - Dopo modifiche a domain functions (ContactOperator, GetLinkOrderByCode, etc.)

2. **RACCOMANDATO**:
   - Prima di merge a `main`
   - Dopo aggiunta nuove calling functions
   - Dopo modifiche a `BACKGROUND_FUNCTIONS` array

3. **OPZIONALE**:
   - Periodicamente (settimanale) per regression testing

### Aggiornamento test cases:

Se aggiungi una nuova calling function:

1. Aggiungi nuovo `describe()` block
2. Includi query esempio
3. Verifica `functionCalled` corretto
4. Aggiungi a tabella test matrix sopra
5. Aggiorna summary output

---

## 📚 Riferimenti

- **Prompt Agent**: `docs/prompt_agent.md` - Sezione "CALLING FUNCTIONS"
- **Architecture**: `docs/memory-bank/03-ARCHITECTURE/calling-functions-architecture.md`
- **LLM Service**: `backend/src/services/llm.service.ts`
- **Domain Functions**: `backend/src/domain/calling-functions/*.ts`
- **Priorità Sistema**: Vedi `docs/prompt_agent.md` linea 140-180

---

## 🎯 Cost Optimization

Per ridurre costi durante sviluppo:

1. **Esegui solo test specifici**:
   ```bash
   npm run test:integration -- -t "Test Case 10"
   ```

2. **Mock OpenRouter in development** (TODO):
   - Crea mock responses per test deterministici
   - Usa mock per CI/CD
   - Esegui integration test reale solo pre-production

3. **Test localmente prima di CI/CD**:
   - Esegui manualmente prima di push
   - CI/CD può usare mock

---

**Autore**: Andrea Gelso  
**Ultima modifica**: 17 October 2025  
**Status**: ✅ Pronto per uso
