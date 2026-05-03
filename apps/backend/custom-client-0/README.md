# Cliente-0 — Ecolaundry Chatbot

LLM-as-agent chatbot for **Ecolaundry** (Spanish self-service laundromat chain). Single codebase, multi-tenant ready, multilingual.

```
USER msg → autoExtractFacts → guardPipeline → LLM (with tools) → reply
                              (deterministic) (OpenRouter)
```

## Quick start

```bash
cd apps/backend/custom-client-0
npm run demo            # interactive REPL
npm run test:agent      # full test suite
```

You need `OPENROUTER_API_KEY` in `.env`.

## What it does

Handles 32 documented customer scenarios from [`docs/01usecases.md`](./docs/01usecases.md):
- **Technical incidents**: machine displays (PUSH PROG, DOOR, SEL, ALM/DOOR, ALN, AL001, 001, ERR codes)
- **Payment incidents**: double charge, datáfono wrong amount, refund demand
- **Cross-cutting**: angry customer, contradictory narrative, customer doesn't know location
- **FAQ**: hours, loyalty card, prices, invoice
- **Multi-location**: per-laundry overrides for FAQs and rules (Goya, Pineda, Hortes, Mataró, Alemanya, L'Escala)

## Architecture (one paragraph)

The agent runs a **3-stage pipeline** for every turn:

1. **`autoExtractFacts`** ([utils/agent-extract.ts](./utils/agent-extract.ts)) — pure regex extraction of sticky facts (location, machine type, display state, incident markers) into session state. No I/O, no LLM.
2. **`runGuardPipeline`** ([utils/agent-guards.ts](./utils/agent-guards.ts)) — ordered list of ~25 deterministic guards. The first one that matches the current state produces a canned reply (in the customer's language) and short-circuits the LLM. This is what guarantees the bot follows [`docs/01usecases.md`](./docs/01usecases.md) verbatim for the codified cases.
3. **LLM agent loop** ([utils/agent-llm.ts](./utils/agent-llm.ts) + [utils/agent-tools.ts](./utils/agent-tools.ts)) — if no guard fired, OpenRouter (gpt-4o-mini) gets the system prompt with `{{reglas}}` injected ([`docs/02reglas.md`](./docs/02reglas.md)) plus 12 tools wrapping the flow-engine, FAQ lookups, location overrides, and escalation. Tools mutate state; the LLM keeps replying until it produces a final message (no more tool calls) or hits MAX_TOOL_HOPS.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full picture.

## Repo layout

```
apps/backend/custom-client-0/
├── agent.ts              # entrypoint (npm run demo)
├── prompts/
│   └── agent.txt         # system prompt template ({{reglas}}, {{location}}, …)
├── docs/
│   ├── 01usecases.md     # 32 customer scenarios — the spec / "bible"
│   ├── 02reglas.md       # business rules — INJECTED IN PROMPT every turn
│   ├── ARCHITECTURE.md   # detailed design
│   ├── TESTING.md        # how the test suite is organized
│   └── CASES_COVERAGE.md # which case → which guard / json / faq
├── json/
│   ├── settings.json             # tenant: enabledLanguages, defaultLanguage, welcome
│   ├── locations.json            # per-laundry metadata + faqOverrides + rules
│   ├── faqs.json                 # base FAQ catalogue
│   ├── lavatrice_hs60xx.json     # washer technical flows (case_push, case_door, …)
│   └── asciugatrice_ed340.json   # dryer technical flows
├── utils/
│   ├── agent-extract.ts  # deterministic fact extraction
│   ├── agent-guards.ts   # deterministic guard pipeline
│   ├── agent-tools.ts    # 12 LLM-callable tools
│   ├── agent-prompt.ts   # system prompt assembly (injects {{reglas}})
│   ├── agent-llm.ts      # OpenRouter wrapper
│   ├── agent-welcome.ts  # first-turn welcome rendering
│   ├── agent-types.ts    # shared types
│   ├── state.ts          # SessionState shape + initial state
│   ├── localization.ts   # 6-language translation table (`t()` / `tt()`)
│   ├── intent.ts         # regex helpers (display extraction, location, …)
│   ├── flow-engine.ts    # JSON flow execution engine
│   ├── runtime.ts        # loads JSON config once
│   └── …
├── __tests__/agent/      # acceptance tests, one spec per case
│   ├── run.ts            # recursive runner
│   ├── _helpers.ts       # TestCase + assertions
│   ├── *.test.spec.ts    # case tests
│   └── locations/        # location-specific tests
└── package.json          # only 3 scripts: demo, test:agent, test:case
```

## Tenant config

Edit `json/settings.json`:

```json
{
  "enabledLanguages": ["es"],
  "defaultLanguage": "es",
  "chatbotName": "Eco",
  "welcomeMessage": { "es": "¡Hola! Soy {{chatbotName}}, …" }
}
```

`enabledLanguages` is a hard lock — even if the customer types in Italian, the bot replies in `defaultLanguage` if Italian isn't enabled.

## Running tests

```bash
npm run test:agent
```

Each test in `__tests__/agent/*.test.spec.ts` is a small dialog with assertion-style probes (`expectMentionsAll`, `expectStateHas`). The runner walks the directory recursively. See [`docs/TESTING.md`](./docs/TESTING.md).

## Production rules (Andrea)

1. **`docs/01usecases.md` is the spec / bible** — when test ↔ doc disagree, doc wins (under `custom-client-0/`).
2. Prompts live in `prompts/`, never inline in code.
3. No hardcoded language detection — `settings.enabledLanguages` is the source of truth.
4. Multilingual: never hardcode Spanish responses; use `localization.ts` `t()`.
5. JSON for technical flows. Guards for case-specific canned replies. `02reglas.md` for tone/policy.
