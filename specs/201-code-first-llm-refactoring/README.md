# 201 - Code-First LLM Refactoring

## 🎯 Obiettivo

Refactoring completo dell'architettura LLM per passare da "LLM decide tutto" a "Codice decide, LLM formatta".

**Problema attuale**: L'LLM prende troppe decisioni (quale funzione chiamare, quando raggruppare, come formattare) risultando in comportamento aleatorio e bug ricorrenti.

**Soluzione**: Il codice gestisce TUTTA la logica di business, l'LLM viene usato SOLO per:
1. Capire l'intent del messaggio (con fallback deterministico)
2. Formattare la risposta in linguaggio naturale

---

## 📊 Analisi del Problema

### Errori Ricorrenti (ultimi 30 giorni)

| Errore | Frequenza | Causa Root |
|--------|-----------|------------|
| `getProductDetails` chiamato per categorie | 🔴 Alto | LLM ignora regole prompt |
| Non raggruppa 6+ prodotti | 🔴 Alto | LLM non applica count rules |
| Confonde "chi siete" / "dove siete" | 🟡 Medio | Intent ambiguo per LLM |
| Variabili non sostituite | ✅ Risolto | Ordine operazioni (fix 12/12) |
| Lista prodotti invece di gruppi | 🔴 Alto | LLM non conta |
| Selezione numerica errata | 🟡 Medio | LLM non legge history |

### Pattern Comune

Tutti questi errori hanno la stessa causa: **l'LLM prende decisioni che dovrebbe prendere il codice**.

---

## 🏗️ Architettura Proposta

### PRIMA (Attuale)
```
User Message → Router (LLM decide) → Sub-Agent (LLM decide) → Response
                    ↓                      ↓
              "Quale agent?"          "Quale funzione?"
              "Che parametri?"        "Come formattare?"
```

### DOPO (Code-First)
```
User Message → IntentParser (CODICE) → DataLoader (CODICE) → ResponseBuilder (CODICE) → LLMFormatter → Response
                    ↓                      ↓                        ↓                      ↓
              Determina intent       Carica SOLO dati          Applica logica        SOLO formatting
              con regole precise     necessari                 (grouping, etc.)      naturale
```

---

## 🧩 Componenti Principali

### 1. IntentParser (`intent-parser.service.ts`)

**Responsabilità**: Analizzare messaggio + history e ritornare un intent tipizzato.

```typescript
type Intent =
  // Product Search
  | { type: "SHOW_CATEGORIES" }
  | { type: "SHOW_CATEGORY"; categoryName: string }
  | { type: "SHOW_PRODUCT"; productId: string; productName: string }
  | { type: "SEARCH_PRODUCTS"; query: string }
  
  // Cart
  | { type: "VIEW_CART" }
  | { type: "ADD_TO_CART"; productId: string; quantity: number }
  | { type: "REMOVE_FROM_CART"; productId: string }
  | { type: "UPDATE_CART_QUANTITY"; productId: string; quantity: number }
  
  // Orders
  | { type: "VIEW_ORDERS" }
  | { type: "ORDER_DETAILS"; orderCode: string }
  
  // Support
  | { type: "ASK_IDENTITY" }      // "chi sei?", "chi siete?"
  | { type: "ASK_LOCATION" }      // "dove siete?", "indirizzo?"
  | { type: "ASK_FAQ"; query: string }
  | { type: "REQUEST_HUMAN" }
  
  // Selection (from numbered list)
  | { type: "SELECT_OPTION"; number: number; resolvedValue: string; listType: ListType }
  
  // Confirmation
  | { type: "CONFIRM" }
  | { type: "REJECT" }
  
  // Unknown
  | { type: "UNKNOWN"; originalMessage: string }

type ListType = "CATEGORIES" | "PRODUCTS" | "GROUPS" | "ORDERS" | "CART_ITEMS"
```

**Parsing Strategy** (in ordine di priorità):

1. **Pattern matching deterministico** per casi comuni:
   - Numeri ("1", "2", "5") → `SELECT_OPTION` (risolve da history)
   - "sì", "ok", "va bene" → `CONFIRM`
   - "no", "annulla" → `REJECT`
   - "carrello", "cart" → `VIEW_CART`
   - "ordini", "orders" → `VIEW_ORDERS`
   - "chi sei", "chi siete", "who are you" → `ASK_IDENTITY`
   - "dove siete", "indirizzo", "where are you" → `ASK_LOCATION`
   - "operatore", "umano", "human" → `REQUEST_HUMAN`

2. **Keyword matching** per categorie/prodotti conosciuti:
   - Match esatto su nomi categorie dal DB → `SHOW_CATEGORY`
   - Match esatto su nomi prodotti dal DB → `SHOW_PRODUCT`

3. **LLM fallback** (solo se i primi 2 falliscono):
   - Chiedi all'LLM solo "qual è l'intent?" con opzioni limitate
   - NO function calling, NO decisioni complesse

---

### 2. DataLoader (`data-loader.service.ts`)

**Responsabilità**: Caricare SOLO i dati necessari per l'intent.

```typescript
interface LoadedData {
  // Product data
  products?: Product[]
  categories?: Category[]
  category?: Category
  product?: Product
  
  // Cart data
  cart?: CartItem[]
  cartTotal?: number
  
  // Order data
  orders?: Order[]
  order?: Order
  
  // Support data
  identity?: string        // botIdentityResponse
  address?: string         // workspace.address
  faqResults?: FAQ[]
  
  // Metadata
  count: number
  isEmpty: boolean
}

// Esempio uso
const data = await dataLoader.load(intent, workspaceId, customerId)

// Per SHOW_CATEGORY "Formaggi":
// → { products: [...7 items...], category: { name: "Formaggi" }, count: 7 }

// Per ASK_IDENTITY:
// → { identity: "Sono l'assistente virtuale...", count: 1 }

// Per VIEW_CART:
// → { cart: [...items...], cartTotal: 45.50, count: 3 }
```

---

### 3. ResponseBuilder (`response-builder.service.ts`)

**Responsabilità**: Applicare la logica di business e costruire il template di risposta.

```typescript
interface ResponseTemplate {
  mode: ResponseMode
  data: any
  prompt: string          // Domanda finale ("Quale prodotto?", "Aggiungi al carrello?")
  formatting: FormattingHints
}

type ResponseMode =
  | "CATEGORIES_LIST"     // Lista categorie con count
  | "PRODUCTS_LIST"       // Lista 3-5 prodotti
  | "PRODUCTS_GROUPED"    // 2-4 gruppi per 6+ prodotti
  | "PRODUCT_DETAIL"      // Dettaglio singolo prodotto
  | "CART_VIEW"           // Contenuto carrello
  | "ORDER_LIST"          // Lista ordini
  | "ORDER_DETAIL"        // Dettaglio ordine
  | "IDENTITY"            // Risposta identità
  | "LOCATION"            // Risposta indirizzo
  | "FAQ_ANSWER"          // Risposta FAQ
  | "CONFIRMATION_REQUEST"// Conferma azione
  | "ERROR"               // Messaggio errore
  | "NOT_FOUND"           // Prodotto/ordine non trovato

interface FormattingHints {
  language: string        // IT, EN, ES, PT
  useEmoji: boolean
  listStyle: "numbered" | "bullet"
  showPrices: boolean
  showStock: boolean
}
```

**Count Rules (CODICE, non LLM)**:

```typescript
function buildProductResponse(products: Product[], category: string): ResponseTemplate {
  const count = products.length
  
  if (count === 0) {
    return {
      mode: "NOT_FOUND",
      data: { searchedCategory: category },
      prompt: "Vuoi vedere le categorie disponibili?",
      formatting: { ... }
    }
  }
  
  if (count <= 2) {
    return {
      mode: "PRODUCT_DETAIL",
      data: { products },  // Dettagli completi
      prompt: "Vuoi aggiungerlo al carrello?",
      formatting: { ... }
    }
  }
  
  if (count <= 5) {
    return {
      mode: "PRODUCTS_LIST",
      data: { products },  // Lista con prezzi
      prompt: "Quale prodotto ti interessa?",
      formatting: { ... }
    }
  }
  
  // count >= 6: GROUPING OBBLIGATORIO
  const groups = createProductGroups(products)  // Logica JS!
  return {
    mode: "PRODUCTS_GROUPED",
    data: { groups },
    prompt: "Quale gruppo ti interessa?",
    formatting: { ... }
  }
}
```

**Grouping Logic (CODICE, non LLM)**:

```typescript
function createProductGroups(products: Product[]): ProductGroup[] {
  // Strategia 1: Per sottocategoria (se esiste)
  const bySubcategory = groupBy(products, p => p.subcategory)
  if (Object.keys(bySubcategory).length >= 2) {
    return formatGroups(bySubcategory)
  }
  
  // Strategia 2: Per fascia di prezzo
  const avgPrice = average(products.map(p => p.price))
  const byPrice = {
    "Budget": products.filter(p => p.price < avgPrice),
    "Premium": products.filter(p => p.price >= avgPrice)
  }
  if (byPrice.Budget.length >= 2 && byPrice.Premium.length >= 2) {
    return formatGroups(byPrice)
  }
  
  // Strategia 3: Per regione (se disponibile)
  const byRegion = groupBy(products, p => p.region || "Altro")
  if (Object.keys(byRegion).length >= 2) {
    return formatGroups(byRegion)
  }
  
  // Fallback: Prima metà / Seconda metà
  const mid = Math.ceil(products.length / 2)
  return [
    { name: "Gruppo 1", products: products.slice(0, mid) },
    { name: "Gruppo 2", products: products.slice(mid) }
  ]
}
```

---

### 4. LLMFormatter (`llm-formatter.service.ts`)

**Responsabilità**: SOLO formattare il ResponseTemplate in linguaggio naturale.

```typescript
class LLMFormatter {
  async format(template: ResponseTemplate, language: string): Promise<string> {
    // Prompt MINIMALISTA - solo formattazione
    const systemPrompt = `
You are a formatting assistant. Convert the data into natural ${language} language.

RULES:
- Use the EXACT data provided (no additions, no removals)
- Follow the formatting hints
- Keep it concise
- End with the provided prompt question

DATA MODE: ${template.mode}
`
    
    const response = await this.llm.chat({
      model: "gpt-4o-mini",
      temperature: 0.3,  // Basso per consistenza
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(template) }
      ]
    })
    
    return response.content
  }
}
```

**Esempio Input/Output**:

```typescript
// INPUT (ResponseTemplate)
{
  mode: "PRODUCTS_LIST",
  data: {
    products: [
      { name: "Mozzarella di Bufala", price: 7.10 },
      { name: "Parmigiano Reggiano", price: 8.10 },
      { name: "Gorgonzola Dolce", price: 5.90 }
    ]
  },
  prompt: "Quale prodotto ti interessa?",
  formatting: { language: "IT", listStyle: "numbered", showPrices: true }
}

// OUTPUT (string)
"Ecco i formaggi disponibili:

1. Mozzarella di Bufala - €7.10
2. Parmigiano Reggiano - €8.10
3. Gorgonzola Dolce - €5.90

Quale prodotto ti interessa?"
```

---

## 📁 Struttura File

```
apps/backend/src/
├── application/
│   ├── intent/
│   │   ├── intent-parser.service.ts      # Parse messaggio → Intent
│   │   ├── intent.types.ts               # Tipi Intent
│   │   └── patterns/
│   │       ├── numeric-selection.ts      # Pattern per "1", "2", etc.
│   │       ├── confirmation.ts           # Pattern per "sì", "no"
│   │       ├── identity.ts               # Pattern per "chi sei"
│   │       └── location.ts               # Pattern per "dove siete"
│   │
│   ├── data-loader/
│   │   ├── data-loader.service.ts        # Carica dati per intent
│   │   └── loaders/
│   │       ├── product-loader.ts
│   │       ├── cart-loader.ts
│   │       ├── order-loader.ts
│   │       └── support-loader.ts
│   │
│   ├── response-builder/
│   │   ├── response-builder.service.ts   # Costruisce ResponseTemplate
│   │   ├── response.types.ts             # Tipi ResponseTemplate
│   │   ├── builders/
│   │   │   ├── product-response.ts       # Count rules, grouping
│   │   │   ├── cart-response.ts
│   │   │   ├── order-response.ts
│   │   │   └── support-response.ts
│   │   └── grouping/
│   │       └── product-grouper.ts        # Logica grouping deterministica
│   │
│   └── llm-formatter/
│       ├── llm-formatter.service.ts      # LLM per SOLO formatting
│       └── templates/
│           ├── product-templates.ts
│           ├── cart-templates.ts
│           └── support-templates.ts
│
├── services/
│   └── chat-orchestrator.service.ts      # Nuovo entry point (sostituisce LLMRouterService)
```

---

## 🔄 Migration Plan

### Fase 1: Foundation (Giorno 1)
- [ ] Creare tipi Intent (`intent.types.ts`)
- [ ] Creare tipi ResponseTemplate (`response.types.ts`)
- [ ] Creare IntentParser base con pattern matching
- [ ] Unit test per IntentParser

### Fase 2: DataLoader (Giorno 2)
- [ ] Creare DataLoader service
- [ ] Implementare loaders per ogni tipo intent
- [ ] Unit test per DataLoader

### Fase 3: ResponseBuilder (Giorno 2-3)
- [ ] Creare ResponseBuilder service
- [ ] Implementare count rules (CODICE)
- [ ] Implementare grouping logic (CODICE)
- [ ] Unit test per ResponseBuilder

### Fase 4: LLMFormatter (Giorno 3)
- [ ] Creare LLMFormatter service
- [ ] Prompt minimalisti per ogni ResponseMode
- [ ] Integration test

### Fase 5: Integration (Giorno 4)
- [ ] Creare ChatOrchestrator (nuovo entry point)
- [ ] Collegare: IntentParser → DataLoader → ResponseBuilder → LLMFormatter
- [ ] Mantenere backward compatibility con webhook
- [ ] End-to-end test

### Fase 6: Cutover (Giorno 5)
- [ ] Feature flag per switch graduale
- [ ] Monitor errori
- [ ] Deprecare LLMRouterService
- [ ] Rimuovere vecchi agent LLM

---

## ✅ Acceptance Criteria

### AC-1: Intent Detection Accuracy
- [ ] 100% accuracy su selezioni numeriche ("1", "2", "3")
- [ ] 100% accuracy su conferme ("sì", "ok", "no")
- [ ] 100% accuracy su "chi siete" vs "dove siete"
- [ ] > 95% accuracy su intent generici

### AC-2: Count Rules Enforcement
- [ ] 0 prodotti → messaggio "non trovato" + categorie
- [ ] 1-2 prodotti → dettaglio completo + "aggiungi al carrello?"
- [ ] 3-5 prodotti → lista numerata + "quale ti interessa?"
- [ ] 6+ prodotti → SEMPRE gruppi (2-4) - MAI lista completa

### AC-3: Grouping Logic
- [ ] Gruppi creati da CODICE, non LLM
- [ ] Sempre 2-4 gruppi
- [ ] Ogni gruppo ha almeno 2 items
- [ ] Somma gruppi = totale prodotti

### AC-4: Response Consistency
- [ ] Stesso input → stesso output (deterministico)
- [ ] Nessuna variabile non sostituita
- [ ] Formattazione consistente

### AC-5: Performance
- [ ] IntentParser: < 50ms (pattern matching)
- [ ] DataLoader: < 100ms (query mirate)
- [ ] ResponseBuilder: < 10ms (logica JS)
- [ ] LLMFormatter: < 1s (solo formatting)
- [ ] Totale: < 1.5s (vs 3-5s attuale)

---

## 🎯 Benefici Attesi

| Aspetto | Prima | Dopo |
|---------|-------|------|
| Tempo risposta | 3-5s | < 1.5s |
| Consistenza | ~70% | ~99% |
| Bug rate | Alto | Basso |
| Testabilità | Difficile | Facile |
| Debug | "Cosa pensava l'LLM?" | Log ogni step |
| Token usage | ~15k/messaggio | ~2k/messaggio |
| Costo | ~$0.003/msg | ~$0.0004/msg |

---

## 📝 Documentazione da Aggiornare

### File da Aggiornare (durante implementazione)

| File | Cosa Aggiornare |
|------|-----------------|
| `docs/regole_di_prompts.md` | Rimuovere sezioni obsolete su function calling LLM, aggiungere sezione "Code-First Architecture" |
| `docs/memory-bank/PRD.md` | Aggiornare architettura LLM nella sezione tecnica |
| `docs/architecture/TEMPLATE_SYSTEM.md` | Deprecare vecchio sistema template, documentare ResponseBuilder |
| `docs/PROMPT_VARIABLES.md` | Semplificare - meno variabili necessarie con nuovo sistema |

### Nuova Documentazione da Creare

| File | Contenuto |
|------|-----------|
| `docs/architecture/CODE_FIRST_LLM.md` | Architettura completa del nuovo sistema |
| `docs/architecture/INTENT_PARSER.md` | Guida IntentParser con tutti i pattern |
| `docs/architecture/RESPONSE_BUILDER.md` | Logica count rules e grouping |
| `docs/guides/ADDING_NEW_INTENT.md` | How-to per aggiungere nuovi intent |

### Cleanup Post-Migration

- [ ] Rimuovere vecchi template da `templates/ecommerce/` e `templates/informational/`
- [ ] Deprecare `LLMRouterService` (mantenere per backward compatibility 30 giorni)
- [ ] Rimuovere agent LLM obsoleti (`ProductSearchAgentLLM`, etc.)
- [ ] Aggiornare `regole_di_prompts.md` per riflettere nuova architettura
- [ ] Aggiornare Swagger docs per nuovi endpoint (se cambiano)

---

## 🚀 Next Steps

1. ✅ **Andrea approva** questo plan
2. **Giorno 1**: Implemento IntentParser con test
3. **Review** dopo Giorno 1 prima di continuare
4. **Iterazione** fino a completamento

---

## 📚 Riferimenti

- `docs/regole_di_prompts.md` - Regole esistenti (da mantenere)
- `docs/memory-bank/PRD.md` - Product Requirements
- Pattern "Code decides, LLM formats" documentato in `regole_di_prompts.md`
