# 🤖 ShopME - Analisi Multi-Agent LLM Architecture

**Data:** 27 Ottobre 2025  
**Status:** 📋 Architettura Completa

---

## 📋 INDICE

1. [Panoramica Generale](#-panoramica-generale)
2. [Problema Attuale](#-problema-attuale)
3. [Architettura Target](#-architettura-target)
4. [Design Database](#-design-database)
5. [Agent Types & Responsabilità](#-agent-types--responsabilità)
6. [Sistema di Logging](#-sistema-di-logging)
7. [Frontend Architecture](#-frontend-architecture)
8. [Security Model](#-security-model)
9. [Metriche di Successo](#-metriche-di-successo)

---

## 🎯 PANORAMICA GENERALE

### Obiettivo

Migrare da architettura LLM **monolitica** (singolo prompt da 9933 righe) a sistema **multi-agent** con orchestrazione intelligente per:

- ✅ **Riduzione Token**: 60% riduzione costi (da 50KB a 5KB per conversazione)
- ✅ **Manutenibilità**: Ogni agent 1000 righe invece di 9933 righe monolitiche
- ✅ **Specializzazione**: Agent dedicati per product search, cart, orders, support, etc.
- ✅ **Debugging**: Visibilità completa interazioni LLM con logs dettagliati
- ✅ **Scalabilità**: Aggiunta nuovi agent senza toccare sistema esistente
- ✅ **Testing**: Test isolati per ogni agent invece di sistema intero

### Motivazione

**Problema iniziale**: "Se cerco per categoria come può funzionare?"

Ricerca prodotti deve gestire:

- 🔍 **Categorie**: "latticini", "salumi", "prodotti freschi"
- 🥗 **Filtri Dietetici**: "vegetariano", "halal", "bio", "vegano"
- 🚫 **Esclusioni Ingredienti**: "senza olio di palma", "senza glutine"
- 🌍 **Multilingua**: "dame productos vegetarianos", "give me halal products"
- 💰 **Offerte**: "prodotti in offerta", "sconti attivi"

### Architettura Attuale vs Target

**PRIMA (Monolitico)**:

```
User Message → LLMService (9933 righe prompt) → CallingFunctions → Response
- Token: ~50KB per messaggio
- Prompt: Tutti prodotti, tutti ordini, tutte FAQ in un solo prompt
- Debugging: Impossibile capire reasoning
- Manutenzione: Modifiche rischiano di rompere tutto
```

**DOPO (Multi-Agent)**:

```
User Message → Router Agent (order: 0) → Specialized Agent (order: 1-98) → Safety Agent (order: 99) → Response
- Token: ~5KB per messaggio (60% riduzione)
- Prompt: Ogni agent ha solo le info che servono
- Debugging: Log completo di ogni step con reasoning
- Manutenzione: Modifiche isolate per agent
```

---

## 🔴 PROBLEMA ATTUALE

### Limiti Architettura Monolitica

1. **Token Explosion**:

   - Prompt include TUTTI i prodotti, TUTTI gli ordini, TUTTE le FAQ
   - Costo: $0.15 per 1M input tokens × 50KB = ~$7.50 per 1000 conversazioni
   - Con multi-agent: $0.15 × 5KB = ~$0.75 per 1000 conversazioni (90% saving)

2. **Product Search Naive**:

   - Query "latticini" → LLM legge 1000+ prodotti per trovare matches
   - Query "senza olio di palma" → LLM legge ingredienti di tutti i prodotti
   - Soluzione: **QueryPlannerService** sub-agent converte query a parametri strutturati

3. **No FAQ Integration**:

   - FAQ hardcoded nel prompt o assenti
   - Risk: LLM inventa risposte invece di usare FAQ
   - Soluzione: Router checks FAQ PRIMA di routing

4. **Debugging Impossible**:

   - No visibility su quale parte del prompt causa behavior
   - No tracking di reasoning steps
   - Soluzione: AgentConversationLog salva ogni LLM interaction

5. **Maintenance Nightmare**:
   - Modificare prompt rischia breaking changes
   - No testing isolato
   - Soluzione: Agent isolati, testabili indipendentemente

---

## 🏗️ ARCHITETTURA TARGET

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER MESSAGE                              │
│                   (WhatsApp / Web Chat)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTER AGENT (order: 0)                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ 1. Check FAQ First (priority check)                    │     │
│  │    - Match keywords/semantic search                    │     │
│  │    - If match → Return FAQ answer directly             │     │
│  │ 2. If no FAQ match → Classify Intent:                  │     │
│  │    - PRODUCT_SEARCH: "cerco latticini"                 │     │
│  │    - CART_MANAGEMENT: "aggiungi al carrello"           │     │
│  │    - ORDER_TRACKING: "dove è il mio ordine"            │     │
│  │    - CUSTOMER_SUPPORT: "non funziona nulla!"           │     │
│  │    - PROFILE_MANAGEMENT: "cambia indirizzo"            │     │
│  │    - NOTIFICATIONS: "disattiva notifiche"              │     │
│  │ 3. Route to appropriate agent                          │     │
│  └────────────────────────────────────────────────────────┘     │
│  Model: GPT-4o-mini | Temp: 0.3 | Tokens: 2K                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│PRODUCT_SEARCH│    │CART_MGMT     │    │ORDER_TRACK   │
│(order: 2)    │    │(order: 3)    │    │(order: 4)    │
│              │    │              │    │              │
│Has Sub-Agent:│    │Actions:      │    │Actions:      │
│QueryAnalyzer │    │- addToCart   │    │- viewOrders  │
│🔬 (LEVEL 3)  │    │- repeatOrder │    │- invoice     │
│              │    │- resetCart   │    │              │
└──────┬───────┘    └──────────────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│QUERY_ANALYZER│ ← NEW! LEVEL 3 Sub-Sub-Agent
│🔬 (order: 6) │
│              │
│- Multi-lang  │ (IT/EN/ES/PT)
│- Region Map  │ (20 Italian regions)
│- Zero-Temp   │ (Deterministic)
│- Pure JSON   │ (No functions)
└──────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              SAFETY & TRANSLATION AGENT (order: 99)              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ 1. Content Safety Check:                               │     │
│  │    - Remove sensitive info (PII, passwords)            │     │
│  │    - Block offensive content                           │     │
│  │    - Validate output format                            │     │
│  │ 2. Translation (if needed):                            │     │
│  │    - Detect customer language                          │     │
│  │    - Translate Italian response → customer language    │     │
│  │ 3. Final formatting                                    │     │
│  └────────────────────────────────────────────────────────┘     │
│  Model: Claude Sonnet 4.5 | Temp: 0.2 | Tokens: 2K              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  FINAL RESPONSE │
                    └─────────────────┘
```

### Agent Execution Order

| Order | Agent Type            | Model         | Purpose                                 |
| ----- | --------------------- | ------------- | --------------------------------------- |
| 0     | ROUTER                | GPT-4o-mini   | FAQ check + Intent classification       |
| 2     | PRODUCT_SEARCH        | GPT-4o-mini   | Product search with QueryAnalyzer 🔬    |
| 3     | CART_MANAGEMENT       | GPT-4o-mini   | Cart operations                         |
| 4     | ORDER_TRACKING        | GPT-4o-mini   | Order viewing/tracking                  |
| 5     | CUSTOMER_SUPPORT      | GPT-4o-mini   | Frustration detection + escalation      |
| 6     | **QUERY_ANALYZER** 🔬 | GPT-4o-mini   | **LEVEL 3 sub-agent for ProductSearch** |
| 7     | PROFILE_MANAGEMENT    | GPT-4o-mini   | Profile modification links              |
| 8     | NOTIFICATIONS         | GPT-4o-mini   | Push notification management            |
| 99    | SAFETY_TRANSLATION    | Claude Sonnet | Safety filter + translation             |

**Note**: Orders 1, 8-98 riservati per futuri custom agents

---

## 🗄️ DESIGN DATABASE

### Schema Completo

```prisma
enum AgentType {
  ROUTER                // order: 0 - Intent classification + FAQ
  PRODUCT_SEARCH        // order: 2 - Product search specialist
  CART_MANAGEMENT       // order: 3 - Cart operations
  ORDER_TRACKING        // order: 4 - Order viewing
  CUSTOMER_SUPPORT      // order: 5 - Support & escalation
  PROFILE_MANAGEMENT    // order: 6 - Profile modifications
  NOTIFICATIONS         // order: 7 - Push notifications
  SAFETY_TRANSLATION    // order: 99 - Safety + translation
  CUSTOM                // order: 1, 8-98 - Custom agents
}

model AgentConfig {
  id                String    @id @default(cuid())
  workspaceId       String    // SECURITY: multi-tenant isolation

  // Agent Identity
  name              String    // Display name: "Product Search Agent"
  type              AgentType // Enum type
  description       String?   // User-friendly description

  // LLM Configuration
  systemPrompt      String    @db.Text // Agent-specific prompt
  model             String    @default("openai/gpt-4o-mini")
  temperature       Float     @default(0.7)
  maxTokens         Int       @default(4096)

  // Execution Control
  order             Int       @default(0) // Execution order (0=Router, 99=Safety)
  isActive          Boolean   @default(true)

  // Available Functions (Calling Functions integration)
  availableFunctions Json?    // Array of CF names: ["searchProducts", "addToCart"]

  // Metadata
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Constraints
  @@unique([workspaceId, type]) // One agent per type per workspace
  @@index([workspaceId, isActive])
  @@index([order]) // For execution order sorting
}

model FAQ {
  id          String   @id @default(cuid())
  workspaceId String   // SECURITY: multi-tenant isolation

  // FAQ Content
  question    String   // User question: "Come posso modificare l'ordine?"
  answer      String   @db.Text // Full answer with markdown support
  keywords    String[] // Fast matching: ["ordine", "modifica", "cambiare"]

  // Organization
  category    String?  // Optional grouping: "Ordini", "Spedizioni"
  order       Int      @default(0) // Display order
  isActive    Boolean  @default(true)

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Indexes
  @@index([workspaceId, isActive])
  @@index([keywords]) // GIN index for array search
  @@index([category])
}

model AgentConversationLog {
  id              String   @id @default(cuid())

  // Security & Context
  workspaceId     String   // SECURITY: multi-tenant isolation
  customerId      String   // SECURITY: customer isolation
  conversationId  String   // Group messages: "conv_123"
  messageId       String   // Original message ID

  // Execution Tracking
  step            Int      // Execution order: 1, 2, 3... (Router=1, Agent=2, Safety=3)
  agentType       String   // "ROUTER", "PRODUCT_SEARCH", etc.
  agentAction     String   // "classify_intent", "search_products", "translate"

  // LLM Interaction
  inputMessage    String   @db.Text // Input to this agent
  agentPrompt     String?  @db.Text // Complete prompt used (optional, can be large)
  llmModel        String?  // "openai/gpt-4o-mini"
  llmResponse     String   @db.Text // Raw LLM output

  // Reasoning & Confidence
  confidence      Float?   // 0.0-1.0 confidence score
  reasoning       String?  @db.Text // Agent's reasoning (if provided)

  // Performance Metrics
  tokensUsed      Int?     // Total tokens (input + output)
  executionTimeMs Int?     // Latency in milliseconds

  // Function Calling
  functionsCalled Json?    // Array: [{name: "searchProducts", params: {...}, result: {...}}]

  // Error Tracking
  hasError        Boolean  @default(false)
  errorMessage    String?  @db.Text

  // Metadata
  createdAt       DateTime @default(now())

  // Indexes for Performance
  @@index([workspaceId, customerId]) // Security filter
  @@index([conversationId]) // Group by conversation
  @@index([createdAt]) // Time-based queries
  @@index([agentType]) // Analytics per agent type
  @@index([hasError]) // Error tracking
}
```

### Seed Data Strategy

**6 Default Agents per Workspace**:

1. **ROUTER** (order: 0)

   - Model: `openai/gpt-4o-mini`
   - Temp: 0.3 (low for consistent routing)
   - Prompt: `docs/prompts/router-agent.md`
   - Functions: None (routing only)

2. **PRODUCT_SEARCH** (order: 2)

   - Model: `openai/gpt-4o-mini`
   - Temp: 0.7
   - Prompt: `docs/prompts/product-search-agent.md`
   - Functions: `["searchProducts", "getProductDetails"]`
   - **Has Sub-Agent**: QueryPlannerService

3. **CART_MANAGEMENT** (order: 3)

   - Model: `openai/gpt-4o-mini`
   - Temp: 0.5
   - Prompt: `docs/prompts/cart-management-agent.md`
   - Functions: `["addToCart", "removeFromCart", "viewCart", "resetCart", "repeatOrder"]`

4. **ORDER_TRACKING** (order: 4)

   - Model: `openai/gpt-4o-mini`
   - Temp: 0.5
   - Prompt: `docs/prompts/order-tracking-agent.md`
   - Functions: `["getOrders", "getOrderDetails", "generateInvoice"]`

5. **CUSTOMER_SUPPORT** (order: 5)

   - Model: `openai/gpt-4o-mini`
   - Temp: 0.8
   - Prompt: `docs/prompts/customer-support-agent.md`
   - Functions: `["contactOperator", "reportIssue"]`

6. **SAFETY_TRANSLATION** (order: 99)
   - Model: `anthropic/claude-3.5-sonnet` (optional, can use GPT-4o-mini)
   - Temp: 0.2 (low for consistent safety)
   - Prompt: `docs/prompts/safety-translation-agent.md`
   - Functions: None (final filter only)

**15-20 FAQ Entries per Workspace**:

Categories:

- **Ordini** (5-6 FAQ): Modifiche, cancellazioni, stato ordine
- **Spedizioni** (3-4 FAQ): Tempi, costi, tracking
- **Pagamenti** (3-4 FAQ): Metodi, fatture, rimborsi
- **Prodotti** (3-4 FAQ): Certificazioni, ingredienti, disponibilità
- **Account** (2-3 FAQ): Registrazione, password, privacy

Example:

```javascript
{
  question: "Come posso modificare il mio ordine?",
  answer: "Gli ordini possono essere modificati entro 2 ore dalla conferma. Contatta il supporto per assistenza.",
  keywords: ["ordine", "modificare", "cambiare", "modifica"],
  category: "Ordini",
  order: 1,
  isActive: true
}
```

---

## 🤖 AGENT TYPES & RESPONSABILITÀ

### 1. ROUTER AGENT (order: 0)

**Ruolo**: Entry point, FAQ checker, intent classifier

**Flow**:

```
1. Receive user message
2. Check FAQ database FIRST (priority)
   - Match by keywords (fast)
   - If match → return FAQ answer, STOP
3. If no FAQ → Classify intent:
   - PRODUCT_SEARCH: keywords like "cerca", "prodotti", "voglio", category names
   - CART_MANAGEMENT: "aggiungi", "carrello", "rimuovi"
   - ORDER_TRACKING: "ordine", "spedizione", "tracking"
   - CUSTOMER_SUPPORT: frustration keywords, "aiuto", "problema"
   - PROFILE_MANAGEMENT: "modifica", "profilo", "indirizzo"
   - NOTIFICATIONS: "notifiche", "push", "disattiva"
4. Route to appropriate agent
5. Pass context + original message
```

**Prompt Structure**:

```markdown
# System Role

Sei il Router Agent di ShopME. Il tuo compito è:

1. Controllare se esiste una FAQ che risponde al messaggio
2. Se no, classificare l'intento e passare all'agent appropriato

# FAQ Database

{{faq_list}} // Injected from database

# Intent Classification Rules

- PRODUCT_SEARCH: ricerca prodotti, categorie, filtri dietetici
- CART_MANAGEMENT: operazioni carrello (add, remove, reset, repeat)
- ORDER_TRACKING: visualizzazione ordini, fatture, tracking
- CUSTOMER_SUPPORT: frustrazione, problemi, richiesta operatore
- PROFILE_MANAGEMENT: modifiche profilo
- NOTIFICATIONS: gestione notifiche push

# Output Format

Se FAQ match:
{
"type": "FAQ_RESPONSE",
"answer": "...",
"faqId": "..."
}

Se routing:
{
"type": "ROUTE_TO_AGENT",
"agent": "PRODUCT_SEARCH",
"context": {...},
"reasoning": "..."
}
```

**Calling Functions**: None (routing only)

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.3 (low for consistent classification)
- Max Tokens: 2048

---

### 2. PRODUCT_SEARCH AGENT (order: 2)

**Ruolo**: Product search specialist with QueryAnalyzer 🔬 sub-agent (LEVEL 3)

**Responsabilità**:

- Convertire query naturali a parametri strutturati via QueryAnalyzer
- Gestire ricerche multilingua (IT/EN/ES/PT → traduzione a italiano = lingua DB)
- Filtrare per categorie, suppliers, certificazioni, regioni italiane
- Presentare risultati in modo user-friendly
- Memoria conversazionale (10 minuti) per raffinamenti contestuali

**QueryAnalyzer Sub-Agent (LEVEL 3 - SUB-SUB LLM)**:

```javascript
// 🔬 QueryAnalyzer Flow (LEVEL 3 - Zero Hardcoded Mappings)

// Input: User query in any language
"organic sardinian cheese" (English)
"queso sardo orgánico" (Spanish)
"queijo sardo orgânico" (Portuguese)
"formaggio sardo biologico" (Italian)

// QueryAnalyzer LLM Process (Temperature: 0 - Deterministic):
1. Detect language: IT/EN/ES/PT
2. Extract structured filters via LLM intelligence:
   - Categories: Match natural language to DB categoryIds
   - Suppliers: Match company names to supplierIds
   - Certifications: [isOrganic, isVegan, isGlutenFree, isHalal, isWholeGrain]
   - Regions: 20 Italian regions in ENGLISH (Sardinia, Sicily, Tuscany, etc.)
   - Keywords: ALWAYS translate to Italian (base language)
   - PriceRange: {min, max}
3. Handle conversational context (10 min memory):
   - "only organic ones" → Inherit previous filters + add isOrganic

// Output: Structured JSON filters
{
  "categoryIds": [], // UUIDs from DB (never empty strings)
  "supplierIds": [], // UUIDs from DB
  "certifications": ["isOrganic"],
  "regions": ["Sardinia"],
  "keywords": ["formaggio", "sardo", "biologico"], // Italian
  "priceRange": null,
  "reasoning": "Detected organic certification and Sardinia region"
}

// 💾 Conversational State (SearchConversations table):
- sessionId: WhatsApp/Chat session
- lastQuery: "organic sardinian cheese"
- lastResponse: "Found 5 products"
- expiresAt: +10 minutes
- state: ACTIVE | COMPLETED | ABANDONED | EXPIRED
```

**Prompt Structure**:

````markdown
# System Role

Sei il Product Search Agent di ShopME. Aiuti i clienti a trovare prodotti.

# Customer Context

- Nome: {{customer.name}}
- Lingua: {{customer.language}}
- Preferenze Dietetiche: {{customer.dietaryPreferences}}

# Available Categories

{{categories}} // Injected from DB

# Available Filters

- Certifications: isVegetarian, isVegan, isHalal, isBio
- Exclude Ingredients: es. "olio di palma", "glutine"
- Price Range: min/max
- Only In Stock: true/false

# Process

1. Use QueryPlanner sub-agent to convert user query to structured params
2. Call searchProducts(params)
3. Present results in user's language
4. If no results → suggest alternatives

# Calling Functions Available

```javascript
// ProductSearch Agent Functions (LEVEL 2)
1. searchProducts(params)
2. getProductDetails(productId)
3. getCategoryProducts(categoryId)

// QueryAnalyzer Sub-Agent (LEVEL 3)
- NO calling functions (pure analysis, returns JSON structure)
- Output consumed by ProductSearchAgent to call searchProducts()
```
````

**Calling Functions**:

- `searchProducts`: Main search with advanced filters
  - **Before execution**: Calls QueryAnalyzer (LEVEL 3) to get structured filters
  - **Input**: User query in any language (IT/EN/ES/PT)
  - **QueryAnalyzer Output**: `{categoryIds, supplierIds, certifications, regions, keywords, priceRange, reasoning}`
  - **Final Search**: Uses QueryAnalyzer output to filter products
- `getProductDetails`: Single product details
- `getCategoryProducts`: Browse by category

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.7
- Max Tokens: 4096

**QueryAnalyzer Sub-Agent (LEVEL 3)**:

- Model: `openai/gpt-4o-mini`
- Temperature: **0** (deterministic for consistency)
- Max Tokens: 512
- Icon: 🔬 (Microscope)
- Prompt: Specialized for query analysis with multi-language support
- Agent Type: `QUERY_ANALYZER` (order: 6 in agentConfig)
- File: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`
- Prompt: `docs/prompts/query-analyzer-agent.md`

**Conversational Memory (SearchConversations)**:

- Table: `search_conversations`
- Duration: 10 minutes auto-expire
- Cronjob: Mark expired every 5 min, delete >30 days weekly
- State: ACTIVE → COMPLETED/ABANDONED/EXPIRED
- Repository: `backend/src/repositories/searchConversation.repository.ts`

---

### 3. CART_MANAGEMENT AGENT (order: 3)

**Ruolo**: Cart operations (add, remove, reset, repeat orders)

**Responsabilità**:

- Add/remove products from cart
- Quantity management
- Repeat previous orders
- Reset cart
- Show cart summary

**Prompt Structure**:

```markdown
# System Role

Sei il Cart Management Agent. Gestisci il carrello del cliente.

# Current Cart

{{cart_items}} // Injected from DB

# Customer Orders History

{{recent_orders}} // Last 5 orders for repeat functionality

# Process

1. Understand action: add, remove, repeat, reset, view
2. Validate product availability
3. Execute action via Calling Functions
4. Confirm action to user
5. Show updated cart summary

# Confirmation Required For

- Reset cart (if cart has items)
- Repeat order (confirm products + total)

# Calling Functions Available

- addToCart(productId, quantity)
- removeFromCart(cartItemId)
- viewCart()
- resetCart()
- repeatOrder(orderId)
```

**Calling Functions**:

- `addToCart`: Add product with quantity
- `removeFromCart`: Remove cart item
- `viewCart`: Show cart contents
- `resetCart`: Clear entire cart
- `repeatOrder`: Copy order items to cart

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.5
- Max Tokens: 3072

---

### 4. ORDER_TRACKING AGENT (order: 4)

**Ruolo**: Order viewing, tracking, invoice generation

**Responsabilità**:

- Show customer's orders (filtered by customerId)
- Order details with status
- Generate/send invoices
- Explain delivery times

**Prompt Structure**:

```markdown
# System Role

Sei l'Order Tracking Agent. Aiuti i clienti con i loro ordini.

# Customer Orders

{{orders}} // Filtered by customerId

# Order Status Explanations

- PENDING: In attesa di conferma
- CONFIRMED: Confermato, in preparazione
- SHIPPED: Spedito, in consegna
- DELIVERED: Consegnato
- CANCELLED: Annullato

# Process

1. Identify which order(s) user is asking about
2. Call getOrders() or getOrderDetails(orderId)
3. Present status in user's language
4. If invoice requested → generateInvoice(orderId)

# Calling Functions Available

- getOrders(customerId)
- getOrderDetails(orderId)
- generateInvoice(orderId)
```

**Calling Functions**:

- `getOrders`: List customer orders
- `getOrderDetails`: Single order details
- `generateInvoice`: Generate PDF invoice

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.5
- Max Tokens: 3072

---

### 5. CUSTOMER_SUPPORT AGENT (order: 5)

**Ruolo**: Frustration detection, escalation, operator contact

**Responsabilità**:

- Detect customer frustration
- Empathetic responses
- Escalate to human operator when needed
- Log support issues

**Frustration Triggers**:

- Multiple failed attempts
- Explicit frustration: "non funziona!", "aiuto!", "voglio parlare con una persona"
- Unresolved issues after 3 messages
- Offensive language (handled by Safety Agent later)

**Prompt Structure**:

```markdown
# System Role

Sei il Customer Support Agent. Aiuti clienti frustrati e escalti a operatori umani.

# Frustration Detection

Monitor questi segnali:

- Keywords: "aiuto", "non funziona", "problema", "operatore"
- Tone: frustrazione, urgenza
- Context: tentativi falliti multipli

# Response Strategy

1. Acknowledge frustration with empathy
2. Try to resolve issue within your capabilities
3. If unresolvable → contactOperator()

# Calling Functions Available

- contactOperator(reason, urgency)
- reportIssue(description, category)
```

**Calling Functions**:

- `contactOperator`: Notify human operator
- `reportIssue`: Log issue for analytics

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.8 (higher for empathetic responses)
- Max Tokens: 3072

---

### 6. PROFILE_MANAGEMENT AGENT (order: 6)

**Ruolo**: Profile modification (via secure links)

**Responsabilità**:

- Generate secure links for profile editing
- Explain what can be modified
- Privacy & GDPR compliance info

**Prompt Structure**:

```markdown
# System Role

Sei il Profile Management Agent. Aiuti clienti a modificare il loro profilo.

# Modifiable Fields

- Nome e Cognome
- Indirizzo di spedizione
- Telefono
- Email
- Preferenze dietetiche
- Lingua preferita

# Process

1. Understand what user wants to modify
2. Generate secure token via SecureTokenService
3. Send link with expiration time
4. Explain privacy policy

# Calling Functions Available

- generateProfileLink(customerId, fields[])
```

**Calling Functions**:

- `generateProfileLink`: Create time-limited edit link

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.5
- Max Tokens: 2048

---

### 7. NOTIFICATIONS AGENT (order: 7)

**Ruolo**: Push notification management

**Responsabilità**:

- Enable/disable push notifications
- Configure notification preferences
- Explain notification types

**Prompt Structure**:

```markdown
# System Role

Sei il Notifications Agent. Gestisci le preferenze di notifica.

# Notification Types

- Order Updates: Conferma, spedizione, consegna
- Offers: Promozioni e sconti
- News: Novità e comunicazioni

# Process

1. Understand user's preference
2. Update notification settings via CF
3. Confirm changes

# Calling Functions Available

- updateNotificationSettings(customerId, settings{})
- getNotificationSettings(customerId)
```

**Calling Functions**:

- `updateNotificationSettings`: Update preferences
- `getNotificationSettings`: View current settings

**Model Config**:

- Model: `openai/gpt-4o-mini`
- Temperature: 0.5
- Max Tokens: 2048

---

### 8. SAFETY_TRANSLATION AGENT (order: 99)

**Ruolo**: Final safety filter + translation layer

**Responsabilità**:

- Content safety check (remove PII, offensive content)
- Validate output format
- Translate Italian responses to customer's language
- Final formatting

**Flow**:

```
1. Receive response from previous agent (in Italian)
2. Safety checks:
   - Remove accidentally exposed PII
   - Block offensive content
   - Validate no SQL/code injection
3. Translation:
   - Detect customer's language
   - Translate Italian → customer language
   - Preserve markdown formatting
4. Final formatting:
   - Apply WhatsApp/Web formatting
   - Add emoji if appropriate
   - Ensure readability
5. Return final response
```

**Prompt Structure**:

```markdown
# System Role

Sei il Safety & Translation Agent. Sei l'ultimo filtro prima che la risposta arrivi al cliente.

# Safety Rules

BLOCK se trovi:

- PII esposta (email, telefono, password)
- Contenuto offensivo
- Informazioni sensibili aziendali
- SQL queries, code snippets

# Translation Rules

- Detect customer language from context
- Translate Italian → customer language
- Preserve:
  - Product names (keep original)
  - Numbers, prices, dates
  - Markdown formatting
  - Emoji

# Output Format

{
"safe": true/false,
"blockedReason": "..." // if blocked,
"translatedResponse": "...",
"language": "es/en/pt/it"
}
```

**Calling Functions**: None (final filter only)

**Model Config**:

- Model: `anthropic/claude-3.5-sonnet` (or GPT-4o-mini)
- Temperature: 0.2 (low for consistent safety)
- Max Tokens: 2048

---

## 📊 SISTEMA DI LOGGING

### AgentConversationLog - Formato Completo

**Ogni LLM call genera un log entry**:

```javascript
{
  // Security & Context
  workspaceId: "ws_abc123",
  customerId: "cust_xyz789",
  conversationId: "conv_20251027_001", // Groups messages in same conversation
  messageId: "msg_456", // Original WhatsApp message ID

  // Execution Tracking
  step: 2, // Router=1, ProductSearch=2, Safety=3
  agentType: "PRODUCT_SEARCH",
  agentAction: "search_products_with_filters",

  // LLM Interaction
  inputMessage: "Dame productos vegetarianos sin aceite de palma",
  agentPrompt: "# System Role\nSei il Product Search Agent...", // Full prompt (optional)
  llmModel: "openai/gpt-4o-mini",
  llmResponse: "{\"action\": \"searchProducts\", \"params\": {...}}",

  // Reasoning & Confidence
  confidence: 0.95, // Agent's confidence score
  reasoning: "User wants vegetarian products excluding palm oil. Translating query to Italian for database search.",

  // Performance Metrics
  tokensUsed: 2847, // input + output tokens
  executionTimeMs: 1234, // Latency

  // Function Calling
  functionsCalled: [
    {
      name: "searchProducts",
      params: {
        query: "formaggi OR pasta OR verdure",
        excludeTerms: ["olio di palma"],
        certifications: ["isVegetarian"]
      },
      result: {
        products: [...], // 15 products found
        count: 15
      }
    }
  ],

  // Error Tracking
  hasError: false,
  errorMessage: null,

  // Metadata
  createdAt: "2025-10-27T10:30:45.123Z"
}
```

### Log Aggregation Example

**Single Conversation View**:

```javascript
// conversationId: "conv_20251027_001"
[
  {
    step: 1,
    agentType: "ROUTER",
    agentAction: "check_faq_and_classify",
    inputMessage: "Dame productos vegetarianos sin aceite de palma",
    llmResponse: '{"type": "ROUTE_TO_AGENT", "agent": "PRODUCT_SEARCH", "reasoning": "Product search with dietary filters"}',
    tokensUsed: 856,
    executionTimeMs: 456,
    functionsCalled: null
  },
  {
    step: 2,
    agentType: "PRODUCT_SEARCH",
    agentAction: "search_products_with_filters",
    inputMessage: "Dame productos vegetarianos sin aceite de palma",
    llmResponse: '{"action": "searchProducts", "params": {...}}',
    tokensUsed: 2847,
    executionTimeMs: 1234,
    functionsCalled: [{name: "searchProducts", params: {...}, result: {...}}]
  },
  {
    step: 3,
    agentType: "SAFETY_TRANSLATION",
    agentAction: "translate_and_validate",
    inputMessage: "Ho trovato 15 prodotti vegetariani senza olio di palma: ...",
    llmResponse: '{"safe": true, "translatedResponse": "Encontré 15 productos vegetarianos sin aceite de palma: ..."}',
    tokensUsed: 1523,
    executionTimeMs: 789,
    functionsCalled: null
  }
]

// Total conversation metrics:
// - Steps: 3
// - Total tokens: 5226
// - Total time: 2479ms (~2.5s)
// - Functions called: 1 (searchProducts)
// - Errors: 0
```

### Logging Service Methods

```typescript
class AgentLoggerService {
  async logAgentInteraction(params: {
    workspaceId: string
    customerId: string
    conversationId: string
    messageId: string
    step: number
    agentType: string
    agentAction: string
    inputMessage: string
    agentPrompt?: string
    llmModel?: string
    llmResponse: string
    confidence?: number
    reasoning?: string
    tokensUsed?: number
    executionTimeMs?: number
    functionsCalled?: any[]
    hasError?: boolean
    errorMessage?: string
  }): Promise<AgentConversationLog>

  async getConversationLogs(
    conversationId: string
  ): Promise<AgentConversationLog[]>

  async getCustomerLogs(
    workspaceId: string,
    customerId: string,
    limit?: number
  ): Promise<AgentConversationLog[]>

  async getAgentPerformanceMetrics(
    workspaceId: string,
    agentType: string,
    dateRange: DateRange
  ): Promise<AgentMetrics>

  async getErrorLogs(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<AgentConversationLog[]>
}

interface AgentMetrics {
  totalCalls: number
  averageTokens: number
  averageLatencyMs: number
  successRate: number // (1 - errorRate)
  topFunctions: Array<{ name: string; count: number }>
  confidenceDistribution: { low: number; medium: number; high: number }
}
```

---

## 🎨 FRONTEND ARCHITECTURE

### ReactFlow Visual Management

**Main Page**: `AgentFlowManager.tsx`

Components:

1. **FlowDiagram**: ReactFlow canvas with custom nodes
2. **AgentNode**: Custom node showing agent info
3. **AgentDetailsPanel**: Right sidebar with agent config
4. **ExecutionLogs**: Bottom panel with conversation logs

**Flow Diagram**:

```
┌─────────────────────────────────────────────────────────────┐
│  ShopME - Agent Flow Manager                    [+ New Agent]│
├─────────────────────────────────────────────────────────────┤
│ ┌────────────┐                                               │
│ │   ROUTER   │ ──────────┬───────────┬────────────┐         │
│ │  (order:0) │           │           │            │         │
│ └────────────┘           │           │            │         │
│       │                  ▼           ▼            ▼         │
│       │          ┌────────────┐ ┌────────────┐ ┌────────┐  │
│       │          │  PRODUCT   │ │    CART    │ │ ORDER  │  │
│       │          │   SEARCH   │ │ MANAGEMENT │ │TRACKING│  │
│       │          │ (order:2)  │ │ (order:3)  │ │(order:4│  │
│       │          └────────────┘ └────────────┘ └────────┘  │
│       │                  │           │            │         │
│       └──────────────────┴───────────┴────────────┘         │
│                          │                                   │
│                          ▼                                   │
│                  ┌────────────┐                              │
│                  │   SAFETY   │                              │
│                  │TRANSLATION │                              │
│                  │ (order:99) │                              │
│                  └────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

**AgentNode Component**:

```tsx
interface AgentNodeData {
  id: string
  name: string
  type: AgentType
  order: number
  model: string
  isActive: boolean
  calls: number // Last 24h
  avgLatency: number
  successRate: number
}

function AgentNode({ data }: { data: AgentNodeData }) {
  const color = getColorByType(data.type) // ROUTER=blue, PRODUCT_SEARCH=green, etc.

  return (
    <div className={`agent-node border-2 rounded-lg p-4 ${color}`}>
      <Handle type="target" position="top" />

      <div className="font-bold">{data.name}</div>
      <div className="text-sm text-muted">Order: {data.order}</div>
      <div className="text-xs">{data.model}</div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="font-semibold">{data.calls}</div>
          <div>Calls</div>
        </div>
        <div>
          <div className="font-semibold">{data.avgLatency}ms</div>
          <div>Latency</div>
        </div>
        <div>
          <div className="font-semibold">{data.successRate}%</div>
          <div>Success</div>
        </div>
      </div>

      <Handle type="source" position="bottom" />
    </div>
  )
}
```

**AgentDetailsPanel**:

```tsx
function AgentDetailsPanel({ agentId }: { agentId: string }) {
  const { agent, updateAgent } = useAgent(agentId)
  const [editMode, setEditMode] = useState(false)

  return (
    <div className="w-96 border-l p-4">
      <div className="flex justify-between">
        <h2>{agent.name}</h2>
        <Button onClick={() => setEditMode(!editMode)}>
          {editMode ? 'Save' : 'Edit'}
        </Button>
      </div>

      {editMode ? (
        <>
          <Label>Model</Label>
          <Select value={agent.model} onChange={...}>
            <option>openai/gpt-4o-mini</option>
            <option>anthropic/claude-3.5-sonnet</option>
          </Select>

          <Label>Temperature</Label>
          <Slider min={0} max={2} step={0.1} value={agent.temperature} />

          <Label>Max Tokens</Label>
          <Input type="number" value={agent.maxTokens} />

          <Label>System Prompt</Label>
          <MonacoEditor
            language="markdown"
            value={agent.systemPrompt}
            height="400px"
            onChange={...}
          />
        </>
      ) : (
        <>
          <div>Model: {agent.model}</div>
          <div>Temperature: {agent.temperature}</div>
          <div>Max Tokens: {agent.maxTokens}</div>

          <h3>Performance (Last 24h)</h3>
          <PerformanceChart agentId={agentId} />
        </>
      )}
    </div>
  )
}
```

**ExecutionLogs**:

```tsx
function ExecutionLogs({ conversationId }: { conversationId?: string }) {
  const { logs, loading } = useConversationLogs(conversationId)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => refetch(), 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  return (
    <div className="h-64 border-t p-4">
      <div className="flex justify-between mb-2">
        <h3>Execution Logs</h3>
        <div className="flex gap-2">
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh}>
            Auto-refresh
          </Switch>
          <Button onClick={exportLogs}>Export CSV</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Latency</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{log.step}</TableCell>
              <TableCell>{log.agentType}</TableCell>
              <TableCell>{log.agentAction}</TableCell>
              <TableCell>{log.tokensUsed}</TableCell>
              <TableCell>{log.executionTimeMs}ms</TableCell>
              <TableCell>
                {log.hasError ? (
                  <Badge variant="destructive">Error</Badge>
                ) : (
                  <Badge variant="success">Success</Badge>
                )}
              </TableCell>
              <TableCell>
                <ExpandLogDialog log={log} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### UI Libraries

**Required npm packages**:

- `reactflow`: Visual flow diagram (already installed?)
- `@monaco-editor/react`: VS Code editor for prompts
- `recharts`: Performance charts
- `@tanstack/react-query`: Data fetching & caching
- `date-fns`: Date formatting

**Existing**: shadcn/ui components (Button, Input, Select, Table, Badge, etc.)

---

## 🔒 SECURITY MODEL

### Multi-Tenant Isolation

**CRITICAL RULES**:

1. **Every Database Query**: MUST filter by `workspaceId`

   ```typescript
   // ❌ WRONG
   await prisma.agentConfig.findMany()

   // ✅ CORRECT
   await prisma.agentConfig.findMany({
     where: { workspaceId },
   })
   ```

2. **Every Log Entry**: MUST include `workspaceId` + `customerId`

   ```typescript
   await agentLogger.logAgentInteraction({
     workspaceId, // REQUIRED
     customerId, // REQUIRED
     // ...
   })
   ```

3. **Repository Layer**: Enforce workspace isolation

   ```typescript
   class AgentConfigRepository {
     async findByType(
       workspaceId: string,
       type: AgentType
     ): Promise<AgentConfig | null> {
       // workspaceId is REQUIRED parameter, not optional
       return prisma.agentConfig.findUnique({
         where: { workspaceId_type: { workspaceId, type } },
       })
     }
   }
   ```

4. **Service Layer**: Validate customer belongs to workspace

   ```typescript
   class AgentLoggerService {
     async logAgentInteraction(params) {
       // Validate customer belongs to workspace
       const customer = await prisma.customer.findUnique({
         where: { id: params.customerId },
       })

       if (customer.workspaceId !== params.workspaceId) {
         throw new Error(
           "Security violation: customer does not belong to workspace"
         )
       }

       // Then create log
       await prisma.agentConversationLog.create({ data: params })
     }
   }
   ```

5. **API Endpoints**: Always use middleware chain
   ```typescript
   router.get(
     "/workspaces/:workspaceId/agents",
     authMiddleware, // JWT validation
     workspaceValidationMiddleware, // Extract workspaceId from token
     agentController.getAgents // Use (req as any).workspaceId
   )
   ```

### Security Checklist

- [ ] All AgentConfig queries filter by workspaceId
- [ ] All FAQ queries filter by workspaceId
- [ ] All AgentConversationLog entries include workspaceId + customerId
- [ ] Repository methods require workspaceId as parameter (not optional)
- [ ] Service methods validate customer belongs to workspace before logging
- [ ] API routes use authMiddleware + workspaceValidationMiddleware
- [ ] No hardcoded workspace IDs in code
- [ ] No cross-workspace data leaks in logs
- [ ] Frontend API calls include workspace context
- [ ] Swagger docs document workspace isolation requirements

---

## 📈 METRICHE DI SUCCESSO

### Obiettivi Quantitativi

**Token Reduction**:

- Current: ~50KB per conversation (9933 line prompt)
- Target: ~5KB per conversation (specialized agents)
- **Savings**: 90% reduction = $8-9 per 1000 conversations

**Performance**:

- Current: ~3-5s average response time
- Target: ~2-3s (parallel agent execution where possible)
- **Improvement**: 30-40% faster

**Maintainability**:

- Current: 9933 lines single file
- Target: 8 agents × 1000 lines = 8000 lines total (but modular)
- **Benefit**: Isolated testing, independent deployment

**Debugging**:

- Current: No visibility into LLM reasoning
- Target: Complete log of every agent interaction with confidence scores
- **Benefit**: Root cause analysis in minutes vs hours

### KPIs da Monitorare

**Agent Performance**:

- Calls per agent (last 24h, 7d, 30d)
- Average latency per agent
- Token usage per agent
- Success rate (1 - error rate)
- Confidence score distribution

**Router Accuracy**:

- FAQ hit rate (% messages answered by FAQ)
- Intent classification accuracy (manual validation sample)
- Misrouting rate (% times wrong agent called)

**Product Search Quality**:

- Search result relevance (user clicks/conversions)
- QueryPlanner accuracy (manual validation)
- Multilingual query success rate

**Customer Satisfaction**:

- Frustration detection accuracy
- Operator escalation rate
- Resolution time (from first message to resolved)

**Cost Metrics**:

- Total tokens used per day
- Cost per conversation
- Cost per agent type
- Cost reduction vs monolithic system

### Dashboard Metriche

**Frontend Dashboard** (da creare):

```
┌─────────────────────────────────────────────────────────────┐
│  ShopME - Agent Analytics                      [Last 24h ▼] │
├─────────────────────────────────────────────────────────────┤
│  📊 Overview                                                 │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐ │
│  │ Total Calls  │ Avg Latency  │ Token Usage  │   Cost   │ │
│  │    1,247     │   2.3s       │    6.2M      │  $0.93   │ │
│  └──────────────┴──────────────┴──────────────┴──────────┘ │
│                                                              │
│  📈 Agent Performance                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Agent Type       Calls  Latency  Tokens  Success Rate  │ │
│  │ ROUTER           1,247   456ms    2.1M      99.8%      │ │
│  │ PRODUCT_SEARCH     487   1.2s     2.8M      98.3%      │ │
│  │ CART_MANAGEMENT    342   890ms    1.1M      99.1%      │ │
│  │ ORDER_TRACKING     198   1.1s     1.0M      99.5%      │ │
│  │ SAFETY             1,247  234ms    1.5M     100.0%      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  🎯 Router Analytics                                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FAQ Hit Rate: 34.2% (427/1247 messages)                │ │
│  │ Most Common FAQ: "Come modificare ordine" (87 hits)    │ │
│  │                                                         │ │
│  │ Intent Distribution:                                    │ │
│  │ [███████] PRODUCT_SEARCH (39%)                         │ │
│  │ [█████  ] CART_MANAGEMENT (27%)                        │ │
│  │ [███    ] ORDER_TRACKING (16%)                         │ │
│  │ [██     ] CUSTOMER_SUPPORT (11%)                       │ │
│  │ [█      ] Other (7%)                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 LESSONS LEARNED & BEST PRACTICES

### Pattern da Seguire

1. **Database-First Configuration**

   - NEVER hardcode prompts in code
   - SEMPRE da `AgentConfig` table
   - Aggiornamenti senza deploy

2. **Workspace Isolation Everywhere**

   - Repository layer: workspaceId required parameter
   - Service layer: validate before action
   - No optional workspaceId parameters

3. **Comprehensive Logging**

   - Log EVERY LLM call
   - Include reasoning + confidence
   - Track function calls with params + results

4. **Sub-Agent Pattern for Specialization**

   - QueryPlanner: Convert natural language to structured params
   - Future: ImageAnalyzer, PriceCalculator, etc.
   - 5KB specialized prompts vs 50KB monolith

5. **FAQ Priority Check**

   - Router checks FAQ BEFORE intent classification
   - Avoids calling expensive agents for common questions
   - Reduces token usage + latency

6. **Safety as Final Filter**
   - Order 99 = always last
   - Catches any issues from previous agents
   - Translation layer separate from business logic

### Anti-Patterns da Evitare

❌ **Hardcoded Prompts**: Sempre da database  
❌ **Optional workspaceId**: Security risk  
❌ **No Logging**: Debugging impossible  
❌ **Monolithic Agents**: Hard to maintain  
❌ **FAQ After Routing**: Wastes tokens  
❌ **Mixed Concerns**: Keep agents focused

---

**Fine Analisi - Vedi TODO.md per task operativi** ✅
