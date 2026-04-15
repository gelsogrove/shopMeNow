# FLOW Workspace — Master Plan (Design → Development → Release)

> **Source of truth** for the entire FLOW feature lifecycle.
> Replaces and extends `docs/flow-implementation-plan.md` (kept for reference).

---

## Table of Contents

1. [Document Index](#1-document-index)
2. [Architecture Validation](#2-architecture-validation)
3. [Epic Map & Dependencies](#3-epic-map--dependencies)
4. [AI Model Selection per Epic](#4-ai-model-selection-per-epic)
5. [Epic E0a — Welcome Message Flag (cross-cutting)](#epic-e0a--welcome-message-flag-cross-cutting)
6. [Epic E0b — Session Reset Timeout (cross-cutting)](#epic-e0b--session-reset-timeout-cross-cutting)
7. [Epic E1 — Database Layer](#epic-e1--database-layer)
8. [Epic E2 — Core Engine](#epic-e2--core-engine)
9. [Epic E3 — FlowAgentLLM](#epic-e3--flowagentllm)
10. [Epic E4 — Strategy Rewrite](#epic-e4--strategy-rewrite)
11. [Epic E5 — API Layer](#epic-e5--api-layer)
12. [Epic E6 — Frontend Admin UI](#epic-e6--frontend-admin-ui)
13. [Epic E7 — Tests](#epic-e7--tests)
14. [Epic E8 — Seed Data & PRD](#epic-e8--seed-data--prd)
15. [Definition of Done](#definition-of-done)
16. [Risk Register](#risk-register)

---

## 4. AI Model Selection per Epic

> **Purpose**: Switch the AI model in your IDE before starting each epic to get the best result.
> Each epic has a **🛑 PAUSE POINT** at the top where the agent will stop and remind you.

| Epic | Dominant task | Recommended model | Why |
|---|---|---|---|
| **E0a** Welcome toggle | Schema + 1-line handler + simple UI toggle | `gpt-4o-mini` | Purely mechanical, no complex logic |
| **E0b** Session reset | Conditional logic + switch per chatbot type | `gpt-4o-mini` | Structured logic, unambiguous |
| **E1** Database layer | Prisma schema + migration + repository boilerplate | `gpt-4o-mini` | Standard patterns already in codebase |
| **E2** Core Engine | `FlowEngineService` state machine + classifier | **`claude-sonnet`** | Complex state transitions, edge cases, TTL — needs reasoning |
| **E3** FlowAgentLLM | Dynamic tool building + LLM orchestration | **`claude-sonnet`** | Dynamic tools from DB, complex validation |
| **E4** Strategy rewrite | 6-stage pipeline + routing + context save | **`claude-sonnet`** | Coordinates E2+E3+TranslationAgent+contactOperator |
| **E5** API Layer | CRUD controller + routes + Swagger | `gpt-4o-mini` | Standard CRUD pattern — seen 50 times in codebase |
| **E6** Frontend Admin UI | 3-panel flow designer + Monaco editor + validations | **`claude-sonnet`** | Complex UI, JSON validation, interactivity |
| **E7** Tests | 64 unit tests with SCENARIO/RULE comments | **`claude-sonnet`** | Tests require understanding expected behavior, not just boilerplate |
| **E8** Seed + PRD | Seed JSON + PRD text | `gpt-4o-mini` | Known structured data, no critical reasoning |

**Simple rule**:
- `gpt-4o-mini` → E0a, E0b, E1, E5, E8
- `claude-sonnet` → E2, E3, E4, E6, E7

---

## 1. Document Index

### `docs/cliente-0/` — feature docs

| # | File | Purpose | Status |
|---|---|---|---|
| 01 | [01-message-pipeline.md](./01-message-pipeline.md) | 6-stage pipeline, 5 paths (A-E), Mermaid diagram, data flow trace | ✅ Complete |
| 02 | [02-flow-config-editor.md](./02-flow-config-editor.md) | Admin UI wireframes: list page, 75% sheet editor, 3-panel visual flow designer, validation rules, QR generator | ✅ Complete |
| 03 | [03-debug-view.md](./03-debug-view.md) | New DebugStep types (`flow-engine`, `flow-agent`), MessageFlowDialog timeline | ✅ Complete |
| 04 | [04-neapolis-seed-config.md](./04-neapolis-seed-config.md) | Complete Neapolis seed: channel settings, 6 AgentConfigs (same as Informational), 3 CallingFunctions, 2 FlowNodeConfigs (washer+dryer), QR mapping, walkthrough | ✅ Complete |
| 05 | **05-master-plan.md** (this file) | Master plan: all epics, tests, security, build checks, PRD updates | ✅ Current |

### `docs/cliente-0/` — reference PDFs (machine manuals)

| File | Content | Language |
|---|---|---|
| `PROGRAMES.pdf` | Washing machine programs / operation manual | Catalan |
| `PROGRAMES (1).pdf` | Washing machine programs (copy) | Catalan |
| `SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf` | Washer troubleshooting guide — **primary source for HS-60XX flows** | Catalan |
| `SOLUCIÓN-DE-PROBLEMAS-SECADORAS.pdf` | Dryer troubleshooting guide — **primary source for ED-340 flows** | Spanish |

### `docs/` — architecture docs (root)

| File | Purpose | Status |
|---|---|---|
| [flow-engine-architecture.md](../flow-engine-architecture.md) | Architecture spec: pipeline, FlowNodeConfig schema, ChatSession.context schema, both machine examples | ✅ Complete |
| [flow-design-hs60xx.md](./flow-design-hs60xx.md) | Washer HS-60XX flow spec: 4 flows, ~20 nodes (moved to cliente-0/) | ✅ Complete |
| [flow-implementation-plan.md](../flow-implementation-plan.md) | Original 8-epic plan (superseded by this document — kept for reference) | ⚠️ Superseded |
| [PRD.md](../PRD.md) | Product Requirements Document — **needs FLOW section** (Epic E8) | 🔄 Pending update |

---

## 2. Architecture Validation

### Can the chatbot architecture satisfy the PDF requirements?

The PDFs define troubleshooting decision trees for washers and dryers. The architecture must support:

| Requirement from PDFs | Architecture Solution | Validated? |
|---|---|---|
| **Branching decision trees** (e.g. "what code on display?") | `FlowNode.type: CHOICE` with numbered `transitions` | ✅ Yes — `FlowEngineService.applyTransition()` handles numbered input |
| **Step-by-step instructions** (e.g. "press STOP once") | `FlowNode.type: ACTION` with `transitions.default` → follow-up | ✅ Yes — ACTION nodes advance on any input |
| **Yes/no confirmation** (e.g. "did it work?") | `FlowNode.type: CONFIRMATION` with YES/NO transitions | ✅ Yes — `classifyInput()` detects yes/no patterns |
| **Terminal info** (e.g. "use another machine") | `FlowNode.type: INFO` with `isTerminal: true` | ✅ Yes — sets `flowStatus: COMPLETED` |
| **Escalation to operator** | `handle_escalate` nodes + `contactOperator()` | ✅ Yes — `shouldCallOperator: true` triggers operator contact |
| **Multiple machines** (washer vs dryer) | `FlowNodeConfig` per machine, loaded by `flowKey` from QR | ✅ Yes — DB-driven, not hardcoded |
| **Machine specs/prices** | `FlowNodeConfig.systemPrompt` — machine-specific context for LLM | ✅ Yes — each config has its own prompt |
| **Error codes** (ALM/A, ALM/E, ALM/door, ALM/VAr) | Flow nodes per error code with specific instructions | ✅ Yes — `errore_alm` flow has 4 branches |
| **Multilingual customers** | `TranslationAgent` on output — translates to customer language | ✅ Yes — prompts in English, TranslationAgent handles i18n |
| **Frustrated customer detection** | `HARD_BREAK` classification + interrupt escalation (4x limit) | ✅ Yes — `classifyInput("operator")` → HARD_BREAK |
| **FAQ during flow** (e.g. "what programs are available?") | `INTERRUPT_FAQ` classification → MachineAgentLLM answers from `systemPrompt` | ✅ Yes — pauses flow, answers question, resumes |
| **Adding new machines** | Admin CRUD UI + new `FlowNodeConfig` record → live immediately | ✅ Yes — no code changes needed |

### Architecture diagram

```
Customer Message
       │
  ┌────▼────────────┐
  │ SecurityAgent   │  (widget only)
  └────┬────────────┘
       │
  ┌────▼────────────────────────────┐
  │ FlowWorkspaceStrategy.route()  │
  │  canHandle(FLOW) = true        │
  └────┬────────────────────────────┘
       │
       ├── QR code? ──────────────────── load FlowNodeConfig → save context → welcome
       │
       ├── flowState.ACTIVE? ─────────── FlowEngineService.handleMessage() [0 LLM tokens]
       │
       └── else ────────────────────────── FlowAgentLLM.handleQuery() [LLM call]
                                            │
                                            ├── tool_call: startFlow(flowId)
                                            │     └── FlowEngineService.startFlow()
                                            │
                                            └── tool_call: contactOperator
                                                  └── contactOperator()
       │
  ┌────▼────────────┐
  │ TranslationAgent│  (both paths)
  └────┬────────────┘
       │
  ┌────▼────────────┐
  │ Save + Queue    │
  └─────────────────┘
```

### Isolation guarantee

| Layer | Isolation mechanism |
|---|---|
| **Strategy** | `canHandle()` returns `true` only for `ChannelMode.FLOW` — other strategies never execute |
| **Database** | Every query filters by `workspaceId` — FlowNodeConfig has `@@unique([workspaceId, flowKey])` |
| **LLM** | `FlowAgentLLM` reads from `FlowNodeConfig.systemPrompt` — never from shared AgentConfig |
| **FlowEngine** | Reads from `FlowNodeConfig.flows` — deterministic, 0 LLM calls, isolated per session via `ChatSession.context` |
| **Concurrency** | Existing customer-level lock in `ChatEngineService` prevents race conditions |
| **Translation** | Shared `TranslationAgent` — workspace-agnostic, safe to reuse |
| **Security** | Shared `SecurityAgent` — workspace-agnostic, safe to reuse |

---

## 3. Epic Map & Dependencies

```
E0 (Welcome Flag + Session Reset)  ←── independent, cross-cutting
         │
E1 (Database)  ←── CRITICAL BLOCKER for everything
    │
    ├── E2 (Engine)     ←── services already created, needs tests
    │      │
    │      ├── E3 (FlowAgentLLM)
    │      │      │
    │      │      └── E4 (Strategy Rewrite)
    │      │
    │      └── E7 (Tests)  ←── runs in parallel with E3/E4
    │
    ├── E5 (API Layer)  ←── can start after E1
    │      │
    │      └── E6 (Frontend)
    │
    └── E8 (Seed + PRD)  ←── can start after E1
```

### Execution order

| Phase | Epics | Can parallelize? |
|---|---|---|
| **Phase 1** | E0 (Welcome Flag + Session Reset) | ✅ Independent — can ship immediately |
| **Phase 2** | E1 (Database) | ❌ Blocker — must complete first |
| **Phase 3** | E2 (Engine tests) + E5 (API) | ✅ Parallel — E2 tests and E5 API have no dependency on each other |
| **Phase 4** | E3 (FlowAgentLLM) | ❌ Sequential — needs E1 + E2 |
| **Phase 5** | E4 (Strategy) + E6 (Frontend) | ✅ Partial parallel — E6 depends on E5, E4 depends on E3 |
| **Phase 6** | E7 (Full test suite) | ❌ Sequential — needs all components |
| **Phase 7** | E8 (Seed + PRD) | ✅ Can overlap with E7 |

---

## Epic E0a — Welcome Message Flag (cross-cutting)

> **Scope**: ALL chatbot types (ECOMMERCE, INFORMATIONAL, FLOW)
> **Priority**: P1 — can ship independently, no dependency on FLOW feature

### Problem

Currently, `Workspace.welcomeMessage` has a default value. If the admin clears the text, it becomes an empty string `""`.The handler at `welcome-message.handler.ts:136` already checks `if (!workspace || !workspace.welcomeMessage)` — so empty/null means no welcome.

**But**: The frontend Settings page uses `defaultWelcomeMessage` as fallback, so clearing the field resets to default instead of truly empty. There is no explicit ON/OFF toggle.

### Solution

Add a visible **toggle** in the Settings UI. When OFF:
- `welcomeMessage` stays in DB (admin can edit it for later)
- But the toggle prevents it from being sent
- Clear UX: admin sees "Welcome message is disabled"

### Implementation

#### Backend

**Schema change** — add boolean flag to `Workspace` model:

```prisma
enableWelcomeMessage  Boolean   @default(true)
```

**Handler change** — `apps/backend/src/utils/welcome-message.handler.ts` line ~136:

```typescript
// BEFORE:
if (!workspace || !workspace.welcomeMessage) {

// AFTER:
if (!workspace || !workspace.enableWelcomeMessage || !workspace.welcomeMessage) {
```

**API** — `workspace.service.ts update()` accepts `enableWelcomeMessage` field.

#### Frontend

**Settings UI** — `AIPersonalitySection.tsx`:

```
┌────────────────────────────────────────────────┐
│ Welcome Message                     [ON/OFF]   │
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ 👋 Welcome! I'm {{chatbotName}}...        │ │
│ │                                            │ │
│ └────────────────────────────────────────────┘ │
│ ⓘ When disabled, no message is sent on first  │
│   contact. The text is preserved for later.    │
└────────────────────────────────────────────────┘
```

When toggle is OFF → editor is greyed out (disabled) with `opacity-50`.

#### Migration

```sql
ALTER TABLE "Workspace" ADD COLUMN "enableWelcomeMessage" BOOLEAN NOT NULL DEFAULT true;
```

### Tests — E0a
|---|---|---|
| `chat-engine-welcome.spec.ts` | `enableWelcomeMessage = false` → no welcome sent | Flag disables welcome |
| `chat-engine-welcome.spec.ts` | `enableWelcomeMessage = true` + empty message → no welcome sent | Empty text still blocked |
| `chat-engine-welcome.spec.ts` | `enableWelcomeMessage = true` + message → welcome sent | Normal behavior preserved |
| `welcome-message-handler.spec.ts` | handler checks `enableWelcomeMessage` before proceeding | Handler logic |

### Build check — E0a

```bash
npm run prisma:generate     # Schema valid
npm run build               # TypeScript compiles
npm run test:unit           # All tests pass (including new + existing)
```

### Security — E0a

| Check | Status |
|---|---|
| `enableWelcomeMessage` only settable by authenticated workspace admin | ✅ Settings endpoint already behind 3-layer middleware |
| No injection via welcomeMessage text | ✅ Existing `{{variable}}` replacement is safe — only known variables |
| workspaceId isolation | ✅ Settings API filters by workspaceId |

### Acceptance Criteria — E0a

| # | Criterion |
|---|---|
| AC-E0a-1 | Toggle OFF → no welcome message sent (any channel type) |
| AC-E0a-2 | Toggle ON + empty text → no welcome message sent |
| AC-E0a-3 | Toggle ON + text → welcome message sent normally |
| AC-E0a-4 | Existing workspaces default to `enableWelcomeMessage = true` (backward compatible) |
| AC-E0a-5 | Toggle state persists across page reloads |
| AC-E0a-6 | Toggle is visible in Settings for ALL chatbot types |

---

## Epic E0b — Session Reset Timeout (cross-cutting)

> **Scope**: ALL chatbot types (ECOMMERCE, INFORMATIONAL, FLOW)
> **Priority**: P1 — can ship independently, no dependency on FLOW feature

### Problem

When a customer is escalated to a human operator (`contactOperator()`), the chatbot pauses and tells the customer to wait. But there is no mechanism to **automatically resume** the chatbot after a period of inactivity. The operator may never respond, leaving the customer stuck forever.

Each chatbot type has different "state" that accumulates:
- **ECOMMERCE**: Cart items, conversation context
- **INFORMATIONAL**: Conversation context, FAQ state
- **FLOW**: Flow state (`flowState`), machine context (`flowKey`)

All of these need to be cleaned up after a configurable timeout.

### Solution

Add a `sessionResetTimeout` field to the `Workspace` model. This defines how long to wait (in seconds) after the last escalation before automatically resetting the session state.

**At message time** (not via scheduler — check happens when next message arrives):
1. Check if `chatSession.escalatedAt` exists
2. If `now - escalatedAt > sessionResetTimeout` → reset session state:
   - ECOMMERCE: clear cart, reset conversation context
   - INFORMATIONAL: reset conversation context
   - FLOW: clear `flowState`, clear `flowKey` from `ChatSession.context`
3. If not expired → respond with "An operator has been contacted, please wait"

### Implementation

#### Backend

**Schema change** — add timeout field to `Workspace` model:

```prisma
sessionResetTimeout  Int   @default(3600)  // seconds — default 1 hour
```

**Logic** — in `ChatEngineService` (or strategy `route()` method), before processing:

```typescript
// Check if session was escalated and timeout has passed
if (chatSession.escalatedAt) {
  const elapsedSeconds = (Date.now() - chatSession.escalatedAt.getTime()) / 1000;

  if (elapsedSeconds > workspace.sessionResetTimeout) {
    // Reset session state based on chatbot type
    await this.resetSessionState(chatSession, workspace);
    // Continue processing the new message normally
  } else {
    // Still within timeout — operator may still respond
    return "An operator has been contacted. Please wait for their response.";
  }
}
```

**Reset logic per type**:

```typescript
async resetSessionState(session: ChatSession, workspace: Workspace) {
  switch (workspace.channelMode) {
    case 'ECOMMERCE':
      // Clear cart
      await this.cartRepository.clearCart(workspace.id, session.customerId);
      // Reset conversation context
      await this.chatSessionRepository.updateContext(session.id, {});
      break;

    case 'INFORMATIONAL':
      // Reset conversation context
      await this.chatSessionRepository.updateContext(session.id, {});
      break;

    case 'FLOW':
      // Clear flow state and flow key
      await this.chatSessionRepository.updateContext(session.id, {});
      break;
  }

  // Clear escalation flag
  await this.chatSessionRepository.clearEscalation(session.id);
}
```

#### Frontend

**Settings UI** — `AIPersonalitySection.tsx`:

```
┌────────────────────────────────────────────────┐
│ Session Reset Timeout                          │
│                                                │
│ ┌──────────────────────────────────┐           │
│ │ 1 hour                    ▼     │           │
│ └──────────────────────────────────┘           │
│ ⓘ How long to wait after operator escalation   │
│   before resetting the session. Applies to     │
│   cart (ecommerce), context, and flow state.   │
└────────────────────────────────────────────────┘
```

**Dropdown options**:

| Label | Value (seconds) |
|---|---|
| 1 hour | 3600 |
| 2 hours | 7200 |
| 4 hours | 14400 |
| 8 hours | 28800 |
| 12 hours | 43200 |
| 24 hours | 86400 |
| 48 hours | 172800 |
| 72 hours | 259200 |
| Never | 0 |

**Note**: `0` means never auto-reset — operator must manually close or the customer starts a new session.

#### Migration

```sql
ALTER TABLE "Workspace" ADD COLUMN "sessionResetTimeout" INTEGER NOT NULL DEFAULT 3600;
```

### Tests — E0b

| Test file | Test case | What it validates |
|---|---|---|
| `session-reset-timeout.spec.ts` | ECOMMERCE: escalatedAt + timeout expired → cart cleared, context reset | Cart cleanup |
| `session-reset-timeout.spec.ts` | INFORMATIONAL: escalatedAt + timeout expired → context reset | Context cleanup |
| `session-reset-timeout.spec.ts` | FLOW: escalatedAt + timeout expired → flowState + flowKey cleared | Flow state cleanup |
| `session-reset-timeout.spec.ts` | escalatedAt + timeout NOT expired → "please wait" response | Timeout not reached |
| `session-reset-timeout.spec.ts` | `sessionResetTimeout = 0` (Never) → always "please wait" | Never auto-reset |
| `session-reset-timeout.spec.ts` | No escalatedAt → normal processing (no check) | Non-escalated sessions |

### Build check — E0b

```bash
npm run prisma:generate     # Schema valid
npm run build               # TypeScript compiles
npm run test:unit           # All tests pass (including new + existing)
```

### Security — E0b

| Check | Status |
|---|---|
| `sessionResetTimeout` only settable by authenticated workspace admin | ✅ Settings endpoint already behind 3-layer middleware |
| Cannot set negative values (frontend validates dropdown) | ✅ |
| workspaceId isolation | ✅ Settings API filters by workspaceId |
| Reset does not delete messages — only clears cart/context/flow state | ✅ |

### Acceptance Criteria — E0b

| # | Criterion |
|---|---|
| AC-E0b-1 | ECOMMERCE: expired timeout → cart cleared + context reset |
| AC-E0b-2 | INFORMATIONAL: expired timeout → context reset |
| AC-E0b-3 | FLOW: expired timeout → flowState + flowKey cleared from context |
| AC-E0b-4 | Within timeout → "please wait" message returned |
| AC-E0b-5 | `sessionResetTimeout = 0` → never auto-reset |
| AC-E0b-6 | Existing workspaces default to 3600 (1 hour) — backward compatible |
| AC-E0b-7 | Dropdown visible in Settings for ALL chatbot types |

---

## Epic E1 — Database Layer

> **Priority**: P0 — CRITICAL BLOCKER
> **Files**: `packages/database/prisma/schema.prisma`, migration SQL, repository

### Tasks

| # | Task | File(s) | Status |
|---|---|---|---|
| E1-T1 | Delete wrong migration, create correct one | `packages/database/prisma/migrations/20260415*/` | ❌ |
| E1-T2 | Add `FlowNodeConfig` model to schema.prisma | `packages/database/prisma/schema.prisma` | ❌ |
| E1-T3 | Run `npx prisma generate` + `npx prisma migrate dev` | — | ❌ |
| E1-T4 | Create `flow-node-config.repository.ts` | `apps/backend/src/repositories/` | ❌ |

### Schema — FlowNodeConfig model

```prisma
model FlowNodeConfig {
  id                  String    @id @default(cuid())
  workspaceId         String
  flowKey             String
  flowLabel           String
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

  @@unique([workspaceId, flowKey])
  @@index([workspaceId])
  @@map("flow_node_configs")
}
```

### Repository — methods

```typescript
findByFlowKey(workspaceId, flowKey)      → FlowNodeConfig | null
findAllByWorkspace(workspaceId)          → FlowNodeConfig[]
create(workspaceId, data)                → FlowNodeConfig
update(workspaceId, id, data)            → FlowNodeConfig
delete(workspaceId, id)                  → void
```

### Tests — E1

| Test file | Test case | What it validates |
|---|---|---|
| `flow-node-config.repository.spec.ts` | `findByFlowKey` with valid data → returns config | Happy path |
| `flow-node-config.repository.spec.ts` | `findByFlowKey` with unknown flowKey → returns null | Not found |
| `flow-node-config.repository.spec.ts` | `create` with duplicate flowKey → throws P2002 | Unique constraint |
| `flow-node-config.repository.spec.ts` | `findAllByWorkspace` → returns only configs for that workspace | Workspace isolation |
| `flow-node-config.repository.spec.ts` | `delete` config from different workspace → not found | Cross-workspace protection |

### Build check — E1

```bash
npx prisma generate          # Client generated
npx prisma migrate dev       # Migration applied
npm run build                # TypeScript compiles
npm run test:unit            # No regressions
```

### Security — E1

| Check | Status |
|---|---|
| `@@unique([workspaceId, flowKey])` prevents cross-workspace flowKey collision | ✅ |
| `onDelete: Cascade` — workspace deletion cleans up FlowNodeConfigs | ✅ |
| Repository ALWAYS receives `workspaceId` as first parameter | ✅ |
| `flows` JSON stored as JSONB — no SQL injection risk (Prisma parameterized) | ✅ |

### Acceptance Criteria — E1

| # | Criterion |
|---|---|
| AC-E1-1 | `npx prisma generate` exits 0 |
| AC-E1-2 | `flow_node_configs` table exists with correct columns |
| AC-E1-3 | Duplicate `flowKey` in same workspace → P2002 error |
| AC-E1-4 | `findByFlowKey()` with nonexistent ID → null |
| AC-E1-5 | Deleting workspace cascades to FlowNodeConfig |
| AC-E1-6 | All repository methods filter by workspaceId |

---

## Epic E2 — Core Engine

> **Priority**: P0
> **Status**: Services created (90%), tests missing (0%)
> **Files**: `flow.types.ts` ✅, `flow-classifier.service.ts` ✅, `flow-engine.service.ts` ✅

### Tasks

| # | Task | Status |
|---|---|---|
| E2-T1 | `flow.types.ts` | ✅ Done |
| E2-T2 | `flow-classifier.service.ts` | ✅ Done |
| E2-T3 | `flow-engine.service.ts` | ✅ Done |
| E2-T4 | Unit tests: `flow-engine.service.spec.ts` | ❌ |
| E2-T5 | Unit tests: `flow-classifier.service.spec.ts` | ❌ |

### Tests — E2

| Test file | Test cases | Count |
|---|---|---|
| `flow-engine.service.spec.ts` | | |
| | `startFlow("non_parte")` → returns step_0 prompt, sets ACTIVE | 1 |
| | CHOICE node: input "3" → advances to transitions["3"] | 1 |
| | CONFIRMATION: "yes" → YES branch, "no" → NO branch | 2 |
| | ACTION: any input → transitions["default"] | 1 |
| | INFO terminal → flowStatus COMPLETED | 1 |
| | handle_escalate → shouldCallOperator: true | 1 |
| | HARD_BREAK input ("operator") → flowStatus ESCALATED | 1 |
| | SOFT_BREAK input ("stop") → flowStatus PAUSED | 1 |
| | interruptCount >= 4 → auto-escalation | 1 |
| | TTL expired (>30 min) → interruptCount reset | 1 |
| | Invalid nodeId format → descriptive error | 1 |
| | startFlow with unknown flowId → error | 1 |
| `flow-classifier.service.spec.ts` | | |
| | "1" → MATCH | 1 |
| | "operator" / "help" → HARD_BREAK | 1 |
| | "stop" / "cancel" → SOFT_BREAK | 1 |
| | "what programs?" → INTERRUPT_FAQ | 1 |
| | "done" / "ok" → AMBIGUOUS | 1 |
| | empty string → AMBIGUOUS | 1 |
| **Total** | | **18** |

### Build check — E2

```bash
npm run build                # TypeScript compiles
npm run test:unit            # All 18 tests pass
```

### Security — E2

| Check | Status |
|---|---|
| FlowEngineService never calls LLM — deterministic, no prompt injection risk | ✅ |
| classifyInput uses structural regex only (numbers, keywords) — no hardcoded phrases | ✅ |
| FlowEngineService validates `flowId` exists in `flows` before starting | ✅ |
| `resolveNode()` validates `flowId.nodeId` format | ✅ |

### Acceptance Criteria — E2

See 12 criteria (AC-E2-1 through AC-E2-12) in [flow-implementation-plan.md](../flow-implementation-plan.md#acceptance-criteria-e2).

---

## Epic E3 — FlowAgentLLM

> **Priority**: P0
> **Dependencies**: E1, E2
> **Pattern**: Follow `CustomerSupportAgentLLM.ts`

### Tasks

| # | Task | Status |
|---|---|---|
| E3-T1 | Create `FlowAgentLLM.ts` in `apps/backend/src/application/agents/` | ❌ |
| E3-T2 | Dynamic tool construction from `Object.keys(config.flows)` | ❌ |
| E3-T3 | `startFlow` tool_call → `FlowEngineService.startFlow()` | ❌ |
| E3-T4 | `contactOperator` tool_call → `contactOperator()` | ❌ |
| E3-T5 | History loading via `ConversationManager.loadHistory()` | ❌ |
| E3-T6 | Unit tests | ❌ |

### Architecture

```
FlowAgentLLM.handleQuery(workspaceId, customerId, flowKey, message)
  │
  ├── 1. FlowNodeConfigRepository.findByFlowKey(workspaceId, flowKey)
  │      → loads systemPrompt, model, temperature, flows, availableFunctions
  │
  ├── 2. ConversationManager.loadHistory(customerId, workspaceId)
  │      → last 24h messages
  │
  ├── 3. Build tools dynamically:
  │      tools = [
  │        { name: "startFlow", parameters: { flowId: { enum: Object.keys(flows) } } },
  │        { name: "contactOperator", ... }   // only if availableFunctions includes it
  │      ]
  │
  ├── 4. callLLM(model, [systemPrompt, ...history, userMessage], tools, temperature)
  │
  ├── 5a. tool_call "startFlow" → FlowEngineService.startFlow(flowId, context)
  │       → returns step_0 prompt (NO second LLM call — prompt IS the response)
  │
  ├── 5b. tool_call "contactOperator" → contactOperator(workspaceId, customerId, ...)
  │
  └── 6. Return { output, tokensUsed, functionCalls, executionTimeMs }
```

### Tests — E3

| Test file | Test cases | Count |
|---|---|---|
| `flow-agent-llm.spec.ts` | | |
| | Tool enum built from `Object.keys(flows)` — not hardcoded | 1 |
| | `contactOperator` tool absent if not in `availableFunctions` | 1 |
| | `systemPrompt` comes from FlowNodeConfig, not hardcoded | 1 |
| | `model` and `temperature` from FlowNodeConfig | 1 |
| | Config not found → throws descriptive error | 1 |
| | History loaded via ConversationManager | 1 |
| | `startFlow` tool_call → returns step_0 prompt as response | 1 |
| | workspaceId passed to all DB queries | 1 |
| **Total** | | **8** |

### Build check — E3

```bash
npm run build               # TypeScript compiles
npm run test:unit           # All 8 tests pass + no regressions
```

### Security — E3

| Check | Status |
|---|---|
| `systemPrompt` comes from DB — no hardcoded prompt injection surface | ✅ |
| `model` comes from DB — admin controls which LLM is used | ✅ |
| `flowId` validated by FlowEngineService before use | ✅ |
| History scoped to `customerId + workspaceId` | ✅ |
| Tool enum generated server-side from DB — customer can't inject tool names | ✅ |

### Acceptance Criteria — E3

See 8 criteria (AC-E3-1 through AC-E3-8) in [flow-implementation-plan.md](../flow-implementation-plan.md#acceptance-criteria-e3).

---

## Epic E4 — Strategy Rewrite

> **Priority**: P0
> **Dependencies**: E2, E3
> **File**: `apps/backend/src/strategies/flow-workspace.strategy.ts`

### Tasks

| # | Task | Status |
|---|---|---|
| E4-T1 | QR detection: `START_FLOW_{N}_{flowKey}` regex | ❌ |
| E4-T2 | Load FlowNodeConfig by flowKey, save to context | ❌ |
| E4-T3 | Route to FlowEngine when `flowState.flowStatus === "ACTIVE"` | ❌ |
| E4-T4 | Route to FlowAgentLLM otherwise | ❌ |
| E4-T5 | Wire TranslationAgent on output of both paths | ❌ |
| E4-T6 | Call contactOperator() if `shouldCallOperator` | ❌ |
| E4-T7 | Update ChatSession.context after each message | ❌ |
| E4-T8 | Unit tests | ❌ |

### Routing decision tree

```
route(context, workspace):
  │
  ├── message matches /^START_FLOW_(\d+)_(.+)$/ ?
  │     YES → extract flowNumber, flowKey
  │           → FlowNodeConfigRepo.findByFlowKey(workspaceId, flowKey)
  │           → save { flowKey, flowNumber } to ChatSession.context
  │           → return welcome: "Hi! I'm Sofia, your assistant for {flowLabel} (#{flowNumber})"
  │
  ├── context.flowState?.flowStatus === "ACTIVE" ?
  │     YES → FlowEngineService.handleMessage(input, context)
  │           → if shouldCallOperator → contactOperator()
  │           → TranslationAgent.translate(response)
  │           → save context to ChatSession
  │           → return translated response
  │
  └── else (text input, no active flow)
        → FlowAgentLLM.handleQuery(workspaceId, customerId, flowKey, message)
        → if tool_call startFlow → FlowEngine runs, step_0 prompt returned
        → if tool_call contactOperator → contactOperator()
        → TranslationAgent.translate(response)
        → save context to ChatSession
        → return translated response
```

### Tests — E4

| Test file | Test cases | Count |
|---|---|---|
| `flow-workspace.strategy.spec.ts` | | |
| | `canHandle(FLOW)` → true, `canHandle(ECOMMERCE)` → false | 1 |
| | QR message → loads FlowNodeConfig, saves flowKey to context | 1 |
| | QR with unknown flowKey → returns error message | 1 |
| | flowState ACTIVE → routes to FlowEngine, NOT FlowAgentLLM | 1 |
| | No active flow → routes to FlowAgentLLM | 1 |
| | FlowEngine output → TranslationAgent called | 1 |
| | FlowAgentLLM output → TranslationAgent called | 1 |
| | shouldCallOperator → contactOperator() called | 1 |
| | ChatSession.context saved after every message | 1 |
| | FlowEngine throws → strategy catches and returns readable error | 1 |
| | No flowKey in context + no QR → returns "scan QR first" hint | 1 |
| **Total** | | **11** |

### Build check — E4

```bash
npm run build               # TypeScript compiles
npm run test:unit           # All 11 tests pass + no regressions
```

### Security — E4

| Check | Status |
|---|---|
| QR code extraction uses regex — no eval or dynamic code execution | ✅ |
| flowKey from QR is validated against DB — unknown IDs rejected | ✅ |
| ChatSession.context stored as JSON — no SQL injection surface | ✅ |
| TranslationAgent on BOTH paths — no untranslated content leaks | ✅ |
| contactOperator() uses existing secure operator contact flow | ✅ |
| Strategy only executes for ChannelMode.FLOW | ✅ |

### Acceptance Criteria — E4

See 9 criteria (AC-E4-1 through AC-E4-9) in [flow-implementation-plan.md](../flow-implementation-plan.md#acceptance-criteria-e4).

---

## Epic E5 — API Layer

> **Priority**: P1
> **Dependencies**: E1
> **Files**: controller, routes, Swagger

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/workspaces/:workspaceId/flow-configs` | List all configs |
| GET | `/api/workspaces/:workspaceId/flow-configs/:id` | Get single config |
| POST | `/api/workspaces/:workspaceId/flow-configs` | Create config |
| PUT | `/api/workspaces/:workspaceId/flow-configs/:id` | Update config |
| DELETE | `/api/workspaces/:workspaceId/flow-configs/:id` | Delete config |

All endpoints use **3-layer middleware**: `authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation`

### Tasks

| # | Task | Status |
|---|---|---|
| E5-T1 | Create `flow-node-config.controller.ts` | ❌ |
| E5-T2 | Create `flow-node-config.routes.ts` | ❌ |
| E5-T3 | Register routes in main router | ❌ |
| E5-T4 | Add Swagger JSDoc to all endpoints | ❌ |
| E5-T5 | Unit tests for controller | ❌ |

### Tests — E5

| Test file | Test cases | Count |
|---|---|---|
| `flow-node-config.controller.spec.ts` | | |
| | GET /flow-configs → returns configs filtered by workspaceId | 1 |
| | GET /flow-configs/:id with wrong workspace → 404 | 1 |
| | POST /flow-configs with duplicate flowKey → 409 | 1 |
| | POST /flow-configs with valid data → 201 | 1 |
| | PUT /flow-configs/:id → updates successfully | 1 |
| | DELETE /flow-configs/:id from different workspace → 403 | 1 |
| | No auth token → 401 | 1 |
| **Total** | | **7** |

### Build check — E5

```bash
npm run build               # TypeScript compiles
npm run test:unit           # All 7 tests pass
# Manual: verify /api-docs shows new endpoints
```

### Security — E5

| Check | Status |
|---|---|
| 3-layer middleware on all endpoints | ✅ |
| Controller extracts workspaceId from `(req as any).workspaceId` | ✅ |
| Create validates JSON-parseable `flows` field | ✅ |
| DELETE verifies config belongs to workspace before deletion | ✅ |
| No `systemPrompt` exposed in list endpoint (optional — depends on need) | N/A |

### Acceptance Criteria — E5

See 5 criteria (AC-E5-1 through AC-E5-5) in [flow-implementation-plan.md](../flow-implementation-plan.md#acceptance-criteria-e5).

---

## Epic E6 — Frontend Admin UI

> **Priority**: P1
> **Dependencies**: E5
> **Pattern**: Follow existing pages (ProductsPage, ServicesPage)

### Tasks

| # | Task | Status |
|---|---|---|
| E6-T1 | Create `FlowConfigsPage.tsx` (list + table) | ❌ |
| E6-T2 | Create `FlowConfigSheet.tsx` (slide panel editor) | ❌ |
| E6-T3 | Create `flowConfigApi.ts` service | ❌ |
| E6-T4 | Add route in `App.tsx` | ❌ |
| E6-T5 | Add sidebar link (visible only for FLOW workspaces) | ❌ |

### UI Structure

See [02-flow-config-editor.md](./02-flow-config-editor.md) for full wireframes.

**List page**:
- Table: flowLabel, flowKey, model, isActive, flows count, updatedAt
- Actions: Edit (opens Sheet), Delete (confirm dialog)
- Button: [+ Add Flow Config]

**Sheet editor** (75% width slide panel):
- Top section: flowLabel, flowKey, model selector, temperature slider, maxTokens
- Middle: systemPrompt (Monaco editor, markdown mode)
- Bottom: flows JSON editor (Monaco, JSON mode, with validation)
- availableFunctions: checkboxes for startFlow, contactOperator
- isActive toggle
- Validation: JSON parse check + duplicate variable check

**Sidebar condition**: Link only visible when `currentWorkspace.channelMode === "FLOW"`.

### Tests — E6

| Test file | Test cases | Count |
|---|---|---|
| `FlowConfigsPage.spec.tsx` (vitest) | | |
| | Renders table with mock data | 1 |
| | Delete shows confirmation dialog | 1 |
| | All text in English | 1 |
| `FlowConfigSheet.spec.tsx` (vitest) | | |
| | Invalid JSON in flows → shows error, blocks save | 1 |
| | Valid data → calls API on save | 1 |
| **Total** | | **5** |

### Build check — E6

```bash
npm run build:frontend      # Vite build succeeds
npm run test -w apps/frontend   # All tests pass
```

### Security — E6

| Check | Status |
|---|---|
| Page only accessible to authenticated users | ✅ (Route guard) |
| API calls include workspace headers (interceptor) | ✅ |
| JSON editor sanitizes input before save | ✅ (JSON.parse validation) |
| No XSS via flowLabel or systemPrompt | ✅ (React escapes by default) |

### Acceptance Criteria — E6

See 5 criteria (AC-E6-1 through AC-E6-5) in [flow-implementation-plan.md](../flow-implementation-plan.md#acceptance-criteria-e6).

---

## Epic E7 — Tests

> **Priority**: P0 (runs throughout)
> **Rule**: Unit tests ONLY — no integration tests (Andrea's rule #7B)

### Test files summary

| Test file | Epic | Test count | Coverage target |
|---|---|---|---|
| `flow-node-config.repository.spec.ts` | E1 | 5 | >80% |
| `flow-engine.service.spec.ts` | E2 | 12 | >90% |
| `flow-classifier.service.spec.ts` | E2 | 6 | >95% |
| `flow-agent-llm.spec.ts` | E3 | 8 | >80% |
| `flow-workspace.strategy.spec.ts` | E4 | 11 | >85% |
| `flow-node-config.controller.spec.ts` | E5 | 7 | >80% |
| `FlowConfigsPage.spec.tsx` (frontend) | E6 | 3 | — |
| `FlowConfigSheet.spec.tsx` (frontend) | E6 | 2 | — |
| `chat-engine-welcome.spec.ts` (update) | E0a | 4 (new cases) | — |
| `session-reset-timeout.spec.ts` | E0b | 6 (new cases) | — |
| **Total** | | **64 new tests** | |

### Test execution

```bash
# Run all backend unit tests
cd apps/backend && npm run test:unit

# Run specific test file
npm run test:unit -- __tests__/unit/services/flow-engine.service.spec.ts

# Run with coverage
npm run test:coverage

# Run frontend tests
cd apps/frontend && npm test
```

### Test conventions (from rule #7A)

- Every test has `// SCENARIO:` and `// RULE:` comments explaining business logic
- Tests define truth — implementation follows tests
- Mocks can be updated; test logic cannot (without Andrea's approval)
- All comments in English

### Acceptance Criteria — E7

| # | Criterion |
|---|---|
| AC-E7-1 | `npm run test:unit` passes — all 64+ new tests pass |
| AC-E7-2 | Existing test suite does NOT regress |
| AC-E7-3 | No integration tests created |
| AC-E7-4 | Every test file has SCENARIO/RULE comments |
| AC-E7-5 | Coverage >80% on all new files |

---

## Epic E8 — Seed Data & PRD

> **Priority**: P2
> **Dependencies**: E1

### Tasks

| # | Task | Status |
|---|---|---|
| E8-T1 | Add FlowNodeConfig seed for HS-60XX washer | ❌ |
| E8-T2 | Add FlowNodeConfig seed for ED-340 dryer | ❌ |
| E8-T3 | Update PRD.md with FLOW channel type section | ❌ |
| E8-T4 | Update Neapolis workspace seed (channel settings, AgentConfigs) | ❌ |

### Seed data source

Use [04-neapolis-seed-config.md](./04-neapolis-seed-config.md) as the definitive seed data source. Flow JSON derived from PDFs:
- `SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf` → HS-60XX flows (non_parte, errore_alm, lavaggio_problema)
- `SOLUCIÓN-DE-PROBLEMAS-SECADORAS.pdf` → ED-340 flows (non_parte, errore_reset)

### PRD update — FLOW channel type section

Add to `docs/PRD.md` after the channelMode immutability section (~line 322):

```markdown
#### ChannelMode: FLOW (Guided Troubleshooting)

**Purpose**: Deterministic decision-tree chatbot for appliance/equipment troubleshooting.

**Use cases**: Self-service laundries, vending machines, equipment support kiosks.

**Key differences from ECOMMERCE/INFORMATIONAL**:

| Feature | ECOMMERCE | INFORMATIONAL | FLOW |
|---|---|---|---|
| Router LLM | Full multi-agent router | Single INFO_AGENT | FlowAgentLLM (per-config) |
| Calling functions | 7+ (product, cart, order...) | 3 (support, profile, language) | 2 (startFlow, contactOperator) + shared (support, profile, language) |
| Data source | Products, categories, offers | FAQ system | FlowNodeConfig.flows JSON |
| User entry | Free text | Free text | QR code scan → flowKey |
| Conversation model | Free-form | Free-form | Guided decision tree with exit points |
| DB model | Products, Carts, Orders | AgentConfig (FAQ) | FlowNodeConfig (per config) |

**Architecture**:
- `FlowWorkspaceStrategy` routes messages based on flow state
- `FlowAgentLLM` reads config-specific prompt from `FlowNodeConfig`
- `FlowEngineService` executes decision trees deterministically (0 LLM tokens)
- QR codes trigger config identification: `START_FLOW_{N}_{flowKey}`
- Escalation to operator via `contactOperator()` when flow reaches dead end
- CUSTOMER_SUPPORT agent included (same as Informational — `DELEGATE_TO_AGENT` pattern)

**Admin UI**: Settings → Flow Configs (visible only for FLOW workspaces)

**Data model**: See `FlowNodeConfig` in schema.prisma
```

### Build check — E8

```bash
npm run prisma:seed         # Seed runs without errors
npm run prisma:seed         # Run twice → idempotent (no duplicates)
npm run build               # PRD changes don't affect build
```

### Security — E8

| Check | Status |
|---|---|
| Seed data uses upsert (idempotent) | ✅ |
| All seed records include workspaceId | ✅ |
| No secrets or API keys in seed data | ✅ |

### Acceptance Criteria — E8

| # | Criterion |
|---|---|
| AC-E8-1 | `npm run prisma:seed` runs without errors |
| AC-E8-2 | HS-60XX config created with 3 flows (non_parte, errore_alm, lavaggio_problema) |
| AC-E8-3 | ED-340 config created with 2 flows (non_parte, errore_reset) |
| AC-E8-4 | Seed is idempotent — running twice creates no duplicates |
| AC-E8-5 | PRD.md has FLOW section explaining channelMode, architecture, data model |
| AC-E8-6 | Neapolis workspace has updated channel settings (botIdentity, welcomeMessage) |

---

## Definition of Done

An epic is DONE when ALL of the following are true:

| # | Check | Command |
|---|---|---|
| 1 | All tasks complete | — |
| 2 | All acceptance criteria pass | — |
| 3 | `npm run build` succeeds (no TypeScript errors) | `npm run build` |
| 4 | `npm run test:unit` passes (no regressions) | `npm run test:unit` |
| 5 | No Italian text in code, UI, or comments | Code review |
| 6 | All DB queries filter by workspaceId | Code review |
| 7 | No hardcoded prompts — all from DB | Code review |
| 8 | Swagger updated (if API changed) | Check `/api-docs` |
| 9 | No temporary files committed | `git status` |
| 10 | Files under 500 lines | Code review |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Migration conflict with existing wrong SQL | HIGH | HIGH | Delete old migration first, create fresh |
| FlowNodeConfig JSON too large for DB | LOW | MEDIUM | JSONB has no practical size limit in PostgreSQL |
| FlowAgentLLM tool_call returns malformed flowId | MEDIUM | LOW | FlowEngineService validates flowId before use |
| Concurrent messages corrupt ChatSession.context | LOW | HIGH | Existing customer-level lock in ChatEngineService |
| TranslationAgent reformats FlowEngine numbered list | MEDIUM | MEDIUM | Add `preserveFormatting: true` hint in prompt |
| Admin enters invalid JSON in flows editor | HIGH | LOW | Frontend validates JSON before save |
| Welcome message toggle breaks existing workspaces | LOW | HIGH | Default `enableWelcomeMessage = true` — backward compatible |
| Session reset timeout breaks escalated sessions | LOW | MEDIUM | Default 3600s (1h), `0` = never reset — backward compatible |
| PDF troubleshooting info is in Catalan/Spanish | N/A | N/A | Already translated to English in flow node prompts |
