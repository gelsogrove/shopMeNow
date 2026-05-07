# Architecture — ecolaundry

The chatbot is organised as **5 explicit layers**. Each layer has one
responsibility; together they handle every customer turn in 6 languages
without any layer trying to do another's job.

---

## 🔒 Iron rules (regole ferree del prodotto)

These are not negotiable. Every change to this codebase must respect them.

1. **No patches in the prompt** — when an LLM behaviour is wrong, the fix is
   a deterministic guard, a tool validator, or a post-processor invariant.
   Never another "DO NOT DO X" line in `prompts/agent.txt`.
2. **Tool refuses, LLM corrects** — tools validate args + semantics and
   return actionable errors. The LLM reads the error and retries correctly.
   We never trust the LLM to "remember" a rule from the prompt alone.
3. **One file = one responsibility** — files >150 lines that mix concerns
   must be split. The cassette structure (`tool-handlers/`, `guards/`,
   detectors, transitions) exists so each file is small and auditable.
4. **State transitions are named & atomic** — `markResolved(ar)`,
   `escalate(ar, reason)`, `requireCustomerName(ar)`, etc. live in
   `utils/state-transitions.ts`. Inline mutations of `pendingClosure`,
   `operatorRequested`, `pendingEscalation` outside that module are
   forbidden.
5. **Each detector ships with tests** — pure helpers in `utils/` (e.g.
   `mixed-signal.ts`, `flow-compatibility.ts`, `customer-name.ts`,
   `contradiction.ts`) MUST have a sibling `__tests__/unit/<name>.test.ts`
   covering happy path + edge cases. 100% coverage on the detector itself.
6. **No hardcoded phrase detection for INTENT** — phrases that route
   intent ("if user says 'order' then…") belong in the LLM. Phrases that
   detect *boundary signals* (greeting in reply, mixed-signal, contrast
   connectors) are allowed because they're observability/safety, not
   intent classification.
7. **Settings are law** — `json/settings.json` is the source of truth for
   tenant config (`enabledLanguages`, `defaultLanguage`, `maxToolHops`, …).
   `runtime.ts:validateSettings` fails fast if a required field is missing.
   No code path may produce a reply in a non-allowed language.
8. **Multi-language by design** — every detector/validator/transition
   covers all 6 supported languages (es, it, en, ca, pt, fr). Adding a
   new language means updating the catalogue + each detector's keyword
   list, with tests.

---

## 1. The 5 layers

```
USER TURN
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L1 — INPUT SANITISERS (utils/input-sanitize.ts)                      │
│   sanitizeUserMessage    strip control + zero-width chars, length cap│
│   sanitizePhoneNumber    digits-only filter + min-length floor       │
│   sanitizeForDisplay     strip markdown delimiters for operator text │
│   Resp: defence at the trust boundary in/out.                        │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L2 — STATE MANAGEMENT (utils/state.ts + utils/state-transitions.ts)  │
│   createInitialState        new session                              │
│   resetMachineFacts         topic-switch / new-incident wipe         │
│   markResolved / undoResolved  closure transitions                   │
│   escalate / requireCustomerName  escalation transitions             │
│   resetPostEscalationFlags  re-entry after a closed case             │
│   resetForNewIncident       convenience wrapper                      │
│   Resp: invariants of the SessionState; named atomic transitions.    │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L3 — DETECTORS (utils/<name>.ts)                                     │
│   customer-name.ts        validateCustomerName                       │
│   mixed-signal.ts         detectMixedSignal                          │
│   flow-compatibility.ts   checkFlowCompatibility                     │
│   contradiction.ts        detectResolutionEscalationContradiction    │
│   Resp: pure deterministic helpers, multilingual, unit-tested.       │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L4 — TOOL CONTRACTS (utils/agent-tools.ts + utils/tool-handlers/)    │
│   agent-tools.ts             schemas exposed to the LLM              │
│   tool-handlers/index.ts     dispatcher (KNOWN_TOOLS + executeTool)  │
│   tool-handlers/location.ts  set_location, set_location_street       │
│   tool-handlers/machine.ts   set_machine_facts, set_payment_facts,   │
│                              set_display_state                       │
│   tool-handlers/flow.ts      start_machine_flow, advance_machine_flow│
│   tool-handlers/customer.ts  capture_customer_name                   │
│   tool-handlers/closure.ts   escalate_to_operator, mark_resolved,    │
│                              request_photo                           │
│   tool-handlers/faq.ts       apply_faq_override                      │
│   Resp: validate args (arg-coercion.ts), validate semantics (L3),    │
│         apply state transitions (L2), return ToolResult.             │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L5 — OUTPUT POLICIES (agent.ts:polishReplyForTurn)                   │
│   sanitizeCustomerReply           strip role-leak / format quirks    │
│   enforceNoContradiction          drop resolution sentence when the  │
│                                    same reply also escalates         │
│   prependFirstTurnWelcome         T1 welcome unless LLM greeted or   │
│                                    customer already gave facts       │
│   stripWelcomeParagraphs          T2+ remove re-introduced greetings │
│   appendEscalationSummary         operator handover when escalated   │
│   Resp: invariants on the reply BEFORE returning to the customer.    │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
REPLY TO CUSTOMER
```

---

## 2. Where each thing lives

| Concern | File(s) | Layer |
|---|---|---|
| Customer message sanitisation | `utils/input-sanitize.ts` | L1 |
| Phone number sanitisation | `utils/input-sanitize.ts` | L1 |
| Operator-facing markdown safety | `utils/input-sanitize.ts` | L1 |
| Initial session state | `utils/state.ts:createInitialState` | L2 |
| Per-incident state wipe | `utils/state.ts:resetMachineFacts` | L2 |
| Named closure / escalation transitions | `utils/state-transitions.ts` | L2 |
| Customer-name validation | `utils/customer-name.ts` | L3 |
| Mixed-signal detection | `utils/mixed-signal.ts` | L3 |
| Flow / machine compatibility | `utils/flow-compatibility.ts` | L3 |
| Resolution/escalation contradiction | `utils/contradiction.ts` | L3 |
| Tool schema for the LLM | `utils/agent-tools.ts` | L4 |
| Tool dispatcher | `utils/tool-handlers/index.ts` | L4 |
| Per-cassette tool handlers | `utils/tool-handlers/<topic>.ts` | L4 |
| Strict arg coercion helpers | `utils/tool-handlers/arg-coercion.ts` | L4 |
| Reply post-processing | `agent.ts:polishReplyForTurn` | L5 |
| Welcome prepend / strip | `utils/agent-welcome.ts` (called from L5) | L5 |
| Escalation summary | `utils/escalation.ts` (called from L5) | L5 |
| Logger | `utils/logger.ts` | cross-cutting |
| Settings validation | `utils/runtime.ts:validateSettings` | bootstrap |

---

## 3. The hybrid pipeline (orchestrator)

`agent.ts:agentTurn()` is the single entry point. See
[`docs/orchestrator.md`](orchestrator.md) for the step-by-step diagram.

```
1. sanitizeUserMessage         (L1)
2. ar.state.lastUserMessage = userMessage
3. resolveLanguageForTurn      (L2)
4. autoExtractFacts            (L3 — sticky facts from regex)
5. runGuardPipeline            (deterministic, ~70% of conversations close here)
   └─ guards mutate state via L2 transitions (escalate / markResolved / …)
6. runLlmLoop                  (L4 — LLM + tool calls)
   └─ each tool: arg-coercion → L3 detectors → L2 transitions → ToolResult
7. polishReplyForTurn          (L5 — invariants + welcome handling)
8. appendEscalationSummary     (L5 — operator handover when applicable)
```

---

## 4. Why hybrid (deterministic + LLM)?

- **Deterministic guards** — auditable, free, instant, regression-friendly.
  About 70% of real conversations close without ever reaching the LLM.
- **LLM tool calling** — handles the long tail / context switches / FAQ.
- **Sticky state** — survives across turns so context-switching is natural
  (the customer can ask about pricing mid-troubleshooting and come back).
- **Tool contracts** — the LLM's freedom is bounded by validators that
  refuse invalid actions and guide it to the right one.

---

## 5. Run modes — same code in both

- **CLI**: `npm run demo` → calls `agentTurn()` interactively.
- **Web**: `index.ts:chatbotFn` wraps `agentTurn()` with the API shape
  `CustomClientChatbotService` expects. Identical behaviour.

---

## 6. Testing strategy

- **Unit tests** (`__tests__/unit/*.test.ts`) — pure detectors, helpers,
  state transitions, contracts. No LLM. Run with `npm run test:unit`.
- **Agent E2E** (`__tests__/agent/*.test.spec.ts`) — full conversation
  scenarios, require an LLM key. Run with `npm run test:agent`.

The unit suite is the safety net: every refactor MUST keep it green.
The E2E suite catches LLM regressions; it is slower and not free.

---

## 7. pendingFlow lifecycle — ask vs await

`pendingFlow` is the conversation-control flag for multi-step flows
(caso4 cambio, caso6 doble cobro, caso8 código, caso9 invoice, caso17
photo, …). Every flow has two phases distinguished by suffix:

```
state.pendingFlow = "<flowId>-ask-<topic>"     ← gathering phase (deterministic)
state.pendingFlow = "<flowId>-await-<topic>"   ← LLM-driven phase (interpret reply)
```

### Why the two phases

The bot needs deterministic gathering to collect facts (location,
machineType, machineNumber, …). The "force gather" guards
(`forceLocation`, `forceMachineType`, `forceMachineNumber`,
`forceDisplay`, …) handle this — they preempt the LLM and ask the
missing fact. This is correct ONLY when no specific flow is currently
asking the customer to interpret a question.

When the bot has just asked a closed yes/no/situation question
("¿la central te ha devuelto el cambio?", "¿qué le pasa exactamente?"),
the gather guards MUST step aside — they have no business asking about
display state while the customer is supposed to answer the bot's
question.

### Enforcement

[`utils/guards/helpers.ts`](../utils/guards/helpers.ts):

```ts
export function isAwaitingPendingFlow(state: SessionState): boolean {
  return Boolean(state.pendingFlow) && state.pendingFlow.includes('-await-')
}

export function notInActiveSubFlow(ar: AgentRuntime): boolean {
  return (
    !ar.state.activeFlowId &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested &&
    !isAwaitingPendingFlow(ar.state)   // ← stop gather guards in -await-
  )
}
```

Every "force gather" guard already calls `notInActiveSubFlow(ar)`, so
the new check applies uniformly.

### Naming contract for new pendingFlow values

When adding a new multi-step flow:

1. **Gathering phase** (still asking facts) → suffix with `-ask-<topic>`.
   Example: `caso4-ask-cambio`, `caso6-ask-relato`.
2. **LLM phase** (waiting for customer reply to be interpreted) →
   suffix with `-await-<topic>`. Example: `caso4-await-cambio`,
   `caso8-await-name`.

This naming is the contract that makes `isAwaitingPendingFlow` work.
A new pendingFlow with a non-conforming name (e.g. `caso9-pending-name`)
will not trigger the guard suppression and will likely cause the bug
this section was created to prevent.

---

## 8. Knowledge model — two-tier FAQ

The bot has TWO independent FAQ sources. They serve different purposes
and MUST stay separate.

### Tier 1 — System FAQs (deterministic, key-based)

Stable, well-defined Q&A that need deterministic mapping. Referenced by
guards, locations, and the LLM prompt via semantic keys.

| Property | Value |
|---|---|
| Storage | `json/faqs.json` (bundled file) |
| Per-pueblo overrides | `json/locations.json:faqOverrides` |
| LLM access | `apply_faq_override(faqKey)` tool |
| Examples | `washDryTime`, `openingHours`, `paymentMethods`, `pricing` |
| Lifecycle | Code redeploy |
| Multilingual | i18n catalogue (`json/i18n/<lang>.json`) when needed |

### Tier 2 — Workspace FAQs (dynamic, prompt-injected)

Business-curated content edited by the PM from the backoffice without
redeploy. Free-form questions; no semantic key required.

| Property | Value |
|---|---|
| Storage | Postgres `FAQ` table (`workspaceId`, `question`, `answer`, `keywords`, `category`, `order`, `isActive`) |
| Multilingual | NOT a stored property — the translation layer (`prompts/history.txt`) translates the matched FAQ inline to the customer's language. Stored in the workspace base language (es for ecolaundry) |
| LLM access | `{{faq}}` block injected into the system prompt |
| Token budget | `settings.maxFaqInjectionTokens` (default 2000) — enforced by chat-engine, log warn on truncation |
| Lifecycle | Backoffice edit → cache invalidation → next turn |

### Data flow (Tier 2)

```
Backoffice CRUD ─► faqs table (Postgres)
                              │
                              ▼
chat-engine (apps/backend/src/…)
  WorkspaceFaqService.getActiveFaqs(workspaceId)
    cache: in-memory Map, 5-min TTL, key = workspaceId
    invalidation: POST /api/internal/faq/cache/invalidate
    budget:    truncate to maxFaqInjectionTokens, log warn
                              │
                              ▼
ChatbotInput.context.workspaceFaqs = [{question, answer}, …]
                              │
                              ▼
custom-ecolaundry/index.ts
  ar.runtime.workspaceFaqs = input.context.workspaceFaqs ?? []
  (passed through, zero Prisma in this module)
                              │
                              ▼
utils/agent-prompt.ts:buildSystemPrompt
  renders {{faq}} placeholder as:
    "📚 WORKSPACE FAQ (fallback for free-form):
     Q: …
     A: …
     …"
```

### Why this split?

- **Stability vs freshness**: Tier 1 is part of the bot's contract
  (guards reference these keys); changing one is a code change. Tier 2
  is editable content; PM changes it without engineering.
- **Cache friendliness**: Tier 1 lives in the system prompt as plain
  rules; Tier 2 is appended once per session (and re-fetched on edit).
  Splitting keeps Tier 1 cacheable and Tier 2 invalidatable.
- **Zero-deps preservation**: Prisma stays in chat-engine; custom-
  ecolaundry receives FAQs as data, not as a database connection.
- **Iron rule alignment**: rule #7 (settings are law). The data
  structure, cache TTL, token budget all live in `settings.json` —
  no magic numbers in code.

### LLM instruction (in `prompts/agent.txt`)

The system prompt tells the LLM: "for known FAQ keys, ALWAYS prefer
`apply_faq_override(faqKey)`; only fall back to the `{{faq}}` block
for free-form questions that don't match any known key."

### Anti-patterns (forbidden)

- ❌ Importing Prisma into `custom-ecolaundry/` (preserves zero-deps)
- ❌ Adding a `language` column to `FAQ` (translation belongs in the
  prompt layer, not in storage)
- ❌ Using `{{faq}}` for stable system FAQs (they belong in
  `json/faqs.json` with a key — Tier 1)
- ❌ Merging Tier 1 + Tier 2 in the same data structure or tool

---

## 8. Adding to the system

When you need to add a new behaviour, ask: *which layer?*

- **New customer-input vector** (e.g. accept emoji codes) → L1 sanitiser.
- **New conversational state field** → L2 (`models/state.ts` +
  `createInitialState` + maybe a transition in `state-transitions.ts`).
- **New helper** to classify a reply pattern → L3 detector + tests.
- **New tool exposed to the LLM** → schema in `agent-tools.ts` + handler
  in `tool-handlers/` + register in `tool-handlers/index.ts:HANDLERS`.
- **New invariant on the final reply** → L5 step in `polishReplyForTurn`.

For full per-tool contracts see [`docs/contracts.md`](contracts.md).
For step-by-step recipes see [`docs/adding-use-cases.md`](adding-use-cases.md).
