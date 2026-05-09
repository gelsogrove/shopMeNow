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
| `state.pendingFlow = 'no-change-ask'` | inline regex (legacy, audit pending) | Caso 4 trigger — to be extracted to a multi-lang detector. |
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
| `extractDisplayLabel(message, canonical)` | Literal customer wording (`"PUSH PROG"`) | n/a | Greedy uppercase tail extension. |
| `normalizeMachineType(value)` | `lavadora|secadora` → `'washer'\|'dryer'` | ✓ 6 langs | Handles fuzzy match (Levenshtein). |
| `extractExplicitLocation(message)` | `"estoy en Goya"` → `"Goya"` | ✓ 6 langs | Falls back to `resolveKnownLocation`. |
| `parsePaymentAnswer(message)` | yes/no parsing for "¿has pagado?" | ✓ 6 langs | |
| `detectIDontKnowReply(message)` | `"no lo sé"`/`"non lo so"`/… | ✓ 6 langs | Boundary signal — used by gather-step retry path. |
| `detectDoubleChargeIntent(message)` | Caso 6 trigger | ✓ 6 langs | Tracked rule #6 exemption (fast-path). |
| `detectDiscountCodeIntent(message)` | Caso 8 trigger | ✓ 6 langs | Tracked rule #6 exemption. Permissive on verb-prefix typos. |
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
