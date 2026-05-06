# Cliente-0 — Ecolaundry Chatbot

LLM-first chatbot for **Ecolaundry** (self-service laundromat chain). Single codebase, multi-tenant ready, multilingual (es, it, ca, en, pt, fr).

```
USER msg
   │
   ├── autoExtractFacts        (deterministic — pure facts only)
   │      • location, machineType (+ fuzzy), machineNumber, displayState,
   │        payment signal
   │      • post-resolution reset (only on pendingClosure='resolved')
   │
   ├── runGuardPipeline        (small set — non-classifying guards only)
   │      • Mataró street, FAQ closure, opening multi-step flows,
   │        hard escalation (unknown display, contradictory narrative,
   │        refund demand, angry customer)
   │
   └── LLM (system prompt + tools)   ← 90% of intent decisions
          • reads sticky facts + canonical answer tables
          • calls set_*, mark_resolved, escalate_to_operator
          • multi-language reply
```

## Quick start

```bash
cd apps/backend/custom-client-0
npm run demo            # interactive REPL (LLM live)
npm run test:agent      # full LLM scenario suite (costs ~$0.10)

# Deterministic unit tests (fast, no LLM)
node --import tsx __tests__/unit/extract-facts.test.ts
node --import tsx __tests__/unit/display-change-mid-flow.test.ts
node --import tsx __tests__/unit/post-resolution-reset.test.ts
node --import tsx __tests__/unit/machine-type-fuzzy.test.ts
node --import tsx __tests__/unit/machine-switch.test.ts
node --import tsx __tests__/unit/full-conversation-state.test.ts
```

You need `OPENROUTER_API_KEY` in `.env`.

## What it does

Handles 32 documented scenarios from [`docs/usecases.md`](./docs/usecases.md):
- **Technical incidents**: PUSH PROG, DOOR, SEL, ALM/DOOR, ALN, AL001, ERR codes
- **Payment**: double charge, datáfono wrong amount, refund demand
- **Cross-cutting**: angry customer, contradictory narrative, unknown location
- **FAQ**: hours, loyalty card, prices, invoice
- **Multi-location overrides**: Goya, Pineda, Hortes, Mataró, Alemanya, L'Escala

**Multi-incident sessions are supported** — the customer can chain problems on the same machine (SEL → DOOR → PUSH PROG = display advances), switch machines (washer → dryer), and ask FAQ tangents mid-flow without losing flow state.

## Architecture in one paragraph

**Deterministic side** does only two things: (1) **extract facts** that are enumerable (numbers, display codes, names from a closed list, machine types via fuzzy match against a vocabulary), and (2) **open multi-step flows** by setting `state.pendingFlow` markers. **Intent classification is delegated entirely to the LLM**: yes/no answers, resolution confirmations, FAQ tangents, machine switches, and topic changes are interpreted semantically across all 6 languages by reading sticky facts + the canonical-answer tables in the system prompt. The LLM mutates state via tools (`set_location`, `set_machine_facts`, `set_display_state`, `mark_resolved`, `escalate_to_operator`). Resolution flows through `mark_resolved` → `pendingClosure='resolved'` → next-turn reset of per-incident facts (preserving location/customerName/language).

**Why LLM-first?** Multi-language regex for "the customer confirmed it works" is unmaintainable: each new language needs new patterns and edge cases keep slipping through. The LLM handles all 6 languages (and any future one) for free; we only pay regex complexity for things that are genuinely enumerable.

See [`docs/architecture.md`](./docs/architecture.md) for the full design (principles, responsibility table, regex-vs-LLM rule).

## Repo layout

```
apps/backend/custom-client-0/
├── agent.ts                  # CLI entrypoint (npm run demo)
├── index.ts                  # web entrypoint (chatbotFn) — reuses agent.ts
├── prompts/
│   └── agent.txt             # system prompt: GOLDEN RULE, mandatory
│                             # tool rules, canonical-answer tables,
│                             # PENDING-FLOW rules
├── models/                   # type definitions only (no runtime)
│   ├── agent.ts              # AgentRuntime, AgentMessage, AgentSession
│   ├── chatbot-io.ts         # ChatbotInput / ChatbotOutput contract
│   ├── runtime.ts            # Settings, Runtime, FlowNode, …
│   ├── state.ts              # SessionState (sticky facts shape)
│   ├── escalation.ts         # EscalationContext
│   ├── flow.ts               # FlowEngineResult, LlmRequest, Route
│   ├── guards.ts             # Guard, GuardOutcome
│   └── index.ts              # barrel re-export
├── docs/
│   ├── usecases.md           # 32 customer scenarios — the spec
│   ├── reglas.md             # business rules — INJECTED in prompt
│   ├── architecture.md       # detailed design + principles
│   ├── settings.md           # tenant config reference
│   ├── prompts.md            # prompt assembly walkthrough
│   ├── TESTING.md            # test strategy
│   └── pdf/                  # operator playbooks (reference)
├── json/
│   ├── settings.json         # tenant: enabledLanguages, defaultLanguage,
│   │                         # welcomeMessage, agentTemperature, …
│   ├── locations.json        # per-laundry metadata + faqOverrides
│   ├── faqs.json             # base FAQ catalogue
│   ├── washer_hs60xx.json    # washer technical flows (case_push, …)
│   └── dryer_ed340.json      # dryer technical flows
├── utils/
│   ├── agent-extract.ts      # deterministic fact extractor
│   ├── agent-tools.ts        # LLM-callable tool dispatcher
│   ├── agent-prompt.ts       # system prompt assembly
│   ├── agent-llm.ts          # OpenRouter wrapper (timeout + retry +
│   │                         # prompt-cache headers + agentMaxTokens)
│   ├── agent-welcome.ts      # first-turn welcome rendering
│   ├── intent.ts             # regex helpers + Levenshtein fuzzy match
│   │                         # for machineType
│   ├── flow-engine.ts        # JSON multi-step flow runner
│   ├── localization.ts       # t() / tt() across 6 languages
│   ├── runtime.ts            # loads JSON config once
│   ├── state.ts              # createInitialState + resetMachineFacts
│   ├── escalation.ts         # operator handover summary
│   ├── message-parsing.ts    # closed-set helpers (location resolve, …)
│   ├── display-state.ts      # display token normalizer
│   ├── llm.ts                # language detection + model resolver
│   ├── llm-fetch.ts          # resilient fetch (timeout + retry/backoff)
│   ├── cli.ts                # CLI banner + message printer
│   └── guards/               # ordered deterministic guards
│       ├── helpers.ts        # shared helpers (lang, isMataro, …)
│       ├── payment.ts        # cambio, pagado-no-usado, código, tarjeta
│       ├── display.ts        # AL001, ALM/DOOR, C001, numeric codes,
│       │                     # post-instruction failure, undocumented
│       │                     # display escalation
│       ├── location.ts       # Mataró street, force-gather, mismatch
│       ├── faq.ts            # closure, factura, precio, horarios,
│       │                     # angry, refund/compensation, contradictory
│       └── index.ts          # GUARD_PIPELINE + runGuardPipeline
└── __tests__/
    ├── agent/                # LLM-live scenario tests
    │   ├── run.ts            # recursive runner
    │   ├── _helpers.ts       # TestCase + concept-based assertions
    │   ├── *.test.spec.ts    # one per scenario
    │   └── locations/        # location-specific tests
    └── unit/                 # deterministic, no LLM, fast
        ├── extract-facts.test.ts
        ├── display-change-mid-flow.test.ts
        ├── post-resolution-reset.test.ts
        ├── machine-type-fuzzy.test.ts
        ├── machine-switch.test.ts
        └── full-conversation-state.test.ts
```

## Code-read vs prompt-read knowledge ⚠️

The chatbot has TWO consumers of the JSON config:

| Consumer | Reads |
|---|---|
| **TypeScript code** | A small subset of fields used by deterministic guards/flows (e.g. `cardPaymentUnreliable`, `dryerMinutesIncreaseIssue`). Find with `grep` on `.ts`. |
| **LLM (system prompt)** | The **entire** active-location override is JSON-serialized and injected into the system prompt every turn (see [`utils/agent-prompt.ts:buildSystemPrompt`](./utils/agent-prompt.ts) → `locationContext`). The LLM reads it to give tenant-specific answers. |

**Implication:** a metadata field with zero TS references is NOT dead code — it is LLM knowledge. Examples:
- `cardUnitPrice: "7€"` → the LLM uses it to answer "¿cuánto cuesta?" without inventing prices.
- `centralType: "buttons"` → the LLM tailors instructions ("pulsa el botón") vs a hypothetical touch central.
- `selfStartMachine: true` → the LLM explains whether the machine starts automatically after payment.
- `dryerFilterSelfService: false` → the LLM tells the customer NOT to clean the filter themselves at this location.

When auditing for dead code, always check the prompt injection path BEFORE removing a field. `_overrideTypes.metadata` in [`json/locations.json`](./json/locations.json) documents this.

## Regex vs LLM — the rule

| Use **regex** for | Use **LLM** for |
|---|---|
| Enumerable values (numbers, codes) | Intent (yes/no, confirmation) |
| Closed lexical sets (display tokens, location names) | Topic changes |
| Vocabulary + Levenshtein fuzzy (washer/dryer typos) | FAQ tangents |
| Structural patterns (price `\d+,\d{2}€`) | Multi-language semantic decisions |

Adding a new language? Add it to `enabledLanguages`, push 1 word per machine type to `WASHER_VOCAB`/`DRYER_VOCAB`, add translations to `localization.ts`. **No intent regex to update** — the LLM speaks the new language for free.

## Tenant config

Edit [`json/settings.json`](./json/settings.json):

```json
{
  "enabledLanguages": ["es"],
  "defaultLanguage": "es",
  "chatbotName": "Eco",
  "companyName": "Ecolaundry",
  "model": "openai/gpt-4o-mini",
  "agentTemperature": 0.3,
  "agentMaxTokens": 800,
  "maxToolHops": 6,
  "historyResetTtlMs": 3600000,
  "sessionIdleTtlMs": 1800000,
  "welcomeMessage": { "es": "¡Hola! Soy {{chatbotName}}, …" }
}
```

`enabledLanguages` is a hard lock — even if the customer types in Italian, the bot replies in `defaultLanguage` when Italian isn't enabled.

`historyResetTtlMs` controls how long (ms) the conversation history stays live: when the gap between the last history entry and the incoming message exceeds this value, the chatbot drops the history and starts a fresh session (welcome message again, no remembered location/machine). Default 1 h. `sessionIdleTtlMs` controls in-process session eviction (default 30 min). Both read from `settings.json` at runtime.

## Running tests

**Unit (deterministic, fast, free)** — run any of the files under `__tests__/unit/` directly with tsx; they return non-zero exit on failure.

**LLM scenarios (live OpenRouter, ~$0.10 per full run)**:

```bash
npm run test:agent              # all
npm run test:agent -- 08-sel    # filter by name
```

Concept-based assertions (`expectAsksForLocation`, `expectMentionsAll`, `expectStateHas`) keep tests resilient to LLM phrasing variations. See [`docs/TESTING.md`](./docs/TESTING.md).

## Production rules

1. **`docs/usecases.md` is the spec** — when test ↔ doc disagree, doc wins.
2. Prompts live in [`prompts/agent.txt`](./prompts/agent.txt), never inline in code.
3. No hardcoded language detection — `settings.enabledLanguages` is the source of truth.
4. **Never use regex to classify customer intent** (yes/no, confirmation, topic). That's what the LLM is for. Regex is for enumerable facts only.
5. **`mark_resolved` is mandatory** when the customer confirms a fix. The deterministic post-resolution reset depends on it; the prompt rule documents this in detail.
6. Multilingual: never hardcode deterministic reply strings — use `localization.ts` `t()` / `tt()` for all customer-facing text in guards.
7. JSON for technical flows. Small set of guards for opening flows. `reglas.md` for tone/policy.
8. **Location-specific data belongs in `locations.json`**, not in guard code. Use `faqOverrides` for per-location FAQ answers (e.g. `openingHours`) so guards can stay generic.
9. **Business constants belong in `settings.json`** — timeouts (`historyResetTtlMs`, `sessionIdleTtlMs`), model, temperatures, emails. See [`docs/settings.md`](./docs/settings.md) for the full reference.
