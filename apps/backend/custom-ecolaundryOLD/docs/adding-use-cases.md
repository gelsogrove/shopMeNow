# Adding a new use case

This is the playbook for extending the system. Pick the recipe matching
your scenario; each one points to the layer(s) you need to touch.

> Architectural background: [`docs/architecture.md`](architecture.md).
> Per-tool contracts: [`docs/contracts.md`](contracts.md).
> Iron rules: see top of `architecture.md` — read them first.

---

## Recipe selector

| Your goal | Layer(s) | Recipe |
|---|---|---|
| Bot must reject bad LLM input differently | L4 + L3 | [Recipe 1](#recipe-1--add-a-tool-validator) |
| Bot must enforce a new conversational invariant | L5 | [Recipe 2](#recipe-2--add-an-output-invariant) |
| Bot must ask a new fact before escalation | L2 + L4 | [Recipe 3](#recipe-3--add-a-required-fact) |
| Bot must support a new display code | data | [Recipe 4](#recipe-4--add-a-display-code) |
| Bot must support a new language | data + L3 | [Recipe 5](#recipe-5--add-a-language) |
| Bot must expose a new tool to the LLM | L4 (full) | [Recipe 6](#recipe-6--add-a-new-tool) |
| Bot must accept a new customer-side input shape | L1 | [Recipe 7](#recipe-7--add-an-input-sanitiser) |

---

## Recipe 1 — Add a tool validator

When you discover the LLM does something wrong on a specific input,
**don't write a prompt rule**. Add a validator at the tool boundary.

### Steps

1. **Identify the tool** the LLM called. Look at the warning log:
   ```
   [WARN] mark_resolved blocked: ... evidence: "..."
   ```

2. **Add a detector if needed**. If the bad-call signal is a non-trivial
   pattern (e.g. "yes BUT"), create `utils/<topic>.ts` with a pure
   function returning `{detected: boolean, evidence?: string}`.
   Reference: `utils/mixed-signal.ts`.

3. **Write detector tests**. Create
   `__tests__/unit/<topic>.test.ts` with multilingual happy + edge cases.
   Run: `node --import tsx __tests__/unit/<topic>.test.ts`.

4. **Wire the detector in the tool handler**. Edit the relevant
   `utils/tool-handlers/<cassette>.ts`. Use the pattern:
   ```ts
   const report = detect<Topic>(state.lastUserMessage)
   if (report.detected) {
     logger.warn('<tool> blocked: ...', { evidence: report.evidence })
     return { ok: false, error: '<actionable message for the LLM>' }
   }
   ```

5. **Update `docs/contracts.md`** — add the new validation row to the
   tool's table.

6. **Verify**: `npm run typecheck` + `npm run test:unit`.

---

## Recipe 2 — Add an output invariant

When the LLM produces a reply that violates a system property
(e.g. mixing two contradictory markers), enforce the invariant in L5.

### Steps

1. Create a detector in `utils/<topic>.ts` (pure, multilingual, tested).
   Reference: `utils/contradiction.ts`.

2. Add a step to `agent.ts:polishReplyForTurn`:
   ```ts
   const reply = enforce<Topic>(ar, sanitized)
   ```

3. Use `state-transitions.ts` to undo any side-effects the bad reply may
   have triggered (e.g. `undoResolved(ar)` if the reply incorrectly
   marked the case resolved).

4. Log a `warn` so the issue is visible in production.

5. **Verify**: typecheck + unit tests.

---

## Recipe 3 — Add a required fact

When escalation needs a new piece of customer info (e.g. order code),
extend the contract.

### Steps

1. **Add the field to `models/state.ts`** (e.g. `orderCode: string`) and
   default it in `utils/state.ts:createInitialState`.

2. **Add a tool** to capture it (Recipe 6) OR extend an existing tool
   schema in `utils/agent-tools.ts:TOOLS`.

3. **Add a contract validation** in
   `utils/tool-handlers/closure.ts:escalateToOperator`:
   ```ts
   if (!state.orderCode) {
     return { ok: false, error: 'cannot escalate yet — orderCode missing. Ask the customer first.' }
   }
   ```

4. **Update the escalation summary** in `utils/escalation.ts` to include
   the new field.

5. **Update `docs/contracts.md`** with the new validation.

6. **Verify**: typecheck + unit tests.

---

## Recipe 4 — Add a display code

The bot already handles arbitrary display codes via the declarative flow
table. No code change needed for most cases.

### Steps

1. Edit `json/display-flows.json`:
   ```json
   {
     "id": "casoNN-<token>",
     "displayMatches": ["NEW_CODE", "NEW CODE", …],
     "requires": ["location", "machineType", "machineNumber"],
     "step": { "replyKey": "casoNNGuide", "resolvedReplyKey": "casoNNResolved" },
     "resolvedRegex": "...",
     "persistFailureRegex": "...",
     "escalationReason": "Caso NN — ..."
   }
   ```

2. Add the localization keys (`casoNNGuide`, `casoNNResolved`) to all
   six files in `json/i18n/`.

3. **Verify**: `npm run test:unit` (i18n catalogue test will fail if
   any language is missing the new keys).

> Anti-rule: never add a TypeScript guard for a new "display X → guide
> → escalate" pattern. The flow table owns this lifecycle.

---

## Recipe 5 — Add a language

### Steps

1. **Add the language to `enabledLanguages`** in `json/settings.json`.

2. **Create the catalogue file** `json/i18n/<lang>.json` with every key
   declared by the base catalogue.

3. **Update detectors** that have multilingual keyword lists:
   - `utils/customer-name.ts:CONFIRMATION_WORDS`
   - `utils/mixed-signal.ts:CONTRAST_CONNECTORS` and `COMPLAINT_KEYWORDS`
   - `utils/contradiction.ts:RESOLUTION_MARKERS` and `ESCALATION_MARKERS`
   - `utils/agent-welcome.ts:stripWelcomeParagraphs` (greeting regex)
   - `agent.ts:llmAlreadyGreeted` (greeting regex)

4. **Update tests**: every detector test file has language-specific cases.
   Add yours.

5. **Verify**: typecheck + unit tests + manual demo session in the new
   language.

---

## Recipe 6 — Add a new tool

### Steps

1. **Schema**: append a new entry to `utils/agent-tools.ts:TOOLS`. Be
   specific in the description — the LLM reads it to decide when to
   call.

2. **Handler**: add the function to the right cassette
   (`utils/tool-handlers/<cassette>.ts`) or create a new cassette if
   none fits. Pattern:
   ```ts
   export const myTool: ToolHandler = async (ar, args) => {
     const value = asTrimmedString(args.field)
     if (!value) return rejectInvalidArg('my_tool', 'field', args.field, 'a non-empty string')
     // ... validate semantics via L3 detector(s) ...
     // ... apply state transition via L2 ...
     return { ok: true, data: { ... } }
   }
   ```

3. **Register**: add to `HANDLERS` in `utils/tool-handlers/index.ts`.
   `KNOWN_TOOLS` updates automatically.

4. **State transitions**: if the tool mutates state, prefer named
   transitions in `utils/state-transitions.ts` over inline mutations.

5. **Tests**: write `__tests__/unit/<tool>.test.ts` for the handler's
   contract (happy + each rejection path). At minimum, test the
   detector if you added one.

6. **Documentation**: add the tool's contract to `docs/contracts.md`.

7. **Verify**: typecheck + `npm run test:unit`.

---

## Recipe 7 — Add an input sanitiser

For new boundary inputs (e.g. an attachment URL field, a customer ID).

### Steps

1. Add a new helper to `utils/input-sanitize.ts` with explicit
   character allowlist and length cap.

2. Add tests in `__tests__/unit/input-sanitize.test.ts`.

3. Wire the sanitiser at the entry point (`agent.ts:agentTurn` for
   user message, `index.ts:runChatbotTurn` for caller-supplied
   metadata).

4. **Verify**: typecheck + unit tests.

---

## Anti-recipes (don't do this)

- ❌ **"I'll add a rule to `prompts/agent.txt` so the LLM stops doing X"**
  → see iron rule #1. Add a validator instead.
- ❌ **"I'll mutate `state.operatorRequested = true` directly here"**
  → see iron rule #4. Use `state-transitions.ts:escalate(ar, reason)`.
- ❌ **"I'll add a regex in agent-extract.ts for intent classification"**
  → see iron rule #6. Intent is the LLM's job; regex is for boundary
  signals only.
- ❌ **"I'll skip the test, the change is small"**
  → see iron rule #5. No detector ships without tests.
- ❌ **"I'll hardcode the welcome greeting in code"**
  → see iron rule #7. It belongs in `json/settings.json:welcomeMessage`.

---

## Where to find things in a hurry

| You need to… | Look here |
|---|---|
| Understand the layered architecture | `docs/architecture.md` |
| Understand a tool's validators | `docs/contracts.md` |
| Understand the orchestrator pipeline | `docs/orchestrator.md` |
| See a tenant config field | `docs/settings.md` + `json/settings.json` |
| See a use case spec | `docs/usecases.md` |
| See the agent rules (LLM-side) | `docs/reglas.md` |
| Find a state transition | `utils/state-transitions.ts` |
| Find a detector | `utils/<name>.ts` (siblings: `mixed-signal`, `flow-compatibility`, `customer-name`, `contradiction`) |
| Find a tool handler | `utils/tool-handlers/<cassette>.ts` |
| Find a guard | `utils/guards/<topic>.ts` |
| Find an i18n key | `json/i18n/<lang>.json` |
