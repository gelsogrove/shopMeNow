# custom-ecolaundry — TODO

Owner: Andrea — Last update: 2026-05-08

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

## 📐 Conventions for adding to this list

- One section per item, with a clear "Done when" so closure is unambiguous.
- Reference file paths so the next person can start without context.
- If an item turns into a doc decision (architecture, exemption, …), move
  the long-form rationale to `docs/` and keep the TODO entry pointing there.
- Closed items go to git history, not back into this file as "✅ done".
