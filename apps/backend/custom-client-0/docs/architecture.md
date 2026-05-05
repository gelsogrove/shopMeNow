# Architecture — cliente-0

> The chatbot is a **coordinated mix** of regex extraction, ordered guards,
> conversation history, system prompt, JSON knowledge tables, and an LLM
> with tools. Each layer has a precise responsibility — together they
> handle the long tail of customer phrasing across 6 languages without
> any layer trying to do another's job.

---

## 1. The mix at a glance

```
                   ┌──────────────────────────────────────┐
                   │  CONVERSATION HISTORY (sticky)       │
                   │  • per-session in-memory             │
                   │  • survives across turns             │
                   │  • LLM gets the full transcript      │
                   └─────────────┬────────────────────────┘
                                 │
                                 ▼
USER TURN ──┬─► ① REGEX EXTRACT ──► sticky facts updated
            │       (pure facts, enumerable values)
            │
            ├─► ② ORDERED GUARDS ──► canned reply (rare, only when
            │       (small set, opens flows /         the LLM would
            │        hard escalation only)            statistically err)
            │
            └─► ③ LLM CALL ────────► reply
                    System prompt =
                        prompts/agent.txt (template)
                      + sticky facts (from ①)
                      + JSON knowledge (locations, FAQs)
                      + reglas.md
                    Plus: 12 tools to mutate state.
                    Plus: full conversation history.
                    Loop until no tool_call.
                            │
                            ▼
                    Tools mutate state ──► next turn sees updated facts
```

Three layers, three jobs, **no overlap**:

| Layer | Job | What it MUST NOT do |
|---|---|---|
| ① Regex extract | Pull enumerable values out of the message (numbers, codes, names from a closed list) | Classify intent ("is this a new incident? did the user confirm?") |
| ② Ordered guards | Open multi-step flows (e.g. Caso 6 doble cobro) and trigger HARD escalation (unknown display, contradictory, refund demand, angry customer) | Decide yes/no answers in any specific language |
| ③ LLM | Interpret intent, choose canonical answer, call tools, write reply | Invent prices, codes, policies; escalate when the answer is in the prompt |

---

## 2. The 6 ingredients

The bot's behaviour at any turn is the result of **6 ingredients** combined:

### 2.1 Regex (deterministic extraction)
Lives in [`utils/agent-extract.ts`](../utils/agent-extract.ts) + [`utils/intent.ts`](../utils/intent.ts).
Used **only** for enumerable extraction:
- numbers (`\b\d{1,3}\b` for machine number)
- display codes from the manual (`SEL`, `PUSH`, `DOOR`, `ALM/DOOR`, `AL001`, …)
- closed lists of names (`Goya`, `Pineda`, `L'Escala`, …)
- vocabulary + Levenshtein fuzzy for `lavadora`/`secadora` typos
- structural patterns (`\d+[,.]\d{2}€`)

Adding a new language: push 1 word per machine type to `WASHER_VOCAB`/`DRYER_VOCAB`. Done. No intent regex changes — that's the LLM's job.

### 2.2 Guards (deterministic short-circuits)
Live in [`utils/guards/`](../utils/guards/). The pipeline is ordered: first guard whose preconditions match returns a canned reply and skips the LLM. Kept **small on purpose** — most guards open flows or fire hard escalation. They never classify a customer's free-form yes/no answer (that would require multilingual regex).

Categories:
- **Open multi-step flows**: `guardCaso6AskPodidoLavar` (doble cobro 4-step), `guardCaso7AskCambio` (cambio devuelto?), `guardCaso8AskCode` (código de descuento), `guardCaso5Al001AskBefore` (AL001 cause-finding).
- **Hard escalation**: `guardEscalateUnknownDisplay`, `guardEscalateNonTroubleshooting`, `guardCaso26Refund`, `guardCaso25Empathic` + `guardCaso25Escalate`, `guardCaso28Contradictory`.
- **Force gather** (deterministic when LLM might forget): `guardForceMachineType`, `guardForceMachineNumber`, `guardForceDisplay`.
- **Special**: `guardMataroStreet` (Mataró has multiple streets).
- **FAQ shortcuts** (cheap and language-aware via `localization.ts`): `guardCaso9Factura`, `guardCaso10Tarjeta`, `guardCaso11Recarga`, `guardCaso12Precio`, `guardCaso12Horarios`, `guardFaqClosure`.

Notably **NOT** in the pipeline (intentionally removed in the LLM-first refactor):
- `guardCaso5AwaitRelato` / `guardCaso5AwaitDisplay` — ES-only yes/no regex on alarm resolution.
- `guardCaso4AwaitCambio` / `guardCaso4AwaitConfirmation` — ES-only yes/no on cambio + retry.
- `guardCaso7AwaitDisplay` — ES-only yes/no on cambio.
- `guardCaso8AwaitConfirmation` — ES-only yes/no on máquina arrancó.

These now live in the LLM via the `PENDING-FLOW RULES` section of the prompt.

### 2.3 Conversation history
Lives in `AgentSession.history` (in-memory per session). Every customer message + every assistant reply is appended. The LLM receives the **full transcript** every turn, so it has access to:
- what the bot just asked (so it knows how to interpret the customer's answer)
- the open question that's still pending
- the customer's tone and prior corrections

This is what makes "ora funciona" interpretable: the LLM sees that one turn ago the bot gave the AL001 guidance, so a positive reply now means "guidance worked, mark resolved".

### 2.4 System prompt ([`prompts/agent.txt`](../prompts/agent.txt))
Reassembled every turn by [`buildSystemPrompt`](../utils/agent-prompt.ts). Variable parts injected at substitution time:
- **Sticky facts** block — `{{location}}`, `{{machineType}}`, `{{machineNumber}}`, `{{displayState}}`, `{{customerName}}`, `{{turnCount}}`, etc. The LLM reads these BEFORE deciding what to ask next.
- **Active location context** — `JSON.stringify(override, null, 2)` of the relevant entry from [`json/locations.json`](../json/locations.json). The whole metadata block, every field. The LLM reads `cardUnitPrice`, `centralType`, `selfStartMachine`, `dryerFilterSelfService`, etc. to give tenant-specific answers WITHOUT branching on location name in code.
- **`{{reglas}}`** — content of [`docs/reglas.md`](./reglas.md) (tone, forbidden phrases, when to escalate).
- **Welcome templates** — per-language, from [`json/settings.json`](../json/settings.json).

Static parts of the prompt define:
- 🌟 GOLDEN RULE — answer if you know, escalate as last resort
- LANGUAGE-LOCK rule (always reply in `language` from sticky facts)
- 🚨 TOOLS MANDATORY RULES — when to call `set_*`, `mark_resolved`, `escalate_to_operator`
- DISPLAY → CANONICAL ANSWER table (SEL/PUSH/DOOR/ALM/DOOR/PRICE/BLANK/AL001 with the verbatim canonical reply)
- DISPLAY-CHANGE RULE — display advanced ≠ failure
- POST-RESOLUTION RULE — on `pendingClosure='resolved'`, sticky facts are wiped except customer-level
- FAQ-TANGENTS RULE — answer + bridge back to flow
- MULTI-PROBLEM RULE — same person, same laundry, different machines/displays
- PENDING-FLOW RULES — for each `state.pendingFlow`, what the LLM must decide

### 2.5 JSON knowledge tables
Three files. Each has a different consumer:

| File | Read by code? | Read by LLM? |
|---|---|---|
| [`json/settings.json`](../json/settings.json) | ✅ runtime config | partial (welcome, model name) |
| [`json/locations.json`](../json/locations.json) | ✅ partial (`cardPaymentUnreliable`, `dryerMinutesIncreaseIssue` for guards) | ✅ **entire override** injected into prompt |
| [`json/faqs.json`](../json/faqs.json) | ✅ via `getFaqs()` for FAQ guards | ✅ via `apply_faq_override` tool |
| [`json/washer_hs60xx.json`](../json/washer_hs60xx.json) / [`dryer_ed340.json`](../json/dryer_ed340.json) | ✅ flow engine | indirectly (LLM relays the step prompts) |

**Critical: `locations.json` metadata is mostly LLM-only knowledge.**
Most fields (e.g. `cardUnitPrice`, `centralType`, `returnsChangeCoins`, `dryerFilterSelfService`, `ajaxRestartPossible`, `selfStartMachine`, `needsStreetClarification`) have ZERO TypeScript references. They are **not dead code** — they are read by the LLM via `locationContext` injection and used to give tenant-specific answers. See `_overrideTypes.metadata` in [`json/locations.json`](../json/locations.json) for the documented contract.

### 2.6 LLM + tools
The agent loop ([`agent.ts:agentTurn`](../agent.ts)) sends the full assembled context to OpenRouter. The LLM may:
- Reply with text → loop exits, that's the answer.
- Reply with `tool_calls` → executor runs them, results get appended to history as `role:'tool'` messages, loop iterates.

12 tools available ([`utils/agent-tools.ts`](../utils/agent-tools.ts)):
| Tool | Mutates | Use |
|---|---|---|
| `set_location` | `state.location` | When the customer names a laundry |
| `set_location_street` | `state.locationStreet` | Mataró only |
| `set_machine_facts` | `machineType`, `machineNumber` | When customer names them |
| `set_payment_facts` | `paymentCompleted`, `paymentMethod` | When yes/no payment is explicit |
| `set_display_state` | `state.displayState` | When customer reports a code |
| `start_machine_flow` | `activeFlowId/StepId` | Open a JSON multi-step flow |
| `advance_machine_flow` | `activeStepId` | Step the flow with user reply |
| `apply_faq_override` | (read-only) | FAQ with location-specific text |
| `capture_customer_name` | `state.customerName` | Before handover |
| `request_photo` | `state.photoRequested` | When asking for a display photo |
| `mark_resolved` ⭐ | `pendingClosure='resolved'` | **Mandatory** when customer confirms fix in any language |
| `escalate_to_operator` | `pendingEscalation` | Last resort when answer is unknown |

`maxToolHops` ([`json/settings.json`](../json/settings.json)) caps the loop to prevent runaway calls. Default 6.

---

## 3. The principles (ordered)

These principles are **not negotiable** — every change to the codebase must be checked against them.

**P1 — Single source of truth.** Each piece of knowledge lives in ONE place: code OR prompt OR JSON, never duplicated.

**P2 — Separation of concerns: deterministic vs semantic.**
- Deterministic (regex/code): extract enumerable facts from text.
- Semantic (LLM): interpret intent, decide replies, classify yes/no in any language.

**P3 — Customer is ONE person in ONE laundry, with N problems.** Sticky facts about the *customer* (`location`, `customerName`, `language`) are immutable. Sticky facts about the *current incident* (`machineType`, `machineNumber`, `displayState`, `paymentCompleted`, `activeFlowId`) are transient and reset on `pendingClosure='resolved'`.

**P4 — Knowledge first, escalation last.** If the answer exists in the canonical tables / FAQ / location overrides / flows, the bot must give it. Escalation is only for: unknown display, contradictory narrative, refund demand, angry customer (after empathy), explicit operator request.

**P5 — Mixed messages are first-class.** Multi-fact ("estoy en Goya con la lavadora 5 SEL"), topic switching ("aspetta, e los horarios?"), incident chaining ("ahora la secadora 7 no calienta"), display advancement (SEL → PUSH PROG) — all must work without state pollution.

**P6 — Tested behavior, not tested implementation.** Tests verify the **observable** outcome (state, reply structure, tool calls), not the regex pattern.

---

## 4. Per-turn flow (concrete)

```
agentTurn(session, userMessage):
  state.turnCount += 1
  state.lastActivityAt = now()

  ┌─ STEP 1: Language detection ─────────────────────────────┐
  │ if !state.preferredLanguage:                             │
  │   detectLanguageHeuristic(userMessage)                   │
  │   if heuristic in settings.enabledLanguages → use it     │
  │   else → fallback to settings.defaultLanguage            │
  └──────────────────────────────────────────────────────────┘

  ┌─ STEP 2: autoExtractFacts (DETERMINISTIC) ───────────────┐
  │ • If state.pendingClosure === 'resolved' → wipe          │
  │   per-incident facts (location/name/lang preserved)      │
  │ • Detect topic switch (payment/refund/cameras/…)         │
  │   → wipe machine facts + set nonTroubleshootingIncident  │
  │ • Extract location (only if empty)                       │
  │ • Extract machineType (only if empty; fuzzy fallback)    │
  │ • Extract machineNumber (only if empty)                  │
  │ • Extract displayState (always — display can advance)    │
  │ • Extract payment signal (only if empty)                 │
  └──────────────────────────────────────────────────────────┘

  ┌─ STEP 3: runGuardPipeline (DETERMINISTIC, ORDERED) ──────┐
  │ for guard in GUARD_PIPELINE:                             │
  │   if outcome = guard(ar, userMessage):                   │
  │     return outcome.reply (skip LLM entirely)             │
  └──────────────────────────────────────────────────────────┘

  ┌─ STEP 4: LLM agent loop ─────────────────────────────────┐
  │ systemPrompt = buildSystemPrompt(ar, bundle)             │
  │ messages = [system, ...history, {user, userMessage}]     │
  │                                                          │
  │ for hop in 0..maxToolHops:                               │
  │   response = callAgentLLM(messages, runtime)             │
  │   if response has tool_calls:                            │
  │     for call in tool_calls: executeTool(...)             │
  │     append tool results as role:'tool' messages          │
  │     continue                                             │
  │   else:                                                  │
  │     return response.content                              │
  └──────────────────────────────────────────────────────────┘

  ┌─ STEP 5: Post-process ───────────────────────────────────┐
  │ • Sanitize (strip role-leak, weird artifacts)            │
  │ • On turn 1: prepend welcome unless LLM already greeted  │
  │   or operational facts already gathered                  │
  │ • On turn 2+: strip stray welcome paragraphs             │
  │ • If pendingEscalation && customerName → append          │
  │   operator-handover summary                              │
  └──────────────────────────────────────────────────────────┘

  Append (user, assistant) to history
  Return final reply
```

---

## 5. Why this design (decision log)

**Why a mix instead of all-LLM?**
Hard cases (unknown display escalation, Mataró street, contradictory narrative) need deterministic guarantees. The LLM probabilistically gets these right, but probabilistically also gets them wrong. Guards are cheap auditable safety nets where errors are most costly.

**Why a mix instead of all-regex / all-rule?**
The customer speaks 6 languages, and "the customer confirmed it works" has hundreds of phrasings. Multilingual regex for intent is unmaintainable; the LLM handles all languages for free.

**Why JSON knowledge instead of hardcoded if/else?**
Adding a new laundry must be a JSON edit, not a code change. `_principle` in `locations.json` enforces this: "never branch on location name in code; always read from this file."

**Why `mark_resolved` is mandatory in the prompt?**
The deterministic post-resolution reset depends on `pendingClosure='resolved'`. The only way to set it from the LLM side is the `mark_resolved` tool. If the LLM forgets, sticky facts go stale and the next turn answers with wrong context. The prompt makes this explicit (anti-pattern + right-pattern examples).

**Why we deleted the ES-only yes/no guards?**
They were the cause of the "ora funciona" → false escalation bug. Intent classification across 6 languages is the LLM's job. Guards must NOT classify.

---

## 6. State machine — sticky facts

| Field | Lifetime | Wiped by |
|---|---|---|
| `location` | session | `/reset`, never auto |
| `locationStreet` | session | `/reset`, never auto |
| `customerName` | session | `/reset`, never auto |
| `language`, `preferredLanguage` | session | `/reset`, never auto |
| `machineType`, `machineNumber`, `displayState` | per-incident | `resetMachineFacts` (post-resolution OR topic switch) |
| `paymentCompleted`, `paymentMethod` | per-incident | `resetMachineFacts` |
| `activeFlowId`, `activeStepId` | per-incident | flow engine on terminal node, or `resetMachineFacts` |
| `pendingFlow` | per-incident | guard that consumes it, or `resetMachineFacts` |
| `pendingClosure` | one turn | extractor on next turn (after firing the reset) |
| `operatorRequested`, `customerNameRequested`, `pendingEscalation` | until handover | post-handover cleanup |

---

## 7. Adding a new language (e.g. German)

1. [`json/settings.json`](../json/settings.json): add `"de"` to `enabledLanguages`.
2. [`utils/intent.ts`](../utils/intent.ts): push `'waschmaschine'` to `WASHER_VOCAB`, `'trockner'` to `DRYER_VOCAB`.
3. [`utils/localization.ts`](../utils/localization.ts): add `de:` translations for every `t()` key.
4. [`json/settings.json`](../json/settings.json): add German welcome message.
5. **No intent regex to update.** The LLM speaks German for free.

---

## 8. File responsibility summary

| File | Responsibility |
|---|---|
| [`agent.ts`](../agent.ts) | CLI entrypoint + orchestrator (`agentTurn`) |
| [`index.ts`](../index.ts) | Web entrypoint (`chatbotFn`) — same orchestrator behind a different I/O |
| [`prompts/agent.txt`](../prompts/agent.txt) | Static + variable-substituted system prompt template |
| [`models/`](../models/) | Type definitions only (no runtime) |
| [`utils/agent-extract.ts`](../utils/agent-extract.ts) | Deterministic fact extractor — no intent classification |
| [`utils/guards/`](../utils/guards/) | Ordered short-circuits — open flows + hard escalation |
| [`utils/agent-tools.ts`](../utils/agent-tools.ts) | LLM-callable tool dispatcher |
| [`utils/agent-prompt.ts`](../utils/agent-prompt.ts) | Assembles the system prompt with sticky facts + locations |
| [`utils/agent-llm.ts`](../utils/agent-llm.ts) | OpenRouter wrapper (timeout, retry, prompt cache, max tokens) |
| [`utils/intent.ts`](../utils/intent.ts) | Regex helpers + Levenshtein fuzzy match |
| [`utils/flow-engine.ts`](../utils/flow-engine.ts) | JSON multi-step flow runner |
| [`utils/localization.ts`](../utils/localization.ts) | `t()` / `tt()` across 6 languages |
| [`utils/runtime.ts`](../utils/runtime.ts) | Loads JSON config + `buildLocationContext` |
| [`utils/state.ts`](../utils/state.ts) | `createInitialState` + `resetMachineFacts` |
| [`utils/escalation.ts`](../utils/escalation.ts) | Operator handover summary |
| [`docs/usecases.md`](./usecases.md) | 32 customer scenarios — the spec / bible |
| [`docs/reglas.md`](./reglas.md) | Business rules — INJECTED in prompt |
| [`json/locations.json`](../json/locations.json) | Per-laundry overrides (mostly LLM-read) |
| [`json/faqs.json`](../json/faqs.json) | Base FAQ catalogue |
| [`json/washer_hs60xx.json`](../json/washer_hs60xx.json), [`dryer_ed340.json`](../json/dryer_ed340.json) | Multi-step flows |
