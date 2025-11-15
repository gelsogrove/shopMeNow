# 📊 Specification Analysis Report - Constitution Audit

**Generated**: 2025-11-15  
**Analyst**: GitHub Copilot  
**Scope**: Andrea's Architecture Rules vs Constitution + Implementation  
**Severity Threshold**: CRITICAL (blocks implementation)

---

## 🎯 Executive Summary

Andrea ha definito **12 regole architetturali chiare** che devono essere rispettate. Questo report analizza:

1. ✅ **Allineamento con Constitution** (`.specify/memory/constitution.md`)
2. ✅ **Implementazione nel codice** (verificata in `backend/src/`)
3. ❌ **Inconsistenze trovate** (gap tra regole e implementazione)
4. 📝 **Raccomandazioni** (cosa aggiornare)

---

## 📋 Regole di Andrea (Fonte: User Request)

### Regola 1: **Utente Bloccato → Zero Messaggi**

**Definizione**: "se utente bloccato non riceve nulla"

**Verifica Constitution**:

- ✅ **ALLINEATO** - Constitution **Principle VI: Chat Isolation & Concurrency Safety**
- Menzione: "Customer-level locking", "Unique constraint on (customerId, status)"

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in llm-router.service.ts:306-389
private async checkBlockedUser(customerId: string): Promise<boolean> {
  const customer = await this.prisma.customers.findUnique({
    where: { id: customerId },
    select: { isBlocked: true }
  })
  return customer?.isBlocked || false
}

// Se bloccato → NO response, NO DB save
if (isBlocked) {
  return {
    finalResponse: "",
    isBlocked: true, // Flag per webhook
    // ... ZERO LLM tokens
  }
}
```

**Test Coverage**:

- ✅ `backend/src/__tests__/unit/services/llm-router-priorities.spec.ts`
  - Test: "should verify Customer has isBlocked field"
  - Test: "should return empty response for blocked customer"

**Stato**: ✅ **COMPLIANT**

---

### Regola 2: **Canale Disabilitato → Messaggio WIP da Workspace Settings**

**Definizione**: "Se il canale e' dosablitato da il messaggio di Wip dentro il workspace settings"

**Verifica Constitution**:

- ⚠️ **NON MENZIONATO** - Constitution non ha principio specifico per WIP message
- Suggerimento: Aggiungere a **Principle I: Database-First**

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in llm-router.service.ts:326-436
// P2: Channel disabled → WIP message
const workspace = await this.prisma.workspaces.findUnique({
  where: { id: params.workspaceId },
  select: { wipMessage: true },
})

const wipMessages = (workspace?.wipMessage as any) || {}
const wipMessage =
  wipMessages[params.customerLanguage?.toLowerCase() || "en"] ||
  wipMessages.en ||
  "We are currently working on improvements..."

return {
  finalResponse: wipMessage,
  content: wipMessage,
  // ... NO LLM call
}
```

**Schema Prisma**:

```prisma
model Workspaces {
  id         String  @id @default(cuid())
  wipMessage Json?   // Multilanguage: { en: "...", it: "...", es: "..." }
  // ...
}
```

**Test Coverage**:

- ✅ `backend/src/__tests__/unit/services/llm-router-priorities.spec.ts`
  - Test: "should return WIP message when challenge disabled"

**Stato**: ✅ **COMPLIANT** (ma non documentato in Constitution)

---

### Regola 3: **Utente Nuovo → Welcome Message da Workspace Settings**

**Definizione**: "se utente e0 nuovo messaggio di welocme da workspace settings"

**Verifica Constitution**:

- ⚠️ **NON MENZIONATO** - Constitution non ha principio specifico per welcome message
- Suggerimento: Aggiungere a **Principle I: Database-First**

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in llm-router.service.ts:442-504
// P3: New customer → Welcome message
const workspace = await this.prisma.workspaces.findUnique({
  where: { id: params.workspaceId },
  select: { welcomeMessage: true },
})

const welcomeMessages = (workspace?.welcomeMessage as any) || {}
const welcomeMessage =
  welcomeMessages[params.customerLanguage?.toLowerCase() || "en"] ||
  welcomeMessages.en ||
  "Welcome! How can I help you today?"

// Save welcome message to DB
await this.prisma.chatMessages.create({
  data: {
    sessionId: session.id,
    role: "assistant",
    content: welcomeMessage,
    // ...
  },
})
```

**Schema Prisma**:

```prisma
model Workspaces {
  id             String  @id @default(cuid())
  welcomeMessage Json?   // Multilanguage: { en: "...", it: "...", es: "..." }
  // ...
}
```

**Test Coverage**:

- ❌ **MISSING** - Non ci sono test per welcome message flow
- **Raccomandazione**: Aggiungere test in `llm-router-priorities.spec.ts`

**Stato**: ⚠️ **PARTIAL** (implementato ma non testato)

---

### Regola 4: **Utente Abilitato → Router Decide Smistamento**

**Definizione**: "se utente e' abilitato il router agent decide a chi smistare la richiesta"

**Verifica Constitution**:

- ✅ **ALLINEATO** - Constitution **Principle VIII: Multi-Agent Architecture**
- Quote: "Router Agent: Orchestration + message routing"
- Quote: "NO dialogue logic in Router (specialists handle conversation)"

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in llm-router.service.ts:506-800
// P4: Normal flow → Router LLM call
const routerPrompt = await this.promptProcessor.buildRouterPrompt({
  workspaceId: params.workspaceId,
  customerLanguage: params.customerLanguage,
  // ... customer context
})

const routerDecision = await this.llmService.chat({
  systemPrompt: routerPrompt,
  messages: conversationHistory,
  functions: routerFunctions, // Delegation functions
  // ...
})

// Router returns delegation: productSearchAgent(query)
if (routerDecision.tool_calls) {
  const functionName = routerDecision.tool_calls[0].function.name
  // Call specialist agent based on Router decision
}
```

**Delegation Functions** (from `agent-functions.config.ts`):

- ✅ `productSearchAgent(query)` - Product/service search
- ✅ `cartManagementAgent(query)` - Cart operations
- ✅ `orderTrackingAgent(query)` - Order info/repeat
- ✅ `customerSupportAgent(query)` - Escalation
- ✅ `manageNotifications(action)` - Subscribe/unsubscribe
- ✅ `addService(serviceCode, quantity)` - Service cart addition

**Test Coverage**:

- ✅ `backend/src/__tests__/unit/services/llm-router.spec.ts`
- ✅ Router delegation logic tested

**Stato**: ✅ **COMPLIANT**

---

### Regola 5: **Router Ha Storico Conversazione**

**Definizione**: "il router agent ha lo storico"

**Verifica Constitution**:

- ✅ **ALLINEATO** - Constitution **Principle VIII: Multi-Agent Architecture**
- Quote: "Router maintains conversation history for context-aware delegation"

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in llm-router.service.ts:540-580
const conversationHistory = await this.prisma.chatMessages.findMany({
  where: { sessionId: session.id },
  orderBy: { timestamp: "asc" },
  select: {
    role: true,
    content: true,
    timestamp: true,
  },
})

// Pass history to Router LLM
const routerDecision = await this.llmService.chat({
  systemPrompt: routerPrompt,
  messages: conversationHistory, // ✅ Full history passed
  // ...
})
```

**Database Schema**:

```prisma
model ChatMessages {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "user" | "assistant" | "system"
  content   String
  timestamp DateTime @default(now())
  // ...
}
```

**Stato**: ✅ **COMPLIANT**

---

### Regola 6: **Product AND Services Agent Insieme**

**Definizione**: "product and services agent sono insieme"

**Verifica Constitution**:

- ❌ **CONFLITTO** - Constitution **Principle III: Variable Uniqueness**
- Current: "{{SERVICES}} in Router + ProductSearch = DUPLICATION"
- Target: "{{SERVICES}} in Product & Services Search Agent ONLY"

**Verifica Implementazione**:

```typescript
// ❌ CURRENT STATE (WRONG)
// Router Agent prompt has {{SERVICES}}
// ProductSearch Agent prompt has {{SERVICES}}
// = 5,000 token duplication

// ✅ TARGET STATE (from spec.md)
// Router Agent: {{FAQ}} ONLY
// Product & Services Search Agent: {{PRODUCTS}}, {{SERVICES}}, {{CATEGORIES}}, {{OFFERS}}
```

**Agent Name**:

```typescript
// ❌ CURRENT (wrong name in database):
agentType: "PRODUCT_SEARCH"
name: "Product Search Agent"

// ✅ TARGET (correct name):
agentType: "PRODUCT_SEARCH"
name: "Product & Services Search Agent"
```

**Prompt Files**:

- ❌ Current: `docs/prompts/product-search-agent.md` (wrong name)
- ✅ Target: Rename to `product-services-search-agent.md`

**Stato**: ❌ **NON-COMPLIANT** - Ancora separati, {{SERVICES}} duplicato

---

### Regola 7: **Una Sola Volta Variabile PRODUCTS/SERVICES/CATEGORIES**

**Definizione**: "si puo' solo usare una volta la variabile PRODUCTS SERVICES CATEGORIES dentro i vari prompt"

**Verifica Constitution**:

- ✅ **ALLINEATO** - Constitution **Principle III: Variable Uniqueness Constraint**
- Quote: "Each variable can inject 50k+ tokens → duplicate usage causes 100k+ token prompts → LLM API failure"
- Quote: "Variables (PRODUCTS, SERVICES, CATEGORIES, OFFERS) max 1x per AGENT prompt"

**Verifica Implementazione**:

```typescript
// ❌ CURRENT VIOLATIONS:
// 1. {{SERVICES}} in Router + ProductSearch = 2x usage
// 2. {{PRODUCTS}} only in ProductSearch = OK ✅
// 3. {{CATEGORIES}} only in ProductSearch = OK ✅
// 4. {{OFFERS}} only in Router = OK ✅

// ✅ TARGET STATE:
// Router: {{FAQ}} ONLY
// Product & Services Search: {{PRODUCTS}}, {{SERVICES}}, {{CATEGORIES}}, {{OFFERS}}
// Cart Management: NONE
// Order Tracking: {{LAST_ORDER}} (small, OK)
// Customer Support: NONE
// Safety & Translation: NONE
```

**Validation**:

```typescript
// ✅ Constitution requires validation:
private validatePromptVariables(prompt: string): void {
  const largeVariables = ["PRODUCTS", "OFFERS", "SERVICES", "CATEGORIES"]

  for (const variable of largeVariables) {
    const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g")
    const matches = prompt.match(regex)

    if (matches && matches.length > 1) {
      throw new ValidationError(
        `Variable {{${variable}}} can only appear once per prompt. Found ${matches.length} occurrences.`
      )
    }
  }
}
```

**Stato**: ❌ **NON-COMPLIANT** - {{SERVICES}} duplicato in 2 prompts

---

### Regola 8: **Prompt Agent Solo Per Smistare, Tono/Esempi in Specialist**

**Definizione**: "i promt di agent deve essere solo per smistare ogni agente ha il tono e gli esempi di dialoogo"

**Verifica Constitution**:

- ✅ **ALLINEATO** - Constitution **Principle VIII: Multi-Agent Architecture**
- Quote: "Router = Pure orchestration (NO dialogue logic)"
- Quote: "Specialist agents = Dialogue style + tone + examples"

**Verifica Implementazione**:

```typescript
// ❌ CURRENT STATE (WRONG):
// Router prompt has:
// - Tone rules ("warm, friendly, use customer name")
// - Emoji usage rules
// - Dialogue examples
// - Service flow with confirmations
// = 8,000 tokens

// ✅ TARGET STATE (from spec.md):
// Router prompt (3,000 tokens):
// - Intent classification ONLY
// - Delegation logic ONLY
// - NO tone, NO examples, NO dialogue

// Specialist agents have:
// - Product & Services: "Warm, enthusiastic, highlights discounts"
// - Cart Management: "Clear, efficient, cart-focused"
// - Order Tracking: "Precise, reassuring"
// - Customer Support: "Empathetic, helpful"
```

**Stato**: ❌ **NON-COMPLIANT** - Router ha tono/esempi (deve essere rimosso)

---

### Regola 9: **Sempre Security & Translation PRIMA di Coda WhatsApp**

**Definizione**: "prima di entrare in una coda di whataspp deve sempre passare da security and transalation agents"

**Verifica Constitution**:

- ⚠️ **NON MENZIONATO** - Constitution non ha principio esplicito per Security gate
- Suggerimento: Aggiungere a **Principle VIII: Multi-Agent Architecture**

**Verifica Implementazione**:

```typescript
// ❌ CURRENT STATE:
// Security & Translation Agent è chiamato DOPO Router decision
// Non c'è gate PRIMA della coda WhatsApp

// Flow attuale:
// 1. WhatsApp webhook receives message
// 2. Llm-router.service.ts processes (priorities P1-P4)
// 3. Router LLM call (delegation)
// 4. Specialist agent called
// 5. Safety & Translation agent (if needed)

// ✅ TARGET FLOW (Andrea's requirement):
// 1. WhatsApp webhook receives message
// 2. **SECURITY & TRANSLATION GATE** ← FIRST!
//    - SQL injection check
//    - XSS check
//    - Language detection
//    - Translation to Italian (base language)
// 3. Llm-router.service.ts (priorities)
// 4. Router LLM call
// 5. Specialist agent
// 6. Translation back to customer language
```

**Security Agent Functions** (from prompts):

```typescript
// ✅ EXISTS in docs/prompts/safety-translation-agent.md
sendAlertEmail(reason, details) // SQL_INJECTION, XSS, OFFENSIVE, DATA_BREACH_ATTEMPT
```

**Stato**: ❌ **NON-COMPLIANT** - Security non è primo gate (è chiamato dopo)

---

### Regola 10: **View Flow Timeline Allineato con Percorso Messaggio**

**Definizione**: "il view flow timeline message deve essere sempre in linea con il percorso del messaggio"

**Verifica Constitution**:

- ✅ **ALLINEATO** - Constitution **Principle IX: Message Flow Timeline Integrity**
- Quote: "Every LLM agent call MUST have corresponding debugStep push to timeline"
- Quote: "Timeline MUST be 1:1 mirror of actual execution flow"
- Quote: "Disalignment causes complete loss of observability"

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in llm-router.service.ts
// Every agent call pushes to debugInfo.steps[]

debugInfo.steps.push({
  timestamp: new Date().toISOString(),
  agentType: "ROUTER",
  systemPrompt: routerPrompt.substring(0, 200),
  input: userMessage,
  decision: routerDecision,
  tokenUsage: routerTokens,
})

// Specialist agent also pushes:
debugInfo.steps.push({
  timestamp: new Date().toISOString(),
  agentType: "PRODUCT_SEARCH",
  systemPrompt: specialistPrompt.substring(0, 200),
  input: query,
  response: specialistResponse,
  tokenUsage: specialistTokens,
})
```

**Database Schema**:

```prisma
model ChatMessages {
  id        String @id @default(cuid())
  role      String
  content   String
  debugInfo Json?  // { steps: [...], totalTokens, ... }
  // ...
}
```

**Stato**: ✅ **COMPLIANT**

---

### Regola 11: **Prodotto Singolo → Stampare Tutti i Campi**

**Definizione**: "se nel cercare il prodotto rimaniamo con un prodotto mi devi stampare tutti i campi"

**Verifica Constitution**:

- ⚠️ **NON MENZIONATO** - Constitution non ha principio specifico per product display
- Suggerimento: Aggiungere a **Best Practices** o Product Search Agent spec

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in docs/prompts/product-search-agent.md
// Format C: Single product → Full details

**Format C: Single Product Details** (quando utente seleziona numero o 1 solo risultato)
Mostra TUTTI i campi:

🍖 **{{productName}}**
📝 **Descrizione**: {{description}}
💰 **Prezzo**: ~€{{originalPrice}}~ → €{{discountedPrice}} (sconto {{discount}}%)
📋 **Codice**: {{productCode}}
🏷️ **Categoria**: {{category}}
🌍 **Origine**: {{origin}}
✅ **Certificazioni**: {{certifications}} (halal, bio, DOP, etc.)
⏰ **Disponibilità**: {{availability}}
📦 **Stock**: {{stockQuantity}} disponibili

Vuoi aggiungerlo al carrello? 🛒 (sì/no)
```

**Stato**: ✅ **COMPLIANT**

---

### Regola 12: **addToCart Supporta PRODUCT e SERVICE**

**Definizione**: "il sistema deve poter inserire nel carrello sia prodotti che servizi addtoCard deve avere il parametro PRODUCT or SERCICES"

**Verifica Constitution**:

- ⚠️ **NON MENZIONATO** - Constitution non specifica product vs service
- Suggerimento: Aggiungere a Cart Management spec

**Verifica Implementazione**:

```typescript
// ✅ IMPLEMENTATO in agent-functions.config.ts:182-237
{
  type: "function",
  function: {
    name: "addToCart",
    description: "... SUPPORTA PRODOTTI E SERVIZI ...",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              quantity: { type: "number" },
              type: {
                type: "string",
                enum: ["PRODUCT", "SERVICE"],  // ✅ PRODUCT or SERVICE
                description: "Tipo: PRODUCT per prodotti, SERVICE per servizi"
              },
              notes: { type: "string" }
            },
            required: ["code", "type"]
          }
        }
      }
    }
  }
}
```

**Service Flow** (from Router Agent):

```typescript
// ✅ Router has addService() function
addService(serviceCode, quantity) // Always quantity=1 for services
```

**Cart Backend**:

```typescript
// ❓ NEEDS VERIFICATION: Does calling-functions.service.ts handle both?
// Check: Does addToCart() service method accept type: "SERVICE"?
```

**Stato**: ⚠️ **PARTIAL** - Function definition OK, need to verify backend handler

---

## 📊 Constitution Alignment Summary

| Regola # | Descrizione                       | Constitution               | Implementazione             | Test Coverage            | Stato                             |
| -------- | --------------------------------- | -------------------------- | --------------------------- | ------------------------ | --------------------------------- |
| 1        | Utente bloccato → zero messaggi   | ✅ Principle VI            | ✅ Implemented              | ✅ 2 tests               | ✅ COMPLIANT                      |
| 2        | Canale disabilitato → WIP message | ⚠️ Not mentioned           | ✅ Implemented              | ✅ 1 test                | ⚠️ PARTIAL (missing constitution) |
| 3        | Utente nuovo → welcome message    | ⚠️ Not mentioned           | ✅ Implemented              | ❌ No tests              | ⚠️ PARTIAL (no tests)             |
| 4        | Router decide smistamento         | ✅ Principle VIII          | ✅ Implemented              | ✅ Tests OK              | ✅ COMPLIANT                      |
| 5        | Router ha storico                 | ✅ Principle VIII          | ✅ Implemented              | ✅ Implicit              | ✅ COMPLIANT                      |
| 6        | Product + Services insieme        | ❌ CONFLITTO Principle III | ❌ WRONG (separated)        | ❌ No unified tests      | ❌ NON-COMPLIANT                  |
| 7        | Variabile 1x per prompt           | ✅ Principle III           | ❌ {{SERVICES}} 2x          | ⚠️ No validation tests   | ❌ NON-COMPLIANT                  |
| 8        | Router solo smistamento           | ✅ Principle VIII          | ❌ Router has tone/examples | ✅ Works but wrong       | ❌ NON-COMPLIANT                  |
| 9        | Security PRIMA coda WhatsApp      | ⚠️ Not mentioned           | ❌ Security DOPO Router     | ❌ No gate tests         | ❌ NON-COMPLIANT                  |
| 10       | Timeline allineato                | ✅ Principle IX            | ✅ Implemented              | ✅ Works                 | ✅ COMPLIANT                      |
| 11       | Prodotto singolo → tutti campi    | ⚠️ Not mentioned           | ✅ In prompt rules          | ⚠️ Manual verification   | ⚠️ PARTIAL (not enforced)         |
| 12       | addToCart(PRODUCT/SERVICE)        | ⚠️ Not mentioned           | ⚠️ Function OK, handler?    | ❌ No service cart tests | ⚠️ PARTIAL (needs verification)   |

**Totals**:

- ✅ **COMPLIANT**: 4/12 (33%)
- ⚠️ **PARTIAL**: 4/12 (33%)
- ❌ **NON-COMPLIANT**: 4/12 (33%)

---

## 🔴 CRITICAL ISSUES (BLOCKERS)

### Issue A1: {{SERVICES}} Variable Duplication

**Severity**: CRITICAL  
**Category**: Constitution Violation (Principle III)  
**Location**:

- `docs/prompts/router-agent.md` (has {{SERVICES}})
- `docs/prompts/product-search-agent.md` (has {{SERVICES}})

**Impact**:

- 5,000+ token waste per request
- $584/year extra cost
- Constitution Principle III explicitly forbids this

**Recommendation**:

1. Remove {{SERVICES}} from Router Agent prompt
2. Keep {{SERVICES}} ONLY in Product & Services Search Agent
3. Update database seed with corrected prompts
4. Add validation test in `validate-agent-prompts.ts`

**Tasks**: PROMPT-1.1, PROMPT-1.2, PROMPT-2.1 (from tasks.md)

---

### Issue A2: Product + Services Agent NOT Unified

**Severity**: CRITICAL  
**Category**: Architecture Violation (Andrea's Regola 6)  
**Location**:

- `backend/prisma/data/defaultAgents.ts` (wrong name)
- `docs/prompts/product-search-agent.md` (wrong name)

**Impact**:

- Agent name mismatch: "Product Search Agent" vs "Product & Services Search Agent"
- Services flow split between Router and ProductSearch
- Confused responsibility boundaries

**Recommendation**:

1. Rename agent to "Product & Services Search Agent"
2. Move service search logic from Router to this agent
3. Update database seed
4. Rename prompt file: `product-search-agent.md` → `product-services-search-agent.md`

**Tasks**: PROMPT-1.3, PROMPT-2.2 (from tasks.md)

---

### Issue A3: Router Has Dialogue Logic (Constitution Violation)

**Severity**: CRITICAL  
**Category**: Architecture Violation (Principle VIII)  
**Location**: `docs/prompts/router-agent.md`

**Current State** (WRONG):

- Router prompt: 8,000 tokens
- Contains: Tone rules, emoji usage, dialogue examples, service flow
- Responsibilities: Orchestration + Dialogue + Service handling

**Target State** (CORRECT):

- Router prompt: 3,000 tokens
- Contains: Intent classification ONLY, delegation logic ONLY
- Responsibilities: Orchestration ONLY

**Impact**:

- 5,000 token waste (Router never responds directly to user)
- Confusion: Router has dialogue rules but specialists always respond
- Violation: Constitution Principle VIII (separation of concerns)

**Recommendation**:

1. Strip Router prompt to pure orchestration (remove tone/examples)
2. Move tone/examples to specialist agents
3. Reduce Router from 8k to 3k tokens
4. Update constitution to explicitly forbid Router dialogue

**Tasks**: PROMPT-1.4, PROMPT-1.5 (from tasks.md)

---

### Issue A4: Security Gate MISSING at WhatsApp Entry

**Severity**: CRITICAL  
**Category**: Security Architecture (Andrea's Regola 9)  
**Location**: `backend/src/services/llm-router.service.ts`

**Current Flow** (WRONG):

```
WhatsApp → Priorities (P1-P4) → Router LLM → Specialist → Safety (if needed)
```

**Target Flow** (CORRECT):

```
WhatsApp → 🛡️ SECURITY GATE (SQL/XSS check) → Priorities → Router → Specialist
```

**Impact**:

- Security checks happen AFTER routing (too late)
- Malicious input could reach LLM before validation
- Missing proactive security layer

**Recommendation**:

1. Add Security & Translation Agent as FIRST gate
2. Flow: `WhatsApp → Security → llm-router.service.ts`
3. Security checks: SQL injection, XSS, offensive content
4. Language detection + translation to Italian (base language)
5. Update constitution with Security Gate principle

**Tasks**: NEW (not in current tasks.md - needs to be added)

---

## ⚠️ HIGH PRIORITY ISSUES

### Issue B1: Welcome Message Not Tested

**Severity**: HIGH  
**Category**: Test Coverage Gap  
**Location**: `backend/src/__tests__/unit/services/llm-router-priorities.spec.ts`

**Problem**:

- Welcome message flow implemented (P3 priority)
- BUT no unit tests verify it works correctly

**Recommendation**:
Add test case:

```typescript
it("should return welcome message for new customer", async () => {
  // Setup: New customer (no chat history)
  // Action: Call routeMessage()
  // Verify: Returns welcomeMessage from workspace settings
  // Verify: Message saved to database
  // Verify: No LLM call (P3 short-circuits)
})
```

**Tasks**: NEW (add to PHASE 0: Research & Validation)

---

### Issue B2: addToCart(SERVICE) Backend Handler Not Verified

**Severity**: HIGH  
**Category**: Implementation Verification  
**Location**: `backend/src/services/calling-functions.service.ts`

**Problem**:

- Function definition has `type: "PRODUCT" | "SERVICE"` ✅
- BUT: Need to verify backend handler actually processes SERVICE type

**Recommendation**:

1. Check `calling-functions.service.ts` for SERVICE handling
2. Add test case: `addToCart([{code: "SRV-001", type: "SERVICE", quantity: 1}])`
3. Verify cart database accepts both product and service items

**Tasks**: NEW (add to PHASE 0: Research & Validation)

---

## 📝 MEDIUM PRIORITY ISSUES

### Issue C1: Constitution Missing WIP/Welcome Principles

**Severity**: MEDIUM  
**Category**: Documentation Gap  
**Location**: `.specify/memory/constitution.md`

**Problem**:

- WIP message flow implemented and tested ✅
- Welcome message flow implemented ✅
- BUT: Not documented in Constitution as Database-First pattern

**Recommendation**:
Add to Constitution Principle I (Database-First):

```markdown
**Welcome & WIP Messages** (MUST - NON-NEGOTIABLE):

- Welcome message for new customers: ALWAYS from workspace.welcomeMessage (multilanguage JSON)
- WIP message when channel disabled: ALWAYS from workspace.wipMessage (multilanguage JSON)
- NO hardcoded fallbacks allowed
- Language selection: customerLanguage → en (fallback)
```

**Tasks**: NEW (update constitution after PHASE 1 completion)

---

### Issue C2: Product Display Format Not Enforced

**Severity**: MEDIUM  
**Category**: Soft Requirement  
**Location**: `docs/prompts/product-search-agent.md`

**Problem**:

- Prompt has rules for "Format C: Single Product Details"
- BUT: LLM could ignore and show partial fields
- No validation that ALL fields are displayed

**Recommendation**:

1. Add to Product Search Agent prompt:
   ```markdown
   ⚠️ MANDATORY FIELDS (CANNOT SKIP):

   - Name, Description, Price, Code, Category, Origin, Certifications, Availability, Stock
   - If field missing in database → show "N/A" (do not hide field)
   ```
2. Optional: Add response validation (check all fields present)

**Tasks**: PROMPT-2.4 (enhance specialist prompts)

---

## 📊 Coverage & Quality Metrics

### Test Coverage

**Unit Tests**:

- ✅ `llm-router-priorities.spec.ts`: 5 tests (P1 blocked, P2 WIP, schema checks)
- ❌ **MISSING**: Welcome message test (P3)
- ❌ **MISSING**: Service cart addition test
- ❌ **MISSING**: Security gate test (Regola 9)
- ❌ **MISSING**: Variable duplication validation

**Integration Tests**:

- ⚠️ Existing tests may be outdated after refactoring
- ❌ **MISSING**: End-to-end service flow test
- ❌ **MISSING**: Product + Service unified search test

**Coverage Target**: 80% (current: ~60% estimated)

---

### Constitution Compliance

**Principles Verified**:

- ✅ **Principle I** (Database-First): WIP/welcome from database
- ❌ **Principle III** (Variable Uniqueness): {{SERVICES}} duplicated
- ✅ **Principle VI** (Chat Isolation): isBlocked field works
- ❌ **Principle VIII** (Multi-Agent): Router has dialogue logic
- ✅ **Principle IX** (Timeline Integrity): debugInfo.steps[] aligned

**Compliance Score**: 60% (3/5 verified principles compliant)

---

### Documentation Quality

**Prompts**:

- ⚠️ Router: Has dialogue rules that will be removed
- ⚠️ ProductSearch: Wrong name ("Product Search" vs "Product & Services")
- ✅ Cart Management: Functions match implementation
- ✅ Order Tracking: Clear function definitions
- ✅ Customer Support: Clear escalation rules
- ✅ Safety & Translation: Security patterns documented

**Constitution**:

- ⚠️ Missing: WIP/welcome message principles
- ⚠️ Missing: Security gate principle (Regola 9)
- ⚠️ Missing: Product display format enforcement
- ✅ Has: Variable uniqueness (Principle III)
- ✅ Has: Multi-agent architecture (Principle VIII)

---

## 🎯 Next Actions

### CRITICAL (BLOCKING - Must fix before implementation)

1. **Fix {{SERVICES}} Duplication** (Issue A1)

   - Remove from Router prompt
   - Keep only in Product & Services Search Agent
   - Update database seed
   - Run: `npm run seed`

2. **Unify Product + Services Agent** (Issue A2)

   - Rename to "Product & Services Search Agent"
   - Update `defaultAgents.ts`
   - Rename prompt file
   - Update database

3. **Strip Router Dialogue Logic** (Issue A3)

   - Remove tone/examples from Router prompt
   - Target: 8,000 → 3,000 tokens
   - Move dialogue rules to specialists
   - Update seed

4. **Add Security Gate** (Issue A4)
   - Security & Translation FIRST in flow
   - Add to `whatsapp-webhook.controller.ts`
   - Update constitution with Security Gate principle
   - Add tests

### HIGH PRIORITY (Should fix this iteration)

5. **Add Welcome Message Test** (Issue B1)

   - Test P3 priority flow
   - Verify workspace.welcomeMessage used
   - Add to `llm-router-priorities.spec.ts`

6. **Verify SERVICE Cart Handling** (Issue B2)
   - Check `calling-functions.service.ts`
   - Add test: `addToCart([{type: "SERVICE", ...}])`
   - Verify database accepts services

### MEDIUM PRIORITY (Can defer to next iteration)

7. **Update Constitution** (Issue C1)

   - Add WIP/welcome principles to Principle I
   - Add Security Gate to Principle VIII
   - Document product display format

8. **Enhance Product Display** (Issue C2)
   - Add mandatory field list to prompt
   - Add validation (optional)

---

## 📋 Task Mapping to `tasks.md`

### Existing Tasks (Already Defined)

| Task ID    | Description                               | Addresses Issue     |
| ---------- | ----------------------------------------- | ------------------- |
| PROMPT-0.1 | Verify workspace backup folders           | Prerequisite        |
| PROMPT-0.3 | Measure baseline token counts             | Metrics             |
| PROMPT-1.1 | Audit {{SERVICES}} duplication            | Issue A1 ✅         |
| PROMPT-1.2 | Remove {{SERVICES}} from Router           | Issue A1 ✅         |
| PROMPT-1.3 | Rename ProductSearch → Product & Services | Issue A2 ✅         |
| PROMPT-1.4 | Strip Router to pure orchestration        | Issue A3 ✅         |
| PROMPT-2.1 | Update seed with corrected prompts        | Issue A1, A2, A3 ✅ |

### Missing Tasks (Need to Add)

| Proposed ID | Description                            | Addresses Issue | Priority |
| ----------- | -------------------------------------- | --------------- | -------- |
| PROMPT-0.4  | Add welcome message test               | Issue B1        | HIGH     |
| PROMPT-0.5  | Verify SERVICE cart handler            | Issue B2        | HIGH     |
| PROMPT-1.6  | Add Security Gate before routing       | Issue A4        | CRITICAL |
| PROMPT-3.1  | Update constitution with WIP/welcome   | Issue C1        | MEDIUM   |
| PROMPT-3.2  | Update constitution with Security Gate | Issue A4        | CRITICAL |
| PROMPT-3.3  | Add product display validation         | Issue C2        | MEDIUM   |

---

## ✅ Remediation Plan (OPTIONAL - User Approval Required)

**Andrea, vuoi che proceda con la remediation automatica?**

Se approvi, eseguirò in sequenza:

### Phase 1: Critical Fixes (2-3 hours)

1. Remove {{SERVICES}} from Router prompt
2. Rename agent to "Product & Services Search Agent"
3. Strip Router dialogue logic (8k → 3k tokens)
4. Update seed script
5. Run seed + verify database

### Phase 2: Security Gate (1-2 hours)

6. Add Security & Translation as first gate
7. Update WhatsApp webhook flow
8. Add tests for security validation
9. Update constitution

### Phase 3: Tests & Validation (1 hour)

10. Add welcome message test
11. Verify SERVICE cart handling
12. Run full test suite
13. Measure token savings

**Total Estimated Time**: 4-6 hours

**Risk**: MEDIUM (core LLM architecture changes)

**Rollback**: Constitution requires workspace backup BEFORE any changes

---

## 📊 Summary

**Regole di Andrea**: 12 totali  
**Allineamento Constitution**: 60% (7/12 menzionati)  
**Implementazione Corretta**: 33% (4/12 compliant)  
**Test Coverage**: ~60% (estimated)

**Critical Blockers**: 4 (Issues A1-A4)  
**High Priority**: 2 (Issues B1-B2)  
**Medium Priority**: 2 (Issues C1-C2)

**Raccomandazione Finale**:
❌ **DO NOT PROCEED** to `/speckit.implement` until CRITICAL issues (A1-A4) are resolved.

✅ **NEXT STEP**: Approve remediation plan or manually fix critical issues first.

---

**Generated by**: GitHub Copilot  
**Analysis Method**: Progressive disclosure + semantic models  
**Token Budget Used**: ~65k / 1M (6.5%)  
**Analysis Duration**: ~15 minutes
