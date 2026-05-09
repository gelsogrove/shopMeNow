# custom-ecolaundry — TODO

Owner: Andrea — Last update: 2026-05-09 (post-Caso 6 rework)

> Snapshot of open items. Closed items are NOT tracked here (use git history).
> Iron rules and architectural contract live in [`CLAUDE.md`](CLAUDE.md).
> Decision log lives in `docs/`.

---

## 🟢 Status snapshot

| Area | Status |
|---|---|
| Iron rules enforcement (`scripts/check-architecture.sh`) | ✅ all 5 checks pass (rules #1/#3/#4/#5/#9) |
| Use cases coverage | ✅ 32/32 mapped in `json/cases.json` + dedicated agent tests |
| Unit tests | ✅ all green (32 detector test files) |
| Agent tests | 🟡 ~95-97% green (LLM-driven; flaky on Phase B/C re-ask transitions) |
| Multi-language i18n catalogue | ✅ es / it / en / ca / pt / fr complete |
| Production language scope | 🟡 ES-only (`settings.json:enabledLanguages = ["es"]`) |
| Branch router | 🟡 implemented, gated by `useBranchRouter=false` |
| Documentation | ✅ 10 docs in `docs/` + `CLAUDE.md` per-folder |
| Acceptance-criteria coverage | 🟡 ~85% test-asserted, ~10% code-only, ~5% LLM-only (items #7/#8/#9 close the gap) |
| Fact-out-of-order pipeline hole (rule #10) | ✅ closed for location, machineType, machineNumber, double-charge gather (4 instances closed 2026-05-09) — Mataró+display-first edge open in #10a |
| Caso 6 doble cobro rework | ✅ gather order canonical (location → tipo → numero → ¿podido?), Scenario 6.4 added (no he podido → escalation immediata), summary builder distingue 6.1 vs 6.4 |
| PII leak to OpenRouter via conversation history | 🟡 history retains customer PII (name, email, phone, CIF, address, card digits). Tracked in #11. |

---

## 🚧 Open items

### 1. Promote thin branch handlers to "full" (architectural — Phase G)
**What:** 4 of 6 branch handlers are still "thin" (return `handoff: 'delegate-to-legacy'`):
`trouble-machine`, `invoice`, `loyalty`, `escalation`. They classify via the
T1 LLM router but the legacy guard pipeline produces the actual reply.

**Why blocking:** until they are full, turning on `useBranchRouter=true`
adds latency (~500ms) and cost (~$0.0005 per T1 message) without delivering
the multilingual benefit.

**Done when:** each handler owns its full reply pipeline (per-language JSON,
state machine, no fallback to legacy guards).

**Where to start:** `utils/branches/<branch>/handler.ts` + look at
`greeting/handler.ts` and `faq/handler.ts` as the reference for "full".

---

### 2. Multi-language activation (single milestone)
**What:** the system is ES-only in production today. When a 2nd language
goes live, the following must be done together as ONE migration:

1. **Flip `json/settings.json:enabledLanguages`** → add the new language code.
2. **Activate `useBranchRouter=true`** — multilingual intent classification
   becomes worth its cost (+500ms / +$0.0005 per T1) once 2+ languages
   share the same router.
3. **Port `utils/escalation.ts` summary builder to i18n** — ~30 hardcoded ES
   phrases for operator handover must move to `json/i18n/<lang>.json` with
   per-language tests. Today an exemption to rule #8 (documented in CLAUDE.md).
4. **Move FAQ topic regex to LLM** — `HORARIOS_TOPIC`, `PRECIO_TOPIC`,
   `TARJETA_TOPIC`, `RECARGA_TOPIC`, `FACTURA_TOPIC` are regex-based intent
   classifiers (rule #6 exemption). Reroute via the LLM with a slim
   system-prompt section listing FAQ keys, then delete the topic regexes.
5. **Per-language agent tests** for the new language (mirror of the ES
   acceptance tests in `__tests__/agent/`).

**Decision rule (Andrea, 2026-05-08):** all the above stay deferred until
the 2nd language is being onboarded. Today: 1 language live → keep deferred.

**Tracked in memory** (`project_use_branch_router.md`).

**Where:**
- `json/settings.json` (flip)
- `utils/escalation.ts` (ES phrases → i18n)
- `utils/guards/hours-and-pricing.ts`, `loyalty-card-buy.ts`,
  `loyalty-card-recharge.ts`, `invoice-flow.ts` (FAQ topic regex)
- `__tests__/agent/<lang>/*` (per-language tests)

---

### 3. Topic-switch protocol (Phase F)
**What:** the bot does not yet handle a clean topic-switch mid-flow. Example:
the customer is in DOOR flow ("¿qué aparece en la pantalla?" → "DOOR" →
instruction) and suddenly asks "¿qué horarios tenéis?" — the legacy guard
pipeline answers the FAQ but the active flow is not cleanly suspended.

**Why blocking:** real customers do this. The architecture supports it via
`activeBranch + previousBranch + handoff: 'topic-switch'` in the branch
router, but the implementation is partial.

**Done when:** `utils/branches/index.ts` honours `topic-switch` handoff →
re-routes on T+1 → restores `previousBranch` if appropriate.

---

### 4. Tool validator for `set_*` operations
**What:** [`prompts/agent.txt`](prompts/agent.txt) contains a behavioural
patch around line 583 ("DO NOT set_X if Y"). Per rule #1 (no patches in
prompt), this should be enforced by a validator on the corresponding tool
handler.

**Done when:** the prompt patch is removed AND the tool handler returns an
actionable error message that the LLM reads and corrects.

**Where:** `utils/agent-tools.ts` (schemas) + `utils/tool-handlers/*.ts`.

---

### 5. Display change mid-flow (preemption)
**What:** Phase B re-ask escalates regardless of whether the customer
provides a NEW display token in the second reply. Example:
- DOOR flow active → instruction → "no funciona" → Phase B re-ask "¿qué
  pantalla?" → customer says "SEL" instead of "DOOR" → bot escalates
  DOOR-related when it should pivot to SEL flow.

**Done when:** Phase B re-ask detects a different display token and pivots
the flow instead of escalating the original one.

**Where:** `utils/guards/display.ts:guardPostInstructionFailure`.

---

### 6. Agent-test flakiness on Phase B/C escalation
**What:** Tests asserting escalation immediately after the customer signals
"sigue igual" / "no arranca" sometimes pass and sometimes need an extra
turn (Phase B re-ask, then Phase C escalate). The architecture is correct
(2-step escalation prevents premature handover), but the LLM occasionally
escalates directly, occasionally re-asks first.

**Mitigation done:** tests now tolerate both paths (re-ask + confirm display
+ escalate) and assert on the final escalation reaching the name-ask phase.

**Done when:** the bot's behaviour on this transition is fully deterministic
(deterministic Phase B/C state machine in code, not LLM-driven).

**Where:** `utils/guards/display.ts:guardPostInstructionFailure` +
`__tests__/agent/06-escalar`, `07-door`, `08-sel`, `12-pagado-no-usado`.

---

### 7. Acceptance-criteria gap: negative assertions ("the bot must NOT say X")

**What:** the `Criterios de aceptación` in `docs/usecases.md` for Casos
13, 18, 19, 25, 28 explicitly state that the bot must **NOT** confront,
accuse, or contradict the customer. Examples: "no acusar al cliente",
"no decir 'te equivocas'", "no minimizar el malestar". These are
NEGATIVE assertions and they are not enforced by any test today. The
prompt's TONE & EMPATHY section documents the rule for the LLM, but
nothing automated catches a regression.

**Why this matters:** a single LLM hallucination in the wrong direction
("eso no puede ser, has hecho algo mal") would breach trust on the most
sensitive cases (angry customer, suspected fraud, contradictory
narrative) and we'd find out only via customer complaint.

**Done when:** every escalation-flavour test (Casos 13, 18, 19, 25, 28
and the angry-customer / contradictory branches of Caso 6) asserts
`expectMentionsNone(reply, FORBIDDEN_BLAME_TOKENS)` where the array
includes (at minimum): `te equivocas`, `mientes`, `no es verdad`,
`imposible`, `eso no es así`, `has hecho algo mal`. The list lives in
`__tests__/agent/_helpers.ts` so it is reused.

**Where:**
- New helper: extend `__tests__/agent/_helpers.ts` with
  `FORBIDDEN_BLAME_TOKENS` + `expectNoBlame(reply)` wrapper.
- Apply to: `__tests__/agent/16-fraude-incoherencia.test.spec.ts`,
  `24-enfadado.test.spec.ts`, `28-relato-contradictorio.test.spec.ts`,
  `30-codigo-numerico.test.spec.ts`, the Caso 19/20 specs in
  `cross/05-location-gated-21-24.test.spec.ts`, and the Scenario 6.2/6.3
  blocks in `14-doble-pago.test.spec.ts`.

**Effort:** ~1.5h (helper + ~6 test files).

---

### 8. Acceptance-criteria gap: emoji-policy enforcement

**What:** the prompt defines a strict emoji policy
(`prompts/agent.txt` → 😊 EMOJI POLICY): max 1 per reply, only at the
end, only on closing-question / positive-resolution / first-contact
empathy, NEVER on escalation / error / lists / replies with external URLs.
Today this is documentation only — the LLM follows it most of the time,
but there's no deterministic enforcement.

**Why this matters:** spurious emojis on escalation handover ("vamos a
revisar tu caso 🙂") feel inappropriate and break the formal tone the
operator hand-off requires. It's the kind of regression no one notices
until a customer screenshots it.

**Done when:** an output-invariant in `utils/output-invariants.ts`
(L5 layer) counts emojis in the reply and:
1. If `count > 1` — strip down to the first one only.
2. If the reply matches an escalation pattern (contains
   `revisar`, `operador revisar`, `human support`, the L5 invariant
   adds `desactivado` etc.) — strip ALL emojis from the body.
3. Add a sibling unit test
   `__tests__/unit/emoji-policy-invariant.test.ts` covering: 0/1/2/3
   emoji inputs, escalation-with-emoji input, link-with-emoji input.

**Where:**
- `utils/output-invariants.ts` (add `stripEmojiOverflow` /
  `stripEmojiOnEscalation`).
- `agent.ts:polishReplyForTurn` already routes through
  `applyOutputInvariants`, so wiring is one line.
- Test scaffolding mirrors existing `output-invariants.test.ts` if
  present, otherwise create.

**Effort:** ~2h (regex for emoji detection is well-known, but tone
detection on "is this an escalation?" needs care — start from a tight
keyword list).

---

### 9. Acceptance-criteria gap: insistence cap on Caso 31 (no location)

**What:** Caso 31's `Criterios de aceptación` says the bot insists on
the location for "2-3 intentos" and then escalates if the customer can't
or won't identify the laundry. Today the test (`32-no-local.test.spec.ts`)
covers ONE round of insistence. There is no test that pushes the bot
through 3 failed attempts in a row to verify it eventually escalates.
Also the cap itself (when does the bot give up?) is implicit in the
LLM, not encoded in code.

**Why this matters:** without a hard cap, a customer who refuses to
give a location could trap the bot in an infinite re-ask loop (turn
budget burns, session never escalates). Andrea has flagged in CLAUDE.md
that "do not loop" is a sacred rule.

**Done when:**
1. `state.locationClarificationCount` (already exists in `state.ts`)
   triggers a deterministic escalation when it reaches 3 — guard added
   in `utils/guards/location-resolution.ts:guardInsistLocation`.
2. New agent test `32-no-local.test.spec.ts` scenario: customer says
   "no lo sé" three times in a row → 3rd reply is an escalation
   (`expectEscalation(reply)`) AND the bot asks for the name.
3. New unit test on the guard verifies the count → escalate transition.

**Where:**
- `utils/guards/location-resolution.ts` — extend `guardInsistLocation`.
- `__tests__/agent/32-no-local.test.spec.ts` — add insistence-cap test.
- `__tests__/unit/location-resolution.test.ts` (or create if absent).

**Effort:** ~1h.

---

### 10. Follow-up to the fact-out-of-order fix (rule #10)

**Context:** on 2026-05-09 a real session showed the bot drifting badly
when the customer reported the display BEFORE the location. Root cause:
gather-guard pipeline hole — every guard skipped because preconditions
cancelled out. Fix shipped: `guardForceLocation` catch-all + new iron
rule #10 in `CLAUDE.md` + unit tests pinning patterns A/B/C/D.

This follow-up captures what's NOT yet done after that fix:

#### 10a. Audit other potential fact-out-of-order holes

✅ **Mostly closed (2026-05-09 evening)** by:
- `guardForceLocation` (location)
- `guardForceMachineType` / `guardForceMachineNumber` — `!displayState`
  precondition removed (now they fire even when the customer reports the
  display first)
- `guardDoubleChargeAskUsed` — added `machineType + machineNumber`
  preconditions so Caso 6 gathers location → tipo → numero BEFORE the
  branch question (regression: Andrea's "me han cobrado dos veces" →
  bot used to ask "¿podido lavar?" before having type+number, producing
  a useless operator summary).

Still open:
- Mataró street out-of-order: customer reports `Mataró + AL001` in one
  message → displayState set early, `guardMataroStreet` should still
  fire to ask the street. Verify with a unit test exercising this exact
  sequence.

**Done when:** unit test in `__tests__/unit/location-resolution.test.ts`
covers the Mataró + display-first edge case. `bash scripts/check-architecture.sh`
remains green.

**Effort:** ~30min (single test).

#### 10b. `locations.ts` ↔ `locations.json` drift

`utils/locations.ts:LAUNDROMATS` defines **6** laundromats including
`Platja d'Aro`. `json/locations.json:locations` defines **5** (no Platja).
Consequences:

- `listLaundromatsForReply()` (used by `guardUnknownLocation`) lists 6.
- `faqOverrides` lookups for "Platja d'Aro" return `undefined` →
  customers in Platja get the default opening hours, not the local
  override (if there should be one).
- No agent test exercises Platja.

**Done when:**
1. Decide whether Platja is in scope (ask Andrea). If yes, add it to
   `json/locations.json:locations` with its `faqOverrides` (at minimum
   `openingHours`). If no, remove it from `utils/locations.ts:LAUNDROMATS`.
2. Add a `runtime.ts:validateSettings`-side check that asserts the keys
   in `LAUNDROMATS[].canonical` match the keys in `locations.json`. The
   validator already exists for i18n parity — extend it.
3. Add a unit test in `__tests__/unit/locations.test.ts` (create if
   absent) that fails fast if the two sources of truth diverge.

**Effort:** ~1h once the in-scope decision is made.

#### 10c. Add the regression to the agent test suite

`__tests__/agent/cross/08-fact-out-of-order.test.spec.ts` covers
PATTERNS A/B/D end-to-end via the LLM. Run the full agent suite once
OpenRouter credits / time allow, then add this file's results to the
green baseline. Today the unit tests cover the deterministic guard, but
the LLM path needs the real LLM to confirm no regressions.

**Done when:** the file is green in the next full agent suite run.

---

### 11. `scrubPiiForLlm(history)` — strip customer PII before sending history to OpenRouter

**Context:** every call to `callAgentLLM(messages, runtime)` sends the full
`messages` array (system prompt + accumulated history + new user turn) to
OpenRouter. The history accumulates **all** prior turns, including those
handled by deterministic guards. So PII collected via i18n-driven gather
guards (Caso 9 invoice flow, Caso 6 double-charge captura, Caso 8 discount
code, customer name on every escalation) ends up in the LLM input on the
NEXT turn that triggers an LLM call.

**Concrete leak inventory** (per turn that hits OpenRouter):

| Field | Where it enters history | Source |
|---|---|---|
| `customerName` | every escalation reply quoting the name + the customer's typed name turn | `state.customerName` + raw user turn |
| `customerPhone` | rendered into the operator handover summary appended to the assistant reply | `appendEscalationSummary()` in `agent.ts` |
| Email | invoice flow turn ("ana@example.com") + the `invoiceFinal` reply | i18n key `invoiceFinal` + raw user turn |
| Razón social, dirección, CIF/NIF | invoice flow user turns + `invoiceFinal` reply | raw user turn + state |
| Last 4 digits of card | doble-charge user turn + summary | raw user turn |
| Free-text customer narratives | doble-charge `relato` step | raw user turn |

GDPR / data-minimisation principle: this PII is only needed by the
OPERATOR (in the human-handover summary), not by the LLM. The LLM should
see structural placeholders so it can keep its conversational context
without seeing the actual values.

**Goal:** an explicit `scrubPiiForLlm(messages: AgentMessage[]): AgentMessage[]`
function that runs IN BETWEEN `runLlmLoop` building `messages` and
`callAgentLLM` sending them. It returns a deep clone with PII replaced
by stable placeholders.

**Design — placeholder format:**

Stable, semantic, easy to spot in logs and reversible offline:

```
"Andrea"               → "<CUSTOMER_NAME>"
"+34 600 12 34 56"     → "<CUSTOMER_PHONE>"
"ana@example.com"      → "<EMAIL>"
"PIno pallo SRL"       → "<COMPANY>"
"Calle Mayor 1, ..."   → "<ADDRESS>"
"B12345678"            → "<TAX_ID>"
"4821" (4-digit card)  → "<CARD_LAST4>"
free-text narrative    → kept (drop only structured PII; narrative is
                         semantic context the LLM needs)
```

The LLM never sees the real values. Replies the LLM produces with the
placeholders are then UN-substituted on the way out (the `polishReplyForTurn`
step replaces `<CUSTOMER_NAME>` back with the real `state.customerName`
before the user sees the reply, and the operator handover summary
continues to use real values because it goes through `escalation.ts`,
not through the LLM).

**Implementation outline:**

1. **New module:** `utils/pii-scrub.ts` (~100 lines).

   ```ts
   export interface PiiScrubMap {
     name: string | null
     phone: string | null
     email: string | null
     company: string | null
     address: string | null
     taxId: string | null
     cardLast4: string | null
   }

   export function buildScrubMapFromState(state: SessionState): PiiScrubMap
   export function scrubText(text: string, map: PiiScrubMap): string
   export function scrubMessages(messages: AgentMessage[], map: PiiScrubMap): AgentMessage[]
   export function unscrubReply(reply: string, map: PiiScrubMap): string
   ```

2. **Hook in `agent-llm.ts`:** wrap `callAgentLLM` so the messages are
   scrubbed before fetch and the response is unscrubbed after:

   ```ts
   const scrubMap = buildScrubMapFromState(ar.state)
   const scrubbed = scrubMessages(messages, scrubMap)
   const response = await callAgentLLM(scrubbed, ar.runtime)
   if (response.content) {
     response.content = unscrubReply(response.content, scrubMap)
   }
   ```

3. **Don't scrub the operator handover summary:** that lives in
   `agent.ts:appendEscalationSummary` and is appended AFTER the LLM
   step. The summary is built from `state` directly, so it carries
   real values to the operator. The scrub only protects the LLM input
   path.

4. **Detection rules:**
   - `customerName`: from `state.customerName` (set by `captureCustomerName`)
   - `customerPhone`: from `state.customerPhone`
   - `email`: regex `/[\w.+-]+@[\w-]+\.[\w.-]+/g` on every message body,
     plus `state.invoiceData.email` literal match
   - `company`: literal match of `state.invoiceData.razonSocial`
   - `address`: literal match of `state.invoiceData.address`
   - `taxId`: literal match of `state.invoiceData.taxId`
   - `cardLast4`: regex `/\b\d{4}\b/g` only when the previous turn was
     `doubleChargeAskCardDigits` (avoid false positives on machine
     numbers — if the customer says "4" and we strip it, the bot loses
     the machine number).

5. **Tests** (`__tests__/unit/pii-scrub.test.ts`):
   - Round-trip: scrub → LLM-style transform (identity) → unscrub returns original
   - Edge: customer name that collides with a place name (e.g. "Goya")
     — must NOT scrub the location, only the explicit `state.customerName` mention
   - Edge: card last-4 only when context says so
   - Edge: missing state fields → no-op (placeholder map empty)
   - Edge: nested `assistant.tool_calls.function.arguments` JSON strings
     (must be scrubbed too — the LLM sees them)

**Why this matters operationally:**

- **GDPR / DPA**: OpenRouter is a US-routed gateway. Customer PII flowing
  there triggers data-transfer obligations. Scrubbing turns the LLM call
  into a "no PII" interaction.
- **Token cost**: the scrub doesn't shorten history (placeholders have
  similar length), but downstream we can be more aggressive (e.g. drop
  the invoice flow turns entirely after `mark_resolved` because the
  values are already in `state.invoiceData`).
- **Audit log**: operator-side analytics can keep PII (different code
  path); the LLM gateway just sees structure.

**Done when:**

1. `utils/pii-scrub.ts` exists and is unit-tested (8+ cases).
2. `agent-llm.ts` (or `runLlmLoop` in `agent.ts`) scrubs before
   `callAgentLLM` and unscrubs after.
3. Operator handover summary in `appendEscalationSummary` is unaffected
   (still uses real values — the scrub never touches `state` itself).
4. New iron rule check in `scripts/check-architecture.sh` greps that
   `callAgentLLM` is never called directly without `scrubMessages` in
   the same function. Or unit-tested via spy in `__tests__/unit/agent-llm-scrub.test.ts`.
5. CLAUDE.md gets a short paragraph under "Privacy posture" referencing
   this module as the single chokepoint between conversation state and
   external LLM gateway.

**Effort:** ~3-4h (module + 8 unit tests + agent-llm wiring + arch
check + CLAUDE.md note).

**Dependencies / risk:**
- Care must be taken to scrub the LLM's own previous tool-call arguments
  (assistant messages with `tool_calls` carry the args as JSON strings).
  Skipping this leaks PII via the LLM "I previously called set_location(...)" recall.
- The unscrub on the way out must be idempotent: if the LLM doesn't echo
  a placeholder, the reply is unchanged.
- Avoid scrubbing the placeholder itself if the LLM emits it back
  (`<CUSTOMER_NAME>` → still `<CUSTOMER_NAME>` after unscrub if no real
  name is in scrubMap).

**Where to start:** copy `utils/output-invariants/evasive.ts` as the
template (small focused module + dedicated test file).

---

## 📐 Conventions for adding to this list

- One section per item, with a clear "Done when" so closure is unambiguous.
- Reference file paths so the next person can start without context.
- If an item turns into a doc decision (architecture, exemption, …), move
  the long-form rationale to `docs/` and keep the TODO entry pointing there.
- Closed items go to git history, not back into this file as "✅ done".
