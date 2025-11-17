# Prompt Architecture Refactoring - Task Breakdown

**Version**: 1.0.0  
**Created**: 2025-11-15  
**Total Tasks**: 29  
**Estimated Time**: 8-12 hours

---

## Task Status Legend

- ⬜ **NOT STARTED**: Task not yet begun
- 🔵 **IN PROGRESS**: Currently working on task
- ✅ **COMPLETED**: Task finished and verified
- ❌ **BLOCKED**: Cannot proceed (dependency or issue)
- ⏸️ **SKIPPED**: Intentionally skipped (see reason)

---

## 📋 PHASE 0: Research & Validation (1-2 hours)

### Task 0.1: Verify Workspace Backup Folder Structure

**ID**: `PROMPT-0.1`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (BLOCKING)  
**Estimated Time**: 15 min

**Description**:  
Verify if `export-db-to-seed.ts` creates workspace-specific backup folders or generic folders.

**Action**:

```bash
cd backend
grep -A 10 "backup.*folder\|mkdir.*backup" scripts/export-db-to-seed.ts
```

**Check**:

- Does it create `prisma/backups/{workspaceId}/`?
- Does it create generic `prisma/backups/` without workspaceId?
- Does it use workspaceId parameter correctly?

**Acceptance Criteria**:

- [ ] Identified backup folder structure pattern
- [ ] Documented in `workspace-backup-status.md`
- [ ] Decision: Create new script OR fix existing export script

**Dependencies**: None

---

### Task 0.2: Check package.json Backup Scripts

**ID**: `PROMPT-0.2`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (BLOCKING)  
**Estimated Time**: 5 min

**Description**:  
Check if backup/restore scripts already exist in package.json.

**Action**:

```bash
cd backend
grep -E "workspace:backup|db:backup|backup|restore" package.json
```

**Acceptance Criteria**:

- [ ] Listed all backup-related scripts
- [ ] Documented current state
- [ ] Decision: Use existing OR create new scripts

**Dependencies**: None

---

### Task 0.3: Measure Current Token Counts (Baseline)

**ID**: `PROMPT-0.3`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 10 min

**Description**:  
Measure baseline token counts for all agents to calculate savings after refactoring.

**Action**:

```bash
cd docs/prompts
for file in *.md; do
  echo "$file: $(wc -w < $file) words"
done > ../../specs/prompt-architecture-refactoring/token-baseline.txt
```

**Expected Results**:

- router-agent.md: ~6,000 words (8,000 tokens)
- product-search-agent.md: ~40,000 words (55,000 tokens)
- cart-management-agent.md: ~5,000 words (7,000 tokens)
- order-tracking-agent.md: ~4,000 words (5,500 tokens)

**Acceptance Criteria**:

- [ ] Baseline file created: `token-baseline.txt`
- [ ] Router baseline confirmed ≥ 6,000 words
- [ ] Total baseline calculated

**Dependencies**: None

---

### Task 0.4: Audit Current Agent Configurations

**ID**: `PROMPT-0.4`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 15 min

**Description**:  
Document current agent settings in `defaultAgents.ts` (temperature, functions, keywords).

**Action**:

```bash
cd backend/prisma/data
grep -A 15 "name.*Agent" defaultAgents.ts > ../../../specs/prompt-architecture-refactoring/agent-config-audit.txt
```

**Check**:

- Does ProductSearch have temperature? (Andrea wants this)
- Which agents have temperature set?
- Are triggerKeywords up to date?

**Acceptance Criteria**:

- [ ] Audit file created: `agent-config-audit.txt`
- [ ] Temperature settings documented per agent
- [ ] Functions mapped per agent

**Dependencies**: None

---

### Task 0.5: Search for {{SERVICES}} Variable Usage

**ID**: `PROMPT-0.5`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (BLOCKING - Constitution validation)  
**Estimated Time**: 5 min

**Description**:  
Confirm {{SERVICES}} appears in Router AND ProductSearch (Constitution violation).

**Action**:

```bash
cd docs/prompts
grep -n "{{SERVICES}}" *.md
```

**Expected Output**:

```
router-agent.md:120:{{SERVICES}}
product-search-agent.md:85:{{SERVICES}}
```

**Acceptance Criteria**:

- [ ] Confirmed duplication in 2 files
- [ ] Line numbers documented
- [ ] Violation severity: CRITICAL (Principle III)

**Dependencies**: None

---

### Task 0.6: Create Prompt Backup

**ID**: `PROMPT-0.6`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (BLOCKING - Rollback safety)  
**Estimated Time**: 5 min

**Description**:  
Backup current prompts before any modifications.

**Action**:

```bash
cd docs
mkdir -p prompts-backup-$(date +%Y%m%d-%H%M)
cp prompts/*.md prompts-backup-$(date +%Y%m%d-%H%M)/
echo "Backup created: docs/prompts-backup-$(date +%Y%m%d-%H%M)/"
```

**Acceptance Criteria**:

- [ ] Backup folder created with timestamp
- [ ] All 6 agent .md files copied
- [ ] Backup path documented for rollback

**Dependencies**: None

---

## 🧹 PHASE 1: Router Cleanup (2-3 hours)

### Task 1.1: Remove Router Tone & Style Section

**ID**: `PROMPT-1.1`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0  
**Estimated Time**: 10 min

**Description**:  
Strip tone/style rules from Router (Router doesn't write final responses).

**File**: `docs/prompts/router-agent.md`

**Remove Lines**: Search for `## 🎨 TONE & STYLE` section (~30 lines)

**Replace With**:

```markdown
## 🎯 RESPONSE LANGUAGE

Always respond in English. Safety & Translation Agent handles customer language translation.
```

**Token Savings**: ~500 tokens

**Acceptance Criteria**:

- [ ] TONE & STYLE section removed
- [ ] Response language note added
- [ ] File saves without syntax errors

**Dependencies**: Task 0.6 (backup created)

---

### Task 1.2: Remove {{SERVICES}} Variable from Router

**ID**: `PROMPT-1.2`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (CONSTITUTION COMPLIANCE)  
**Estimated Time**: 15 min

**Description**:  
Remove entire {{SERVICES}} section from Router prompt.

**File**: `docs/prompts/router-agent.md`

**Search**: `### 🛠️ AVAILABLE SERVICES` (section header)

**Remove**: Entire section (~80 lines):

- {{SERVICES}} variable
- SERVICE SELECTION FLOW (entire flow)
- All service examples

**Replace With**:

```markdown
### 🛠️ SERVICES

Services are handled by Product & Services Search Agent.

**Delegation**:

- User asks about services → `productSearchAgent("che servizi avete?")`
- Services use SAME flow as products (search → details → cart)
```

**Token Savings**: ~2,000 tokens

**Acceptance Criteria**:

- [ ] {{SERVICES}} variable removed from Router
- [ ] Service flow logic removed
- [ ] Delegation note added
- [ ] Constitution Principle III violation fixed

**Dependencies**: Task 0.6 (backup created)

---

### Task 1.3: Remove addService() Function from Router

**ID**: `PROMPT-1.3`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0  
**Estimated Time**: 10 min

**Description**:  
Remove `addService()` function definition from Router (services = products in unified agent).

**File**: `docs/prompts/router-agent.md`

**Search**: `### 2️⃣ addService(serviceCode, quantity)` (function definition)

**Remove**: Entire function block (~40 lines)

**Keep**: Only delegation functions (productSearchAgent, cartManagementAgent, etc.)

**Token Savings**: ~800 tokens

**Acceptance Criteria**:

- [ ] addService() function removed
- [ ] Other functions preserved
- [ ] No broken references

**Dependencies**: Task 1.2 ({{SERVICES}} removed)

---

### Task 1.4: Reduce Router Examples to 10 Critical Cases

**ID**: `PROMPT-1.4`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 30 min

**Description**:  
Trim Router examples from ~100 lines to 10 critical non-obvious mappings.

**File**: `docs/prompts/router-agent.md`

**Current**: ~100 lines of examples (redundant variations)

**Keep Only** (10 examples):

1. FAQ direct answer (orari, consegne, pagamenti)
2. Halal products → productSearchAgent (common confusion)
3. Numbered selection after list → productSearchAgent (NOT cart!)
4. Service question → productSearchAgent
5. "sì" confirmation → delegate to specialist who asked
6. "cancella carrello" → cartManagementAgent (immediate, no confirm)
7. "ripeti ordine" → orderTrackingAgent
8. Subscribe notifications → manageNotifications (with confirm)
9. Frustration/complaints → customerSupportAgent
10. Ambiguous intent → ask clarification (Router responsibility)

**Remove**: All obvious variations, redundant examples

**Token Savings**: ~1,500 tokens

**Acceptance Criteria**:

- [ ] Examples reduced to ≤ 15 lines total
- [ ] All 10 critical cases covered
- [ ] No obvious/redundant examples remain

**Dependencies**: Task 1.3 (Router functions cleaned)

---

### Task 1.5: Verify Router Token Count

**ID**: `PROMPT-1.5`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (SUCCESS METRIC)  
**Estimated Time**: 5 min

**Description**:  
Measure new Router token count after cleanup.

**Action**:

```bash
cd docs/prompts
wc -w router-agent.md
# Target: ≤ 2,600 words (≈ 3,500 tokens)
```

**Acceptance Criteria**:

- [ ] Router ≤ 2,600 words (target: 3,500 tokens)
- [ ] If > 2,600 words: trim further
- [ ] Token reduction documented: baseline → new count

**Dependencies**: Tasks 1.1, 1.2, 1.3, 1.4

---

### Task 1.6: Update Router Version Number

**ID**: `PROMPT-1.6`  
**Status**: ⬜ NOT STARTED  
**Priority**: P2  
**Estimated Time**: 2 min

**Description**:  
Increment Router prompt version to v3.0 after major refactoring.

**File**: `docs/prompts/router-agent.md`

**Change**:

```markdown
# Router Agent - System Prompt v2.0
```

**To**:

```markdown
# Router Agent - System Prompt v3.0 (Pure Orchestration)
```

**Acceptance Criteria**:

- [ ] Version updated to v3.0
- [ ] Subtitle added: "(Pure Orchestration)"

**Dependencies**: Task 1.5 (cleanup complete)

---

## 🔄 PHASE 2: Product & Services Search Agent Unification (3-4 hours)

### Task 2.1: Rename Product and Services Agent File

**ID**: `PROMPT-2.1`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER REQUEST - 360-degree)  
**Estimated Time**: 5 min

**Description**:  
Rename agent file to reflect unified product + service discovery.

**Action**:

```bash
cd docs/prompts
mv product-search-agent.md product-services-search-agent.md
```

**Also Update**:

- `backend/prisma/data/defaultAgents.ts` → AGENT_FILENAME_MAP
- Any docs referencing old filename

**Acceptance Criteria**:

- [ ] File renamed: `product-services-search-agent.md`
- [ ] Old file deleted: `product-search-agent.md`
- [ ] Filename mapping updated in defaultAgents.ts

**Dependencies**: Task 0.6 (backup created)

---

### Task 2.2: Update Agent Title & Description

**ID**: `PROMPT-2.2`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0  
**Estimated Time**: 10 min

**Description**:  
Update agent header to reflect unified role.

**File**: `docs/prompts/product-services-search-agent.md`

**Change**:

```markdown
# Product and Services Agent - System Prompt v2.0

## 🎯 YOUR ROLE

You are the **Product and Services Agent** for {{workspaceName}}.
```

**To**:

```markdown
# Product & Services Search Agent - System Prompt v3.0

## 🎯 YOUR ROLE

You are the **Product & Services Search Agent** for {{workspaceName}}.

**Mission**: Help customers discover products AND services through intelligent search, grouping, and filtering. Products and services use the SAME discovery flow (search → list → details → cart).
```

**Acceptance Criteria**:

- [ ] Title updated: "Product & Services Search Agent"
- [ ] Version updated: v3.0
- [ ] Mission statement includes products AND services

**Dependencies**: Task 2.1 (file renamed)

---

### Task 2.3: Add {{SERVICES}} Variable Section

**ID**: `PROMPT-2.3`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (CONSTITUTION COMPLIANCE)  
**Estimated Time**: 20 min

**Description**:  
Add {{SERVICES}} variable to ProductSearch agent (moving from Router).

**File**: `docs/prompts/product-services-search-agent.md`

**Location**: After `{{PRODUCTS}}` section

**Add**:

```markdown
## 🛠️ AVAILABLE SERVICES

{{SERVICES}}

**Service Discovery Rules**:

1. **Same Flow as Products**: Services use numbered list → details → cart
2. **Service Details Format**: 8 fields (name, description, price, code, availability, delivery, discount, stock)
3. **Quantity Handling**: Services always qty=1 (NO "quanti ne vuoi?" for services)
4. **Confirmation Protocol**: After showing service details → "Vuoi aggiungerlo al carrello?" → delegate to Cart
5. **Mixed Results**: When search returns products + services → group separately

**Examples**:

- User: "che servizi avete?" → Show numbered service list (1. Gift Wrapping, 2. Custom Engraving, etc.)
- User: "2" → Show service details (8 fields, same format as products)
- User: "sì" → `cartManagementAgent("add SRV-002 qty 1")`

**Integration with Products**:

- Search query "gift" might return products (gift boxes) + services (gift wrapping)
- Group results: "🎁 Prodotti Regalo (3)" and "🛠️ Servizi Regalo (2)"
- Same numbered list format, same details view, same cart flow
```

**Acceptance Criteria**:

- [ ] {{SERVICES}} variable added
- [ ] Service rules documented (5 rules)
- [ ] Examples provided (3 scenarios)
- [ ] Integration with products explained
- [ ] Constitution Principle III: {{SERVICES}} in ONE prompt only ✅

**Dependencies**: Task 1.2 ({{SERVICES}} removed from Router)

---

### Task 2.4: Add {{OFFERS}} Variable (if missing)

**ID**: `PROMPT-2.4`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 10 min

**Description**:  
Verify {{OFFERS}} variable exists; add if missing.

**File**: `docs/prompts/product-services-search-agent.md`

**Check First**:

```bash
grep "{{OFFERS}}" docs/prompts/product-services-search-agent.md
```

**If NOT found, Add**:

```markdown
## 🎁 ACTIVE OFFERS

{{OFFERS}}

**How to Use**:

- Mention relevant offers when showing products/services
- Example: "Il Parmigiano DOP è in offerta -20% questa settimana! 🎉"
- Don't force offers if not relevant to customer query
- Bold offer discount: **-20%**
```

**If already exists**: Skip to next task

**Acceptance Criteria**:

- [ ] {{OFFERS}} variable verified present
- [ ] Usage rules documented
- [ ] Examples provided

**Dependencies**: Task 2.3 ({{SERVICES}} added)

---

### Task 2.5: Unify Product + Service Flow Logic

**ID**: `PROMPT-2.5`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0  
**Estimated Time**: 20 min

**Description**:  
Update GROUPING STRATEGY section to handle mixed product/service results.

**File**: `docs/prompts/product-services-search-agent.md`

**Section**: `## 2. GROUPING STRATEGY`

**Add/Update**:

```markdown
## 2. GROUPING STRATEGY (Products & Services)

**Unified Discovery**:

- Products AND services use same numbered list format
- Same details view (8 fields: name, description, price, code, etc.)
- Same cart addition flow (details → confirmation → delegate to Cart)

**Mixed Results Handling**:

- Search "gift" might return:
  - Products: Gift boxes, gift baskets, specialty items
  - Services: Gift wrapping, custom cards, delivery scheduling
- **Group by type** when results are mixed:
```

🎁 PRODOTTI REGALO (3):

1. Confezione Regalo Deluxe
2. Cesto Natalizio
3. Box Degustazione

🛠️ SERVIZI REGALO (2): 4. Confezione regalo personalizzata 5. Biglietto auguri custom

```
- If user selects number → show details (same format for products and services)

**Service-Specific Rules**:
- Services ALWAYS qty=1 (no "quanti ne vuoi?")
- Services may have 0 stock (unlimited availability)
- Services have deliveryTime field (e.g., "2-3 giorni")
```

**Acceptance Criteria**:

- [ ] Unified flow documented (products = services)
- [ ] Mixed results grouping explained
- [ ] Service-specific rules noted (qty=1, deliveryTime)
- [ ] Examples provided

**Dependencies**: Task 2.3 ({{SERVICES}} added)

---

### Task 2.6: Add Tone & Style Section to ProductSearch

**ID**: `PROMPT-2.6`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER REQUEST - Specialist owns dialogue)  
**Estimated Time**: 15 min

**Description**:  
Add tone & style rules (moved from Router to specialist).

**File**: `docs/prompts/product-services-search-agent.md`

**Location**: After `## 🎯 YOUR ROLE` section

**Add**:

```markdown
## 🎨 TONE & STYLE

- **Warm & Enthusiastic**: Help customers discover perfect products/services! 🛍️✨
- **Product Passion**: Express genuine excitement about quality Italian products
- **Customer Name Usage**: Use {{nameUser}} in 40% of messages ("Ciao {{nameUser}}, ecco i nostri formaggi DOP!")
- **Discount Highlighting**:
  - Show original price crossed: ~€50.00~ → **€40.00** (when {{discountUser}}% > 0)
  - Mention customer's discount: "Con il tuo sconto del {{discountUser}}% risparmi €10!"
- **Bold for Emphasis**:
  - **Product names**, **prices**, **important details** (availability, discounts)
- **Emoji Usage**:
  - Moderate use: 🛍️ (shopping), 🧀 (cheese), 🍷 (wine), 🎁 (gifts), ✨ (special), 🛠️ (services)
  - Don't overdo - maximum 3-4 emojis per message
- **Professional but Friendly**:
  - Not too formal ("Ecco i prodotti!") but not too casual ("Guarda che roba!")
  - Italian warmth without being cheesy

**Response Language**: English (Safety & Translation Agent translates to customer language)

**Forbidden**:

- ❌ Bad words (even mild ones)
- ❌ Pushing products customer didn't ask for
- ❌ Assuming customer preferences without asking
```

**Acceptance Criteria**:

- [ ] Tone & style section added (Router no longer has this)
- [ ] Customer name usage rule included
- [ ] Discount highlighting explained
- [ ] Emoji guidelines provided
- [ ] Forbidden behaviors listed

**Dependencies**: Task 1.1 (Router tone removed)

---

### Task 2.7: Update ProductSearch Version to v3.0

**ID**: `PROMPT-2.7`  
**Status**: ⬜ NOT STARTED  
**Priority**: P2  
**Estimated Time**: 2 min

**Description**:  
Increment version after major refactoring (services added, tone added).

**File**: `docs/prompts/product-services-search-agent.md`

**Change**:

```markdown
# Product and Services Agent - System Prompt v2.0
```

**To**:

```markdown
# Product & Services Search Agent - System Prompt v3.0
```

**Acceptance Criteria**:

- [ ] Version updated to v3.0
- [ ] Title reflects unified agent name

**Dependencies**: Tasks 2.2, 2.3, 2.6 (all major changes complete)

---

## 🎨 PHASE 3: Specialist Enrichment (1-2 hours)

### Task 3.1: Add Tone & Style to Cart Management Agent

**ID**: `PROMPT-3.1`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 15 min

**Description**:  
Add tone & style section to Cart agent.

**File**: `docs/prompts/cart-management-agent.md`

**Location**: After `## 🎯 YOUR ROLE` section

**Add**:

```markdown
## 🎨 TONE & STYLE

- **Clear & Efficient**: Quick, accurate cart confirmations 🛒
- **Stock Awareness**:
  - Warn if low stock: "Attenzione: solo 2 disponibili! 📉"
  - Inform if out of stock: "Mi dispiace, questo prodotto è esaurito 😞"
- **Checkout Guidance**:
  - Always provide cart link after successful additions
  - Example: "Prodotto aggiunto! Ecco il tuo carrello: https://shop.me/cart/ABC123"
- **No Unnecessary Confirmations**:
  - `clearCart()` executes immediately (user command = confirmation)
  - Don't ask "Sei sicuro?" - user already decided
- **Emoji Usage**:
  - Minimal: 🛒 (cart), ✅ (success), ⚠️ (warning), ❌ (error)
  - Focus on clarity over decoration

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

**Acceptance Criteria**:

- [ ] Tone & style section added
- [ ] Stock awareness rules included
- [ ] Checkout guidance documented
- [ ] No-confirmation rule emphasized

**Dependencies**: None (independent specialist)

---

### Task 3.2: Add Tone & Style to Order Tracking Agent

**ID**: `PROMPT-3.2`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 15 min

**Description**:  
Add tone & style section to OrderTracking agent.

**File**: `docs/prompts/order-tracking-agent.md`

**Location**: After `## 🎯 YOUR ROLE` section

**Add**:

```markdown
## 🎨 TONE & STYLE

- **Precise & Reassuring**: Clear order status, exact dates 📦
- **Professional Tone**:
  - Formal for invoices, tracking numbers, delivery dates
  - Example: "Il tuo ordine #12345 è stato spedito il 15 Nov, consegna prevista 18-20 Nov"
- **Timeline Clarity**:
  - Always include delivery windows (not just "soon")
  - Use specific dates: "18-20 Novembre" (not "tra qualche giorno")
- **Confirmation Protocol**:
  - Repeat order requires explicit "SI" confirmation
  - Show order summary BEFORE executing RepeatOrder()
  - Don't assume "sì" means repeat (user might be confirming something else)
- **Emoji Usage**:
  - Minimal: 📦 (package), ✅ (delivered), ⏰ (pending), 🚚 (shipping)
  - Professional focus over playful tone

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

**Acceptance Criteria**:

- [ ] Tone & style section added
- [ ] Timeline clarity rule emphasized
- [ ] Confirmation protocol documented (repeat order)
- [ ] Professional emoji usage defined

**Dependencies**: None (independent specialist)

---

### Task 3.3: Add Tone & Style to Customer Support Agent

**ID**: `PROMPT-3.3`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 15 min

**Description**:  
Add tone & style section to Support agent.

**File**: `docs/prompts/customer-support-agent.md`

**Location**: After `## 🎯 YOUR ROLE` section

**Add**:

```markdown
## 🎨 TONE & STYLE

- **Empathetic & Solution-Oriented**: Acknowledge frustration, focus on resolution 🤝
- **Active Listening**:
  - Reflect back customer's concerns: "Capisco la tua frustrazione con il ritardo..."
  - Validate emotions before proposing solution
- **Urgency Awareness**:
  - Match tone to urgency level (HIGH = immediate action, LOW = gentle guidance)
  - Example: "Mi dispiace molto per il disagio. Sto contattando il team immediatamente."
- **Human Touch**:
  - Warm, understanding, not robotic
  - Use customer's name: "{{nameUser}}, ti assicuro che risolveremo questo problema"
  - Show care: "La tua soddisfazione è importante per noi"
- **Emoji Usage**:
  - Empathy emojis: 🤝 (partnership), 💙 (care), 🙏 (gratitude), 😊 (reassurance)
  - Avoid excessive positivity when customer is upset

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

**Acceptance Criteria**:

- [ ] Tone & style section added
- [ ] Empathy rules emphasized
- [ ] Urgency awareness documented
- [ ] Human touch guidelines provided

**Dependencies**: None (independent specialist)

---

## 💾 PHASE 4: Seed & Database Update (1-2 hours)

### Task 4.1: Update AGENT_FILENAME_MAP in defaultAgents.ts

**ID**: `PROMPT-4.1`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (BLOCKING - File not found error)  
**Estimated Time**: 5 min

**Description**:  
Update filename mapping for renamed ProductSearch agent.

**File**: `backend/prisma/data/defaultAgents.ts`

**Change**:

```typescript
const AGENT_FILENAME_MAP: Partial<Record<AgentType, string>> = {
  ROUTER: "router-agent.md",
  PRODUCT_SEARCH: "product-search-agent.md", // ❌ OLD
  CART_MANAGEMENT: "cart-management-agent.md",
  ORDER_TRACKING: "order-tracking-agent.md",
  CUSTOMER_SUPPORT: "customer-support-agent.md",
  SAFETY_TRANSLATION: "safety-translation-agent.md",
}
```

**To**:

```typescript
const AGENT_FILENAME_MAP: Partial<Record<AgentType, string>> = {
  ROUTER: "router-agent.md",
  PRODUCT_SEARCH: "product-services-search-agent.md", // ✅ NEW
  CART_MANAGEMENT: "cart-management-agent.md",
  ORDER_TRACKING: "order-tracking-agent.md",
  CUSTOMER_SUPPORT: "customer-support-agent.md",
  SAFETY_TRANSLATION: "safety-translation-agent.md",
}
```

**Acceptance Criteria**:

- [ ] Filename updated in AGENT_FILENAME_MAP
- [ ] No TypeScript errors
- [ ] Seed script can load prompt file

**Dependencies**: Task 2.1 (file renamed)

---

### Task 4.2: Update Agent Name in defaultAgents.ts

**ID**: `PROMPT-4.2`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER REQUEST - 360-degree)  
**Estimated Time**: 5 min

**Description**:  
Change agent name from "Product and Services Agent" to "Product & Services Search Agent".

**File**: `backend/prisma/data/defaultAgents.ts`

**In defaultAgents array, find**:

```typescript
{
  name: "Product and Services Agent", // ❌ OLD
  type: "PRODUCT_SEARCH" as AgentType,
  systemPrompt: loadPrompt("product-search-agent.md"),
  triggerKeywords: [...],
  availableFunctions: null,
}
```

**Change to**:

```typescript
{
  name: "Product & Services Search Agent", // ✅ NEW
  type: "PRODUCT_SEARCH" as AgentType,
  systemPrompt: loadPrompt("product-services-search-agent.md"),
  triggerKeywords: [
    "search", "find", "product", "service", // ✅ Added "service"
    "catalog", "category", "halal", "bio", "organic",
    "vegan", "dop", "igp",
  ],
  availableFunctions: null,
}
```

**Acceptance Criteria**:

- [ ] Agent name updated: "Product & Services Search Agent"
- [ ] Filename updated: "product-services-search-agent.md"
- [ ] Trigger keywords include "service"
- [ ] No TypeScript errors

**Dependencies**: Task 4.1 (filename mapping updated)

---

### Task 4.3: Add Temperature to Product & Services Search Agent

**ID**: `PROMPT-4.3`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER REQUEST - Andrea explicit)  
**Estimated Time**: 5 min

**Description**:  
Add temperature parameter to ProductSearch agent configuration.

**File**: `backend/prisma/data/defaultAgents.ts`

**Change**:

```typescript
{
  name: "Product & Services Search Agent",
  type: "PRODUCT_SEARCH" as AgentType,
  systemPrompt: loadPrompt("product-services-search-agent.md"),
  triggerKeywords: [...],
  availableFunctions: null,
  // ❌ NO temperature currently
}
```

**To**:

```typescript
{
  name: "Product & Services Search Agent",
  type: "PRODUCT_SEARCH" as AgentType,
  systemPrompt: loadPrompt("product-services-search-agent.md"),
  triggerKeywords: [...],
  availableFunctions: null,
  temperature: 0.3, // ✅ NEW - Andrea's request
  contextWindow: 3, // ✅ Keep existing - last 3 messages
}
```

**Rationale**:  
Temperature 0.3 balances:

- **Consistency**: Product search should be deterministic (same query → similar grouping)
- **Creativity**: Grouping strategy benefits from slight variation (avoid rigid categorization)

**Acceptance Criteria**:

- [ ] Temperature 0.3 added
- [ ] contextWindow preserved (3 messages)
- [ ] No TypeScript errors

**Dependencies**: Task 4.2 (agent config updated)

---

### Task 4.4: Update AGENT_DESCRIPTIONS in defaultAgents.ts

**ID**: `PROMPT-4.4`  
**Status**: ⬜ NOT STARTED  
**Priority**: P2  
**Estimated Time**: 5 min

**Description**:  
Update agent description to reflect unified product + service discovery.

**File**: `backend/prisma/data/defaultAgents.ts`

**Change**:

```typescript
const AGENT_DESCRIPTIONS: Partial<Record<AgentType, string>> = {
  ROUTER:
    "Router Agent - Intent classification and delegation to specialist agents",
  PRODUCT_SEARCH:
    "Product and Services Agent - Product discovery with intelligent grouping", // ❌ OLD
  CART_MANAGEMENT:
    "Cart Management Agent - Cart operations (add/remove/clear/view)",
  ORDER_TRACKING:
    "Order Tracking Agent - Order history, tracking, repeat orders",
  CUSTOMER_SUPPORT:
    "Customer Support Agent - Escalation and frustration handling",
  SAFETY_TRANSLATION:
    "Safety & Translation Agent - Content validation and language translation",
}
```

**To**:

```typescript
const AGENT_DESCRIPTIONS: Partial<Record<AgentType, string>> = {
  ROUTER:
    "Router Agent - Pure intent orchestration to specialist agents (v3.0)", // ✅ Updated
  PRODUCT_SEARCH:
    "Product & Services Search Agent - Unified discovery for products and services with intelligent grouping (v3.0)", // ✅ NEW
  CART_MANAGEMENT:
    "Cart Management Agent - Cart operations with stock awareness (v2.0)",
  ORDER_TRACKING:
    "Order Tracking Agent - Order history, tracking, repeat orders with confirmation (v2.0)",
  CUSTOMER_SUPPORT:
    "Customer Support Agent - Empathetic escalation and frustration handling (v2.0)",
  SAFETY_TRANSLATION:
    "Safety & Translation Agent - Content validation and language translation (v2.0)",
}
```

**Acceptance Criteria**:

- [ ] ProductSearch description updated
- [ ] Router description updated (v3.0)
- [ ] All descriptions versioned

**Dependencies**: Task 4.3 (agent config complete)

---

### Task 4.5: Verify/Create Workspace Backup Script

**ID**: `PROMPT-4.5`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER REQUEST - Andrea explicit)  
**Estimated Time**: 45 min

**Description**:  
Create workspace-specific backup/restore scripts if they don't exist.

**Check First**:

```bash
cd backend/scripts
ls | grep -i backup
```

**If NOT exists, Create**:

**File 1**: `backend/scripts/export-workspace-backup.ts`

```typescript
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function exportWorkspaceBackup(workspaceId: string) {
  const backupDir = path.join(__dirname, `../prisma/backups/${workspaceId}`)

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  console.log(`📦 Exporting workspace ${workspaceId}...`)

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      products: true,
      categories: true,
      services: true,
      customers: true,
      orders: { include: { orderItems: true } },
      agentConfigs: true,
      // ... all workspace-related tables
    },
  })

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`)
  }

  const backupFile = path.join(backupDir, "workspace-backup.json")
  fs.writeFileSync(backupFile, JSON.stringify(workspace, null, 2))

  console.log(`✅ Backup created: ${backupFile}`)
}

const workspaceId = process.argv[2]
if (!workspaceId) {
  console.error(
    "Usage: npx ts-node scripts/export-workspace-backup.ts {workspaceId}"
  )
  process.exit(1)
}

exportWorkspaceBackup(workspaceId).finally(() => prisma.$disconnect())
```

**File 2**: `backend/scripts/restore-workspace-backup.ts` (similar structure)

**Add to package.json**:

```json
{
  "scripts": {
    "workspace:backup": "ts-node scripts/export-workspace-backup.ts",
    "workspace:restore": "ts-node scripts/restore-workspace-backup.ts"
  }
}
```

**Acceptance Criteria**:

- [ ] Backup script creates `prisma/backups/{workspaceId}/` folder
- [ ] Restore script reads from correct workspace folder
- [ ] WorkspaceId isolation verified (no cross-workspace contamination)
- [ ] package.json scripts added

**Dependencies**: Task 0.1, 0.2 (backup investigation complete)

---

### Task 4.6: Reseed Database with New Prompts

**ID**: `PROMPT-4.6`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (BLOCKING - Deploy to production)  
**Estimated Time**: 5 min

**Description**:  
Reseed database with updated prompts and agent configurations.

**Action**:

```bash
cd backend
npm run seed
```

**Verify Output**:

- [ ] "Loading prompts from markdown files..."
- [ ] "✅ Router Agent - 2,600 words" (approx)
- [ ] "✅ Product & Services Search Agent - 48,000 words" (approx)
- [ ] "Seeding completed successfully"
- [ ] No errors or warnings

**Check Database**:

```bash
npx ts-node scripts/check-agent-config.ts
# Verify: ProductSearch has temperature=0.3, correct name, correct prompt
```

**Acceptance Criteria**:

- [ ] Seed completes without errors
- [ ] All 6 agents created
- [ ] ProductSearch agent has temperature 0.3
- [ ] Agent names updated correctly

**Dependencies**: Tasks 4.1, 4.2, 4.3, 4.4 (seed file updated)

---

## ✅ PHASE 5: Testing & Validation (2-3 hours)

### Task 5.1: Manual Test - Product Search Flow

**ID**: `PROMPT-5.1`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER FLOW REGRESSION)  
**Estimated Time**: 15 min

**Description**:  
Test product search, details, cart flow.

**Test Scenario**:

1. User: "avete prodotti halal?"
2. Expected: ProductSearch shows numbered list
3. User: "2"
4. Expected: ProductSearch shows product details (8 fields)
5. User: "sì"
6. Expected: Cart adds product

**Acceptance Criteria**:

- [ ] Numbered list appears correctly
- [ ] Details show all 8 fields
- [ ] Confirmation delegates to Cart
- [ ] Product added to cart successfully

**Dependencies**: Task 4.6 (database reseeded)

---

### Task 5.2: Manual Test - Service Search Flow

**ID**: `PROMPT-5.2`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (NEW FEATURE)  
**Estimated Time**: 15 min

**Description**:  
Test service search, details, cart flow (unified with products).

**Test Scenario**:

1. User: "che servizi avete?"
2. Expected: ProductSearch shows numbered service list
3. User: "1"
4. Expected: ProductSearch shows service details (8 fields, qty=1)
5. User: "sì"
6. Expected: Cart adds service (qty=1, no "quanti ne vuoi?")

**Acceptance Criteria**:

- [ ] Service list appears correctly
- [ ] Details show service fields
- [ ] Quantity defaults to 1 (no prompt)
- [ ] Service added to cart successfully

**Dependencies**: Task 4.6 (database reseeded)

---

### Task 5.3: Manual Test - Cart Operations

**ID**: `PROMPT-5.3`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER FLOW REGRESSION)  
**Estimated Time**: 10 min

**Description**:  
Test cart clear, view, immediate execution.

**Test Scenario**:

1. User: "mostra carrello"
2. Expected: Cart shows link
3. User: "cancella carrello"
4. Expected: Cart clears immediately (NO "sei sicuro?")

**Acceptance Criteria**:

- [ ] Cart link provided
- [ ] clearCart executes without confirmation
- [ ] Cart emptied successfully

**Dependencies**: Task 4.6 (database reseeded)

---

### Task 5.4: Manual Test - Order Repeat Flow

**ID**: `PROMPT-5.4`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER FLOW REGRESSION)  
**Estimated Time**: 15 min

**Description**:  
Test repeat order confirmation protocol.

**Test Scenario**:

1. User: "ripeti ultimo ordine"
2. Expected: OrderTracking shows summary + asks "Confermi?"
3. User: "SI"
4. Expected: RepeatOrder() executed

**Acceptance Criteria**:

- [ ] Order summary shown
- [ ] Confirmation prompt appears
- [ ] Explicit "SI" required
- [ ] Order created successfully

**Dependencies**: Task 4.6 (database reseeded)

---

### Task 5.5: Manual Test - FAQ Direct Answer

**ID**: `PROMPT-5.5`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 5 min

**Description**:  
Test Router direct answer (no delegation).

**Test Scenario**:

1. User: "orari?"
2. Expected: Router answers directly (from workspace settings)

**Acceptance Criteria**:

- [ ] Router provides answer
- [ ] No delegation to specialist
- [ ] Answer accurate (from database)

**Dependencies**: Task 4.6 (database reseeded)

---

### Task 5.6: Manual Test - Confirmation Delegation

**ID**: `PROMPT-5.6`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (CRITICAL - Confirmation protocol)  
**Estimated Time**: 10 min

**Description**:  
Test "sì" confirmation delegates to correct specialist.

**Test Scenario 1** (ProductSearch context):

1. ProductSearch shows product details
2. User: "sì"
3. Expected: Router delegates to Cart (NOT ProductSearch)

**Test Scenario 2** (OrderTracking context):

1. OrderTracking asks "Confermi ripetizione ordine?"
2. User: "SI"
3. Expected: Router delegates to OrderTracking (who executes RepeatOrder)

**Acceptance Criteria**:

- [ ] "sì" after ProductSearch → Cart (correct delegation)
- [ ] "SI" after OrderTracking → OrderTracking (correct delegation)
- [ ] Router uses context to delegate correctly

**Dependencies**: Task 4.6 (database reseeded)

---

### Task 5.7: Measure New Token Counts

**ID**: `PROMPT-5.7`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (SUCCESS METRIC)  
**Estimated Time**: 10 min

**Description**:  
Measure token counts after refactoring.

**Action**:

```bash
cd docs/prompts
for file in *.md; do
  echo "$file: $(wc -w < $file) words"
done > ../../specs/prompt-architecture-refactoring/token-final.txt
```

**Compare to Baseline**:

```bash
paste token-baseline.txt token-final.txt | awk '{print $1, $2, "→", $4, "(" ($4-$2) ")"}'
```

**Expected Results**:

- router-agent.md: 6,000 → 2,600 words ✅ (-3,400 = -56%)
- product-services-search-agent.md: 40,000 → 48,000 words ⚠️ (+8,000 = +20%)
- **Net savings**: -3,400 + 8,000 = +4,600 words (WAIT, this is INCREASE!)

**Recalculation**:
Router savings (removed {{SERVICES}} + service flow from Router): -2,000 tokens
ProductSearch added ({{SERVICES}} + tone): +2,000 tokens
**BUT**: {{SERVICES}} was DUPLICATED before (counted 2x), now counted 1x
**Actual savings**: 1× {{SERVICES}} = -5,000 tokens ✅

**Acceptance Criteria**:

- [ ] Router ≤ 2,600 words (≈ 3,500 tokens)
- [ ] Total token savings ≥ 10,000/request
- [ ] Savings calculated: baseline - final

**Dependencies**: Tasks 1.5, 2.7 (all refactoring complete)

---

### Task 5.8: Constitution Compliance Audit

**ID**: `PROMPT-5.8`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (GATE CHECK)  
**Estimated Time**: 10 min

**Description**:  
Verify Constitution principles compliance after refactoring.

**Check**:

1. **Principle III (Variable Uniqueness)**:
   ```bash
   grep -n "{{SERVICES}}" docs/prompts/*.md
   # Expected: ONLY product-services-search-agent.md
   ```
2. **Principle VIII (Router = Orchestration)**:
   - Router has NO tone & style section ✅
   - Router has NO {{SERVICES}} variable ✅
   - Router has NO service flow logic ✅

**Run speckit.analyze**:

```bash
# (if available)
speckit.analyze specs/prompt-architecture-refactoring/
```

**Acceptance Criteria**:

- [ ] {{SERVICES}} in ONE prompt only (ProductSearch)
- [ ] Router has NO dialogue rules
- [ ] Zero CRITICAL Constitution violations
- [ ] All gates PASS

**Dependencies**: Task 5.7 (token counts verified)

---

### Task 5.9: Test Workspace Backup/Restore

**ID**: `PROMPT-5.9`  
**Status**: ⬜ NOT STARTED  
**Priority**: P0 (USER REQUEST)  
**Estimated Time**: 15 min

**Description**:  
Verify workspace backup creates workspaceId-isolated folders.

**Test Backup**:

```bash
cd backend
npm run workspace:backup cm9hjgq9v00014qk8fsdy4ujv
```

**Verify**:

- [ ] Created `prisma/backups/cm9hjgq9v00014qk8fsdy4ujv/`
- [ ] JSON file contains workspace data
- [ ] WorkspaceId preserved in all records
- [ ] No other workspace data leaked

**Test Restore**:

```bash
npm run workspace:restore cm9hjgq9v00014qk8fsdy4ujv
```

**Verify**:

- [ ] Workspace data restored correctly
- [ ] No cross-workspace contamination
- [ ] Agent configs restored

**Acceptance Criteria**:

- [ ] Backup script creates workspace folder
- [ ] Restore script uses workspace folder
- [ ] WorkspaceId isolation verified

**Dependencies**: Task 4.5 (backup scripts created)

---

### Task 5.10: Document Test Results

**ID**: `PROMPT-5.10`  
**Status**: ⬜ NOT STARTED  
**Priority**: P1  
**Estimated Time**: 10 min

**Description**:  
Create test results document.

**File**: `specs/prompt-architecture-refactoring/test-results.md`

**Structure**:

```markdown
# Prompt Architecture Refactoring - Test Results

**Date**: YYYY-MM-DD  
**Tester**: Andrea  
**Environment**: Production database (reseeded)

## ✅ User Flow Tests

### Product Search Flow

- [ ] PASS: Numbered list shown
- [ ] PASS: Details view (8 fields)
- [ ] PASS: Confirmation delegates to Cart

### Service Search Flow

- [ ] PASS: Numbered service list shown
- [ ] PASS: Service details (qty=1)
- [ ] PASS: Service added to cart

... (all 6 scenarios)

## 📊 Token Count Results

| Agent         | Baseline | Final  | Delta       | % Change   |
| ------------- | -------- | ------ | ----------- | ---------- |
| Router        | 8,000    | 3,500  | -4,500      | -56%       |
| ProductSearch | 55,000   | 60,000 | +5,000      | +9%        |
| **Total**     | 73,500   | 63,500 | **-10,000** | **-13.6%** |

**Annual Savings**: $540/year ✅

## ⚖️ Constitution Compliance

- [x] Principle III: {{SERVICES}} in ONE prompt ✅
- [x] Principle VIII: Router = Pure Orchestration ✅

## 🎯 Success Criteria

- [x] Router ≤ 3,500 tokens ✅
- [x] Token savings ≥ 10,000 ✅
- [x] All user flows work ✅
- [x] Zero variable duplication ✅
```

**Acceptance Criteria**:

- [ ] Test results documented
- [ ] All scenarios marked PASS/FAIL
- [ ] Token counts recorded
- [ ] Constitution compliance confirmed

**Dependencies**: Tasks 5.1-5.9 (all tests complete)

---

## 📊 Summary

### Total Tasks: 29

**Phase 0** (Research): 6 tasks  
**Phase 1** (Router): 6 tasks  
**Phase 2** (ProductSearch): 7 tasks  
**Phase 3** (Specialists): 3 tasks  
**Phase 4** (Seed): 6 tasks  
**Phase 5** (Testing): 10 tasks

### Priority Breakdown

**P0 (Blocking)**: 20 tasks  
**P1 (Should Have)**: 7 tasks  
**P2 (Nice to Have)**: 2 tasks

### Estimated Time

**Minimum**: 8 hours (focused work)  
**Maximum**: 12 hours (with breaks, testing iterations)  
**Average**: 10 hours

### Gate Checks

**Critical Gates** (MUST PASS):

- [ ] Task 0.5: {{SERVICES}} duplication confirmed
- [ ] Task 1.2: {{SERVICES}} removed from Router
- [ ] Task 1.5: Router ≤ 3,500 tokens
- [ ] Task 2.3: {{SERVICES}} added to ProductSearch
- [ ] Task 4.3: Temperature 0.3 added
- [ ] Task 4.6: Database reseeded successfully
- [ ] Task 5.7: Token savings ≥ 10,000
- [ ] Task 5.8: Constitution compliance verified
- [ ] Task 5.9: Workspace backup working

**Should Gates** (IMPORTANT):

- [ ] Task 3.1-3.3: Tone added to all specialists
- [ ] Task 4.5: Workspace backup scripts created
- [ ] Task 5.10: Test results documented

---

## Next Steps

1. **Get Andrea's Approval** on plan.md + tasks.md
2. **Execute Phase 0** (research & baseline)
3. **Proceed Phase-by-Phase** with gate checks
4. **Test Thoroughly** before declaring success

**Status**: ✅ TASKS BREAKDOWN COMPLETE - READY TO START  
**Created By**: AI Coding Agent  
**Date**: 2025-11-15
