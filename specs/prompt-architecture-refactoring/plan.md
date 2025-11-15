# Prompt Architecture Refactoring - Implementation Plan

**Version**: 1.0.0  
**Created**: 2025-11-15  
**Branch**: `prompt-architecture-refactoring`  
**Estimated Duration**: 8-12 hours  
**Risk Level**: Medium (core LLM architecture)

---

## 📋 Executive Summary

### Objectives

1. **Strip Router to Pure Orchestration**: Remove dialogue logic, reduce from 8k to 3k tokens
2. **Unify Product + Service Discovery**: Single agent (ProductSearchAgent → Product & Services Search Agent)
3. **Eliminate Variable Duplication**: {{SERVICES}} in ONE prompt only (Constitution compliance)
4. **Add Specialist Tone Rules**: Each agent owns its dialogue style
5. **Validate Workspace Backup**: Ensure export/import works with workspaceId isolation

### Success Criteria

- ✅ Router ≤ 3,500 tokens (from 8,000)
- ✅ {{SERVICES}} in Product & Services Search Agent ONLY
- ✅ Zero variable duplication violations
- ✅ All user flows work identically (transparent refactoring)
- ✅ Workspace backup/restore verified with workspaceId folders
- ✅ Temperature parameter in Product & Services Search Agent seed

---

## 🏗️ Technical Context

### Stack

**Backend**:

- LLM Provider: OpenRouter (GPT-4-mini)
- Agents: 6 total (Router, ProductSearch, Cart, OrderTracking, Support, Safety)
- Prompts: Markdown files in `docs/prompts/`
- Seed: TypeScript in `backend/prisma/data/defaultAgents.ts`
- Database: PostgreSQL + Prisma ORM

**Prompt Architecture**:

- Current: Router has {{SERVICES}} + dialogue rules (8k tokens)
- Target: Router pure orchestration (3k tokens), ProductSearch unified (60k tokens)

### Dependencies

- Prisma Client (database access)
- OpenRouter API (LLM provider)
- Markdown files (prompt storage)
- Seed scripts (database initialization)

---

## ⚖️ Constitution Check

### Relevant Principles

**Principle I - Database-First** ✅

- All prompts loaded from `agentConfig` table
- No hardcoded prompt fallbacks
- Markdown files → database via seed script

**Principle III - Variable Uniqueness** ❌ VIOLATED (will fix)

- Current: {{SERVICES}} in 2 prompts (Router + ProductSearch)
- Target: {{SERVICES}} in 1 prompt (Product & Services Search Agent only)

**Principle V - 360-Degree Thinking** ✅

- Full stack: Markdown → Seed → Database → LLM Service
- Changes propagate through entire chain

**Principle VIII - Multi-Agent Architecture** ⚠️ PARTIAL

- Current: Router has dialogue rules (architectural confusion)
- Target: Clean separation (Router = orchestration, Specialists = dialogue)

### Gate Evaluation

**CRITICAL GATES**:

- [ ] Variable duplication eliminated (Principle III compliance)
- [ ] Router token count ≤ 3,500 (architectural purity)
- [ ] Zero user flow regression (transparent refactoring)
- [ ] Workspace backup isolated by workspaceId

**SHOULD GATES**:

- [ ] Temperature parameter added to Product & Services Search Agent
- [ ] Specialist tone rules enriched
- [ ] Token savings ≥ 10,000/request

---

## 📊 Phase Overview

| Phase       | Focus                     | Duration  | Risk   |
| ----------- | ------------------------- | --------- | ------ |
| **Phase 0** | Research & Validation     | 1-2 hours | Low    |
| **Phase 1** | Router Cleanup            | 2-3 hours | Low    |
| **Phase 2** | ProductSearch Unification | 3-4 hours | Medium |
| **Phase 3** | Specialist Enrichment     | 1-2 hours | Low    |
| **Phase 4** | Seed & Database Update    | 1-2 hours | Medium |
| **Phase 5** | Testing & Validation      | 2-3 hours | Low    |

**Total**: 8-12 hours

---

## 🔬 Phase 0: Research & Validation (1-2 hours)

### Objectives

1. Validate current workspace backup/restore functionality
2. Confirm export creates workspaceId-isolated folders
3. Audit current agent configurations
4. Document current token counts

### Tasks

#### Task 0.1: Audit Workspace Backup Scripts

**Action**: Verify export/import database backup system

**Investigation Points**:

- Does export create `prisma/backups/{workspaceId}/` folders?
- Does import restore from correct workspace folder?
- Are workspaceId references preserved?

**Files to Check**:

- `backend/scripts/export-db-to-seed.ts`
- `backend/package.json` (db:export, db:backup commands)
- `backend/prisma/backups/` directory structure

**Acceptance Criteria**:

- [ ] Export creates `prisma/backups/{workspaceId}/data/` folder
- [ ] Import restores from workspace-specific folder
- [ ] WorkspaceId isolation verified

**If Not Working**: Create workspace backup scripts in Phase 4

---

#### Task 0.2: Measure Current Token Counts

**Action**: Calculate baseline token counts per agent

**Method**:

```bash
cd docs/prompts
wc -w router-agent.md  # Approximate tokens (1 word ≈ 1.3 tokens)
wc -w product-search-agent.md
wc -w cart-management-agent.md
# ... etc
```

**Document In**: `specs/prompt-architecture-refactoring/token-baseline.md`

**Expected Results**:

- Router: ~6,000 words = ~8,000 tokens
- ProductSearch: ~40,000 words = ~55,000 tokens
- Total: ~55,000 words = ~73,500 tokens

---

#### Task 0.3: Audit Agent Configurations

**Action**: Document current agent settings in seed

**Check**:

- `backend/prisma/data/defaultAgents.ts`
- Temperature settings per agent
- availableFunctions per agent
- triggerKeywords per agent

**Questions to Answer**:

- Does ProductSearch have temperature set? (Andrea wants this)
- Which agents have temperature? Which don't?
- Are function lists up to date?

**Document In**: `specs/prompt-architecture-refactoring/agent-config-audit.md`

---

### Research Questions

**Q1**: Why does Router have {{SERVICES}} variable?
**A1**: Historical - Router used to handle service flow directly

**Q2**: Can we merge Product + Service agents safely?
**A2**: Yes - services are products with type="service", same discovery flow

**Q3**: Will removing Router dialogue rules break anything?
**A3**: No - Router never writes final responses, specialists do

---

### Deliverables

- [x] ANALYSIS.md (già creato)
- [ ] token-baseline.md
- [ ] agent-config-audit.md
- [ ] workspace-backup-status.md

---

## 🧹 Phase 1: Router Cleanup (2-3 hours)

### Objectives

1. Remove dialogue/formatting rules from Router
2. Remove {{SERVICES}} variable from Router
3. Remove service selection flow from Router
4. Reduce examples to 10 critical ones
5. Target: ≤ 3,500 tokens

### Tasks

#### Task 1.1: Create Backup of Current Prompts

**Action**:

```bash
cd docs/prompts
mkdir -p ../prompts-backup-$(date +%Y%m%d)
cp *.md ../prompts-backup-$(date +%Y%m%d)/
```

**Rollback Strategy**: Copy from backup if issues

---

#### Task 1.2: Strip Router Tone & Style Section

**File**: `docs/prompts/router-agent.md`

**Remove**:

```markdown
## 🎨 TONE & STYLE

- **Warm and professional**: friendly, positive, selected emojis 🎉😊🍝🧀🍷
- **MANDATORY**: Use customer's name in 40% of messages
- **Discount reminder**: Mention customer's discount percentage when relevant
- **Bold**: Highlight important points
- **Bad words**: "No bad words...Even kids know that! 👶😠"
- **Don't understand**: "Sorry [customer name], I didn't understand..."

**RESPONSE LANGUAGE**: English (Safety & Translation Agent will translate)
```

**Replace With**:

```markdown
## 🎯 RESPONSE LANGUAGE

Always respond in English. Safety & Translation Agent handles customer language translation.
```

**Token Savings**: ~500 tokens

---

#### Task 1.3: Remove {{SERVICES}} Variable from Router

**File**: `docs/prompts/router-agent.md`

**Remove Section**:

```markdown
### 🛠️ AVAILABLE SERVICES

{{SERVICES}}

**SERVICE SELECTION FLOW** (CRITICAL):
...
[entire service flow - ~80 lines]
```

**Replace With**:

```markdown
### 🛠️ SERVICES

Services are handled by Product & Services Search Agent.

**Delegation**:

- User: "che servizi avete?"
- Router: productSearchAgent("che servizi avete?")
```

**Token Savings**: ~2,000 tokens

---

#### Task 1.4: Remove addService() Function Definition

**File**: `docs/prompts/router-agent.md`

**Remove**:

```markdown
### 2️⃣ addService(serviceCode, quantity) - FUNCTION CALL

...
[entire function definition]
```

**Keep**: Only delegation functions (productSearchAgent, cartManagementAgent, etc.)

**Token Savings**: ~800 tokens

---

#### Task 1.5: Reduce Examples Section

**File**: `docs/prompts/router-agent.md`

**Current**: ~100 lines of examples

**Keep Only** (10 critical examples):

1. FAQ direct answer
2. Halal products → productSearchAgent (common confusion)
3. Numbered selection after list → productSearchAgent (not cart!)
4. Service question → productSearchAgent
5. "sì" confirmation → delegate to specialist who asked
6. "cancella carrello" → cartManagementAgent (immediate)
7. "ripeti ordine" → orderTrackingAgent
8. Subscribe notifications → manageNotifications (with confirm)
9. Frustration → customerSupportAgent
10. Ambiguous intent → ask clarification

**Remove**: Redundant variations, obvious mappings

**Token Savings**: ~1,500 tokens

---

#### Task 1.6: Verify Router Token Count

**Action**:

```bash
wc -w docs/prompts/router-agent.md
# Target: ≤ 2,600 words (≈ 3,500 tokens)
```

**If > 3,500 tokens**: Continue trimming examples/descriptions

---

### Deliverables

- [ ] Cleaned router-agent.md (≤ 3,500 tokens)
- [ ] Token reduction verified
- [ ] Backup created

---

## 🔄 Phase 2: Product & Services Search Agent Unification (3-4 hours)

### Objectives

1. Rename agent: "Product Search Agent" → "Product & Services Search Agent"
2. Add {{SERVICES}} variable
3. Add service discovery flow (same as products)
4. Add {{OFFERS}} variable (if not present)
5. Add temperature parameter in seed

### Tasks

#### Task 2.1: Rename Agent File

**Action**:

```bash
cd docs/prompts
mv product-search-agent.md product-services-search-agent.md
```

**Update References**:

- `backend/prisma/data/defaultAgents.ts` → filename mapping
- Any documentation referencing old name

---

#### Task 2.2: Update Agent Title & Description

**File**: `docs/prompts/product-services-search-agent.md`

**Change**:

```markdown
# Product Search Agent - System Prompt v2.0
```

**To**:

```markdown
# Product & Services Search Agent - System Prompt v3.0

## 🎯 YOUR ROLE

You are the **Product & Services Search Agent** for {{workspaceName}}.

**Mission**: Help customers discover products AND services through intelligent search, grouping, and filtering.
```

---

#### Task 2.3: Add {{SERVICES}} Variable Section

**File**: `docs/prompts/product-services-search-agent.md`

**After {{PRODUCTS}} section, add**:

```markdown
## 🛠️ AVAILABLE SERVICES

{{SERVICES}}

**Service Discovery Rules**:

- Services use SAME flow as products (grouping → list → details → cart)
- Service details format: 8 fields (name, description, price, code, availability, etc.)
- Services have quantity = 1 always (NO "quanti ne vuoi?" for services)
- Confirmation: "Vuoi aggiungerlo al carrello?" → delegate to Cart

**Examples**:

- User: "che servizi avete?" → Show numbered service list
- User: "2" → Show service details (8 fields)
- User: "sì" → cartManagementAgent("add SRV-001 qty 1")
```

---

#### Task 2.4: Add {{OFFERS}} Variable (if missing)

**Check**: Does ProductSearch currently have {{OFFERS}}?

**If NO, Add**:

```markdown
## 🎁 ACTIVE OFFERS

{{OFFERS}}

**How to Use**:

- Mention relevant offers when showing products
- Example: "Il Parmigiano DOP è in offerta -20% questa settimana!"
- Don't force offers if not relevant to query
```

---

#### Task 2.5: Unify Product + Service Flow Logic

**File**: `docs/prompts/product-services-search-agent.md`

**Section to Update**: "## 2. GROUPING STRATEGY"

**Add**:

```markdown
**Unified Discovery**:

- Products AND services use same numbered list format
- When user searches "gift" → may return products (gift boxes) + services (gift wrapping)
- Group by type if mixed results: "1. Prodotti Regalo (3), 2. Servizi Regalo (2)"
- Details view: Same 8-field format for both products and services
```

---

#### Task 2.6: Add Tone & Style Section

**File**: `docs/prompts/product-services-search-agent.md`

**Add After Role Section**:

```markdown
## 🎨 TONE & STYLE

- **Warm & Enthusiastic**: Help customers discover perfect products/services! 🛍️✨
- **Customer Name**: Use {{nameUser}} in 40% of messages
- **Discount Highlighting**: Always show ~€original~ → €discounted when {{discountUser}}% > 0
- **Product Passion**: Express genuine excitement about quality Italian products
- **Emoji Usage**: Moderate use (🛍️, 🧀, 🍷, 🎁, ✨) - don't overdo
- **Bold for Emphasis**: **Product names**, **prices**, **important details**

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

---

### Deliverables

- [ ] Renamed product-services-search-agent.md
- [ ] {{SERVICES}} variable added
- [ ] Service flow documented
- [ ] Tone & style section added
- [ ] Token count verified (target: ≤ 65,000)

---

## 🎨 Phase 3: Specialist Enrichment (1-2 hours)

### Objectives

Add tone & style sections to Cart, OrderTracking, Support agents

### Tasks

#### Task 3.1: Enrich Cart Management Agent

**File**: `docs/prompts/cart-management-agent.md`

**Add After Role Section**:

```markdown
## 🎨 TONE & STYLE

- **Clear & Efficient**: Quick cart action confirmations 🛒
- **Stock Awareness**: Warn if product has low stock ("Attenzione: solo 2 disponibili!")
- **Checkout Guidance**: Always provide cart link after successful additions
- **No Unnecessary Asks**: clearCart executes immediately (user command = confirmation)
- **Emoji Usage**: Minimal (🛒, ✅, ⚠️) - focus on clarity

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

---

#### Task 3.2: Enrich Order Tracking Agent

**File**: `docs/prompts/order-tracking-agent.md`

**Add After Role Section**:

```markdown
## 🎨 TONE & STYLE

- **Precise & Reassuring**: Clear order status, exact dates 📦
- **Professional**: Formal tone for invoices, tracking numbers
- **Timeline Clarity**: Always include delivery windows ("Consegna prevista: 18-20 Nov")
- **Confirmation Protocol**: Repeat order requires explicit "SI" (don't assume)
- **Emoji Usage**: Minimal (📦, ✅, ⏰) - professional focus

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

---

#### Task 3.3: Enrich Customer Support Agent

**File**: `docs/prompts/customer-support-agent.md`

**Add After Role Section**:

```markdown
## 🎨 TONE & STYLE

- **Empathetic & Solution-Oriented**: Acknowledge frustration, focus on resolution 🤝
- **Active Listening**: Reflect back customer's concerns ("Capisco la tua frustrazione...")
- **Urgency Awareness**: Match tone to urgency level (high = immediate action)
- **Human Touch**: Warm, understanding, not robotic
- **Emoji Usage**: Empathy emojis (🤝, 💙, 🙏) - show care

**Response Language**: English (Safety & Translation Agent translates to customer language)
```

---

### Deliverables

- [ ] Cart agent tone added
- [ ] OrderTracking agent tone added
- [ ] Support agent tone added

---

## 💾 Phase 4: Seed & Database Update (1-2 hours)

### Objectives

1. Update `defaultAgents.ts` with renamed agent
2. Add temperature parameter to Product & Services Search Agent
3. Update prompt filename mapping
4. Verify/create workspace backup scripts

### Tasks

#### Task 4.1: Update Agent Configuration in Seed

**File**: `backend/prisma/data/defaultAgents.ts`

**Change PRODUCT_SEARCH to PRODUCT_SERVICES_SEARCH**:

```typescript
// OLD
const AGENT_FILENAME_MAP: Partial<Record<AgentType, string>> = {
  ROUTER: "router-agent.md",
  PRODUCT_SEARCH: "product-search-agent.md", // ❌ OLD
  // ...
}

// NEW
const AGENT_FILENAME_MAP: Partial<Record<AgentType, string>> = {
  ROUTER: "router-agent.md",
  PRODUCT_SEARCH: "product-services-search-agent.md", // ✅ NEW
  // ...
}
```

---

#### Task 4.2: Add Temperature to Product & Services Search

**File**: `backend/prisma/data/defaultAgents.ts`

**In defaultAgents array**:

```typescript
{
  name: "Product & Services Search Agent", // ✅ Updated name
  type: "PRODUCT_SEARCH" as AgentType,
  systemPrompt: loadPrompt("product-services-search-agent.md"),
  triggerKeywords: [
    "search",
    "find",
    "product",
    "service",
    "catalog",
    "category",
    "halal",
    "bio",
    "organic",
    "vegan",
    "dop",
    "igp",
  ],
  availableFunctions: null,
  temperature: 0.3, // ✅ NEW - Andrea's request
  contextWindow: 3, // Existing - last 3 messages
},
```

**Rationale**: Temperature 0.3 balances consistency (product search) with creativity (grouping/suggestions)

---

#### Task 4.3: Update Agent Descriptions

**File**: `backend/prisma/data/defaultAgents.ts`

```typescript
const AGENT_DESCRIPTIONS: Partial<Record<AgentType, string>> = {
  ROUTER:
    "Router Agent - Intent classification and delegation to specialist agents",
  PRODUCT_SEARCH:
    "Product & Services Search Agent - Unified discovery for products and services with intelligent grouping", // ✅ Updated
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

---

#### Task 4.4: Verify/Create Workspace Backup Scripts

**Check If Exists**:

```bash
ls backend/scripts/ | grep -i backup
```

**If NOT exists, Create**:

**File**: `backend/scripts/export-workspace-backup.ts`

```typescript
/**
 * EXPORT WORKSPACE BACKUP
 *
 * Creates workspace-isolated backup in prisma/backups/{workspaceId}/
 *
 * Usage: npx ts-node scripts/export-workspace-backup.ts {workspaceId}
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function exportWorkspaceBackup(workspaceId: string) {
  const backupDir = path.join(__dirname, `../prisma/backups/${workspaceId}`)

  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  console.log(`📦 Exporting workspace ${workspaceId}...`)

  // Export workspace data
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      products: true,
      categories: true,
      services: true,
      customers: true,
      // ... all related tables
    },
  })

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`)
  }

  // Write to JSON
  const backupFile = path.join(backupDir, "workspace-backup.json")
  fs.writeFileSync(backupFile, JSON.stringify(workspace, null, 2))

  console.log(`✅ Backup created: ${backupFile}`)
}

// CLI
const workspaceId = process.argv[2]
if (!workspaceId) {
  console.error(
    "Usage: npx ts-node scripts/export-workspace-backup.ts {workspaceId}"
  )
  process.exit(1)
}

exportWorkspaceBackup(workspaceId).finally(() => prisma.$disconnect())
```

**File**: `backend/scripts/restore-workspace-backup.ts` (similar structure)

**Add to package.json**:

```json
{
  "scripts": {
    "workspace:backup": "ts-node scripts/export-workspace-backup.ts",
    "workspace:restore": "ts-node scripts/restore-workspace-backup.ts"
  }
}
```

---

### Deliverables

- [ ] defaultAgents.ts updated with new filename
- [ ] Temperature 0.3 added to Product & Services Search
- [ ] Agent name updated: "Product & Services Search Agent"
- [ ] Workspace backup scripts created (if not exist)
- [ ] package.json scripts added

---

## ✅ Phase 5: Testing & Validation (2-3 hours)

### Objectives

1. Reseed database with new prompts
2. Test all user flows manually
3. Verify token counts
4. Constitution compliance audit
5. Workspace backup/restore test

### Tasks

#### Task 5.1: Reseed Database

**Action**:

```bash
cd backend
npm run seed
```

**Verify**:

- [ ] No errors in seed output
- [ ] All 6 agents created
- [ ] Product & Services Search Agent has temperature 0.3
- [ ] Prompts loaded correctly from markdown files

---

#### Task 5.2: Manual WhatsApp Flow Testing

**Test Scenarios** (via WhatsApp or MCP test):

1. **Product Search**:

   - "avete prodotti halal?" → Should show numbered list
   - "2" → Should show product details
   - "sì" → Should add to cart

2. **Service Search**:

   - "che servizi avete?" → Should show numbered service list
   - "1" → Should show service details (8 fields)
   - "sì" → Should add to cart

3. **Cart Operations**:

   - "mostra carrello" → Should show cart link
   - "cancella carrello" → Should clear immediately (no "sei sicuro?")

4. **Order Repeat**:

   - "ripeti ultimo ordine" → Should show summary + ask confirmation
   - "SI" → Should execute RepeatOrder()

5. **FAQ**:

   - "orari?" → Router should answer directly (no delegation)

6. **Confirmation Flow**:
   - ProductSearch shows details → User says "sì" → Should delegate to Cart with product code

**Document Results**: `specs/prompt-architecture-refactoring/test-results.md`

---

#### Task 5.3: Token Count Verification

**Measure New Token Counts**:

```bash
cd docs/prompts
wc -w router-agent.md  # Target: ≤ 2,600 words
wc -w product-services-search-agent.md  # Target: ≤ 48,000 words
```

**Compare to Baseline**:

- Router: 6,000 → 2,600 words ✅ (-56%)
- ProductSearch: 40,000 → 48,000 words ⚠️ (+20% but justified - added services)
- **Net**: -8,000 words = -10,000 tokens ✅

**Calculate Savings**:

- 10,000 tokens × $0.15/1M × 1000 req/day × 365 days = $547/year ✅

---

#### Task 5.4: Constitution Compliance Audit

**Run**: `/speckit.analyze` on `specs/prompt-architecture-refactoring/`

**Check**:

- [ ] Principle III: {{SERVICES}} in ONE prompt only ✅
- [ ] Principle VIII: Router = orchestration, Specialists = dialogue ✅
- [ ] Variable distribution verified
- [ ] No CRITICAL findings

---

#### Task 5.5: Workspace Backup/Restore Test

**Test Backup**:

```bash
cd backend
npm run workspace:backup cm9hjgq9v00014qk8fsdy4ujv  # Main workspace ID
```

**Verify**:

- [ ] Created `prisma/backups/cm9hjgq9v00014qk8fsdy4ujv/`
- [ ] JSON file contains workspace data
- [ ] WorkspaceId preserved in all records

**Test Restore**:

```bash
npm run workspace:restore cm9hjgq9v00014qk8fsdy4ujv
```

**Verify**:

- [ ] Workspace data restored correctly
- [ ] No cross-workspace contamination

---

### Deliverables

- [ ] Database reseeded successfully
- [ ] All 6 test scenarios pass
- [ ] Token counts verified (≥10k reduction)
- [ ] Constitution audit passes
- [ ] Workspace backup/restore working

---

## 🎯 Success Criteria Checklist

### Must Have (P0)

- [ ] Router ≤ 3,500 tokens (from 8,000)
- [ ] {{SERVICES}} in Product & Services Search Agent ONLY
- [ ] Agent renamed: "Product & Services Search Agent"
- [ ] Temperature 0.3 added to Product & Services Search
- [ ] All user flows work identically (6 scenarios tested)
- [ ] Zero variable duplication (Constitution Principle III)
- [ ] Workspace backup creates workspaceId folders

### Should Have (P1)

- [ ] Tone & style added to Cart, OrderTracking, Support
- [ ] Examples reduced to ≤ 10 per agent
- [ ] Token savings ≥ 10,000/request
- [ ] Confirmation logic in ≤ 2 places

### Nice to Have (P2)

- [ ] Automated prompt validation script
- [ ] CI/CD check for variable duplication
- [ ] Architecture diagrams updated

---

## 🔄 Rollback Strategy

### If Issues in Phase 1-3 (Prompt Changes)

**Action**:

```bash
cd docs/prompts
cp ../prompts-backup-YYYYMMDD/*.md .
```

**Then**:

```bash
cd backend
npm run seed  # Reload old prompts
```

---

### If Issues in Phase 4 (Seed Changes)

**Action**:

```bash
cd backend/prisma/data
git checkout HEAD -- defaultAgents.ts
npm run seed
```

---

### If Database Corrupted

**Action**:

```bash
cd backend
npm run workspace:restore {workspaceId}
```

---

## 📊 Risk Assessment

| Risk                        | Probability | Impact | Mitigation                                   |
| --------------------------- | ----------- | ------ | -------------------------------------------- |
| User flow regression        | Medium      | High   | Manual testing all 6 scenarios before deploy |
| Variable duplication missed | Low         | High   | Grep validation, Constitution audit          |
| Token count exceeds target  | Low         | Medium | Progressive measurement, trim if needed      |
| Workspace backup broken     | Medium      | High   | Test backup/restore in Phase 5               |
| Seed script errors          | Low         | High   | Backup current seed, test thoroughly         |

---

## 📅 Timeline

**Day 1** (4-6 hours):

- Phase 0: Research & validation
- Phase 1: Router cleanup
- Phase 2: ProductSearch unification (start)

**Day 2** (4-6 hours):

- Phase 2: ProductSearch unification (complete)
- Phase 3: Specialist enrichment
- Phase 4: Seed update
- Phase 5: Testing & validation

**Total**: 8-12 hours over 1-2 days

---

## 🎯 Next Steps

1. **Get Andrea's Approval** on this plan
2. **Create Tasks Breakdown** (`tasks.md`)
3. **Execute Phase 0** (research & validation)
4. **Proceed Phase by Phase** with testing between each

---

**Status**: ✅ PLAN COMPLETE - READY FOR TASK CREATION  
**Created By**: AI Coding Agent  
**Date**: 2025-11-15  
**Version**: 1.0.0
