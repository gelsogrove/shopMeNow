# FLOW Architecture — Ecolaundry

> Single source of truth for the FLOW chatbot.
> Visual source of truth: `docs/cliente-0/docs/LLMarchetecture.png`.

---

## 1. Architecture We Are Describing

The architecture to follow is the one shown in `LLMarchetecture.png`:

```text
Customer Message
  -> Router
  -> one of:
     - Dryer ED-340
     - Washer HS-60XX
     - Contact Operator
     - resetSession
  -> Conversation History
  -> Response to Customer
```

This means we are describing a system where:
- the Router analyzes and routes
- the Router is not the final customer-facing voice
- the customer-facing voice is `Conversation History`

> Important: this file describes only the pure FLOW chatbot responsibility model.
> The deterministic flow engine still exists for active machine flows, but it lives inside the machine path and is not the humanization layer.

---

## 2. Canonical Dictionary

Use only these names in this file:
- `Router` = the first classifier and dispatcher
- `Washer Specialist` = technical reasoning layer for washer cases
- `Dryer Specialist` = technical reasoning layer for dryer cases
- `Conversation History` = the only customer-facing writing layer
- `Flow Engine` = deterministic JSON flow executor used after a specialist starts a flow

Do not use these as separate runtime entities:
- `SubLLM`
- `History Agent`
- `Assistant Output` as if it were a separate LLM

`Assistant Output` is only the final message produced after `Conversation History` and post-processing.

---

## 3. Responsibilities

### Router

| Field | Responsibility |
|---|---|
| Type | LLM classifier/router |
| Main role | Analyze the message and choose the next owner |
| Speaks to customer | NO |
| Writes final FAQ answer | NO |
| Writes final gather question | NO |
| Can extract facts from the message | YES |
| Can route to machine specialist | YES |
| Can call actions | YES |

The Router must do only these things:
- detect whether the message is washer, dryer, operator, reset, FAQ, greeting, or unclear
- extract facts already present in the user text, such as `location`, `machineType`, `machineNumber`, `displayState`, `paymentMethod`, `serviceCompleted`, `changeReturned`
- decide which downstream component should handle the case
- call `contactOperator()` when escalation is clearly needed
- call `resetSession()` when restart is clearly needed
- delegate to `lavatrice_hs60xx(machineNumber)` or `asciugatrice_ed340(machineNumber)` when machine routing is clear

The Router must also produce a structured handoff contract for the next layer.
At minimum, that contract must contain:
- selected route
- extracted facts
- missing required facts
- escalation reason if present
- customer-facing goal for the next layer

The Router must not do these things:
- it must not be the final customer-facing voice
- it must not answer FAQs directly
- it must not ask the customer the final question directly
- it must not own tone of voice
- it must not own chatbot wording
- it must not humanize technical instructions

### Washer Specialist

| Field | Responsibility |
|---|---|
| Type | LLM technical reasoning layer |
| Main role | Understand washer problems and choose the correct technical path |
| Speaks to customer | NO |
| Owns generic FAQs | NO |
| Can start a flow | YES |
| Can ask for one last technical clarification internally | YES |

The Washer Specialist must:
- analyze washer-specific problems
- decide whether a washer flow must start
- distinguish between process errors, payment problems, display states, STOP cases, alarm cases, post-cycle wet clothes, blocked door, and damage cases
- call `startFlow(flowId)` when the correct flow is clear
- call `contactOperator()` for unsafe or unsupported cases
- call `resetSession()` if the machine type/number is wrong
- pass its technical decision to `Conversation History`

The Washer Specialist must know these decision families from the customer material:
- `SEL`, `PUSH PROG`, `DOOR`, `001` / `AL001`
- `ALM/*` alarm handling
- `END + bAL`
- `STOP` consequences
- wet clothes / no centrifuge
- blocked door after cycle
- no foam / detergent perception
- occupied machine cases

### Dryer Specialist

| Field | Responsibility |
|---|---|
| Type | LLM technical reasoning layer |
| Main role | Understand dryer problems and choose the correct technical path |
| Speaks to customer | NO |
| Owns generic FAQs | NO |
| Can start a flow | YES |
| Can ask for one last technical clarification internally | YES |

The Dryer Specialist follows the same rule set as the Washer Specialist, but only for dryer cases.

The Dryer Specialist must know these decision families from the customer material:
- default screen / payment added / minutes not added
- door and filter states
- `FALLO DE ROTACION`
- `FALLO DE ASPIRACION`
- wet clothes after cycle
- soaking wet clothes coming from washer
- burnt clothes / plastic / stained clothes
- blocked door after cycle
- occupied machine cases

### Conversation History

| Field | Responsibility |
|---|---|
| Type | LLM humanization layer |
| Main role | Write the only customer-facing message |
| Speaks to customer | YES |
| Owns greeting | YES |
| Owns generic FAQ wording | YES |
| Owns gather questions | YES |
| Owns tone and identity | YES |

Conversation History is the single visible voice of the chatbot.

It receives routing and technical decisions from upstream and turns them into the final customer-facing message.

It must:
- greet the customer
- ask for missing information when the Router says information is missing
- answer general business FAQs using `{{faqs}}`
- humanize machine specialist decisions
- restate the current flow step when `Flow Engine` returns an instruction
- phrase operator escalation clearly and calmly
- maintain the same tone across all paths

It must not decide the technical truth by itself.
It can phrase, simplify, and order the message, but it must not replace Router classification, Specialist diagnosis, or Flow Engine instructions.

### Flow Engine

| Field | Responsibility |
|---|---|
| Type | Deterministic code, 0 LLM calls |
| Main role | Execute active JSON flow steps |
| Speaks to customer directly | NO |
| Produces operational result | YES |

The Flow Engine:
- runs only when a machine flow is active
- reads JSON nodes and transitions
- never owns FAQ logic
- never owns human tone
- never owns final writing
- sends its result to `Conversation History`, which writes the final message

---

## 4. The Core Rule About Speaking

There is only one customer-facing voice in this architecture:
- `Conversation History`

So the rule is:
- `Router` decides
- `Washer Specialist` or `Dryer Specialist` decides technically
- `Flow Engine` decides the current operational step
- `Conversation History` writes the customer-facing message

If a message is visible to the customer, it belongs conceptually to `Conversation History`, even when its content came from Router, Specialist, or Flow Engine.

---

## 5. Who Owns What

| Responsibility | Owner |
|---|---|
| Initial classification | Router |
| Machine routing | Router |
| Escalation routing | Router or Specialist |
| Session reset routing | Router or Specialist |
| Generic FAQ content selection | Router decides intent, Conversation History writes answer |
| Generic FAQ text shown to customer | Conversation History |
| Gather question shown to customer | Conversation History |
| Minimal data extraction from raw message | Router |
| Required missing fields list | Router |
| Technical decision for washer cases | Washer Specialist |
| Technical decision for dryer cases | Dryer Specialist |
| Technical diagnosis | Washer Specialist / Dryer Specialist |
| Flow start | Washer Specialist / Dryer Specialist |
| Active flow execution | Flow Engine |
| Final wording | Conversation History |
| Tone of voice | Conversation History |
| Chatbot identity | Conversation History |

---

## 6. Variable Ownership

### Router prompt variables

The Router is not the visible voice, so it should not own customer-facing wording variables.

Router should not require:
- `{{faqs}}`
- `{{toneOfVoice}}`
- `{{chatbotName}}`

Router may use only routing-relevant context, for example:
- workspace name if needed
- current session state
- already extracted facts

Router should receive the operational rules needed to classify correctly, but not the human-facing FAQ wording block.

### Conversation History prompt variables

Conversation History is the visible voice, so it must own the human-facing variables:
- `{{faqs}}`
- `{{toneOfVoice}}`
- `{{chatbotName}}`
- `{{customerName}}`

### Specialist prompt variables

Specialists are technical reasoning layers, not the final voice.

So specialists should not own the general chatbot wording variables by default.
They should focus on:
- machine knowledge
- available flows
- technical rules
- already collected facts

They may still require technical knowledge extracted from the PDFs, because otherwise they cannot classify the case correctly.

## 7. State And Memory

`ChatSession.context` should keep enough information for handoff between layers.

```typescript
interface ChatContext {
  selectedRoute?: "washer" | "dryer" | "faq" | "operator" | "reset" | "unknown"
  selectedAgent?: "router" | "washer_hs60xx" | "dryer_ed340" | "flow_engine"

  extractedFacts?: {
    location?: string
    machineType?: "washer" | "dryer"
    machineNumber?: string
    issueSummary?: string
    serviceCompleted?: boolean
    paymentMethod?: "card" | "cash" | "code" | "unknown"
    paymentCompleted?: boolean
    displayState?: string
    alarmCode?: string
    changeReturned?: boolean
    extraTimeAdded?: boolean
    last4CardDigitsProvided?: boolean
    paymentProofProvided?: boolean
  }

  missingFacts?: string[]

  routingDecision?: {
    route: "washer" | "dryer" | "faq" | "operator" | "reset" | "unknown"
    nextOwner: "conversation_history" | "washer_specialist" | "dryer_specialist" | "flow_engine"
    customerFacingGoal:
      | "greet"
      | "ask_missing_location"
      | "ask_missing_machine_type"
      | "ask_missing_machine_number"
      | "ask_missing_display_state"
      | "answer_general_faq"
      | "communicate_operator_handoff"
      | "communicate_reset"
      | "communicate_technical_next_step"
    escalationReason?: string
  }

  flowState?: {
    flowId: string
    currentNodeId: string
    flowStatus: "ACTIVE" | "PAUSED" | "COMPLETED" | "ESCALATED"
    interruptCount: number
  }
}
```

The Router should save:
- what route was selected
- what facts were extracted from the latest customer message
- what facts are still missing before a safe diagnosis
- what customer-facing goal the next layer must realize
- which downstream owner must handle the next step

The point is not that the Router "speaks".
The point is that the Router leaves enough context so the next layer can speak correctly.

---

## 8. End-To-End Pipeline

### Path 1: No active machine flow

```text
Customer Message
  -> Router analyzes message
  -> Router selects next owner
  -> Router passes structured handoff contract
  -> Conversation History writes customer-facing message
  -> Response to Customer
```

Examples:
- greeting
- general FAQ
- missing location
- missing machine number
- operator escalation
- restart confirmation

### Path 2: Machine specialist path

```text
Customer Message
  -> Router selects Washer Specialist or Dryer Specialist
  -> Specialist analyzes the technical problem
  -> Specialist starts flow or returns technical decision
  -> Conversation History writes customer-facing message
  -> Response to Customer
```

### Path 3: Active flow path

```text
Customer Message
  -> Flow Engine handles active step
  -> Flow Engine returns operational result
  -> Conversation History rewrites result without changing meaning
  -> Response to Customer
```

> The PNG does not draw `Flow Engine`, but it still exists inside the machine troubleshooting path.
> This file intentionally stays at FLOW-chatbot level and does not document downstream platform delivery layers.

---

## 9. Anti-Hardcode Rule

**The system must never detect intent by matching strings or phrases.**

### Why

The chatbot is multilingual (Spanish, Italian, Portuguese, Catalan, French, English).
Any hardcoded phrase check breaks silently when the customer uses a synonym, a typo, or another language.

### What is forbidden

```typescript
// ❌ FORBIDDEN — hardcoded intent detection
if (message.includes("no arranca")) { ... }
if (/no funciona|non funziona/.test(message)) { ... }
const keywords = ["ordine", "order"] // ❌

// ❌ FORBIDDEN — per-language switch cases for customer-facing strings
function getLocalizedWelcome(lang) {
  if (lang === 'es') return 'Hola, soy tu asistente...'  // ❌ — Translation LLM handles this
  if (lang === 'ca') return 'Hola, soc el teu assistent...'  // ❌
}

// ❌ FORBIDDEN — injecting language-specific text in the orchestrator
function injectSpanishEscalationClosure(message) { ... }  // ❌
```

### What is allowed

```typescript
// ✅ ALLOWED — normalizing finite machine hardware codes
normalizeDisplayState("PUSH PROG")  // → "PUSH"  (hardware codes, not language)

// ✅ ALLOWED — small LLM call to classify ambiguous free-text input
classifyChoiceViaLLM(node, userInput)  // max 20 tokens, maps input → choice key

// ✅ ALLOWED — numeric selection
if (/^\d+$/.test(input)) ...  // user picks a numbered option

// ✅ ALLOWED — yes/no confirmation
normalizeConfirmation(input)  // sí/no/ok/yes/no
```

### The rule

| Responsibility | Who handles it |
|---|---|
| Intent classification | Router LLM |
| Customer-facing text, tone, translation | Conversation History LLM |
| Ambiguous choice resolution in active flow | classifyChoiceViaLLM (micro-LLM) |
| Normalizing hardware display codes | `normalizeDisplayState()` — deterministic, finite set |

---

## 10. Full Runtime Pipeline

The complete runtime sequence for one customer message is:

```text
Customer Message
  │
  ▼
[STEP 1] Pre-Router Fact Extractor (deterministic, no LLM)
  - Reads raw message before the Router sees it
  - Extracts: location, machineType, machineNumber, displayState, paymentCompleted
  - Uses pattern rules for finite hardware codes (SEL, PUSH, AL001, etc.)
  - Updates SessionState directly
  - Result: enriched message / extracted facts list passed to Router
  │
  ▼
[STEP 2] Router LLM
  - Receives: enriched message + current SessionState
  - Outputs: RouterDecision (route, functionName, extractedFacts, missingFacts, customerFacingGoal)
  - Does NOT speak to customer
  - Does NOT own tone or wording
  │
  ▼
[STEP 3] Router Safety Corrector (deterministic, no LLM)
  - Runs after Router, before downstream
  - Overrides incorrect Router decisions using session context:
    - double-charge path enforcement
    - no-foam FAQ override
    - prevent false resetSession() when machine context exists
    - re-route to washer/dryer when machineType is already known
  - Reason: Router LLM can hallucinate or miss session state — this corrector is the safety net
  │
  ▼
[STEP 4a] — if route = washer or dryer:
  Specialist LLM (Washer or Dryer)
    - Receives: session state + technical problem description
    - Outputs: SpecialistDecision (flowId, shouldEscalate, technicalSummary)
    - Does NOT speak to customer
    │
    ▼
  [STEP 4b] — if Specialist returns a flowId:
    Flow Engine (deterministic, no LLM)
      - Reads JSON flow nodes and transitions
      - Advances the active step
      - For CHOICE nodes with free-text input:
          classifyChoiceViaLLM (micro-LLM, max 20 tokens)
          → maps customer reply to a choice key
      - Returns: FlowEngineResult (stepId, prompt, type, isTerminal, action)
  │
  ▼
[STEP 5] Conversation History LLM  ← single call: write + translate + security + welcome
  - The ONLY customer-facing voice
  - Receives: RouterDecision + SpecialistDecision + FlowEngineResult + SessionState
  - Writes the final message DIRECTLY in the customer's language (per `language` in session state)
  - On turn 1 (non-greeting): prepends warm welcome intro inline
  - Runs inline security validation (injection, data exposure, harmful content, link policy)
  - Returns JSON: {"message": "...", "safe": true/false}
  - Must NOT invent technical facts
  - Must NOT change the meaning of flow instructions
  │
  ▼
[STEP 6] Calling Functions (if needed)
  - contactOperator() — notifies human operator
  - resetSession() — clears session state
  - lavatrice_hs60xx(machineNumber) — starts washer flow
  - asciugatrice_ed340(machineNumber) — starts dryer flow
  │
  ▼
Response to Customer
```

---

## 10b. Language & Translation Pipeline

### Supported languages

Configured in `demo/prompts/language.txt`:

```
it | es | en | pt | ca | fr
```

**To add a new language**: add the code to `language.txt`. Nothing else needs to change.

### How it works

```text
Customer Message
  → Language Detection LLM        (detects: it / es / en / pt / ca / fr)
  → resolveLanguage()             (gates against settings.enabledLanguages → fallback to defaultLanguage)
  → [session state: language = ca]
  → Router → Specialist → Flow Engine
  → History LLM                   (writes in ca, adds welcome on turn 1, checks security inline)
  → {"message": "...", "safe": true}
  → Customer
```

**LLM calls per turn: 3 min (lang heuristic + router + history) — 4 max (+ specialist or faq)**

### Responsibilities

| Layer | Responsibility |
|---|---|
| Language Detection LLM | Detects customer language (or heuristic, 0 calls) |
| `resolveLanguage()` | Gates detected language against `settings.json` |
| Conversation History LLM | Writes in customer's language + welcome on turn 1 + security inline |
| `localization.ts` | Spanish-only base strings for `[EXACT]` questions — no switch/case |

### The [EXACT] contract

When a missing-fact question is injected as `[EXACT] ¿Has pagado?`:
- History LLM translates it to the customer's language (e.g., Catalan: "Has pagat?")
- Outputs only the translated text — nothing before, nothing after
- Security is checked inline on the same output

### Why translation.txt and security.txt are no longer loaded

Both responsibilities are now inside `history.txt`.
The files are kept for reference but not loaded at runtime.
This eliminates 2 sequential LLM calls per turn.

---

## 11. Mock Layer (Demo / Test Only)

The demo (`demo.ts`) includes a mock layer that replaces LLM calls during offline testing.

**Mock functions are NOT production code.**

| Mock function | Replaces in production |
|---|---|
| `routerMock()` | Router LLM call |
| `specialistMock()` | Specialist LLM call |
| `renderHistoryMock()` | Conversation History LLM call |
| `chooseFaqSourceMock()` | Router FAQ intent + Conversation History LLM |
| `translateMock()` | Conversation History LLM (translation) |
| `detectLanguageMock()` | Language Detection LLM call |
| `normalizeGeneratedMessage()` | Should not exist in production — belongs in Conversation History prompt |
| `getLocalized*()` functions | Should not exist in production — belong in Conversation History prompt |
| `injectSpanish*()` functions | Should not exist in production — belong in Conversation History prompt |

The mock layer exists to make usecases runnable without an API key.
In production all of these responsibilities move into the LLM prompt layers.

---

## 12. Scenario Examples

### Scenario A: Greeting

```text
Customer: "Hola"
Router: route = greeting
Conversation History: writes greeting
```

### Scenario B: Missing location

```text
Customer: "La lavadora no funciona"
Router: detects washer issue, extracts `machineType=washer?` if possible, marks `location` as missing, sets `customerFacingGoal=ask_missing_location`
Conversation History: asks for location
```

### Scenario C: Generic FAQ

```text
Customer: "¿Cuánto cuesta un lavado?"
Router: route = faq, sets `customerFacingGoal=answer_general_faq`
Conversation History: answers using {{faqs}}
```

### Scenario D: Washer routing

```text
Customer: "Lavadora 42, no arranca"
Router: extracts machineType=washer, machineNumber=42, marks missing `location` or `displayState` if absent
Router: delegates to Washer Specialist
Washer Specialist: chooses flow
Conversation History: writes the next message
```

### Scenario E: Active flow step

```text
Customer: "1"
Flow Engine: advances current node
Conversation History: rewrites the exact current step naturally
```

### Scenario F: Operator escalation

```text
Customer: "Quiero hablar con una persona"
Router: calls contactOperator(), sets `customerFacingGoal=communicate_operator_handoff`
Conversation History: communicates handoff to operator
```

---

## 10. Router To Conversation History Contract

The handoff between Router and Conversation History must be explicit.

Recommended shape:

```json
{
  "route": "faq",
  "nextOwner": "conversation_history",
  "extractedFacts": {
    "location": "Goya",
    "machineType": "washer",
    "machineNumber": "42",
    "displayState": "PUSH PROG"
  },
  "missingFacts": ["paymentCompleted"],
  "customerFacingGoal": "ask_missing_payment_status",
  "escalationReason": null
}
```

This contract is necessary because the playbook requires the system to ask only the minimum next question and avoid duplicate or unsafe diagnosis.

---

## 11. Coverage Notes Against Customer Material

To be production-safe, the architecture must preserve these playbook requirements:
- ask only one question at a time
- collect only necessary data
- do not diagnose without enough context
- do not invent prices, codes, or compensation
- escalate ambiguous or incoherent cases
- keep human calm tone in all customer-facing responses

The current architecture supports those requirements only if Router, Specialists, and Conversation History exchange structured context instead of vague prose.

---

## 12. Error Risks If We Mix Roles

These are the main failure modes we must avoid:

### Risk 1: Router also answers
If Router answers and Conversation History also humanizes, we create two voices.
Result:
- duplicated logic
- duplicated FAQ ownership
- duplicated tone ownership
- inconsistent customer messages

### Risk 2: Nobody owns gather wording
If Router extracts facts but no layer owns the actual gather question, the system becomes silent or inconsistent.
In this architecture the gather wording belongs to `Conversation History`.

### Risk 3: FAQ ownership split across Router and Conversation History
If both can answer FAQs, the same FAQ may be answered differently depending on the path.
In this architecture:
- Router classifies FAQ intent
- Conversation History writes the FAQ answer

### Risk 4: Specialists become customer-facing chatbots
If specialists start writing polished final answers, tone and consistency break.
In this architecture specialists provide technical decisions, not the final voice.

### Risk 5: Flow Engine is treated as humanization layer
If Flow Engine is confused with Conversation History, deterministic instructions get mixed with prose generation.
Flow Engine executes steps.
Conversation History writes the final message.

---

## 13. Prompt Alignment Rules

If you change this architecture, you must immediately realign these files:
- `docs/cliente-0/docs/prompt1-router.md`
- `docs/cliente-0/docs/subllm-laundry.md`
- `docs/cliente-0/docs/subllm-asciugatrice.md`
- `docs/cliente-0/docs/prompt3-history.md`

The expected prompt ownership is now:
- `prompt1-router.md` -> routing only
- `subllm-laundry.md` -> washer technical reasoning only
- `subllm-asciugatrice.md` -> dryer technical reasoning only
- `prompt3-history.md` -> single customer-facing voice

---

## 14. File Links

### Main prompts

| Role | File | Path |
|---|---|---|
| Router | [prompt1-router.md](./prompt1-router.md) | `docs/cliente-0/docs/prompt1-router.md` |
| Washer Specialist | [subllm-laundry.md](./subllm-laundry.md) | `docs/cliente-0/docs/subllm-laundry.md` |
| Dryer Specialist | [subllm-asciugatrice.md](./subllm-asciugatrice.md) | `docs/cliente-0/docs/subllm-asciugatrice.md` |
| Conversation History | [prompt3-history.md](./prompt3-history.md) | `docs/cliente-0/docs/prompt3-history.md` |
| Escalation | [prompt4_contact.md](./prompt4_contact.md) | `docs/cliente-0/docs/prompt4_contact.md` |
| Reset | [prompt5_reset.md](./prompt5_reset.md) | `docs/cliente-0/docs/prompt5_reset.md` |

### Flow JSON

| Role | File | Path |
|---|---|---|
| Washer flow | [lavatrice_hs60xx.json](./json/lavatrice_hs60xx.json) | `docs/cliente-0/docs/json/lavatrice_hs60xx.json` |
| Dryer flow | [asciugatrice_ed340.json](./json/asciugatrice_ed340.json) | `docs/cliente-0/docs/json/asciugatrice_ed340.json` |

### Supporting docs

| Role | File | Path |
|---|---|---|
| Scenarios | [escenario.md](./escenario.md) | `docs/cliente-0/docs/escenario.md` |
| Variables | [variables.md](./variables.md) | `docs/cliente-0/docs/variables.md` |
| Visual architecture | [LLMarchetecture.png](./LLMarchetecture.png) | `docs/cliente-0/docs/LLMarchetecture.png` |

---

## Final Rule

For the FLOW chatbot, this file and `LLMarchetecture.png` must describe the same architecture.
If they diverge, update this file first and then realign the prompts.