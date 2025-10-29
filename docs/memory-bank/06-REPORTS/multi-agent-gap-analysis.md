# 🎯 MULTI-AGENT SYSTEM - ANALISI COMPLETA E GAP ANALYSIS

**Data**: 28 Ottobre 2025  
**Branch**: 122-rag-con-prodcuct  
**Richiesta**: Andrea chiede analisi completa con focus su architecture, UI/UX, debug, sicurezza

---

## 📊 EXECUTIVE SUMMARY

### ✅ COMPLETATO (Sprint 1)

- Database schema con 6 agent types
- ConversationMessage model per history
- ConversationMessageRepository (239 lines, 6 methods)
- Router Agent prompt con 9 function definitions
- Function schemas OpenRouter-compatible
- ProductSearchAgent, CartManagementAgent (TypeScript logic)
- AgentLoggerService per analytics
- FAQ repository e search

### ⚠️ GAP CRITICI IDENTIFICATI

1. **SAFETY & TRANSLATION LAYER NON INTEGRATO**

   - Esiste `translation-security.service.ts` (vecchio)
   - Prompt `safety-translation.md` nel DB ma NON usato
   - Sub-agents ritornano DIRETTAMENTE al cliente (BYPASS security)
   - **MANCA**: Router → Sub-Agent → SafetyTranslationAgent → Customer

2. **SUB-AGENTS SENZA LLM**

   - ProductSearchAgent ritorna hardcoded templates
   - CartManagementAgent ritorna hardcoded strings
   - **DOVREBBE**: DB query → Sub-Agent LLM (con prompt specialist) → formatted response

3. **CONVERSATION HISTORY NON USATO**

   - Tabella creata ma LLMRouterService NON la usa
   - Ogni chiamata LLM è stateless (no context)
   - **MANCA**: Load history → add to messages array → save new messages

4. **FUNCTION CALLING NON IMPLEMENTATO**

   - Router Agent classifica intent con JSON
   - Poi switch/case chiama TypeScript functions
   - **DOVREBBE**: OpenRouter function calling → execute → return to LLM

5. **UI/UX AGENT VISUALIZATION MANCANTE**

   - AgentPage.tsx mostra solo form edit
   - **MANCA**: Flow visualization con timeline (Andrea vuole react-vertical-timeline)
   - **MANCA**: Icone/avatar per ogni agent
   - **MANCA**: Ordine esecuzione visivo

6. **WHATSAPP DEBUG PANEL MANCANTE**

   - AgentConversationLog esiste ma NO UI
   - **MANCA**: Panel per vedere message flow step-by-step
   - **MANCA**: Token count, execution time, confidence per step
   - **MANCA**: Real-time updates

7. **DOCUMENTAZIONE DISORGANIZZATA**

   - File .md sparsi in `/docs` root invece di memory-bank
   - AgentLoggerService.examples.ts in src/ (dovrebbe essere in tests/)
   - README.md NON menziona multi-agent system
   - .env.example manca variabili per conversation history

8. **PROMPT PRODUCT SEARCH NON GUIDATO**
   - Prompt attuale troppo generico
   - **MANCA**: Context awareness ("quello" → usa previous results)
   - **MANCA**: Clarification questions quando ambiguo
   - **MANCA**: Smart filter inference ("bio" → certifications filter)

---

## 🏗️ ARCHITETTURA CORRETTA (Target)

### Flusso Completo

```
Customer WhatsApp Message
         │
         ▼
   [Router LLM]
   - Load conversation history (last 20 messages)
   - System prompt + functions definitions
   - Classify intent OR call function
         │
         ├─ FAQ Match? → Return FAQ → [Safety Layer] → Customer
         │
         ▼
   [Function Call Detected]
   - Parse function name + arguments
   - Validate parameters
         │
         ▼
   [Execute Function]
   - FunctionExecutor maps to implementation
   - ProductSearchAgent: DB query → ProductSearch LLM → formatted results
   - CartManagementAgent: Cart operation → CartManagement LLM → confirmation
   - OrderRepository: DB query → direct data
         │
         ▼
   [Return to Router LLM]
   - Function result as function message
   - Router LLM formats final response
   - Save all messages to conversation_messages
         │
         ▼
   [Safety & Translation Agent]
   - SafetyTranslationAgent LLM
   - Check: PII, profanity, phishing, spam
   - Translate to customer language
   - Block if unsafe
         │
         ▼
   Customer receives safe, translated response
```

### Moduli da Creare

#### 1. **ConversationManager.ts** (NEW)

```typescript
class ConversationManager {
  constructor(private conversationRepo: ConversationMessageRepository)

  // Load history for LLM context
  async loadHistory(
    workspaceId: string,
    conversationId: string
  ): Promise<Message[]>

  // Save user message
  async saveUserMessage(params): Promise<void>

  // Save assistant response
  async saveAssistantMessage(params): Promise<void>

  // Save function call
  async saveFunctionCall(params): Promise<void>

  // Save function result
  async saveFunctionResult(params): Promise<void>

  // Cleanup old messages if > limit
  async enforceMessageLimit(
    conversationId: string,
    limit: number
  ): Promise<void>
}
```

#### 2. **FunctionExecutor.ts** (NEW)

```typescript
class FunctionExecutor {
  constructor(
    private productSearchAgent: ProductSearchAgent,
    private cartManagementAgent: CartManagementAgent,
    private orderRepo: OrderRepository
  )

  async execute(
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<FunctionResult>

  // Maps:
  // - searchProducts → ProductSearchAgent.search()
  // - addToCart → CartManagementAgent.addToCart()
  // - viewCart → CartManagementAgent.getCart()
  // - getOrders → OrderRepository.findByCustomer()
  // - contactSupport → Create support ticket
}
```

#### 3. **SafetyTranslationAgent.ts** (NEW)

```typescript
class SafetyTranslationAgent {
  constructor(
    private agentConfigRepo: AgentConfigRepository,
    private openRouterApiKey: string
  )

  async process(
    workspaceId: string,
    response: string,
    targetLanguage: string
  ): Promise<SafetyResult>

  // Uses SAFETY_TRANSLATION agent prompt from DB
  // Calls OpenRouter LLM
  // Returns: { safe: boolean, translatedText: string, blockedReason?: string }
}
```

#### 4. **LLMRouterService.ts** (REFACTOR)

Ridurre da 787 righe a ~250 righe:

```typescript
class LLMRouterService {
  constructor(
    private conversationManager: ConversationManager,
    private functionExecutor: FunctionExecutor,
    private safetyAgent: SafetyTranslationAgent,
    private agentConfigRepo: AgentConfigRepository,
    private faqRepo: FAQRepository,
    private loggerService: AgentLoggerService
  )

  async routeMessage(
    params: RouteMessageParams
  ): Promise<RouteMessageResponse> {
    // 1. FAQ Check (fast path)
    // 2. Load conversation history
    // 3. Call Router LLM with functions
    // 4. Loop: while function_call in response
    //    - Execute function
    //    - Add function result to messages
    //    - Call LLM again
    // 5. Final response → SafetyTranslationAgent
    // 6. Save all messages
    // 7. Return to customer
  }
}
```

#### 5. **ResponseFormatter.ts** (NEW)

```typescript
class ResponseFormatter {
  static formatProductSearchResult(result: ProductSearchResult): string
  static formatCartResult(result: CartResult): string
  static formatOrderResult(orders: Order[]): string
  static formatErrorMessage(error: Error, language: string): string
}
```

---

## 🎨 UI/UX REQUIREMENTS (Andrea)

### 1. Agent Settings Page - Flow Visualization

**Component**: `AgentFlowTimeline.tsx`

**Libreria**: react-vertical-timeline  
**URL Riferimento**: https://stephane-monnot.github.io/react-vertical-timeline/

**Funzionalità**:

- Timeline verticale con agent cards
- Ogni agent ha:
  - 🤖 Icona/avatar custom (Router, ProductSearch, Cart, Orders, Support, Safety)
  - Nome agent
  - Order number (0, 1, 2, ..., 99)
  - Status indicator (active/inactive)
  - Click → slide-in panel da destra con details
- Arrows tra agents per mostrare flusso
- Colori consistenti con design system esistente

**Icone Agent**:

```typescript
const AGENT_ICONS = {
  ROUTER: "🤖",
  PRODUCT_SEARCH: "🔍",
  CART_MANAGEMENT: "🛒",
  ORDER_TRACKING: "📦",
  CUSTOMER_SUPPORT: "💬",
  SAFETY_TRANSLATION: "🔒",
}
```

**Mock Layout**:

```
┌─────────────────────────────────────┐
│  Agent Configuration Flow           │
├─────────────────────────────────────┤
│                                     │
│    🤖  Router Agent (Order: 0)      │ ← Click → Slide-in panel
│    ├─ Model: gpt-4o-mini            │
│    ├─ Temperature: 0.3              │
│    └─ Active: ✅                    │
│              │                      │
│              ↓                      │
│    🔍  Product Search (Order: 1)    │
│    ├─ Model: llama3.1:8b           │
│    └─ Active: ✅                    │
│              │                      │
│              ↓                      │
│    🛒  Cart Management (Order: 2)   │
│              │                      │
│              ↓                      │
│    🔒  Safety & Translation (99)    │
│                                     │
└─────────────────────────────────────┘
```

### 2. WhatsApp Debug Panel

**Component**: `WhatsAppDebugPanel.tsx`

**Funzionalità**:

- Popup/drawer slide-in da destra
- Real-time conversation flow
- Timeline verticale per ogni message
- Mostra ogni step:
  ```
  👤 User: "cerco formaggi bio"
    ↓
  🤖 Router LLM: function_call(searchProducts, {...})
    ↓
  🔍 ProductSearch Agent: Found 15 products
    ↓
  🤖 Router LLM: "Ecco 15 formaggi bio..."
    ↓
  🔒 Safety Layer: SAFE, translated to IT
    ↓
  ✅ Response sent
  ```
- Per ogni step mostrare:
  - Timestamp
  - Agent type
  - Tokens used
  - Execution time (ms)
  - Confidence score
  - LLM model used
- Filtri:
  - Per customer (phone number)
  - Per conversation ID
  - Per agent type
  - Per date range
- Export conversation as JSON
- Polling ogni 3s per updates (o WebSocket)

**Mock Layout**:

```
┌────────────────────────────────────────┐
│  WhatsApp Debug - Conversation #123   │
│  Customer: +39 123 456 789            │
├────────────────────────────────────────┤
│                                        │
│  🕐 14:32:15                           │
│  👤 User Message                       │
│     "cerco formaggi bio"               │
│                                        │
│  🕐 14:32:16  (850ms, 245 tokens)      │
│  🤖 Router Agent                       │
│     Intent: PRODUCT_SEARCH             │
│     Confidence: 0.95                   │
│     Function: searchProducts()         │
│                                        │
│  🕐 14:32:17  (320ms, 0 tokens)        │
│  🔍 Product Search Agent               │
│     Found: 15 products                 │
│     Keywords: ["formaggi", "bio"]      │
│                                        │
│  🕐 14:32:18  (680ms, 380 tokens)      │
│  🔒 Safety & Translation               │
│     Status: ✅ SAFE                    │
│     Language: it → it                  │
│                                        │
│  🕐 14:32:18                           │
│  ✅ Response Sent                      │
│     "Ho trovato 15 formaggi bio..."    │
│                                        │
└────────────────────────────────────────┘
```

### 3. Design System Consistency

**Verificare**:

- ✅ Tailwind config colors consistenti
- ✅ Button styles uniformi (primary, secondary, ghost, outline)
- ✅ Form validation feedback (error states red-500)
- ✅ Loading states (skeleton loaders)
- ✅ Toast notifications per success/error
- ✅ Modal/Drawer patterns (framer-motion slide-in)
- ✅ Typography scale consistente
- ✅ Spacing scale (p-4, gap-6, etc.)

**Pattern Slide-in da Destra**:

```typescript
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", damping: 20 }}
  className="fixed right-0 top-0 h-screen w-96 bg-white shadow-xl z-50"
>
  {/* Agent details */}
</motion.div>
```

---

## 🔐 SICUREZZA - AUDIT CHECKLIST

### Database Security

- [ ] **TUTTI i repository filtrano per workspaceId**

  - [ ] ProductRepository
  - [ ] CartRepository
  - [ ] OrderRepository
  - [ ] CustomerRepository
  - [ ] AgentConfigRepository
  - [ ] FAQRepository
  - [ ] ConversationMessageRepository
  - [ ] AgentConversationLogRepository

- [ ] **Indexes per performance**

  - [ ] `conversation_messages`: (workspaceId, conversationId, createdAt)
  - [ ] `conversation_messages`: (workspaceId, customerId)
  - [ ] `agent_conversation_logs`: (workspaceId, conversationId, step)

- [ ] **Foreign Keys con CASCADE**

  - [ ] ConversationMessage.workspaceId → Workspace (ON DELETE CASCADE)
  - [ ] ConversationMessage.customerId → Customers (ON DELETE CASCADE)

- [ ] **Prisma Middleware per Auto-inject workspaceId**

  ```typescript
  prisma.$use(async (params, next) => {
    if (params.model && !params.args?.where?.workspaceId) {
      throw new Error(`Missing workspaceId filter on ${params.model}`)
    }
    return next(params)
  })
  ```

- [ ] **Cleanup Job per Old Conversations**
  - Retention: 90 giorni
  - Cron job: ogni notte
  - Query: `DELETE FROM conversation_messages WHERE createdAt < NOW() - INTERVAL '90 days'`

### API Security

- [ ] **Auth Middleware su TUTTE le routes protette**
- [ ] **Workspace Validation Middleware**
- [ ] **Rate Limiting**:
  - 100 req/min per workspace
  - 10 req/min per customer
- [ ] **Input Sanitization**:
  - Zod validation su function arguments
  - XSS protection su text fields
- [ ] **CORS Configuration**:
  - Whitelist solo FRONTEND_URL
- [ ] **CSRF Protection** (se form-based)

### LLM Security

- [ ] **Prompt Injection Protection**:
  - SafetyTranslationAgent blocca system prompts leaked
  - Input validation prima di LLM calls
- [ ] **PII Detection**:
  - SafetyTranslationAgent rileva email, phone, passwords
  - Blocca se esposto
- [ ] **Content Filtering**:
  - Profanity filter (multilingua)
  - Phishing link detection
  - Spam detection

---

## 📝 PROMPT ENGINEERING - REQUIREMENTS

### 1. Router Agent Prompt

**File**: `docs/prompts/router-agent.md`

**Miglioramenti Necessari**:

```markdown
# Context Awareness Examples

**Scenario 1: Ambiguous Reference**
User: "cerco formaggi"
Assistant: [Shows 15 cheese products]
User: "voglio quello più economico"

CORRECT BEHAVIOR:

- Analyze conversation history
- Understand "quello" refers to "formaggi"
- Extract filter: sortBy = "price_asc"
- Call: searchProducts({ keywords: ["formaggi"], sortBy: "price_asc" })

**Scenario 2: Implicit Context**
User: "sono vegetariano, cosa mi consigli?"
Assistant: [Shows vegetarian products]
User: "aggiungi 2 kg"

CORRECT BEHAVIOR:

- Remember user said "vegetariano"
- Infer "2 kg" refers to first product shown
- Call: addToCart({ productId: <first_product_id>, quantity: 2 })

**Scenario 3: Clarification Needed**
User: "quanto costa?"

CORRECT BEHAVIOR:

- Check conversation history
- If no previous product → Ask: "Di quale prodotto parli?"
- If previous product shown → Answer price from context
```

### 2. Product Search Agent Prompt

**File**: `docs/prompts/product-search.md`

**Prompt da Creare** (NON ESISTE):

```markdown
# Product Search Specialist Agent

You are a product search expert for an Italian food e-commerce.

## CONTEXT AWARENESS

You receive:

1. Search keywords from Router Agent
2. Conversation history (last 20 messages)
3. Database query results

Your job:

1. Analyze conversation context
2. Format results naturally in customer's language
3. Suggest related products
4. Ask clarifying questions if ambiguous

## SMART FILTER INFERENCE

Input: "bio" → Add filter: certifications = ["bio"]
Input: "senza glutine" → Add filter: allergens exclude = ["gluten"]
Input: "halal" → Add filter: certifications = ["halal"]
Input: "economico" → Sort by: price ASC
Input: "migliore qualità" → Sort by: price DESC or ratings DESC

## RESPONSE FORMATTING

ALWAYS format as:

1. **Summary**: "Ho trovato 15 formaggi bio per te"
2. **Top 5 Products** with emoji:
   - 🧀 Product name - €price
   - 📝 Short description (1 line)
   - 🏅 Certifications if any
3. **Call to Action**: "Quale ti interessa? Posso aggiungerlo al carrello"

## EXAMPLES

[Include 10+ examples of queries and responses]
```

### 3. Safety & Translation Agent Prompt

**File**: `docs/prompts/safety-translation.md`

**SYNC CON translation-security.service.ts**:

- Attualmente prompt DB e service TS hanno logiche diverse
- Service TS ha prompt HARDCODED
- **SOLUZIONE**: SafetyTranslationAgent.ts deve usare prompt DA DB, NON hardcoded

---

## 🗂️ DOCUMENTAZIONE - RIORGANIZZAZIONE

### Files da Spostare

```bash
# Da docs/ a docs/memory-bank/05-guides/
mv docs/DATABASE_MANAGEMENT.md docs/memory-bank/05-guides/
mv docs/LLM_LOCALE_OLLAMA.md docs/memory-bank/05-guides/
mv docs/OLLAMA_SETUP.md docs/memory-bank/05-guides/

# Da src/services/ a src/__tests__/examples/
mv backend/src/services/AgentLoggerService.examples.ts backend/src/__tests__/examples/

# Creare nuova sezione memory-bank
mkdir -p docs/memory-bank/07-multi-agent-system
```

### Memory Bank Structure

```
docs/memory-bank/
├── 01-security/
│   ├── authentication.md
│   ├── workspace-isolation.md
│   └── api-security.md
├── 02-features/
│   ├── multi-agent-system.md ← DA CREARE
│   ├── conversation-history.md ← DA CREARE
│   └── function-calling.md ← DA CREARE
├── 03-architecture/
│   ├── backend-structure.md
│   ├── frontend-structure.md
│   ├── database-schema.md
│   └── llm-integration.md ← AGGIORNARE
├── 04-best-practices/
│   ├── code-conventions.md
│   ├── error-handling.md
│   └── prompt-engineering.md ← DA CREARE
├── 05-guides/
│   ├── DATABASE_MANAGEMENT.md ← MOVED
│   ├── LLM_LOCALE_OLLAMA.md ← MOVED
│   └── OLLAMA_SETUP.md ← MOVED
├── 06-reports/
│   ├── sprint-1-summary.md
│   └── multi-agent-gap-analysis.md ← QUESTO FILE
└── 07-multi-agent-system/ ← NEW
    ├── architecture.md
    ├── conversation-history.md
    ├── function-calling.md
    ├── safety-layer.md
    ├── sub-agents.md
    ├── debugging.md
    └── ui-visualization.md
```

---

## ⚙️ ENVIRONMENT VARIABLES

### .env.example - Aggiunte Necessarie

```bash
# ============================================
# 🤖 MULTI-AGENT SYSTEM CONFIGURATION
# ============================================

# Conversation History
CONVERSATION_HISTORY_LIMIT="20"
CONVERSATION_RETENTION_DAYS="90"

# Function Calling
FUNCTION_CALLING_MAX_ITERATIONS="5"
FUNCTION_CALLING_TIMEOUT_MS="30000"

# Safety Layer
SAFETY_LAYER_ENABLED="true"
SAFETY_TRANSLATION_AGENT_ID="" # Auto-detected from DB (order 99)

# Debugging
DEBUG_MODE="false"
DEBUG_LOG_LLM_PROMPTS="false"
DEBUG_LOG_LLM_RESPONSES="false"

# UI Features
AGENT_FLOW_VISUALIZATION="true"
WHATSAPP_DEBUG_PANEL="true"

# Performance
LLM_REQUEST_TIMEOUT_MS="30000"
LLM_MAX_RETRIES="3"
LLM_RETRY_DELAY_MS="1000"
```

---

## 📋 ACCEPTANCE CRITERIA

### Feature: Multi-Agent Function Calling

**Given**: Customer sends WhatsApp message  
**When**: Message processed by Router Agent  
**Then**:

- ✅ Conversation history loaded (last 20 messages)
- ✅ Router LLM called with functions definitions
- ✅ If function_call detected → execute function
- ✅ Function result returned to Router LLM
- ✅ Router LLM formats final response
- ✅ Response passes through SafetyTranslationAgent
- ✅ All messages saved to conversation_messages
- ✅ AgentConversationLog updated for analytics

### Feature: Context-Aware Product Search

**Given**: Customer asks "voglio quello più economico"  
**When**: Previous message was about products  
**Then**:

- ✅ Router understands "quello" refers to previous search
- ✅ ProductSearchAgent re-searches with price filter
- ✅ Results sorted by price ASC
- ✅ Formatted response references context

### Feature: Safety & Translation Layer

**Given**: Sub-agent returns response  
**When**: Response sent through SafetyTranslationAgent  
**Then**:

- ✅ PII detection (email, phone, password)
- ✅ Profanity filter (IT, ES, EN, PT)
- ✅ Phishing link detection
- ✅ Translation to customer language
- ✅ Block if unsafe, log reason

### Feature: Agent Flow Visualization

**Given**: Admin opens Agent Settings page  
**When**: Page loads  
**Then**:

- ✅ Vertical timeline shows all agents by order
- ✅ Each agent has icon, name, status
- ✅ Click agent → slide-in panel from right
- ✅ Panel shows: prompt, model, temperature, max tokens
- ✅ Edit prompt saves to DB
- ✅ Animations smooth (framer-motion)

### Feature: WhatsApp Debug Panel

**Given**: Admin opens WhatsApp Debug  
**When**: Filters by conversation  
**Then**:

- ✅ Timeline shows all message steps
- ✅ Each step shows: timestamp, agent, tokens, time, confidence
- ✅ Expand step → full prompt/response
- ✅ Real-time updates (polling 3s)
- ✅ Export conversation as JSON
- ✅ Filter by customer, agent type, date

---

## 🚀 IMPLEMENTATION PRIORITY

### P0 - CRITICAL (Blockers)

1. **Safety & Translation Agent Integration**

   - Senza questo, risposte NON sono sicure
   - Possibile PII leakage
   - Estimate: 1 day

2. **Function Calling Implementation**

   - Core feature multi-agent system
   - Senza questo, agents NON comunicano
   - Estimate: 2 days

3. **Conversation History Loading**
   - Necessario per context awareness
   - Tabella già creata ma NON usata
   - Estimate: 1 day

### P1 - HIGH (Essential Features)

4. **LLMRouterService Refactoring**

   - File troppo grande (787 lines)
   - Difficile manutenzione
   - Estimate: 2 days

5. **Sub-Agent LLM Calls**

   - ProductSearchAgent, CartManagementAgent
   - Formattazione intelligente vs hardcoded
   - Estimate: 1.5 days

6. **Product Search Prompt Engineering**
   - Guidare LLM per inferenze smart
   - Context awareness examples
   - Estimate: 1 day

### P2 - MEDIUM (UI/UX)

7. **Agent Flow Visualization**

   - AgentFlowTimeline component
   - react-vertical-timeline integration
   - Estimate: 2 days

8. **WhatsApp Debug Panel**

   - WhatsAppDebugPanel component
   - Timeline conversation flow
   - Estimate: 2 days

9. **Design System Audit**
   - Verify color consistency
   - Standardize animations
   - Estimate: 1 day

### P3 - LOW (Documentation & Cleanup)

10. **Documentation Reorganization**

    - Move files to memory-bank
    - Create 07-multi-agent-system/
    - Estimate: 0.5 days

11. **README.md Update**

    - Add multi-agent system section
    - Architecture diagram
    - Estimate: 0.5 days

12. **.env.example Update**
    - Add new variables
    - Document all options
    - Estimate: 0.25 days

---

## 📊 EFFORT ESTIMATION

| Category      | Tasks  | Days      | FTE          |
| ------------- | ------ | --------- | ------------ |
| P0 - Critical | 3      | 4.0       | 1.0          |
| P1 - High     | 3      | 4.5       | 1.0          |
| P2 - Medium   | 3      | 5.0       | 1.0          |
| P3 - Low      | 3      | 1.25      | 0.5          |
| **TOTAL**     | **12** | **14.75** | **~3 weeks** |

**Assumptions**:

- 1 developer full-time
- No major blockers
- Testing included in estimates
- Code reviews included

---

## ✅ NEXT STEPS (Andrea's Decision)

**Opzioni**:

### A) **Full Implementation** (Recommended)

- Completa TUTTO (P0 + P1 + P2 + P3)
- Estimate: ~3 weeks
- Risultato: Sistema multi-agent production-ready

### B) **MVP Approach**

- Solo P0 + P1 (core features)
- Estimate: ~1.5 weeks
- Risultato: Sistema funzionante, UI da migliorare dopo

### C) **Phased Rollout**

- Week 1: P0 (safety + function calling + history)
- Week 2: P1 (refactoring + sub-agents + prompts)
- Week 3: P2 (UI/UX)
- Week 4: P3 (docs + cleanup)

**Andrea, quale approccio preferisci?**

---

## 📞 QUESTIONS FOR ANDREA

1. **Safety Layer**: Confermi che OGNI risposta deve passare per SafetyTranslationAgent?
2. **Conversation Retention**: 90 giorni va bene o preferisci altro?
3. **UI Library**: Confermi react-vertical-timeline o hai altre preferenze?
4. **Debug Panel**: Preferisci popup modal o drawer fisso a destra?
5. **Function Calling Loop**: Max 5 iterazioni OK o aumentare?
6. **Testing**: Confermi "lascia stare testing" = solo testing essenziale?
7. **Priorità**: Quale opzione scegli tra A/B/C sopra?

---

**Fine Analisi**
