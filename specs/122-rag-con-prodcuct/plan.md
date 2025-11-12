# Implementation Plan: FR-13 Repeat Order with Confirmation Flow

**Branch**: `122-rag-con-prodcuct` | **Date**: 2025-11-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/122-rag-con-prodcuct/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

**Primary Requirement**: Implement a two-step repeat order flow where:

1. Order Tracking Agent shows last order details with {{LAST_ORDER}} variable
2. Agent asks for customer confirmation
3. On "SI" → calls `addProducts(array)` or reuses `AddProduct` CF
4. Returns checkout link to **Step 2** (address) instead of Step 1 (cart review)

**Technical Approach**:

- Add {{LAST_ORDER}} variable to Order Tracking Agent prompt with formatted order summary
- Modify repeatLastOrder flow to NOT auto-add items but wait for confirmation
- Reuse existing `AddProduct` domain CF (accepts product array)
- Update checkout link generation to support `?step=2` parameter for direct address entry

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 18+)
**Primary Dependencies**:

- Backend: Express, Prisma ORM, OpenRouter SDK
- Frontend: React 18, Vite, TailwindCSS
  **Storage**: PostgreSQL (multi-tenant with workspaceId isolation)
  **Testing**: Jest (unit: 80%+ coverage), Integration tests for CF execution
  **Target Platform**: Web (checkout pages), WhatsApp API (messaging)
  **Project Type**: Fullstack web application (backend + frontend)
  **Performance Goals**:
- LLM response time: <3s (OpenRouter GPT-4-mini)
- CF execution: <500ms
- Checkout page load: <2s
  **Constraints**:
- Database-first: NO hardcoded prompts/fallbacks
- Workspace isolation: ALL queries filtered by workspaceId
- Variable replacement: {{LAST_ORDER}} from database at runtime
  **Scale/Scope**:
- Multi-workspace SaaS (5-10 workspaces currently)
- ~50 customers per workspace
- Order volume: ~100 orders/month per workspace

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Database-First ✅ PASS

**Requirement**: All configuration from database, no hardcoded fallbacks

**Implementation**:

- ✅ `{{LAST_ORDER}}` variable will be added to `agentConfig.systemPrompt` (database)
- ✅ Order data fetched from `orders` table filtered by `workspaceId`
- ✅ Product details from `products` table (Italian base language)
- ✅ LLM translates to customer language (NO static translations)

**No violations**

### II. Workspace Isolation ✅ PASS

**Requirement**: ALL queries filtered by workspaceId

**Implementation**:

- ✅ Order query: `where: { customerId, workspaceId, status: 'DELIVERED' }`
- ✅ Product query: `where: { productId, workspaceId, isActive: true }`
- ✅ AddProduct CF already workspace-isolated
- ✅ Checkout link includes workspace context

**No violations**

### III. Variable Replacement ✅ PASS

**Requirement**: Dynamic variables replaced at runtime

**Implementation**:

- ✅ Add `{{LAST_ORDER}}` to Order Tracking Agent system prompt
- ✅ Replacement logic: `replaceAllVariables(prompt, {lastOrder: formattedOrderSummary})`
- ✅ Format: Italian product names from DB → LLM translates to customer language
- ✅ Example: "ORD-2024-001 - 15/10/2024\n- Burrata 500g x2 (12.00€)\n- Prosciutto Crudo x1 (21.50€)\nTotale: 45.50€"

**No violations**

### IV. No Static Translations ✅ PASS

**Requirement**: NO hardcoded translations, database + LLM only

**Implementation**:

- ✅ Product names from DB (Italian base language)
- ✅ Agent prompt in Italian (from `agentConfig`)
- ✅ LLM handles final translation to customer's `languageUser`
- ✅ NO translation mappings (it/es/pt/en) - dynamic only

**No violations**

**OVERALL**: ✅ **CONSTITUTION COMPLIANT** - No gate failures, proceed to Phase 0

## Complexity Tracking

> **NOT REQUIRED** - No constitution violations to justify

This feature is fully compliant with all constitution principles:
- Database-first architecture maintained
- Workspace isolation preserved
- Variable replacement extended correctly
- No static translations introduced

**Complexity Score**: 8 story points (Medium complexity)

**Breakdown**:
- Backend (5 SP): PromptProcessor variable, LinkGenerator step param, AddProduct update
- Frontend (2 SP): CheckoutPage step navigation
- Testing (1 SP): Unit + integration tests

**No architectural debt introduced**

---

## Phase 0 Output: Research

✅ **COMPLETED** - See [research.md](./research.md)

**Key Decisions**:
1. Reuse existing `AddProduct` CF (supports arrays)
2. URL parameter `?step=2` for direct navigation
3. Formatted order summary in Italian (Markdown)
4. LLM-driven confirmation (no database state)
5. Extend link generator with optional step parameter
6. Database seed update for {{LAST_ORDER}}

**Alternatives Evaluated**: 6 decision points documented with rationale

---

## Phase 1 Output: Design & Contracts

✅ **COMPLETED**

**Generated Artifacts**:

1. ✅ [data-model.md](./data-model.md) - Data structures and DB queries
   - LastOrderSummary interface
   - AddProductsRequest mapping
   - CheckoutLinkParams extension
   - Variable replacement logic
   - Performance optimization (indexes, caching)

2. ✅ [contracts/link-generator-step-parameter.md](./contracts/link-generator-step-parameter.md)
   - Method signature extension
   - Input/output specification
   - Usage examples (3 scenarios)
   - Error handling
   - Backward compatibility verification

3. ✅ [contracts/prompt-processor-lastorder.md](./contracts/prompt-processor-lastorder.md)
   - {{LAST_ORDER}} variable format
   - Database query specification
   - Implementation code
   - Testing strategy
   - Constitution compliance check

4. ✅ [quickstart.md](./quickstart.md) - Step-by-step implementation guide
   - 7 implementation steps (5.75h estimated)
   - Code snippets for each component
   - Testing checklist (unit + integration)
   - Rollback plan
   - Success criteria

**Agent Context Update**: ✅ Copilot context refreshed

---

## Next Steps (Phase 2)

**NOT COVERED BY `/speckit.plan`** - Use `/speckit.tasks` command

Phase 2 will generate:
- `tasks.md` - Detailed task breakdown with subtasks
- Story point estimates per task
- Dependencies and sequencing
- Acceptance criteria per task

**Command to run**:
```bash
# From repo root
/speckit.tasks
```

---

## Summary

**Plan Status**: ✅ COMPLETE (Phases 0-1)

**Deliverables**:
- ✅ Technical context documented
- ✅ Constitution gates passed (all 4 principles)
- ✅ Research completed (6 decisions)
- ✅ Data model specified
- ✅ API contracts defined (2 services)
- ✅ Quickstart guide created
- ✅ Agent context updated

**Branch**: `122-rag-con-prodcuct`  
**Implementation Ready**: ✅ YES - All design artifacts available

**Estimated Effort**: 8 story points (~1-2 days for experienced developer)

**Risk Level**: 🟢 LOW
- All components already exist (modifications only)
- Backward compatible changes
- Constitution compliant
- Well-tested approach (LLM-driven confirmation)

---

## Implementation Workflow

```mermaid
graph TD
    A[/speckit.plan COMPLETE] --> B[Review quickstart.md]
    B --> C[Run /speckit.tasks]
    C --> D[Generate tasks.md]
    D --> E[Start Step 1: PromptProcessor]
    E --> F[Step 2: Agent Prompt Update]
    F --> G[Step 3: LinkGenerator]
    G --> H[Step 4: AddProduct CF]
    H --> I[Step 5: Frontend CheckoutPage]
    I --> J[Step 6: Optional RepeatOrder]
    J --> K[Step 7: Integration Tests]
    K --> L{All Tests Pass?}
    L -->|Yes| M[Merge to main]
    L -->|No| N[Debug & Fix]
    N --> K
```

**Current Status**: 📍 **Ready for `/speckit.tasks` command**

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

````text
### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/calling-functions/
│   │   ├── AddProduct.ts                    # EXISTING - reuse for array products
│   │   ├── GetOrder.ts                       # EXISTING - fetch order details
│   │   └── RepeatOrder.ts                    # MODIFY - remove auto-add logic
│   ├── application/agents/
│   │   ├── OrderTrackingAgentLLM.ts          # MODIFY - add {{LAST_ORDER}} context
│   │   └── CartManagementAgentLLM.ts         # EXISTING - no changes
│   ├── services/
│   │   ├── prompt-processor.service.ts       # MODIFY - add lastOrder replacement
│   │   ├── function-executor.service.ts      # MODIFY - update repeatLastOrder flow
│   │   └── link-generator.service.ts         # MODIFY - add step parameter support
│   ├── repositories/
│   │   └── order.repository.ts               # EXISTING - no changes
│   └── interfaces/http/controllers/
│       └── checkout.controller.ts            # MODIFY - handle ?step=2 parameter
├── prisma/
│   └── seed.ts                               # MODIFY - add {{LAST_ORDER}} to Order Agent prompt
└── tests/
    ├── unit/
    │   ├── repeat-order-confirmation.test.ts # NEW - test confirmation flow
    │   └── checkout-step-param.test.ts       # NEW - test step parameter
    └── integration/
        └── repeat-order-flow.test.ts         # NEW - full flow test

frontend/
├── src/
│   ├── pages/
│   │   └── CheckoutPage.tsx                  # MODIFY - handle step=2 URL param
│   ├── services/
│   │   └── checkoutApi.ts                    # EXISTING - no changes
│   └── components/checkout/
│       ├── Step1Products.tsx                 # EXISTING - no changes
│       └── Step2Address.tsx                  # MODIFY - auto-focus if from repeat order
└── tests/
    └── checkout-step-navigation.test.ts      # NEW - test step 2 direct access
````

**Structure Decision**: Fullstack web application using existing backend/frontend structure. Focus on:

1. **Backend CF modification**: Update RepeatOrder.ts to remove auto-add, add confirmation logic
2. **Variable replacement**: Add {{LAST_ORDER}} to PromptProcessorService
3. **Link generation**: Extend LinkGeneratorService for step parameter
4. **Frontend routing**: CheckoutPage handles ?step=2 parameter with pre-filled cart

```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
```
