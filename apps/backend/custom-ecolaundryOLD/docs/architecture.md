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

## 0. Statechart pattern — the new architecture (2026-05-27)

**Andrea's decision (2026-05-27)**: custom-ecolaundry is migrating from a
guard-pipeline model to a **statechart-driven model** using XState. The
migration is incremental — both architectures coexist while families of
use-cases are moved one by one. See [`machines/PLAN.md`](../machines/PLAN.md)
for the full roadmap.

### Why the change

The guard-pipeline model produced a class of bugs Andrea calls "tante
pezze":
- **State sparso** in 40+ `AgentState` fields, each guard reading/writing
  what it needs
- **Cleanup parziale**: `releaseActiveFlow` doesn't wipe operational facts
  (DOOR-sticky bug 2026-05-26)
- **11+ guards each re-checking 4 preconditions** — coordination by mutation
- **Iron rules v1 contradictory**: #1 forbids prompt patches, #6 sends
  phrase routing to LLM, #14 forbids hardcoded phrase detection — together
  they trap us when reliable phrase detection is needed

### What the statechart fixes structurally

| v1 problem | v2 mechanism |
|------------|--------------|
| State sparso | Single `TroubleContext` mutated only by `assign(...)` in machine |
| Sticky branch | `closed` state is terminal absorbing; OPEN_INCIDENT is only escape |
| Cleanup parziale | `entry: resetOperationalFacts` on `resolved` state |
| Guard pipeline ad accumulo | Explicit state transitions, no implicit coordination |
| Router LLM single point of failure | Detector emits typed events deterministically; LLM polish only renders |
| Iron rules contradictory | 3 v2 rules with clear scope, no contradictions |

### v2 iron rules (3, govern `machines/`)

1. **Statechart is the sole authority on dialogue state** — only `assign(...)`
   inside a machine mutates context. No external code touches it.
2. **Detector emits events, never mutates state** — phrase detection is
   allowed because output is typed `TroubleEvent[]`, not state changes.
3. **Cleanup is on-exit, never manual** — entering `resolved` runs
   `resetOperationalFacts`. No `releaseX` calls scattered.

### The 6 families covering all 46 use cases

| Family | Use cases | Statechart file | Status |
|--------|-----------|-----------------|--------|
| A — machine-incident | 1, 2, 3, 13-18, 30, 46 | `machines/trouble-machine.machine.ts` | ✅ Phase 1+2 |
| B — payment-incident | 4, 6, 7, 19-24, 26-28, 32 | `machines/payment.machine.ts` | ✅ Phase 2 |
| C — discount / loyalty | 8, 10, 11 | `machines/discount-loyalty.machine.ts` | ✅ Phase 2 |
| D — invoice | 9 | `machines/invoice.machine.ts` | ✅ Phase 2 |
| E — FAQ | 12, 34-45 | `machines/faq.machine.ts` | ✅ Phase 2 |
| F — escalation triggers | 25, 29, 31, 33 | `machines/escalation.machine.ts` | ✅ Phase 2 |

**Root orchestrator**: `machines/root-orchestrator.ts` coordinates the 6
branch actors. It tracks `activeBranch`, routes events to the right child,
implements FAQ pause/resume (FAQ can fire mid-flow without breaking the
parent's gather position), and aggregates `pendingReply` for the orchestrator
caller to read.

### Architecture diagram

```
                  ┌───────────────────────────────────────┐
                  │   Event Detector (per family)         │
                  │ raw text + lang → TroubleEvent[]      │
                  └───────────────────────────────────────┘
                                   │
                                   ▼
                  ┌───────────────────────────────────────┐
                  │   Root Dispatcher (future Phase 2)    │
                  │   tracks activeBranch → forwards      │
                  │   handles topic-switch globally       │
                  └───────────────────────────────────────┘
                                   │
              ┌────────────┬───────┴──────┬──────────────┐
              ▼            ▼              ▼              ▼
        trouble-machine  payment        faq          escalation
              ▼            ▼              ▼              ▼
        gather→flow→     gather→         topic→       askName→
        resolve/escala   form→escala     answer       close
```

### Cleanup contract (structural fix for the bug-class)

After every transition into a terminal state (`resolved`, `escalating.done`),
the `entry` action `resetOperationalFacts` wipes:
- `location`, `machineType`, `machineNumber`, `displayState`, `displayHistory`
- All `*AskAttempts` retry counters
- `pendingReply`

Customer identity (`customerName`, `language`) is preserved.

The `closed` state then becomes terminal absorbing — it has NO transitions
out except `OPEN_INCIDENT` (which itself runs `resetOperationalFacts`
again on re-entry). Topic-switch events (`REQUEST_TOPIC_SWITCH`) are
handled at the top level but DO NOT transition out of `closed`.

This makes the DOOR-sticky bug **structurally impossible**: after a
resolution, there is no way for the bot to re-emit the DOOR guide
without the customer explicitly opening a NEW incident.

### Natural dialogue guarantees

1. **Out-of-order facts**: customer says "ho la lavatrice 5 a Pineda con
   DOOR" → detector emits 4 PROVIDE events; `gathering.evaluating` cascade
   routes each to its slot in one turn. State jumps `idle → flow.guiding`
   in a single transition.

2. **Question mid-flow**: customer asks "che orari?" while gathering
   → `REQUEST_TOPIC_SWITCH(hours)` at top level emits a handoff reply;
   state stays put; next turn resumes gathering exactly where it was.

3. **Composite messages**: "bene grazie funziona ma dimmi orari?" →
   detector recognises both resolution AND topic-switch; resolution wins
   (closes the flow); the next turn's "e prezzi?" is answered cleanly from
   `closed` state.

4. **Multi-language**: detectors cover 6 languages (es, it, en, ca, pt, fr);
   i18n keys are language-agnostic. The polish LLM renders in
   customer's session language. Same statechart, all 6 languages.

5. **LLM responds based on state, not on guess**: the statechart emits
   `(i18nKey, vars, stage)`. The polish layer renders. The LLM never
   decides "what to say" autonomously — only "how to say it naturally".

### Verification

```bash
cd apps/backend/custom-ecolaundry
npm run typecheck                       # green required
npm run demo:statechart -- --debug      # standalone, offline, prints transitions
npm run demo                            # full pipeline (needs OPENROUTER_API_KEY)
```

The `--debug` mode of `demo:statechart` prints, for each turn:
- the events the detector produced
- the state transition (before → after)
- the i18n key the statechart picked

### Migration phases (overview)

- **Phase 1** ✅ (2026-05-27): Family A skeleton + Andrea's DOOR-sticky bug
  fixed structurally; statechart NOT wired (zero production risk)
- **Phase 2** ✅ (2026-05-27): Families B/C/D/E/F + root orchestrator
  + multi-family detector; demo 7/7 across all families
- **Phase 3** ✅ (2026-05-27): integrated behind `useStatechartRouter`
  feature flag (default OFF). agent.ts calls the statechart first when
  flag ON; falls back to legacy on null. LLM polish layer reuses
  agent-rephrase.ts. v1 84 test suites unchanged.
- **Phase 4** ⏳: deprecate v1 guards family by family; remove sticky
  branch logic once statechart is proven in production with the flag on.

### How to enable the statechart in production

```jsonc
// json/settings.json
{
  "useBranchRouter": true,         // required precondition
  "useStatechartRouter": true,     // opt-in, default false
  "naturalRephrase": true          // recommended for natural replies
}
```

When `useStatechartRouter=true`:
1. agent.ts calls `statechartTurn(session, userMessage)` BEFORE the
   legacy branch-router.
2. The bridge runs the family-detector, dispatches events to the right
   actor, and emits `pendingReply` (i18nKey + vars + stage).
3. The polish layer calls `tt()` to localise, then `rephraseForTurn()`
   to add natural tone.
4. The reply goes back to agent.ts, which appends the escalation summary
   (if any) and returns to the customer.
5. If the statechart returns `null` (no events recognised, no active
   branch), agent.ts falls through to the legacy pipeline — graceful
   coexistence during the migration.

The legacy guard pipeline below (§1-§23) describes Phase 0 architecture;
it remains operative for everything not yet migrated.

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
│                                                                      │
│   PRE-EXTRACT SNAPSHOTS (turn-local L2): some guards need to compare │
│   a state field BEFORE vs AFTER autoExtractFacts to detect in-turn   │
│   changes. The snapshot is taken in agent.ts before STEP 2.          │
│   Current instances:                                                 │
│     - displayStateAtTurnStart → consumed by Phase B pivot in         │
│       guards/display.ts to detect "no + new display" combos.         │
│   Pattern documented in CLAUDE.md "Pre-extract state snapshots".     │
│                                                                      │
│   CHRONOLOGICAL FIELDS (F27, F28):                                   │
│     - displayHistory: string[]   — every distinct display label the  │
│       customer has reported during this incident. Pushed by          │
│       autoExtractFacts on each display change; rendered in the       │
│       operator handover summary as "Secuencia: SEL → PUSH → DOOR".  │
│     - faqPause: boolean          — set true when detectFaqPause      │
│       fires during an active flow; cleared on the next turn.         │
│       Drives the L5 "resumeAfterFaq" invariant.                      │
└──────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ L3 — DETECTORS (utils/<name>.ts)                                     │
│   customer-name.ts        validateCustomerName                       │
│   mixed-signal.ts         detectMixedSignal                          │
│   flow-compatibility.ts   checkFlowCompatibility                     │
│   contradiction.ts        detectResolutionEscalationContradiction    │
│   intent.ts               extractDisplayState, detect{*}Intent,       │
│                           detectFaqPause (F28), detectPaidNot...     │
│   Resp: pure deterministic helpers, multilingual, unit-tested.       │
│   Note: intent.ts detectors are FAST PATH only. Authoritative intent │
│   classification is delegated to the LLM router (utils/router.ts).   │
│   See section 9 below.                                               │
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
│   resumeAfterFaq invariant (F28)  append "¿Sigamos con tu problema?" │
│                                    when state.faqPause + pendingFlow │
│   appendEscalationSummary         operator handover when escalated   │
│                                    (with displayHistory chronology   │
│                                    via F27 in escalation.ts)         │
│   naturalRephrase (opt-in flag)   pass guard outcome through         │
│                                    rephrase LLM with conversation    │
│                                    history. 5 responsibilities:      │
│                                    ① language (always customer's)    │
│                                    ② name (weave if known)           │
│                                    ③ tone + emoji (1-2, empathic)    │
│                                    ④ security (strip unauth URLs,    │
│                                       block prompt-injection)        │
│                                    ⑤ content (preserve keywords,     │
│                                       no invented details — F32)     │
│                                    Bypassed for PII flows (invoice-),│
│                                    display flows (F56), bullet lists  │
│                                    (F41), discount-code ask (F49).   │
│                                    Prompt: prompts/rephrase.txt.     │
│                                    Temp: settings.rephraseTemperature│
│                                    (default 0.6).                    │
│   operatorBriefingFromLlm (flag)  generate operator handover summary │
│                                    via LLM with full history         │
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
4. dispatchTurnOne / Subsequent (router LLM at T1, sticky T2+)
   └─ classifies branch + subCase + language → seeds state
   └─ trouble-machine handler → maps subCase → state.pendingFlow
5. autoExtractFacts            (L3 — sticky facts; regex as FAST PATH)
6. runGuardPipeline            (deterministic, ~70% of conversations close here)
   └─ guards mutate state via L2 transitions (escalate / markResolved / …)
7. runLlmLoop                  (L4 — LLM + tool calls, only if no guard fired)
   └─ each tool: arg-coercion → L3 detectors → L2 transitions → ToolResult
8. polishReplyForTurn          (L5 — invariants + welcome + naturalRephrase)
9. appendEscalationSummary     (L5 — operator handover, with displayHistory)
```

**Two opt-in LLM polish stages** ([settings.json](../json/settings.json)):
- `naturalRephrase: true`  — guard outcomes pass through `agent-rephrase.ts`
  with conversation history for tone-matching; preserves all keywords
  (display codes, location names, operational verbs).
- `operatorBriefingFromLlm: true` — operator handover summary generated
  by `operator-briefing.ts` from history; falls back to deterministic
  template on any error.

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

- **CLI REPL**: `npm run demo` → calls `agentTurn()` interactively
  (stdin/stdout, human-driven).
- **CLI batch** (added 2026-05-22): `npm run demo -- --batch '[...]'` →
  calls `agentTurn()` programmatically over a pre-supplied JSON array of
  scenarios. Each scenario is an array of turn strings; the literal
  `"/reset"` marker creates a fresh session. Output includes per-turn
  `[USER]`/`[BOT]` markers plus a `[STATE T-end]` snapshot per scenario.
  Used by the `chatbot-eval` skill for diff-driven QA. Identical
  `agentTurn()` codepath — no test-only branches.
- **Web**: `index.ts:chatbotFn` wraps `agentTurn()` with the API shape
  `CustomClientChatbotService` expects. Identical behaviour.

---

## 6. Testing strategy

- **Unit tests** (`__tests__/unit/*.test.ts`) — pure detectors, helpers,
  state transitions, contracts. No LLM. Run with `npm run test:unit`.
- **Agent E2E** (`__tests__/agent/*.test.spec.ts`) — full conversation
  scenarios, require an LLM key. Run with `npm run test:agent`.
- **Diff-driven eval** via the [`chatbot-eval` skill](../../../.claude/skills/chatbot-eval/SKILL.md)
  — Andrea triggers it with "testa quello che abbiamo fatto"; the skill
  reads `git diff main...HEAD`, picks 3-6 mirrored scenarios, runs
  `npm run demo -- --batch`, evaluates each reply against iron rules +
  F-log, STOPS on bug to type out the Bug intake protocol, applies the
  layer-correct fix only after Andrea's OK, then re-runs verification
  (typecheck + test:unit + check-architecture + f-log-regression). Costs
  OpenRouter API calls; scenario count is proportional to diff scope.

The unit suite is the safety net: every refactor MUST keep it green.
The E2E suite catches LLM regressions; it is slower and not free.
The skill complements the agent suite for ad-hoc cross-language /
cross-flow scenarios that haven't yet been turned into permanent agent
tests — when a skill run surfaces a new bug, the F-log entry pin in
`f-log-regression.test.ts` is mandatory (it's a unit test, so it lives
in the safety net immediately).

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

## 8. Knowledge model — system FAQs

The bot reads FAQs from a single source bundled with the module.

### System FAQs (deterministic, key-based)

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

### Future work — workspace-editable FAQs

A second tier of business-curated FAQs editable from the backoffice
(without redeploy) was planned but **not implemented today**. If/when
added it must:
- live in a Postgres `FAQ` table read by the parent chat-engine, never
  by this module (zero-Prisma rule preserved)
- be passed through `ChatbotInput.context.workspaceFaqs` as data
- be injected as a `{{faq}}` block in the system prompt
- prefer `apply_faq_override(faqKey)` for any keyed question — the
  `{{faq}}` block would be the fallback for free-form questions only

Until then, every FAQ change is a code change to `json/faqs.json` plus
release.

### Anti-patterns (forbidden)

- ❌ Importing Prisma into `custom-ecolaundry/` (preserves zero-deps)
- ❌ Hardcoding FAQ answers in TS source (they belong in
  `json/faqs.json` with a stable key)
- ❌ Using `apply_faq_override` for free-form questions (the tool
  expects known semantic keys)

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
- **New trouble-machine sub-case** → extend `TroubleSubCase` type in
  `utils/router.ts` + add classification example to `prompts/router.txt` +
  wire-up in `branches/trouble-machine/handler.ts` (set `pendingFlow`).

For full per-tool contracts see [`docs/contracts.md`](contracts.md).
For step-by-step recipes see [`docs/adding-use-cases.md`](adding-use-cases.md).

---

## 9. Branch router LLM (intent classification)

The pipeline starts with a **single LLM classification call** that picks a
branch and (for `trouble-machine`) the sub-case. Detailed contract in
[`docs/branch-router-architecture.md`](branch-router-architecture.md).

```
T1 customer message
        ↓
   utils/router.ts:classifyMessageBranch  (~500ms, ~$0.0005, low temperature)
        ↓
   { branch: greeting | faq | trouble-machine | invoice | loyalty |
                escalation | unknown,
     language: es|it|en|pt|ca|fr,
     details: { faqKey?, displayHint?, locationHint?,
                subCase?, incidentType? } }
        ↓
   utils/branches/<branch>/handler.ts
        ↓
   T2+ → state.activeBranch is sticky → no router call
```

**Why this exists**:
- Replaces fragile regex L3 detectors as the primary intent classifier.
- Handles all 6 supported languages natively (no per-language keyword lists).
- Sub-case routing (F31): `subCase` field tells the trouble-machine handler
  which `pendingFlow` to seed (`paid-not-activated` → `'no-change-ask'`,
  `display-unreadable` → `'photo-await-decision'`, etc.). The regex L3
  detectors in `agent-extract.ts` remain only as FAST PATH optimisations.

**Settings flag**: `useBranchRouter: true` (default ON in this tenant).
When OFF, the legacy guard pipeline runs unchanged.

**Cost discipline**: 1 router LLM call per session at T1, 0 at T2+
(sticky branch). Average per turn cost is bounded.

---

## 10. Display flow Phase A/B/C (machine incidents)

The display-driven Casi (1, 2, 3, 5, 13, 14, 15, 16, 30) all flow through
`utils/guards/display-flow.ts`, which reads declarative entries from
`json/display-flows.json` (validated at boot via `models/display-flow.ts`).

```
Phase A — instruction emission
   guard fires when state.displayState matches a documented flow
   → emit guidance reply, set state.activeFlowId

Phase B — failure / re-ask before escalating
   customer says "no funciona" / "sigue saliendo" → bot re-asks
   "qué código aparece exactamente, incluso si es el mismo" (F18 wording)
   → set state.pendingFlow = 'display-reask-pending'

Phase C — pivot or escalate (F30)
   customer reply contains a NEW display token different from the active
   flow's displayMatches  → PIVOT: clear flow + return null → next pipeline
                            pass routes the new display
   customer reply matches same code OR contains no display token  → escalate
   with displayInstructionFailureEscalate ("usa otra lavadora + posible
   compensación", F26 wording).
```

The Phase C pivot is critical for marathon scenarios (Caso 32.1) where
the customer cycles through multiple displays in one session
(SEL → PUSH PROG → DOOR → AL001). The chronological list lives in
`state.displayHistory` (F27) and is rendered in the operator handover
summary as "Secuencia de pantallas vista: ...".

---

## 11. F-log (regression catalogue)

Every architectural fix is recorded in [`docs/f-log.md`](f-log.md) under
"📜 Architectural fixes log" with a stable F-number (F1, F2, ...). Each
entry has three columns: observable symptom, root cause, architectural
fix + preservative pattern.

The log is the **regression catalogue**: before any fix that resembles
a previous symptom, read the corresponding F-entry to avoid reintroducing
the same bug.

**Pin requirement**: every F-number MUST have a sibling pin in
[`__tests__/unit/f-log-regression.test.ts`](../__tests__/unit/f-log-regression.test.ts)
with the F-number in the test name. Enforced by `scripts/check-architecture.sh`
rule #11 — commits without the pin are blocked.

Currently 100 entries (F1-F100) — see [`docs/f-log.md`](f-log.md) for the
full table. Coverage spans: refund-form vs escalation, retry+escalate
ladder, multi-lang detectors (typo-tolerance, formal/colloquial/preterito),
branch router architecture, location resolution + Mataró street
disambiguation, loyalty card cross-location warnings, FAQ data-driven
location-aware (prices/hours/programs/payment metadata), rephrase polish
governance (bypass deterministico per PII/bullet/display-flow), sticky
language T1, post-rephrase language guard.

---

## 12. Pre-extract state snapshots (L2 turn-local)

Some guards need to know whether a state field **changed during this turn**
vs was already set before — e.g. did the customer volunteer a new display
in this message, or is the existing one persisting? This requires a
snapshot of the field BEFORE `autoExtractFacts` runs.

Pattern: in `agent.ts:agentTurn` BEFORE calling `autoExtractFacts`, set
`ar.state.<field>AtTurnStart = ar.state.<field>` (or the equivalent empty
value). Guards downstream compare snapshot vs current to detect the in-turn
change. The snapshot is a turn-local L2 field, reset at the top of every
turn — declare it in `models/state.ts` with a JSDoc explaining who reads it.

Current instances:
- `displayStateAtTurnStart` → consumed by Phase B pivot in
  [`utils/guards/display.ts:guardPostInstructionFailure`](../utils/guards/display.ts).
  When the customer combines a failure signal ("no") with a new display
  token in the same message, the guard pivots instead of re-asking.

When adding a new snapshot field, add it to `resetMachineFacts` in
`utils/state.ts` so mid-turn flow resets clear it consistently.

---

## 13. Auto-extract inference rules — `autoExtractFacts` (L3)

[`utils/agent-extract.ts:autoExtractFacts`](../utils/agent-extract.ts) runs
**before every guard pipeline turn**. It mutates `state` from the raw user
message without producing a reply. Adding a new fact-extraction rule MUST
follow these conventions:

| Fact captured | Source | Notes |
|---|---|---|
| `state.location` | `extractExplicitLocation`, `resolveKnownLocation` | Free-text → canonical pueblo. |
| `state.locationStreet` | Mataró street disambiguation | "Goya"/"Alemanya" sub-locations. |
| `state.machineType` | `normalizeMachineType` | "lavadora"/"lavatrice"/"washer" → `'washer'`. |
| `state.machineNumber` | regex on the message | Pure digit short tokens. |
| `state.displayState` | `extractDisplayState` | **Canonical** token (e.g. `"PUSH"`). Used by flow engine. |
| `state.displayLabel` | `extractDisplayLabel` | **Customer-facing** label (e.g. `"PUSH PROG"`). Used by operator handover. |
| `state.paymentCompleted` | `parseExplicitPaymentSignal` | Yes/no from explicit payment-context replies. |
| `state.pendingFlow = 'double-charge-ask-used'` | `detectDoubleChargeIntent` | Multi-lang Caso 6 trigger. |
| `state.pendingFlow = 'discount-code-ask'` | `detectDiscountCodeIntent` | Multi-lang Caso 8 trigger. |
| `state.pendingFlow = 'no-change-ask'` | `detectPaidNotActivatedIntent` | Caso 4 trigger — ES-only, typo-tolerant (F16). |

### `displayState` / `displayLabel` — the canonical / label pair

Every code path that captures a display token MUST set both fields. The
canonical drives flow routing; the label is preserved verbatim for the
operator handover summary so they read exactly what the customer reported.
Fallback: `displayLabel || displayState`.

### Convention for adding a new fact-extraction rule

1. Detector lives in `utils/intent.ts` (or `utils/message-parsing.ts`),
   exported as a pure function with tests in `__tests__/unit/<detector>.test.ts`.
2. Wire-up in `autoExtractFacts` is a 2-4 line block: import detector,
   call it, set `state.*` field. No business logic in `autoExtractFacts`.
3. Multi-language coverage is mandatory (Iron rule #8).
4. If the rule sets a `pendingFlow` value, register it in `cases.json`.

---

## 14. Detector index — `utils/intent.ts`

These are the deterministic detectors / extractors used as the L3 fast path.

| Function | Purpose | Multi-lang | Notes |
|---|---|---|---|
| `extractDisplayState(message)` | Canonical display token | n/a | Fuzzy fallback for typos. |
| `extractDisplayLabel(message, canonical)` | Literal customer wording | n/a | Greedy `[A-Z0-9]` tail extension (F7). |
| `normalizeMachineType(value)` | washer/dryer detection | ✓ 6 langs | Levenshtein fuzzy. |
| `extractExplicitLocation(message)` | "estoy en Goya" → "Goya" | ✓ 6 langs | Falls back to `resolveKnownLocation`. |
| `parsePaymentAnswer(message)` | yes/no parsing | ✓ 6 langs | Word-end lookahead for accents (F17). |
| `detectIDontKnowReply(message)` | "no lo sé" etc. | ✓ 6 langs | Boundary signal. |
| `detectDoubleChargeIntent(message)` | Caso 6 trigger | ✓ 6 langs | Tracked rule #6 exemption. |
| `detectDiscountCodeIntent(message)` | Caso 8 trigger | ✓ 6 langs | Tracked rule #6 exemption. |
| `detectPaidNotActivatedIntent(message)` | Caso 4 trigger | ES-only | Typo-tolerant (F16). |
| `hasGreetingIntent(message)` | Pure greeting | ✓ 6 langs | Boundary signal. |
| `isShortContextReply(message)` | Numeric/yes/no classification | n/a | Syntactic shape. |
| `detectLanguageHeuristic(message)` | First-turn language guess | ✓ 6 langs | Used by `resolveLanguageForTurn`. |

### 🚫 Anti-pattern — speculative typo-tolerant detectors

**Don't extract detectors preventively.** Every multi-language detector in
`intent.ts` MUST repair a REAL reported bug. Pattern-guessing 6-language
coverage without a corpus of actual customer messages produces hardcoded
regexes that silently fail on edge cases.

Decision rule before extracting an inline regex into `utils/intent.ts`:

1. **Real bug evidence?** Did Andrea or a real chat surface this gap?
2. **Customer corpus?** Do we have at least one real customer message
   per language we're claiming to support?
3. **Test the negative case immediately** — write a test for a phrasing
   variant the regex DOESN'T match.

If any answer is "no" / "not yet" → keep the inline regex, mark a TODO.

---

## 15. ALLOWED_LARGE_FILES policy — Iron rule #3 in practice

Iron rule #3 ("one file ≤ 150 lines") has an explicit escape hatch in
[`scripts/check-architecture.sh`](../scripts/check-architecture.sh):
`ALLOWED_LARGE_FILES`. A file may exceed 150 lines if AND only if:

1. **It is one cassette = one responsibility.** Splitting would fragment
   a coherent story.
2. **The reason is recorded** in the comment block at the top of
   `ALLOWED_LARGE_FILES`.
3. **Adding the file requires Andrea's approval** (touched in the
   commit's PR description).

Anti-pattern: adding a file to this list without splitting after a
genuine attempt. The default answer to "this file got too big" is *split it*.

---

## 16. Gather orderings — per-case quick reference

Each Caso has a documented gather order in
[`docs/usecases.md`](usecases.md). Below are the orderings that diverge
from the generic "location → tipo → numero → display" because of UX trade-offs.
**Source of truth is `usecases.md`** — this is a navigation aid only.

### Caso 6 — Doble cobro (Andrea, 2026-05-09 reorder)

```
T1: trigger ("me han cobrado dos veces")
T2: location
T3: ¿has podido lavar/secar?  ← branch point
    ├── No  → escalate immediately, only ask for name (Scenario 6.4)
    └── Sí  → continue: tipo → numero → relato → 4 dígitos → captura del pago + nombre
```

UX rationale: a customer who got charged twice without being able to wash
is doubly frustrated. The "no" path escalates fast; tipo/numero are
recovered by the operator on the phone.

### Caso 1 — PUSH PROG (no payment ask, payment is implicit)

```
T1: trigger ("la lavadora no funciona")
T2: location
T3: numero (NOT tipo — autoExtractFacts already captured "lavadora")
T4: pantalla
T5: PUSH PROG → flow engine emits canonical 4-program list
T6: customer confirms or reports failure
```

UX rationale: PUSH PROG only appears AFTER payment, so asking "¿has pagado?"
is redundant.

### Generic gather (Casi 2, 3, 5, 7, 14, 15, 16, 30 — display-driven)

```
T1: trigger → T2: location → T3: tipo (if not volunteered)
T4: numero → T5: pantalla → T6+: display-specific flow
```

### Cross-case invariants

1. **3-strikes retry+escalate ladder** on `state.<fact>AskAttempts`.
2. **Customer can change topic at any moment** — topic-switch detection
   interrupts gather and resets state.
3. **Language is sticky per session**, locked from the first user message.

---

## 17. Agent test pattern — consolidated, not granular

**The right shape — one test per END-TO-END PATH, with step-by-step
assertions inline.** Per Caso, write 2-3 tests at most:

1. **Scenario X.1 — Happy Path completo**: trigger → gather → display
   instruction → resolution. Asserts each turn's reply inside the same
   conversation. One LLM-driven session, all checkpoints.
2. **Scenario X.2 — Escalation completo**: trigger → gather → instruction
   → customer signals failure → re-ask (Phase B) → escalate → name → final
   reply with summary handover.
3. **(Optional) Edge case specifico** when an independent path needs its
   own conversation.

### Anti-pattern (rejected)

```ts
// ❌ Don't do this — 1 test = 1 turn checkpoint
{ name: 'T2: dopo location, bot chiede numero',
  run: async (ctx) => {
    await ctx.send('La lavadora no funciona')  // re-sent in every test
    const r = await ctx.send('Goya')
    expectMentionsAll(r, ['numero'])
  }
},
// ... and 8 more like this, each replaying the prefix
```

### Mandatory regression check on shared-component changes

When you modify a component that affects **multiple Casi** (e.g.
`escalation.ts`, `state-transitions.ts`, i18n files), MUST re-run the
agent tests for **every Caso already validated** in the session, not
only the one you're working on.

---

## 18. 4-source verification workflow

When validating any Caso, the 4 sources must agree. When they diverge,
decide CONSCIOUSLY (via AskUserQuestion) which is the truth and align
the others — no pezze.

**The 4 sources**:

1. **PDF Playbook** (`docs/pdf/Ecolaundry Chatbot Playbook (6).pdf`) —
   contract with the client. Ultimate truth when a dedicated section exists.
2. **`docs/usecases.md`** — internal bot spec. When deviating from PDF,
   must have an explicit `**Desviación documentada respecto al Playbook PDF**` block.
3. **`json/cases.json`** + guards/i18n/flow-engine JSON referenced. Bridge
   between `docNumber` (doc) and `semanticId` (code). Test paths MUST exist.
4. **Bot reality** — deterministic output verified by agent tests.

**Typical divergences encountered during Casi 1-32 audit**:
- **PDF deviation documented** (Casi 5, 6, 8, 9): our flow is richer than
  PDF for UX/integration reasons. Document, keep the flow.
- **PDF alignment** (Casi 7, 10, 11): PDF and usecases said different things
  → we aligned by modifying code.
- **Stale ref** (multiple Casi): paths in `json/cases.json` pointed to
  inexistent files. Fix in cases.json.
- **Latent architectural bug** (Casi 14, 30): sources agreed but flow
  JSON / detector had a gap that the LLM masked. Fix in deterministic code.

---

## 19. Test deterministic vs production polished

**Decision (Andrea, 2026-05-10)**: the test suite runs against the
deterministic core, the production deployment can layer LLM polish on top.

```
                 │  Test suite       │  Production
─────────────────┼───────────────────┼─────────────────────
useBranchRouter  │  false            │  false (today)
naturalRephrase  │  false            │  may be true
```

**Why the test suite stays deterministic** (flag OFF):
- Assertions verify **content correctness**, not wording style.
- No LLM polish → no flakiness from the rephrase model.
- If a guard's i18n string changes, the test catches it without LLM noise.

**Why production can flip to polished** (flag ON):
- The same canned reply, rephrased through `utils/agent-rephrase.ts`,
  feels more natural: variation across turns, customer name woven in,
  emoji, conversational tone.
- The rephrase system prompt enforces keyword preservation.

**Per-LLM temperatures** (configurable via `settings.json`):
- `routerTemperature` (default 0): T1 branch classifier. Discrete classification.
- `rephraseTemperature` (default 0.4): polish layer. Generative with strict constraints.
- `agentTemperature` (default 0.3): main turn LLM.

---

## 20. Pending refactors — tracked, don't lose

These are debts we've consciously decided NOT to chase right now because
the cost/benefit is wrong today. When the third instance appears, the
trade-off flips and the refactor MUST be done.

| ID | Refactor | Trigger |
|----|----------|---------|
| B1 | Rename `appendEscalationSummary` → `polishClosureForTurn(ar, reply)` with explicit dispatch on `pendingClosure`. Pure cleanup, no behaviour change. | The third closure type appears (today: 2 = escalated, refund-form). |
| B2 | Factory for deterministic name-capture guards. Pattern duplicated in `guardDiscountCodeAwaitName` and `guardDoubleChargeAwaitName`. | Third instance added (future Caso ending with name capture). |
| C1 | **PII redaction before LLM forward.** Customer name + last 4 digits + photo references reach external LLM. Privacy/GDPR forbids. | Now (privacy), blocks scaling. |
| B3 | Rename `al001Resolved` i18n key → `displayResolved`. Now reused by alm-door-blocked and any future display-flow recovery. | When a third display-flow with `resolvedReplyKey` is added. |
| B5 | Machine number validation against `locations.json:metadata.machines`. Currently any 1-3 digit number is accepted. | (a) First real customer chat showing the bug; (b) Data audit complete + tests updated. |
| B6 | Extras (aclarado/lavado 1€) + extended tier dryer L'Escala. `metadata.extras` exists but not shown. | First customer asks "c'è extra cost?" / "5€ programma?". |
| B7 | Resolve `weightKg: null` for Goya secadoras S1/S2/S3 (data fix). | Operator call to Olga / Goya ownership to get physical data. |
| B8 | Validation at boot for `metadata.payment` (methods/tpvExact shape). | Production data corruption OR pre-go-live audit. |
| D1 | ✅ **Done (2026-05-19)** — LLM natural-rephrase layer in `utils/agent-rephrase.ts`. |
| D2 | ✅ **Done (2026-05-10)** — LLM prompts moved from TS consts to `prompts/*.txt`. |
| B4 | ✅ **Resolved by F55 (2026-05-15)** — `state.machineType` flip after FAQ context. |

**Anti-pattern to avoid**: silently start the refactor while doing unrelated
work. Respect the trigger; don't extract preventively.

---

## 21. Where to add a behaviour (decision tree)

```
"The bot should not do X."
   │
   ├── X is about customer-input shape → L1 (input-sanitize)
   ├── X is about state mutation rules → L2 (state-transitions)
   ├── X is about classifying a reply pattern → L3 (new detector + tests)
   ├── X is about an LLM tool call constraint → L4 (tool-handlers/* validator)
   └── X is about the final reply text → L5 (polishReplyForTurn invariant)

"The bot should now support a new feature."
   │
   ├── New display code → json/display-flows.json + i18n keys
   ├── New language → json/i18n/<lang>.json + detector keyword lists
   ├── New tool → agent-tools.ts schema + tool-handlers/<topic>.ts + register
   ├── New required fact for escalation → models/state.ts + state-transitions
   └── New conversational invariant → L5 step in polishReplyForTurn
```

If unsure, read [`docs/adding-use-cases.md`](adding-use-cases.md) recipe
selector. If still unsure, ask Andrea.

---

## 22. Adding a new use case — the bridge file

When the doc grows a `## Caso 33 — XYZ` section, add a row to
[`json/cases.json`](../json/cases.json) BEFORE writing any code:

```json
{
  "docNumber": 33,
  "title": "XYZ behaviour summary",
  "semanticId": "xyz-behaviour",
  "kind": "machine-incident | payment-incident | escalation | faq | gather | display-flow",
  "guardModule": "utils/guards/xyz.ts",
  "guards": ["guardXyzAsk", "guardXyzAwait"],
  "pendingFlowPrefix": "xyz-",
  "i18nKey": "xyzAsk",
  "tests": ["__tests__/agent/NN-xyz.test.spec.ts"]
}
```

Then use the `semanticId` everywhere in code. **Never `caso33` in code.**
If the doc later renumbers this to "Caso 28", update only `docNumber` in
`cases.json` — code is unaffected.

---

## 23. Prompt caching (OpenRouter / Anthropic prefix cache)

The agent makes several LLM calls per turn. Each system prompt is large
and almost identical from one turn to the next, so we opt in to provider
prefix caching to avoid re-paying input tokens.

### Where it's wired

| Call site | System prompt | Approx tokens | Cached? |
|-----------|---------------|---------------|---------|
| `utils/agent-llm.ts:callAgentLLM` (main agent loop, tools + history) | `prompts/agent.txt` + reglas + sticky state + settings | ~12.7k+ | ✅ (since project inception) |
| `utils/router.ts:classifyMessageBranch` | `prompts/router.txt` | ~5.3k | ✅ |
| `utils/agent-rephrase.ts:rephraseForTurn` | `prompts/rephrase.txt` | ~2.0k | ✅ |
| `utils/operator-briefing.ts` | `prompts/operator-briefing.txt` | ~0.8k | ❌ (under threshold, runs only on escalation) |
| `utils/flow-engine.ts:classifyChoiceViaLLM` / `classifyRouterLogic` | none (user prompt only) | n/a | ❌ |
| `utils/llm.ts:detectLanguage` | `prompts/language.txt` | ~50 | ❌ (under threshold) |

### How it works

Two helpers, one per call shape:

- `utils/agent-llm.ts:withSystemPromptCache` — wraps the system message in
  the tool-calling payload of the main agent loop.
- `utils/llm-messages.ts:buildMessages` — wraps the system message in the
  single-shot `callOpenRouter` payload used by router + rephrase. Opt-in
  via `LlmRequest.cacheSystemPrompt: true`.

Both helpers emit the same wire format:

```json
{
  "role": "system",
  "content": [{ "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } }]
}
```

Providers that support prefix caching (Anthropic, Gemini, recent OpenAI)
reuse the prefix across turns. Providers that ignore the field receive a
still-valid chat-completions request — no-op, not an error.

### Minimum prompt size

Anthropic's prefix cache requires ~1024 tokens of cacheable prefix. Below
that threshold `cache_control` is silently ignored and the wrapper would
only add payload bytes without any cache hit. `buildMessages` gates on
`PROMPT_CACHE_MIN_CHARS = 4000` (≈1000 tokens, char/4 heuristic conservative
for Latin text) and falls back to a plain-string system message when the
prompt is too short. This is unit-tested in
[`__tests__/unit/llm-messages.test.ts`](../__tests__/unit/llm-messages.test.ts).

### Opting in a new call site

When adding a new `callModel` / `callOpenRouter` call with a large, stable
system prompt, set `cacheSystemPrompt: true` on the `LlmRequest`:

```ts
const raw = await callModel({
  systemPrompt,        // must be reused across many turns to be worth caching
  userPrompt,
  caller: 'my-subsystem',
  cacheSystemPrompt: true,
})
```

Do NOT enable it when:
- the system prompt is composed inline per-turn (different every time);
- the system prompt is under ~4000 chars (`buildMessages` skips the wrapper anyway);
- the call site fires rarely (e.g. once per escalation) — the cache TTL is
  short, the prefix won't survive between firings.

### Observability — cacheRead / cacheCreated

When `LLM_DEBUG=1` (or `npm run demo -- --debug`),
`utils/llm-fetch-observability.ts:extractCacheUsage` reads the provider's
`usage` block and surfaces cache stats in the `llm.call` log line under
two stable keys:

| Key | Source | Meaning |
|-----|--------|---------|
| `cacheRead` | Anthropic `cache_read_input_tokens` OR OpenAI `prompt_tokens_details.cached_tokens` | Tokens served from the provider's prefix cache (free or near-free, depending on plan) |
| `cacheCreated` | Anthropic `cache_creation_input_tokens` only | Tokens written into the prefix cache this call (paid at the cache-write rate) |

Sample real run (router system prompt ~5.3k tokens, gpt-4o-mini on OpenRouter):

```jsonc
// T1 (cold)
{"caller":"router","latencyMs":2393,"cacheRead":0}
// T2 (warm — prefix still in cache)
{"caller":"router","latencyMs":579,"cacheRead":4224}
```

Both keys are absent when the provider doesn't surface cache usage. The
keys are stable (renamed only via this module) so `jq` filters in transcripts
and downstream cost analytics can rely on them.
