# Cliente-0 Binding Compliance Checklist

Questo file e' la checklist vincolante per il demo Cliente-0.

Scopo:
- fissare nero su bianco cosa il chatbot DEVE fare
- fissare nero su bianco cosa il chatbot NON deve fare
- separare la conformita' architetturale dalla copertura delle fonti
- tenere tracciati i gap reali ancora aperti

Fonti di riferimento:
- `docs/cliente-0/pdf/`
- `docs/cliente-0/pdf-concept-audit.md`
- `docs/cliente-0/flows/json/lavatrice_hs60xx.json`
- `docs/cliente-0/flows/json/asciugatrice_ed340.json`
- `docs/cliente-0/flows/escenario.md`
- `docs/cliente-0/flows/achitecture.md`
- `docs/cliente-0/flows/prompt1-router.md`
- `docs/cliente-0/flows/prompt3-history.md`
- `docs/cliente-0/demo/prompt_history.txt`

Regola di lettura:
- `Mandatory` = regola obbligatoria
- `Owner` = layer che possiede la responsabilita'
- `Current status` = `Compliant`, `Partial`, oppure `Non-compliant`
- `Evidence` = dove la regola e' definita o dove oggi il comportamento e' osservabile
- `Required action` = cosa serve per chiudere il gap

---

## 1. Architecture Contract

| Mandatory rule | Owner | Current status | Evidence | Required action |
|---|---|---|---|---|
| Router classifies and extracts facts, but never becomes the final customer-facing voice | Router | Compliant | Architecture + prompt1-router | Keep enforced |
| Conversation History is the only visible customer-facing writer | Conversation History | Compliant | Architecture + prompt3-history + prompt_history.txt | Keep enforced |
| Specialists decide technical path, but do not write as human support agents | Specialists | Compliant | Architecture + specialist contract in runtime | Keep enforced |
| Flow Engine is source of truth for deterministic troubleshooting steps | Flow Engine | Compliant | JSON flows + runtime flow execution | Keep enforced |
| Customer-facing wording must not change technical meaning from upstream structured decisions | Conversation History | Partial | Prompts now state this clearly, but runtime behavior still needs stronger regression coverage | Add scripted regression tests |
| Conversation History must not infer new causes, risk levels, or business meaning not present upstream | Conversation History | Partial | Prompt strengthened, but end-to-end proof is incomplete | Add scripted regression tests for smell/escalation wording |

---

## 2. Interaction Rules From Playbook

| Mandatory rule | Owner | Current status | Evidence | Required action |
|---|---|---|---|---|
| Calm first, then diagnosis, then next step | Conversation History | Partial | Playbook excerpt + prompt rules | Audit messages against scripted scenarios |
| One question per message | Conversation History | Partial | Prompt rules exist, but long replies still appear in some branches | Tighten prompt and add scenario checks |
| Keep messages short | Conversation History | Partial | Prompt rules exist, but some replies remain verbose | Add output regression checks |
| Collect only necessary data | Router + Conversation History | Partial | Better than before, but some paths still over-ask or re-ask | Add missing-fact regression tests |
| Do not accuse fraud directly | Conversation History | Compliant | Prompt rule explicit | Keep enforced |
| Do not promise refunds or compensation unless source/policy says so | Conversation History | Compliant | Prompt rule explicit | Keep enforced |
| Escalate when case is ambiguous, inconsistent, or requires manual validation | Router + Specialists + Flow Engine | Partial | Escalation exists, but timing still needs regression coverage | Add escalation-timing tests |

---

## 3. Mandatory Data Collection Order

| Mandatory rule | Owner | Current status | Evidence | Required action |
|---|---|---|---|---|
| For troubleshooting, ask location before diagnosis when missing | Router -> Conversation History | Partial | Runtime improved recently, but not yet fully validated across all first-turn variants | Add scripted cases for missing-location starts |
| Ask machine type when missing | Router -> Conversation History | Partial | Works in many cases, but typo and ambiguous-input regressions existed | Add scripted typo cases |
| Ask machine number when needed and known to be relevant | Router -> Conversation History | Partial | Works in many cases, but some branches still jump too early | Add branch-level checks |
| Ask payment status only when relevant to current path | Router / Flow Engine | Partial | Improved, but still sensitive to natural-language variants | Add confirmation parsing tests |
| Ask display state only when relevant to current path | Router / Flow Engine | Partial | Mostly aligned, but some invalid display handling remains fragile | Add invalid-display tests |

Binding order for standard troubleshooting:
1. location
2. machine type
3. machine number if needed
4. what happened / payment state / display state according to the selected path

---

## 4. Technical Source Compliance

| Mandatory rule | Owner | Current status | Evidence | Required action |
|---|---|---|---|---|
| Washer technical cases must come from `lavatrice_hs60xx.json` | Flow Engine + specialist routing | Compliant | JSON coverage matrix | Keep enforced |
| Dryer technical cases must come from `asciugatrice_ed340.json` | Flow Engine + specialist routing | Partial | JSON exists, but runtime routing still needs regression proof on edge cases | Add dryer regression scenarios |
| Dryer `money added but minutes did not increase` must resolve to manual review, not invented troubleshooting | Dryer flow | Partial | JSON is correct; runtime recently fixed, but broader validation still missing | Add dedicated scripted scenario |
| Dryer `ALM` must not be treated like washer `ALM/*` unless a source explicitly defines it | Specialist routing + Flow Engine | Partial | Runtime logic was corrected, but exact multi-turn validation is still incomplete | Add scripted `dryer-alm-invalid` scenario |
| Dryer `FILTRO`, `FALLO DE ROTACION`, `FALLO DE ASPIRACION`, `STOP`, blocked door, smell must stay inside dryer reset/error playbook | Dryer flow | Partial | JSON is aligned; runtime wording and branch selection need scenario proof | Add scripted scenarios |
| Smell escalation must stay "manual inspection" and must not be rewritten as extra safety theory unless source says so | Conversation History | Partial | Prompt corrected, but no executable regression yet | Add scripted smell escalation scenario |

---

## 5. FAQ And Policy Source Compliance

| Mandatory rule | Owner | Current status | Evidence | Required action |
|---|---|---|---|---|
| FAQ answers must come from verified source material, not invention | Conversation History + FAQ source | Partial | FAQ base exists, but 100% PDF coverage is not proven | Build PDF-to-FAQ coverage audit |
| Prices, hours, invoice, loyalty card, refund rules must be backed by explicit source | FAQ source + History | Partial | Some FAQs are present, but full source validation is incomplete | Audit FAQ dataset against PDFs/playbook |
| Policy cases outside JSON must still be documented and testable | Router + History + policy source | Partial | `matrix-non-json.md` tracks many of them, but not as executable checks | Convert rows into tests/checklist items |

---

## 6. Black-And-White Current Non-Compliance

These points are NOT closed today.

1. We do not yet have a 100% audited mapping from PDF concepts to JSON flows, FAQ entries, and scenario coverage.
2. We do not yet have executable regression tests proving that Conversation History never adds invented causes or extra business meaning in edge escalations.
3. We do not yet have full scripted proof that every troubleshooting start respects the mandatory order `location -> machine type -> machine number -> path-specific facts`.
4. We do not yet have full scripted proof that all dryer edge cases stay in the correct source-backed branch under typos, ambiguous wording, and multi-turn context.
5. We do not yet have a formal completeness check proving that every FAQ/policy answer currently in the demo is traceable to the PDFs or the playbook.

---

## 7. What Is Good Enough Today

These points are good enough to keep as current baseline.

1. The architecture split is much cleaner than before: Router, Specialists, Flow Engine, and Conversation History now have clearer responsibilities.
2. The JSON flows are the primary deterministic source for washer and dryer troubleshooting.
3. Premature escalation for money/minutes cases has been reduced by forcing missing identity details first.
4. The most obvious washer/dryer branch confusions have been reduced.

---

## 8. Exit Criteria For Saying "Compliant"

We can say the demo is compliant only when all of the following are true.

1. Every relevant PDF concept is mapped to one of: JSON flow, non-JSON FAQ/policy source, or explicit manual-review rule.
2. Every open `Partial` or `Non-compliant` row above has either been fixed or explicitly reclassified with a source-backed reason.
3. Scripted regression scenarios exist for the main risky branches:
   - dryer money/minutes
   - dryer invalid `ALM`
   - dryer strange smell escalation
   - washer `ALM/*`
   - missing location at first turn
   - machine-type typo handling
4. The Conversation History output has been validated against the playbook style constraints.

---

## 9. Immediate Next Actions

1. Build a PDF-to-concept audit table and link every concept to JSON, FAQ, scenario, or gap.
2. Add scripted regression scenarios for the unresolved dryer and wording branches.
3. Re-run the checklist and update each `Partial` or `Non-compliant` row with executable evidence.