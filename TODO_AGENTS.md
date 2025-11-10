# 🤖 AGENTS ARCHITECTURE - TODO LIST

## 🎯 Schema Architettura Multi-Agent

```
🔀 Router Agent (order: 0)
   - Temp: 0.3, Max Tokens: 2048
   - CF: productSearchAgent, cartManagementAgent, orderTrackingAgent,
         customerSupportAgent, handlePushNotifications
   - ⚡ Multi-language support: IT/ES/PT/FR/EN (gestito direttamente)
   - ⚡ Variables: {{PRODUCTS}}, {{CATEGORIES}}, {{OFFERS}} (in italiano)

   ├─→ Product Search Agent (order: 2)
   │   - CF: cartManagementAgent (ONLY - removed searchProducts, searchProductByCertifications)
   │   - ⚡ NEW: Direct {{PRODUCTS}} variable in prompt (no QueryAnalyzer)
   │
   ├─→ Cart Management Agent (order: 3)
   │   - CF: addToCart, viewCart, clearCart
   │
   ├─→ Order Tracking Agent (order: 4)
   │   - CF: getOrders, getOrder, trackOrder, sendInvoice, repeatLastOrder
   │
   └─→ Customer Support Agent (order: 5)
       - CF: contactSupport

🛡️ Safety & Translation Agent (order: 99)
   - Temp: 0.1, Max Tokens: 1024
   - CF: sendAlertEmail
```

**⚠️ REMOVED**:

- ❌ Translation Agent (order: -1) - Sostituito da Router multi-lingua con variabili
- ❌ QueryAnalyzerAgent (order: 6) - Sostituito da {{PRODUCTS}} variable diretta

---

## 📋 TODO LIST

### ✅ Completati

- [x] Schema architettura definito
- [x] Frontend aggiornato per mostrare gerarchia
- [x] Calling functions corrette per ogni agent

### 🔄 In Corso

### ⏳ Da Fare

#### 1. 📊 Message Flow Tracking - Complete Debug Trail

**Obiettivo**: Ogni messaggio deve tracciare TUTTO il percorso attraverso gli agent per debugging e visualizzazione nel View Flow.

**Problema**:

- Quando un messaggio passa attraverso Router → ProductSearch, dobbiamo sapere ESATTAMENTE:
  - Quale agent ha processato il messaggio
  - Input ricevuto dall'agent
  - Output prodotto dall'agent
  - Tempo di esecuzione
  - Token utilizzati
  - Eventuali errori

**Requisiti**:

- [ ] **Push info ad ogni uscita da LLM**: Salvare nel database il passaggio attraverso ogni agent
- [ ] **Catena completa**: Router → Specialist
- [ ] **Visualizzazione View Flow**: Mostrare graficamente il percorso nella chat history
- [ ] **Debug info**: Input/Output di ogni step visibile per troubleshooting

**Dati da tracciare per ogni step**:

```json
{
  "messageId": "uuid",
  "step": 1,
  "agentType": "ROUTER",
  "agentName": "Router Agent",
  "input": "Hola, quiero mozzarella",
  "output": "DELEGATE: productSearchAgent",
  "tokensUsed": 45,
  "executionTimeMs": 234,
  "timestamp": "2025-11-10T19:00:00Z",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3
}
```

**Task**:

- [ ] Verificare se esiste già table `MessageFlowStep` o simile nel database
- [ ] Se non esiste, creare migration per tabella tracking
- [ ] Aggiungere hook in ogni LLM call per salvare step
- [ ] Aggiornare View Flow component per mostrare catena completa
- [ ] Testare con messaggio completo: Router → ProductSearch

**File da verificare/modificare**:

- `backend/prisma/schema.prisma` (verificare se esiste tracking)
- `backend/src/services/llm-router.service.ts` (aggiungere tracking hooks)
- `backend/src/application/agents/ProductSearchAgentLLM.ts` (tracking interno)
- `frontend/src/components/...ViewFlow.tsx` (visualizzazione grafica)

**Priorità**: 🔥 ALTA - Essenziale per debugging multi-agent system

---

#### 2. 🔀 Router Agent - Verifica Calling Functions e Configurazione

**Obiettivo**: Controllare che Router Agent smisti correttamente TUTTE le chiamate e abbia TUTTE le giuste Calling Functions configurate.

**Problema attuale**:

- Router Agent deve avere CF complete: `productSearchAgent`, `cartManagementAgent`, `orderTrackingAgent`, `customerSupportAgent`, `handlePushNotifications`
- Manca file di configurazione centralizzato per mapping Agent → Calling Functions
- Quando Router chiama una CF, dobbiamo fare PUSH di debug per View Flow

**Task**:

- [ ] **Verificare Router prompt**: Controllare che `router-agent.md` abbia TUTTE le CF documentate
- [ ] **Creare file configurazione CF**: File JSON/TypeScript con mapping Agent → Calling Functions disponibili
- [ ] **Aggiungere tracking CF calls**: Ogni volta che Router chiama una CF, salvare nel flow tracking
- [ ] **Testare routing**: Verificare che Router smisti correttamente su ogni specialist agent
- [ ] **Debug push per CF**: Aggiungere log quando CF viene invocata (nome CF, parametri, risultato)

**Struttura file configurazione**:

```typescript
// backend/src/config/agent-calling-functions.config.ts
export const AGENT_CALLING_FUNCTIONS = {
  ROUTER: [
    "productSearchAgent",
    "cartManagementAgent",
    "orderTrackingAgent",
    "customerSupportAgent",
    "handlePushNotifications",
  ],
  PRODUCT_SEARCH: [
    "searchProducts",
    "searchProductByCertifications",
    "cartManagementAgent",
  ],
  CART_MANAGEMENT: ["addToCart", "viewCart", "clearCart"],
  // ... altri agent
}
```

**File da verificare/modificare**:

- `docs/prompts/router-agent.md` (verificare CF complete)
- `backend/src/config/agent-calling-functions.config.ts` (NUOVO - creare)
- `backend/src/services/llm-router.service.ts` (usare config file)
- `backend/src/services/calling-functions.service.ts` (aggiungere debug push)

**Priorità**: 🔥 ALTA - Router è il cuore del sistema multi-agent

---

#### 3. 🛒 Cart Management Agent - Rimuovere Calling Functions Duplicate

**Obiettivo**: Togliere `updateCartQuantity` e `removeFromCart` da Cart Management Agent.

**Motivo**:

- Funzionalità duplicate o non necessarie
- Semplificare le CF disponibili per l'agent
- Ridurre confusione nel prompt

**Task**:

- [ ] **Verificare prompt**: Controllare `cart-management-agent.md` e rimuovere riferimenti a `updateCartQuantity` e `removeFromCart`
- [ ] **Aggiornare defaultAgents.ts**: Rimuovere queste CF dalla lista `availableFunctions`
- [ ] **Verificare CallingFunctionsService**: Assicurarsi che le funzioni non siano più chiamabili
- [ ] **Update frontend**: Rimuovere da `AGENT_CALL_FUNCTIONS` mapping in `AgentConfigurationPage.tsx`
- [ ] **Testare**: Verificare che Cart Agent funzioni solo con `addToCart`, `viewCart`, `clearCart`

**Calling Functions finali per Cart Management**:

```typescript
CART_MANAGEMENT: [
  "addToCart", // ✅ Mantieni
  "viewCart", // ✅ Mantieni
  "clearCart", // ✅ Mantieni
  // ❌ updateCartQuantity - RIMUOVI
  // ❌ removeFromCart - RIMUOVI
]
```

**File da modificare**:

- `docs/prompts/cart-management-agent.md`
- `backend/prisma/data/defaultAgents.ts`
- `frontend/src/pages/AgentConfigurationPage.tsx`
- `backend/src/services/calling-functions.service.ts` (opzionale - commentare vecchie CF)

**Priorità**: 🟡 MEDIA - Pulizia e semplificazione

---

#### 4. 🆘 Router Agent - Panic Mode & Customer Support Escalation

**Obiettivo**: Router Agent deve riconoscere situazioni di PANICO dell'utente e chiamare immediatamente `customerSupportAgent`.

**Casi di panico** (esempi):

- "Non funziona niente!"
- "Voglio parlare con una persona"
- "Questo è assurdo, chiamatemi!"
- "Help! Problema urgente!"
- "Mi serve assistenza SUBITO"

**Task**:

- [ ] **Aggiornare router-agent.md**: Aggiungere sezione "PANIC MODE DETECTION"
- [ ] **Definire keywords panico**: Lista esplicita di parole/frasi che indicano frustrazione/urgenza
- [ ] **Prompt chiaro**: Router deve avere istruzione esplicita: "SE utente è in panico → CHIAMA `customerSupportAgent` IMMEDIATAMENTE"
- [ ] **Esempi nel prompt**: Mostrare esempi di conversazioni con escalation
- [ ] **Testare panic mode**: Verificare che Router deleghi correttamente a Support

**Sezione da aggiungere al prompt**:

```markdown
## 🆘 PANIC MODE DETECTION

**CRITICAL**: Se l'utente mostra segni di frustrazione, urgenza o richiede assistenza umana,
CHIAMA IMMEDIATAMENTE `customerSupportAgent`.

**Panic keywords**:

- "help", "aiuto", "urgente", "subito"
- "persona", "operatore", "umano"
- "non funziona", "problema grave", "assurdo"
- "arrabbiato/a", "deluso/a", "frustrato/a"

**Esempi**:
User: "Non riesco a completare l'ordine, ho bisogno di aiuto!"
→ CALL: customerSupportAgent(reason="Order completion issue - user needs assistance")

User: "Questo chatbot non capisce niente, voglio parlare con una persona"
→ CALL: customerSupportAgent(reason="User frustrated - requesting human support")
```

**File da modificare**:

- `docs/prompts/router-agent.md`

**Priorità**: 🔥 ALTA - Esperienza utente critica

---

#### 5. ✂️ Prompt Optimization - Minimal & Essential Info Only

**Obiettivo**: TUTTI i prompt devono avere il **MINIMO del MINIMO** - solo le info strettamente necessarie.

**Problema**:

- Prompt troppo lunghi → costo token inutile
- Informazioni ridondanti → confusione per LLM
- Esempi eccessivi → rallentamento risposte

**Principi**:

- ✅ **Conciso**: Massimo 200 righe per prompt specialist agent
- ✅ **Essenziale**: Solo istruzioni che cambiano comportamento
- ✅ **No ripetizioni**: Ogni concetto detto UNA volta
- ✅ **Esempi mirati**: Max 3-5 esempi, solo casi critici

**Task**:

- [ ] **Audit tutti i prompt**: Leggere ogni file `docs/prompts/*.md` e identificare bloat
- [ ] **Rimuovere ridondanze**: Eliminare sezioni che ripetono concetti già detti
- [ ] **Condensare esempi**: Tenere solo esempi che mostrano comportamenti non ovvi
- [ ] **Verificare lunghezza**: Target <200 righe per specialist, <300 per Router
- [ ] **Testare dopo ottimizzazione**: Assicurarsi che agent funzionino ancora correttamente

**Checklist per ogni prompt**:

```
□ Introduzione chiara (max 5 righe)
□ Obiettivo principale (max 3 righe)
□ Calling Functions disponibili (lista secca)
□ Regole critiche (max 10 bullet points)
□ Esempi essenziali (max 5)
□ NO sezioni "nice to have"
□ NO ripetizioni di concetti
```

**File da ottimizzare** (in ordine priorità):

1. `router-agent.md` (probabilmente il più lungo)
2. `product-search-agent.md`
3. `cart-management-agent.md`
4. `order-tracking-agent.md`
5. `customer-support-agent.md`
6. `translation-agent.md`
7. `safety-translation-agent.md`

**Priorità**: 🟡 MEDIA - Ottimizzazione costi e performance

---

#### 6. 🔗 Cart Link Generation - Verify Correctness & Fix Issues

**Obiettivo**: Controllare che i link del carrello generati siano CORRETTI e non abbiano errori o intoppi.

**Problema attuale (da verificare)**:

- Link generati dal sistema: `generateCheckoutLink()` in `link-generator.service.ts`
- Frontend usa route `/cart?token=xxx` ma CheckoutPage legge `searchParams.get("token")`
- Possibile mismatch tra route generata e route effettiva frontend
- URL shortener potrebbe causare problemi se fallback non funziona
- Token validation potrebbe avere edge cases

**Componenti da verificare**:

1. **Backend - Link Generation**:

   - `LinkGeneratorService.generateCheckoutLink()` → genera `/cart?token=xxx`
   - `CallingFunctionsService` → usa `linkGeneratorService.generateCheckoutLink()`
   - `CartController.generateToken()` → crea token con `SecureTokenService`

2. **Frontend - Cart Page**:

   - Route definita: `/cart` o `/checkout`? (DA VERIFICARE)
   - `CheckoutPage.tsx` legge `token = searchParams.get("token")` ✅
   - `useCheckoutTokenValidation()` hook valida il token ✅

3. **URL Shortener**:
   - `UrlShortenerService.createShortUrl()` → crea short URL
   - Fallback a long URL se shortener fallisce ✅
   - Short URL format: `http://localhost:3000/s/abc123`

**Task**:

- [ ] **Verificare route mismatch**: Link generato usa `/cart` ma frontend potrebbe avere `/checkout`
- [ ] **Controllare App.tsx**: Quale route è definita per CheckoutPage? `/cart` o `/checkout`?
- [ ] **Testare link generato**: Creare cart token e verificare che link apra la pagina corretta
- [ ] **Verificare token validation**: Controllare che `useCheckoutTokenValidation()` gestisca correttamente errori
- [ ] **Edge cases**:
  - Token scaduto → mostra errore chiaro ✅
  - Token invalido → mostra errore chiaro ✅
  - Carrello vuoto → permette aggiunta prodotti? (DA TESTARE)
  - Customer non trovato → gestione errore? (DA TESTARE)
- [ ] **URL shortener fallback**: Verificare che fallback a long URL funzioni se shortener down
- [ ] **Fix route mismatch** se trovato: Allineare `/cart` o `/checkout` tra backend e frontend

**Possibili problemi da risolvare**:

```typescript
// Backend genera:
const cartUrl = `${config.frontendUrl}/cart?token=${token}`

// Frontend potrebbe avere route:
<Route path="/checkout" element={<CheckoutPage />} />  // ❌ MISMATCH!

// DEVE essere:
<Route path="/cart" element={<CheckoutPage />} />      // ✅ CORRETTO
```

**File da verificare**:

- `backend/src/application/services/link-generator.service.ts` (linea 49-55)
- `frontend/src/App.tsx` (verificare route definition)
- `frontend/src/pages/CheckoutPage.tsx` (linea 87 - token parsing)
- `backend/src/services/calling-functions.service.ts` (linea 685-700)
- `backend/src/domain/calling-functions/AddProduct.ts` (linea 168-169)

**Test manuale**:

```bash
# 1. Generate cart token
curl -X POST http://localhost:3001/api/cart/generate-token \
  -H "Content-Type: application/json" \
  -d '{"customerId":"xxx","workspaceId":"yyy"}'

# 2. Copy token from response

# 3. Open browser: http://localhost:3000/cart?token=COPIED_TOKEN
# Expected: CheckoutPage loads with cart items

# 4. Verify URL shortener:
# Link should be shortened: http://localhost:3000/s/abc123
# Should redirect to: http://localhost:3000/cart?token=xxx
```

**Priorità**: 🔥 ALTA - Link carrello è funzionalità core per conversione ordini

---

#### 7. 🗑️ Remove QueryAnalyzerAgent Completely - Switch to {{PRODUCTS}} Strategy

**Obiettivo**: Rimuovere QueryAnalyzerAgent a 360° e passare a strategia diretta con variabile `{{PRODUCTS}}` nel prompt di Product Search Agent.

**Problema attuale**:

- QueryAnalyzerAgent aggiunge complessità inutile
- Sub-agent call rallenta risposta
- Strategia migliore: dare TUTTI i prodotti direttamente a Product Search Agent
- Agent può fare ricerche incrociate autonomamente

**Nuova strategia**:

```markdown
Product Search Agent riceve nel prompt:

## 📦 AVAILABLE PRODUCTS

{{PRODUCTS}}

Può interrogare direttamente tutti i prodotti e fare:

- Ricerche per categoria
- Ricerche per certificazione (DOP, Halal, etc)
- Ricerche incrociate (categoria + prezzo + certificazione)
- Comparazioni prodotti
```

**Task**:

- [ ] **Rimuovere QueryAnalyzerAgent dal database**:
  - Eliminare entry da `defaultAgents.ts`
  - Rimuovere AgentType `QUERY_ANALYZER` da schema (migration)
  - Verificare che seed non lo ricrei
- [ ] **Rimuovere QueryAnalyzerAgent dal frontend**:
  - Eliminare rendering in `AgentConfigurationPage.tsx` (linee 793-799)
  - Rimuovere da `AGENT_CALL_FUNCTIONS` mapping
  - Togliere badge "🔬 Query Analysis"
- [ ] **Rimuovere QueryAnalyzerAgent logic dal backend**:
  - Eliminare file `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`
  - Rimuovere chiamate a QueryAnalyzer da `ProductSearchAgentLLM.ts`
  - Pulire imports e references
- [ ] **Aggiungere {{PRODUCTS}} a Product Search Agent**:
  - Modificare `product-search-agent.md`: aggiungere sezione con `{{PRODUCTS}}` variable
  - Implementare `replaceAllVariables()` per sostituire `{{PRODUCTS}}` con lista prodotti completa
  - Formato prodotti: JSON compatto con campi essenziali (id, name, category, price, certifications)
- [ ] **Update PromptProcessorService**:
  - Aggiungere logica per sostituire `{{PRODUCTS}}` con query database
  - Ottimizzare query: solo campi necessari (no descrizioni lunghe)
  - Cache prodotti se workspace non cambia
- [ ] **Testare nuova strategia**:
  - "Cerca formaggi DOP" → Agent usa {{PRODUCTS}} per filtrare
  - "Prodotti halal sotto 20 euro" → Ricerca incrociata
  - "Confronta parmigiano e grana" → Comparazione diretta

**Vantaggi nuova strategia**:

- ✅ **Più veloce**: No sub-agent call
- ✅ **Più semplice**: Un solo agent invece di due
- ✅ **Più potente**: Ricerche incrociate senza limitazioni
- ✅ **Meno token**: No doppia chiamata LLM
- ✅ **Più manutenibile**: Un prompt invece di due

**File da modificare**:

- `backend/prisma/schema.prisma` (rimuovere AgentType.QUERY_ANALYZER)
- `backend/prisma/data/defaultAgents.ts` (eliminare QueryAnalyzer)
- `backend/src/application/agents/QueryAnalyzerAgentLLM.ts` (DELETE FILE)
- `backend/src/application/agents/ProductSearchAgentLLM.ts` (rimuovere chiamate QueryAnalyzer)
- `docs/prompts/product-search-agent.md` (aggiungere {{PRODUCTS}} section)
- `backend/src/application/services/prompt-processor.service.ts` (add {{PRODUCTS}} logic)
- `frontend/src/pages/AgentConfigurationPage.tsx` (rimuovere QueryAnalyzer UI)

**Migration necessaria**:

```sql
-- Remove QUERY_ANALYZER from AgentType enum
-- Migration: remove_query_analyzer_agent
```

**Priorità**: 🔥 ALTA - Semplificazione architettura e performance boost

---

#### 8. 🧹 Cleanup & Remove Obsolete Calling Functions from Product Search Agent

**Obiettivo**: Pulizia completa del workspace + rimozione Calling Functions obsolete da Product Search Agent.

**Parte 1: Pulizia generale workspace**

**Problema**:

- File script temporanei che fanno confusione
- Test file lasciati in giro
- File .bak, .old, backup multipli
- Log files vecchi
- Temp directories non usati

**Task pulizia**:

- [ ] **Identificare file temporanei**: Cercare `.bak`, `.old`, `.temp`, `test-*.ts` in root backend
- [ ] **Pulire root backend**:
  - `backend/test-product-memory-fix.ts` (DELETE)
  - `backend/test-state-based-flow.ts` (DELETE)
  - `backend/test-step2-auto-delegation.ts` (DELETE)
  - Altri test-\*.ts files temporanei
- [ ] **Pulire logs vecchi**:
  - Tenere solo ultimi 7 giorni in `backend/logs/`
  - Cancellare prompt-debug più vecchi di 1 settimana
- [ ] **Pulire backup files**:
  - `.env.backup.*` più vecchi di 1 mese
  - `docs/prompt_agent.md.bak` (verificare se necessario)
- [ ] **Verificare .gitignore**: Assicurarsi che temp files non vadano in git
- [ ] **Pulire node_modules cache** (opzionale): `npm cache clean --force` se necessario

**File da eliminare** (verificare prima):

```
backend/
├── test-product-memory-fix.ts           ❌ DELETE
├── test-state-based-flow.ts             ❌ DELETE
├── test-step2-auto-delegation.ts        ❌ DELETE
├── logs/prompt-debug-*.txt (vecchi)     ❌ DELETE (>7 giorni)
└── .env.backup.* (vecchi)               ❌ DELETE (>1 mese)

docs/
└── prompt_agent.md.bak                  ❌ DELETE (se non serve)
```

---

**Parte 2: Rimuovere CF obsolete da Product Search Agent**

**Problema**:

- Con strategia `{{PRODUCTS}}`, `searchProducts` e `searchProductByCertifications` NON servono più
- Product Search Agent ha TUTTI i prodotti nel prompt → può filtrare autonomamente
- Calling Functions inutili rallentano e confondono LLM

**Calling Functions da RIMUOVERE**:

- ❌ `searchProducts` - Obsoleto (agent ha già {{PRODUCTS}})
- ❌ `searchProductByCertifications` - Obsoleto (agent filtra da {{PRODUCTS}})

**Calling Functions da MANTENERE**:

- ✅ `cartManagementAgent` - Delega al Cart Agent per aggiungere prodotti

**Task CF cleanup**:

- [ ] **Aggiornare product-search-agent.md**:
  - Rimuovere documentazione `searchProducts` e `searchProductByCertifications`
  - Aggiornare esempi: Agent filtra da {{PRODUCTS}} invece di chiamare CF
  - Mantenere solo `cartManagementAgent` call
- [ ] **Aggiornare defaultAgents.ts**:
  - Product Search Agent `availableFunctions`: solo `["cartManagementAgent"]`
  - Rimuovere `searchProducts` e `searchProductByCertifications` dalla lista
- [ ] **Aggiornare frontend AgentConfigurationPage**:
  - `AGENT_CALL_FUNCTIONS` mapping: `PRODUCT_SEARCH: ["cartManagementAgent"]`
  - Rimuovere vecchie CF dalla visualizzazione
- [ ] **Verificare CallingFunctionsService**:
  - Mantenere implementazioni `searchProducts` e `searchProductByCertifications` per backward compatibility
  - Aggiungere TODO/commento: "Kept for legacy support, not used by new agents"
- [ ] **Testare Product Search Agent**:
  - "Cerca formaggi DOP" → Agent filtra da {{PRODUCTS}}, NO CF call
  - "Aggiungi mozzarella al carrello" → Chiama `cartManagementAgent` ✅

**Schema finale Product Search Agent**:

```typescript
Product Search Agent (order: 2)
  - Temperature: 0.3
  - Max Tokens: 2048
  - Calling Functions: ["cartManagementAgent"]  // Solo questo!
  - Prompt: include {{PRODUCTS}} variable
  - Logic: Filtra prodotti autonomamente, delega solo cart operations
```

**File da modificare**:

- `docs/prompts/product-search-agent.md` (rimuovere CF documentation)
- `backend/prisma/data/defaultAgents.ts` (update availableFunctions)
- `frontend/src/pages/AgentConfigurationPage.tsx` (update AGENT_CALL_FUNCTIONS)
- `backend/src/services/calling-functions.service.ts` (add legacy comment)

**Priorità**: 🟡 MEDIA - Pulizia e semplificazione (non urgente ma importante)

---

#### 9. 🗑️ Remove Translation Agent Completely - Router Multi-Language Direct

**Obiettivo**: Rimuovere Translation Agent a 360° e passare gestione multi-lingua direttamente a Router Agent.

**Motivazione**:

- ✅ Con variabili `{{PRODUCTS}}`, `{{CATEGORIES}}`, `{{OFFERS}}` → tutto già in italiano
- ✅ Router può gestire IT/ES/PT/FR/EN direttamente (GPT-4-mini multilingua nativo)
- ✅ **-1 LLM call** → più veloce + meno costi
- ✅ Architettura più semplice (6 agents invece di 7)
- ✅ No bisogno traduzione prodotti → già in italiano nel prompt

**Nuova strategia Router**:

```markdown
Router Agent:

- Input: IT/ES/PT/FR/EN (gestito direttamente)
- Variables: {{PRODUCTS}}, {{CATEGORIES}}, {{OFFERS}} (in italiano - lingua base)
- Output: Delega a specialist agent con context originale
- Nomi prodotti: Preservati automaticamente (già in italiano)
```

**Task**:

- [ ] **Rimuovere Translation Agent dal database**:
  - Eliminare entry da `defaultAgents.ts`
  - Rimuovere AgentType `TRANSLATION` da schema (migration)
  - Verificare che seed non lo ricrei
- [ ] **Rimuovere Translation Agent dal frontend**:
  - Eliminare rendering in `AgentConfigurationPage.tsx`
  - Rimuovere da `AGENT_CALL_FUNCTIONS` mapping
  - Togliere da visual hierarchy
- [ ] **Rimuovere Translation Agent logic dal backend**:
  - Eliminare file `backend/src/application/agents/TranslationAgentLLM.ts` (se esiste)
  - Eliminare prompt `docs/prompts/translation-agent.md`
  - Rimuovere chiamate a Translation da `llm-router.service.ts`
  - Pulire imports e references
- [ ] **Aggiornare Router Agent prompt**:
  - `router-agent.md`: Aggiungere sezione multi-language handling
  - Istruzioni: "Accetta IT/ES/PT/FR/EN direttamente, delega con lingua originale"
  - Esempi: "Hola, quiero mozzarella" → productSearchAgent(query="quiero mozzarella")
- [ ] **Update llm-router.service.ts**:
  - Rimuovere step Translation Agent (order: -1)
  - Router diventa primo agent (order: 0)
  - No pre-processing traduzione
- [ ] **Testare multi-language flow**:
  - IT: "Voglio formaggi DOP" → Router → ProductSearch
  - ES: "Quiero mozzarella" → Router → ProductSearch
  - PT: "Preciso de prosciutto" → Router → ProductSearch
  - FR: "Je veux parmigiano" → Router → ProductSearch
  - EN: "I want gorgonzola" → Router → ProductSearch

**Vantaggi**:

- ✅ **Performance**: -1 LLM call = ~200-500ms più veloce
- ✅ **Costi**: -512 tokens per messaggio (Translation max tokens)
- ✅ **Semplicità**: 6 agents vs 7, meno complessità
- ✅ **Manutenibilità**: Un prompt in meno da gestire
- ✅ **Naturalezza**: Nomi prodotti italiani preservati nativamente

**File da modificare**:

- `backend/prisma/schema.prisma` (rimuovere AgentType.TRANSLATION)
- `backend/prisma/data/defaultAgents.ts` (eliminare Translation)
- `docs/prompts/translation-agent.md` (DELETE FILE)
- `backend/src/application/agents/TranslationAgentLLM.ts` (DELETE FILE se esiste)
- `docs/prompts/router-agent.md` (aggiungere multi-language section)
- `backend/src/services/llm-router.service.ts` (rimuovere Translation step)
- `frontend/src/pages/AgentConfigurationPage.tsx` (rimuovere Translation UI)

**Migration necessaria**:

```sql
-- Remove TRANSLATION from AgentType enum
-- Migration: remove_translation_agent
```

**Priorità**: 🔥 ALTA - Performance boost + semplificazione architettura

---

#### 10. 🌱 Database Seed Cleanup & Optimization

**Obiettivo**: Sistemare e pulire completamente il seed del database rimuovendo dati inutili e ottimizzando struttura.

**Problema attuale**:

- Seed contiene dati di test obsoleti
- Prodotti/categorie/offerte duplicate o non necessarie
- Configurazioni vecchie di agent rimossi
- Troppi dati che rendono seed lento

**Task**:

- [ ] **Audit seed completo**: Leggere `backend/prisma/seed.ts` e identificare bloat
- [ ] **Rimuovere agent obsoleti dal seed**:
  - Translation Agent (se presente)
  - QueryAnalyzer Agent (se presente)
  - Vecchie configurazioni non più usate
- [ ] **Pulire prodotti**:
  - Tenere solo prodotti rappresentativi (max 20-30)
  - Varietà: formaggi DOP, salumi, pasta, dolci
  - Rimuovere duplicati e prodotti test
- [ ] **Pulire categorie**:
  - Solo categorie necessarie (Formaggi, Salumi, Pasta, Dolci, Bevande)
  - Rimuovere categorie vuote o non usate
- [ ] **Pulire offerte**:
  - Max 3-5 offerte attive rappresentative
  - Rimuovere offerte scadute o test
- [ ] **Ottimizzare workspaces**:
  - Seed solo 1 workspace di default (non multipli)
  - Configurazione pulita e minimal
- [ ] **Verificare referential integrity**:
  - Tutti i foreign keys corretti
  - No orphan records
- [ ] **Test seed**:
  ```bash
  npx prisma migrate reset --force
  npm run seed
  # Verificare: workspace, agents, prodotti, categorie
  ```

**File da modificare**:

- `backend/prisma/seed.ts` (cleanup completo)
- `backend/prisma/data/defaultAgents.ts` (verificare 6 agents finali)

**Priorità**: 🟡 MEDIA - Importante per manutenibilità

---

#### 11. 🗑️ Remove Delegate Pattern & Reset Status Logic

**Obiettivo**: Rimuovere completamente il sistema delegate e la logica di reset status che abbiamo implementato temporaneamente.

**Cosa rimuovere**:

**1. Delegate pattern nel database**:

- [ ] Rimuovere campo `delegateToAgent` da tabella (se esiste)
- [ ] Rimuovere campo `delegateData` o simili
- [ ] Migration per cleanup schema

**2. Reset status logic**:

- [ ] Rimuovere funzioni `resetConversationStatus()` o simili
- [ ] Rimuovere chiamate a reset status nel codice
- [ ] Pulire state management conversazioni

**3. Dati da filtrare temporanei**:

- [ ] Rimuovere campi `filteredProducts` (se salvati in DB)
- [ ] Rimuovere `temporaryFilters` o cache temporanee
- [ ] Pulire session data non più necessari

**4. Codice delegate nel backend**:

- [ ] Cercare `DELEGATE`, `delegate`, `resetStatus` nel codice
- [ ] Rimuovere pattern DELEGATE*TO*\* dal prompt
- [ ] Semplificare chiamate dirette a specialist agents

**Task specifici**:

- [ ] **Audit delegate pattern**: `grep -r "DELEGATE" backend/src/`
- [ ] **Audit reset status**: `grep -r "resetStatus\|reset.*conversation" backend/src/`
- [ ] **Rimuovere da prompts**:
  - `product-search-agent.md`: Togliere DELEGATE_TO_CART pattern
  - Altri prompts: Verificare e pulire
- [ ] **Semplificare ProductSearchAgent**:
  - Chiamata diretta a `cartManagementAgent` CF (già fatto)
  - Rimuovere logiche delegate complesse
- [ ] **Pulire database**:
  - Migration per rimuovere campi delegate
  - Clean orphan data

**Grep commands per trovare codice da rimuovere**:

```bash
# Backend
grep -r "DELEGATE" backend/src/ --include="*.ts"
grep -r "delegateToAgent" backend/src/ --include="*.ts"
grep -r "resetStatus" backend/src/ --include="*.ts"

# Prompts
grep -r "DELEGATE" docs/prompts/ --include="*.md"
```

**File potenzialmente da modificare**:

- `backend/src/application/agents/ProductSearchAgentLLM.ts`
- `backend/src/services/llm-router.service.ts`
- `docs/prompts/product-search-agent.md`
- `backend/prisma/schema.prisma` (se ci sono campi delegate)

**Priorità**: 🟡 MEDIA - Pulizia importante

---

#### 12. 🤖 Complete Chatbot Flows - End-to-End Implementation

**Obiettivo**: Ragionare su TUTTI i flussi conversazionali e completare il chatbot per coprire ogni scenario utente.

**Flussi principali da analizzare e completare**:

**1. Product Search Flow** ✅ (già implementato con Smart Parsing):

- User: "Voglio formaggi DOP"
- Router → ProductSearch
- ProductSearch filtra da {{PRODUCTS}}
- Mostra gruppi → User seleziona → Mostra prodotto → Aggiungi carrello
- ✅ DONE con extractGroupText + filterByGroupKeywords

**2. Cart Management Flow**:

- [ ] **View Cart**: "Vedi il mio carrello"
  - Router → CartManagement → viewCart CF
  - Mostra items, totale, link checkout
- [ ] **Add to Cart**: Già gestito da ProductSearch → cartManagementAgent
- [ ] **Clear Cart**: "Svuota il carrello"
  - Router → CartManagement → clearCart CF
- [ ] **Edge cases**:
  - Carrello vuoto → messaggio chiaro + suggerimento prodotti
  - Prodotto già in carrello → aggiornare quantità o messaggio
  - Carrello pieno (max items?) → gestione limite

**3. Order Tracking Flow**:

- [ ] **View Orders**: "I miei ordini"
  - Router → OrderTracking → getOrders CF
  - Lista ordini con status, totale, data
- [ ] **Track Specific Order**: "Dove è il mio ordine #12345?"
  - Router → OrderTracking → trackOrder CF
  - Stato spedizione, tracking number
- [ ] **Repeat Last Order**: "Riordina ultimo ordine"
  - Router → OrderTracking → repeatLastOrder CF
  - Ricrea carrello con prodotti dell'ultimo ordine
- [ ] **Invoice Request**: "Mandami fattura ordine #12345"
  - Router → OrderTracking → sendInvoice CF
  - Invia PDF fattura via email

**4. Customer Support Flow**:

- [ ] **General Support**: "Ho un problema"
  - Router → CustomerSupport → contactSupport CF
  - Invia notifica a team support
- [ ] **Panic Mode**: "Voglio parlare con una persona!" (TODO #4)
  - Router riconosce panico → CustomerSupport immediato
- [ ] **FAQ auto-response**: Domande comuni
  - "Quali metodi di pagamento?" → risposta diretta da Router
  - "Tempi di consegna?" → info da workspace config

**5. Multi-turn Conversation Flow**:

- [ ] **Context persistence**: Conversation memory tra turni
  - SessionId già persistente ✅
  - Smart Parsing mantiene gruppo selezionato ✅
- [ ] **Clarification requests**: "Quale formaggi intendi?"
  - LLM chiede disambiguazione
  - User risponde → continua flow
- [ ] **Change mind mid-flow**: "No, voglio altro"
  - Reset partial selection, torna a search

**6. Multi-language Flow** (dopo rimozione Translation Agent):

- [ ] **Router multi-lingua**: IT/ES/PT/FR/EN direct handling
  - Test ogni lingua con prodotti italiani preservati
  - Verifica risposte coerenti con lingua input

**7. Error Handling Flows**:

- [ ] **Product not found**: "Voglio caviale"
  - ProductSearch non trova → messaggio chiaro + alternative
- [ ] **Invalid order**: "Ordine #99999"
  - OrderTracking → order non esiste → messaggio errore
- [ ] **Empty cart checkout**: User clicca link carrello vuoto
  - Frontend mostra messaggio + suggerimento prodotti
- [ ] **Expired token**: Link carrello scaduto
  - Frontend mostra errore chiaro + CTA per ricontattare

**Task di completamento**:

- [ ] **Audit ogni agent prompt**: Verificare che copra tutti i casi d'uso
- [ ] **Implementare CF mancanti**: Se necessario per flussi
- [ ] **Test end-to-end per ogni flow**: Simulare conversazioni complete
- [ ] **Edge cases documentation**: Documentare comportamenti attesi
- [ ] **Error messages**: Messaggi user-friendly per ogni errore possibile

**Test scenarios da creare**:

```bash
# 1. Happy path completo
User: "Voglio formaggi DOP"
→ Mostra gruppi → "2" → Mostra prodotto → "Aggiungi carrello" → Link checkout

# 2. Multi-turn con cambio idea
User: "Voglio salumi"
→ Mostra gruppi → "No, preferisco formaggi" → Nuova ricerca

# 3. Panic escalation
User: "Non riesco a ordinare, aiuto!"
→ Router panic mode → CustomerSupport

# 4. Order tracking
User: "Dove è il mio ordine?"
→ OrderTracking → Lista ordini → User seleziona → Tracking info

# 5. Multi-language
User (ES): "Quiero mozzarella di bufala"
→ Router comprende → ProductSearch → Prodotto trovato
```

**File da verificare/completare**:

- `docs/prompts/router-agent.md` (routing completo + panic mode)
- `docs/prompts/product-search-agent.md` ({{PRODUCTS}} + edge cases)
- `docs/prompts/cart-management-agent.md` (view/clear/add flows)
- `docs/prompts/order-tracking-agent.md` (tutti i comandi ordini)
- `docs/prompts/customer-support-agent.md` (panic + support flows)

**Priorità**: 🔥🔥 MASSIMA - Core business del chatbot

---

#### 13. 🔍 Audit Complete Calling Functions - Find Missing Implementations

**Obiettivo**: Ragionare su TUTTE le Calling Functions previste e identificare cosa NON è stato ancora implementato.

**Calling Functions previste per agent** (dallo schema architettura):

### **Router Agent CF**:

1. ✅ `productSearchAgent` - Delega a Product Search (implementato)
2. ✅ `cartManagementAgent` - Delega a Cart Management (implementato)
3. ✅ `orderTrackingAgent` - Delega a Order Tracking (implementato)
4. ✅ `customerSupportAgent` - Delega a Customer Support (implementato)
5. ✅ `handlePushNotifications` - Gestione notifiche push (implementato)

### **Product Search Agent CF**:

1. ✅ `cartManagementAgent` - Delega al cart dopo selezione prodotto (implementato)
2. ❌ `searchProducts` - **DA RIMUOVERE** (TODO #8 - obsoleto con {{PRODUCTS}})
3. ❌ `searchProductByCertifications` - **DA RIMUOVERE** (TODO #8 - obsoleto con {{PRODUCTS}})

### **Cart Management Agent CF**:

1. ✅ `addToCart` - Aggiungi prodotto al carrello (implementato in AddProduct.ts)
2. ✅ `viewCart` - Mostra carrello con link checkout (implementato - getCartLink)
3. ✅ `clearCart` - Svuota carrello (implementato in ResetCart.ts)
4. ❌ `removeFromCart` - **DA RIMUOVERE** (TODO #3 - non necessario)
5. ❌ `updateCartQuantity` - **DA RIMUOVERE** (TODO #3 - non necessario)

### **Order Tracking Agent CF**:

1. ⚠️ `getOrders` - **IMPLEMENTAZIONE PARZIALE** (getOrdersListLink esiste, ma CF specifica manca)
2. ⚠️ `getOrder` - **DA IMPLEMENTARE** (get ordine specifico by ID)
3. ⚠️ `trackOrder` - **DA IMPLEMENTARE** (tracking spedizione specifico)
4. ⚠️ `sendInvoice` - **DA IMPLEMENTARE** (invio PDF fattura via email)
5. ✅ `repeatLastOrder` - Riordina ultimo ordine (implementato in RepeatOrder.ts)

### **Customer Support Agent CF**:

1. ✅ `contactSupport` - Contatta supporto (implementato in ContactOperator.ts)

### **Safety Agent CF**:

1. ⚠️ `sendAlertEmail` - **DA IMPLEMENTARE** (invio email alert per contenuti pericolosi)

---

## 📊 ANALISI DETTAGLIATA - Cosa manca

### **🔴 MISSING - Da implementare SUBITO**:

**1. Order Tracking Agent - `getOrder(orderId)`**:

```typescript
// File: backend/src/domain/calling-functions/GetOrder.ts (NON ESISTE)
export async function getOrder(request: {
  customerId: string
  workspaceId: string
  orderId: string
}): Promise<{
  success: boolean
  order?: Order
  error?: string
}>
```

**Uso**: "Mostrami ordine #12345" → Dettagli ordine specifico

---

**2. Order Tracking Agent - `trackOrder(orderId)`**:

```typescript
// File: backend/src/domain/calling-functions/TrackOrder.ts (NON ESISTE)
export async function trackOrder(request: {
  customerId: string
  workspaceId: string
  orderId: string
}): Promise<{
  success: boolean
  tracking?: {
    status: string
    trackingNumber: string
    carrier: string
    estimatedDelivery: string
    updates: TrackingUpdate[]
  }
  error?: string
}>
```

**Uso**: "Dov'è il mio ordine #12345?" → Stato spedizione real-time

---

**3. Order Tracking Agent - `sendInvoice(orderId)`**:

```typescript
// File: backend/src/domain/calling-functions/SendInvoice.ts (NON ESISTE)
export async function sendInvoice(request: {
  customerId: string
  workspaceId: string
  orderId: string
  email?: string // Optional - usa customer email se non specificato
}): Promise<{
  success: boolean
  message: string
  invoiceUrl?: string
  error?: string
}>
```

**Uso**: "Mandami fattura ordine #12345" → Invia PDF via email + link download

---

**4. Safety Agent - `sendAlertEmail()`**:

```typescript
// File: backend/src/domain/calling-functions/SendAlertEmail.ts (NON ESISTE)
export async function sendAlertEmail(request: {
  workspaceId: string
  customerId: string
  alertType: "INAPPROPRIATE_CONTENT" | "SCAM_ATTEMPT" | "HARASSMENT" | "OTHER"
  messageContent: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}): Promise<{
  success: boolean
  message: string
  alertId?: string
}>
```

**Uso**: Safety Agent rileva contenuto pericoloso → Invia email immediata a admin

---

### **🟡 PARTIAL - Implementazione parziale da completare**:

**5. Order Tracking Agent - `getOrders()`**:

- ✅ **Esiste**: `getOrdersListLink()` in calling-functions.service.ts
- ❌ **Problema**: Restituisce solo LINK, non lista ordini diretta
- 🔧 **Fix necessario**:

  ```typescript
  // Opzione A: Restituire lista ordini direttamente
  export async function getOrders(request: {
    customerId: string
    workspaceId: string
    limit?: number
  }): Promise<{
    success: boolean
    orders: Order[]
    total: number
  }>

  // Opzione B: Mantenere link ma aggiungere preview
  // Link + primi 3 ordini in messaggio
  ```

---

### **🟢 IMPLEMENTED - Già funzionanti**:

1. ✅ `productSearchAgent` - Router delega
2. ✅ `cartManagementAgent` - Router/ProductSearch delega
3. ✅ `orderTrackingAgent` - Router delega
4. ✅ `customerSupportAgent` - Router delega
5. ✅ `handlePushNotifications` - Gestione notifiche (ManageNotifications.ts)
6. ✅ `addToCart` - AddProduct.ts (con link carrello)
7. ✅ `clearCart` - ResetCart.ts
8. ✅ `repeatLastOrder` - RepeatOrder.ts (ricrea carrello da ultimo ordine)
9. ✅ `contactSupport` - ContactOperator.ts (invia notifica support)
10. ✅ `searchProduct` - SearchProduct.ts (ma DA RIMUOVERE con {{PRODUCTS}})

---

## 📋 TASK TODO #13

**Implementazioni mancanti**:

- [ ] **CreateFile**: `backend/src/domain/calling-functions/GetOrder.ts`
- [ ] **CreateFile**: `backend/src/domain/calling-functions/TrackOrder.ts`
- [ ] **CreateFile**: `backend/src/domain/calling-functions/SendInvoice.ts`
- [ ] **CreateFile**: `backend/src/domain/calling-functions/SendAlertEmail.ts`
- [ ] **UpdateFile**: Migliorare `getOrders()` per restituire lista ordini diretta (non solo link)

**Aggiornamenti CallingFunctionsService**:

- [ ] Aggiungere metodi public per nuove CF:
  - `public async getOrder(request)`
  - `public async trackOrder(request)`
  - `public async sendInvoice(request)`
  - `public async sendAlertEmail(request)`
- [ ] Aggiornare `getOrders()` con lista ordini diretta

**Aggiornamenti Prompts**:

- [ ] `order-tracking-agent.md`: Documentare `getOrder`, `trackOrder`, `sendInvoice`
- [ ] `safety-translation-agent.md`: Documentare `sendAlertEmail`

**Test**:

- [ ] Test `getOrder`: "Mostrami ordine #ORD-001"
- [ ] Test `trackOrder`: "Dov'è il mio ordine #ORD-001?"
- [ ] Test `sendInvoice`: "Mandami fattura ordine #ORD-001"
- [ ] Test `sendAlertEmail`: Safety Agent rileva contenuto inappropriato

**Dipendenze**:

- Email service per `sendInvoice` e `sendAlertEmail`
- Tracking API integration per `trackOrder` (o mock se non disponibile)
- PDF generator per fatture (o link a PDF esistente)

**Priorità**: 🔥 ALTA - CF mancanti bloccano flussi Order Tracking e Safety

---

## 📝 Note

- Andrea aggiunge TODO ad ogni interazione
- Ogni TODO viene implementato, testato e marcato come completato prima di procedere al successivo
- Database seed viene aggiornato quando necessario
- Testing manuale con curl per verificare comportamento degli agent
