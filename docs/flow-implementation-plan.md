# Flow Engine — Implementation Plan

## Status Legend

| Symbol | Meaning |
|---|---|
| ❌ | Not started |
| 🔄 | In progress |
| ✅ | Complete |
| ⚠️ | Exists but needs modification |

---

## Gap Analysis — Current State

| Component | File | Status | Notes |
|---|---|---|---|
| `ChannelMode.FLOW` | `packages/database/prisma/schema.prisma` | ✅ | Line 1117 |
| `ChatSession.context` | `packages/database/prisma/schema.prisma` | ✅ | JSON field exists |
| `FlowNodeConfig` relation on Workspace | `packages/database/prisma/schema.prisma` | ✅ | Line 170 |
| `FlowNodeConfig` Prisma model | `packages/database/prisma/schema.prisma` | ❌ | Model NOT defined |
| Migration SQL | `packages/database/prisma/migrations/20260415000000_add_flow_node_config/` | ⚠️ | Wrong fields: `name`, `description`, `order` — missing `machineId`, `machineName`, `flows` JSONB |
| `flow.types.ts` | `apps/backend/src/types/flow.types.ts` | ✅ | Created |
| `flow-classifier.service.ts` | `apps/backend/src/application/services/flow-classifier.service.ts` | ✅ | Created |
| `flow-engine.service.ts` | `apps/backend/src/application/services/flow-engine.service.ts` | ✅ | Created |
| `flow-node-config.repository.ts` | `apps/backend/src/repositories/` | ❌ | Not created |
| `MachineAgentLLM.ts` | `apps/backend/src/application/agents/` | ❌ | Not created |
| `FlowWorkspaceStrategy` | `apps/backend/src/strategies/flow-workspace.strategy.ts` | ⚠️ | Placeholder — uses CustomerSupportAgentLLM |
| `TranslationAgent` wiring | `apps/backend/src/strategies/flow-workspace.strategy.ts` | ⚠️ | Imported but output not translated |
| Controller + Routes | `apps/backend/src/interfaces/http/` | ❌ | Not created |
| Frontend `FlowConfigsPage` | `apps/frontend/src/pages/` | ❌ | Not created |
| Frontend `FlowConfigSheet` | `apps/frontend/src/components/` | ❌ | Not created |
| Unit tests `FlowEngineService` | `apps/backend/__tests__/unit/services/` | ❌ | Not created |
| Seed data (HS-60XX example) | `packages/database/prisma/seed.ts` | ❌ | Not added |

---

## Anticipated Problems

| Problem | Risk | Mitigation |
|---|---|---|
| Migration conflicts with existing wrong SQL | HIGH | Drop old migration, create new one with correct fields |
| `FlowNodeConfig` model missing causes Prisma generate to fail | HIGH | Fix schema before any `npx prisma generate` |
| `ChatSession.context` JSON shape unknown at runtime | MEDIUM | TypeScript cast + `zod` schema validation in repository |
| `MachineAgentLLM` tool_call `startFlow` sends `flowId` that doesn't exist in `flows` | MEDIUM | Validate `flowId` in `FlowEngineService.startFlow()` — already throws |
| Concurrent messages while flow is ACTIVE corrupt context | MEDIUM | Existing customer-level lock in `ChatEngineService` covers this |
| `TranslationAgent` receives `responseText` from FlowEngine (short, enumerated) — may reformat | LOW | Add `preserveFormatting: true` hint in translation prompt |
| `onInterruptFallback` not set on node — causes `undefined` in response | LOW | `FlowEngineService` already falls back to `node.prompt` |
| Admin saves flows JSON with `flowId.nodeId` references that don't exist | MEDIUM | Frontend validation before save + `FlowEngineService` throws on `resolveNode()` |
| `isTerminal: true` nodes get a `default` transition anyway — ambiguity | LOW | `FlowEngineService.applyTransition()` checks `isTerminal` first |

---

## Isolation Architecture

The FLOW workspace chatbot is **fully isolated** from ECOMMERCE and INFORMATIONAL:

```
ChannelMode.FLOW        ChannelMode.ECOMMERCE     ChannelMode.INFORMATIONAL
        │                       │                          │
FlowWorkspaceStrategy   EcommerceWorkspaceStrategy  InformationalWorkspaceStrategy
        │                       │                          │
MachineAgentLLM         EcommerceAgentLLM           InfoAgentLLM
        │
FlowEngineService
        │
FlowNodeConfig (DB)
```

- **Separate strategy class** — no shared code path with other workspace types
- **Separate LLM instance** — `MachineAgentLLM` reads `FlowNodeConfig.model` + `systemPrompt` from DB
- **Separate conversation history** — `ConversationManager.loadHistory()` uses `conversationId` (per-session), already isolated
- **Shared infrastructure** — `ConversationManager`, `TranslationAgent`, `SecurityAgent`, `contactOperator()` are workspace-agnostic utilities, safe to reuse

---

## Epic Overview

| # | Epic | Priority | Dependencies |
|---|---|---|---|
| E1 | Database Layer | P0 | — |
| E2 | Core Engine | P0 | E1 |
| E3 | LLM Agent | P0 | E1, E2 |
| E4 | Strategy Rewrite | P0 | E2, E3 |
| E5 | API Layer | P1 | E1 |
| E6 | Frontend | P1 | E5 |
| E7 | Tests | P0 | E2, E3, E4 |
| E8 | Seed + Documentation | P2 | E1 |

---

## Epic E1 — Database Layer

**Goal**: `FlowNodeConfig` model exists in Prisma schema and database with correct fields.

### Tasks

| Task | File | Status |
|---|---|---|
| E1-T1 | Drop wrong migration, create new one | ❌ |
| E1-T2 | Add `FlowNodeConfig` model to `schema.prisma` | ❌ |
| E1-T3 | Run `npx prisma generate` | ❌ |
| E1-T4 | Create `flow-node-config.repository.ts` | ❌ |

### E1-T1: New Migration SQL

**File**: `packages/database/prisma/migrations/20260415000000_add_flow_node_config/migration.sql`

```sql
-- Drop old table if it exists (wrong schema)
DROP TABLE IF EXISTS "flow_node_configs";

-- CreateTable
CREATE TABLE "flow_node_configs" (
    "id"                 TEXT NOT NULL,
    "workspaceId"        TEXT NOT NULL,
    "machineId"          TEXT NOT NULL,
    "machineName"        TEXT NOT NULL,
    "systemPrompt"       TEXT NOT NULL DEFAULT '',
    "model"              TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "temperature"        DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens"          INTEGER NOT NULL DEFAULT 2048,
    "availableFunctions" JSONB NOT NULL DEFAULT '[]',
    "flows"              JSONB NOT NULL DEFAULT '{}',
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "flow_node_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flow_node_configs_workspaceId_machineId_key"
    ON "flow_node_configs"("workspaceId", "machineId");

CREATE INDEX "flow_node_configs_workspaceId_idx"
    ON "flow_node_configs"("workspaceId");

ALTER TABLE "flow_node_configs"
    ADD CONSTRAINT "flow_node_configs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### E1-T2: Prisma Model

**File**: `packages/database/prisma/schema.prisma`

```prisma
model FlowNodeConfig {
  id                  String    @id @default(cuid())
  workspaceId         String
  machineId           String    // slug: "lavatrice_hs60xx"
  machineName         String    // label: "Washer HS-60XX"
  systemPrompt        String    @default("") @db.Text
  model               String    @default("openai/gpt-4o-mini")
  temperature         Float     @default(0.3)
  maxTokens           Int       @default(2048)
  availableFunctions  Json      @default("[]")
  flows               Json      @default("{}")
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  workspace           Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, machineId])
  @@index([workspaceId])
  @@map("flow_node_configs")
}
```

### E1-T4: Repository Interface

**File**: `apps/backend/src/repositories/flow-node-config.repository.ts`

Methods:
- `findByMachineId(workspaceId: string, machineId: string): Promise<FlowNodeConfig | null>`
- `findAllByWorkspace(workspaceId: string): Promise<FlowNodeConfig[]>`
- `create(workspaceId: string, data: CreateFlowNodeConfigDto): Promise<FlowNodeConfig>`
- `update(workspaceId: string, id: string, data: UpdateFlowNodeConfigDto): Promise<FlowNodeConfig>`
- `delete(workspaceId: string, id: string): Promise<void>`

### Acceptance Criteria E1

| # | Criterion | Build Check | Test |
|---|---|---|---|
| AC-E1-1 | `npx prisma generate` runs without errors | `npm run prisma:generate` exits 0 | — |
| AC-E1-2 | `flow_node_configs` table exists in DB with all correct columns | `npm run prisma:migrate` exits 0 | — |
| AC-E1-3 | `@@unique([workspaceId, machineId])` prevents duplicate machineId per workspace | Migration applied | Unit test: save same machineId twice → error |
| AC-E1-4 | `repository.findByMachineId()` returns null for missing record | TypeScript compiles | Unit test: mock returns null, assert null |
| AC-E1-5 | `repository.create()` respects workspace isolation | TypeScript compiles | Unit test: different workspaceId → different record |
| AC-E1-6 | Cascade delete: removing Workspace removes all its FlowNodeConfigs | DB constraint | Unit test: assert cascade |

---

## Epic E2 — Core Engine

**Goal**: `FlowEngineService` correctly executes all node types and classifies all input types.

### Tasks

| Task | File | Status |
|---|---|---|
| E2-T1 | `flow.types.ts` — finalize types | ✅ |
| E2-T2 | `flow-classifier.service.ts` — input classification | ✅ |
| E2-T3 | `flow-engine.service.ts` — deterministic engine | ✅ |
| E2-T4 | Unit tests for FlowEngineService | ❌ |
| E2-T5 | Unit tests for classifyInput | ❌ |

### Acceptance Criteria E2

| # | Criterion | Build Check | Test |
|---|---|---|---|
| AC-E2-1 | `startFlow("non_parte")` returns `step_0` prompt and sets `flowStatus: "ACTIVE"` | TypeScript compiles | `flow-engine.service.spec.ts` |
| AC-E2-2 | CHOICE node: input `"3"` → advances to `transitions["3"]` node | TypeScript compiles | Unit test: assert `currentNodeId` changes |
| AC-E2-3 | CONFIRMATION node: `"yes"` → `transitions["YES"]`, `"no"` → `transitions["NO"]` | TypeScript compiles | Unit test: both branches |
| AC-E2-4 | ACTION node: any input → `transitions["default"]` | TypeScript compiles | Unit test: input "ok" advances |
| AC-E2-5 | INFO terminal node: sets `flowStatus: "COMPLETED"` | TypeScript compiles | Unit test: assert COMPLETED |
| AC-E2-6 | `handle_escalate` node: sets `shouldCallOperator: true` | TypeScript compiles | Unit test: assert flag |
| AC-E2-7 | HARD_BREAK: sets `flowStatus: "ESCALATED"`, `shouldCallOperator: true` | TypeScript compiles | Unit test: "operator" input |
| AC-E2-8 | SOFT_BREAK: sets `flowStatus: "PAUSED"` | TypeScript compiles | Unit test: "stop" input |
| AC-E2-9 | `interruptCount >= 4` → escalation | TypeScript compiles | Unit test: 4x AMBIGUOUS inputs |
| AC-E2-10 | TTL reset: `interruptCount` resets if >30min since `lastValidStepAt` | TypeScript compiles | Unit test: mock Date, assert reset |
| AC-E2-11 | Invalid `nodeId` format throws descriptive error | TypeScript compiles | Unit test: `"missing_dot"` → error |
| AC-E2-12 | `classifyInput("1")` → `MATCH`, `classifyInput("operator")` → `HARD_BREAK` | TypeScript compiles | Unit test: all 5 classifications |

---

## Epic E3 — MachineAgentLLM

**Goal**: Sub-LLM agent that reads `FlowNodeConfig` from DB, builds tools dynamically, and calls `startFlow()`.

### Tasks

| Task | File | Status |
|---|---|---|
| E3-T1 | Create `MachineAgentLLM.ts` | ❌ |
| E3-T2 | Dynamic tool construction from `Object.keys(config.flows)` | ❌ |
| E3-T3 | `startFlow` tool_call → `FlowEngineService.startFlow()` | ❌ |
| E3-T4 | `contactOperator` tool_call → existing `contactOperator()` | ❌ |
| E3-T5 | History loading via `ConversationManager.loadHistory()` | ❌ |
| E3-T6 | Unit tests for `MachineAgentLLM` | ❌ |

### Architecture Pattern

Follow `CustomerSupportAgentLLM.ts` exactly:
```
handleQuery()
  1. load FlowNodeConfig from repository
  2. build messages: systemPrompt + ConversationManager.loadHistory()
  3. build tools: startFlow(enum from flows keys) + optional contactOperator
  4. callLLM(model, messages, tools, temperature)
  5. if tool_call "startFlow" → FlowEngineService.startFlow(flowId, context)
     → add tool result to messages → second LLM call
  6. if tool_call "contactOperator" → contactOperator()
  7. return { output, tokensUsed, functionCalls, executionTimeMs }
```

### Acceptance Criteria E3

| # | Criterion | Build Check | Test |
|---|---|---|---|
| AC-E3-1 | Tool enum for `startFlow` is built from `Object.keys(config.flows)` — not hardcoded | TypeScript compiles | Unit test: mock config with 2 flows → assert 2 enum values |
| AC-E3-2 | `contactOperator` tool only present if `availableFunctions` includes `"contactOperator"` | TypeScript compiles | Unit test: absent config → tool not in list |
| AC-E3-3 | `systemPrompt` comes from `FlowNodeConfig.systemPrompt` — never hardcoded | TypeScript compiles | Unit test: assert LLM called with DB prompt |
| AC-E3-4 | `model` and `temperature` come from `FlowNodeConfig` | TypeScript compiles | Unit test: mock config, assert values passed to LLM |
| AC-E3-5 | `handleQuery()` throws if `FlowNodeConfig` not found for `machineId` | TypeScript compiles | Unit test: mock returns null → error thrown |
| AC-E3-6 | History loaded via `ConversationManager.loadHistory()` — last 24h | TypeScript compiles | Unit test: mock loadHistory, assert called |
| AC-E3-7 | `startFlow` tool_call result is added to conversation history before second LLM call | TypeScript compiles | Unit test: assert messages array length after tool_call |
| AC-E3-8 | `workspaceId` always passed to all DB queries | TypeScript compiles | Unit test: assert workspace isolation |

---

## Epic E4 — Strategy Rewrite

**Goal**: `FlowWorkspaceStrategy` fully implements the 5-step pipeline, replacing the current placeholder.

### Tasks

| Task | File | Status |
|---|---|---|
| E4-T1 | Implement QR detection (message matches `START_MACHINE_*`) | ❌ |
| E4-T2 | Load `FlowNodeConfig` by `machineId`, save to `ChatSession.context` | ❌ |
| E4-T3 | Route to `FlowEngineService` if `flowState.flowStatus === "ACTIVE"` | ❌ |
| E4-T4 | Route to `MachineAgentLLM` otherwise | ❌ |
| E4-T5 | Wire `TranslationAgent` on output of both paths | ❌ |
| E4-T6 | Call `contactOperator()` if `flowStepResult.shouldCallOperator` | ❌ |
| E4-T7 | Update `ChatSession.context` after each message | ❌ |
| E4-T8 | Unit tests for strategy routing logic | ❌ |

### 5-Step Pipeline

```
Step 1: SecurityAgent            (widget only — already wired)
Step 2: Routing
  QR code?     → load config → welcome → save context
  flowActive?  → FlowEngineService.handleMessage()
  else         → MachineAgentLLM.handleQuery()
Step 3/4: engine returns FlowStepResult or LLM output
Step 5: TranslationAgent         (both paths — needs wiring)
→ shouldCallOperator? → contactOperator()
→ return finalResponse
```

### Acceptance Criteria E4

| # | Criterion | Build Check | Test |
|---|---|---|---|
| AC-E4-1 | QR message `START_MACHINE_2_WASHER` → loads correct `FlowNodeConfig`, saves `machineId` to context | TypeScript compiles | Unit test: mock context, assert machineId saved |
| AC-E4-2 | `flowState.flowStatus === "ACTIVE"` → routes to `FlowEngineService`, NOT `MachineAgentLLM` | TypeScript compiles | Unit test: assert FlowEngine called |
| AC-E4-3 | No active flow → routes to `MachineAgentLLM` | TypeScript compiles | Unit test: assert MachineAgent called |
| AC-E4-4 | `TranslationAgent` called on response from FlowEngine path | TypeScript compiles | Unit test: mock TranslationAgent, assert called |
| AC-E4-5 | `TranslationAgent` called on response from MachineAgentLLM path | TypeScript compiles | Unit test: mock TranslationAgent, assert called |
| AC-E4-6 | `shouldCallOperator: true` → `contactOperator()` called with machine context | TypeScript compiles | Unit test: mock contactOperator, assert called |
| AC-E4-7 | `ChatSession.context` saved to DB after every message | TypeScript compiles | Unit test: assert DB update called |
| AC-E4-8 | Strategy only handles `ChannelMode.FLOW` workspaces | TypeScript compiles | Unit test: `canHandle()` false for non-FLOW |
| AC-E4-9 | Error in FlowEngine → strategy catches and returns readable error, not raw exception | TypeScript compiles | Unit test: throw in FlowEngine → assert 500 response |

---

## Epic E5 — API Layer

**Goal**: CRUD endpoints for `FlowNodeConfig` with 3-layer middleware security.

### Tasks

| Task | File | Status |
|---|---|---|
| E5-T1 | Create `flow-node-config.controller.ts` | ❌ |
| E5-T2 | Create `flow-node-config.routes.ts` | ❌ |
| E5-T3 | Register routes in main router | ❌ |
| E5-T4 | Add Swagger JSDoc to all endpoints | ❌ |

### Endpoints

```
GET    /api/workspaces/:workspaceId/flow-configs          → list all
GET    /api/workspaces/:workspaceId/flow-configs/:id      → get one
POST   /api/workspaces/:workspaceId/flow-configs          → create
PUT    /api/workspaces/:workspaceId/flow-configs/:id      → update
DELETE /api/workspaces/:workspaceId/flow-configs/:id      → delete
```

All endpoints use the 3-layer middleware:
```typescript
authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation
```

### Acceptance Criteria E5

| # | Criterion | Build Check | Test |
|---|---|---|---|
| AC-E5-1 | `GET /flow-configs` returns only configs for the authenticated workspace | TypeScript compiles | Unit test: mock repo, assert workspaceId filter |
| AC-E5-2 | `POST /flow-configs` with duplicate `machineId` returns 409 | TypeScript compiles | Unit test: mock P2002 error → 409 |
| AC-E5-3 | `DELETE /flow-configs/:id` from different workspace returns 403 | TypeScript compiles | Unit test: assert workspace isolation |
| AC-E5-4 | All 5 endpoints have Swagger JSDoc | `npm run build` | Manual: check `/api-docs` |
| AC-E5-5 | unauthenticated request returns 401 | TypeScript compiles | Unit test: no token → 401 |

---

## Epic E6 — Frontend

**Goal**: Admin UI to create/edit `FlowNodeConfig` records.

### Tasks

| Task | File | Status |
|---|---|---|
| E6-T1 | Create `FlowConfigsPage.tsx` | ❌ |
| E6-T2 | Create `FlowConfigSheet.tsx` (slide panel) | ❌ |
| E6-T3 | Create `flowConfigApi.ts` service | ❌ |
| E6-T4 | Add route in `App.tsx` | ❌ |
| E6-T5 | Add sidebar navigation link | ❌ |

### UI Components

**`FlowConfigsPage`**:
- Table: `machineName`, `machineId`, `model`, `isActive`, `updatedAt`
- Actions: Edit (Sheet), Delete (confirm dialog)
- Button: "Add Machine Config"

**`FlowConfigSheet`**:
- Fields: `machineName`, `machineId`, `model`, `temperature`, `maxTokens`
- Large textarea: `systemPrompt`
- Large JSON editor: `flows` (with JSON validation before save)
- Multi-select: `availableFunctions`
- Toggle: `isActive`
- Validation: alert if same variable used twice in systemPrompt

### Acceptance Criteria E6

| # | Criterion | Build Check | Test |
|---|---|---|---|
| AC-E6-1 | Page shows all `FlowNodeConfig` records for current workspace | `npm run build:frontend` | Frontend unit test (vitest) |
| AC-E6-2 | Save with invalid JSON in `flows` field → shows validation error, does NOT call API | `npm run build:frontend` | Frontend unit test |
| AC-E6-3 | All form labels and toasts in English | `npm run build:frontend` | Code review |
| AC-E6-4 | Page is only visible for FLOW workspace | `npm run build:frontend` | Frontend unit test: assert route guard |
| AC-E6-5 | Delete shows confirmation dialog before calling API | `npm run build:frontend` | Frontend unit test |

---

## Epic E7 — Tests

**Goal**: Full unit test coverage for all new engine components.

### Test Files to Create

| File | Covers |
|---|---|
| `__tests__/unit/services/flow-engine.service.spec.ts` | All FlowEngineService paths |
| `__tests__/unit/services/flow-classifier.service.spec.ts` | All 5 input classifications |
| `__tests__/unit/agents/machine-agent-llm.spec.ts` | MachineAgentLLM with mocked LLM |
| `__tests__/unit/strategies/flow-workspace.strategy.spec.ts` | Strategy routing decisions |

### Minimum Test Coverage Required (per policy >80%)

| Component | Happy Path | Error Path | Edge Cases |
|---|---|---|---|
| `FlowEngineService` | 5 node types | Invalid nodeId, missing flow | TTL reset, max interrupts |
| `classifyInput` | 5 classifications | Empty string, unicode | Multi-word hard break |
| `MachineAgentLLM` | Tool call flow | Config not found | No tools available |
| `FlowWorkspaceStrategy` | QR, ACTIVE, no-flow | FlowEngine throws | Missing machineId in context |

### Acceptance Criteria E7

| # | Criterion | Command |
|---|---|---|
| AC-E7-1 | `flow-engine.service.spec.ts` passes — all 12 AC-E2 scenarios covered | `npm run test:unit` |
| AC-E7-2 | `flow-classifier.service.spec.ts` passes — all 5 classifications tested | `npm run test:unit` |
| AC-E7-3 | `machine-agent-llm.spec.ts` passes — all 8 AC-E3 scenarios covered | `npm run test:unit` |
| AC-E7-4 | `flow-workspace.strategy.spec.ts` passes — all 9 AC-E4 scenarios covered | `npm run test:unit` |
| AC-E7-5 | Existing tests do NOT regress — total suite still passes | `npm run test:unit` |
| AC-E7-6 | No integration tests created (rule #7B) | Code review | — |

---

## Epic E8 — Seed + Documentation

**Goal**: Working seed data with full HS-60XX example, merged into existing seed file.

### Tasks

| Task | File | Status |
|---|---|---|
| E8-T1 | Add `FlowNodeConfig` seed for HS-60XX to `packages/database/prisma/seed.ts` | ❌ |
| E8-T2 | Add `FlowNodeConfig` seed for ED-340 (minimal) | ❌ |

### Acceptance Criteria E8

| # | Criterion | Command |
|---|---|---|
| AC-E8-1 | `npm run prisma:seed` runs without errors | `npm run prisma:seed` |
| AC-E8-2 | Seed creates HS-60XX config in test workspace | manual: check DB |
| AC-E8-3 | Seed is idempotent — running twice does not create duplicates | `npm run prisma:seed` twice → no error |

---

## Implementation Order

```
E1 (DB) → E2 (Engine, already done) → E4-T1..T7 partially + E3 (LLM Agent)
        → E4 complete (Strategy) → E5 (API) → E6 (Frontend) → E7 (Tests) → E8 (Seed)
```

**Critical path**: E1 is the blocker for everything else — schema must exist before `npx prisma generate`.

---

## Definition of Done (per Epic)

An epic is DONE when:
1. ✅ All tasks in the epic are complete
2. ✅ All Acceptance Criteria pass
3. ✅ `npm run test:unit` passes (no regressions)
4. ✅ `npm run build` passes (no TypeScript errors)
5. ✅ No Italian text in code, UI, or prompts
6. ✅ All DB queries filter by `workspaceId`
7. ✅ No hardcoded strings — all prompts come from `FlowNodeConfig` in DB
