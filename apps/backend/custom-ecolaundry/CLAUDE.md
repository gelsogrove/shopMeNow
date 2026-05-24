# custom-ecolaundry — Orchestration rules (read every turn)

This file is auto-loaded when working under `apps/backend/custom-ecolaundry/`.
Read it BEFORE every change. The rules below are non-negotiable.

> **Long-form docs (consult on demand):**
> - [`docs/architecture.md`](docs/architecture.md) — full layered design, detectors, gather orderings, allowed-large-files, pending refactors, test patterns
> - [`docs/f-log.md`](docs/f-log.md) — regression catalogue (F1→F105). Read the matching F-entry BEFORE any fix that resembles a past symptom
> - [`docs/contracts.md`](docs/contracts.md) — per-tool validators
> - [`docs/adding-use-cases.md`](docs/adding-use-cases.md) — recipes
> - [`docs/orchestrator.md`](docs/orchestrator.md) — turn pipeline
> - [`json/cases.json`](json/cases.json) — bridge: doc "Caso N" ↔ code semanticId
> - [`scripts/check-architecture.sh`](scripts/check-architecture.sh) — CI/pre-commit enforcement

---

## 🔒 The 10 iron rules — verify on every change

1. **No patches in `prompts/agent.txt`**. If the LLM behaves wrong, fix it in code: a guard, a tool validator, or a post-processor invariant. ❌ Adding "DO NOT DO X" to the prompt is forbidden.

2. **Tool refuses, LLM corrects**. Tools validate args + semantics and return actionable errors. The LLM reads the error and retries. ❌ Trusting the LLM to "remember a rule" is forbidden.

3. **One file = one responsibility**. Files >150 lines mixing concerns must be split. Use the cassette structure (`tool-handlers/`, `guards/`, detectors, transitions). Escape hatch: `ALLOWED_LARGE_FILES` in `scripts/check-architecture.sh` (see `docs/architecture.md §15`).

4. **State transitions are named & atomic**. All mutations of `pendingClosure`, `operatorRequested`, `pendingEscalation`, `escalationReason`, `customerNameRequested` go through [`utils/state-transitions.ts`](utils/state-transitions.ts) (`markResolved`, `escalate`, `requireCustomerName`, `captureCustomerName`, `closeAsEscalated`, `startNewFlow`, `resetPostEscalationFlags`, `resetForNewIncident`). ❌ Inline mutations outside that module are forbidden. Enforced by `check-architecture.sh` Rule #4.

5. **Each detector ships with tests**. Pure helpers in `utils/<name>.ts` MUST have a sibling `__tests__/unit/<name>.test.ts` covering happy + edge cases. 100% coverage on the detector itself.

6. **No hardcoded phrase detection for INTENT**. Phrase routing belongs in the LLM. Phrase detection in code is allowed ONLY for boundary signals (greeting, mixed-signal, contrast connectors).
   **Tracked exemption — FAQ topic guards.** `HORARIOS_TOPIC`, `PRECIO_TOPIC`, `TARJETA_TOPIC`, `RECARGA_TOPIC`, `FACTURA_TOPIC` are intent classifiers kept as fast-path optimisation (6-lang coverage). Plan: route to LLM when ES is stable in production.
   **Tracked exemption — Language detection.** `detectLanguageHeuristic()` in `utils/intent.ts` uses scoring-based phrase matching to identify customer language before LLM routing (required architectural gate). 6-lang coverage with multi-language test suite.

7. **Settings are law**. `json/settings.json` is the source of truth for tenant config. `runtime.ts:validateSettings` fails fast on misconfiguration. No code path may produce a reply in a non-allowed language.

8. **Multi-language by design**. Every detector covers all 6 supported languages (es, it, en, ca, pt, fr).
   **Current scope (Andrea, 2026-05-08): SPANISH FIRST.** The active tenant runs ES only. `utils/escalation.ts` keeps ~30 hardcoded ES phrases for operator handover — deliberate exemption until ES is stable. When extending to other languages, port `escalation.ts` to the i18n catalogue.

9. **Semantic naming, no ordinal references**. File names, pendingFlow markers, reason strings, i18n keys, display flow ids, escalation reasons MUST describe behaviour, not document order. Forbidden tokens in code: `caso\d+`, `case\d+`. The numeric "Caso N" labels in `docs/usecases.md` are documentation-only — bridge in `json/cases.json`. Enforced by `check-architecture.sh` Rule #9.

10. **Guard preconditions must not cancel each other out — every required fact has a catch-all asker**. For every fact the bot must collect, there is a catch-all guard that fires whenever that fact is empty AND no legit escape hatch applies. Today's instance: `guardForceLocation`. **Corollary**: every gather step has a 3-strikes retry+escalate ladder on `state.<fact>AskAttempts` (canonical ask → guidance reask → escalate + requireCustomerName).
    ❌ Anti-pattern: a gather guard that gates on multiple unrelated state fields. The customer who fills two of three traps the third.

---

## 🎯 Scope check — ask BEFORE any cross-Caso architectural change

When fixing a bug or extending a feature, classify the scope BEFORE writing any code:

| Scope | Definition | Default action |
|-------|------------|----------------|
| **Narrow** | Fix lives inside one Caso's files: its guards, its i18n keys, its JSON entry, its sibling unit test. No cross-Caso symbol touched. | Implement directly. |
| **Cross-Caso architectural** | Fix touches a shared file (`agent-extract.ts`, `state-transitions.ts`, `runtime.ts`, `localization.ts`, `agent.ts`, `branches/index.ts`, `models/state.ts` union), OR adds a new transversal pattern. | **STOP. ASK Andrea**: "narrow X-line fix on Caso N only, or general Y-line architectural change touching Casi 1-32?" Wait for explicit pick. |

**Forbidden anti-pattern**: silently widening the blast radius. Examples that MUST be flagged as cross-Caso: changing `autoExtractFacts` extraction logic, adding a `pendingFlow` value, modifying `runGuardPipeline` ordering, editing `state-transitions.ts`, updating a shared i18n key already used by multiple Casi, bypassing the branch-router for a new condition.

When in doubt → ask. Cost of asking: 30 seconds. Cost of architecture regression: hours.

---

## 💬 Dialogo fluido — topic-switch può accadere a OGNI turno

L'utente può abbandonare il percorso in qualsiasi momento (DOOR mid-flow → "che orari avete?"). Il bot deve riconoscere il nuovo topic, NON forzare l'utente a finire il percorso precedente.

**Pattern attuale**:
- **Router LLM al T1** classifica il branch (greeting, faq, trouble-machine, invoice, loyalty, escalation, feedback).
- **`detectTopicSwitch` in `agent-extract.ts`** rileva mid-flow switch su un set ristretto (topicPayment, topicOps, topicDryerMinutes, topicCardFail, topicRefundDemand, topicCompensation).
- **`detectFaqPause` in `intent.ts`** rileva pause FAQ → `state.faqPause = true` → L5 appende `resumeAfterFaq` prompt.
- **Detectors** (`detectDiscountCodeIntent`, `detectInvoiceIntent`, `TARJETA_TOPIC`, etc.) scattano anche mid-flow se `pendingFlow` lo permette.

Quando aggiungi un nuovo Caso/flow/guard, rispondi a 3 domande:
- **A. Topic-switch IN**: se l'utente è in un altro flow e cambia verso il mio Caso, il mio detector scatta?
- **B. Topic-switch OUT**: se l'utente è nel mio flow e cambia topic, il mio flow si rilascia o blocca l'altro?
- **C. Pause + resume**: l'utente fa una FAQ veloce mid-flow e poi vuole continuare. Il mio flow è preservato?

**Anti-patterns**: ❌ detector di topic-switch per coppia specifica (O(N²)); ❌ forzare completamento ignorando nuovo intent; ❌ hardcoded keyword detection (rule #6 violation).

---

## 🐛 Bug intake protocol — mandatory before touching code

When Andrea reports a bug, type out this 7-step template IN MY RESPONSE BEFORE writing any code:

```
## 🐛 Bug intake — Caso N / F<N+1>

1. **Sintomo**: <one sentence describing the WRONG output>
2. **Layer**: L1 input / L2 state / L3 detector / L4 guard / L5 polish
3. **4-source verification** (see docs/architecture.md §18):
   - PDF Playbook §X.Y says: …
   - docs/usecases.md Caso N says: …
   - Code/JSON says: …
   - Bot reality: …
   - **Divergenza**: where the 4 disagree.
4. **Iron rules trap check** (mandatory NO answers):
   - Sto per patchare `prompts/agent.txt`?  → NO (rule #1)
   - Sto per mutare `pendingClosure`/etc. inline?  → NO (rule #4)
   - Sto per aggiungere intent-phrase detection senza real-bug evidence?  → NO (rule #6)
   - Sto per saltare il test sibling del detector?  → NO (rule #5)
   - Sto per usare `casoN` ordinal in codice?  → NO (rule #9)
5. **Fix layer-correct**: <which file + function, at the identified layer>
6. **F-log entry draft**: sintomo / root cause / fix architetturale (1 paragrafo)
7. **Pin location**: `__tests__/unit/f-log-regression.test.ts` test name `F<N+1> — <canonical marker>`

→ Procedo a codare SOLO dopo aver scritto tutti i 7 punti.
```

**Skip when**: feature additions (use Feature intake protocol below), doc-only changes, refactors with no behaviour change.

---

## ✨ Feature intake protocol — mandatory before implementing a new feature

When Andrea requests a new feature (new Caso, gather step, language, detector, tool), type out this 8-step template BEFORE writing code:

```
## ✨ Feature intake — <feature name>

1. **What**: <one sentence>
2. **Layer impact**: L1 / L2 / L3 / L4 / L5 / 4 LLM calls — list which.
3. **Scalability check** (CRITICAL — answer all 3):
   - Scala a nuovi FLUSSI? (pattern modulare o ad-hoc?)
   - Scala a nuovi CASI? (stesso pattern per Caso N+1?)
   - Scala a nuove LINGUE? (6 langs con test? O ES-only oggi?)
   - Se ANCHE UNA risposta è "no, ad-hoc" → riprogetta prima di codare.
4. **Recipe match**: quale pattern da `docs/adding-use-cases.md` applico?
5. **Architecture change?**: la feature richiede modifiche a CLAUDE.md / docs/architecture.md
   architettura (iron rules, 5 layers, allowed-large-files, branch-router, F-log policy, pre-commit checklist)?
   - Se NO → procedo
   - Se SÌ → **STOP. Discuto con Andrea PRIMA di toccare architettura**.
6. **Pin plan**: dove pinnare il test? (unit + agent E2E + cross-flow)
7. **F-log relevance**: la feature chiude un bug noto o introduce un pattern che potrebbe regredire? Se SÌ → F-log entry + pin con F-number.
8. **Docs to update**: usecases.md / contracts.md / cases.json / CLAUDE.md (solo se step 5 = SÌ)

→ Procedo SOLO dopo aver scritto tutti gli 8 punti AND ottenuto go-ahead esplicito su step 5 (se applicabile).
```

**Skip when**: bug fixes (use Bug intake), doc-only changes, refactor invariante, estensione minore di un detector esistente (<20 righe, stesso file).

**Regola di ferro su architecture changes**: io NON tocco silenziosamente le sezioni architetturali (iron rules, 5 layers, F-log policy, pre-commit checklist). Aggiungere una nuova F-log entry in `docs/f-log.md` è normale workflow. Cambiare la STRUTTURA delle regole è architectural change.

---

## ❓ Pre-edit checklist — chiediti SEMPRE prima di toccare codice

**Before EVERY code edit, answer**:

1. **"Sto facendo bene?"**
   - Fix al layer architetturale giusto (L1..L5)?
   - Address ROOT cause o symptom?
   - Design espandibile a future Casi senza copy-paste?

2. **"Sto rompendo qualcos'altro?"**
   - `grep -rn` il symbol/file — chi altro chiama?
   - Callers dipendono dalla OLD shape (signature, return type, JSON schema)?
   - Unit test coprono il OLD behaviour che fallirebbe?
   - Cambio contratto (i18n key, JSON schema, state field, function signature) → aggiornato TUTTI i call site?

**After the edit**:
- `npm run typecheck` — type-level breakage
- `npm run test:unit` — behavioural breakage
- Per non-trivial: re-run demo dei Casi precedentemente validati

Quando incerto → **stop and ask Andrea**.

---

## 🚨 Niente pezze (Andrea, 2026-05-23)

> "Niente pezze. Sistema espandibile. Segui architettura altrimenti perdiamo il controllo."

- **Identify the layer first** (L1..L5). Name the contract being touched. Justify why this is the right layer.
- **No symptom-level patches.** Fix the regex at its source, not a duplicate elsewhere. Find WHY a guard isn't running, don't duplicate it upstream. Don't bandaid downstream when (a) "shouldn't run, delegate", (b) "handler bug", (c) "upstream contract feeds wrong data".
- **No backward-compat duplicates.** When changing a contract, update every call site. Don't leave the old path "just in case".
- **Expandable design.** A fix that solves one Caso must not block future Casi.
- When in doubt → **ASK Andrea** before applying.

---

## 🧭 Test-and-validate workflow

When testing Casi 1..N from `docs/usecases.md`:

1. **Run** `npm run demo -- --batch '[...]'` with customer-side input from the Caso section.
2. **Validate** every bot reply against canonical sources, in this order:
   - `docs/usecases.md` (Caso N → criterios + Conversación)
   - All other files under `docs/` (architecture.md, contracts.md, `docs/csv/*.csv`). **CSVs are operational source of truth** for locations/programs/prices/hours/alarms — behaviour contradicting a CSV is a bug.
   - `json/settings.json` for tenant config.
3. **Check four axes**:
   - **Lingua sticky**: every turn in customer's session language (no spanglish). `state.language` final value matches.
   - **Contenuto vs contract**: usecases.md è **guideline, not literal-match**. Verifica concetti/keyword (es. "número" + "central" + "saldo" per Caso 4), accetta LLM phrasing variation.
   - **Traduzioni qualità**: i18n key usate → verifica traduzione in `json/i18n/<lang>.json` naturale. Bad translation = bug, fix the i18n file.
   - **Casi misti**: almeno uno scenario con typo, multi-info turn, partial answer. Bot estrae quel che c'è, chiede solo ciò che manca, mai loop.
4. **State final**: `pendingFlow`, `activeBranch`, `activeFlowId`, `pendingClosure` coerenti con outcome.
5. **Fix root-cause only** (no pezze). Run `bash scripts/check-architecture.sh` + `npm run test:unit` dopo ogni fix.

---

## ✅ Pre-commit checklist (mental, every change)

- [ ] Touched `prompts/agent.txt`? Added behavioural "DO NOT DO X"? **Stop**: goes in code (rule #1).
- [ ] Mutated `pendingClosure`/`operatorRequested`/`pendingEscalation`/`customerNameRequested`/`escalationReason` inline? **Stop**: use transition (rule #4).
- [ ] Added phrase regex for INTENT? → LLM (rule #6).
- [ ] Added detector? Wrote its tests? (rule #5)
- [ ] **Trigger coverage rule (F29)**: every trigger phrase in `## Caso N` → unit test `→ true`? Never assert usecases-documented trigger as `→ false`.
- [ ] Touched a tool? Updated [`docs/contracts.md`](docs/contracts.md)?
- [ ] Files <150 lines? If not, split (rule #3) OR add to `ALLOWED_LARGE_FILES` with reason.
- [ ] Wrote `casoN`/`caseN` in code/JSON? **Stop**: semantic id from `json/cases.json` (rule #9).
- [ ] Added new case? Added row to `json/cases.json`?
- [ ] Added guard with multiple `!ar.state.X` preconditions? Traced every combination has a catch-all (rule #10)?
- [ ] `npm run typecheck` passes?
- [ ] `npm run test:unit` passes (all suites)?
- [ ] `bash scripts/check-architecture.sh` passes?
- [ ] Multi-language: cover es/it/en/ca/pt/fr? (rule #8)
- [ ] **Triple-update rule**: all three artefacts updated in lockstep? (see below)

---

## 🔺 Triple-update rule — every bug-fix and feature touches 3 artefacts

**Mandatory** (Andrea, 2026-05-12): every change that closes a bug or adds a behaviour MUST update the THREE artefacts in the SAME PR.

| # | Artefact | What goes in it | Failure mode if skipped |
|---|----------|-----------------|--------------------------|
| 1 | **`docs/usecases.md`** — add a sub-case (e.g. `5.4`, `8.3`) or new top-level case | Criterios de aceptación + Conversación. TOC update. | Future-Andrea looks at the doc, doesn't see the behaviour, assumes bug, reverts. |
| 2 | **Unit test** (`__tests__/unit/<name>.test.ts`) — state-level pin, NO LLM | Detector / guard / state-transition assertions. Multi-language if change crosses lang boundaries. **F-log pin** in `f-log-regression.test.ts`. | check-architecture.sh #5 fails on detector without sibling. |
| 3 | **Agent test** (`__tests__/agent/<NN>-<case>.test.spec.ts`) — LLM-driven, run with `npm run test:agent` | Scenario mirroring usecases conversation turn-by-turn. Asserts BOT'S OUTPUT (the LLM reply). | Bot passes unit tests but produces wrong customer-facing text (F32/F39/F41). |

**Workflow**: usecases.md (write/update sub-case) → unit test (red → green) → agent test scenario (don't run, costs $) → implement code → F-log entry + pin → pre-commit checklist.

**Sub-cases vs new top-level**: prefer sub-case (`5.4`, `8.3`) over new top-level Caso unless genuinely orthogonal. Sub-cases keep gather/trigger context coherent.

**Anti-patterns**: "I'll add the usecase later" → No. "Unit test is enough, agent test is slow" → No. "Bug fix doesn't need sub-case" → If the bug surfaces a scenario the doc doesn't cover, the doc IS the bug.

---

## 🛡 Enforcement — what blocks a bad commit

Rules are checked by [`scripts/check-architecture.sh`](scripts/check-architecture.sh) + test suite, both in the pre-commit hook.

| Rule | Check | What it catches |
|------|-------|-----------------|
| #1 | grep `(DO NOT\|NEVER\|MUST NOT)` in `prompts/agent.txt` without `approved-by-andrea` marker | Behavioural patches that should be in code |
| #3 | `wc -l` on `utils/*.ts` vs 150 | Cassettes grown into mega-files |
| #4 | grep `ar\.state\.<flag>\s*=` outside `state-transitions.ts` | Inline state mutations |
| #5 | every `utils/<detector>.ts` has `__tests__/unit/<detector>.test.ts` | Detectors merged without tests |
| #9 | grep `caso\d+\|case\d+` in code/json/prompts | Ordinal references to doc cases |
| #11 | every F-number in `docs/f-log.md` has pin in `f-log-regression.test.ts` | F-log entries without regression pin |

To run: `bash scripts/check-architecture.sh`. Exit code non-zero on any violation.

---

## 🛑 Anti-patterns I must reject

If a request asks me to do any of these, push back, propose the correct layer, and proceed only with explicit confirmation:

- "Just add a rule to the prompt that says…" (rule #1)
- "Set `state.operatorRequested = true` here directly" (rule #4)
- "Add a regex to match 'ordine' / 'order' for routing" (rule #6)
- "Skip the test, it's a small change" (rule #5)
- "Hardcode this welcome string in the code" (rule #7)
- "Just patch this one case, don't generalise" (rule #2)
- "Call this flow `caso8-await-name`" (rule #9)
- "Put the new case logic in `payment.ts` for now, split later" (rule #3)
- "This guard skips when X is set, the LLM will handle the rest" (rule #10) — never let the LLM fill the gap.
- "Let me extract this inline regex preventively, before a bug shows up." → STOP. Pattern-guessing is a pezza disguised as architecture (see `docs/architecture.md §14`).

---

## 📊 Useful commands

```bash
bash scripts/check-architecture.sh  # 6 enforcement checks (rules 1/3/4/5/9/11)
npm run typecheck                    # tsc --noEmit
npm run test:unit                    # all unit tests (~1600 tests, <1s)
npm run demo                         # CLI agent REPL (needs OPENROUTER_API_KEY)
npm run test:agent                   # E2E with LLM (slow, costs $)

# Programmatic batch mode (for chatbot-eval skill):
npm run demo -- --batch '[["msg1","msg2"],"/reset",["scenario 2 turn 1"]]'
# Each entry: array of turns (one session) OR "/reset" (new session).
# Output: per-turn [USER]/[BOT] + per-scenario [STATE T-end] snapshot.
```

### chatbot-eval skill

The skill at [`.claude/skills/chatbot-eval/SKILL.md`](../../../.claude/skills/chatbot-eval/SKILL.md) auto-activates when Andrea says "testa quello che abbiamo fatto" / "valuta il bot" / "fai un giro di test". Reads `git diff main...HEAD`, picks 3-6 diff-driven scenarios, runs them via `npm run demo -- --batch`, evaluates each reply against iron rules + F-log, STOPS to type the Bug intake protocol before any fix (waits for Andrea's OK), then applies the layer-correct fix, verifies all 4 gates (typecheck + test:unit + check-architecture + f-log-regression), produces a final markdown report.

---

## 🤝 What I always do, on every turn

1. Re-read this file's iron rules.
2. Identify the affected layer(s) before changing anything.
3. Run typecheck + test:unit at the end. Never claim "done" without both green.
4. Update `docs/contracts.md` when touching a tool.
5. Add F-log entry to `docs/f-log.md` + pin in `f-log-regression.test.ts` for every architectural fix.
6. When in doubt, ask Andrea — never invent rules.
