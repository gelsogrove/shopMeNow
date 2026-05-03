# Cases coverage

Mapping of every case in [`01usecases.md`](./01usecases.md) to the implementation artifact that handles it.

Legend:
- ✅ — covered by deterministic guard / json / FAQ + tests passing
- ⚠️ — partially covered (LLM-dependent or test gap)
- ❌ — not implemented

## Technical incidents

| # | Case | Source of reply | Test file |
|---|---|---|---|
| ✅ 1 | PUSH PROG | JSON `lavatrice_hs60xx.json` (case_push) → flow-engine | `11-push-prog.test.spec.ts` |
| ✅ 2 | DOOR | JSON flow + `guardPostInstructionFailure` for escalation | `07-door.test.spec.ts` |
| ✅ 3 | SEL | JSON flow + `guardPostInstructionFailure` | `08-sel.test.spec.ts` |
| ✅ 4 | He pagado, no se ha activado, no cambio | JSON flow `case_paid_no_change` | `04-flujo-general.test.spec.ts` |
| ✅ 5 | AL001 | `guardCaso5Al001AskBefore` + LLM cause-tracking | `10-al001.test.spec.ts` |
| ✅ 6 | Doble cobro (uso ok) | 4 sequential guards `guardCaso6*` | `14-doble-pago.test.spec.ts` |
| ✅ 7 | He pagado, no he podido usar | `guardCaso7AskCambio` + `guardCaso7AwaitDisplay` | `12-pagado-no-usado.test.spec.ts` |
| ⚠️ 8 | Código de importe menor | LLM + FAQ `discountCode` | (no dedicated test) |
| ⚠️ 9 | Quiero una factura | LLM + FAQ `invoiceRequest` | (no dedicated test) |
| ✅ 10 | Tarjeta de fidelización | `guardCaso10Tarjeta` + FAQ + location override | `15-tarjeta-fidelizacion.test.spec.ts` |
| ⚠️ 11 | Recargar tarjeta | LLM + FAQ override | (no dedicated test) |
| ✅ 12 | Horarios y precios | `guardCaso12Horarios` (with L'Escala exception) | `26-context-switch.test.spec.ts` (also covers FAQ-during-flow) |
| ✅ 13 | Escalado por código alarma | `guardEscalateUnknownDisplay` for ALN/ALM/001 | `17-aln.test.spec.ts` |
| ✅ 14 | ALM DOOR | `guardCaso14AlmDoor` + `guardCaso14AlmDoorEscalate` | `18-alm-door.test.spec.ts` |
| ✅ 15 | 001 | `guardEscalateUnknownDisplay` (001→AL001 via `extractDisplayState`) | `19-001.test.spec.ts` |
| ✅ 16 | ALM/ALN family | `guardEscalateUnknownDisplay` | `17-aln.test.spec.ts` |
| ✅ 17 | Cliente no sabe pantalla | `guardCaso17AskPhoto` + `guardCaso17NoPhoto` | `20-no-pantalla-foto.test.spec.ts` |
| ✅ 18 | Código solo numérico | `guardNumericCodeAskLetters` + `guardNumericCodeNoLetters` | `30-codigo-numerico.test.spec.ts` |
| ✅ 19 | Datáfono 10€ Goya | `guardEscalateNonTroubleshooting` + auto extract `nonTroubleshootingIncident=datafono-wrong-amount` | `16-fraude-incoherencia.test.spec.ts` |
| ✅ 20 | Datáfono 10€ Pineda | same as 19 | `16-fraude-incoherencia.test.spec.ts` |
| ✅ 21 | Alemanya monedas | DRYER_MINUTES_TOPIC → escalation | `locations/alemanya/21-monedas-secadora.test.spec.ts` |
| ✅ 22 | Pineda monedas | same as 21 | `locations/pineda/22-monedas-secadora.test.spec.ts` |
| ✅ 23 | Alemanya no tarjeta | CARD_FAIL_TOPIC → escalation | `locations/alemanya/23-no-tarjeta.test.spec.ts` |
| ✅ 24 | Hortes no tarjeta | same as 23 | `locations/hortes/24-no-tarjeta.test.spec.ts` |

## Cross-cutting

| # | Case | Source of reply | Test file |
|---|---|---|---|
| ✅ 25 | Cliente enfadado | `guardCaso25Empathic` (regex `!!` + angry words) | `24-enfadado.test.spec.ts` |
| ✅ 26 | Exige devolución | `guardCaso26Refund` (step 1 ask data, step 2 escalate) | `25-devolucion.test.spec.ts` |
| ✅ 27 | Compensación concreta | `guardCaso26Refund` (compensation-demand) | `27-compensacion.test.spec.ts` |
| ✅ 28 | Relato contradictorio | `guardCaso28Contradictory` | `28-relato-contradictorio.test.spec.ts` |
| ✅ 29 | Cámaras / AJAX | `guardEscalateNonTroubleshooting` (cameras-or-ajax) | `29-camaras-ajax.test.spec.ts` |
| ✅ 30 | Código no documentado | `extractDisplayState` accepts ERR\d+ → `guardEscalateUnknownDisplay` | `31-codigo-no-doc.test.spec.ts` |
| ✅ 31 | Cliente no indica local | `guardCaso31InsistLocation` | `32-no-local.test.spec.ts` |
| ✅ 32 | Mezcla incidencia + pago | LLM with reglas | `33-mezcla.test.spec.ts` |

## Multi-language welcome

| Test | Coverage |
|---|---|
| ✅ Welcome ES | `01-welcome.test.spec.ts` (only Spanish enabled per `settings.json`) |
| ✅ Tenant lock | `01.1-only-spanish.test.spec.ts` (Italian input → Spanish reply) |

## Mataró street

| Test | Coverage |
|---|---|
| ✅ `guardMataroStreet` fires | `03-mataro.test.spec.ts` + `03.1-implicit.test.spec.ts` |

## Implicit gather (no display known)

| Test | Coverage |
|---|---|
| ✅ Force machine type | `guardForceMachineType` after location |
| ✅ Force machine number | `guardForceMachineNumber` after location+type |
| ✅ Force display | `guardForceDisplay` after location+type+number |

## What's NOT covered

- **Caso 8** (código importe menor) — no dedicated test, LLM-dependent
- **Caso 9** (quiero factura) — no dedicated test, LLM hits FAQ `invoiceRequest`
- **Caso 11** (recargar tarjeta) — no dedicated test, LLM hits FAQ override
- **Photo upload binary handling** — not part of CLI demo
- **Real WhatsApp integration** — out of scope for this folder
- **Multilingual coverage of guards** — guards are written in 6 languages via `t()` but only Spanish runs in tests because `enabledLanguages: ["es"]`

## How to add coverage for a new case

1. Read the case in [`01usecases.md`](./01usecases.md) — note the canonical reply phrases.
2. If the case has a deterministic canned reply → add a guard in `utils/agent-guards.ts` and a translation key in `utils/localization.ts`.
3. If the case is a step-by-step technical flow → add it to `json/lavatrice_hs60xx.json` (or dryer JSON) under the relevant `flowId`.
4. If the case is a FAQ → add a key to `json/faqs.json` and (if needed) a per-location override in `json/locations.json`.
5. Add a `__tests__/agent/NN-slug.test.spec.ts` with at least one `expectMentionsAll` matching a doc phrase.
6. `npm run test:agent` and update this file.
