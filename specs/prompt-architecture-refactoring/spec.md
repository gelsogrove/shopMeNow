# Prompt Architecture Refactoring - Specification

**Version**: 1.0.0  
**Created**: 2025-11-15  
**Status**: Draft  
**Priority**: HIGH (Architecture + Token Optimization)

---

## 📋 Overview

### Problem Statement

Current LLM prompt architecture violates separation of concerns: Router Agent contains dialogue logic and formatting rules that belong in specialist agents. Large variables ({{PRODUCTS}}, {{SERVICES}}, {{CATEGORIES}}) are duplicated across prompts causing 11,000+ token waste per request ($584/year).

### Goals

1. **Separate Orchestration from Dialogue**: Router only decides delegation, specialists handle conversation
2. **Eliminate Variable Duplication**: Each large variable appears ONCE (Constitution Principle III)
3. **Consolidate Product + Service Logic**: Merge into single ProductSearchAgent
4. **Reduce Token Waste**: Target 11,000 tokens/request reduction (15% savings)
5. **Improve Maintainability**: Single source of truth per domain

### Success Criteria

- ✅ Router prompt ≤ 3,500 tokens (from 8,000)
- ✅ Zero variable duplication ({{SERVICES}} in ONE prompt only)
- ✅ ProductSearchAgent handles products + services (unified flow)
- ✅ Confirmation logic in MAX 2 places (specialist + fallback)
- ✅ All user flows work identically (transparent refactoring)
- ✅ Constitution compliance (Principles I, III, V, VIII)

---

## 🏗️ Architecture

### Current State (WRONG)

```
ROUTER AGENT (8,000 tokens):
├─ Variables: {{OFFERS}}, {{SERVICES}}, {{FAQ}}  ❌ Services duplicated
├─ Logic: Orchestration + Dialogue + Service Flow  ❌ Too many responsibilities
├─ Tone: Warm, emojis, customer name rules  ❌ Never used (specialists respond)
└─ Examples: 100+ lines  ❌ Excessive

PRODUCT SEARCH AGENT (55,000 tokens):
├─ Variables: {{PRODUCTS}}, {{CATEGORIES}}, {{SERVICES}}  ❌ Services duplicated
├─ Logic: Product discovery + grouping
├─ Tone: Warm, enthusiastic
└─ Handles: Products only (not services)  ❌ Incomplete

CART MANAGEMENT (3,000 tokens):
├─ Logic: Cart operations + confirmation handling  ⚠️ Scattered
└─ Tone: Clear, efficient

ORDER TRACKING (4,000 tokens):
├─ Variables: {{LAST_ORDER}}
├─ Logic: Order info + repeat order flow
└─ Tone: Precise, reassuring

CUSTOMER SUPPORT (2,000 tokens):
├─ Logic: Escalation handling
└─ Tone: Empathetic, helpful

SAFETY & TRANSLATION (1,500 tokens):
├─ Logic: Validation + Language translation
└─ No tone (just technical processing)
```

**PROBLEMS**:

- {{SERVICES}} in 2 prompts (Router + ProductSearch) = 5,000 token duplication
- Router has dialogue rules never used
- Service flow split between Router and ProductSearch
- Confirmation logic in 3 places (Router, ProductSearch, Cart)

---

### Target State (CORRECT)

```
ROUTER AGENT (3,000 tokens):  ✅ Pure orchestration
├─ Variables: {{FAQ}} ONLY
├─ Logic: Intent classification + delegation ONLY
├─ Tone: NONE (just passes through)
└─ Examples: 5-10 critical edge cases

PRODUCT & SERVICE SEARCH AGENT (60,000 tokens):  ✅ Unified discovery
├─ Variables: {{PRODUCTS}}, {{CATEGORIES}}, {{SERVICES}}, {{OFFERS}}
├─ Logic: Product + Service discovery, grouping, filtering, details
├─ Tone: Warm, enthusiastic, uses customer name, highlights discounts
├─ Handles: Products AND Services (unified numbered list flow)
└─ Confirmation: "Vuoi aggiungerlo?" → delegates to Cart with code

CART MANAGEMENT (3,500 tokens):  ✅ Cart operations
├─ Variables: NONE
├─ Logic: Add/remove/clear/view + stock validation
├─ Tone: Clear, efficient, cart-focused
├─ Receives: Product/service codes from ProductSearch (NOT raw user input)
└─ Returns: Cart links, confirmations

ORDER TRACKING (4,500 tokens):  ✅ Order info
├─ Variables: {{LAST_ORDER}}
├─ Logic: Order details, repeat order flow, invoices
├─ Tone: Precise, reassuring, professional
└─ Confirmation: Repeat order asks "Vuoi ripetere?" → calls RepeatOrder()

CUSTOMER SUPPORT (2,500 tokens):  ✅ Escalation
├─ Variables: NONE
├─ Logic: Frustration detection, urgency levels, ticket creation
└─ Tone: Empathetic, solution-oriented

SAFETY & TRANSLATION (1,500 tokens):  ✅ Security + i18n
├─ Variables: NONE
├─ Logic: Bad words filter, validate responses, translate to customer language
└─ Tone: Technical processing (no conversational rules)
```

**IMPROVEMENTS**:

- {{SERVICES}} in ONE prompt (ProductSearch) ✅
- Router = 3k tokens (from 8k) ✅
- Product + Service unified flow ✅
- Confirmation logic in 2 places (ProductSearch, OrderTracking) ✅
- Clear ownership per domain ✅

---

## 📐 Functional Requirements

### FR-1: Router Agent - Pure Orchestration

**Description**: Router Agent decides which specialist handles request. NO dialogue logic, NO formatting, NO large variables.

**Requirements**:

1. ✅ **Intent Classification**: Analyze user message → determine specialist
2. ✅ **FAQ Direct Answer**: If question in {{FAQ}} → answer directly (no delegation)
3. ✅ **Delegation Functions**: Call correct specialist agent function
4. ✅ **Pass-Through Responses**: Return specialist response UNCHANGED (no rephrasing)
5. ❌ **NO Tone Rules**: Remove emojis, customer name, discount mentions
6. ❌ **NO Domain Logic**: Remove service flow, confirmation handling
7. ❌ **NO Large Variables**: Only {{FAQ}} (remove {{SERVICES}}, {{OFFERS}})

**Acceptance Criteria**:

- [ ] Router prompt ≤ 3,500 tokens
- [ ] Zero mentions of "tone", "style", "emoji", "warm", "professional"
- [ ] Only {{FAQ}} variable present (no {{SERVICES}}, {{OFFERS}})
- [ ] Service-related keywords ("che servizi avete?") → delegate to ProductSearchAgent
- [ ] User flow: "che servizi avete?" works identically (transparent to user)

**Edge Cases**:

- User asks FAQ question → Router answers directly (no delegation)
- User says "sì" after specialist response → Router delegates "sì" to same specialist
- Ambiguous intent → Router asks clarification (still no tone rules, just question)

---

### FR-2: Product & Service Search Agent - Unified Discovery

**Description**: Single agent handles both products AND services with unified numbered list flow.

**Requirements**:

1. ✅ **All Variables**: {{PRODUCTS}}, {{CATEGORIES}}, {{SERVICES}}, {{OFFERS}}
2. ✅ **Unified Search**: "cerca pasta" and "che servizi avete?" use same flow
3. ✅ **Numbered Lists**: Always show 1., 2., 3. for products AND services
4. ✅ **Service Details**: Same 8-field format as products (name, description, price, code, etc.)
5. ✅ **Grouping Logic**: Group products OR services when >8 results
6. ✅ **Confirmation Flow**: "Vuoi aggiungerlo?" → extract code → delegate to Cart
7. ✅ **Tone Rules**: Warm, enthusiastic, customer name 40%, discount highlighting

**Acceptance Criteria**:

- [ ] ProductSearchAgent has {{SERVICES}} variable (removed from Router)
- [ ] "che servizi avete?" → shows numbered service list
- [ ] Service selection "2" → shows 8-field details (like products)
- [ ] Service confirmation "sì" → delegates "add SRV-001" to CartAgent
- [ ] Products and services use identical flow (grouping → list → details → cart)
- [ ] Tone: Uses {{nameUser}} in 40% of messages, mentions {{discountUser}}%

**Edge Cases**:

- Search "gift" → may return products (gift boxes) + services (gift wrapping)
- User says "2" → context determines if product or service details
- Service has quantity restrictions → Cart validates (not ProductSearch)

---

### FR-3: Cart Management - Confirmed Additions Only

**Description**: Cart Agent receives CONFIRMED product/service codes from ProductSearch. No raw user input.

**Requirements**:

1. ✅ **Receives**: Product/service codes from ProductSearch (e.g., "add PROD-123 qty 2")
2. ✅ **Validates**: Stock availability, quantity limits
3. ✅ **Returns**: Cart confirmation + checkout link
4. ✅ **ClearCart**: Immediate execution (NO confirmation ask)
5. ❌ **NO Product Search**: If user says "aggiungi burrata" → delegate to ProductSearch first

**Acceptance Criteria**:

- [ ] CartAgent does NOT call ProductSearch functions
- [ ] "cancella carrello" → immediately calls clearCart() (no "sei sicuro?")
- [ ] Receives format: "add PROD-123 qty 2" or "add SRV-001 qty 1"
- [ ] Returns: Cart link [LINK_CHECKOUT_WITH_TOKEN] after successful add

**Edge Cases**:

- User says "aggiungi pasta" → CartAgent cannot handle → delegates to ProductSearch
- Stock insufficient → CartAgent returns error (ProductSearch re-triggered)

---

### FR-4: Order Tracking - Repeat Order Flow

**Description**: Order Agent handles order history, tracking, repeat orders with confirmation.

**Requirements**:

1. ✅ **Last Order Variable**: {{LAST_ORDER}} with summary
2. ✅ **Repeat Order Flow**: Show summary → ask confirmation → call RepeatOrder()
3. ✅ **Confirmation Handling**: "Vuoi ripetere?" → wait for "SI" → execute
4. ✅ **Tone**: Precise, reassuring, professional

**Acceptance Criteria**:

- [ ] "ripeti ultimo ordine" → shows {{LAST_ORDER}} summary
- [ ] Asks: "Vuoi ripetere l'operazione?"
- [ ] Waits for "SI" before calling RepeatOrder()
- [ ] Returns: Checkout link with ?step=2 parameter

**Edge Cases**:

- No previous orders → "Non hai ancora effettuato ordini"
- User says "NO" to confirmation → "Va bene, fammi sapere se cambi idea"

---

### FR-5: Variable Distribution - Single Source of Truth

**Description**: Each large variable (>1k tokens) appears in EXACTLY ONE prompt.

**Requirements**:

| Variable       | Agent              | Tokens | Purpose            |
| -------------- | ------------------ | ------ | ------------------ |
| {{PRODUCTS}}   | ProductSearchAgent | ~45k   | Product catalog    |
| {{CATEGORIES}} | ProductSearchAgent | ~3k    | Category list      |
| {{SERVICES}}   | ProductSearchAgent | ~5k    | Service catalog    |
| {{OFFERS}}     | ProductSearchAgent | ~2k    | Active promotions  |
| {{FAQ}}        | Router             | ~2k    | Direct FAQ answers |
| {{LAST_ORDER}} | OrderTrackingAgent | ~1k    | Order summary      |

**Acceptance Criteria**:

- [ ] {{SERVICES}} removed from Router
- [ ] {{OFFERS}} moved to ProductSearchAgent (or removed if not needed in Router)
- [ ] Grep search for `{{SERVICES}}` returns 1 match (ProductSearchAgent only)
- [ ] Grep search for `{{PRODUCTS}}` returns 1 match (ProductSearchAgent only)

**Edge Cases**:

- Small variables (<500 tokens) like {{nameUser}}, {{discountUser}} → can appear in multiple prompts (personalization)

---

## 📜 Constitution for Prompts (Non-Negotiable Rules)

### PRINCIPLE I: Separation of Responsibilities (MUST)

**Rule**: Each agent has ONE primary responsibility. No overlap, no duplication.

**Agent Domains**:

- **Router**: Intent classification + delegation (3k tokens max)
- **ProductSearch**: Product + Service discovery (60k tokens max)
- **Cart**: Cart operations (3.5k tokens max)
- **OrderTracking**: Order info + repeat flow (4.5k tokens max)
- **Support**: Escalation handling (2.5k tokens max)
- **Safety**: Validation + translation (1.5k tokens max)

**Violations**:

- ❌ Router having service selection flow (belongs to ProductSearch)
- ❌ Cart searching products (belongs to ProductSearch)
- ❌ ProductSearch showing cart (belongs to Cart)

**Enforcement**:

- Pre-commit hook: Check prompt file sizes (Router > 4k tokens = reject)
- Code review: Verify agent domain boundaries
- Manual audit: Monthly check for creeping responsibilities

---

### PRINCIPLE II: Variable Uniqueness (MUST - Constitution Principle III)

**Rule**: Large variables (>1k tokens) appear in EXACTLY ONE prompt.

**Rationale**: Prevents token explosion. {{PRODUCTS}} = 45k tokens. Duplicate = 90k tokens = API failure.

**Large Variables** (MUST appear once):

- {{PRODUCTS}} → ProductSearchAgent ONLY
- {{CATEGORIES}} → ProductSearchAgent ONLY
- {{SERVICES}} → ProductSearchAgent ONLY
- {{OFFERS}} → ProductSearchAgent ONLY
- {{LAST_ORDER}} → OrderTrackingAgent ONLY

**Small Variables** (CAN appear multiple times):

- {{nameUser}}, {{discountUser}}, {{languageUser}} → Personalization (all agents)
- {{workspaceName}}, {{agentName}} → Context (all agents)

**Violations**:

- ❌ {{SERVICES}} in Router + ProductSearch (current state)
- ❌ {{PRODUCTS}} in multiple agents

**Enforcement**:

- Validation script: `npm run validate-prompts` checks variable distribution
- Pre-commit hook: Reject if grep finds duplicate large variables
- CI/CD: Automated check on PR (fail if violations)

---

### PRINCIPLE III: Router is NOT a Conversationalist (MUST)

**Rule**: Router has ZERO dialogue/formatting rules. It only orchestrates.

**Router CANNOT have**:

- ❌ Tone & style instructions ("warm", "professional", "emojis")
- ❌ Customer name usage rules ("use name in 40% of messages")
- ❌ Discount mention rules ("highlight discount when relevant")
- ❌ Formatting rules ("bold for important", "numbered lists")

**Router CAN have**:

- ✅ Intent classification keywords
- ✅ Delegation function definitions
- ✅ FAQ direct answer logic (simple lookup)
- ✅ 5-10 critical examples (edge cases)

**Rationale**: Router never writes final responses. Specialists do. Tone rules in Router = wasted tokens.

**Enforcement**:

- ESLint-style rule: Scan Router prompt for forbidden keywords
- Forbidden words: "tone", "style", "emoji", "warm", "friendly", "professional", "bold"
- CI/CD: Fail PR if Router contains conversational rules

---

### PRINCIPLE IV: Specialists Own the Dialogue (MUST)

**Rule**: Each specialist defines its own tone, style, formatting for its domain.

**Specialist Tone Ownership**:

- **ProductSearchAgent**: Warm, enthusiastic, product-passionate 🛍️
- **CartAgent**: Clear, efficient, cart-focused 🛒
- **OrderTrackingAgent**: Precise, reassuring, professional 📦
- **SupportAgent**: Empathetic, solution-oriented 🤝
- **Safety**: NO tone (technical processing only)

**Requirements**:

- ✅ Each specialist has "## 🎨 TONE & STYLE" section
- ✅ Tone matches domain (Cart ≠ ProductSearch tone)
- ✅ Customer name usage rules in specialist (not Router)

**Violations**:

- ❌ Generic tone in Router applied to all specialists
- ❌ Missing tone section in specialist agent

**Enforcement**:

- Template check: Spec requires "## 🎨 TONE & STYLE" in each specialist
- Code review: Verify tone matches domain
- User testing: Specialist responses feel appropriate per domain

---

### PRINCIPLE V: Confirmation Logic Belongs to Domain Owner (MUST)

**Rule**: Agent that shows details owns confirmation flow. Don't scatter across agents.

**Ownership Map**:

- **ProductSearchAgent**: Product/service confirmations ("Vuoi aggiungerlo?")
- **OrderTrackingAgent**: Repeat order confirmations ("Vuoi ripetere?")
- **Router**: NO confirmations (just passes "sì" to same specialist)

**Flow**:

```
ProductSearch shows product details → asks "Vuoi aggiungerlo?"
User says "sì"
ProductSearch extracts sku → calls CartAgent("add PROD-123")
Router just passes through responses
```

**Violations**:

- ❌ Router handling "sì" confirmations (doesn't have product context)
- ❌ Cart asking "sei sicuro?" for product additions (ProductSearch already asked)

**Enforcement**:

- Confirmation keyword search: "sì", "yes", "conferma" → should be in specialist, not Router
- Code review: Verify confirmation flow stays within domain
- Integration test: Confirm no double-asking ("Vuoi?" → "Sei sicuro?")

---

### PRINCIPLE VI: Service = Product (MUST)

**Rule**: Services are products with type="service". Same discovery flow, same agent.

**Unified Flow**:

```
User: "che servizi avete?"
ProductSearchAgent:
  1. Filters {{SERVICES}} (same as filtering {{PRODUCTS}})
  2. Shows numbered list (same format)
  3. User selects number → shows details (8 fields)
  4. Asks "Vuoi aggiungerlo?" (same as products)
  5. Delegates to Cart (same as products)
```

**Implementation**:

- ✅ {{SERVICES}} in ProductSearchAgent
- ✅ Service search uses same grouping logic as products
- ✅ Service details use same 8-field format
- ✅ Service cart addition uses same delegation

**Violations**:

- ❌ Separate ServiceAgent (unnecessary complexity)
- ❌ Different flow for services vs products
- ❌ Router handling service logic directly

**Enforcement**:

- Code review: Services use ProductSearchAgent (not Router, not new agent)
- User testing: "cerco pasta" and "cerco servizio" feel identical
- Token check: Services don't add separate agent overhead

---

### PRINCIPLE VII: Examples are Documentation, Not Runtime (SHOULD)

**Rule**: Keep 5-10 critical examples in prompt. Move rest to docs.

**Critical Examples** (keep in prompt):

- Edge cases LLM might miss
- Ambiguous intents needing clarification
- Multi-step flows (numbered selection → details → cart)

**Non-Critical Examples** (move to docs):

- Obvious mappings ("show cart" → cartManagementAgent)
- Redundant scenarios (10 variations of "aggiungi prodotto")
- AI developer training material

**Rationale**: LLM learns from structure, not 100 examples. Examples = token waste.

**Enforcement**:

- Token budget: Examples section ≤ 1,000 tokens
- Code review: Justify each example (why is this critical?)
- Docs: Move removed examples to `docs/architecture/agent-examples.md`

---

## 🎯 Non-Functional Requirements

### NFR-1: Token Efficiency

**Requirement**: Reduce total prompt tokens by ≥10,000 per request.

**Measurements**:

- Current: 73,500 tokens/request (input)
- Target: ≤63,500 tokens/request (input)
- Savings: ≥13.6% reduction

**Breakdown**:

- Router cleanup: -5,000 tokens
- Remove duplicate {{SERVICES}}: -5,000 tokens
- Reduce examples: -2,000 tokens
- **Total**: -12,000 tokens ✅

**Acceptance Criteria**:

- [ ] Token counter script shows ≤63,500 tokens
- [ ] OpenRouter API logs confirm reduced input tokens
- [ ] Cost analysis shows $500+/year savings

---

### NFR-2: Transparency (No User Impact)

**Requirement**: Refactoring is invisible to end users. All flows work identically.

**User Scenarios to Validate**:

1. "avete prodotti halal?" → Shows filtered products (same as before)
2. "che servizi avete?" → Shows numbered service list (same as before)
3. Select "2" → Shows product/service details (same as before)
4. "sì" confirmation → Adds to cart (same as before)
5. "cancella carrello" → Clears immediately (same as before)
6. "ripeti ultimo ordine" → Shows summary, asks confirm (same as before)

**Acceptance Criteria**:

- [ ] Manual WhatsApp testing: All 6 scenarios work identically
- [ ] User sees NO difference in responses
- [ ] Response times unchanged or faster
- [ ] No new error cases introduced

---

### NFR-3: Maintainability

**Requirement**: Single source of truth per domain. Update ONE place, not 3.

**Measurements**:

- Confirmation logic: 2 places (from 3) ✅
- {{SERVICES}} variable: 1 place (from 2) ✅
- Service flow: 1 place (from split Router+ProductSearch) ✅

**Acceptance Criteria**:

- [ ] Grep "{{SERVICES}}" → 1 result
- [ ] Grep "Vuoi aggiungerlo?" → ProductSearchAgent only
- [ ] Service flow documented in ONE file

---

### NFR-4: Constitution Compliance

**Requirement**: Zero violations of Constitution Principles I, III, V, VIII.

**Checklist**:

- [ ] Principle I (Database-First): ✅ All variables from DB
- [ ] Principle III (Variable Uniqueness): ✅ No duplicate large variables
- [ ] Principle V (360-Degree): ✅ Complete architecture (Router → Specialist → Safety)
- [ ] Principle VIII (Multi-Agent): ✅ Clean separation, specialists output English

**Acceptance Criteria**:

- [ ] Constitution compliance audit passes
- [ ] No CRITICAL findings in /speckit.analyze

---

## ✅ Acceptance Criteria (Global)

### Must Have (P0)

- [ ] Router prompt ≤ 3,500 tokens (from 8,000)
- [ ] {{SERVICES}} in ProductSearchAgent ONLY (removed from Router)
- [ ] ProductSearchAgent handles products + services (unified flow)
- [ ] "che servizi avete?" works identically to users
- [ ] Zero variable duplication (Constitution Principle III compliant)
- [ ] All 6 user scenarios work identically (NFR-2)

### Should Have (P1)

- [ ] Examples section ≤ 1,000 tokens per agent
- [ ] Tone & style in specialists, NOT Router
- [ ] Confirmation logic in ≤ 2 places
- [ ] Token savings ≥ 10,000/request

### Nice to Have (P2)

- [ ] Automated prompt validation script (`npm run validate-prompts`)
- [ ] CI/CD checks for variable duplication
- [ ] Documentation: Architecture diagrams updated

---

## 🚫 Out of Scope

- ❌ Changing LLM provider (OpenRouter stays)
- ❌ Changing agent names (Router, ProductSearch, etc.)
- ❌ Adding new agents (work with existing 6)
- ❌ Changing variable names ({{PRODUCTS}} stays)
- ❌ Frontend changes (backend/prompts only)
- ❌ Database schema changes (no new tables)
- ❌ API endpoint changes (LLM routing logic only)
- ❌ Unit tests for prompts (manual testing via WhatsApp)

---

## 📊 Success Metrics

### Primary KPIs

| Metric                     | Current | Target  | Measurement          |
| -------------------------- | ------- | ------- | -------------------- |
| Router tokens              | 8,000   | ≤3,500  | Prompt token counter |
| Total input tokens/request | 73,500  | ≤63,500 | OpenRouter API logs  |
| {{SERVICES}} occurrences   | 2       | 1       | Grep search          |
| Annual cost (1k req/day)   | $4,015  | ≤$3,468 | Token × pricing      |

### Secondary KPIs

| Metric                       | Current | Target | Measurement       |
| ---------------------------- | ------- | ------ | ----------------- |
| Confirmation logic locations | 3       | 2      | Code audit        |
| Example lines in Router      | ~100    | ≤30    | Line count        |
| Tone rules in Router         | Yes     | No     | Manual inspection |
| Service flow locations       | 2       | 1      | Code audit        |

---

## 🔄 Migration Strategy

### Phase 1: Router Cleanup (Low Risk)

**Changes**:

- Remove tone & style section
- Remove {{SERVICES}} variable
- Remove service selection flow
- Reduce examples to 10 critical ones

**Risk**: Low (Router just delegates, specialists unchanged)

**Rollback**: Restore old Router prompt

---

### Phase 2: ProductSearch Enrichment (Medium Risk)

**Changes**:

- Add {{SERVICES}} variable
- Add service discovery flow
- Add tone & style section
- Enhance confirmation handling

**Risk**: Medium (changes specialist logic)

**Rollback**: Restore old ProductSearch prompt

**Testing**: Manual WhatsApp tests for products + services

---

### Phase 3: Specialist Tone Addition (Low Risk)

**Changes**:

- Add tone sections to Cart, OrderTracking, Support

**Risk**: Low (additive changes)

**Rollback**: Remove tone sections

---

### Phase 4: Validation (No Changes)

**Actions**:

- Token count verification
- Constitution compliance audit
- User flow testing
- Cost analysis

---

## 📚 References

- **Analysis Document**: `specs/prompt-architecture-refactoring/ANALYSIS.md`
- **Constitution**: `.specify/memory/constitution.md` (Principles I, III, V, VIII)
- **Current Prompts**: `docs/prompts/*.md`
- **Architecture Docs**: `docs/architecture/MULTI_AGENT_FLOW.md`

---

**Status**: ✅ SPECIFICATION COMPLETE  
**Next Step**: Create implementation plan + task breakdown  
**Approver**: Andrea Gelso  
**Version**: 1.0.0
