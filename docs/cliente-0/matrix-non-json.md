# Cliente-0 Non-JSON Coverage Matrix

Questo file serve come matrice separata per i casi che non devono vivere nei flow JSON tecnici.

Regola di lettura:
- `Router` = il caso dipende soprattutto da classificazione, estrazione fatti, reset o routing
- `Conversation History` = il caso dipende soprattutto dalla voce cliente, raccolta dati o risposta FAQ
- `Policy/FAQ source` = il caso e' corretto solo se esiste una fonte dati o una regola business affidabile
- `Gap` = manca una regola chiara, una fonte, oppure il comportamento e' ancora troppo implicito

La fonte principale per i casi e':
- `docs/cliente-0/pdf/`
- `docs/cliente-0/flows/escenario.md`
- `docs/cliente-0/flows/demo.md`
- `docs/cliente-0/flows/achitecture.md`
- `docs/cliente-0/flows/prompt1-router.md`
- `docs/cliente-0/flows/prompt3-history.md`

---

## Scope Of This Matrix

Questa matrice traccia i casi che devono stare fuori dai JSON tecnici, per esempio:
- FAQ generiche
- policy operative
- raccolta dati minima
- escalation non tecniche
- riavvio conversazione
- cambio contesto durante un flow attivo

Questa matrice non sostituisce la matrice tecnica.
La matrice tecnica resta in:
- `docs/cliente-0/matrix.md`

---

## Router-Owned Non-JSON Cases

| Case | Source | Expected owner | Current coverage | Notes |
|---|---|---|---|---|
| Greeting only | Demo, architecture | Router -> Conversation History | Covered | Router classifies greeting, History writes it |
| Generic FAQ intent detection | Architecture, router prompt | Router | Covered | Router classifies, does not answer |
| Missing machine type | Scenarios, architecture | Router -> Conversation History | Covered | Missing fact contract is documented |
| Missing machine number | Scenarios, architecture | Router -> Conversation History | Covered | Missing fact contract is documented |
| Missing location | Playbook, architecture | Router -> Conversation History | Covered | Needed for safe diagnosis and manual review |
| Missing payment status | PDFs, architecture | Router -> Conversation History | Covered | Listed in router fact extraction |
| Missing display state | PDFs, architecture | Router -> Conversation History | Covered | Listed in router fact extraction |
| Customer asks for operator directly | Playbook | Router | Covered | `contactOperator(reason)` is explicit |
| Customer asks to restart | Architecture | Router | Covered | `resetSession()` is explicit |
| Customer changes machine type mid-flow | Scenario examples, architecture | Router | Covered | `resetSession()` is explicit |
| Customer changes machine number mid-flow | Architecture | Router | Covered | `resetSession()` is explicit |
| Unsafe / angry / inconsistent case | Playbook, router prompt | Router | Covered | Escalation rule is explicit |
| Fraud or payment inconsistency detection | Playbook | Router + manual review | Partial | Rule exists, but review wording and data checklist should be made more explicit |
| Change returned / not returned by central unit | Playbook | Router -> specialist or operator | Partial | Extracted in architecture, but handling path is still only implicit |
| Extra time added / not added | Playbook | Router -> specialist or operator | Partial | Extracted in router schema, but non-JSON business path is not formalized |

---

## Conversation History / FAQ Cases

| Case | Source | Expected owner | Current coverage | Notes |
|---|---|---|---|---|
| Final greeting wording | Demo, history prompt | Conversation History | Covered | Explicitly owned by History |
| Ask one missing question only | Architecture, history prompt | Conversation History | Covered | Explicit rule |
| Final FAQ wording | History prompt | Conversation History + FAQ source | Covered | Prompt ownership is clear |
| Prices | Demo, playbook | Conversation History + FAQ source | Partial | Correct only if FAQ source is complete and current |
| Opening hours | Demo, playbook | Conversation History + FAQ source | Partial | Depends on FAQ source |
| Invoice request | Playbook | Conversation History + FAQ/policy source | Partial | Source content not validated here |
| Loyalty card questions | Playbook | Conversation History + FAQ/policy source | Partial | Source content not validated here |
| No foam reassurance | Washer PDF | Conversation History + FAQ source | Partial | Correctly outside JSON, but needs confirmed FAQ wording |
| Occupied machine by another customer | PDFs | Conversation History + policy source | Partial | Needs explicit policy wording |
| Calm escalation wording | Playbook, history prompt | Conversation History | Covered | Explicitly documented |
| Restart wording after reset | Architecture, history prompt | Conversation History | Covered | Explicitly documented |
| Manual review wording for inconsistent payments | Playbook, history prompt | Conversation History | Covered | Prompt says do not accuse, say manual review |
| Multilingual final response | Scenario example | Conversation History | Partial | Architecture supports it, but this pure FLOW set does not define the translation/runtime layer |

---

## Policy / Business Cases Outside Technical JSON

| Case | Source | Expected owner | Current coverage | Notes |
|---|---|---|---|---|
| Double charge | Playbook | Router + Conversation History + operator policy | Partial | Must not be solved by technical JSON |
| Refund request | Playbook | Router + Conversation History + operator policy | Partial | Needs explicit operator/policy source |
| Compensation decision | Playbook | Operator policy | Gap | Current prompts correctly avoid promising compensation, but policy source is not formalized here |
| Fraud review (`10€` inconsistency) | Playbook | Router + operator review | Partial | Needs a clearer evidence checklist |
| Card proof / payment proof collection | Playbook | Router + Conversation History | Partial | Fields exist in router schema, but collection flow is not documented as a dedicated path |
| Card last 4 digits collection | Playbook | Router + Conversation History | Partial | Same as above |
| Manual review after business exception | Playbook | Conversation History + operator workflow | Partial | Wording exists, workflow detail does not |

---

## Contract / Conversation Safety Cases

| Contract need | Expected owner | Current coverage | Notes |
|---|---|---|---|
| Router never answers as final voice | Router | Covered | Explicit in architecture and router prompt |
| Conversation History is the only visible voice | Conversation History | Covered | Explicit in architecture and history prompt |
| Specialists do not answer like humans | Specialists | Covered | Explicit in specialist prompts |
| One question per message | Conversation History | Covered | Explicit rule |
| No invented policies | Conversation History | Covered | Explicit rule |
| No invented troubleshooting | Conversation History | Covered | Explicit rule |
| Structured handoff with missing facts | Router | Covered | Explicit contract |
| Context switch resets active flow safely | Router | Covered | Explicit reset rule |
| FAQ answer must come from source, not invention | Conversation History + FAQ source | Covered | Prompt rule is explicit |

---

## Current Verdict

- The technical and non-technical domains are now separated more cleanly.
- The non-JSON ownership model is conceptually aligned with the FLOW architecture.
- The main remaining risk is not architectural confusion anymore, but incomplete policy/FAQ source validation.
- Production confidence for non-JSON cases still depends on turning these rows into executable conversational tests.

---

## Next Suggested Updates

1. Add an explicit evidence checklist for double charge, refund, and fraud-review cases.
2. Validate that the real FAQ source contains prices, hours, invoices, loyalty card, and occupancy-policy answers.
3. Create a local Node simulator that tests both `matrix.md` and `matrix-non-json.md` against the FLOW architecture.