# 🎯 Progressive Discovery & Funnel - Esempi Pratici Chat

**Data**: 5 Novembre 2025  
**Feature**: QueryAnalyzerAgent + Progressive Discovery Pattern

---

## 📋 Architettura del Funnel

```
Customer Query (WhatsApp)
    ↓
Router Agent (LEVEL 1) → classifica intent: PRODUCT_SEARCH
    ↓
Product Search Agent (LEVEL 2) → delega analisi query
    ↓
Query Analyzer Agent (LEVEL 3) 🔬 → analizza multi-lingua + estrae filtri
    ↓
ProductRepository → Database (filtra prodotti)
    ↓
Product Search Agent (LEVEL 2) → formatta risposta con funnel logic
    ↓
Safety & Translation Agent → traduce in lingua cliente
    ↓
WhatsApp → Cliente
```

---

## 🎨 Pattern: Progressive Discovery

### STEP 1️⃣: Query Generica → Lista Nomi

Quando il cliente fa una **ricerca BROAD** (es: "surgelati", "formaggi"), il sistema:

1. 🔍 Trova MOLTI prodotti (5+)
2. 📝 Estrae **SOLO I NOMI** (es: "Arancini, Funghi, Tortellini")
3. ❓ Chiede al cliente di raffinare la scelta
4. 🚫 **NON** mostra prezzi, stock, descrizioni

### STEP 2️⃣: Query Specifica → Dettagli Completi

Quando il cliente **RAFFINA** (es: "arancini siciliani"), il sistema:

1. 🔍 Trova POCHI prodotti (1-4)
2. 📦 Mostra **DETTAGLI COMPLETI**: CODE, Nome, Prezzo, Descrizione, Stock, Certificazioni
3. 💰 Menziona sconto personale
4. 🛒 Offre aggiunta al carrello

---

## 💬 ESEMPIO 1: Prodotti Surgelati (Italiano)

### 🗨️ Conversazione Completa

```
👤 Cliente: che surgelati avete?

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "che surgelati avete?"
Language: IT
Filters: {
  keywords: ["surgelati"],
  categoryIds: [],
  regions: [],
  certifications: []
}
Reasoning: "Generic query about frozen products"

📦 [BACKEND - ProductRepository]
Results: 8 prodotti trovati
- Arancini Siciliani al Ragù Surgelati
- Funghi Porcini Trifolati Surgelati
- Tortellini Emiliani Surgelati
- Supplì Romani al Telefono Surgelati
- Carciofi alla Romana Surgelati
- Ravioli Ricotta e Spinaci Surgelati
- Melanzane alla Parmigiana Surgelate
- Lasagne Bolognesi Surgelate

🤖 [STEP 1 - Smart Summary con Domanda Intelligente]
Bot: Ciao Marco! Abbiamo diversi surgelati:
Funghi, Tagliatelle, Lasagne, Arancini, Carciofi, Supplì.

Ti interessano primi piatti o contorni? 🍝

---

👤 Cliente: primi piatti

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "primi piatti"
Conversational Context: ✅ Ricorda "surgelati"
Filters: {
  keywords: ["surgelati", "primi"],
  categoryIds: [],
  regions: [],
  certifications: []
}

📦 [BACKEND - ProductRepository]
Results: 3 prodotti trovati
- Tagliatelle Surgelate
- Lasagne Bolognesi Surgelate
- Ravioli Ricotta e Spinaci Surgelati

🤖 [STEP 2 - Ancora Multipli, Chiedi Quale]
Bot: Perfetto! Per i primi piatti abbiamo:
Tagliatelle, Lasagne, Ravioli.

Quale preferisci? 🍝

---

👤 Cliente: lasagne

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "voglio un prodotto surgelato siciliano"
Language: IT
Conversational Context: {
  lastQuery: "che surgelati avete?",
  lastResponse: "Found 8 products"
}
Filters: {
  keywords: ["surgelato", "siciliano"],
  categoryIds: [],
  regions: ["Sicily"],
  certifications: []
}
Reasoning: "Customer refining search to Sicilian frozen products"

📦 [BACKEND - ProductRepository]
Results: 1 prodotto trovato
- Arancini Siciliani al Ragù Surgelati 6pz (€9.50 → €8.55 con sconto 10%)

🤖 [STEP 2 - Dettagli Completi]
Bot: Perfetto! Ecco il tuo prodotto:

**PRODOTTI SURGELATI**
• SUR-ARA-001 Arancini Siciliani al Ragù Surgelati 6pz ~€9.50~ → €8.55
  Autentici arancini siciliani al ragù di manzo, piselli e mozzarella. Pronti in 15 minuti!
  Stock: ✅ 20 disponibili | 🔖 Tradizionale

Con il tuo sconto del 10% paghi €8.55! 🎉
Vuoi aggiungerli al carrello? 🛒
```

---

## 💬 ESEMPIO 2: Formaggi + Regione (Inglese)

### 🗨️ Conversazione Completa

```
👤 Customer: what cheese do you have?

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "what cheese do you have?"
Language: EN
Filters: {
  keywords: ["formaggio"], // ✅ Translated to Italian!
  categoryIds: ["<cheese-category-uuid>"],
  regions: [],
  certifications: []
}
Reasoning: "Generic cheese query in English, translated to Italian base language"

📦 [BACKEND - ProductRepository]
Results: 6 prodotti trovati
- Parmigiano Reggiano DOP 24 mesi
- Pecorino Sardo DOP Stagionato
- Gorgonzola Piccante
- Burrata Pugliese
- Mozzarella di Bufala Campana DOP
- Taleggio Lombardo

🤖 [STEP 1 - Lista Nomi]
Bot: Hi Marco! We have several cheeses:
Parmigiano, Pecorino, Gorgonzola, Burrata, Mozzarella, Taleggio.

Which one interests you? 🧀

---

👤 Customer: sardinian cheese

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "sardinian cheese"
Language: EN
Conversational Context: {
  lastQuery: "what cheese do you have?",
  lastResponse: "Found 6 cheeses"
}
Filters: {
  keywords: ["formaggio", "sardo"], // ✅ Translated!
  categoryIds: ["<cheese-category-uuid>"],
  regions: ["Sardinia"], // ✅ Mapped to English region name!
  certifications: []
}
Reasoning: "Customer refining to Sardinian cheese, region mapped correctly"

📦 [BACKEND - ProductRepository]
Results: 1 prodotto trovato
- Pecorino Sardo DOP Stagionato 12 mesi 400g (€12.00 → €10.80 con sconto 10%)

🤖 [STEP 2 - Dettagli Completi]
Bot: Perfect! Here's your Sardinian cheese:

**CHEESE PRODUCTS**
• FOR-PEC-001 Pecorino Sardo DOP Stagionato 12 mesi 400g ~€12.00~ → €10.80
  Authentic aged Sardinian sheep cheese with intense flavor.
  Stock: ✅ 12 available | 🔖 DOP

With your 10% discount you pay €10.80! 🎉
Want to add it to cart? 🛒
```

---

## 💬 ESEMPIO 3: Ricerca Multi-Criterio (Spagnolo)

### 🗨️ Conversazione Completa

```
👤 Cliente: productos orgánicos de Emilia-Romagna

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "productos orgánicos de Emilia-Romagna"
Language: ES
Filters: {
  keywords: ["prodotti", "biologici"], // ✅ Translated to Italian!
  categoryIds: [],
  regions: ["Emilia-Romagna"], // ✅ Region recognized!
  certifications: ["isOrganic"] // ✅ Certification mapped!
}
Reasoning: "Spanish query for organic products from Emilia-Romagna region"

📦 [BACKEND - ProductRepository]
Results: 2 prodotti trovati
- Parmigiano Reggiano DOP Bio 24 mesi
- Aceto Balsamico di Modena IGP Bio

🤖 [STEP 2 - Dettagli Completi (meno di 5 prodotti)]
Bot: ¡Perfecto! Estos son los productos orgánicos de Emilia-Romagna:

**QUESOS**
• FOR-PAR-002 Parmigiano Reggiano DOP Bio 24 mesi 500g ~€15.00~ → €13.50
  Parmigiano orgánico envejecido de Emilia-Romagna.
  Stock: ✅ 8 disponibles | 🔖 DOP, Bio

**CONDIMENTOS**
• CON-ACE-001 Aceto Balsamico di Modena IGP Bio 250ml ~€8.00~ → €7.20
  Vinagre balsámico orgánico tradicional de Módena.
  Stock: ✅ 15 disponibles | 🔖 IGP, Bio

¡Con tu descuento del 10% pagas €13.50 y €7.20! 🎉
¿Quieres agregarlos al carrito? 🛒
```

---

## 💬 ESEMPIO 4: Conversational Memory (Portoghese)

### 🗨️ Conversazione Completa con Raffinamento Progressivo

```
👤 Cliente: queijo italiano

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "queijo italiano"
Language: PT
Filters: {
  keywords: ["formaggio", "italiano"],
  categoryIds: ["<cheese-category-uuid>"],
  regions: [],
  certifications: []
}

📦 [BACKEND - ProductRepository]
Results: 6 formaggi italiani

🤖 Bot: Olá Marco! Temos vários queijos italianos:
Parmigiano, Pecorino, Gorgonzola, Burrata, Mozzarella, Taleggio.

Qual te interessa? 🧀

💾 [CONVERSATIONAL MEMORY SAVED - 10 min]
sessionId: whatsapp-351912345678
lastQuery: "queijo italiano"
lastResponse: "Found 6 Italian cheeses"
expiresAt: +10 minutes

---

👤 Cliente: só orgânico

🔬 [BACKEND - QueryAnalyzer LEVEL 3]
Query: "só orgânico"
Language: PT
Conversational Context: {
  lastQuery: "queijo italiano",
  lastResponse: "Found 6 Italian cheeses"
}
Filters: {
  keywords: ["formaggio", "italiano"], // ✅ Inherited from context!
  categoryIds: ["<cheese-category-uuid>"], // ✅ Inherited!
  regions: [],
  certifications: ["isOrganic"] // ✅ NEW filter added!
}
Reasoning: "Conversational refinement: adding organic certification to previous cheese search"

📦 [BACKEND - ProductRepository]
Results: 1 prodotto filtrato
- Parmigiano Reggiano DOP Bio 24 mesi (€15.00 → €13.50)

🤖 Bot: Perfeito! Aqui está o queijo orgânico:

**QUEIJOS**
• FOR-PAR-002 Parmigiano Reggiano DOP Bio 24 mesi 500g ~€15.00~ → €13.50
  Parmigiano orgânico envelhecido de Emilia-Romagna.
  Stock: ✅ 8 disponíveis | 🔖 DOP, Bio

Com seu desconto de 10% você paga €13.50! 🎉
Quer adicionar ao carrinho? 🛒

💾 [CONVERSATIONAL MEMORY UPDATED]
lastQuery: "só orgânico"
lastResponse: "Found 1 organic cheese"
expiresAt: +10 minutes (reset timer)
```

---

## 🎯 Regole del Funnel

### ✅ QUERY GENERICA (Show Summary)

**Indicatori**:

- Single keyword: "surgelati", "formaggi", "pasta"
- Certification only: "biologici", "DOP"
- searchProducts() returns **5+ products**

**Output**:

```
Ciao {name}! Abbiamo diversi {category}:
Tipo1, Tipo2, Tipo3, Tipo4, Tipo5.

Di quali di questi sei interessato? 🛍️
```

**NO**:

- ❌ Prezzi
- ❌ Stock
- ❌ Codici prodotto
- ❌ Descrizioni
- ❌ Liste numerate

### ✅ QUERY SPECIFICA (Show Details)

**Indicatori**:

- Multiple keywords: "surgelato siciliano"
- Specific product: "arancini", "funghi porcini"
- Customer refines: "voglio gli arancini"
- searchProducts() returns **1-4 products**

**Output**:

```
Perfetto! Ecco il tuo prodotto:

**CATEGORIA**
• CODE Nome formato ~€orig~ → €sconto
  Descrizione dettagliata.
  Stock: ✅ N disponibili | 🔖 Certificazioni

Con il tuo sconto del X% paghi €X.XX! 🎉
Vuoi aggiungerlo al carrello? 🛒
```

**YES**:

- ✅ Codice prodotto (CODE)
- ✅ Nome completo + formato
- ✅ Prezzo originale + scontato
- ✅ Descrizione
- ✅ Stock preciso
- ✅ Certificazioni
- ✅ Call to action (carrello)

---

## 🔬 Backend Flow Tecnico

### STEP 1: Router Agent (LEVEL 1)

```typescript
// Input: Customer message
const routerDecision = await RouterAgent.route({
  message: "che surgelati avete?",
  customerId: "uuid",
  sessionId: "whatsapp-session-123"
})

// Output
{
  intent: "PRODUCT_SEARCH",
  confidence: 0.95,
  delegateTo: "ProductSearchAgent",
  extractedQuery: "che surgelati avete?"
}
```

### STEP 2: Product Search Agent (LEVEL 2)

```typescript
// Input: Router delegation
const searchResult = await ProductSearchAgent.handleQuery({
  workspaceId: "workspace-uuid",
  customerId: "customer-uuid",
  sessionId: "whatsapp-session-123",
  query: "che surgelati avete?", // ✅ ORIGINAL query passed!
  customerLanguage: "it",
})

// Calls QueryAnalyzer (LEVEL 3) internally
```

### STEP 3: Query Analyzer Agent (LEVEL 3) 🔬

```typescript
// Input: Original customer query
const analysisResult = await QueryAnalyzerAgent.analyzeQuery({
  workspaceId: "workspace-uuid",
  query: "che surgelati avete?",
  conversationContext: existingConversation || undefined
})

// Output
{
  success: true,
  filters: {
    categoryIds: [],
    supplierIds: [],
    certifications: [],
    regions: [],
    keywords: ["surgelati"]
  },
  reasoning: "Generic query about frozen products",
  tokensUsed: 145,
  executionTimeMs: 823
}
```

### STEP 4: Product Repository

```typescript
// Input: Analyzed filters
const products = await ProductRepository.searchProducts(workspaceId, {
  keywords: ["surgelati"],
  categoryIds: [],
  supplierIds: [],
  regions: [],
  minPrice: undefined,
  maxPrice: undefined,
  allergens: undefined,
  certifications: []
})

// Output: 8 prodotti
[
  { id: "uuid1", name: "Arancini Siciliani al Ragù Surgelati", ... },
  { id: "uuid2", name: "Funghi Porcini Trifolati Surgelati", ... },
  // ... 6 more products
]
```

### STEP 5: Product Search Agent - Funnel Logic

```typescript
// Funnel decision based on results count
if (products.length >= 5) {
  // GENERIC QUERY → Extract types only
  const types = extractMainTypes(products)
  // ["Arancini", "Funghi", "Tortellini", ...]

  return formatGenericResponse(types, customerName)
} else {
  // SPECIFIC QUERY → Show full details
  return formatDetailedResponse(products, customerDiscount)
}
```

### STEP 6: Safety & Translation Agent

```typescript
// Input: Product Search response in English
const safeResponse = await SafetyAgent.translateAndValidate({
  text: "Hi Marco! We have several frozen products: ...",
  targetLanguage: "it",
  customerId: "uuid",
})

// Output: Translated to Italian
;("Ciao Marco! Abbiamo diversi surgelati: ...")
```

### STEP 7: Conversational Memory (10 min)

```typescript
// Save conversation state
await SearchConversationRepo.upsert({
  sessionId: "whatsapp-session-123",
  workspaceId: "workspace-uuid",
  customerId: "customer-uuid",
  lastQuery: "che surgelati avete?",
  lastResponse: "Found 8 frozen products",
  metadata: {
    filters: analysisResult.filters,
    reasoning: analysisResult.reasoning,
    resultsCount: 8,
  },
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // +10 minutes
})
```

---

## 🧪 Come Testare

### Test Manuale via Script

```bash
cd backend
npx ts-node test-query-analyzer-manual.ts
```

**Output atteso**:

- ✅ QueryAnalyzerAgent configurato correttamente
- ✅ Multi-language tests (IT/EN/ES/PT)
- ✅ Region mapping tests
- ✅ Conversational context tests
- ✅ Integration con ProductSearchAgent

### Test via WhatsApp

1. **Messaggio generico**:

   ```
   "che surgelati avete?"
   ```

   **Aspettativa**: Lista nomi senza dettagli

2. **Raffinamento**:

   ```
   "voglio gli arancini siciliani"
   ```

   **Aspettativa**: Dettagli completi con prezzo/stock

3. **Multi-language**:

   ```
   "organic sardinian cheese"
   ```

   **Aspettativa**: Funziona come in italiano

4. **Conversational**:
   ```
   "mostrami formaggi italiani"
   → "solo biologici"
   ```
   **Aspettativa**: Eredita filtri dalla query precedente

---

## ✅ Checklist Finale

- [x] QueryAnalyzerAgent implementato (LEVEL 3)
- [x] SearchConversations table per memoria 10 minuti
- [x] Scheduler cronjob per cleanup automatico
- [x] Multi-language support (IT/EN/ES/PT)
- [x] Region mapping (20 regioni italiane in inglese)
- [x] Progressive Discovery pattern nel prompt
- [x] View Flow aggiornato con icona 🔬 Microscope
- [x] Backend compila senza errori
- [x] Frontend aggiornato per visualizzare QueryAnalyzer
- [x] Esempi pratici documentati

---

## 📚 File di Riferimento

- **Prompt**: `docs/prompts/query-analyzer-agent.md`
- **Agent**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`
- **Repository**: `backend/src/repositories/searchConversation.repository.ts`
- **Scheduler**: `backend/src/scheduler.ts`
- **Test**: `backend/test-query-analyzer-manual.ts`
- **Frontend**: `frontend/src/components/shared/MessageFlowDialog.tsx`

---

**Pronto per il commit!** 🚀
