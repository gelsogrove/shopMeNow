# custom-ecolaundry — Orchestration rules (read every turn)

This file is auto-loaded when working under `apps/backend/custom-ecolaundry/`.
Read it BEFORE every change. The rules below are non-negotiable.

> Long-form docs:
> - [`docs/architecture.md`](docs/architecture.md) — full layered design
> - [`docs/contracts.md`](docs/contracts.md) — per-tool validators
> - [`docs/adding-use-cases.md`](docs/adding-use-cases.md) — recipes
> - [`docs/orchestrator.md`](docs/orchestrator.md) — turn pipeline
> - [`json/cases.json`](json/cases.json) — bridge: doc "Caso N" ↔ code semanticId
> - [`scripts/check-architecture.sh`](scripts/check-architecture.sh) — CI/pre-commit enforcement

---

## 🔒 The 9 iron rules — verify on every change

Before I write any code in this module, I must confirm each rule applies:

1. **No patches in `prompts/agent.txt`**. If the LLM behaves wrong, fix it
   in code: a guard, a tool validator, or a post-processor invariant.
   ❌ Adding "DO NOT DO X" to the prompt is forbidden.

2. **Tool refuses, LLM corrects**. Tools validate args + semantics and
   return actionable errors. The LLM reads the error and retries.
   ❌ Trusting the LLM to "remember a rule" is forbidden.

3. **One file = one responsibility**. Files >150 lines mixing concerns
   must be split. Use the cassette structure (`tool-handlers/`,
   `guards/`, detectors, transitions).

4. **State transitions are named & atomic**. All mutations of
   `pendingClosure`, `operatorRequested`, `pendingEscalation`,
   `escalationReason`, `customerNameRequested` go through
   [`utils/state-transitions.ts`](utils/state-transitions.ts):
   - `markResolved(ar)` / `undoResolved(ar)`
   - `escalate(ar, reason)`
   - `requireCustomerName(ar)` / `captureCustomerName(ar, name)`
   - `closeAsEscalated(ar)`
   - `startNewFlow(ar, flowId)`
   - `resetPostEscalationFlags(ar)`
   - `resetForNewIncident(ar)`
   ❌ Inline mutations of those fields outside that module are forbidden.
   Enforced by `scripts/check-architecture.sh` (Rule #4 grep).

5. **Each detector ships with tests**. Pure helpers in `utils/<name>.ts`
   (e.g. `mixed-signal.ts`, `flow-compatibility.ts`) MUST have a sibling
   `__tests__/unit/<name>.test.ts` covering happy + edge cases.
   100% coverage on the detector itself.

6. **No hardcoded phrase detection for INTENT**. Phrase routing
   (`if user says X then route to Y`) belongs in the LLM. Phrase
   detection in code is allowed ONLY for boundary signals (greeting,
   mixed-signal, contrast connectors).

7. **Settings are law**. `json/settings.json` is the source of truth
   for tenant config (`enabledLanguages`, `defaultLanguage`,
   `maxToolHops`, …). `runtime.ts:validateSettings` fails fast on
   misconfiguration. No code path may produce a reply in a non-allowed
   language.

8. **Multi-language by design**. Every detector covers all 6 supported
   languages (es, it, en, ca, pt, fr). Adding a new language means
   updating each detector's keyword list AND the i18n catalogue, with
   tests.

9. **Semantic naming, no ordinal references**. File names, pendingFlow
   markers, reason strings, i18n keys, display flow ids, escalation
   reasons MUST describe behaviour, not document order. Forbidden tokens
   in code: `caso\d+`, `case\d+` (the `case_sel`/`case_push`/`case_door`
   flow-engine keys are exempt — they describe machine-display behaviour,
   not doc ordering).
   The numeric "Caso N" labels in [`docs/usecases.md`](docs/usecases.md)
   are documentation-only. The bridge between the two lives in
   [`json/cases.json`](json/cases.json):
   ```
   docs/usecases.md:  ## Caso 4 — He pagado y no se ha activado, sin cambio
   json/cases.json:   { docNumber: 4, semanticId: "no-change", ... }
   utils/guards/:     payment-no-change.ts → guardNoChangeAsk
   ```
   If a case is renumbered in the doc, update `cases.json` only — the
   code is unaffected. Enforced by `scripts/check-architecture.sh` (Rule #9).

---

## 🧭 The 5 layers — know which one you're in

```
L1 INPUT SANITISERS   utils/input-sanitize.ts
L2 STATE              utils/state.ts + utils/state-transitions.ts
L3 DETECTORS          utils/<name>.ts (mixed-signal, customer-name, flow-compatibility, contradiction, …)
L4 TOOL CONTRACTS     utils/agent-tools.ts (schemas) + utils/tool-handlers/*.ts (handlers)
L5 OUTPUT POLICIES    agent.ts:polishReplyForTurn (sanitize, invariants, welcome)
```

When asked to "fix" something, I MUST identify the layer first.
Cross-layer code is the smell that produced the bugs the refactor closed.

---

## ✅ Pre-commit checklist (mental, every change)

- [ ] Did I touch `prompts/agent.txt`? If yes, did I add a behavioural
      "DO NOT DO X" rule? **Stop**: it goes in code (rule #1). Approved
      boundary signals can opt in by adding `// approved-by-andrea: <reason>`
      on the line above.
- [ ] Did I mutate `pendingClosure`/`operatorRequested`/`pendingEscalation`/
      `customerNameRequested`/`escalationReason` inline? **Stop**: use a
      transition from `state-transitions.ts` (rule #4).
- [ ] Did I add a phrase regex? Is it for INTENT or for a boundary
      signal? Intent goes to the LLM (rule #6).
- [ ] Did I add a detector? Did I write its tests? (rule #5)
- [ ] Did I touch a tool? Did I update [`docs/contracts.md`](docs/contracts.md)?
- [ ] Are the affected files <150 lines? If not, split (rule #3). If
      genuinely a single concern that has to stay big, add to
      `ALLOWED_LARGE_FILES` in `scripts/check-architecture.sh` with a
      documented reason.
- [ ] Did I write `casoN` / `caseN` anywhere in code or JSON? **Stop**:
      use a semantic id from `json/cases.json` (rule #9).
- [ ] Did I add a new case? Did I add a row to `json/cases.json`?
- [ ] Does `npm run typecheck` pass?
- [ ] Does `npm run test:unit` pass (all suites)?
- [ ] Does `bash scripts/check-architecture.sh` pass?
- [ ] Multi-language: does my change cover es / it / en / ca / pt / fr? (rule #8)

---

## 🛡 Enforcement — what blocks a bad commit

Rules above are not honour code. They are checked by
[`scripts/check-architecture.sh`](scripts/check-architecture.sh) and the
test suite, both wired into the project pre-commit hook.

| Rule | Check | What it catches |
|------|-------|-----------------|
| #1 | grep `(DO NOT|NEVER|MUST NOT)` in `prompts/agent.txt` without `approved-by-andrea` marker | Behavioural patches that should have gone in code |
| #3 | `wc -l` on `utils/*.ts` vs 150 | Cassettes that grew into mega-files |
| #4 | grep `ar\.state\.<flag>\s*=` outside `state-transitions.ts` | Inline state mutations |
| #5 | every `utils/<detector>.ts` has `__tests__/unit/<detector>.test.ts` | Detectors merged without tests |
| #9 | grep `caso\d+\|case\d+` in code/json/prompts (excluding `cases.json`, `docs/`, `case_sel/push/door/...`) | Ordinal references to doc cases |

To run locally: `bash scripts/check-architecture.sh`. Exit code is non-zero
on any violation, and the offending lines are printed.

---

## 🔁 pendingFlow lifecycle — ask vs await phases

Every multi-step `pendingFlow` has TWO phases. The phase is encoded in the
suffix and determines who is in control:

| Suffix | Phase | Who controls | Gather guards may fire? |
|---|---|---|---|
| `-ask-<topic>`   | gathering   | deterministic guards | ✅ yes (still asking facts) |
| `-await-<topic>` | LLM-driven  | LLM tool-call loop | ❌ no (LLM is interpreting reply) |

Examples:
- `caso4-ask-cambio` → bot is asking for missing facts (location/type/number).
  Gather guards (`forceLocation`, `forceMachineType`, …) may still preempt.
- `caso4-await-cambio` → bot just asked "¿la central te ha devuelto el
  cambio?". LLM must read the customer's reply (yes/no) and act. Gather
  guards MUST NOT fire — they would derail the flow (e.g. asking about
  display while the bot is waiting for cambio yes/no).

This is enforced by [`utils/guards/helpers.ts:isAwaitingPendingFlow`](utils/guards/helpers.ts)
+ [`notInActiveSubFlow`](utils/guards/helpers.ts). Every gather guard
already calls `notInActiveSubFlow(ar)` and gets the right behaviour
automatically.

### Convention when adding a new pendingFlow

If your new flow has a phase where the LLM interprets the reply
semantically, name that pendingFlow `<id>-await-<topic>`. The naming
contract is what makes the gather guards step aside.

Anti-pattern: ❌ adding a phase like `caso9-pending-name` instead of
`caso9-await-name`. The guards would not detect it as LLM-controlled.

---

## 📚 FAQ knowledge (system-only)

The bot reads FAQs from a single source bundled with the module.

### System FAQs (deterministic, key-based)
- **Where**: `json/faqs.json` (file, bundled with the module)
- **Override per pueblo**: `json/locations.json:faqOverrides`
- **Tool**: `apply_faq_override(faqKey)` — the LLM passes a known
  semantic key (e.g. `openingHours`, `washDryTime`) and gets the answer
- **For**: stable, well-defined Q&A that need deterministic mapping
  (FAQ keys are referenced by guards, locations, the LLM prompt)
- **Lifecycle**: changes require a code redeploy (these are part of the
  bot's "system contract")

### Future work — workspace-editable FAQs
A second tier of FAQs editable from the backoffice (without redeploy)
was planned but is **not implemented today**. If/when added it will:
- live in a Postgres `FAQ` table read by the parent chat-engine, never
  by this module (zero-Prisma rule preserved)
- be injected as a `{{faq}}` block in the system prompt
- prefer `apply_faq_override(faqKey)` for any keyed question — the
  `{{faq}}` block is the fallback for free-form questions

Until then, every FAQ change is a code change to `json/faqs.json` +
release.

### NOT to be done (anti-patterns)
- ❌ Importing Prisma into `custom-ecolaundry/` — this module is a pure
  renderer; data fetching is the chat-engine's job
- ❌ Hardcoding FAQ answers in TS source — they go in `json/faqs.json`
  with a stable key
- ❌ Using `apply_faq_override` for free-form questions — that tool is
  for known semantic keys only

---

## 🚦 Where to add a behaviour (decision tree)

```
"The bot should not do X."
   │
   ├── X is about the customer-input shape → L1 (input-sanitize)
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

If unsure, read [`docs/adding-use-cases.md`](docs/adding-use-cases.md)
recipe selector. If still unsure, ask Andrea.

---

## 🗂 Adding a new use case — the bridge file

When the doc grows a `## Caso 33 — XYZ` section, add a row to
[`json/cases.json`](json/cases.json) before writing any code:

```json
{
  "docNumber": 33,
  "title": "XYZ behaviour summary",
  "semanticId": "xyz-behaviour",         // stable, used by code
  "kind": "machine-incident | payment-incident | escalation | faq | gather | display-flow",
  "guardModule": "utils/guards/xyz.ts",  // file path
  "guards": ["guardXyzAsk", "guardXyzAwait"],
  "pendingFlowPrefix": "xyz-",
  "i18nKey": "xyzAsk",                   // or "i18nKeys": [...]
  "tests": ["__tests__/agent/NN-xyz.test.spec.ts"]
}
```

Then use the `semanticId` everywhere in code: file names, pendingFlow
markers (`xyz-ask` / `xyz-await-confirm`), reason strings, i18n keys.
**Never `caso33` in code.** If the doc later renumbers this to "Caso 28",
update only `docNumber` in `cases.json` — code is not affected.

---

## 🛑 Anti-patterns I must reject (and call out)

If a request asks me to do any of these, I MUST push back, propose the
correct layer, and only proceed once the user explicitly confirms:

- "Just add a rule to the prompt that says…" (rule #1)
- "Set `state.operatorRequested = true` here directly" (rule #4)
- "Add a regex to match 'ordine' / 'order' for routing" (rule #6)
- "Skip the test, it's a small change" (rule #5)
- "Hardcode this welcome string in the code" (rule #7)
- "Just patch this one case in code, don't generalise" (rule #2)
- "Call this flow `caso8-await-name` so it matches the doc number" (rule #9)
- "Just put the new case logic in `payment.ts` for now, we'll split later" (rule #3)

These were the symptoms behind the bugs the refactor closed. Falling
back to them would re-open the same bug surface.

---

## 📊 Useful commands

```bash
# Run from this directory:
bash scripts/check-architecture.sh  # the 5 enforcement checks (rules 1/3/4/5/9)
npm run typecheck          # tsc --noEmit -p tsconfig.json
npm run test:unit          # all unit tests (~200 tests, <1s)
npm run demo               # CLI agent loop (needs OPENROUTER_API_KEY)
npm run test:agent         # E2E with LLM (slow, costs $)
```

---

## 🤝 What I always do, on every turn

1. Re-read this file's iron rules.
2. Identify the affected layer(s) before changing anything.
3. Run typecheck + test:unit at the end. Never claim "done" without both green.
4. Update `docs/contracts.md` when touching a tool.
5. When in doubt, ask Andrea — never invent rules.
