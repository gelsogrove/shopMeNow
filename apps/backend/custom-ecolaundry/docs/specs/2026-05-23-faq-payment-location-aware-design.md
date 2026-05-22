# Design — FAQ Payment location-aware (boundary signals: cardOnly + tpvExact)

**Data**: 2026-05-23
**Autore**: Claude + Andrea (brainstorming + skill chatbot-eval)
**F-number**: F87 (assegnato dopo review)
**Stato**: DESIGN — in attesa di approvazione + implementation plan
**Scope**: AD1 (minimum essential) — vedi `## Decisioni di scope` per AD2/AD3 trackati come pending refactor

## 1. Problema

Quando il cliente chiede al bot informazioni sui prezzi (FAQ Caso 12.2), il reply attuale mostra solo la lista prezzi delle macchine — ma il CSV `preus.csv` contiene **due informazioni operative critiche** che il bot oggi NON comunica al cliente:

1. **Pagamento accettato per location**: Hortes/Alemanya/Goya/Pineda accettano "Monedes, Bitllets, targeta fidelització i targeta de crèdit"; **L'Escala + Platja d'Aro accettano SOLO targeta de crèdit**. Cliente che arriva a L'Escala con monete spreca il viaggio → reclamo + escalation operatore.

2. **TPV importo esatto**: Goya cobra "Preu 7€" esatto, Pineda "Preu 8€" esatto, le altre 4 "Preu exacte" (senza importo fisso). Cliente che paga con monete da 1€ ma il programma costa 7€, può inserire 8€ pensando "tanto mi dà il resto" — il TPV NON restituisce → cliente perde 1€ → reclamo + escalation 6.x (datafono-wrong-amount).

Entrambi sono **boundary signals critici** documentati nel CSV ma silenziati nell'UX bot.

## 2. Evidenza reale del bug

Live MIX 3 test (Andrea, 2026-05-22, skill chatbot-eval):

```
👤 USER: me han cobrado 2 veces
🤖 BOT:  ¿En qué pueblo se encuentra la lavandería?
👤 USER: Goya
🤖 BOT:  ¿Has logrado lavar o secar la ropa?
👤 USER: no
🤖 BOT:  [escalation]
         Briefing operatore: "datafono-wrong-amount"
```

Il pattern reale (radice del reclamo del cliente) era: Goya ha TPV 7€ esatto, il cliente ha pagato 8€ in contanti, il TPV gli ha trattenuto tutto. Il bot non aveva mai avvisato. F87 chiude questo gap **a monte**, prima che il cliente arrivi all'escalation.

## 3. Architettura (5 layer, dove tocchiamo)

```
L0 DATA           json/locations.json:metadata.payment        ← NUOVO oggetto per location
L1 DATA SOURCE    docs/csv/preus.csv                          ← INVARIATO (fonte di verità)
L2 STATE          —                                            ← INVARIATO
L3 FORMATTER      utils/faq-location-formatter.ts             ← ESTESO (+readPayment + 2 append helpers)
L4 GUARD          utils/guards/faq-prices.ts                  ← INVARIATO (riusa formatter)
L4 BRANCH HANDLER utils/branches/faq/handler.ts               ← INVARIATO (delegate-to-legacy già esiste)
L5 i18n           json/i18n/*.json × 6                        ← +2 chiavi (paymentCardOnly, paymentTpvExact)
L5 CLEANUP        json/i18n/*.json × 6 + json/faqs.json       ← rimuovere pricingDeflect (dead code)
```

**Layer impact**: solo L0 (dati) + L3 (formatter) + L5 (i18n). Zero impatto su state/guard/branch/router.

**Pattern di riferimento**: identico a F50 (`pricing`/`openingHours`/`programs` data-driven via `metadata`) e F81 (programmi per location). NON inventiamo un nuovo pattern.

## 4. Schema dati

### 4.1 Nuovo campo `metadata.payment`

Per OGNI delle 6 location in `json/locations.json`:

```json
"<LocationKey>": {
  "metadata": {
    "hours": "...",
    "machines": { ... },
    "programs": { ... },
    "landmarks": [ ... ],
    "extras": { ... },
    "payment": {
      "methods": ["coins", "bills", "fidelity", "card"] | ["card"],
      "tpvExact": null | 7 | 8
    }
  }
}
```

### 4.2 Valori per location (dal CSV)

| Location | `payment.methods` | `payment.tpvExact` | Fonte CSV |
|---|---|---|---|
| Hortes | `["coins","bills","fidelity","card"]` | `null` | "Preu exacte" + "Monedes, Bitllets, targeta fidelització i targeta de crèdit" |
| Alemanya | `["coins","bills","fidelity","card"]` | `null` | idem (preu exacte ma no fisso) |
| Goya | `["coins","bills","fidelity","card"]` | `7` | "Preu 7€" + tutti i metodi |
| Pineda | `["coins","bills","fidelity","card"]` | `8` | "Preu 8€" + tutti i metodi |
| L'Escala | `["card"]` | `null` | "Targeta de crèdit" (sola colonna pagamento) |
| Platja d'Aro | `["card"]` | `null` | "Targeta de crèdit" (sola colonna pagamento) |

### 4.3 Convenzione `methods`

- `"coins"` = monete
- `"bills"` = banconote (Bitllets)
- `"fidelity"` = tarjeta de fidelidad (loyalty card)
- `"card"` = tarjeta de crédito (TPV)

Set chiuso, validato al boot (vedi §7 validation).

### 4.4 Convenzione `tpvExact`

- `null` = TPV accetta qualsiasi importo (resta documentato "preu exacte" ma senza valore fisso)
- numero positivo (es. `7`, `8`) = TPV cobra ESATTAMENTE quell'importo (senza resto)

## 5. i18n keys (6 lingue)

### 5.1 `paymentCardOnly` (boundary critico per L'Escala + Platja d'Aro)

| Lang | Valore |
|---|---|
| es | `⚠️ En esta lavandería solo se acepta tarjeta de crédito.` |
| it | `⚠️ In questa lavanderia si accetta solo carta di credito.` |
| en | `⚠️ This laundromat accepts credit card only.` |
| ca | `⚠️ En aquesta bugaderia només s'accepta targeta de crèdit.` |
| pt | `⚠️ Esta lavandaria aceita apenas cartão de crédito.` |
| fr | `⚠️ Cette laverie accepte uniquement la carte de crédit.` |

### 5.2 `paymentTpvExact` (boundary critico per Goya + Pineda) — con placeholder `{amount}`

| Lang | Valore |
|---|---|
| es | `💡 El TPV cobra el importe exacto de **{amount}€** (no devuelve cambio).` |
| it | `💡 Il POS preleva l'importo esatto di **{amount}€** (non dà resto).` |
| en | `💡 The card terminal charges the exact amount of **{amount}€** (no change given).` |
| ca | `💡 El TPV cobra l'import exacte de **{amount}€** (no torna canvi).` |
| pt | `💡 O TPV cobra o valor exato de **{amount}€** (sem troco).` |
| fr | `💡 Le TPV prélève le montant exact de **{amount}€** (pas de monnaie rendue).` |

Placeholder `{amount}` sostituito dal formatter a runtime con `payment.tpvExact`.

## 6. Estensione formatter L3

### 6.1 Nuovi helper privati in `utils/faq-location-formatter.ts`

```typescript
interface PaymentInfo {
  methods: ('coins' | 'bills' | 'fidelity' | 'card')[]
  tpvExact: number | null
}

function readPayment(runtime: Runtime, locationKey: string): PaymentInfo | null {
  const loc = runtime.locations?.locations?.[locationKey]
  return (loc?.metadata?.payment as PaymentInfo | undefined) ?? null
}

function formatPaymentSignals(
  payment: PaymentInfo,
  translateFn?: PriceTranslateFn,
): string {
  if (!translateFn) return ''
  const lines: string[] = []
  // 1. cardOnly (priorità alta — boundary signal gravità maggiore)
  if (payment.methods.length === 1 && payment.methods[0] === 'card') {
    lines.push(translateFn('paymentCardOnly'))
  }
  // 2. tpvExact (priorità medium — boundary signal economico)
  if (payment.tpvExact !== null && payment.tpvExact !== undefined) {
    lines.push(
      translateFn('paymentTpvExact').replace('{amount}', String(payment.tpvExact)),
    )
  }
  return lines.length > 0 ? `\n\n${lines.join('\n\n')}` : ''
}
```

### 6.2 Modifica `formatWasherPrices` / `formatDryerPrices`

Le funzioni esistenti già ricevono `runtime` e già hanno accesso a `locationKey`. Aggiungo:

1. Nuovo parametro opzionale `translateFn?: PriceTranslateFn` (già usato da `formatHours`).
2. Append della stringa `formatPaymentSignals(...)` alla fine del reply, condizionalmente.

```typescript
export function formatWasherPrices(
  locationKey: string,
  runtime: Runtime,
  translateFn?: PriceTranslateFn,  // ← già opzionale come in formatHours
): string | null {
  const machines = readMachines(runtime, locationKey)
  if (!machines?.washers || machines.washers.length === 0) return null
  const displayName = readDisplayName(runtime, locationKey)
  const groups = groupBySpecs(machines.washers)
  const lines = groups.map((g) => formatGroupLine(g, 'Lavadoras'))
  const base = `En ${displayName}, los precios de lavadora son:\n\n${lines.join('\n')}`

  // F87 — append boundary payment signals if available
  const payment = readPayment(runtime, locationKey)
  if (payment && translateFn) {
    return base + formatPaymentSignals(payment, translateFn)
  }
  return base
}
```

Stesso per `formatDryerPrices`.

### 6.3 Aggiornamento caller in `guards/faq-prices.ts`

Il guard già costruisce `translateFn` per `formatHours` (vedi `guards/faq-hours.ts` come reference). Devo passare lo stesso `translateFn` ai 2 formatter prezzi:

```typescript
const lng = lang(ar)
const translateFn: PriceTranslateFn = (key) => t(key as any, lng)
const formatted = formatWasherPrices(loc, ar.runtime, translateFn)
```

**Backwards compat**: il parametro `translateFn` è opzionale. I test esistenti che chiamano `formatWasherPrices(loc, runtime)` senza translateFn continuano a funzionare — non appendono i nuovi signal (graceful fallback).

## 7. Validation al boot (opzionale ma raccomandato)

Estendere `utils/runtime.ts:validateSettings` (o nuovo `validateLocations`) per verificare:

- Per ogni location, `metadata.payment.methods` esiste e è non-vuoto
- Ogni elemento di `methods` è in `{coins, bills, fidelity, card}`
- Se `tpvExact !== null`, è un numero positivo intero

Fail-fast al boot se manca. Rispetta iron rule #7 "settings are law" estesa al metadata.

**Decisione di scope**: includere validation in AD1 sì/no? Andrea decide nella review.

## 8. Cleanup dead code

### 8.1 i18n `pricingDeflect`

Rimuovere la chiave `pricingDeflect` da tutti i 6 cataloghi (`es.json`, `it.json`, `en.json`, `ca.json`, `pt.json`, `fr.json`). Nessun guard la usa più (verificato con grep: solo riferimenti in JSON, nessun consumatore TS).

### 8.2 `faqs.json:pricing`

Il valore attuale è una stringa deflective ES-only (`"Los precios dependen de la lavandería..."`). Non viene mai consumata perché `faqHandler` delega `pricing` al legacy guard (vedi `branches/faq/handler.ts:86`). Due opzioni:

- **8.2a**: rimuovere la chiave `pricing` da `faqs.json` (cleanup pulito)
- **8.2b**: lasciarla come safety-net (nel caso il delegate-to-legacy fallisse per qualche motivo edge)

**Raccomandazione**: 8.2a — il delegate è il pattern stabilito, non serve safety-net duplicato. Se domani la routing rompesse, il pin F82 in `f-log-regression.test.ts` fallirebbe immediatamente.

## 9. Test (sibling + F-log pin)

### 9.1 Sibling unit test esteso

File: `__tests__/unit/faq-location-formatter.test.ts` (esistente, estendo)

Nuovi pin:
- **Goya washer**: include `💡 El TPV cobra el importe exacto de **7€**`
- **Goya dryer**: include `💡 ... **7€**` (boundary signal vale per entrambi i tipi)
- **Pineda washer**: include `💡 ... **8€**`
- **Pineda dryer**: include `💡 ... **8€**`
- **L'Escala washer**: include `⚠️ ... solo se acepta tarjeta de crédito` AND non include "TPV exacto"
- **L'Escala dryer**: idem
- **Platja d'Aro washer**: include `⚠️ ... solo se acepta tarjeta de crédito`
- **Platja d'Aro dryer**: idem
- **Hortes washer baseline**: NON include né cardOnly né tpvExact
- **Alemanya washer baseline**: NON include né cardOnly né tpvExact
- **Backwards compat**: chiamata senza `translateFn` (legacy) non crasha, non appende signal
- **Backwards compat**: location senza `metadata.payment` non crasha, non appende signal

Stima: ~12 nuovi pin.

### 9.2 F-log pin in `f-log-regression.test.ts`

Pin F87 (3 marker):
- `paymentCardOnly` esiste in 6 cataloghi i18n con `⚠️`
- `paymentTpvExact` esiste in 6 cataloghi i18n con placeholder `{amount}`
- `locations.json` ha `metadata.payment` popolato per Goya/Pineda/L'Escala/PlatjaDAro/Hortes/Alemanya (6 location)

### 9.3 Coverage 6 lingue

Multi-lang test su entrambe le i18n keys (un caso per lingua su Goya `formatWasherPrices` con `translateFn` ES/IT/EN/CA/PT/FR → asserzione su wording localizzato).

## 10. Docs aggiornati

### 10.1 `docs/usecases.md §12.2`

Nuovo criterio:
> "Boundary signals critici: il bot DEVE includere nell'output dei prezzi un avviso `paymentCardOnly` quando `metadata.payment.methods === ['card']` (L'Escala, Platja d'Aro), e un avviso `paymentTpvExact` quando `metadata.payment.tpvExact !== null` (Goya 7€, Pineda 8€). Posizione: dopo la lista prezzi, prima del dryer/washer hint."

Aggiornare i 6 dialoghi esistenti del §12.2 con esempi aggiornati (Goya con TPV avviso, L'Escala con cardOnly avviso).

### 10.2 `docs/csv/tables.md`

Riga "Metodi di pagamento" passa da **80% → 100%**. Aggiunta nota:

> F87 — il dato CSV "Cobrament datáfon" + colonna pagamento di `preus.csv` è ora **comunicato al cliente** via `metadata.payment` (cardOnly + tpvExact) + 2 i18n keys 6-lang. Single source of truth: CSV. Pattern identico a F50/F81 (data-driven).

### 10.3 `CLAUDE.md` F-log entry F87

Schema standard (sintomo / root cause / fix architetturale / pattern preservativo).

## 11. Tracked refactor per AD2 / AD3

Aggiungere in `CLAUDE.md § Pending refactors` tabella:

| ID | Refactor | Trigger | Where to start |
|---|---|---|---|
| **B6** | AD2 — estendere FAQ prices con `metadata.extras` esistente (aclarado/lavado 1€ per L'Escala+PlatjaDAro) + extended tier dryer L'Escala (5€/25min via `dryers[].extended` esistente) | Primo cliente in produzione che chiede "c'è extra cost?" o "5€ programma?" | `metadata.extras` già esiste; serve solo estendere `formatWasherPrices`/`formatDryerPrices` per esporli condizionalmente |
| **B7** | AD3 — risolvere `weightKg: null` per Goya secadoras S1/S2/S3 | Telefonata operatore Olga / proprietà Goya per ottenere il dato fisico | Solo data fix in `locations.json:metadata.machines.dryers[].weightKg`, no code change |
| **B8** | F87 — validation al boot per `metadata.payment` (verificare che per ogni location esistano `methods` non-vuoto + `methods` set chiuso `{coins,bills,fidelity,card}` + `tpvExact` null o int positivo) | Se in produzione succede che qualcuno editi `locations.json` malformato e il bot fallisce silenziosamente in formatPaymentSignals | Estendere `utils/runtime.ts:validateSettings` o creare `validateLocations` chiamato da `loadRuntime`. Fail-fast al boot, log esplicito |

## 12. Iron rules verificate

- ❌ No patch in `prompts/agent.txt` (rule #1)
- ❌ No inline state mutation (rule #4) — niente mutazioni state aggiunte
- ❌ No hardcoded phrase regex (rule #6) — nessun nuovo detector, riusiamo guard esistente
- ❌ No casoN ordinal (rule #9)
- ✅ 6 lingue su entrambe le i18n keys (rule #8)
- ✅ Sibling test obbligatorio (rule #5)
- ✅ F-log entry + pin (rule #11)
- ✅ Triple-update: usecases.md + sibling unit + F-log entry
- ✅ Data-driven: pattern identico a F50/F79/F81 (CSV → JSON metadata → format helper)
- ✅ No invented pattern: estensione di `metadata` esistente, nessun nuovo livello

## 13. Verifiche pre-commit pianificate

```bash
npm run typecheck                  → 0 errors
npm run test:unit                  → all pass + ~12 nuovi pin
bash scripts/check-architecture.sh → 6/6 green
node f-log-regression.test.ts      → +3 nuovi pin F87 = ~128/128 totale
npm run demo -- --batch '[scenario Goya/Pineda/LEscala/PlatjaDAro]'  → live verification
```

## 14. Scope summary

| Categoria | Item |
|---|---|
| File modificati | `json/locations.json` (+6 `metadata.payment`), `json/i18n/*.json` × 6 (+2 keys, -1 dead key), `json/faqs.json` (-1 dead key), `utils/faq-location-formatter.ts` (+readPayment + formatPaymentSignals + estensione di formatWasherPrices + formatDryerPrices), `utils/guards/faq-prices.ts` (pass translateFn ai 2 formatter), `__tests__/unit/faq-location-formatter.test.ts` (+~12 pin), `__tests__/unit/f-log-regression.test.ts` (+3 pin F87), `CLAUDE.md` (+F87 entry + B6/B7 pending refactor), `docs/usecases.md §12.2` (+criterio + dialoghi aggiornati), `docs/csv/tables.md` (+nota F87 + 80%→100%) |
| Nuove i18n keys | `paymentCardOnly`, `paymentTpvExact` × 6 lingue |
| Dead code rimosso | `pricingDeflect` (6 cataloghi), `faqs.json:pricing` (1 entry) |
| Effort | ~45 min implementazione + 10 min test + 5 min docs |
| Cross-Caso scope check | Non richiesto (estensione narrow di formatter esistente, no nuovo guard/branch/state) |

## 15. Decisioni risolte (Andrea, 2026-05-23, "ok")

1. **Validation al boot (§7)**: ❌ NON inclusa in AD1 — trackata come pending refactor `B8` (vedi §11). Mantiene scope minimo, validation può essere aggiunta in un secondo PR senza romper niente.
2. **`faqs.json:pricing` (§8.2)**: ✅ **8.2a** — rimuovere la chiave completamente. Il delegate-to-legacy è il pattern stabilito (F82) e non serve safety-net duplicato.
3. **Wording i18n (§5)**: ✅ OK come scritto.
4. **Ordine append signals**: ✅ cardOnly PRIMA di tpvExact (gravità decrescente).
