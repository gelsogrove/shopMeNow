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

## 🔒 The 10 iron rules — verify on every change

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

   **Tracked exemption — FAQ topic guards.** The current code uses
   regex-based detection for FAQ topics (`HORARIOS_TOPIC`, `PRECIO_TOPIC`,
   `TARJETA_TOPIC`, `RECARGA_TOPIC`, `FACTURA_TOPIC`) in
   `utils/guards/hours-and-pricing.ts`, `loyalty-card-buy.ts`,
   `loyalty-card-recharge.ts`, `invoice-flow.ts`. These are intent
   classifiers, not boundary signals — strictly a rule #6 violation.
   They are kept as a fast-path optimisation: a regex hit avoids one
   LLM round-trip for the most common ES FAQ topics. The patterns now
   cover all 6 supported languages so they don't false-fail on IT/EN/
   CA/PT/FR input. Plan: when ES is stable in production, reroute these
   to the LLM with a slim system-prompt section listing FAQ keys, and
   delete the topic regexes. Tracked TODO, not an open bug.

7. **Settings are law**. `json/settings.json` is the source of truth
   for tenant config (`enabledLanguages`, `defaultLanguage`,
   `maxToolHops`, …). `runtime.ts:validateSettings` fails fast on
   misconfiguration. No code path may produce a reply in a non-allowed
   language.

8. **Multi-language by design**. Every detector covers all 6 supported
   languages (es, it, en, ca, pt, fr). Adding a new language means
   updating each detector's keyword list AND the i18n catalogue, with
   tests.

   **Current scope (Andrea, 2026-05-08): SPANISH FIRST.**
   The active tenant runs ES only (`settings.json:enabledLanguages = ["es"]`).
   The other 5 catalogues exist and are kept consistent at the lexical
   level (i18n keys mirror ES), but **non-ES production traffic is not a
   target right now**. Specifically:
   - The escalation summary builder ([`utils/escalation.ts`](utils/escalation.ts))
     keeps ~30 hardcoded ES phrases for the operator handover. This is a
     deliberate exemption to rule #8 until ES is stable in production.
   - When extending to other languages, port `escalation.ts` to the i18n
     catalogue and add per-language tests; this is parked as a tracked
     TODO, not an open bug.

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

10. **Guard preconditions must not cancel each other out — every required
    fact has a catch-all asker**. The cassette's gather/flow guards skip
    when an unrelated state field is set (e.g. `guardForce*` skip on
    `displayState` so display flows can take over; display flows skip on
    missing `requires`). When the customer volunteers facts out of canonical
    order, this combination can produce a pipeline hole where NO guard
    fires and the LLM is left to improvise — the exact failure mode behind
    the AL001-without-location bug (2026-05-09).

    **The rule:** for every fact the bot must collect, there is a
    catch-all guard that fires whenever that fact is empty AND no legit
    escape hatch applies. Today's instance:
    [`utils/guards/location-resolution.ts:guardForceLocation`](utils/guards/location-resolution.ts).
    It runs BEFORE every gather, display-flow, and force-* guard, and
    asks for the location regardless of which other facts the customer
    has volunteered. The escape hatches are explicit and small:
    `customerNameRequested`, `operatorRequested`, `pendingFlow ===
    "invoice-ask-location"` (its own copy), and the `INCIDENTS_NO_LOCATION_REQUIRED`
    set (cameras / refund / compensation).

    **Anti-pattern to reject in code review:**

    ```ts
    // ❌ a gather guard that gates on multiple unrelated state fields
    if (!ar.state.location || !ar.state.machineType || !ar.state.displayState) {
      return null
    }
    // The customer who fills two of three traps the third.
    ```

    **The mental check:** for every guard you add, ask: *if the customer
    volunteers the fact this guard cares about WITHOUT the other facts
    this guard is gated on, does any other guard pick up the slack?* If
    the answer is "no", you've created a pipeline hole. Add the missing
    catch-all OR weaken the precondition.

    **Tested by:** `__tests__/unit/location-resolution.test.ts` pins
    PATTERNS A/B/C/D for `guardForceLocation` (display-first, type-first,
    number-first, all-three-first). Mirror this template when adding a
    new mandatory fact.

    **Corollary — every gather step has a 3-strikes retry+escalate ladder.**
    A catch-all asker is necessary but not sufficient: if the customer
    can't (or won't) provide the fact, asking the same question forever
    is itself a pipeline hole. Each gather guard must implement:

    ```
    counter == 0  → canonical ask          (i18n key: e.g. machineNumberWasher)
    counter == 1  → guidance reask         (i18n key: e.g. machineNumberRetry)
    counter >= 2  → escalate(operator) + requireCustomerName, reset counter
    ```

    The counter lives on `state.<fact>AskAttempts` and is reset by
    `resetMachineFacts` (or the equivalent) when the fact is finally
    captured. Today's instances:
    - `state.displayAskAttempts` → [`guardForceDisplay`](utils/guards/force-gather.ts)
    - `state.machineNumberAskAttempts` → [`guardForceMachineNumber`](utils/guards/force-gather.ts)
    - `state.cardDigitsAskAttempts` → [`guardDoubleChargeAskCardDigits`](utils/guards/payment-double-charge.ts)
    - `state.awaitNameAskAttempts` (shared) → [`guardDiscountCodeAwaitName`](utils/guards/discount-code-flow.ts) + [`guardDoubleChargeAwaitName`](utils/guards/payment-double-charge.ts) — name capture in any closure flow.

    **Pipeline-hole pattern (rule #10 corollary)**: when the LLM is
    expected to call a tool to advance a flow but skips it, the customer
    falls into the gap and the bot improvises. Architectural defense: a
    deterministic catch-all guard. Today's instances:
    - `guardAdvanceMachineFlow` (washer/dryer flow engine T2+) — uses
      sync `tryAdvanceFlowSync` from [`utils/flow-engine.ts`](utils/flow-engine.ts)
      to advance YES/NO/numeric/exact transitions without LLM. See
      *Architectural fixes log* F5 for the regression that closed it.
    - `guardDisplayFlowFollowUp` (declarative display-flows JSON) — the
      mirror image for AL001 / ALM-DOOR / C001.

    The boundary signal *"I don't know / not yet"* across all 6 languages
    is detected by [`detectIDontKnowReply`](utils/intent.ts) — but the
    escalation ladder fires regardless of intent, because plain silence
    or repeated typos look the same to the orchestrator.

    **Anti-pattern:** a gather guard that only asks the canonical
    question and returns. After two unanswered turns the bot loops and
    the LLM is left to improvise — the exact failure behind the
    "auh no lo he selecioda" bug (2026-05-09).

    **Tested by:** `__tests__/unit/force-display-retry.test.ts` and
    `__tests__/unit/force-machine-number-retry.test.ts` pin the 0 → 1 → 2
    → escalate progression for their respective guards. Mirror this
    template when adding a new mandatory fact.

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

### Pre-extract state snapshots (L2 turn-local)

Some guards need to know whether a state field **changed during this turn**
vs was already set before — e.g. did the customer volunteer a new display
in this message, or is the existing one persisting? This requires a
snapshot of the field BEFORE `autoExtractFacts` runs.

Pattern: in `agent.ts:agentTurn` BEFORE calling `autoExtractFacts`, set
`ar.state.<field>AtTurnStart = ar.state.<field>` (or the equivalent
empty value). Guards downstream compare snapshot vs current to detect
the in-turn change. The snapshot is a turn-local L2 field, reset at
the top of every turn — declare it in `models/state.ts` with a JSDoc
explaining who reads it.

Current instances:
- `displayStateAtTurnStart` → consumed by Phase B pivot in
  [`utils/guards/display.ts:guardPostInstructionFailure`](utils/guards/display.ts).
  When the customer combines a failure signal ("no") with a new display
  token in the same message, the guard pivots instead of re-asking.
  Pinned by [`__tests__/unit/display-pivot-phase-b.test.ts`](__tests__/unit/display-pivot-phase-b.test.ts).

When adding a new snapshot field, add it to `resetMachineFacts` in
`utils/state.ts` so mid-turn flow resets clear it consistently.

---

## 🧬 Auto-extract inference rules — `autoExtractFacts` (L3)

[`utils/agent-extract.ts:autoExtractFacts`](utils/agent-extract.ts) runs **before
every guard pipeline turn**. It mutates `state` from the raw user message
without producing a reply. Adding a new fact-extraction rule here MUST
follow these conventions:

| Fact captured | Source | Notes |
|---|---|---|
| `state.location` | [`extractExplicitLocation`](utils/intent.ts), [`resolveKnownLocation`](utils/message-parsing.ts) | Free-text → canonical pueblo. |
| `state.locationStreet` | Mataró street disambiguation | "Goya"/"Alemanya" sub-locations. |
| `state.machineType` | [`normalizeMachineType`](utils/intent.ts) | "lavadora"/"lavatrice"/"washer" → `'washer'`. |
| `state.machineNumber` | regex on the message | Pure digit short tokens. |
| `state.displayState` | [`extractDisplayState`](utils/intent.ts) | **Canonical** token (e.g. `"PUSH"`). Used by the flow engine for routing. |
| `state.displayLabel` | [`extractDisplayLabel`](utils/intent.ts) | **Customer-facing** label (e.g. `"PUSH PROG"`). Used by the operator handover summary. |
| `state.paymentCompleted` | [`parseExplicitPaymentSignal`](utils/message-parsing.ts) | Yes/no parsed from explicit payment-context replies. |
| `state.pendingFlow = 'double-charge-ask-used'` | [`detectDoubleChargeIntent`](utils/intent.ts) | Multi-language Caso 6 trigger. |
| `state.pendingFlow = 'discount-code-ask'` | [`detectDiscountCodeIntent`](utils/intent.ts) | Multi-language Caso 8 trigger. |
| `state.pendingFlow = 'no-change-ask'` | [`detectPaidNotActivatedIntent`](utils/intent.ts) | Caso 4 trigger — ES-only, typo-tolerant via Levenshtein on the verb token (F16). |
| `state.pendingFlow = 'photo-await-decision'` | inline regex (legacy, audit pending) | Caso 17 (display unreadable) — to be extracted. |

### `displayState` / `displayLabel` — the canonical / label pair

Any code path that captures a display token MUST set both fields:

```ts
const newDisplay = extractDisplayState(trimmed)        // canonical
if (newDisplay) {
  state.displayState = newDisplay
  state.displayLabel = extractDisplayLabel(trimmed, newDisplay)
}
```

- **`displayState`** is the canonical key (`"PUSH"`, `"SEL"`, `"DOOR"`,
  `"AL001"`, …) consumed by `display-flows.json` / `washer_hs60xx.json` /
  `dryer_ed340.json` and by routing guards. Lower-case prose is normalised
  away.
- **`displayLabel`** is the literal wording the customer used, preserved
  verbatim (e.g. `"PUSH PROG"` while `displayState = "PUSH"`). The
  operator handover summary in [`utils/escalation.ts`](utils/escalation.ts)
  prefers `displayLabel` so the operator reads exactly what the customer
  reported. Fallback: `displayLabel || displayState`.

REGRESSION (2026-05-09): the operator was reading `"La pantalla muestra
PUSH"` while the customer had typed `"PUSH PROG"` because the canonical
extractor collapsed the trailing word. The label field closed that gap.

### Convention for adding a new fact-extraction rule

1. Detector lives in `utils/intent.ts` (or `utils/message-parsing.ts` for
   parsing concerns), exported as a pure function with tests in
   `__tests__/unit/<detector>.test.ts`.
2. The wire-up in `autoExtractFacts` is a 2–4 line block: import the
   detector, call it, set the relevant `state.*` field. No business
   logic in `autoExtractFacts` itself.
3. Multi-language coverage is mandatory (rule #8). Detector covers all
   six tenant languages with test cases for each.
4. If the rule sets a `pendingFlow` value, register it in `cases.json`
   with a stable `semanticId` and update the relevant guard module.

---

## 📋 Detector index — `utils/intent.ts`

These are the deterministic detectors / extractors used as the L3 fast
path. Keep this list in sync when adding or removing a detector.

| Function | Purpose | Multi-lang | Notes |
|---|---|---|---|
| `extractDisplayState(message)` | Canonical display token (`"PUSH"`, `"SEL"`, …) | n/a (codes are language-neutral) | Includes fuzzy fallback for typos. |
| `extractDisplayLabel(message, canonical)` | Literal customer wording (`"PUSH PROG"`, `"ERR 52"`) | n/a | Greedy `[A-Z0-9]` tail extension — first char of each run accepts BOTH letters and digits so codes like `ERR 52` / `AL 001` keep the trailing numeric token (regression F7, see *Architectural fixes log*). |
| `normalizeMachineType(value)` | `lavadora|secadora` → `'washer'\|'dryer'` | ✓ 6 langs | Handles fuzzy match (Levenshtein). |
| `extractExplicitLocation(message)` | `"estoy en Goya"` → `"Goya"` | ✓ 6 langs | Falls back to `resolveKnownLocation`. |
| `parsePaymentAnswer(message)` | yes/no parsing for "¿has pagado?" | ✓ 6 langs | |
| `detectIDontKnowReply(message)` | `"no lo sé"`/`"non lo so"`/… | ✓ 6 langs | Boundary signal — used by gather-step retry path. |
| `detectDoubleChargeIntent(message)` | Caso 6 trigger | ✓ 6 langs | Tracked rule #6 exemption (fast-path). |
| `detectDiscountCodeIntent(message)` | Caso 8 trigger | ✓ 6 langs | Tracked rule #6 exemption. Permissive on verb-prefix typos. |
| `detectPaidNotActivatedIntent(message)` | Caso 4 trigger | ES-only | Typo-tolerant via Levenshtein on "activado/activada" (F16, repaired "acrivado" bug). |
| `isPaidButNotActivatedCase(state, message)` | Caso 4 / 7 disambiguator | ES-only (legacy) | To be extended when more langs go to production. |
| `hasGreetingIntent(message)` | Pure greeting detection | ✓ 6 langs | Boundary signal. |
| `isShortContextReply(message)` | Numeric/yes/no/short reply classification | n/a | Pattern match on syntactic shape. |
| `detectLanguageHeuristic(message)` | First-turn language guess | ✓ 6 langs | Used by `resolveLanguageForTurn`. |

### Lessons learned — typo-tolerant detectors

REGRESSION pattern (Bug A 2026-05-09 doble-cobro / Bug D discount code):
inline regex required exact verb prefix (`hab[eé]is`, `tengo`) and
silently failed on typos (`habieis`, `teng`). The fix:

- Drop strict verb-prefix requirements when the rest of the phrase is
  unambiguous (e.g. `cobrad+dos veces`, `c[oó]digo+no sé cómo`).
- Use `\b<verb>[oa]?\b` patterns that tolerate truncated verb endings.
- Cover all 6 languages with at least one test per language plus one
  typo regression test.

When extending or replacing a regex in `agent-extract.ts`, MUST extract
to a named function in `intent.ts` with tests — never modify the regex
in place.

### 🚫 Anti-pattern — speculative typo-tolerant detectors

**Don't extract detectors preventively.** Every multi-language detector
in `intent.ts` MUST repair a REAL reported bug. Pattern-guessing 6-
language coverage without a corpus of actual customer messages produces
hardcoded regexes that silently fail on edge cases AND add maintenance
weight.

REGRESSION (Andrea, 2026-05-09 audit): I extracted `detectPaidNotUsedIntent`,
`detectNoChangeIntent`, `detectNumericOnlyCodeIntent` "preventively"
because they had inline regexes with strict prefixes. Tests caught the
problem immediately:

```
✗ detectNoChange: "Pagué pero no arranca" → expected true, got false
   reason: regex required "pagado/pagada" (participio) but missed the
           preterito "pagué" — pattern-guessed without a real corpus.
```

The right call was **rollback** to the inline regex — those Casos had
no real bug requiring multi-lang typo tolerance.

### Decision rule when adding a new detector

Before extracting an inline regex into `utils/intent.ts`, answer all 3:

1. **Real bug evidence?** Did Andrea or a real chat surface this gap, OR
   is it a "what-if"? If "what-if" → leave the inline regex.
2. **Customer corpus?** Do we have at least one real customer message
   per language we're claiming to support? If not → ES-only or skip.
3. **Test the negative case immediately.** Before merging the new
   detector, write a test for a phrasing variant the regex DOESN'T
   match (preterito vs participio, synonyms, abandons). If you can't
   convince yourself the test would pass, the regex is incomplete.

If any answer is "no" / "not yet" → keep the inline regex, mark a TODO
in `cases.json` linked to a future bug, and stop. **Speculative coverage
without real evidence is a pezza disguised as architecture.**

Detectors that **passed** these gates and are kept (each repaired a real
bug shown by Andrea):

- `detectDoubleChargeIntent` — Bug A 2026-05-09 ("me habieis cobrado")
- `detectDiscountCodeIntent` — Bug D 2026-05-09 ("teng un codigo")
- `detectInvoiceIntent` — Bug #7 2026-05-09 ("factra")
- `detectPaidNotActivatedIntent` — Bug F16 2026-05-10 ("acrivado")
- `detectIDontKnowReply` — Bug 2026-05-09 ("auh no lo he selecioda")
- `detectTopicSwitchDuringEscalation` — Bug #13.6 2026-05-09 ("mi da SEL ora")

Detectors that **failed** the gates and were rolled back:

- ~~`detectPaidNotUsedIntent`~~ — preventive, no real bug
- ~~`detectNoChangeIntent`~~ — preventive, regex failed on "Pagué"
- ~~`detectNumericOnlyCodeIntent`~~ — preventive, no real bug

## 🚦 Branch-router architecture (target — feature-flagged)

Andrea (2026-05-08) decision. The legacy guard pipeline keeps working;
the new path is OPT-IN via `settings.useBranchRouter`.

```
T1  customer message
        ↓
    LLM router (utils/router.ts) — single call, ~500ms, ~$0.0005
        ↓
    { branch, language, details }       state.activeBranch ← branch
        ↓
    branch dispatcher (utils/branches/index.ts)
        ↓
    utils/branches/<branch>/handler.ts  +  per-language file <lang>.json

T2+ state.activeBranch is sticky → handler runs deterministically, NO router

Topic switch  → handler returns { handoff: 'topic-switch' } → re-route on T+1
Resolved      → handler returns { handoff: 'resolved' } → activeBranch = null
Session expire (sessionIdleTtlMs) → state reset → next message restarts T1
```

Branches (current state):

| Branch | Status | Handler |
|---|---|---|
| `greeting` | ✅ full POC | `utils/branches/greeting/handler.ts` (6 per-lang JSON) |
| `faq` | ✅ full POC | `utils/branches/faq/handler.ts` (uses `json/faqs.json` + `locations.json:faqOverrides`, 6 per-lang JSON) |
| `trouble-machine` | ✅ thin | `utils/branches/trouble-machine/handler.ts` — seeds `state.location` + `state.displayState` from router hints, delegates remaining gather + flow to the legacy guard pipeline |
| `invoice` | ✅ thin | `utils/branches/invoice/handler.ts` — sets `pendingFlow="invoice-ask-location"`, delegates 8-step gather to `guardCaso9Factura` |
| `loyalty` | ✅ thin | `utils/branches/loyalty/handler.ts` — delegates buy/recharge classification to legacy `guardLoyaltyCardBuy` / `guardLoyaltyCardRecharge` |
| `escalation` | ✅ thin | `utils/branches/escalation/handler.ts` — seeds `state.nonTroubleshootingIncident` from router `incidentType`, delegates to `guardEscalateNonTroubleshooting` |

"Thin" = the handler owns the routing (T1 LLM classification works for
all 6 languages and seeds sticky state from the router hints) but
returns `handoff: 'delegate-to-legacy'`. The legacy guard pipeline still
produces the actual reply. `state.activeBranch` stays sticky so
subsequent turns don't re-run the router.

Mix regex + LLM — rule of thumb:

```
L1 REGEX boundary    → instant   (pure greeting, mataró street)
L2 LLM router (T1)   → 500ms     (one call per session)
L3 Branch handler    → < 100ms   (state machine, per-lang JSON)
L4 LLM in branch     → only for  semantic yes/no in 6 langs
```

The router system prompt lives in [`utils/router-prompt.ts`](utils/router-prompt.ts);
edit it without touching the orchestration logic in `utils/router.ts`.

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
- [ ] **Trigger coverage rule (F29)**: did I touch a detector that maps to a
      `## Caso N` in `docs/usecases.md`? For EVERY trigger phrase listed in
      that Caso's "Trigger (frases típicas del cliente)" block, is there a
      unit test asserting `→ true`? **Never** write a unit test that asserts
      a usecases-documented trigger as `→ false` ("ambiguous, let display
      flow handle it"). If a trigger is genuinely ambiguous between two
      Casi, resolve it with a discriminator (e.g. preflight `extractDisplayState`
      check), not by excluding it. A missing positive test is the guarantee
      that a real customer will surface the bug, exactly like F16/F29.
- [ ] Did I touch a tool? Did I update [`docs/contracts.md`](docs/contracts.md)?
- [ ] Are the affected files <150 lines? If not, split (rule #3). If
      genuinely a single concern that has to stay big, add to
      `ALLOWED_LARGE_FILES` in `scripts/check-architecture.sh` with a
      documented reason.
- [ ] Did I write `casoN` / `caseN` anywhere in code or JSON? **Stop**:
      use a semantic id from `json/cases.json` (rule #9).
- [ ] Did I add a new case? Did I add a row to `json/cases.json`?
- [ ] Did I add a guard with multiple `!ar.state.X` preconditions? Trace
      every combination: if the customer fills any subset of those fields,
      does some other guard still pick up the missing one? If not, add the
      catch-all (rule #10) — see `guardForceLocation` for the template.
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

## 🗃 `ALLOWED_LARGE_FILES` policy — rule #3 in practice

Rule #3 ("one file ≤ 150 lines") has an explicit escape hatch in
[`scripts/check-architecture.sh`](scripts/check-architecture.sh):
`ALLOWED_LARGE_FILES`. A file may exceed 150 lines if AND only if:

1. **It is one cassette = one responsibility.** Splitting it would
   fragment a coherent story (e.g. all the steps of Caso 6 belong
   together; splitting by step would produce 6 tiny files with
   confusing cross-references).
2. **The reason is recorded** in the comment block at the top of the
   `ALLOWED_LARGE_FILES` array.
3. **Adding the file requires Andrea's approval** (touched in the
   commit's PR description). New entries must justify why splitting
   is worse than keeping the file large.

Current entries (audit each periodically):

| File | Lines | Reason |
|---|---|---|
| `utils/guards/index.ts` | ~150 | The orchestration pipeline — splitting destroys order visibility. |
| `utils/guards/force-gather.ts` | ~190 | Three force guards share helpers + retry counters. |
| `utils/guards/payment-double-charge.ts` | ~290 | One cassette = Caso 6 (askUsed → branch → askType → askNumber → narrative → digits → receipt). Pending refactor: extract shared retry-ladder helper to drop ~80 lines. |
| `utils/escalation.ts` | ~220 | Operator handover summary builder — one switch over many incident types. |
| `utils/agent-extract.ts` | ~400 | The L3 fact-extraction pipeline — one function with 15+ specialised inference rules. Pending refactor: extract per-incident detectors to `utils/intent.ts`. |
| `utils/state-transitions.ts` | ~155 | Named atomic state transitions (markResolved, escalate, markRefundFormPending, captureCustomerName, …). Single responsibility — splitting would fragment the auditable surface that rule #4 protects. |

Anti-pattern: adding a file to this list without splitting after a
genuine attempt. The default answer to "this file got too big" is
*split it*; the exception requires written justification.

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

## 🪜 Gather orderings — per-case quick reference

Each Caso has a documented gather order in
[`docs/usecases.md`](docs/usecases.md). Below is the quick lookup for
the orderings that diverge from "location → tipo → numero → display"
because of UX trade-offs. **Source of truth is `usecases.md`** — this
table is a navigation aid only.

### Caso 6 — Doble cobro (Andrea, 2026-05-09 — reorder)

```
T1: trigger ("me han cobrado dos veces")
T2: location
T3: ¿has podido lavar/secar?  ← branch point
    ├── No  → escalate immediately, only ask for name (Scenario 6.4)
    └── Sí  → continue:
        T4: tipo (lavadora/secadora)
        T5: numero
        T6: relato + datáfono hint
        T7: 4 dígitos tarjeta (with retry+escalate ladder)
        T8: captura del pago + nombre → refund-form closure
```

UX rationale: a customer who got charged twice without being able to
wash is doubly frustrated. Asking machine details before knowing if
they actually used the service felt like burocracia. The "no" path
escalates fast; tipo/numero are recovered by the operator on the phone.

### Caso 1 — PUSH PROG (no payment ask, payment is implicit)

```
T1: trigger ("la lavadora no funciona")
T2: location
T3: numero (NOT tipo — autoExtractFacts already captured "lavadora")
T4: pantalla
T5: PUSH PROG → flow engine emits canonical 4-program list
T6: customer confirms or reports failure (LLM-driven resolution)
```

UX rationale: PUSH PROG only appears AFTER payment, so asking "¿has
pagado?" is redundant. See `usecases.md` Caso 1 Criterios.

### Generic gather (Casi 2, 3, 5, 7, 14, 15, 16, 30 — display-driven)

```
T1: trigger
T2: location
T3: tipo (if not volunteered)
T4: numero
T5: pantalla
T6+: display-specific flow from `display-flows.json` /
     `washer_hs60xx.json` / `dryer_ed340.json`
```

### Reglas generales (cross-case)

Every gather step inherits these invariants:

1. **3-strikes retry+escalate ladder**. Counter on the relevant
   `state.<fact>AskAttempts` field. attempt 0 = canonical i18n key,
   attempt 1 = guidance reask key, attempt ≥ 2 = escalate(operator) +
   `requireCustomerName` + counter reset.
2. **Customer can change topic at any moment**. Topic-switch detection
   (LLM-driven) interrupts the gather and resets state.
3. **Language is sticky per session**, locked from the first user
   message via `resolveLanguageForTurn`.

When you add a new Caso with a custom gather order, update both
`usecases.md` and this section so the divergences stay easy to find.

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
- "This guard skips when X is set, that's fine, the LLM will handle the rest"
  (rule #10) — never let the LLM fill the gap left by a guard that bowed out.
  Every required fact has a deterministic catch-all asker.
- "Let me extract this inline regex into a multi-lang detector preventively,
  before a bug shows up." → STOP. Pattern-guessing without a real customer
  corpus is a pezza disguised as architecture. See `📋 Detector index →
  🚫 Anti-pattern — speculative typo-tolerant detectors` for the decision
  rule (3 gates). Wait for the bug, then fix.

These were the symptoms behind the bugs the refactor closed. Falling
back to them would re-open the same bug surface.

---

## 🧪 Agent test pattern — consolidated, not granular

REGRESSION pattern (Andrea, 2026-05-09): the original agent test files had
the shape "1 test = 1 turn checkpoint" — for each Caso, ~8-10 isolated
test cases, each one re-sending the SAME trigger phrase + prefix turns
to reach the specific checkpoint. Result: 80% redundancy on LLM calls
(same conversation prefix replayed 10 times) AND a `_runs/<file>.md`
dialog log unreadable because every test starts with the same opening.

**The right shape — one test per END-TO-END PATH, with step-by-step
assertions inline.** Per Caso, write 2-3 tests at most:

1. **Scenario X.1 — Happy Path completo**: trigger → gather → display
   instruction → resolution. Asserts each turn's reply inside the same
   conversation (T2 must mention "número", T3 must mention "pantalla",
   …). One LLM-driven session, all checkpoints.
2. **Scenario X.2 — Escalation completo**: trigger → gather → instruction
   → customer signals failure → re-ask (Phase B) → escalate → name →
   final reply with "operador"+"desactivado" + summary handover. One
   session, all assertions inline.
3. **(Optional) Edge case specifico**: e.g. "validación de los 4
   dígitos" for Caso 6, "retry tras No al cambio" for Caso 4 — when an
   independent path needs its own conversation.

### Decision rule when adding agent tests

Before adding a new test case to an agent test spec, answer:

1. **Does this path differ from Scenario X.1 / X.2?** If yes → new test.
   If no → add an inline assertion to the existing scenario instead.
2. **Does the new test re-send the SAME trigger + prefix turns?** If yes →
   that's redundancy. Move the assertion inline into an existing scenario.
3. **Will this test run an LLM call?** If yes — keep it minimal. Each agent
   test costs $.

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
{ name: 'T3: dopo numero, bot chiede pantalla',
  run: async (ctx) => {
    await ctx.send('La lavadora no funciona')  // SAME trigger
    await ctx.send('Goya')                      // SAME T2
    const r = await ctx.send('La 5')
    expectMentionsAll(r, ['pantalla'])
  }
},
// ... and 8 more like this, each replaying the prefix
```

### Right shape (kept)

```ts
// ✅ One test per end-to-end path with step-by-step assertions
{ name: 'Scenario 1.1: happy path completo → ... → resolved',
  run: async (ctx) => {
    await ctx.send('La lavadora no funciona')
    const t2 = await ctx.send('Goya')
    if (!/n[uú]mero/.test(t2)) throw new Error(`T2: ...`)
    const t3 = await ctx.send('La 5')
    if (!/pantalla/.test(t3)) throw new Error(`T3: ...`)
    // ... rest of the conversation, all asserted inline
  }
}
```

### 4-source verification workflow — per-Caso method

Pattern formalizzato durante l'audit Casi 1-32 (Andrea, 2026-05-09 / 2026-05-10).
Ogni volta che si tocca o valida un Caso, le 4 fonti devono dire la stessa
cosa. Quando divergono, si decide *consapevolmente* (con AskUserQuestion)
quale è la verità e si allineano le altre — niente pezze, niente "lo
sistemiamo dopo".

**Le 4 fonti**:

1. **PDF Playbook** (`docs/pdf/Ecolaundry Chatbot Playbook (6).pdf`) —
   contratto col cliente. Verità ultima quando esiste una sezione
   dedicata. Quando la regola PDF è generale (es. §6 frau o incoerència,
   §10 criteris d'escalat), il Caso può essere più specifico ma deve
   rispettare lo spirito della regola.
2. **`docs/usecases.md`** — spec interna del bot. Per ogni Caso N:
   trigger, primera respuesta, criterios de aceptación, esempio
   conversazione. Quando devia dal PDF, deve avere un blocco
   `**Desviación documentada respecto al Playbook PDF**` esplicito.
3. **`json/cases.json`** + i guard / i18n / flow-engine JSON
   referenziati. Bridge fra `docNumber` (doc) e `semanticId` (codice).
   Path test referenziati DEVONO esistere (no stale ref).
4. **Bot reale** — output deterministico verificato dall'agent test
   sotto `__tests__/agent/N-*.test.spec.ts`.

**Workflow per ogni Caso**:

```
PER CASO N:
  1. Leggo PDF Playbook §X.Y (sezione corrispondente)
  2. Leggo docs/usecases.md ## Caso N
  3. Verifico json/cases.json mapping (docNumber, tests path)
  4. Lancio __tests__/agent/N-*.test.spec.ts → bot reale
  5. Confronto le 4 fonti. Identifico divergenze:
       - Test path stale in cases.json? → fix
       - Test pattern "1 test = 1 turno"? → consolida (vedi sezione sopra)
       - PDF dice X, usecases dice Y, bot fa Z?
         → AskUserQuestion: tieni flow attuale + documenta deviazione,
           OPPURE allinea al PDF (modifica codice + doc + test).
       - Bot diverge da usecases? → BUG architetturale (fix in codice
         deterministico, NO patch in prompt).
  6. Implemento fix architetturale (NO pezze)
  7. Run typecheck + check-architecture + unit suite
  8. Run regression sweep Casi 1..N (rule below)
```

**Casi tipici di divergenza incontrati durante audit Casi 1-32**:

- **PDF deviazione documentata** (Casi 5, 6, 8, 9): nostro flow è più
  ricco/diverso del PDF per ragioni UX o di integrazione. Documento in
  usecases.md, mantengo il flow.
- **Allineamento al PDF** (Casi 7, 10, 11): PDF e usecases dicevano
  cose diverse, abbiamo allineato modificando il codice.
- **Stale ref** (Casi 10, 13, 14, 15, 16, 17, 18, 19, 20): paths di
  test in `json/cases.json` puntavano a file inesistenti (legacy dal
  rename collettivo). Fix in cases.json.
- **Bug architetturale latente** (Casi 14, 30): fonti d'accordo ma
  flow JSON / detector aveva un gap che il LLM mascherava
  (resolvedRegex mancante, displayLabel troncava cifre). Fix nel
  codice deterministico.
- **Wording inconsistente JSON ↔ doc** (Caso 3 SEL): JSON aveva
  loopback diverso da usecases. Allineato il JSON al doc.

### Mandatory regression check on shared-component changes

When you modify a component that affects **multiple Casi** (e.g.
`escalation.ts`, `state-transitions.ts`, `tool-handlers/closure.ts`,
i18n files, the LLM prompt), MUST re-run the agent tests for **every
Caso already validated** in the session, not only the one you're
working on. The runner supports comma-separated filters:

```bash
node --import tsx __tests__/agent/run.ts "01-push,02-door,03-sel,04-pago" --save
```

This is the "regression sweep" Andrea asked for explicitly on
2026-05-09 ("ma queste cose che hai cambiato non incidono i vecchi
test?"). It catches cases where a change to escalation.ts breaks Caso 2
DOOR even though you were fixing Caso 4.

---

## 🛠 Pending refactors — tracked, don't lose

These are debts that we've consciously decided NOT to chase right now
because the cost/benefit is wrong today (premature abstraction). When
the third instance of the pattern appears, the trade-off flips and the
refactor MUST be done — that's why each entry below has a clear trigger.

| ID | Refactor | Trigger | Where to start |
|----|----------|---------|----------------|
| B1 | **Rename + dispatch `appendEscalationSummary`.** It currently does two things (refund-form closure replace OR escalation handover append). Rename to `polishClosureForTurn(ar, reply)` with explicit dispatch on `pendingClosure` (`'refund-form'` / `'escalated'` / `null`). **Andrea (2026-05-10): pure cleanup, NO behaviour change. Lascia aperto ma non urgente.** | The third closure type appears (today: 2 = escalated, refund-form). | [`agent.ts:appendEscalationSummary`](agent.ts) |
| B2 | **Factory for deterministic name-capture guards.** The pattern *"if pendingFlow=X-await-name → validateName → ladder → captureCustomerName → close as Y → emit i18n Z"* is duplicated in `guardDiscountCodeAwaitName` (Caso 8) and `guardDoubleChargeAwaitName` (Caso 6.1). Extract a factory `createNameCaptureGuard({ pendingFlowKey, closureFn, finalI18nKey, escalateReason })`. | The third instance is added (i.e. a future Caso that ends with name capture and a non-trivial closure). | [`utils/guards/discount-code-flow.ts:guardDiscountCodeAwaitName`](utils/guards/discount-code-flow.ts) + [`utils/guards/payment-double-charge.ts:guardDoubleChargeAwaitName`](utils/guards/payment-double-charge.ts) |
| C1 | **PII redaction before LLM forward.** Customer name + last 4 digits of the card + photo references reach the external LLM today. Privacy/GDPR forbids this. Mask captured PII fields in conversation history before forwarding. | Now (privacy obligation), but blocks scaling — at minimum before the next non-test traffic. | TODO grep `PII must not reach the LLM` in [`agent.ts`](agent.ts) |
| B3 | **Rename `al001Resolved` i18n key → `displayResolved`.** The key is now reused by `alm-door-blocked` and any future display-flow recovery (content is generic "incidencia resuelta", name is legacy from the original AL001-only use). Touch points: `json/display-flows.json` (2 entries), `json/cases.json`, `json/i18n/*.json` (6 langs). | When a third display-flow with `resolvedReplyKey` is added (the legacy name will become misleading enough to merit the cross-cutting rename). | grep `al001Resolved` |
| D1 | ✅ **Implemented as opt-in PoC (Andrea, 2026-05-10).** LLM natural-rephrase layer on guard outcomes lives in [`utils/agent-rephrase.ts`](utils/agent-rephrase.ts). Integration point: [`agent.ts:applyGuardOutcome`](agent.ts) (async, gated by `settings.naturalRephrase`). Skips T1 welcome and operator-only structured output. The rephrase prompt enforces keyword preservation (display codes, location names, "operador"/"desactivado", "revisión manual", emoji, markdown) so content invariants survive. **Decision (Andrea, 2026-05-10)**: tests run with `naturalRephrase: false` so the assertion suite proves the deterministic content is correct (no hallucination, sacred rules enforced). Production may flip to `true` for natural tone-matching with conversation history. Temperature configurable via `settings.rephraseTemperature` (default 0.4). | — (open work item: sweep with flag ON to see how many assertions break and decide whether the rephrase prompt is tight enough to keep them all green). | DONE for the PoC. Remaining: validate that flag-ON sweep stays green; if it does, the test suite is robust to rephrasing and we can ship. |
| D2 | ✅ **Implemented (Andrea, 2026-05-10).** LLM system prompts moved from TS consts to `prompts/*.txt`: `prompts/router.txt`, `prompts/rephrase.txt`, `prompts/operator-briefing.txt`. Loaded at boot by `utils/runtime.ts:loadRuntime` (safe-load: missing file → empty string → caller falls back to TS const). Callers (`utils/router.ts`, `utils/agent-rephrase.ts`, `utils/operator-briefing.ts`) prefer the file content when non-empty. Operator can edit any of these prompts and restart to apply. **Remaining (low priority)**: extract `utils/flow-engine.ts:classifyChoiceViaLLM` inline string to `prompts/flow-classify.txt` (small token, low ROI). | DONE for the 3 main prompts. | DONE. |

**Anti-pattern to avoid:** silently start the refactor while doing
unrelated work. Each entry above has a trigger; respect the trigger
and don't extract preventively. When the trigger fires, point the PR
description at the relevant row and close the entry.

---

## 🎚 Test deterministic vs production polished — separation of concerns

Andrea's decision (2026-05-10): **the test suite runs against the
deterministic core, the production deployment can layer LLM polish on
top**. Two opt-in feature flags isolate the two regimes:

```
                 │  Test suite       │  Production
─────────────────┼───────────────────┼─────────────────────
useBranchRouter  │  false            │  false (today)
naturalRephrase  │  false            │  may be true
```

**Why the test suite stays deterministic** (flag OFF):
- Assertions verify **content correctness**, not wording style:
  guard outcomes contain the right keywords (`operador`, `desactivado`,
  `revisión manual`, exact display codes like `ERR 52`), state mutations
  fire correctly, summary handover is structured, no hallucinated
  prices, sacred rules enforced.
- No LLM polish → no flakiness from the rephrase model. Sweep CI is
  fast and reliable.
- If a guard's i18n string changes, the test catches it without LLM
  noise on top.

**Why production can flip to polished** (flag ON):
- The same canned reply, rephrased through `utils/agent-rephrase.ts`,
  feels more natural: variation across turns, customer name woven in,
  emoji, conversational tone.
- The rephrase system prompt enforces keyword preservation, so the
  content invariants survive. If the test suite is robust enough to
  pass with flag ON, the production polish is safe to enable.

**Test suite as the contract**: when adding a new feature that depends
on canned reply wording (e.g. a new escalation summary keyword check),
write the assertion against the *canned* form and test with flag OFF.
The rephrase prompt MUST preserve that wording — if it doesn't, the
test will catch the drift the moment we run flag ON.

**Per-LLM temperatures** (configurable via `settings.json`):
- `routerTemperature` (default 0): T1 branch classifier. Discrete
  classification — keep low to prevent routing hallucinations.
- `rephraseTemperature` (default 0.4): polish layer. Generative but
  with strict content constraints — moderate value gives variation
  without drift.
- `agentTemperature` (default 0.3): main turn LLM (legacy free
  generation + tool calls).

---

## 📜 Architectural fixes log — bugs closed during Casi 1-32 audit

Storico dei bug architetturali risolti durante l'audit Casi 1-32 (Andrea,
2026-05-09 / 2026-05-10). Mantenuto come **regression catalogue**: ogni
voce documenta un pattern che NON deve riapparire. Se un cambio futuro
sembra reintrodurre uno di questi sintomi, è un sentinel di regressione.

| # | Sintomo | Root cause | Fix architetturale |
|---|---------|------------|---------------------|
| F1 | Caso 6.1 ramo Sí cierra como escalation invece di refund-form | `payment-double-charge.ts` chiamava `escalate()` per il refund → `pendingEscalation` set → operatorHandoffFinal + Human Support summary appesi al cliente | Nuovo path semanticamente separato: `markRefundFormPending` + `closeAsRefundForm` + `pendingClosure='refund-form'` + i18n `refundFormFinal` (6 lang). Post-processor [`agent.ts:appendEscalationSummary`](agent.ts) skippa handover su closure refund-form. |
| F2 | Caso 6/8 nome capture loops infinito su input invalido | `guardDoubleChargeAwaitName` / `guardDiscountCodeAwaitName` re-asks senza ladder | Counter shared `state.awaitNameAskAttempts` (reset atomico in `captureCustomerName`) + retry+escalate ladder via `nextRetryLadderStep` (rule #10 corollary). |
| F3 | Caso 6.2 cliente "muy enfadado + quiero operador" cade in forceLocation | `guardAngryCustomerEmpathic` regex troppo stretta (richiedeva esclamazioni) | Nuovo `guardAngryCustomerExplicit` boundary signal (rage marker + explicit operator request → escalate immediato) + 10 unit test multilingua. |
| F4 | Caso 7 chiedeva cambio prima della pantalla, divergente dal PDF §5.4 | `guardPaidNotUsedAskChange` forzava il cambio prima della pantalla | **Rimosso** il guard. Allineato al PDF: location → tipo → numero → pantalla (display flow handler gestisce il resto). −1 file, −2 pendingFlow values. |
| F5 | Casi PUSH/SEL/DOOR: bot improvvisava su risposta utente dopo istruzione (LLM skip del tool `advance_machine_flow`) | Pipeline-hole rule #10: `guardAutoStartMachineFlow` gestiva il T1 ma nessun catch-all per i T2+ del washer/dryer flow engine | Nuovo `guardAdvanceMachineFlow` + helper sync `tryAdvanceFlowSync` in [`utils/flow-engine.ts`](utils/flow-engine.ts) (deterministic-only, no LLM classify). Pipeline order: `guardPostInstructionFailure` PRIMA di `guardAdvanceMachineFlow` (Phase C precede flow advance, perché il check_result node ha special-case `display token → NO transition` che intercetterebbe il display di Phase C re-ask). |
| F6 | Caso 14 ALM DOOR happy path flakey: "Sí ha desaparecido" non sempre triggerava il resolved reply | `display-flows.json:alm-door-blocked` mancava `resolvedRegex` + `step.resolvedReplyKey` | Aggiunti entrambi (riuso `al001Resolved` come closure i18n key — pattern poi tracked come refactor B3 da rinominare a `displayResolved`). |
| F7 | Caso 30 summary perdeva il "52" del codice "ERR 52" → operatore vedeva solo "ERR" | `extractDisplayLabel` greedy extension `^(?:\s+[A-Z][A-Z0-9]{1,})+`: il primo char di ogni run richiedeva una **lettera**, le cifre venivano scartate | Pattern allargato a `^(?:\s+[A-Z0-9][A-Z0-9]{1,})+` (primo char accetta lettere E cifre). Preserva "ERR 52" / "AL 001" / "PUSH 03" interi. usecases riga 1996 esige *"sin reinterpretarlo ni normalizarlo"*. |
| F8 | Caso 3 SEL: prompt JSON privo del loopback "Después dime…" mentre usecases lo ha | `washer_hs60xx.json:case_sel.prompt` divergente da usecases.md riga 325/354 e da `case_push` (che ha il loopback su nuova riga) | Allineato JSON a usecases + a `case_push`: aggiunto `\n\nDespués dime si la lavadora ha arrancado.`. Allineato anche wording usecases a "Después dime…" (era "Una vez lo hayas hecho, dime…"). 4-fonti coerenti. |
| F9 | Caso 18 cliente digita "AS" come letras davanti al codice → bot saltava al gather location | `guardNumericCodeNoLetters`: branchi yes/no espliciti non coprivano input letter-only ("AS", "ABC") → null → LLM improvvisa | Aggiunto `implicitLettersTyped = /^[A-Z]{1,5}$/.test(reply)` come fallback yesLetters (constraint UPPERCASE per evitare false positives su prose). |
| F10 | 18 stale paths in `json/cases.json` che puntavano a test inesistenti (post rename collettivo `XX-name` → `N-name`) | Cleanup non completato dopo rename | Fix per ogni Caso durante l'audit (Casi 10, 13, 14, 15, 16, 17, 18, 19, 20 e altri). |
| F11 | File legacy `02-faq.test.spec.ts` testava il Caso 12 (Horarios) ma il nome confondeva | Naming drift dopo riorganizzazione test | Eliminato. `cases.json` aggiornato. Caso 12 testato solo da `12-horarios-precios`. |
| F12 | `26-context-switch.test.spec.ts` era nella root agent/ ma testava un comportamento cross-Caso, non Caso 26 | Naming convention sbagliata | Spostato in `__tests__/agent/cross/` con nota all'inizio del file. |
| F13 | Dryer flow ACTION nodes (`ready_state`, `door_issue`, `credit_issue`, `payment_pending`) emettevano l'istruzione SENZA il loopback "Después dime si la secadora ha arrancado" — stesso pattern del F8 ma sul dryer JSON. Cliente in CLI demo segnalava "dopo SEL non mi ha chiesto, dime se ti funziona". | `json/dryer_ed340.json` ACTION prompts divergenti dal pattern washer (`case_sel`/`case_push`/`case_door` post-F8). Bug nascosto perché il cliente in test reali non lo notava (LLM rephrase può aggiungere il loopback ma non con flag OFF). | Aggiunto `\n\nDespués dime si la secadora ha arrancado.` ai 4 ACTION prompts che transitano a `check_result`. Allineato al pattern washer. **Pattern preservativo per il futuro**: ogni nodo `type: "ACTION"` con `transitions.default → check_result` MUST contenere il loopback inline nel prompt — è quello che il cliente vede prima di rispondere YES/NO al CONFIRMATION node successivo. |
| F14 | Customer scriveva "Mtaró" (typo di "Mataró") → bot diceva "no reconozco esa ubicación" mostrando la lista canonical (Hortes, Goya, Alemanya, Pineda, L'Escala, Platja d'Aro) SENZA Mataró → cliente confuso ("Mataró non è nella lista?"). | Doppio bug: (1) `agent-extract.ts:219`/`:178` usava solo `resolveKnownLocation` (exact match) senza `resolveKnownLocationFuzzy` fallback, mentre altri call site (`discount-code-flow.ts:142`) lo usavano già. (2) `AMBIGUOUS_PUEBLOES = Set(['Mataró', 'Mataro'])` (entrambe le forme con/senza accento) creava 2 candidati equidistanti per il fuzzy matcher → ambiguità → returns `null` (riga 136 *"strictly better"*). | (1) Aggiunto `|| resolveKnownLocationFuzzy(candidate)` in `agent-extract.ts` (entrambi i call site). (2) Rimosso `'Mataro'` dal Set: `stripAccents` durante il match canonical lo gestisce già. Regression test in `__tests__/agent/cross/mataro-typo.test.spec.ts`. **Pattern preservativo**: in `AMBIGUOUS_PUEBLOES` (e simili Set caricati in `KNOWN_LOCATIONS`) usare SOLO la forma accentata canonical — la versione no-accent è ridondante e rompe il fuzzy matcher. |
| F15 | Customer scriveva "mi ha fatto pagare due volte" (IT colloquial) → trigger Caso 6 NON rilevato → bot cadeva nel flow standard machine (chiede location/tipo/numero/pantalla) → al T7 customer ripeteva "ho detto che mi ha fatto pagare due volte" → bot diceva "no parece que reconozca ese código". | `detectDoubleChargeIntent` copriva solo le forme **formali**: ES `cobrar`, IT `addebitare`, EN `charge`, PT `cobrar`, CA `cobrar`, FR `débiter`. Mancavano le forme **colloquial** che in pratica i clienti usano molto più spesso: IT `pagare/fatto pagare due volte`, ES `pagar dos veces / hizo pagar / doble pago`, EN `paid twice`, PT `paguei duas vezes`, CA `pagat dues vegades`, FR `payé deux fois`. Il commento `// ✓ 6 langs` in CLAUDE.md detector index era **falso ottimista** (la copertura era formal-only). | Aggiunte le forme colloquial in tutti i 6 idiomi a `utils/intent.ts:detectDoubleChargeIntent`. Aggiunti 5 unit test in `__tests__/unit/intent.test.ts` per regression catch (IT "fatto pagare", IT "pagato due volte", ES "hizo pagar", ES "doble pago", EN "paid twice"). **Pattern preservativo**: ogni detector che claim "✓ 6 langs" DEVE coprire sia forma formale (banking term) sia colloquial (everyday speech). Nei test pin **almeno 2 forme per lingua** (formal + colloquial). |
| F16 | Customer scriveva "He pagado y no se ha **acrivado**" (typo per "activado", c↔t swap) → trigger Caso 4 NON rilevato → bot cadeva nel flow generico machine (chiede location → tipo → numero → pantalla) invece di chiedere "¿La central te ha devuelto el cambio?". Andrea: *"questo non me lo aspettavo perché non è andato il test porca paletta!!!"*. Il run file `__tests__/agent/_runs/04-pago-sin-cambio.md` mostrava il flow corretto perché usava la forma canonical "activado", il typo non era mai stato testato. | Inline regex in [`agent-extract.ts:397`](utils/agent-extract.ts) era `/he\s+pagado.+no\s+se\s+(ha\s+)?activad/i` — richiedeva il substring esatto "activad" e silently failure su qualsiasi typo. Stesso pattern di F15 (formal-only), ma qui sulla parola chiave invece che sulla forma colloquial. Audit precedente (2026-05-09) aveva esplicitamente lasciato l'inline regex *"left as-is until a real bug requires typo tolerance. Speculative refactor reverted on 2026-05-09 audit."* — ora il bug è reale. | Estratto `detectPaidNotActivatedIntent` in [`utils/intent.ts`](utils/intent.ts). Payment signal: `\b(he pagado|pagué/pagué|pagado/pagada)\b`. Not-activated signal: regex canonical + Levenshtein distance ≤ 1 sul token che segue "no se (ha)" verso `activado`/`activada` (cattura "acrivado", "actibado", "activao"). Aggiunti 10 unit test in [`__tests__/unit/intent.test.ts`](__tests__/unit/intent.test.ts) (canonical + typo + preterito "Pagué" + preterito "no se activó" + 4 negative). **Cosa cattura**: \b ASCII-only di JS non funziona dopo é/ó → uso lookahead `(?=\s\|[!?.,;]\|$)` come word-end manuale per "pagué" e "activó". Già usato in altri punti, ma facile da dimenticare. **Pattern preservativo**: detector che usano regex su parole con accento finale DEVONO usare lookahead esplicito per il word-end — `\b` ASCII-only fallisce silently. |
| F17 | `parsePaymentAnswer("sí")` → `null` (cliente conferma pagamento con sì accentato → bot non riconosceva il sì → continuava a chiedere se aveva pagato). Stesso root di F16. Inoltre "ya pagué", "he pagado", "aun no" non riconosciuti. | (1) `\b` ASCII-only di JS non matcha dopo `í` (sí, pagué). Le regex `^(yes\|y\|si\|sì\|sí)\b` fallivano sull'ultima alternativa. (2) Vocabolario positivi ES incompleto: mancavano "pagué", "he pagado", "ya pagué", "sí he pagado". (3) Vocabolario negativi ES incompleto: solo "todavía no" (con accento), "aun no" / "aún no" non coperti. | Aggiunto word-end lookahead `(?=\s\|[!?.,;]\|$)` per "sí"/"sì"/"pagué". Aggiunti positivi ES (`pagué`, `he pagado`, `ya pagué`, `ya he pagado`, `sí he pagado`, PT `paguei`/`já paguei`). Aggiunti negativi ES (`aun no`, `aún no`) + PT/CA/FR (`ainda não`, `encara no`, `pas encore payé`). 8 unit test (positive + negative + accent variants + empty). **Pattern preservativo**: ogni regex con `\b` su parola che termina con char accentato (`sí`, `pagué`, `activó`, `está`) DEVE usare il lookahead esplicito. |
| F18 | `hasGreetingIntent("buenos días")` → `false` (cliente saluta con saluto ES standard → detector non lo riconosce → bot risponde con "no entiendo"). Anche "buenas tardes/noches", "salve" (IT), "olá" (PT), "bonjour" (FR), "bom dia" non riconosciuti. | Regex single-line `/\b(ciao\|hello\|hi\|hola\|buongiorno\|buonasera)\b/i`: vocabolario incompleto. Mancavano i saluti ES standard ("buenos días", "buenas tardes", "buenas noches", "buenas") e il saluto PT canonico "olá" (con accento — ASCII `\b` falliva dopo `á`). | Estesa `hasGreetingIntent` in [`utils/intent.ts`](utils/intent.ts) con regex separate per ogni famiglia: ES `buenos días/tardes/noches/nits` (con accento opzionale), bare "buenas", IT `salve`, PT `olá`/`oi`/`bom dia`/`boa tarde/noite`, FR `bonjour`/`salut`. Word-end lookahead per accenti (`olá`, `días`). 9 unit test (positive cross-language + negatives). |
| F19 | `detectDoubleChargeIntent("me cobraron dos veces")` → `false`. Cliente reale usa il preterito plurale `cobraron` ma il detector copriva solo `cobrado` (participio) e `cobró` (singolare). Il commento "✓ 6 langs" sul detector era ottimistico — copriva forme banking-term ma non tutte le coniugazioni ES. | Regex ES `/\bcobr[oó]\s+dos\s+veces\b/i` matchava solo singolare. Plurale 3a persona `cobraron` non in vocab. Stesso pattern di F15 (cattura formale ma non vernacolare/coniugazioni reali). | Aggiunto `/\bcobraron\s+(?:dos\s+veces\|2\s+veces)\b/i` a `detectDoubleChargeIntent`. 2 unit test ES plural preterito (canonical + numeric variant "2 veces"). **Pattern preservativo**: ogni detector ES su verbi DEVE coprire tutte le coniugazioni che un cliente reale usa: 1a/2a/3a singolare + 3a plurale + presente + preterito + participio + infinito. |
| F20 | Caso 17 (display unreadable): cliente scrive "pantalla apagada", "pantalla rota", "no entiendo lo que pone" → trigger NON rilevato → bot drifta su display gather invece di passare al flow `photo-await-decision`. | Inline regex in `agent-extract.ts` per Caso 17 era stretta: `/(no se que pone\|no veo (bien) la pantalla\|no puedo leer la pantalla\|pero no se qué)/i`. Mancavano: "pantalla apagada/rota/borrosa/negra", "está rota la pantalla", "no entiendo lo que pone/aparece", "no se ve nada en la pantalla", "no puedo leer el display" (display vs pantalla). | Estratto `detectDisplayUnreadableIntent` in [`utils/intent.ts`](utils/intent.ts). 8 pattern alternativi che coprono: canonical "no sé qué pone", "no veo la pantalla", stato pantalla ("apagada/rota/negra/borrosa/en blanco/sin luz"), ordine inverso ("la pantalla está rota"), sinonimo "display", "no entiendo lo que pone". 9 unit test. Wire-up in `agent-extract.ts` sostituisce inline regex. |
| F21 | Caso 18 (codice solo numerico): cliente scrive "Mi código es 123456" / "Codigo: 123456" / "Recibí el codigo 123456" → bot non riconosce il codice come solo numerico → drift su flow code Caso 8. | Inline regex in `agent-extract.ts` riga 451 richiedeva strict verb prefix `(?:tengo\|tenho\|ho\|i have)\s+(?:un\s+)?(?:código\|codice\|code)`. Phrasing alternativi ("Mi código es", "Codigo:", "Recibí") non matchavano. | Estratto `detectNumericCodeIntent` in [`utils/intent.ts`](utils/intent.ts). 4 pattern: verb prefix esteso (`tengo/tenho/ho/i have/recibí/me han dado`), "Mi/El código es N", "Codigo: N", "^Codigo N$". Returns `string \| null` (il valore numerico estratto). 8 unit test. Wire-up in `agent-extract.ts` sostituisce inline regex. |
| F22 | `detectDiscountCodeIntent`: cliente scrive "tengo el código" / "tengo este código" / "tengo codigo de descuento" / "tnego un código" / "Me han dado un código" → trigger NON rilevato. usecases.md riga 911-914 elenca 4 trigger phrasing, il detector ne copriva 1. | Regex ES `/\bt[ie]ng[oai]?\s+un\s+c[oó]digo\b/i` richiedeva esattamente "un" come articolo. Articoli alternativi ("el", "este", "mi") e assenza articolo non coperti. Typo `tnego` (consonant-vowel swap) non coperto da `t[ie]ng[oai]?`. Frasi senza verbo "tengo" ma con altro verbo ("Me han dado un código", "Recibí un código") non coperte. | (1) Articolo opzionale: `t[ie]ng[oai]?\s+(?:un\|el\|este\|mi)?\s*c[oó]digo`. (2) Pattern alternativo `me han dado/dieron/recibí + (un\|el)? código`. (3) Typo consonant-vowel swap pattern `t[a-z]{1,2}eg[oai]?` per "tnego". (4) Standalone "código (de) descuento" mention. 4 unit test aggiunti. |
| F23 | Caso 25 cliente molto enfadato: pure IT "sono molto arrabbiato, voglio un operatore" / pure EN "I am very angry, I want a human" / pure PT/CA/FR → `guardAngryCustomerExplicit` NON spara perché `angryMarker` regex era ES-only. Test esistente `IT/EN multi-lang` usavano input MISTI (`"estoy muy enfadado — I want to speak with a human"`) — falsa copertura. | `angryMarker` regex copriva solo ES (`muy enfadado/molesto/cabreado/harto/desastre/...`). Quando il cliente IT/EN/PT/CA/FR scriveva nella sua lingua nativa, lo `angryMarker.test()` falliva → la guard non si attivava → bot cadeva su gather generic. Il test sembrava verde perché chi l'aveva scritto non aveva testato input puri. | Esteso `angryMarker` con pattern per tutte le 6 lingue: IT `sono molto arrabbiato/infuriato/incazzato/stufo`, EN `i am very angry/furious/pissed/mad/fed up`, PT `estou muito irritado/chateado/furioso`, CA `estic molt enfadat/emprenyat`, FR `je suis très en colère/fâché/furieux/énervé`. Esteso `operatorRequest` con verbi richiesta operatore in tutte le 6 lingue. Sostituiti i 2 test "IT/EN multi-lang" con 5 test PURE input (ES/IT/EN/PT/CA/FR). **Pattern preservativo**: i test che claim multi-lang DEVONO usare input PURI nella lingua dichiarata, mai input misti — l'input misto maschera la mancanza di copertura. |
| F24 | Audit di alignment usecases ↔ test: usecases riga 367-369 elenca 3 trigger Caso 4 ("He pagado y no se ha activado", "Pagué pero no arranca", "No me funciona después de pagar"). Il F16 detector originale ne copriva solo 1. Estesi a tutti e 3 → ma il pattern broad `/no\s+(?:arranca\|funciona)\b/` fece falsi positivi su Caso 1 ("He pagado y aparece SEL pero no arranca" — Caso 1, non 4). | F16 detector troppo stretto (solo "activad..."). Estensione iniziale F24 troppo aggressiva (qualsiasi `no funciona/arranca` con payment signal → Caso 4). Linter aggiunse guard difensivo in `branches/index.ts` portando il file sopra il limite di 150 righe. | Ristretta `detectPaidNotActivatedIntent`: (1) `payment + canonical "activad..." (regex/typo via Levenshtein)` → Caso 4. (2) `temporal "después de pagar" + generic failure` → Caso 4. (3) `"Pagué pero no arranca"` (ambiguo) → false → cade su display flow che decide se Caso 1 o Caso 4 via display. Rimosso guard difensivo in `branches/index.ts`. **Pattern preservativo**: quando un trigger usecases è ambiguo tra 2 Casi (Caso 1 vs Caso 4), il detector NON deve risolverlo — deve far cadere su gather + display flow che ha la verità (codice mostrato sulla pantalla). |
| F25 | Caso 10 trigger "Quiero la tarjeta de descuento" → `TARJETA_TOPIC` non matchava (mancava "descuento" nel vocabolario). Caso 11 trigger "Cargar la tarjeta" / "No sé recargarla" → `RECARGA_TOPIC` non matchava (richiedeva "recarg-", "cargar" senza re- e suffisso pronoun "-la" non coperti). | `TARJETA_TOPIC` aveva solo `tarjeta de fidelización/fidelidad/loyalty card`. Mancavano `tarjeta de descuento` e pattern verbo "quiero/necesito tarjeta". `RECARGA_TOPIC` richiedeva strict `recargar` o `recarga` — "cargar" senza prefisso o "recargarla" con suffisso pronoun non coperti. | (1) Esteso `TARJETA_TOPIC` con `tarjeta de descuento` e pattern verbo `(?:quiero\|necesito\|me gustaría)\s+(?:la\|una)?\s*tarjeta`. (2) Esteso `RECARGA_TOPIC` con `(?:re)?cargar(?:la\|lo)?\s+...\s*tarjeta`, `recargarla/lo`, `no sé cómo recargarla/lo`. **Pattern preservativo**: per ogni trigger documentato in usecases.md DEVE esistere un test che lo asserisce → la coverage gap si scopre subito, non sei mesi dopo come F25. |
| F26 | Audit usecases ↔ bot reale: scenari 5.2/5.3 (AL001 escalation), 7.2 (Caso 7 escalation), 6.2 (angry+doble cobro), 6.3 (relato contradittorio in doble cobro) avevano summary all'operatore divergenti rispetto a usecases.md. (a) AL001/Caso 7 escalation: usecases vuole *"⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?"* — bot diceva solo *"Vamos a revisar tu caso manualmente"*. (b) 6.2 (enfadato+doble cobro): bot summary diceva *"ha mostrado mucho malestar"* OMETTENDO il doble cobro originale. (c) 6.3: bot summary OMETTEVA "relato contradictorio". | (a) `display-flow.ts` e `display.ts:guardPostInstructionFailure` usavano i18n `reaffirmEscalate` generic invece di un wording specifico. (b) `escalation.ts` Case 25 (angry) ramificava per generic angry-customer summary senza guardare se `pendingFlow` indicava double-charge context. (c) `escalation.ts` Case 6 doble-cobro branch fired prima di Case 28 contradictory branch → contradictory mai raggiunto. | (a) Nuova i18n key `displayInstructionFailureEscalate` in tutti 6 cataloghi (ES/IT/EN/PT/CA/FR) con il wording usecases. Settata in `display-flows.json` AL001 entry come `escalationReplyKey`. `guardPostInstructionFailure` aggiornato per usarla. (b) Case 25 branch in `escalation.ts` ora controlla se `pendingFlow` contiene `double-charge-` → se sì, summary include "ha reportado un doble cobro con tarjeta y exige hablar con un operador". (c) Case 6 doble-cobro branch ora controlla `escalationReason` per "Contradictory" → se sì, append "El relato del cliente es contradictorio o confuso". |
| F27 | Caso 32.1 marathon: cliente attraversa SEL → PUSH PROG → DOOR → AL001 in una sola sessione. Summary all'operatore citava SOLO l'ultimo display (AL001), perdendo la cronologia. usecases.md riga 2151 esige *"El summary del operador lista TODOS los displays vistos en orden cronológico"*. Test 32.1 marcato RED-SPEC: `expectMentionsAll(finalReply, ['SEL', 'PUSH', 'DOOR'])` commentato in attesa di implementazione. | Mancava un'API per tracciare la cronologia dei display: `state.displayState` veniva sovrascritto a ogni cambio, perdendo i precedenti. `EscalationContext` non aveva il campo. Il summary builder consumava solo l'ultimo display. | Aggiunto `state.displayHistory: string[]` in `models/state.ts` + reset in `resetMachineFacts` + init in `createInitialState`. Helper `recordDisplay` in `agent-extract.ts` che pusha `displayLabel` su ogni cambio (deduplicato). Aggiunto `displayHistory` a `EscalationContext` + `extractEscalationContext`. Summary in `escalation.ts:buildEscalationSummaryBody` ora include `Secuencia de pantallas vista: SEL → PUSH PROG → DOOR → AL001` quando `displayHistory.length > 1`. |
| F28 | Caso 32.3 RED-SPEC: cliente mid-flow (es. dopo location, bot waiting numero) chiede una FAQ ("Espera, antes una pregunta: ¿cuánto cuesta lavar?"). usecases.md vuole il bot risponda alla FAQ + appenda "¿Sigamos con tu problema?" per non perdere il flow. Implementazione mancante. | Architettura mancava di 3 pezzi: (1) detector per riconoscere il pattern "pause marker + FAQ topic" (non doveva sparare su plain `espera un momento`). (2) state field per memorizzare il fatto che siamo in pausa FAQ. (3) invariant L5 che appende il prompt di ritorno. | (1) Nuovo detector `detectFaqPause` in [`utils/intent.ts`](utils/intent.ts) — richiede sia pause marker (`espera/aspetta/wait/antes una pregunta/perdona...`) sia FAQ topic hint (precio/horario/tarjeta/factura). 8 unit test (4 positive + 4 negative). (2) `state.faqPause: boolean` in `models/state.ts` + reset. (3) `autoExtractFacts` setta `faqPause=true` quando detector spara durante flow attivo, lo pulisce al turno successivo. (4) Nuova i18n key `resumeAfterFaq` in tutti 6 cataloghi. (5) Invariant in `agent.ts:polishReplyForTurn` che appende `resumeAfterFaq` al reply quando `state.faqPause && pendingFlow && !pendingClosure`. |
| F29 | Cliente scrive "he pagado pero no se arranca" → bot al T5 chiede *"¿Qué mensaje aparece en la pantalla?"* invece di *"¿La central te ha devuelto el cambio?"*. Andrea dimostra il bug dal vivo: *"tu dici tutto ok ma invece non e' tutto ok!!!"*. usecases.md riga 367-369 elenca esplicitamente 3 trigger per Caso 4 di cui il bot ne riconosce solo 1 (canonical "activado"). Trigger 2 ("Pagué pero no arranca") e trigger 3 ("No me funciona después de pagar") + variante con verbo riflessivo "no se arranca" tutti silently ignorati → fallback a flow display generico. | F24 audit aveva concluso (sbagliato) che "Pagué pero no arranca" era ambiguo Caso 1/Caso 4 e l'aveva escluso dal detector. Peggio: aveva scritto un unit test che asseriva `detectPaidNotActivatedIntent('Pagué pero no arranca') → false`, **cementando il bug nei test**. Pattern doppiamente patologico: (a) il test conferma la frase canonical (cementando il F16-style false coverage), (b) il test ASSERTA un input usecases-documentato come negative (cementando una decisione architetturale sbagliata). | (1) **Display-code preflight check**: `detectPaidNotActivatedIntent` chiama `extractDisplayState(message)` come prima cosa — se il messaggio contiene un display token (PUSH/SEL/DOOR/AL001/...), ritorna `false` e cede al display flow. Questo risolve l'ambiguità senza perdere coverage. (2) **Detector allargato**: dopo il preflight, accetta payment signal + (canonical "activad..." OR generico `no\s+(?:me\|se)?\s+(?:arranca\|funciona\|empieza\|responde\|parte\|va)`). (3) **Sostituito il test sbagliato**: rimosso il test "Pagué pero no arranca → false", aggiunti 4 test che pinnano il fix: trigger 2 → true, real-chat "no se arranca" → true, "aparece SEL pero no arranca" → false (display flow), "aparece PUSH PROG" → false. **Pattern preservativo (regola strutturale)**: per ogni frase trigger documentata in `usecases.md` DEVE esistere almeno un unit test che asserisce `→ true`. Mai scrivere test che asserisce un trigger usecases come negative ("ambiguo, lascio cadere"); se è veramente ambiguo, va risolto con un discriminator (come `extractDisplayState`), non escludendolo. La presenza di un test → true è la prova di copertura; il suo assenza è la garanzia che un cliente reale farà uscire il bug come F16/F29. |
| F30 | Caso 5/14 display-flow Phase C: cliente AL001 attivo, bot Phase B chiede "código exacto", cliente digita "DOOR" (display NUOVO, diverso da AL001) → bot escala invece di pivotare a case_door (Caso 2). Andrea: *"sale DOOR e non risponde... ci sono grandi problemi vedo..."*. | `display-flow.ts:guardDisplayFlowFollowUp` Phase C unconditionally escalava: il commento diceva *"Whatever the customer sent, escalate now"*. La pivot logic esisteva solo in `display.ts:guardPostInstructionFailure` ma non veniva mai eseguita per AL001/ALM-DOOR/C001 perché `guardDisplayFlowFollowUp` (per i flow JSON-driven) intercettava prima. Phase C era cieco al cambio di display. | Aggiunta pivot logic in `display-flow.ts:guardDisplayFlowFollowUp` Phase C: se la reply del cliente contiene un display token che NON matcha gli `displayMatches` di questo flow, clear pendingFlow + activeFlowId + activeStepId + lastPresentedStepId, set displayState al nuovo, return null → next pipeline pass routes the new display al flow corretto. 3 unit test in `display-flow-preemption.test.ts`: (a) AL001+DOOR → pivot, (b) AL001+AL001 → escalate (same code re-confirmed), (c) AL001+"no responde" → escalate (no display token). **Pattern preservativo**: ogni Phase C handler che processa "customer reply after re-ask" DEVE controllare se il reply contiene un nuovo display token e pivotare invece di escalare. Cementare "whatever the customer sent, escalate" è anti-architettura — il customer sta dicendo qualcosa di concreto, vai dove dice. |
| F31 | Bug strutturale ricorrente (F15, F16, F19, F22, F24, F29 — 6 voci F-log su 30 sono varianti dello stesso problema): regex L3 inline in `agent-extract.ts` per i sotto-casi (Caso 4, 17, 18) non scala. Ogni nuova frase cliente reale → silently fail → bot drift. Andrea dopo aver visto il pattern: *"come li risolvi con pezze? o con un'archettura organizzata?"*. Test estesi su Casi 4, 5, 6 (Andrea richiesta) → 9/24 EXT falliscono → prova oggettiva di fragilità L3. | Macro-router LLM (`useBranchRouter=true`) classifica solo branch (greeting/faq/trouble-machine/...). Sotto-caso (paid-not-activated vs paid-not-used vs display-unreadable vs numeric-code vs display-driven) lasciato a regex L3 → ogni typo/variante/forma riflessiva crea un F-bug. | **Esteso il router LLM con `subCase`** (sub-classifier nello stesso LLM call → costo invariato). `RouterDecision.details.subCase` ora restituisce `paid-not-activated` / `paid-not-used` / `display-unreadable` / `numeric-code` / `display-driven` / `none`. Aggiornato `prompts/router.txt` con esempi per ogni sotto-caso (ES + edge cases reali "he pagado pero no se arranca" / "no se enciende" / "se queda parada"). `branches/trouble-machine/handler.ts` legge `routerDetails.subCase` e setta `state.pendingFlow` semanticamente: paid-not-activated → 'no-change-ask', display-unreadable → 'photo-await-decision' + displayUnreadable=true. 6 unit test in `branch-dispatcher.test.ts` pinnano il routing. **Pattern preservativo**: per ogni nuovo sotto-caso documentato in usecases.md, aggiornare il router prompt con esempi + estendere `TroubleSubCase` type. NIENTE PIÙ regex L3 inline per sotto-casi noti — l'LLM li gestisce semanticamente in qualsiasi forma/lingua/typo. La regex resta come fast-path opzionale (autoExtractFacts) ma non è più la primary classification path. **Cost**: 0 LLM call extra (subCase è dentro lo stesso router call). |
| F32 | Cliente Caso 2 (DOOR): bot diceva *"Abre y cierra bien la puerta **hasta oír un clic**. Comprueba que no haya prendas atrapadas..."*. Andrea: *"non c'e nesun click!"*. Il dettaglio del click NON era nell'i18n original (`washer_hs60xx.json:case_door`) né in usecases.md riga 223 — l'aveva inventato il rephrase LLM. | `prompts/rephrase.txt` regola #2 era troppo permissiva: *"NO añadas información nueva (no inventes precios, códigos, ubicaciones, horarios)"*. Mancava il divieto esplicito di aggiungere **dettagli operativi** (suoni, durate, condizioni di successo). Il rephrase LLM con T=0.5 ha aggiunto il "click" come dettaglio "naturale" che però è un'invenzione tecnica. | Esteso `prompts/rephrase.txt` regola #2 con elenco esplicito: NO aggiungere "dettagli operativi non menzionati nell'originale" (es. *"hasta oír un clic"*, *"espera 30 segundos"*, *"presiona dos veces"*, *"en la parte superior"*), NO calificadores cuantitativos non presenti, NO condizioni di successo non presenti. Aggiunta una **REGLA DE ORO**: in caso di dubbio, restituisci l'originale invariato. **Pattern preservativo**: ogni nuovo prompt LLM che fa "polish" di output deterministico DEVE elencare esplicitamente le categorie di informazione che NON deve inventare — non basta "no inventes información". Il LLM è bravo a creare narrativa fluida e tende ad aggiungere dettagli operativi plausibili che però non corrispondono alla realtà fisica della macchina. |
| F33 | Caso 32.1 marathon dal vivo: cliente attraversa PUSH PROG → DOOR → SEL → AL001 in una sola sessione. F27 aveva implementato `displayHistory: string[]` e il summary deterministico (`escalation.ts`) lo enumera correttamente come *"Secuencia de pantallas vista: PUSH PROG → DOOR → SEL → AL001"*. Ma il summary in produzione (`operatorBriefingFromLlm: true`) **non enumera la cronologia** — dice solo *"La pantalla muestra el código AL001"*. L'operatore non sa che il cliente ha avuto 4 display in cadena. | `utils/operator-briefing.ts` passava lo state al LLM come STATE_FACTS, ma `displayHistory` non era nel payload. Il LLM aveva accesso solo a `displayLabel` (l'ultimo display). Inoltre il prompt `prompts/operator-briefing.txt` non istruiva esplicitamente l'LLM ad enumerare cronologie multi-display. | (1) Aggiunto `displaySequence` (string formato "X → Y → Z") al payload STATE_FACTS in `operator-briefing.ts`, calcolato da `state.displayHistory` (vuoto/single → marker `(single)`, altrimenti join con ` → `). (2) Aggiornato `prompts/operator-briefing.txt` con regola #5 esplicita: *"Si STATE_FACTS.displaySequence contiene un valor distinto de '(single)', incluye explícitamente la secuencia completa en el briefing con el formato 'Secuencia de pantallas vista: ...'. Esto es crítico — el operador necesita ver TODOS los códigos que el cliente intentó, no solo el último."*. **Pattern preservativo**: ogni state field che contiene una STRUCTURE (array, set, multi-value) deve essere reso in formato leggibile (string serialised) prima di passare al LLM, e il prompt deve istruire esplicitamente come renderizzarla nell'output. Non basta passare l'array — l'LLM lo interpreta in modo arbitrario o lo ignora. |
| F34 | Caso 6.1 (doble cobro happy path): cliente arriva al final reply *"Vamos a revisar tu situación y te enviaremos el formulario de reembolso"*. Andrea: *"parliamo di formulario? ma a chi lo mandiamo scusa?"*. Cliente non sa: quando arriva, dove arriva (email/WhatsApp), come è. Ha solo una promessa vaga di "te lo mandiamo". | `settings.json:refundFormUrl` esiste (`https://forms.gle/XFGPAd9581AhC9eu7`) ma viene incluso solo nelle FAQ keys `doubleCharge` e `refundRequest`. La i18n key `refundFormFinal` (usata nel close turn di Caso 6.1 da `agent.ts:appendEscalationSummary`) NON include l'URL. `t('refundFormFinal').replace('{name}', name)` sostituiva solo il nome, lasciando il messaggio finale sprovvisto di link concreto. | (1) `agent.ts:434` ora chiama `.replace('{refundFormUrl}', ar.runtime.settings?.refundFormUrl ?? '')` dopo il replace `{name}`. Fallback graceful a empty string se il setting non c'è (no leak di placeholder con braces). (2) Tutti i 6 cataloghi i18n (`refundFormFinal` ES/IT/EN/PT/CA/FR) ora includono il placeholder `{refundFormUrl}` con frase introduttiva esplicita ("Aquí tienes el formulario de reembolso, por favor complétalo cuando puedas:"). (3) `prompts/rephrase.txt` regola #3 estesa: il rephrase LLM ora deve preservare LITERAL emails (`service@alberwaz.net`, `olga@alberwaz.net`) e URLs (`forms.gle/...`, qualsiasi `https://`). Senza questo il rephrase potrebbe parafrasare/accorciare l'URL e rompere il link. **Pattern preservativo**: ogni messaggio finale che promette un'azione concreta al cliente DEVE includere il dato concreto necessario per quell'azione (URL, email, numero, codice). Mai dire "te lo enviaremos" senza dire DOVE/COME/QUANDO arriverà — il cliente resta in attesa indefinita. Verificare i settings per URL/email mancanti nei messaggi di chiusura. |
| F35 | Caso 9 (factura): cliente in produzione vedeva il bot generare una **lista combinata** *"1. Razón social. 2. Dirección. 3. CIF/NIF. 4. Fecha. 5. Email. 6. Tu nombre"* invece di una domanda alla volta. Andrea: *"devi fare una domanda alla volta. Quando abbiamo questo caso non dobbiamo passare dall'history del LLM in questo caso inviamo dati sensibili. Mettiamo da qualche parte che questi dati confidenziali e sensibili non vengono passati a terzi."*. Inoltre mancava il campo "notas/observaciones" e il disclaimer di privacy/GDPR. | (a) Il guard `invoice-flow.ts` faceva 1 step per turno, ma il **rephrase LLM** (`naturalRephrase=true`) aggregava i passi in una lista per "naturalezza", esponendo dati PII alla history → al rephrase LLM third-party API ad ogni turno. (b) Il summary all'operatore passava per `operatorBriefingFromLlm=true` che spedisce email/CIF/dirección al LLM esterno. (c) L'i18n `invoiceFinal` non aveva disclaimer privacy. (d) Mancava il campo `notes` per osservazioni. | (1) Aggiunto `invoiceData.notes: string` a `models/state.ts` + `createInitialState`. (2) Nuovo step `'invoice-ask-notes'` nel guard fra email e nome. Cliente può rispondere "no/ninguna/nessuna/nada" → memorizzato come stringa vuota; qualsiasi altro testo → memorizzato verbatim. (3) Nuova i18n key `invoiceAskNotes` in tutti 6 cataloghi. (4) **Bypass rephrase LLM per `pendingFlow.startsWith('invoice-')`** in `agent.ts:applyGuardOutcome`. Il cliente vede il reply deterministico senza polish LLM — i dati PII (email, CIF, dirección, razón social) NON escono verso third-party API. (5) Bypass `operatorBriefingFromLlm` nello stesso flow: il guard `guardInvoiceFlow` chiama direttamente `buildEscalationSummary` (deterministic) senza passare da `generateOperatorBriefingFromHistory`. (6) Disclaimer privacy aggiunto a `invoiceFinal` in tutti 6 cataloghi: *"🔒 Tus datos (razón social, CIF/NIF, dirección, correo) se usan únicamente para emitir la factura y no se comparten con terceros."*. (7) Summary operatore in `escalation.ts` ora include il campo `notas` quando presente. (8) Aggiornato test `09-factura.test.spec.ts` con asserzioni: step "notas" presente dopo email, disclaimer "no se comparten con terceros" nel final reply. **Pattern preservativo**: ogni flow che raccoglie PII (email, ID fiscale, dirección, dati bancari) DEVE bypassare le pipeline LLM (rephrase + briefing) e usare solo template deterministici. La i18n del close turn DEVE includere un disclaimer sul trattamento dei dati. Mai forwardare PII a third-party LLM API. |
| F36 | Cliente CLI: T1 trigger trouble → T2 location → T3 "SEL" come risposta a "numero" (non riconosciuto, retry counter +1) → T4 "x funciona" (non numero, counter +1 → ESCALATE su 3-strikes ladder + asks name) → T5 user "si funciona" → bot dice *"✅ Perfecto, incidencia resuelta"* (LLM ha chiamato `mark_resolved`) → T6 user "posso avere la fattura" (IT) → bot risponde con la richiesta fattura MA MESCOLATA con: (a) chiusura escalation precedente *"Un operador humano se encargará... El chatbot será desactivado"*, (b) **Human Support message** della vecchia escalation, (c) nome cliente catturato come **"posso"** (prima parola di "posso avere la fattura"). Output completamente corrotto. | `markResolved` in `state-transitions.ts` settava solo `pendingClosure='resolved'` ma NON azzerava `operatorRequested + customerNameRequested + pendingEscalation + escalationReason`. Quando il `mark_resolved` tool fire DURANTE un'escalation pendente (es. il LLM interpreta "si funciona" come resolution mentre il bot stava chiedendo il nome dopo retry-ladder escalation), i flag escalation residuano sullo state. Turno successivo: (a) il nuovo trigger entra ma `appendEscalationSummary` vede `operatorRequested=true` ancora attivo → appende handover summary della VECCHIA escalation; (b) il name extractor in `autoExtractFacts` vede `customerNameRequested=true` ancora attivo → cattura la prima parola della nuova richiesta come nome. | `markResolved(ar)` ora azzera atomicamente: `operatorRequested=false`, `customerNameRequested=false`, `escalationReason=''`, `pendingEscalation=null`. Resta `pendingClosure='resolved'` (semantica della resolution). 1 nuovo unit test in `state-transitions.test.ts` che pinna il fix: setto manualmente i 4 flag → chiamo `markResolved` → verifico che siano tutti azzerati. **Pattern preservativo**: ogni transizione di stato terminale (`markResolved`, `closeAsRefundForm`, `closeAsEscalated`) DEVE pulire TUTTI i flag di stato relativi alla traiettoria precedente. Mai assumere che il prossimo turno parta "naturalmente" con state pulito — il LLM può call qualsiasi tool in qualsiasi sequenza, lo state DEVE essere coerente dopo ogni transizione terminale. |

| F37 | Andrea audit 2026-05-11 contro il PDF Playbook (10 pagine letto via Read tool): trovate **4 invenzioni di dettagli operativi** nei prompt i18n/JSON che NON sono nel PDF. (a) `machineNumberRetry` diceva *"El número está pegado en la propia máquina, normalmente arriba o al lado de la pantalla"* — PDF §5.4 dice solo *"Quin número de màquina és?"*. (b) `case_door` prompt diceva *"Ábrela y ciérrala firmemente, comprobando que no haya ropa atascada"* — PDF §5.4 DOOR dice solo *"Obre i tanca bé la porta, i torna a provar"* (l'aggiunta "ropa atascada" è territory ALM DOOR §5.4, non DOOR semplice). (c) `case_push` prompt elencava la lista 4 programmi *"60º muy caliente / 40º templado / 30º suave / Frío"* — PDF §5.4 PUSH PROG dice solo *"Prem ara el programa que vols i digues-me si la màquina respon."*. (d) `al001GuideRetry` elencava una sequenza di 5 passi educativi (cargar/cerrar/pagar/seleccionar/programa) — PDF §5.5 AL001 dice solo *"T'ajudo a completar-lo. Digues-me en quin local ets i què has fet just abans que aparegués."*. Andrea: *"dove lo hai trovato nel PDF?"* → confermo: invenzioni dell'i18n. | Pattern strutturale (stessa categoria di F32 rephrase LLM inventava "hasta oír un clic", ma qui i dettagli sono **hardcoded direttamente nell'i18n/JSON**, non emergono runtime): chi ha scritto l'i18n ha aggiunto dettagli "utili UX" senza tracciarli come deviazioni dal PDF in `usecases.md`. Risultato: il bot dice cose che il PDF non documenta, e quando un cliente o operatore verifica con la fonte, scopre divergenze. | Andrea ha scelto **option B (strict PDF alignment)**: rimossi i 4 dettagli inventati. (1) `machineNumberRetry` in tutti 6 cataloghi i18n → *"¿Podrías comprobar el número de la máquina y decírmelo?"* (semplice). (2) `case_door` in `washer_hs60xx.json` → *"La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez."* (rimosso "comprobando que no haya ropa atascada"). (3) `case_push` in `washer_hs60xx.json` → *"Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado."* (rimossa lista 4 programmi). (4) `al001GuideRetry` in tutti 6 cataloghi → *"Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera."* (rimossa sequenza 5 passi). Aggiornati 4 test unit (`auto-start-machine-flow`, `caso-1-push-prog-flow-e2e`, `display-flow-preemption`, `force-machine-number-retry`, `payment-double-charge`) per asserire il nuovo wording PDF-aligned. **Pattern preservativo (critico)**: prima di scrivere QUALSIASI prompt i18n o JSON che contiene dettagli operativi (azioni fisiche, condizioni, sequenze numerate), verificare contro il PDF Playbook. Se il dettaglio NON è nel PDF, scegliere: (a) rimuovere il dettaglio (default — strict alignment), o (b) documentare ESPLICITAMENTE come *"Desviación documentada respecto al Playbook PDF"* in `usecases.md` con motivazione UX. NESSUN dettaglio operativo inventato senza traccia documentale. Questo pattern è la stessa lezione di F32 (rephrase LLM) e F34 (URL formulario): la "naturalezza" del bot non deve mai aggiungere fatti tecnici che il cliente/operatore non può verificare con la fonte ufficiale. |
| F38 | Andrea CLI 2026-05-11: cliente risolve incidente lavadora #5 (PUSH PROG/SEL flow), poi al T7 chiede *"quiero la factura"* → bot ri-chiede *"¿Utilizaste lavadora o secadora?"*. Andrea: *"mi chiede ancora se lavadora o secadora doveva capirlo... abbiamo un reset ogni ora per questo reset dei dati ma qui l'ora non era passata"*. + bug "pegado en la máquina" ricomparso (re-inventato dal rephrase LLM nonostante F37 lo abbia rimosso dall'i18n). | (a) `agent-extract.ts` post-resolved branch chiamava `resetMachineFacts(state)` che azzera TUTTO incluso machineType+machineNumber. Cliente perdeva l'identificazione della macchina anche entro il session TTL (1 ora). Follow-up flows come Caso 9 factura ri-chiedevano dati già noti. (b) Il rephrase LLM (`naturalRephrase: true`) ha re-inventato il dettaglio "pegado en la máquina, generalmente en la parte superior" anche se l'i18n era stata pulita in F37. Il prompt rephrase regola #2 era troppo generica. | (1) **Nuova funzione `resetIncidentDetails(state)`** in `utils/state.ts` che azzera tutto tranne `machineType + machineNumber`. (2) `agent-extract.ts` post-resolved branch ora discrimina: se il nuovo messaggio menziona un machineType ESPLICITAMENTE DIFFERENTE da quello in state → `resetMachineFacts` (full reset, customer switched machine); altrimenti → `resetIncidentDetails` (machine sticky, customer asking follow-up question). Test pinnato in `post-resolution-reset.test.ts` con 2 scenari (sticky/switching). (3) `prompts/rephrase.txt` regola #2 estesa con elenco esplicito di anti-pattern: NO "hasta oír un clic", NO "pegado en la máquina", NO "al lado de la pantalla", NO "etiqueta de la máquina", NO sequencias numeradas/listas di programmi che l'originale non lista. + REGLA: se l'originale è CORTO e DIRETTO, devolver corto e diretto. **Pattern preservativo**: ogni `mark_resolved` deve preservare le **machine identity facts** (tipo+numero) per follow-up flows naturali entro il session TTL. Solo se il cliente esplicitamente cambia macchina (nuovo tipo nel messaggio), full reset. Il LLM rephrase NON può aggiungere dettagli tecnici operativi inventati: il prompt rephrase deve ENUMERARE gli anti-pattern noti, non basarsi su una regola generica "no añadas información". |
| F39 | Andrea CLI 2026-05-11: trigger Caso 4 "He pagado y no se ha activado" → gather location (Goya) → tipo (lavadora) → numero (5) → bot chiede correttamente "¿la central te ha devuelto el cambio?" → cliente risponde "si" → bot dice *"Perfecto. Ahora, dime, por favor, qué aparece exactamente en la pantalla de la máquina."* invece di escalare (Caso 4.2). Cliente cade poi in Caso 2 DOOR. + secondo sintomo: rephrase LLM ha re-inventato *"Ábrela y ciérrala firmemente, comprobando que no haya ropa atascada"* (F37 aveva rimosso "ropa atascada" dal JSON, ma il rephrase LLM continua a generarlo nonostante F32/F38 anti-pattern list). Andrea: *"non doveva salire questo messaggio?"*. | (a) `guardNoChangeYesButBroken` in `utils/guards/payment-no-change.ts` richiedeva due markers nello stesso messaggio: yes-affirmation AND explicit "still broken" pattern. Bare "Sí" passava attraverso → LLM fallback → LLM improvvisava chiedendo display. Lo "still broken" è IMPLICITO dal trigger originale ("He pagado y no se ha activado") — richiederlo di nuovo nello stesso turno è ridondante. Il commento del guard diceva *"Bare 'Sí' alone keeps the LLM-driven branch active"* — disegno sbagliato che il bug ha rivelato. (b) Il rephrase LLM continua a re-inventare dettagli operativi DOOR-specifici ("firmemente", "ropa atascada"/"prendas atrapadas", "comprobando que..."). F32/F38 anti-pattern list non li includeva esplicitamente. Pattern strutturale identico a F38 sul DOOR invece che sul PUSH PROG. | (1) `guardNoChangeYesButBroken` ristrutturato: precedenza al check yes-affirmation, poi check resolution markers ESPLICITI ("ahora arranca"/"ya funciona"/"now works"/"ora funziona"/etc.) in tutte 6 lingue come SOLA eccezione → null. Default: yes-affirmation in `no-change-await-confirm` → escalate (Caso 4.2). Bare "Sí" / "si" / "Sì" / "Yes" / "Oui" / "Sim" → escalate uniformemente. (2) Test `payment-no-change.test.ts` aggiornato: il caso "bare Sí → null" sostituito con "bare Sí → escalate" (F39 regression marker). Aggiunto secondo test per "si" lowercase. (3) `prompts/rephrase.txt` regola #2 estesa con anti-pattern aggiuntivi: NO "ropa atascada"/"ropa atrapada"/"prendas atrapadas" (DOOR re-invention specifica), NO "comprobando que..."/"asegurándote de que..." (verificaciones non presenti), NO **adverbios intensificadores** ("firmemente" se l'originale dice "bien"). + regola esplicita: l'adverbio del original SE PRESERVA TAL CUAL. **Pattern preservativo (regola strutturale)**: (a) ogni guard che valida una risposta yes/no in una fase "await-confirm" DEVE poter inferire il contesto dello state precedente — non richiedere al cliente di ripetere informazioni già date nel trigger. (b) il rephrase LLM è un POLISH layer, non un INSTRUCTION layer: ogni volta che inventa un dettaglio operativo, la patch è aggiungere l'anti-pattern ESPLICITAMENTE nel prompt rephrase (mai delegare alla regola generica "no inventes información"). Il LLM ha bias forte a aggiungere dettagli tecnicamente "plausibili" — la mitigazione è enumerare le forme specifiche da rifiutare. |
| F40 | Andrea CLI 2026-05-11 dopo F37: bot mostra al cliente *"Por favor, selecciona el programa que desees y házmelo saber si la lavadora comienza a funcionar"* (versione PDF-aligned F37). Andrea: *"voglio un cambio voglio che usecases dica: Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina. Los programas disponibles son: 60º (muy caliente) → ideal para ropa muy sucia... con numeri in bold!"*. Richiesta esplicita di **revertire** F37 (strict PDF alignment) verso **option A** (deviazione UX documentata). Motivazione: il cliente in chat non può leggere ambient signage della lavandería, ha bisogno di informazione completa nel messaggio. | F37 aveva fatto la scelta opposta: **option B (strict PDF alignment)** — rimossi i 4 programmi perché il PDF Playbook §5.4 PUSH PROG diceva solo *"Prem ara el programa que vols i digues-me si la màquina respon."*. Quel trade-off era PDF-fidelity > UX. Ora Andrea inverte: UX > PDF-fidelity per PUSH PROG specifico, perché il messaggio finale al cliente è chat-only, non in-store. Il PDF descrive l'interazione fisica con la macchina (cliente VEDE i 4 programmi sul pannello), ma il bot chatta a distanza e deve replicare l'informazione che il cliente non ha sotto gli occhi. | (1) `washer_hs60xx.json:case_push` prompt ripristinato in forma arricchita: titolo + lista bullet di 4 programmi (**60º**/**40º**/**30º**/**Frío**) ognuno con **descrizione** (uso tipico) + closing question "Luego, cuéntame si la lavadora ha comenzado a funcionar.". (2) `docs/usecases.md` aggiornato in 6 punti dove il dialogo PUSH PROG appariva (Caso 1.1, 1.2, 7.1, 7.2, 30, 32.1 marathon) — tutti con la stessa nuova wording. Criterio #2 di Caso 1.1 ora dice esplicitamente *"muestra los 4 programas disponibles (**60º**, **40º**, **30º**, **Frío**) con descripción"*. (3) Unit test aggiornati con asserzioni POSITIVE su bold 4-program list: `auto-start-machine-flow.test.ts` (regex per `\*\*60º\*\*` etc. + descrizioni "muy caliente"/"templado"/"suave"/"delicad"), `caso-1-push-prog-flow-e2e.test.ts` (regex `/\*\*60º\*\*.*\*\*40º\*\*.*\*\*30º\*\*.*\*\*Frío\*\*/s` per ordine + bold + presenza). Rimossa la negative assertion F37 (`if (/\*\*60º\*\*.*\*\*40º\*\*/s.test(reply))` → throw). (4) `prompts/rephrase.txt` regola lista programmi raffinata: aggiunta clausola positiva "si el original SÍ las lista — ej. **60º** / **40º** / **30º** / **Frío** con descripciones — PRESÉRVALAS exactamente, incluyendo bold y bullets" così il rephrase preserva la lista invece di sintetizzarla. **Pattern preservativo (regola dialettica F37↔F40)**: nessuna decisione di alignment PDF/UX è definitiva. Il workflow `4-source verification` (PDF + usecases.md + JSON + bot reality) può portare a F37 (strict) o F40 (UX) a seconda della natura del contenuto e del canale. Per **azioni fisiche standard** (DOOR ciérrala bien — il cliente vede la macchina): strict PDF basta. Per **information transfer puro** (elenco programmi — il cliente non sa cosa pulsare se non glielo dico): UX vince. La decisione si prende caso per caso con Andrea, mai automaticamente — e ogni volta si **inverte la negative assertion del test** in positive assertion (o viceversa), aggiornando il F-log con la motivazione esplicita del trade-off. |
| F41 | Andrea CLI 2026-05-11 dopo F40: bot ha ricevuto il prompt arricchito ma il **rephrase LLM ha flattenato** la struttura bullet+bold rendendola: *"Pulsa un botón de programa para iniciar el lavado. Programas: - 60º muy sucia/blanca - 40º normal - 30º delicada/sintética - Frío lana/seda. Elige uno y púlsalo."* — lista inline, bold persi, descrizioni accorciate. Andrea: *"sono formattati bene voglio in un bullet poiints e 30 60 40 Frio in bold capital letter"*. F40 prompt rephrase update non bastava — il rephrase LLM è strutturalmente incompatibile con messaggi già formattati per il cliente. | Stesso pattern di F32/F37/F38/F39: il rephrase LLM ha bias forte a "rendere naturale" che spesso significa **flatten markdown structure** (bullet + bold + line breaks → inline dash-separated). Le regole testuali nel prompt rephrase ("PRESÉRVALAS exactamente, incluyendo bold y bullets" — F40) NON sono sufficienti perché il LLM con T=0.4 prioritizza fluency over fidelity. Aggiungere altre regole testuali è un'altra "pezza" — il fix architetturale è **bypass rephrase** per i messaggi già formattati. Pattern identico al F35 bypass per invoice flow (PII privacy), ma motivo diverso: qui è **format preservation**. | (1) `agent.ts` aggiunto `hasFormattedBulletList = /\n-\s+\*\*/.test(reply)` come terza condizione di bypass (insieme a `isT1Welcome` e `isInvoiceFlow`). Trigger: almeno una riga inizia con `- **` (markdown bullet + bold marker). Pattern generico, vale per case_push 4-program list MA anche per qualsiasi futura risposta arricchita. (2) `washer_hs60xx.json:case_push` aggiornato `Frío` → `FRÍO` (capital come Andrea). (3) `docs/usecases.md` aggiornato 7 occorrenze `Frío` → `FRÍO` (6 dialoghi + criterio #2 di Caso 1.1). (4) Unit test aggiornati: `auto-start-machine-flow.test.ts` regex `\*\*FRÍO\*\*` (capital), `caso-1-push-prog-flow-e2e.test.ts` due regex con `\*\*FRÍO\*\*` finale. **Pattern preservativo (3a regola dialettica del rephrase layer)**: il rephrase è un POLISH layer per messaggi PROSE. Quando un messaggio è già formattato per il cliente (markdown bullet list con bold), il rephrase NON ha valore aggiunto — può solo rovinare la struttura. Bypass deterministico via pattern match `\n-\s+\*\*`. Non aspettarsi che le regole testuali del prompt rephrase bastino; il LLM tende a "naturalizzare" anche contro istruzioni esplicite. La sequenza F32→F37→F38→F39→F40→F41 dimostra il limite: ogni anti-pattern aggiunto non garantisce che il successivo non venga inventato. Il bypass deterministico è l'unica soluzione robusta per certi tipi di contenuto. |

**Come usare questo log**: prima di un fix che sembra simile a un sintomo
qui sopra, leggi la voce corrispondente per evitare di reintrodurre la
stessa regressione. Quando aggiungi una voce, segui lo schema (sintomo
osservabile / root cause / fix architetturale).

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
