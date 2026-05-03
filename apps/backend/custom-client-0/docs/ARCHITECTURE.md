# Architecture

## High-level flow

```
USER message
   │
   ▼
┌──────────────────────────────────────────────┐
│ 1. autoExtractFacts (utils/agent-extract.ts) │  PURE / DETERMINISTIC
│    Extracts: location, machineType,          │  No I/O, no LLM call.
│    machineNumber, displayState, payment      │  Sets session state +
│    Sets: pendingFlow markers (caso 6/7/17/   │  pendingFlow / nonTroubleshootingIncident.
│    18/26/28), nonTroubleshootingIncident     │
│    Detects topic switches (machine→payment)  │
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 2. runGuardPipeline (utils/agent-guards.ts)  │  DETERMINISTIC, ORDERED
│    Iterates ~25 guards in order. First that  │  First match wins —
│    matches returns a canned reply →          │  bypasses LLM entirely.
│    pipeline stops, reply returned.           │
│    See "Guard pipeline" section.             │
└──────────────────────────────────────────────┘
   │ no guard fired
   ▼
┌──────────────────────────────────────────────┐
│ 3. LLM agent loop (agent.ts)                 │  STOCHASTIC
│    System prompt = prompts/agent.txt with    │  - {{reglas}} = docs/02reglas.md
│    runtime values substituted.               │    INJECTED at every turn
│    LLM (OpenRouter gpt-4o-mini) can call     │  - 12 tools available
│    tools to mutate state or read JSON.       │  - Loop until no tool call
└──────────────────────────────────────────────┘
   │
   ▼
Final reply → state persists for next turn
```

## State (`utils/state.ts`)

The session is an in-memory object that survives across turns. Sticky facts:

| Field | Set by | Used by |
|---|---|---|
| `language` | language detection on first turn | every reply |
| `location` | `extractExplicitLocation` or LLM tool | guards, FAQ overrides, escalation summary |
| `locationStreet` | Mataró-only guard | `guardMataroStreet` |
| `machineType` | `normalizeMachineType` | flow-engine, force-number guard |
| `machineNumber` | regex on user reply | escalation, force-display guard |
| `displayState` | `extractDisplayState` | most case-specific guards |
| `paymentCompleted` | `parseExplicitPaymentSignal` | doble cobro |
| `nonTroubleshootingIncident` | topic-switch detector + first-message detector | `guardEscalateNonTroubleshooting`, gather-skip |
| `pendingFlow` | autoExtract markers (caso 6/7/17/18) | sequential multi-turn guards |
| `activeFlowId` | LLM `start_machine_flow` tool OR guards | guards' precedence checks |
| `operatorRequested` / `customerNameRequested` / `customerName` | guards / `escalate_to_operator` tool | escalation summary, post-name short-circuit |

State is wiped on topic switch (`resetMachineFacts`) but customer-level facts (`location`, `customerName`, `language`) survive.

## Guard pipeline

Pipeline is **ordered**. Each guard is a pure function `(ar, userMessage) → outcome | null`. The first non-null wins.

| Order | Guard | When it fires |
|---|---|---|
| 1 | `guardCaso7AskCambio` | After "He pagado pero no he podido usar" + location → "¿La central te ha devuelto el cambio?" |
| 2 | `guardCaso7AwaitDisplay` | Customer answered yes to cambio → asks display |
| 3 | `guardNumericCodeAskLetters` | Caso 18: numeric-only code → "¿hay letras delante?" |
| 4 | `guardNumericCodeNoLetters` | Caso 18 step 2: customer said no → escalate without confronting |
| 5 | `guardCaso10Tarjeta` | Caso 10: loyalty card query → base FAQ + location override |
| 6 | `guardCaso12Horarios` | Caso 12: hours FAQ → 8:00–22:00 (or 7–23 in L'Escala) |
| 7 | `guardCaso25Empathic` | Caso 25: angry customer → empathic opener + ask location |
| 8 | `guardCaso28Contradictory` | Caso 28: "no lo sé bien" during payment incident → escalate |
| 9 | `guardCaso6AskPodidoLavar` | Caso 6 step 1: "me han cobrado dos veces" + location → "¿has podido lavar?" |
| 10 | `guardCaso6AskRelato` | Caso 6 step 2: ask paso a paso |
| 11 | `guardCaso6Ask4Digitos` | Caso 6 step 3: ask card last-4 |
| 12 | `guardCaso6AskCaptura` | Caso 6 step 4: ask payment screenshot + escalate with closure |
| 13 | `guardCaso17AskPhoto` | Caso 17: customer can't read display → ask photo |
| 14 | `guardCaso17NoPhoto` | Caso 17 step 2: customer can't send photo → escalate |
| 15 | `guardCaso31InsistLocation` | Caso 31: "no lo sé" when asked location → re-ask |
| 16 | `guardCaso26Refund` | Caso 26/27: refund demand → step1 ask data, step2 escalate |
| 17 | `guardCaso5Al001AskBefore` | Caso 5: AL001 + location + type → "¿qué has hecho justo antes?" |
| 18 | `guardCaso14AlmDoorEscalate` | Caso 14: in caso14-alm-door flow + customer says fail → escalate |
| 19 | `guardCaso14AlmDoor` | Caso 14: ALM/DOOR + facts → instruction (open door, check garments) |
| 20 | `guardPostInstructionFailure` | Generic: bot has given an instruction + customer says it didn't work → escalate |
| 21 | `guardMataroStreet` | Mataró location → ask street |
| 22 | `guardEscalateNonTroubleshooting` | nonTroubleshootingIncident set + location → escalate without confronting |
| 23 | `guardForceMachineType` | location known + type missing + not non-troubleshooting → ask "lavadora o secadora?" |
| 24 | `guardForceDisplay` | location + type + number known + display missing → ask display |
| 25 | `guardForceMachineNumber` | location + type known + number missing → ask number |
| 26 | `guardEscalateUnknownDisplay` | display + location + type + number known + display not recoverable → escalate |

## LLM tools (when no guard fires)

| Tool | What it does |
|---|---|
| `set_location` | Persist location resolved from user reply |
| `set_location_street` | Mataró street |
| `set_machine_facts` | Type and/or number |
| `set_payment_facts` | paymentCompleted flag, method |
| `set_display_state` | Persist display code |
| `start_machine_flow` | Open a JSON flow → returns first step prompt |
| `advance_machine_flow` | Advance JSON flow with user reply |
| `apply_faq_override` | Read base FAQ + location override → return text to use |
| `capture_customer_name` | Save name (first token only) |
| `escalate_to_operator` | Mark for handover; include reason |
| `request_photo` | Mark photo requested |
| `mark_resolved` | Close the incident |

## What goes where

- **JSON flows** (`json/lavatrice_hs60xx.json`, `json/asciugatrice_ed340.json`) — step-by-step technical workflows opened via `start_machine_flow`.
- **Guards** — case-specific canned replies in the customer's language using `localization.ts`.
- **`docs/02reglas.md`** — INJECTED in the system prompt (`{{reglas}}`) every turn. Defines tone, forbidden phrases, escalation criteria the LLM must respect.
- **`docs/01usecases.md`** — spec / bible, NOT injected at runtime, but used by humans to write tests and design guards.
- **`prompts/agent.txt`** — system prompt template with `{{placeholders}}`.
- **`json/locations.json`** — per-laundry metadata + `faqOverrides` + `escalationRules`.
- **`json/faqs.json`** — base FAQ texts (keyed by id: `loyaltyCard`, `paymentMethods`, `pricing`, …).
- **`json/settings.json`** — tenant lock (enabledLanguages, defaultLanguage, chatbot name, welcome).
