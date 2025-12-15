# 🤖 Code-First LLM Architecture - Documentazione Tecnica

## 📋 Indice
1. [Obiettivo del Progetto](#obiettivo-del-progetto)
2. [Architettura Code-First](#architettura-code-first)
3. [Flusso E-Commerce Completo](#flusso-e-commerce-completo)
4. [Sistema di Raggruppamento Smart](#sistema-di-raggruppamento-smart)
5. [Controlli di Sicurezza](#controlli-di-sicurezza)
6. [TODO List & Progresso](#todo-list--progresso)
7. [Regole Fondamentali](#regole-fondamentali)

---

## 🎯 Obiettivo del Progetto

Applicazione **SaaS multi-tenant** per chatbot WhatsApp:

| Tipo Cliente | Flag `sellsProductsAndServices` | Funzionalità |
|--------------|--------------------------------|--------------|
| **E-commerce** | `true` | Prodotti, Carrello, Ordini, Checkout, Repeat Order |
| **Support Only** | `false` | Solo FAQ, Info azienda, Contatti |

### Principi Chiave:
- ❌ **NO hardcoding** - Niente valori fissi (nomi prodotti, categorie)
- ❌ **NO regex per decisioni LLM** - L'LLM decide tutto
- ✅ **Database-First** - Tutto viene dal DB (prodotti, prompt, config)
- ✅ **Multi-tenant** - Ogni workspace isolato con `workspaceId`
- ✅ **Generico** - Funziona per qualsiasi tipo di negozio (alimentari, abbigliamento, automotive, gioielli, elettronica, servizi)

> ⚠️ **NOTA**: In questa documentazione usiamo esempi generici. Il sistema è **domain-agnostic**: funziona identicamente per qualsiasi settore merceologico.

---

## 🏗️ Architettura Code-First

### Principio: "Codice decide, LLM formatta"

```
┌─────────────────────────────────────────────────────────────────┐
│                      CODE-FIRST FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Message                                                    │
│       ↓                                                          │
│  ┌─────────────────┐                                            │
│  │  IntentParser   │ → Rileva intent (SEARCH_PRODUCTS, etc.)    │
│  └────────┬────────┘                                            │
│           ↓                                                      │
│  ┌─────────────────┐                                            │
│  │   DataLoader    │ → Carica SOLO dati necessari dal DB        │
│  └────────┬────────┘                                            │
│           ↓                                                      │
│  ┌─────────────────┐                                            │
│  │ ResponseBuilder │ → Struttura la risposta                    │
│  └────────┬────────┘                                            │
│           ↓                                                      │
│  ┌─────────────────┐                                            │
│  │  LLMFormatter   │ → LLM formatta in linguaggio naturale      │
│  └────────┬────────┘                                            │
│           ↓                                                      │
│  ┌─────────────────┐                                            │
│  │ System Message  │ → Salva JSON gruppi per selezioni future   │
│  └────────┬────────┘                                            │
│           ↓                                                      │
│  Response to User                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Principali:

| File | Responsabilità |
|------|----------------|
| `code-first-llm.service.ts` | Orchestratore principale |
| `intent-parser.service.ts` | Rileva intent dal messaggio |
| `data-loader.service.ts` | Carica dati dal DB + **Semantic Search** |
| `response-builder.service.ts` | Costruisce risposta strutturata |
| `llm-formatter.service.ts` | Formatta con LLM |
| `options-mapping.service.ts` | Gestisce FAST-PATH e groupMapping |

---

## 🔍 CONCETTO CRITICO: Prodotti nel Prompt LLM

### Perché è fondamentale?

L'utente può cercare prodotti usando:
- **Parole esatte**: "Prodotto ABC" ✅
- **Sinonimi**: "articoli sportivi" ✅
- **Altre lingue**: "sport items" ✅
- **Termini generici**: "qualcosa di nuovo" ✅

### Soluzione: SEMPRE LLM con tutti i prodotti

**NIENTE text search nel DB** - inutile perché non capisce sinonimi/lingue.

```
┌─────────────────────────────────────────────────────────────────┐
│  SEARCH FLOW (data-loader.service.ts)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "articoli sportivi" (o qualsiasi query)                  │
│                                                                  │
│  1. DataLoader.loadProductSearch(query)                         │
│     → Carica TUTTI i prodotti del workspace                     │
│                                                                  │
│  2. semanticFilterProducts(allProducts, query)                  │
│     → Passa al LLM: lista prodotti + query utente               │
│     → LLM capisce sinonimi, traduzioni, termini correlati       │
│     → LLM ritorna: [0, 3, 5, 8, 12] (indici prodotti matching)  │
│                                                                  │
│  3. Ritorna solo i prodotti filtrati dal LLM                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Perché NON usiamo text search nel DB?

❌ **Text search è inutile**:
- Non capisce sinonimi ("latticini" ≠ "formaggi" nel DB)
- Non capisce altre lingue ("cheese" ≠ "formaggi")
- Non capisce termini generici ("qualcosa di buono")

✅ **LLM capisce tutto**:
- Sinonimi
- Traduzioni
- Termini generici
- Categorie implicite

### Codice chiave: `semanticFilterProducts()`

```typescript
// data-loader.service.ts - linee 1025-1130
private async semanticFilterProducts(products: any[], query: string): Promise<ProductData[]> {
  // 1. Costruisce lista compatta per LLM
  const productList = products.map((p, i) => ({
    idx: i,
    name: p.name,
    category: p.productCategories?.[0]?.category?.name || "Altro",
    desc: (p.description || "").substring(0, 100),
  }))

  // 2. Chiede al LLM di identificare i prodotti matching
  // LLM prompt include:
  // - "SEMANTIC queries - user uses synonyms or related terms"
  // - "Map the term to the appropriate category using your knowledge"
  
  // 3. LLM ritorna array di indici: [0, 3, 5, 8]
  // 4. Sistema carica solo quei prodotti dal DB
}
```

### Quando viene usato LLM per filtrare?

**SEMPRE** - per qualsiasi ricerca prodotti il flusso è:

1. Carica TUTTI i prodotti del workspace
2. Passa al LLM con query utente
3. LLM filtra e ritorna prodotti matching

### Perché NON usiamo `{{products}}` come placeholder?

Nel Code-First LLM **NON** facciamo replace di `{{products}}` nel prompt template.
Invece, il DataLoader carica i prodotti e li passa direttamente al LLM in due modi:

1. **Semantic Search**: LLM vede TUTTI i prodotti per filtrare
2. **Smart Grouping**: LLM vede i prodotti filtrati per raggrupparli

Questo è più efficiente perché:
- ✅ Meno token (solo prodotti rilevanti, non tutto il catalogo)
- ✅ Più veloce (caricamento mirato)
- ✅ Stesso risultato (LLM capisce sinonimi e altre lingue)

---

## 🛒 Flusso E-Commerce Completo

### Step-by-Step:

```
1. "cerca [termine]" (qualsiasi parola/frase)
   → SEARCH_PRODUCTS 
   → SEMPRE: Carica TUTTI prodotti → LLM filtra (semantic search)
   → Smart grouping se molti prodotti (>5)
   → Risposta: "1. Gruppo A (N) 2. Gruppo B (M)"

2. "1" (selezione gruppo)
   → FAST-PATH → legge groupMapping["1"]
   → Carica prodotti per SKUs del gruppo
   → Mostra lista prodotti con prezzi

3. "3" (selezione prodotto)
   → FAST-PATH → listType: PRODUCTS
   → Carica dettaglio prodotto
   → "Vuoi aggiungerlo al carrello?"

4. "sì" / "aggiungi"
   → ADD_TO_CART → CartManagementAgentLLM
   → "Aggiunto! Vuoi vedere il carrello?"

5. "vedi carrello"
   → VIEW_CART → mostra carrello con totale

6. "ordina" / "checkout"
   → CHECKOUT → crea ordine
   → "Ordine #ORD-XXX confermato!"

7. "i miei ordini"
   → VIEW_ORDERS → lista ordini

8. "ripeti ultimo ordine"
   → REPEAT_ORDER → copia prodotti nel carrello
```

> **NOTA**: La numerazione (1, 2, 3...) è gestita interamente dal **codice**, non dal prompt LLM. Il codice salva un `optionsMapping` e risolve le selezioni numeriche tramite FAST-PATH.

---

## 🗂️ Sistema di Raggruppamento Smart

### Il Problema Risolto:
Quando ci sono molti prodotti (es. 7+ risultati), l'LLM li raggruppa intelligentemente per facilitare la navigazione.

### Flusso Corretto:

```
┌─────────────────────────────────────────────────────────────────┐
│  SMART GROUPING FLOW                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User: "cerca [termine]"                                     │
│                                                                  │
│  2. DataLoader carica N prodotti dal DB                         │
│                                                                  │
│  3. LLM riceve lista prodotti per raggruppamento:               │
│     ┌──────────────────────────────────────┐                    │
│     │ Prodotti da raggruppare:              │                    │
│     │ - Prodotto A (SKU: P1) - tipo X       │                    │
│     │ - Prodotto B (SKU: P2) - tipo Y       │                    │
│     │ - Prodotto C (SKU: P3) - tipo X       │                    │
│     │ ...                                   │                    │
│     └──────────────────────────────────────┘                    │
│                                                                  │
│  4. LLM risponde:                                               │
│     "Ecco i gruppi:                                             │
│      1. Gruppo Tipo X (N prodotti)                              │
│      2. Gruppo Tipo Y (M prodotti)                              │
│                                                                  │
│      ---JSON_MAPPING---                                         │
│      {"1":{"nome":"Tipo X","skus":["P1","P3","P5"]},            │
│       "2":{"nome":"Tipo Y","skus":["P2","P4","P6","P7"]}}       │
│      ---END_JSON---"                                            │
│                                                                  │
│  5. Sistema salva groupMapping nel DB (optionsMapping)          │
│                                                                  │
│  6. User: "1"                                                   │
│                                                                  │
│  7. FAST-PATH: legge groupMapping["1"] → skus: ["P1","P3","P5"] │
│                                                                  │
│  8. DataLoader.loadProductsBySkus(["P1","P3","P5"])             │
│                                                                  │
│  9. Mostra lista prodotti del gruppo con prezzi                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### System Message (nascosto all'utente):

```json
{
  "gruppi": {
    "1": {
      "nome": "Gruppo A",
      "skus": ["SKU-001", "SKU-002", "SKU-003"],
      "prodotti": [
        {"nome": "Prodotto 1", "sku": "SKU-001", "prezzo": 10.00},
        {"nome": "Prodotto 2", "sku": "SKU-002", "prezzo": 15.00},
        {"nome": "Prodotto 3", "sku": "SKU-003", "prezzo": 20.00}
      ]
    },
    "2": {
      "nome": "Gruppo B", 
      "skus": ["SKU-004", "SKU-005", "SKU-006", "SKU-007"]
    }
  }
}
```

> **IMPORTANTE**: Il JSON_MAPPING viene estratto dal codice e salvato in `optionsMapping`. Quando l'utente scrive "1", il FAST-PATH risolve direttamente senza chiamare LLM.

---

## 🔒 Controlli di Sicurezza

Tutti i controlli sono nel **webhook** PRIMA di chiamare CodeFirstLLM:

| Controllo | Dove | Cosa fa |
|-----------|------|---------|
| **Rate Limiting** | Webhook | Limita richieste per IP/customer |
| **Utente Bloccato** | `isBlocked` check | Blocca utenti bannati |
| **Canale Disabilitato** | `canProcessMessages()` | Messaggio WIP |
| **Trial Scaduto** | `isTrialValid()` | Blocca se trial finito |
| **Credito Esaurito** | `checkCredit()` | Blocca se senza soldi |
| **Subscription Paused** | `PAUSED` status | Blocca workspace in pausa |
| **Workspace Isolation** | `workspaceId` filter | Ogni query filtrata |

---

## 📊 TODO List & Progresso

### Completamento Complessivo: **85%**

---

### 🔴 PRIORITÀ 1: Pulizia Prompt e Allineamento (✅ FATTO)

| # | Task | Stato | Note |
|---|------|-------|------|
| 1.1 | Rendere esempi generici (no food-specific) | ✅ | Rimossi "formaggi", "latticini", etc. |
| 1.2 | Rimuovere text search DB inutile | ✅ | Solo LLM filtra prodotti |
| 1.3 | Allineare prompt a logica codice | ✅ | FAST-PATH, pendingAction, groupMapping |
| 1.4 | customAiRules nel LLMFormatter | ✅ | Caricato da workspace |

---

### 🟢 PRIORITÀ 2: Funzionalità Implementate

| # | Task | Stato | Note |
|---|------|-------|------|
| 2.1 | LLM filtra SEMPRE prodotti | ✅ | Niente text search DB |
| 2.2 | Smart Grouping con JSON | ✅ | `---JSON_MAPPING---` |
| 2.3 | FAST-PATH per gruppi | ✅ | `groupMapping` |
| 2.4 | FAST-PATH per prodotti | ✅ | `listType: PRODUCTS` |
| 2.5 | VIEW_CART | ✅ | `DataLoader.loadCart()` |
| 2.6 | REPEAT_ORDER | ✅ | Logica completa |
| 2.7 | START_CHECKOUT | ✅ | Nel mapping |
| 2.8 | CONFIRM + pendingAction | ✅ | STEP 2.6 |

---

### 🔵 PRIORITÀ 3: Test End-to-End

| # | Task | Stato | Note |
|---|------|-------|------|
| 3.1 | Test flusso ricerca → gruppi → selezione | ⏳ | |
| 3.2 | Test ADD_TO_CART con quantity | ⏳ | "sì, 2 pezzi" → quantity=2 |
| 3.3 | Test CHECKOUT completo | ⏳ | Verifica dati + crea ordine |
| 3.4 | Test REPEAT_ORDER | ⏳ | |

---

### ⚠️ NOTE IMPORTANTI

1. **LLM filtra SEMPRE i prodotti**:
   - Niente text search nel DB (inutile per sinonimi/lingue)
   - `loadProductSearch()` carica TUTTI i prodotti
   - `semanticFilterProducts()` passa al LLM che filtra

2. **La numerazione è gestita dal CODICE**:
   - Il prompt NON deve contenere regole su come gestire "1", "2", "3"
   - Il codice salva `optionsMapping` e risolve via FAST-PATH

3. **customAiRules**:
   - Caricato da `workspace.customAiRules`
   - Iniettato nel system prompt del LLMFormatter

---

## 📜 Regole Fondamentali

### ❌ NON FARE:
```
- Hardcodare nomi prodotti/categorie
- Usare regex per decisioni LLM
- Duplicare variabili nel prompt ({{products}} una sola volta!)
- Query senza workspaceId
- Modificare codice funzionante senza motivo
```

### ✅ FARE:
```
- Tutto dal database
- LLM decide, codice esegue
- Semantic Search per sinonimi/traduzioni
- System Message per contesto nascosto
- workspaceId in OGNI query
- Test prima di "fatto"
```

### Tuning LLM:
- **Modello**: `gpt-4o-mini` (veloce, economico)
- **Temperatura**: `0.3` (bassa per consistenza)
- **Max Tokens**: `1000` (sufficiente per formattazione)
- **Prompt Engineering**: Istruzioni chiare, non duplicate

### Frasi Finali Importanti:
```
- "Quale categoria vuoi esplorare?"
- "A quale prodotto sei interessato?"
- "Vuoi aggiungerlo al carrello?"
- "Quanti ne vuoi?"
- "Vuoi procedere con l'ordine?"
- "Vuoi verificare i tuoi dati?"
```

---

## 💬 Esempio Chat Completo: da ricerca a ordine

Questo esempio mostra il flusso completo. **I nomi dei prodotti sono generici** - il sistema funziona identicamente per qualsiasi settore.

```
═══════════════════════════════════════════════════════════════════
                    CHAT WHATSAPP - ESEMPIO COMPLETO
═══════════════════════════════════════════════════════════════════

👤 CLIENTE: "Ciao, avete prodotti premium?"

   🔍 Sistema interno:
   ├─ IntentParser: SEARCH_PRODUCTS, query="prodotti premium"
   ├─ DataLoader.loadProductSearch("prodotti premium")
   │   ├─ Carica TUTTI i prodotti del workspace
   │   └─ semanticFilterProducts() con LLM:
   │       ├─ LLM analizza query "prodotti premium"
   │       ├─ LLM filtra usando sinonimi/semantica
   │       └─ Ritorna: [0, 3, 5, 8, 12, 15, 18] (7 prodotti)
   └─ ResponseBuilder: PRODUCT_NEEDS_SMART_GROUPING (7 prodotti)

🤖 BOT: "Ciao! 🛍️ Ecco i nostri prodotti premium organizzati:

   1. Categoria A (3 prodotti)
   2. Categoria B (4 prodotti)
   
   Quale gruppo ti interessa?"
   
   📝 System Message (nascosto):
   {"groupMapping":{"1":{"nome":"Cat A","skus":["SKU-001","SKU-002","SKU-003"]},
                    "2":{"nome":"Cat B","skus":["SKU-004","SKU-005","SKU-006","SKU-007"]}}}

───────────────────────────────────────────────────────────────────

👤 CLIENTE: "1"

   🔍 Sistema interno:
   ├─ FAST-PATH: legge groupMapping["1"]
   ├─ skus: ["SKU-001", "SKU-002", "SKU-003"]
   ├─ DataLoader.loadProductsBySkus(skus)
   └─ ResponseBuilder: PRODUCT_LIST (3 prodotti)

🤖 BOT: "🛍️ Categoria A - 3 prodotti disponibili:

   1. Prodotto Alpha - €85.00
      Descrizione breve del prodotto
      
   2. Prodotto Beta - €45.00
      Descrizione breve del prodotto
      
   3. Prodotto Gamma - €120.00
      Descrizione breve del prodotto
   
   A quale prodotto sei interessato?"
   
   📝 optionsMapping salvato: {listType: "PRODUCTS", "1": "Prodotto Alpha", ...}

───────────────────────────────────────────────────────────────────

👤 CLIENTE: "3"

   🔍 Sistema interno:
   ├─ FAST-PATH: listType=PRODUCTS, number=3
   ├─ resolvedValue: "Prodotto Gamma"
   ├─ DataLoader.loadProductByName("Prodotto Gamma")
   └─ ResponseBuilder: PRODUCT_DETAIL

🤖 BOT: "🛍️ Prodotto Gamma

   💰 Prezzo: €120.00
   📦 Codice: SKU-003
   ✅ Disponibile (25 in stock)
   
   Descrizione completa del prodotto con 
   tutte le caratteristiche tecniche.
   
   Vuoi aggiungerlo al carrello?"
   
   📝 pendingAction: {type: "ADD_TO_CART", sku: "SKU-003"}

───────────────────────────────────────────────────────────────────

👤 CLIENTE: "sì, 2 pezzi"

   🔍 Sistema interno:
   ├─ IntentParser: CONFIRM + quantity=2
   ├─ pendingAction rilevato: ADD_TO_CART
   ├─ CartManagementAgentLLM.addToCart("SKU-003", 2)
   └─ Carrello aggiornato

🤖 BOT: "Perfetto! ✅ Ho aggiunto al carrello:

   🛍️ 2x Prodotto Gamma - €240.00
   
   Vuoi continuare a fare acquisti o vedere il carrello?"

───────────────────────────────────────────────────────────────────

👤 CLIENTE: "vedi carrello"

   🔍 Sistema interno:
   ├─ IntentParser: VIEW_CART
   ├─ DataLoader.loadCart(customerId)
   └─ ResponseBuilder: CART_VIEW

🤖 BOT: "🛒 Il tuo carrello:

   1. 2x Prodotto Gamma - €240.00
   
   ─────────────────────
   📦 Totale articoli: 2
   💰 Totale: €240.00
   ─────────────────────
   
   Vuoi procedere con l'ordine o modificare il carrello?"

───────────────────────────────────────────────────────────────────

👤 CLIENTE: "ordina"

   🔍 Sistema interno:
   ├─ IntentParser: START_CHECKOUT
   ├─ Verifica dati cliente (indirizzo, telefono)
   └─ Se completi → mostra riepilogo

🤖 BOT: "📋 Riepilogo ordine:

   🛒 Prodotti:
   • 2x Prodotto Gamma - €240.00
   
   💰 Totale: €240.00
   
   📍 Spedizione a:
   Via Roma 123, 00100 Roma
   
   Confermi l'ordine?"

───────────────────────────────────────────────────────────────────

👤 CLIENTE: "confermo"

   🔍 Sistema interno:
   ├─ IntentParser: CONFIRM
   ├─ pendingAction: CHECKOUT
   ├─ OrderService.createOrder()
   ├─ CartService.clearCart()
   └─ Genera orderCode: ORD-20251213-001

🤖 BOT: "🎉 Ordine confermato!

   📦 Codice ordine: ORD-20251213-001
   💰 Totale: €240.00
   📅 Data: 13 Dicembre 2025
   
   Riceverai una conferma via email.
   
   Grazie per il tuo acquisto! 🙏
   
   Posso aiutarti con altro?"

═══════════════════════════════════════════════════════════════════
```

### 🔄 Flow Diagram

```
"cerca X" ──► Semantic Search ──► N prodotti ──► Smart Grouping
                     │
                     ▼
              "1. Gruppo A (N)"
              "2. Gruppo B (M)"
                     │
        "1" ─────────┘
                     │
                     ▼
              FAST-PATH: groupMapping["1"]
              → SKUs dal gruppo
                     │
                     ▼
              "1. Prodotto 1 €XX"
              "2. Prodotto 2 €YY"
              "3. Prodotto 3 €ZZ"
                     │
        "3" ─────────┘
                     │
                     ▼
              Dettaglio Prodotto 3
              "Vuoi aggiungerlo?"
                     │
       "sì, 2" ──────┘
                     │
                     ▼
              🛒 Carrello aggiornato
                     │
    "ordina" ────────┘
                     │
                     ▼
              ✅ Ordine confermato
```

---

## 🔄 Prossimi Passi

1. ✅ ~~Pulizia documentazione~~ - Esempi generici
2. ⏳ Fix errori TypeScript (import mancanti)
3. ⏳ Test compilazione backend
4. ⏳ Test end-to-end del flusso completo

---

## ❓ Cosa Manca per Completare?

### 🟡 DA COMPLETARE

| # | Componente | Stato | Note |
|---|------------|-------|------|
| 1 | Fix import TypeScript | ⏳ | code-first-llm.service.ts |
| 2 | Compilazione pulita | ⏳ | `npx tsc --noEmit` |
| 3 | Test E2E | ⏳ | Flusso completo |

### 🟢 IMPLEMENTATO

| # | Componente | Stato | Note |
|---|------------|-------|------|
| 1 | Semantic Search | ✅ | `semanticFilterProducts()` |
| 2 | Smart Grouping | ✅ | `---JSON_MAPPING---` |
| 3 | FAST-PATH gruppi | ✅ | `groupMapping` |
| 4 | FAST-PATH prodotti | ✅ | `listType: PRODUCTS` |
| 5 | VIEW_CART | ✅ | `DataLoader.loadCart()` |
| 6 | REPEAT_ORDER | ✅ | Logica completa |
| 7 | START_CHECKOUT | ✅ | Nel mapping |
| 8 | CONFIRM + pendingAction | ✅ | STEP 2.6 |
| 9 | customAiRules | ✅ | Iniettato in LLMFormatter |
| 10 | Documentazione generica | ✅ | No esempi food-specific |

---

## 🌍 Translation Layer - Wrapper Pattern (Updated 2025-01)

### Principio: "Codice decide, LLM formatta, Translation traduce"

Il `ChatEngineService` usa un **Decorator/Wrapper Pattern** per garantire che TUTTE le risposte passino per la traduzione:

```
┌─────────────────────────────────────────────────────────────────┐
│                 ChatEngine Translation Wrapper                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📥 Chiamata esterna: routeMessage(input)                       │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │  routeMessage() - PUBLIC WRAPPER        │                    │
│  │  • Chiama processMessageInternal()      │                    │
│  │  • Applica applyTranslation() UNA VOLTA │                    │
│  │  • Ritorna messaggio tradotto           │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │                                             │
│       ┌────────────┴────────────┐                               │
│       ▼                         ▼                                │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ processMessage  │    │ applyTranslation│                     │
│  │ Internal()      │    │ ()              │                     │
│  │ PRIVATE         │    │                 │                     │
│  │ ~2400 linee     │    │ TranslationAgent│                     │
│  │ • 20+ return    │    │ Converte ITA →  │                     │
│  │   statements    │    │ lingua cliente  │                     │
│  │ • Ritorna       │    │                 │                     │
│  │   ITALIANO      │    │ Push debug step │                     │
│  └─────────────────┘    │ "🌍 Translation │                     │
│                         │    Agent"       │                     │
│                         └─────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Perché Wrapper Pattern?

**Problema**: `processMessageInternal()` ha 20+ punti di ritorno. Aggiungere traduzione a ogni return sarebbe:
- ❌ Errore-prone (facile dimenticarne uno)
- ❌ Duplicazione codice
- ❌ Difficile da mantenere

**Soluzione**: Un SOLO punto di traduzione nel wrapper:
```typescript
// PUBLIC wrapper - UNICO entry point
async routeMessage(input: RouteMessageInput): Promise<RouteMessageResult> {
  // 1. Processa messaggio (ritorna ITALIANO)
  const result = await this.processMessageInternal(input)
  
  // 2. Applica traduzione UNA VOLTA (in lingua cliente)
  const translatedMessage = await this.applyTranslation(
    result.message,
    customer.preferredLanguage,
    result.debugSteps
  )
  
  return { ...result, message: translatedMessage }
}
```

### File Coinvolti

| File | Responsabilità |
|------|----------------|
| `chat-engine.service.ts` | Wrapper `routeMessage()`, `applyTranslation()` |
| `TranslationAgent.ts` | Traduzione LLM-based in `preferredLanguage` cliente |

---

## 📝 Note Finali

1. **Domain-agnostic**: Il sistema funziona per qualsiasi tipo di prodotto/servizio
2. **Numerazione dal codice**: FAST-PATH gestisce selezioni, non il prompt LLM
3. **Prompt hardcoded**: Solo LLMFormatter base (security), tutto il resto da DB
4. **customAiRules**: Override regole base se impostato nel workspace



User Message
     │
     ▼
┌─────────────────┐
│  IntentParser   │ ← LLM solo se Pattern/Keyword falliscono
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   DataLoader    │ ← LLM per semanticFilterProducts()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ResponseBuilder │ ← NO LLM (puro codice)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLMFormatter   │ ← LLM per formattare risposta
└────────┬────────┘
         │
         ▼

         ▼
┌─────────────────┐
│TranslationAgent │ ← LLM per tradurre in lingua utente
└─────────────────┘



┌─────────────────────────────────────────────────────────────────┐
│                    CODE-FIRST LLM FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Message                                                    │
│       │                                                          │
│       ▼                                                          │
│  IntentParser    ← LLM (fallback)                               │
│       │                                                          │
│       ▼                                                          │
│  DataLoader      ← LLM (semantic filter)                        │
│       │                                                          │
│       ▼                                                          │
│  ResponseBuilder ← NO LLM (puro codice)                         │
│       │                                                          │
│       ▼                                                          │
│  LLMFormatter    ← LLM (formatta risposta)                      │
│       │                                                          │
│       ▼                                                          │
│  TranslationAgent ← LLM (traduce in lingua utente)              │
│       │                                                          │
│       ▼                                                          │
│  💾 MESSAGGIO SALVATO IN CODA (WhatsApp Queue)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘





┌─────────────────────────────────────────────────────────────────┐
│                    SCHEDULER (Separato)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📥 Legge messaggio dalla coda                                  │
│       │                                                          │
│       ▼                                                          │
│  SecurityAgent   ← LLM (valida sicurezza)                       │
│       │                                                          │
│       ├── ✅ SAFE → Invia su WhatsApp                           │
│       │                                                          │
│       └── ❌ BLOCKED → Log + non invia                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

