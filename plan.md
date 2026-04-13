# Plan: Refactor Boolean → Enum ChannelMode (ECOMMERCE | INFORMATIONAL | FLOW)

## TL;DR
Replace `sellsProductsAndServices: Boolean @default(true)` (schema line 98) with `channelMode: ChannelMode @default(INFORMATIONAL)` enum across the entire stack. ~200 references in ~60 files across 9 phases. Flow pipeline is OUT OF SCOPE — only 3-type isolation infrastructure. Also fix 10 bugs/inconsistencies found during analysis.

## Impact Assessment
- **200+ references** to `sellsProductsAndServices` across codebase
- **28** hardcoded `?? true` defaults (CRITICAL silent fallback risk)
- **43** `isEcommerce` variable usages, **18** `isInformational` usages
- **23** test files need mock updates (100+ individual matches)
- **7** Prisma SELECT queries need `channelMode` added
- **6** backoffice references
- **~60 files** total modifications

## Decisions (confirmed with Andrea)

| Decision | Value | Rationale |
|----------|-------|-----------|
| Default value | `INFORMATIONAL` | Andrea's explicit choice — most new channels are informational |
| Flow behavior | Identical to Informational | Pipeline developed later — only isolation infrastructure now |
| Widget constraint | INFORMATIONAL + FLOW ✅, ECOMMERCE ❌ | Existing constraint preserved, Flow gets widget access |
| Backward compat | NO deprecated field | Clean cut — old boolean removed in migration |
| Agent cleanup on type change | DELETE old agents | FIX BUG-1 — no more orphaned agents |
| Cart template | Fix to correct file | FIX BUG-2 — was loading wrong template |
| Orphaned PRODUCT_CONTEXT/ORDER_OPTIMIZATION | DELETE — confirmed dead code | Andrea confirmed: eliminate templates + array refs |
| Helper functions | Inline in `template-path.helper.ts` | No separate `channel-mode.helper.ts` file needed |
| Flow templates | Separate `flow/` directory | Andrea wants things divided to avoid coupling |
| FlowWorkspaceStrategy | Separate file | Andrea prefers separation to avoid issues across code |
| Test file renames | Only if needed, content update priority | Avoid git history loss |
| Swagger | NOT APPLICABLE | Project doesn't use swagger |

---

## 🐛 BUGS & CLEANUP FOUND DURING ANALYSIS (Fix During Refactor)

### BUG-1 🔴 CRITICAL: `resetDefaultAgentPrompts()` doesn't delete old agents
- **File**: `apps/backend/src/application/services/workspace.service.ts` lines 215-251
- **Problem**: When type changes (ecommerce↔informational), uses `upsert` only. ROUTER, PRODUCT_SEARCH, ORDER_TRACKING, CART_MANAGEMENT agents remain as orphaned DB records after switching
- **Fix**: After upsert loop, DELETE agents that don't belong to new type: `DELETE FROM agentConfig WHERE workspaceId=? AND type NOT IN (validTypes)`

### BUG-2 🔴 Cart Management Agent uses WRONG template
- **File**: `apps/backend/prisma/data/dynamicAgents.ts` line 241
- **Problem**: `loadTemplate("PRODUCT_SEARCH", hasEcommerce)` — loads PRODUCT_SEARCH template for Cart agent. Comment says "Cart uses same base" but separate `03-cart-management.template.md` exists
- **Fix**: Change to `loadTemplate("CART_MANAGEMENT", hasEcommerce)`

### BUG-3 🟡 workspace-checklist.service.ts wrong default
- **File**: `apps/backend/src/application/services/workspace-checklist.service.ts` line 131
- **Problem**: `workspace.sellsProductsAndServices ?? false` — uses `false` while schema default is `true` and ALL other 27 locations use `?? true`
- **Fix**: Will become `workspace.channelMode` — no more ?? needed

### BUG-4 🟡 Agent Service hardcoded hidden types
- **File**: `apps/backend/src/application/services/agent.service.ts` lines 16-21
- **Problem**: `infoHiddenTypes` hardcoded Set with 5 types. PROFILE_MANAGEMENT listed but also exists for informational. Fragile to new agents
- **Fix**: Use `ECOMMERCE_ONLY_AGENTS` from template-path.helper instead of hardcoding

### BUG-5 🟡 Orphaned PRODUCT_CONTEXT & ORDER_OPTIMIZATION agents — DELETE
- **File**: `apps/backend/src/utils/template-path.helper.ts` line 39
- **Problem**: Listed in `ECOMMERCE_TEMPLATE_FILES` and `ECOMMERCE_ONLY_AGENTS`, template files exist (`09-product-context.template.md`, `10-order-optimization.template.md`), but `dynamicAgents()` NEVER creates these agents
- **Fix**: Remove from arrays + delete orphaned template files (Andrea confirmed: dead code, eliminate)

### BUG-6 🟡 ECOMMERCE_ONLY_AGENTS list mismatch
- **File**: `apps/backend/src/utils/template-path.helper.ts` line 39
- **Problem**: Array has 8 agents but only 6 are actually created by dynamicAgents(). Includes PRODUCT_CONTEXT and ORDER_OPTIMIZATION which are never instantiated
- **Fix**: Align with what actually gets created (resolved together with BUG-5)

### BUG-7 🟡 Inconsistent widget error messages
- **File**: `apps/backend/src/application/services/workspace.service.ts` lines 351 and 630
- **Problem**: create() says "Widget channel cannot be enabled for e-commerce workspaces..." while update() says "Cannot enable widget for e-commerce workspaces..."  
- **Fix**: Extract shared validation, consistent messages

### CLEANUP-1: OnboardingWizardModal TOTP dead code
- **File**: `apps/frontend/src/components/OnboardingWizardModal.tsx` lines ~120-130
- **Problem**: `totpQrCode`, `isNewUser`, `totpCode` states defined but never used. Auth calls `skipSetup: true`
- **Fix**: Remove unused TOTP vars and 'totp' from WizardStep type

### CLEANUP-2: Sidebar debug console.log
- **File**: `apps/frontend/src/components/layout/Sidebar.tsx` line 49
- **Problem**: `console.log("🔍 sellsProductsAndServices:", ...)` left in production code
- **Fix**: Remove debug log

---

## Phase 1: Database Schema + Migration ⛔ BLOCKING

**Difficulty**: LOW — Standard Prisma migration
**Risk**: Data migration SQL must handle NULL values correctly

### Steps
1. Add enum to `packages/database/prisma/schema.prisma` (after line ~1100, near other enums):
   ```
   enum ChannelMode {
     ECOMMERCE
     INFORMATIONAL
     FLOW
   }
   ```
2. Add field to Workspace model (replace line 98):
   - Remove: `sellsProductsAndServices Boolean @default(true)`
   - Add: `channelMode ChannelMode @default(INFORMATIONAL)`
3. Create migration: `npx prisma migrate dev --name replace_sells_boolean_with_channel_mode`
4. Migration SQL must include data backfill:
   ```sql
   -- Add enum
   CREATE TYPE "ChannelMode" AS ENUM ('ECOMMERCE', 'INFORMATIONAL', 'FLOW');
   -- Add column
   ALTER TABLE "Workspace" ADD COLUMN "channelMode" "ChannelMode" NOT NULL DEFAULT 'INFORMATIONAL';
   -- Backfill from boolean
   UPDATE "Workspace" SET "channelMode" = CASE
     WHEN "sellsProductsAndServices" = true THEN 'ECOMMERCE'::"ChannelMode"
     ELSE 'INFORMATIONAL'::"ChannelMode"
   END;
   -- Drop old column
   ALTER TABLE "Workspace" DROP COLUMN "sellsProductsAndServices";
   ```
5. Run `npx prisma generate`

### Files Modified
- `packages/database/prisma/schema.prisma` — add enum (new block), modify Workspace model (line 98)

### Verification
- `npx prisma generate` succeeds
- `npx prisma migrate dev` runs without errors
- SQL: `SELECT "channelMode", COUNT(*) FROM "Workspace" GROUP BY 1` shows correct distribution

---

## Phase 2: Backend Helper Layer ⛔ BLOCKING (for Phases 3-7)

**Difficulty**: LOW — Pure utility functions
**Risk**: None — updating existing file

### Steps
1. Update `apps/backend/src/utils/template-path.helper.ts`:
   - Add helper functions inline: `isEcommerce(w)`, `isInformational(w)`, `isFlow(w)`
   - `getTemplateFolder(isEcommerce: boolean)` → `getTemplateFolder(mode: ChannelMode)` — add FLOW case
   - `getTemplateFilename(agentType, isEcommerce)` → `getTemplateFilename(agentType, mode)`
   - `isEcommerceOnlyAgent(type)` → keep
   - Add `FLOW_TEMPLATE_FILES` array
   - **FIX BUG-5**: Remove PRODUCT_CONTEXT and ORDER_OPTIMIZATION from `ECOMMERCE_TEMPLATE_FILES` and `ECOMMERCE_ONLY_AGENTS` + delete orphaned template files
   - **FIX BUG-6**: Align `ECOMMERCE_ONLY_AGENTS` with what dynamicAgents() actually creates

### Files Modified
- `apps/backend/src/utils/template-path.helper.ts` — add helpers, fix BUG-5/6
- DELETE `apps/backend/src/templates/ecommerce/09-product-context.template.md`
- DELETE `apps/backend/src/templates/ecommerce/10-order-optimization.template.md`

### Verification
- Import helper in a test, verify `isEcommerce({ channelMode: 'ECOMMERCE' })` returns true
- `getTemplateFolder('FLOW')` returns `'flow'`

---

## Phase 3: Strategy Pattern + LLM Orchestration ‖ parallel with Phase 4

**Difficulty**: MEDIUM — Core routing logic, many references
**Risk**: Breaking LLM routing would break ALL chat. Must test thoroughly

### Steps
1. Create `apps/backend/src/strategies/flow-workspace.strategy.ts`:
   - `canHandle(w)`: `w.channelMode === 'FLOW'`  
   - `route()`: Initially identical to InformationalWorkspaceStrategy body (placeholder)

2. Update `apps/backend/src/strategies/ecommerce-workspace.strategy.ts` (line 35-37):
   - FROM: `workspace.sellsProductsAndServices === true`
   - TO: `workspace.channelMode === 'ECOMMERCE'`

3. Update `apps/backend/src/strategies/informational-workspace.strategy.ts` (line 48-50):
   - FROM: `workspace.sellsProductsAndServices === false`
   - TO: `workspace.channelMode === 'INFORMATIONAL'`

4. Update `apps/backend/src/strategies/routing-strategy.interface.ts`:
   - RoutingContext.workspace type should include `channelMode` field

5. Register FlowWorkspaceStrategy in `apps/backend/src/services/router-orchestration.service.ts`:
   - Add to strategies array: `new FlowWorkspaceStrategy(...)`

6. Update `apps/backend/src/services/llm-router.service.ts` (~20 changes):
   - Line 846: `isInformational = workspace?.sellsProductsAndServices === false` → `isInformational = isInformational(workspace)`
   - All `workspace?.sellsProductsAndServices` → use helper functions
   - Line 867: Agent type selection — use `channelMode`
   - Line 943: Main agent type — use `channelMode`
   - Line 1266: E-commerce function filtering — use `isEcommerce()`
   - Line 1520: ConversationHistory layer — use `isEcommerce()`
   - **Pattern**: Replace every `workspace?.sellsProductsAndServices === false` → `isInformational(workspace)` and `=== true` → `isEcommerce(workspace)`

7. Update `apps/backend/src/application/chat-engine/chat-engine.service.ts`:
   - Replace boolean checks → helper functions
   - `chat-engine.types.ts`: Replace `sellsProductsAndServices?: boolean` → `channelMode: ChannelMode`

8. Update `apps/backend/src/config/agent-functions.ts`:
   - `getFunctionsForRouter({ channelMode })` instead of `{ sellsProductsAndServices }`

9. Update `apps/backend/src/config/agent-functions.config.ts`:
   - `getAgentFunctionsForWorkspace()` — use `channelMode` for array selection

10. Update `apps/backend/src/constants/system-functions.ts`:
    - Ensure exported arrays (`ECOMMERCE_FUNCTIONS`, `ALL_INFO_FUNCTIONS`) work with new mode
    - Add `ALL_FLOW_FUNCTIONS` (initially = `ALL_INFO_FUNCTIONS`)

### Files Modified
- `apps/backend/src/strategies/flow-workspace.strategy.ts` — NEW
- `apps/backend/src/strategies/ecommerce-workspace.strategy.ts` — update canHandle (line 35)
- `apps/backend/src/strategies/informational-workspace.strategy.ts` — update canHandle (line 48)
- `apps/backend/src/strategies/routing-strategy.interface.ts` — docs update
- `apps/backend/src/services/router-orchestration.service.ts` — register flow
- `apps/backend/src/services/llm-router.service.ts` — ~20 changes
- `apps/backend/src/application/chat-engine/chat-engine.service.ts` — ~5 changes
- `apps/backend/src/application/chat-engine/chat-engine.types.ts` — type change
- `apps/backend/src/config/agent-functions.ts` — signature change
- `apps/backend/src/config/agent-functions.config.ts` — type check update
- `apps/backend/src/constants/system-functions.ts` — add FLOW functions

### Verification
- Strategy selection: E-commerce workspace → EcommerceWorkspaceStrategy
- Strategy selection: Informational workspace → InformationalWorkspaceStrategy
- Strategy selection: Flow workspace → FlowWorkspaceStrategy
- LLM routing: send message to each type → correct pipeline executes

---

## Phase 4: Backend Services + Controllers ‖ parallel with Phase 3

**Difficulty**: HIGH — Most changes, touches critical business logic
**Risk**: workspace.service.ts handles create/update/sync — bugs here affect all workspaces

### Steps

#### 4A: Workspace Service (CRITICAL — ~15 changes)
File: `apps/backend/src/application/services/workspace.service.ts`

1. `create()` method:
   - Accept `channelMode: ChannelMode` param instead of `sellsProductsAndServices: boolean`
   - Default: `channelMode ?? 'INFORMATIONAL'`
   - Widget constraint: allowed for INFORMATIONAL + FLOW, blocked for ECOMMERCE
   - **FIX BUG-7**: Extract widget validation to shared method with consistent error messages

2. `update()` method:
   - Detect type changes: `if (data.channelMode && data.channelMode !== existing.channelMode)`
   - Trigger `syncSystemCallingFunctions()` + `resetDefaultAgentPrompts()` on change
   - Widget constraint: same shared validation

3. `syncSystemCallingFunctions()`:
   - Use `channelMode` to determine which functions to enable/disable
   - Replace `ECOMMERCE_ONLY_FN_NAMES` logic with mode-based approach

4. `resetDefaultAgentPrompts()`:
   - **FIX BUG-1 (CRITICAL)**: After upsert loop, DELETE old agents that don't belong to new type
   - Use `getValidAgentTypesForMode(channelMode)` from helper
   - Pattern: `prisma.agentConfig.deleteMany({ where: { workspaceId, type: { notIn: validTypes } } })`

5. All `workspace.sellsProductsAndServices ?? true` references → use `workspace.channelMode`
   - **FIX BUG-3**: workspace-checklist no longer needs `?? false/true`, enum is explicit

#### 4B: Agent Service
File: `apps/backend/src/application/services/agent.service.ts` (lines 16-21)
- **FIX BUG-4**: Replace hardcoded `infoHiddenTypes` Set with dynamic lookup from `getValidAgentTypesForMode()`
- Pattern: hide agents whose type is NOT in the valid set for current channelMode

#### 4C: Prompt/Template Services (~8 files)
- `apps/backend/src/services/prompt-processor.service.ts` — `channelMode` instead of boolean
- `apps/backend/src/application/services/prompt-render.service.ts` — update template loading
- `apps/backend/src/application/services/template-loader.service.ts` — use `channelMode`
- `apps/backend/src/application/services/prompt-variable-builder.service.ts` — update type
- `apps/backend/src/application/services/prompt-builder/variable-resolver.service.ts`
- `apps/backend/src/application/services/prompt-builder/prompt-builder.service.ts`
- `apps/backend/src/types/prompt-variables.types.ts` — `channelMode: ChannelMode`
- `apps/backend/src/types/agent.types.ts` — update workspace type

#### 4D: Workspace Checklist Service
File: `apps/backend/src/application/services/workspace-checklist.service.ts` (line 131)
- Replace `workspace.sellsProductsAndServices ?? false` → `workspace.channelMode`
- Type-specific checklist items based on mode
- **FIX BUG-3** automatically resolved

#### 4E: Orchestration Services (~4 files)
- `apps/backend/src/application/orchestration/orchestration.service.ts`
- `apps/backend/src/application/orchestration/types.ts`
- `apps/backend/src/application/orchestration/parallel-loader.service.ts`
- `apps/backend/src/application/orchestration/content-mixer.service.ts`

#### 4F: Controllers (~5 files) + CRUD API Security
- `apps/backend/src/interfaces/http/controllers/workspace.controller.ts`:
  - `create()`: accept `channelMode` instead of `sellsProductsAndServices`, return `channelMode`
  - `update()`: accept `channelMode`, validate enum value
  - **SECURITY**: Validate `channelMode` is one of `['ECOMMERCE', 'INFORMATIONAL', 'FLOW']` — reject any other value with 400
  - **SECURITY**: Prevent FLOW creation if feature not enabled (future-proof gate)
- `apps/backend/src/interfaces/http/controllers/agent-config.controller.ts` — use `channelMode`
- `apps/backend/src/interfaces/http/controllers/calling-functions.controller.ts`
- `apps/backend/src/interfaces/http/controllers/platform-config.controller.ts`
- `apps/backend/src/interfaces/http/controllers/widget-embed.controller.ts`

#### 4G: Agents
- `apps/backend/src/application/agents/CustomerSupportAgentLLM.ts` — line 150: use `channelMode` instead of `isEcommerce ? "CUSTOMER_SUPPORT" : "INFO_AGENT"`

#### 4H: Repositories
- `apps/backend/src/repositories/workspace.repository.ts` — add `channelMode` to all SELECT queries (7 queries need update)

#### 4I: Function Executor
- `apps/backend/src/services/function-executor.service.ts` — type check update

#### 4J: Seed Data
- `packages/database/prisma/seed.ts` — set `channelMode` per workspace instead of `sellsProductsAndServices`
- `apps/backend/prisma/data/dynamicAgents.ts`:
  - Accept `channelMode: ChannelMode` instead of boolean
  - **FIX BUG-2**: Change `loadTemplate("PRODUCT_SEARCH", ...)` → `loadTemplate("CART_MANAGEMENT", ...)` for Cart agent (line 241)
- `apps/backend/prisma/data/defaultAgents.ts` — update if exists

### Files Modified
~25 files total (listed above)

### Verification
- Create workspace with each channelMode → correct agents created
- Change workspace type → old agents deleted, new agents created (BUG-1 fix)
- Cart agent → loads correct template (BUG-2 fix)
- Workspace checklist → correct behavior regardless of mode

---

## Phase 5: Templates ‖ parallel with Phase 4

**Difficulty**: LOW — Copy files
**Risk**: None — new directory, no existing behavior changed

### Steps
1. Create `apps/backend/src/templates/flow/` directory
2. Copy informational templates as starting point:
   - `01-flow-agent.template.md` (copy of `01-info-agent.template.md`)
   - `02-security.template.md`
   - `03-translation.template.md`
   - `04-summary.template.md`
   - `05-conversation-history.template.md`
   - `06-profile-management.template.md`
3. Update `template-path.helper.ts` with `FLOW_TEMPLATE_FILES` array (done in Phase 2)

### Files Modified
- `apps/backend/src/templates/flow/` — NEW directory with 6 files

---

## Phase 6: Frontend ‖ parallel with Phase 4-5

**Difficulty**: MEDIUM — Many UI files, but pattern is straightforward find/replace
**Risk**: Breaking conditional rendering could hide menu items or show wrong UI

### Steps

#### 6A: API Types
File: `apps/frontend/src/services/workspaceApi.ts`
- Add to Workspace interface: `channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'`
- Remove `sellsProductsAndServices: boolean`
- Update `CreateWorkspaceData`, `UpdateWorkspaceData`

#### 6B: Workspace Context
File: `apps/frontend/src/contexts/WorkspaceContext.tsx`
- Add `channelMode` to Workspace type interface
- Remove `sellsProductsAndServices`

#### 6C: New Channel Wizard (IMPORTANT — MAJOR RESTRUCTURE)
File: `apps/frontend/src/components/OnboardingWizardModal.tsx`

**Step order change**: `channelMode` becomes the FIRST question in the wizard.
- OLD flow: `industry → business → channel-personality → workspace-type → channel-type → human-support → auth`
- NEW flow: `channel-mode → industry → business → channel-personality → channel-type → human-support → auth`

Changes:
- Rename step `'workspace-type'` → `'channel-mode'` and move to position 1
- Update `DATA_STEPS` array order
- Recalculate `STEP_PROGRESS` percentages for new order
- Update `STEP_IMAGES` — assign image for new step 1 (reuse `survey-ecommerce.png` or new)
- Update `STEP_ICONS` — assign icon for `channel-mode`
- Update prev/next navigation logic (back/forward functions)
- 3 radio buttons: E-commerce / Informational / Flow (was 2: ecommerce/info)
- Update `onboardingWizardTranslations.ts` — add Flow option with label/desc/emoji
- Add `WORKSPACE_TYPE_EMOJI` entry for `'flow'`
- Replace `sellsProductsAndServices: workspaceType === 'ecommerce'` → `channelMode` in createWorkspace call (line 182)
- Widget constraint: if `channelMode === 'ECOMMERCE'` → `channel-type` step hides widget/both options
- Remove `workspaceType` state → use `channelMode` state
- **CLEANUP-1**: Remove unused TOTP dead code (totpQrCode, isNewUser, totpCode states, 'totp' step)

File: `apps/frontend/src/components/onboardingWizardTranslations.ts`
- Add `'flow'` to `WorkspaceType` type
- Add Flow translations (label, desc) for all languages
- Add `WORKSPACE_TYPE_EMOJI` for flow

#### 6D: Settings Page
File: `apps/frontend/src/pages/SettingsPage.tsx` (lines 292, 515, 1069)
- Replace Switch toggle → Select/Dropdown with 3 options
- Line 292: Initial form value → use `channelMode`
- Line 515: Toggle handler → Select onChange handler
- Line 1069: Confirmation dialog → update text for 3-way change
- Keep cascading effects (reset agents, sync functions)

#### 6E: BusinessConfigSection
File: `apps/frontend/src/components/settings/sections/BusinessConfigSection.tsx`
- Replace ecommerce toggle → Select component

#### 6F: Layout Components
- `apps/frontend/src/components/layout/Sidebar.tsx`:
  - Line 49: **CLEANUP-2** — remove `console.log("🔍 sellsProductsAndServices:", ...)`
  - Line 109: `workspace?.sellsProductsAndServices === true` → `workspace?.channelMode === 'ECOMMERCE'`
  - Line 146: Appointment booking condition → update for 3 types
  - Line 152: Sales agents condition → update
  - Line 230: Badge label → show `channelMode` value (or mapped label)

- `apps/frontend/src/components/layout/Header.tsx`:
  - Line 258: Orders button → `channelMode === 'ECOMMERCE'`
  - Line 282: FAQ/Support button → `channelMode !== 'ECOMMERCE'` (show for INFO and FLOW)
  - Line 293: Sales contact → update condition

- `apps/frontend/src/components/layout/MinimalLayout.tsx` — navigation update

#### 6G: Display Components
- `apps/frontend/src/pages/ChatPage.tsx` line 1205: Badge → show `channelMode`
- `apps/frontend/src/pages/WorkspaceSelectionPage.tsx`:
  - Lines 66, 204, 952, 966, 985, 1544, 1553, 1628, 1892, 1967, 2045-2074 — ALL need update
  - Replace all `sellsProductsAndServices` → `channelMode`
  - Widget selection: `channelMode` stays as selected (or force INFORMATIONAL)
  - Type label: show "E-commerce" / "Informational" / "Flow"

- `apps/frontend/src/components/shared/ClientSheet.tsx` — conditional actions
- `apps/frontend/src/components/settings/sections/WebsiteWidgetSection.tsx` — widget constraint for 3 types
- `apps/frontend/src/pages/AgentConfigurationPage.tsx` — agent flow diagram → add Flow diagram

#### 6H: Public Pages
- `apps/frontend/src/pages/CustomerProfilePublicPage.tsx` — `isEcommerce` prop → `channelMode`
- `apps/frontend/src/components/profile/ProfileForm.tsx` — `isEcommerce` prop → `channelMode`
- `apps/frontend/src/components/public/MobileMenu.tsx` — update
- `apps/frontend/src/components/public/StickyHeader.tsx` — update

#### 6I: Onboarding Questionnaire — New "Flow" Step
The public questionnaire (`/questionario`) needs a new step asking if the user needs a Flow (guided step-by-step) chatbot.

**Database**:
- `packages/database/prisma/schema.prisma` — add field to `OnboardingQuestionnaire` model:
  - `needsFlowBot Boolean?` — "Do you need a guided step-by-step chatbot?"
  - `flowBotDescription String?` — optional description of their flow use case
- Migration: `npx prisma migrate dev --name add_flow_bot_to_questionnaire`

**Frontend** (`apps/frontend/src/pages/QuestionnairePage.tsx`):
- Add new step after existing questions (before submit)
- Question: "Will your chatbot need guided step-by-step flows?" with description
  - E.g.: troubleshooting, onboarding processes, guided configurations
- Yes/No toggle + optional textarea for description
- Update form state and submission payload

**Backend** (`apps/backend/src/interfaces/http/controllers/onboarding-questionnaire.controller.ts`):
- Accept `needsFlowBot` and `flowBotDescription` in POST `/api/v1/questionnaire`
- Validate fields

**Backoffice** (`apps/backoffice/src/pages/QuestionnairePage.tsx`):
- Show `needsFlowBot` and `flowBotDescription` in questionnaire detail view

### Files Modified
~20 frontend files (listed above) + 4 questionnaire files

---

## Phase 7: Backoffice + Scheduler + MCP

**Difficulty**: LOW — Few references
**Risk**: None — straightforward updates

### Steps
1. `apps/backoffice/src/hooks/useMenuItems.ts`:
   - Line 91: `item.requiresEcommerce && !workspace?.sellsProductsAndServices` → use `channelMode`
   - Lines 103-105: `getChannelTypeLabel()` → return "E-commerce" / "Informational" / "Flow"
   - Lines 16, 19: Update comments

2. `apps/scheduler/src/**` — grep for any `sellsProductsAndServices` references, update

3. `packages/mcp-server/src/index.ts` — update workspace schema to use `channelMode` enum

### Files Modified
- `apps/backoffice/src/hooks/useMenuItems.ts` — 3 changes
- `packages/mcp-server/src/index.ts` — schema update
- Scheduler files (if any references found)

---

## Phase 8: Tests *depends on Phases 3-6*

**Difficulty**: HIGH — 23 test files, 100+ matches, must update WITHOUT changing test LOGIC
**Risk**: Changing mocks wrong could break test expectations. Tests are sacred — only mock data updates

### Steps

#### Pattern: Every `sellsProductsAndServices: true` in mock → `channelMode: 'ECOMMERCE' as any`
#### Pattern: Every `sellsProductsAndServices: false` in mock → `channelMode: 'INFORMATIONAL' as any`

**Top 10 priority test files:**

1. `apps/backend/__tests__/unit/function-executor-sells-products.spec.ts` — 28 refs
2. `apps/backend/__tests__/unit/customer-profile-get-workspace.spec.ts` — 22 refs
3. `apps/backend/__tests__/unit/services/llm-router-identity.test.ts` — 10 refs
4. `apps/backend/__tests__/unit/agents/agent-functions-mapping.spec.ts` — 8 refs
5. `apps/backend/__tests__/unit/agents/appointment-orchestration.spec.ts` — 5 refs
6. `apps/backend/__tests__/unit/services/workspace-wizard.service.spec.ts` — 4 refs
7. `apps/backend/__tests__/unit/registration/widget-registration-guard.spec.ts` — 4 refs
8. `apps/backend/__tests__/unit/router/blocked-user.spec.ts` — 3 refs
9. `apps/backend/__tests__/unit/chat-engine-welcome.spec.ts` — 3 refs
10. `apps/backend/__tests__/unit/workspace-checklist.service.spec.ts` — 2 refs

**Plus 13 more test files** with 1-2 refs each (full scan needed at implementation time).

**Frontend tests:**
- `apps/frontend/__tests__/components/MobileMenu.isEcommerce.spec.tsx` — update
- `apps/frontend/__tests__/components/ProfileForm.isEcommerce.spec.tsx` — update
- `apps/frontend/__tests__/components/StickyHeader.isEcommerce.spec.tsx` — update

**New tests to add:**
- Flow workspace → correct strategy selected
- Flow workspace → correct template loaded
- Flow workspace → correct agents created
- Type change ECOMMERCE → FLOW → old agents deleted (BUG-1 fix verification)

### Verification
- `npm run test:unit` — ALL existing tests pass
- No test LOGIC changed — only mock data field names
- `npm run test:coverage` — coverage not decreased

---

## Phase 9: Cleanup + Documentation *depends on Phase 8*

**Difficulty**: LOW
**Risk**: None — documentation only

### Steps
1. Full grep for any remaining `sellsProductsAndServices` — should be zero
2. Full grep for `?? true` patterns referencing old boolean — should be zero
3. Update documentation:
   - `docs/PRD.md` — channelMode references
   - `docs/settings-audit.md` — updated field list
   - `docs/informational-pipeline-architecture.md` — add Flow pipeline
   - `AGENTS.md` — update architecture section
   - `CLAUDE.md` — update schema description
   - `.github/copilot-instructions.md` — update patterns
4. Run `npm run build` — full build succeeds

---

## Acceptance Criteria

### AC-1: Schema & Migration
- [ ] Enum `ChannelMode` esiste con 3 valori (ECOMMERCE, INFORMATIONAL, FLOW)
- [ ] Campo `sellsProductsAndServices` non esiste più nel DB
- [ ] Workspace esistenti migrati correttamente (true → ECOMMERCE, false → INFORMATIONAL)
- [ ] Default nuovi workspace: INFORMATIONAL

### AC-2: Backend Routing
- [ ] Workspace ECOMMERCE → EcommerceWorkspaceStrategy → pipeline ecommerce con tutti gli agenti
- [ ] Workspace INFORMATIONAL → InformationalWorkspaceStrategy → pipeline informational
- [ ] Workspace FLOW → FlowWorkspaceStrategy → pipeline flow (identica a informational per ora)
- [ ] Zero occorrenze di `sellsProductsAndServices` nel codice backend

### AC-3: Cambio tipo workspace
- [ ] Cambiando da ECOMMERCE a INFORMATIONAL → agenti ecommerce-only vengono ELIMINATI (BUG-1 fix)
- [ ] Cambiando da INFORMATIONAL a ECOMMERCE → agenti ecommerce vengono CREATI
- [ ] Calling functions sincronizzate correttamente dopo il cambio
- [ ] Cart agent carica il template corretto `03-cart-management.template.md` (BUG-2 fix)

### AC-4: Widget constraint
- [ ] ECOMMERCE + Widget → BLOCCATO (errore chiaro e consistente)
- [ ] INFORMATIONAL + Widget → OK
- [ ] FLOW + Widget → OK

### AC-5: Frontend
- [ ] Wizard nuovo canale: 3 opzioni radio (E-commerce / Informational / Flow)
- [ ] Settings: dropdown a 3 opzioni al posto dello switch
- [ ] Sidebar/Header: menu items corretti per ogni tipo
- [ ] Badge workspace mostra il channelMode
- [ ] Zero occorrenze di `sellsProductsAndServices` nel frontend

### AC-6: Tests
- [ ] `npm run test:unit` passa al 100%
- [ ] Nessuna logica test modificata — solo mock data
- [ ] Coverage non diminuita

### AC-7: Cleanup
- [ ] Zero occorrenze di `sellsProductsAndServices` in TUTTO il repo
- [ ] Zero `?? true` / `?? false` relativi al vecchio booleano
- [ ] Template orfani eliminati (product-context, order-optimization)
- [ ] TOTP dead code rimosso dal wizard
- [ ] console.log debug rimosso dalla Sidebar

### AC-7B: Onboarding Questionnaire
- [ ] Nuovo step nel questionario pubblico: "Will your chatbot need guided step-by-step flows?"
- [ ] Campi `needsFlowBot` e `flowBotDescription` salvati in DB
- [ ] Visibili nel backoffice nella lista questionari
- [ ] Validazione backend sui nuovi campi

### AC-8: Documentazione
- [ ] `docs/PRD.md` — aggiornato con riferimenti a `channelMode` enum
- [ ] `docs/settings-audit.md` — campo aggiornato
- [ ] `docs/informational-pipeline-architecture.md` — aggiunta sezione Flow
- [ ] `AGENTS.md` — architettura aggiornata con 3 tipi
- [ ] `CLAUDE.md` — schema description aggiornata
- [ ] `.github/copilot-instructions.md` — pattern aggiornati

### AC-8B: Documentazione Architettura LLM (3 pipeline)
- [ ] Documentare pipeline ECOMMERCE: Router → Product Search / Cart / Order Tracking / Customer Support → Safety & Translation
- [ ] Documentare pipeline INFORMATIONAL: Router → Info Agent → Safety & Translation
- [ ] Documentare pipeline FLOW: Router → Flow Agent → Safety & Translation (placeholder, identica a Informational per ora)
- [ ] Diagramma che mostra i 3 flussi con agenti coinvolti per ciascun `channelMode`
- [ ] Quali agenti esistono per tipo (es. ECOMMERCE ha 8+ agenti, INFORMATIONAL/FLOW hanno 4-5)
- [ ] Quali calling functions sono disponibili per tipo
- [ ] Come avviene il cambio tipo e cosa succede agli agenti/functions

### AC-9: Nuovi test unitari
- [ ] Test: workspace FLOW → FlowWorkspaceStrategy selezionata
- [ ] Test: workspace FLOW → template caricati da cartella `flow/`
- [ ] Test: workspace FLOW → agenti corretti creati
- [ ] Test: cambio tipo ECOMMERCE → FLOW → agenti orfani eliminati (verifica BUG-1 fix)
- [ ] Test: cambio tipo ECOMMERCE → INFORMATIONAL → agenti orfani eliminati
- [ ] Test: Cart agent carica template `CART_MANAGEMENT` (verifica BUG-2 fix)
- [ ] Test: `getValidAgentTypesForMode()` ritorna tipi corretti per ogni mode
- [ ] Test: widget constraint bloccato per ECOMMERCE, permesso per INFORMATIONAL e FLOW

---

## Excluded from Scope
- Flow sub-agent implementation (custom agents, troubleshooting flows)
- Custom calling functions per sub-agent
- Flow "lock" mechanism in ConversationState
- Flow-specific UI in admin panel
- Flow-specific template content (uses informational templates as placeholder)

## Execution Order

```
Phase 1 (Schema + Migration)
    ↓
Phase 2 (Helper Layer)
    ↓
┌─────────────────┬──────────────────┬──────────────────┐
│  Phase 3        │  Phase 4         │  Phase 5         │
│  (Strategies +  │  (Services +     │  (Templates)     │
│   LLM Routing)  │   Controllers)   │                  │
│                 │                  │                  │
│  Phase 6        │  Phase 7         │                  │
│  (Frontend)     │  (Backoffice +   │                  │
│                 │   Scheduler)     │                  │
└─────────────────┴──────────────────┴──────────────────┘
    ↓
Phase 8 (Tests)
    ↓
Phase 9 (Cleanup + Documentation)
```
