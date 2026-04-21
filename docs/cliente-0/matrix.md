# Cliente-0 Coverage Matrix

Questo file serve come matrice di copertura dei casi del cliente-0.

Checklist vincolante di conformita':
- `docs/cliente-0/compliance-checklist.md`

Regola di lettura:
- `JSON flow` = deve vivere nei flow tecnici guidati
- `Prompt/FAQ` = deve vivere fuori JSON, nei prompt e nella knowledge/FAQ
- `Gap` = manca o non e' ancora coperto bene

La fonte principale per i casi e':
- `docs/cliente-0/pdf/`
- `docs/cliente-0/flows/escenario.md`
- `docs/cliente-0/flows/demo.md`

---

## Why `KIT PROFIT PLUS / EXTRA` Exists In This Matrix

This need comes directly from the washer troubleshooting document.

Source document:
- `docs/cliente-0/pdf/SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf`

Extracted text:

> `VARIANTE PARA LAVANDERIAS CON KIT PROFIT PLUS`
>
> `Preguntar qué pone en el display, y si algún botón de EXTRA tiene la luz fija en vez de parpadeando.`
>
> `Es probable que el cliente (por error), u otra persona anteriormente haya pulsado el botón de EXTRA.`
>
> `En este caso, la máquina considera que falta dinero por meter para pagar el EXTRA.`
>
> `Si el cliente NO quiere el EXTRA: que pulse los botones de EXTRA que están marcados y seguir el protocolo de pasos de lavado.`
>
> `Si el cliente SÍ quiere el EXTRA: que introduzca el dinero restante.`

Why it matters:
- this is not a generic FAQ
- this is not only a prompt nuance
- this is a real washer troubleshooting branch described in the customer material
- if we ignore it, the washer flow can misdiagnose a valid payment/start problem

Current decision:
- keep it tracked as a real coverage gap until we add it to the washer flow JSON or to an equivalent washer-specific technical branch

---

## Washer Cases

| Case | Source | Expected owner | Current coverage | Notes |
|---|---|---|---|---|
| Washer does not start with `SEL` | PDF washers | JSON flow | Covered | In `lavatrice_hs60xx.json` |
| Washer does not start with `PUSH / Pr` | PDF washers | JSON flow | Covered | In `lavatrice_hs60xx.json` |
| Washer does not start with `DOOR` | PDF washers | JSON flow | Covered | In `lavatrice_hs60xx.json` |
| Washer does not start with `001 / AL001` | PDF washers, scenarios | JSON flow | Covered | In `lavatrice_hs60xx.json` |
| Washer alarm `ALM/A` | PDF washers | JSON flow | Covered | Added as explicit branch |
| Washer alarm `ALM/E` | PDF washers | JSON flow | Covered | Added as explicit branch |
| Washer alarm `ALM/DOOR` | PDF washers | JSON flow | Covered | Added as explicit branch |
| Washer alarm `ALM/VAr` | PDF washers | JSON flow | Covered | Escalation branch |
| Washer unknown `ALM/*` | PDF washers | JSON flow | Covered | Escalation branch |
| Washer `END + bAL` | PDF washers, scenarios | JSON flow | Covered | Explicit branch |
| Washer STOP pressed | PDF washers, scenarios | JSON flow | Covered | `stop_error` flow |
| Washer post-cycle wet clothes | PDF washers | JSON flow | Covered | Improved |
| Washer door locked after cycle | PDF washers, scenarios | JSON flow | Covered | Present in post-cycle |
| Low foam / no visible soap | PDF washers | Prompt/FAQ | Partial | Should stay outside JSON |
| Occupied washer from another customer | PDF washers | Prompt/FAQ | Partial | Policy case, not technical flow |
| KIT PROFIT PLUS / EXTRA button | PDF washers | JSON flow or specialist rule | Covered | Added explicit washer branch |
| Change returned / not returned by central unit | Playbook | Router + specialist + possible flow branch | Partial | Mentioned in architecture, not explicit in JSON |

---

## Dryer Cases

| Case | Source | Expected owner | Current coverage | Notes |
|---|---|---|---|---|
| Dryer does not start after payment | PDF dryers, scenarios | JSON flow | Covered | In `asciugatrice_ed340.json` |
| Dryer display off | PDF dryers | JSON flow | Covered | In `asciugatrice_ed340.json` |
| Dryer door issue | PDF dryers, scenarios | JSON flow | Covered | In `asciugatrice_ed340.json` |
| Money added but minutes do not increase | PDF dryers, playbook | JSON flow / escalation | Covered | Added explicit branch |
| Filter / filter-door warning | PDF dryers, scenarios | JSON flow | Covered | Added explicit branch |
| `FALLO DE ROTACION` | PDF dryers, scenarios | JSON flow | Covered | Added explicit branch |
| `FALLO DE ASPIRACION` | PDF dryers, scenarios | JSON flow | Covered | Added explicit branch |
| Clothes still damp after cycle | PDF dryers | JSON flow | Covered | Improved |
| Clothes soaking wet from washer | PDF dryers, scenarios | JSON flow | Covered | Added explicit branch |
| Dryer stopped mid-cycle / STOP | PDF dryers | JSON flow | Covered | Improved |
| Dryer door blocked after cycle | PDF dryers, scenarios | JSON flow | Covered | Added explicit branch |
| Burnt clothes | PDF dryers | JSON flow / escalation | Covered | Added explicit branch |
| Plastic stuck to clothes | PDF dryers | JSON flow / escalation | Covered | Added explicit branch |
| Stained clothes | PDF dryers | JSON flow / escalation | Covered | Added explicit branch |
| Strange smell from dryer | Scenarios, PDF dryers | JSON flow / escalation | Covered | Added explicit branch |
| Occupied dryer from another customer | PDF dryers | Prompt/FAQ | Partial | Policy case, not technical flow |

---

## Business / FAQ / Policy Cases

| Case | Source | Expected owner | Current coverage | Notes |
|---|---|---|---|---|
| Double charge | Playbook | Router + Conversation History + escalation policy | Partial | Not a JSON flow case |
| Refund request | Playbook | Router + Conversation History + policy | Partial | Not a JSON flow case |
| Invoice request | Playbook | Conversation History + FAQ source | Partial | Depends on FAQ content |
| Loyalty card | Playbook | Conversation History + FAQ source | Partial | Depends on FAQ content |
| Prices and opening hours | Playbook, demo | Conversation History + FAQ source | Partial | Depends on FAQ content |
| Fraud / inconsistency (`10€` at Goya/Pineda) | Playbook | Router + escalation | Partial | Must be covered by router rules |
| Machine occupied by other customer | PDFs | Conversation History + FAQ source | Partial | Policy, not JSON |
| No foam reassurance | PDF washers | Conversation History + FAQ source | Partial | Policy/FAQ, not JSON |

---

## Architecture Contract Cases

| Contract need | Expected owner | Current coverage | Notes |
|---|---|---|---|
| Extract location | Router | Covered | In architecture + router prompt |
| Extract machine type | Router | Covered | In architecture + router prompt |
| Extract machine number | Router | Covered | In architecture + router prompt |
| Extract display state | Router | Covered | In architecture + router prompt |
| Extract payment status | Router | Covered | In architecture + router prompt |
| Extract service completed / not completed | Router | Covered | In architecture + router prompt |
| Structured handoff to next layer | Router | Covered | Documented contract |
| Single customer-facing voice | Conversation History | Covered | Documented and prompted |
| Technical diagnosis without humanization | Specialists | Covered | Documented and prompted |

---

## Current Verdict

- The technical JSON coverage is much better than before.
- The biggest explicit technical gap previously identified, `KIT PROFIT PLUS / EXTRA` on washers, is now covered in the washer JSON flow.
- Several important customer cases are intentionally outside JSON and must be covered by Router + Conversation History + FAQ content.
- Production readiness still depends on validating the real runtime behavior with a simulator or end-to-end test harness.

---

## Next Suggested Updates

1. Use `docs/cliente-0/matrix-non-json.md` for Router + Conversation History + FAQ cases.
2. Create a local Node simulator to validate all matrix rows against the FLOW architecture.