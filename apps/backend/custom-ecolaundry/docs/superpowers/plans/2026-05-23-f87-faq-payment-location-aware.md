# F87 — FAQ Payment Location-Aware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere le FAQ prezzi del bot ecolaundry per comunicare al cliente 2 boundary signals critici per-location: "solo carta di credito" (L'Escala + Platja d'Aro) e "TPV richiede importo esatto X€" (Goya 7€, Pineda 8€), prendendo i dati dal CSV `preus.csv` e seguendo il pattern data-driven location-aware già stabilito in F50/F81.

**Architecture:** Estensione di `json/locations.json:metadata` con un nuovo campo `payment` (sotto stesso livello di `machines`/`programs`/`hours`/`landmarks`/`extras`). Il formatter L3 `utils/faq-location-formatter.ts` legge `metadata.payment` e appende 2 righe condizionali al reply di `formatWasherPrices`/`formatDryerPrices`. Nuove 2 chiavi i18n in 6 cataloghi (`paymentCardOnly`, `paymentTpvExact`). Zero modifiche a guard / branch / router / state. Cleanup dead code (`pricingDeflect` i18n, `faqs.json:pricing`). Pattern identico a F50/F81 — zero ruota reinventata.

**Tech Stack:** TypeScript, Node.js (tsx runner), regex-free formatter, JSON-driven config, sibling unit tests pattern `__tests__/unit/<name>.test.ts`.

**Reference spec:** [`docs/specs/2026-05-23-faq-payment-location-aware-design.md`](../../specs/2026-05-23-faq-payment-location-aware-design.md)

---

## File Structure

### Files to create
- None (tutto è estensione di file esistenti)

### Files to modify

| Path | Layer | Responsibility |
|---|---|---|
| `json/locations.json` | L0 | +6 nuovi blocchi `metadata.payment` (uno per location) |
| `json/i18n/es.json` | L5 | +2 chiavi (`paymentCardOnly`, `paymentTpvExact`); −1 chiave (`pricingDeflect`) |
| `json/i18n/it.json` | L5 | idem |
| `json/i18n/en.json` | L5 | idem |
| `json/i18n/ca.json` | L5 | idem |
| `json/i18n/pt.json` | L5 | idem |
| `json/i18n/fr.json` | L5 | idem |
| `json/faqs.json` | L5 | −1 chiave (`pricing` dead) |
| `utils/faq-location-formatter.ts` | L3 | +type `PaymentInfo`, +helper `readPayment`, +helper `formatPaymentSignals`, +parametro opzionale `translateFn?: ProgramTranslateFn` su `formatWasherPrices`/`formatDryerPrices` |
| `utils/guards/faq-prices.ts` | L4 | Costruisce `translateFn` con `t()` + `lang(ar)` e lo passa ai 2 formatter (3 call site: T1 `renderPrices`, T3 dryer-confirm, T3 washer-confirm). Zero altri cambiamenti |
| `__tests__/unit/faq-location-formatter.test.ts` | TEST | Estende fixture con 4 nuove location (Goya, Pineda, LEscala già esiste, Platja d'Aro già esiste, +Hortes, +Alemanya); +12 nuovi pin |
| `__tests__/unit/f-log-regression.test.ts` | TEST | +3 nuovi pin F87 |
| `CLAUDE.md` | DOC | +entry F87 nella tabella F-log; +B6/B7/B8 nella tabella Pending refactors |
| `docs/usecases.md` | DOC | §12.2 nuovo criterio + 2 dialoghi aggiornati (Goya con tpvExact, L'Escala con cardOnly) |
| `docs/csv/tables.md` | DOC | Riga "Metodi di pagamento" 80% → 100%, +nota F87 |

---

## Implementation Tasks

### Task 1: Add `metadata.payment` to all 6 locations in `locations.json`

**Files:**
- Modify: `apps/backend/custom-ecolaundry/json/locations.json` (6 blocchi, uno per location)

**Context:** Pattern dati identico a `metadata.machines`, `metadata.programs`, `metadata.landmarks`. Il blocco `payment` va inserito **dentro `metadata`** di ogni location, a fianco degli altri campi metadata. Valori derivati direttamente dal CSV `preus.csv`.

- [ ] **Step 1: Leggi il file per individuare la posizione esatta di ogni `metadata` per location**

Run: `grep -n "\"metadata\": {" apps/backend/custom-ecolaundry/json/locations.json`
Expected: 6 occorrenze (Goya, Pineda, L'Escala, Platja d'Aro, Hortes, Alemanya).

- [ ] **Step 2: Aggiungi `payment` a Goya**

Cerca il blocco `"Goya": { ... "metadata": { ... } }` e dentro `metadata` aggiungi DOPO `machines` (o dove preferisci nell'ordine, ma coerentemente per tutte le location):

```json
"payment": {
  "methods": ["coins", "bills", "fidelity", "card"],
  "tpvExact": 7
},
```

- [ ] **Step 3: Aggiungi `payment` a Pineda**

```json
"payment": {
  "methods": ["coins", "bills", "fidelity", "card"],
  "tpvExact": 8
},
```

- [ ] **Step 4: Aggiungi `payment` a L'Escala**

```json
"payment": {
  "methods": ["card"],
  "tpvExact": null
},
```

- [ ] **Step 5: Aggiungi `payment` a Platja d'Aro**

```json
"payment": {
  "methods": ["card"],
  "tpvExact": null
},
```

- [ ] **Step 6: Aggiungi `payment` a Hortes**

```json
"payment": {
  "methods": ["coins", "bills", "fidelity", "card"],
  "tpvExact": null
},
```

- [ ] **Step 7: Aggiungi `payment` a Alemanya**

```json
"payment": {
  "methods": ["coins", "bills", "fidelity", "card"],
  "tpvExact": null
},
```

- [ ] **Step 8: Verifica JSON validity**

Run: `cd apps/backend/custom-ecolaundry && node -e "JSON.parse(require('fs').readFileSync('json/locations.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 9: Verifica che tutte 6 le location abbiano `payment` non-empty**

Run: `cd apps/backend/custom-ecolaundry && node -e "const j=JSON.parse(require('fs').readFileSync('json/locations.json','utf8')); for (const [k,v] of Object.entries(j.locations.locations)) { const p = v.metadata && v.metadata.payment; console.log(k, '→', p ? JSON.stringify(p) : 'MISSING'); }"`
Expected:
```
Goya → {"methods":["coins","bills","fidelity","card"],"tpvExact":7}
Pineda → {"methods":["coins","bills","fidelity","card"],"tpvExact":8}
L'Escala → {"methods":["card"],"tpvExact":null}
PlatjaDAro → {"methods":["card"],"tpvExact":null}
Hortes → {"methods":["coins","bills","fidelity","card"],"tpvExact":null}
Alemanya → {"methods":["coins","bills","fidelity","card"],"tpvExact":null}
```
(L'ordine delle location può variare a seconda del file — l'importante è che tutte 6 abbiano un `payment` valido.)

- [ ] **Step 10: Commit**

```bash
git add apps/backend/custom-ecolaundry/json/locations.json
git commit -m "feat(F87): add metadata.payment to all 6 ecolaundry locations

Encodes payment.methods (coins/bills/fidelity/card subset) and
payment.tpvExact (null | int) for each laundromat. Data driven from
docs/csv/preus.csv. Pattern identical to F50/F81 (metadata.machines /
metadata.programs)."
```

---

### Task 2: Add 2 new i18n keys + remove `pricingDeflect` from 6 catalogues

**Files:**
- Modify: `apps/backend/custom-ecolaundry/json/i18n/es.json`
- Modify: `apps/backend/custom-ecolaundry/json/i18n/it.json`
- Modify: `apps/backend/custom-ecolaundry/json/i18n/en.json`
- Modify: `apps/backend/custom-ecolaundry/json/i18n/ca.json`
- Modify: `apps/backend/custom-ecolaundry/json/i18n/pt.json`
- Modify: `apps/backend/custom-ecolaundry/json/i18n/fr.json`

**Context:** Le 2 nuove chiavi vanno inserite vicino alle altre chiavi `prices*`/`payment*` esistenti (es. accanto a `pricesAsk`, `pricesDryerHint`, `pricesWasherHint`, `priceWarning`). Posizione esatta non critica (i18n è oggetto, non array). La chiave `pricingDeflect` è dead code (verificato con grep: nessun consumer TS) — rimuovere.

- [ ] **Step 1: Verifica che `pricingDeflect` sia davvero dead code**

Run: `cd apps/backend/custom-ecolaundry && grep -rn "pricingDeflect" utils/ models/ agent.ts index.ts`
Expected: NESSUN match. Se appare anche solo 1 match → STOP, non rimuovere la chiave, segnalare ad Andrea.

- [ ] **Step 2: Modifica `es.json`**

Aggiungere 2 chiavi (vicino a `priceWarning`):
```json
"paymentCardOnly": "⚠️ En esta lavandería solo se acepta tarjeta de crédito.",
"paymentTpvExact": "💡 El TPV cobra el importe exacto de **{amount}€** (no devuelve cambio).",
```

Rimuovere la riga `"pricingDeflect": "Tengo que revisarlo antes de confirmarte ese importe.",` se presente.

- [ ] **Step 3: Modifica `it.json`**

Aggiungere:
```json
"paymentCardOnly": "⚠️ In questa lavanderia si accetta solo carta di credito.",
"paymentTpvExact": "💡 Il POS preleva l'importo esatto di **{amount}€** (non dà resto).",
```

Rimuovere `"pricingDeflect": ...`.

- [ ] **Step 4: Modifica `en.json`**

Aggiungere:
```json
"paymentCardOnly": "⚠️ This laundromat accepts credit card only.",
"paymentTpvExact": "💡 The card terminal charges the exact amount of **{amount}€** (no change given).",
```

Rimuovere `"pricingDeflect": ...`.

- [ ] **Step 5: Modifica `ca.json`**

Aggiungere:
```json
"paymentCardOnly": "⚠️ En aquesta bugaderia només s'accepta targeta de crèdit.",
"paymentTpvExact": "💡 El TPV cobra l'import exacte de **{amount}€** (no torna canvi).",
```

Rimuovere `"pricingDeflect": ...`.

- [ ] **Step 6: Modifica `pt.json`**

Aggiungere:
```json
"paymentCardOnly": "⚠️ Esta lavandaria aceita apenas cartão de crédito.",
"paymentTpvExact": "💡 O TPV cobra o valor exato de **{amount}€** (sem troco).",
```

Rimuovere `"pricingDeflect": ...`.

- [ ] **Step 7: Modifica `fr.json`**

Aggiungere:
```json
"paymentCardOnly": "⚠️ Cette laverie accepte uniquement la carte de crédit.",
"paymentTpvExact": "💡 Le TPV prélève le montant exact de **{amount}€** (pas de monnaie rendue).",
```

Rimuovere `"pricingDeflect": ...`.

- [ ] **Step 8: Verifica JSON validity per tutti i 6 cataloghi**

Run: `cd apps/backend/custom-ecolaundry && for f in json/i18n/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done`
Expected: 6 righe `OK`.

- [ ] **Step 9: Verifica presenza delle 2 nuove chiavi in tutti i cataloghi**

Run: `cd apps/backend/custom-ecolaundry && for f in json/i18n/*.json; do echo -n "$f: "; node -e "const j=JSON.parse(require('fs').readFileSync('$f','utf8')); console.log(j.paymentCardOnly ? 'cardOnly OK' : 'MISSING', '|', j.paymentTpvExact ? 'tpvExact OK' : 'MISSING', '|', j.paymentTpvExact && j.paymentTpvExact.includes('{amount}') ? 'placeholder OK' : 'NO PLACEHOLDER');" ; done`
Expected: 6 righe con `cardOnly OK | tpvExact OK | placeholder OK`.

- [ ] **Step 10: Verifica che `pricingDeflect` sia stata rimossa**

Run: `cd apps/backend/custom-ecolaundry && grep "pricingDeflect" json/i18n/*.json`
Expected: NESSUN match.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/custom-ecolaundry/json/i18n/
git commit -m "feat(F87): add paymentCardOnly + paymentTpvExact i18n keys (6 langs)

- Add paymentCardOnly: '⚠️ ... only credit card ...' (6 langs)
- Add paymentTpvExact with {amount} placeholder: '💡 ... exact amount ...' (6 langs)
- Remove dead-code key pricingDeflect (no TS consumer, verified)"
```

---

### Task 3: Remove dead `pricing` entry from `faqs.json`

**Files:**
- Modify: `apps/backend/custom-ecolaundry/json/faqs.json`

**Context:** La chiave `pricing` in `faqs.json` ha valore deflective ES-only e non viene MAI consumata: `branches/faq/handler.ts:86` ha `if (faqKey === 'pricing' || ...) return delegate-to-legacy` PRIMA di leggere `getFaqs()[faqKey]`. Quindi rimuovere è safe. F82 pin garantisce che il delegate-to-legacy resta in piedi.

- [ ] **Step 1: Verifica che `getFaqs()['pricing']` non venga mai usato**

Run: `cd apps/backend/custom-ecolaundry && grep -rn "getFaqs.*pricing\|getFaqs()\[.pricing\|faqs.pricing" utils/ models/ agent.ts index.ts`
Expected: NESSUN match (i match attesi in `branches/faq/handler.ts` non chiamano `getFaqs()[pricing]` perché il `return delegate-to-legacy` precede).

- [ ] **Step 2: Rimuovi la riga `"pricing": ...` da `faqs.json`**

Cerca la riga (riga ~7 del file):
```json
"pricing": "Los precios dependen de la lavandería y de la máquina (lavadora o secadora). Dime en qué pueblo o lavandería estás y te paso la lista exacta. 🙂",
```

Rimuovila completamente. Attenzione alla virgola: se era l'ultima riga prima della `}`, togliere la virgola della riga precedente; se era nel mezzo, rimuovere solo questa riga.

- [ ] **Step 3: Verifica JSON validity**

Run: `cd apps/backend/custom-ecolaundry && node -e "JSON.parse(require('fs').readFileSync('json/faqs.json','utf8')); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 4: Verifica che la chiave sia rimossa**

Run: `cd apps/backend/custom-ecolaundry && node -e "const j=JSON.parse(require('fs').readFileSync('json/faqs.json','utf8')); console.log(j.pricing === undefined ? 'REMOVED OK' : 'STILL THERE');"`
Expected: `REMOVED OK`.

- [ ] **Step 5: Run typecheck (sanity check, non dovrebbe rompere niente)**

Run: `cd apps/backend/custom-ecolaundry && npm run typecheck`
Expected: 0 errori.

- [ ] **Step 6: Run unit tests esistenti**

Run: `cd apps/backend/custom-ecolaundry && npm run test:unit 2>&1 | tail -5`
Expected: tutti i test passano (nessuno usa `faqs.pricing`).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/custom-ecolaundry/json/faqs.json
git commit -m "chore(F87): remove dead-code faqs.json:pricing entry

The 'pricing' faqKey is intercepted by branches/faq/handler.ts:86
(delegate-to-legacy → guardFaqPrices) BEFORE getFaqs() lookup. Entry
was never consumed. Pattern stabilised by F82 pin in
f-log-regression.test.ts."
```

---

### Task 4: Write failing test — `readPayment` helper

**Files:**
- Modify: `apps/backend/custom-ecolaundry/__tests__/unit/faq-location-formatter.test.ts`

**Context:** TDD step 1 — scrivere il test per il nuovo helper `readPayment(runtime, locationKey)` PRIMA di implementarlo. Estendere la fixture esistente con location che hanno `metadata.payment` valorizzato in modi diversi (cardOnly, tpvExact, full methods, missing payment field).

- [ ] **Step 1: Aggiungi import del nuovo helper (sarà rosso finché non implementato)**

In cima a `__tests__/unit/faq-location-formatter.test.ts`, modifica l'import per includere `readPayment`:

```typescript
import {
  formatHours,
  formatWasherPrices,
  formatDryerPrices,
  // F87
  readPayment,
} from '../../utils/faq-location-formatter.js'
```

- [ ] **Step 2: Estendi la fixture con `metadata.payment` per le location esistenti + 2 location nuove**

Trova nella fixture il blocco `PlatjaDAro.metadata` e aggiungi (dentro `metadata`, dopo `machines`):

```typescript
payment: { methods: ['card'], tpvExact: null },
```

Trova `LEscala.metadata` e aggiungi:

```typescript
payment: { methods: ['card'], tpvExact: null },
```

Aggiungi 2 nuove location alla fixture per coverage Goya + Pineda + Hortes:

```typescript
Goya: {
  pueblo: 'Mataró',
  displayName: 'Goya',
  metadata: {
    hours: '8:00-22:00',
    machines: {
      washers: [
        { number: 'L4', weightKg: 20, fidelity: '6,5€', cash: '7€' },
      ],
      dryers: [
        { number: 'S1', weightKg: null, fidelity: '2€/15min', cash: '2€/15min' },
      ],
    },
    payment: { methods: ['coins','bills','fidelity','card'], tpvExact: 7 },
  },
},
Pineda: {
  pueblo: 'Pineda de Mar',
  displayName: 'Pineda',
  metadata: {
    hours: '8:00-22:00',
    machines: {
      washers: [
        { number: 'L1', weightKg: 10, fidelity: '4,5€', cash: '5€' },
      ],
      dryers: [
        { number: 'S4', weightKg: 20, fidelity: '2€/15min', cash: '2€/15min' },
      ],
    },
    payment: { methods: ['coins','bills','fidelity','card'], tpvExact: 8 },
  },
},
Hortes: {
  pueblo: 'Granollers',
  displayName: 'Hortes',
  metadata: {
    hours: '8:00-22:00',
    machines: {
      washers: [
        { number: 'L1', weightKg: 8, fidelity: '4€', cash: '5€' },
      ],
      dryers: [
        { number: 'S6', weightKg: 17, fidelity: '3€/15min', cash: '3€/15min' },
      ],
    },
    payment: { methods: ['coins','bills','fidelity','card'], tpvExact: null },
  },
},
NoPaymentLoc: {
  pueblo: 'Test',
  displayName: 'NoPaymentLoc',
  metadata: {
    hours: '8:00-22:00',
    machines: {
      washers: [{ number: 'L1', weightKg: 10, fidelity: '5€', cash: '5€' }],
    },
    // NO payment field — graceful fallback test
  },
},
```

- [ ] **Step 3: Aggiungi i test per `readPayment`**

In fondo al file di test (o nella sezione naturale), aggiungi:

```typescript
// ── F87: readPayment helper ──────────────────────────────────────────────
{
  name: 'F87 — readPayment returns PaymentInfo for cardOnly location',
  run: () => {
    const result = readPayment(runtime, 'PlatjaDAro')
    if (!result) throw new Error('readPayment must return PaymentInfo, got null')
    if (result.methods.length !== 1 || result.methods[0] !== 'card') {
      throw new Error(`F87: PlatjaDAro must be cardOnly, got methods=${JSON.stringify(result.methods)}`)
    }
    if (result.tpvExact !== null) {
      throw new Error(`F87: PlatjaDAro tpvExact must be null, got ${result.tpvExact}`)
    }
  },
},
{
  name: 'F87 — readPayment returns tpvExact=7 for Goya',
  run: () => {
    const result = readPayment(runtime, 'Goya')
    if (!result) throw new Error('readPayment must return PaymentInfo, got null')
    if (result.tpvExact !== 7) {
      throw new Error(`F87: Goya tpvExact must be 7, got ${result.tpvExact}`)
    }
    if (!result.methods.includes('coins') || !result.methods.includes('card')) {
      throw new Error(`F87: Goya methods must include coins+card, got ${JSON.stringify(result.methods)}`)
    }
  },
},
{
  name: 'F87 — readPayment returns null when payment field missing',
  run: () => {
    const result = readPayment(runtime, 'NoPaymentLoc')
    if (result !== null) {
      throw new Error(`F87: NoPaymentLoc has no payment field — readPayment must return null, got ${JSON.stringify(result)}`)
    }
  },
},
{
  name: 'F87 — readPayment returns null for unknown location',
  run: () => {
    const result = readPayment(runtime, 'NonExistentLocation')
    if (result !== null) {
      throw new Error(`F87: unknown location must return null, got ${JSON.stringify(result)}`)
    }
  },
},
```

- [ ] **Step 4: Run il test (deve fallire — helper non implementato)**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/faq-location-formatter.test.ts 2>&1 | head -30`
Expected: FAIL — errore tipo `Cannot find name 'readPayment'` oppure `readPayment is not a function`.

- [ ] **Step 5: Commit (test rosso che documenta il contratto del nuovo helper)**

```bash
git add apps/backend/custom-ecolaundry/__tests__/unit/faq-location-formatter.test.ts
git commit -m "test(F87): add failing tests for readPayment helper + payment fixture

Tests assert:
- readPayment returns PaymentInfo with methods + tpvExact
- Goya tpvExact=7, PlatjaDAro cardOnly, NoPaymentLoc returns null
Helper not yet implemented — RED state."
```

---

### Task 5: Implement `readPayment` helper

**Files:**
- Modify: `apps/backend/custom-ecolaundry/utils/faq-location-formatter.ts`

**Context:** Implementare il minimo necessario per far passare i test di Task 4. Pattern identico a `readMachines`/`readHours`/`readDisplayName` esistenti.

- [ ] **Step 1: Aggiungi il type `PaymentInfo` accanto agli altri type (vicino a `Machine`/`MachinesPayload`, riga ~18-27)**

Aggiungere DOPO `MachinesPayload`:

```typescript
// F87 — payment info per location (boundary signals)
export type PaymentMethod = 'coins' | 'bills' | 'fidelity' | 'card'
export type PaymentInfo = {
  methods: PaymentMethod[]
  tpvExact: number | null
}
```

- [ ] **Step 2: Implementa `readPayment` accanto agli altri reader (vicino a `readHours`, riga ~60)**

Aggiungere DOPO `readHours`:

```typescript
// F87 — read metadata.payment for a location.
// Returns null when:
//   - the location key does not resolve to any locations.json entry, OR
//   - the location exists but has no metadata.payment field.
// Caller is responsible for fallback behaviour (no append, no crash).
export function readPayment(runtime: Runtime, locationKey: string): PaymentInfo | null {
  const key = resolveLocationKey(runtime, locationKey)
  if (!key) return null
  const loc = runtime.locations.locations[key]
  if (!loc?.metadata) return null
  const payment = (loc.metadata as { payment?: PaymentInfo }).payment
  return payment ?? null
}
```

- [ ] **Step 3: Run il test (ora deve passare)**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/faq-location-formatter.test.ts 2>&1 | grep -E "F87 — readPayment"`
Expected: 4 righe verdi `✓ F87 — readPayment ...`.

- [ ] **Step 4: Run typecheck**

Run: `cd apps/backend/custom-ecolaundry && npm run typecheck`
Expected: 0 errori.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/custom-ecolaundry/utils/faq-location-formatter.ts
git commit -m "feat(F87): implement readPayment helper

Reads metadata.payment from locations.json. Returns PaymentInfo
({methods, tpvExact}) or null. Pattern identical to readMachines /
readHours. Iron rule #7 (settings are law)."
```

---

### Task 6: Write failing tests — `formatPaymentSignals` + extended formatters

**Files:**
- Modify: `apps/backend/custom-ecolaundry/__tests__/unit/faq-location-formatter.test.ts`

**Context:** Test del comportamento integrato: `formatWasherPrices(loc, runtime, translateFn)` deve appendere `paymentCardOnly` quando `methods === ['card']`, e `paymentTpvExact` quando `tpvExact !== null`, con sostituzione di `{amount}`. Stesso per `formatDryerPrices`. Backwards compat: chiamata senza `translateFn` non appende niente.

- [ ] **Step 1: Aggiungi una mock `translateFn` per i test**

Sopra le test case, aggiungi un translate fn ES che restituisce le i18n stringhe attese (corrisponde a `es.json` post-Task 2):

```typescript
// F87 — minimal ES translate fn for testing (mirrors es.json keys).
const translateEsForTest = (key: string): string => {
  const dict: Record<string, string> = {
    paymentCardOnly: '⚠️ En esta lavandería solo se acepta tarjeta de crédito.',
    paymentTpvExact: '💡 El TPV cobra el importe exacto de **{amount}€** (no devuelve cambio).',
  }
  return dict[key] ?? `[missing key: ${key}]`
}
```

- [ ] **Step 2: Aggiungi i pin di integrazione**

```typescript
{
  name: 'F87 — formatWasherPrices appends cardOnly for PlatjaDAro',
  run: () => {
    const result = formatWasherPrices('PlatjaDAro', runtime, translateEsForTest)
    if (!result) throw new Error('formatWasherPrices must return non-null')
    if (!result.includes('solo se acepta tarjeta de crédito')) {
      throw new Error(`F87: PlatjaDAro reply must include cardOnly warning, got:\n${result}`)
    }
    if (result.includes('TPV cobra el importe exacto')) {
      throw new Error(`F87: PlatjaDAro has no tpvExact, must NOT include TPV warning`)
    }
  },
},
{
  name: 'F87 — formatWasherPrices appends tpvExact 7€ for Goya',
  run: () => {
    const result = formatWasherPrices('Goya', runtime, translateEsForTest)
    if (!result) throw new Error('formatWasherPrices must return non-null')
    if (!result.includes('El TPV cobra el importe exacto de **7€**')) {
      throw new Error(`F87: Goya reply must include tpvExact 7€, got:\n${result}`)
    }
    if (result.includes('solo se acepta tarjeta')) {
      throw new Error(`F87: Goya is NOT cardOnly, must NOT include cardOnly warning`)
    }
  },
},
{
  name: 'F87 — formatWasherPrices appends tpvExact 8€ for Pineda',
  run: () => {
    const result = formatWasherPrices('Pineda', runtime, translateEsForTest)
    if (!result) throw new Error('formatWasherPrices must return non-null')
    if (!result.includes('**8€**')) {
      throw new Error(`F87: Pineda reply must mention 8€, got:\n${result}`)
    }
  },
},
{
  name: 'F87 — formatWasherPrices Hortes baseline (no signals)',
  run: () => {
    const result = formatWasherPrices('Hortes', runtime, translateEsForTest)
    if (!result) throw new Error('formatWasherPrices must return non-null')
    if (result.includes('solo se acepta tarjeta') || result.includes('TPV cobra')) {
      throw new Error(`F87: Hortes has neither cardOnly nor tpvExact, must NOT include signals, got:\n${result}`)
    }
  },
},
{
  name: 'F87 — formatDryerPrices appends cardOnly for LEscala',
  run: () => {
    const result = formatDryerPrices('LEscala', runtime, translateEsForTest)
    if (!result) throw new Error('formatDryerPrices must return non-null')
    if (!result.includes('solo se acepta tarjeta de crédito')) {
      throw new Error(`F87: LEscala dryer reply must include cardOnly warning, got:\n${result}`)
    }
  },
},
{
  name: 'F87 — formatDryerPrices appends tpvExact 7€ for Goya',
  run: () => {
    const result = formatDryerPrices('Goya', runtime, translateEsForTest)
    if (!result) throw new Error('formatDryerPrices must return non-null')
    if (!result.includes('**7€**')) {
      throw new Error(`F87: Goya dryer reply must mention 7€, got:\n${result}`)
    }
  },
},
{
  name: 'F87 — backwards compat: formatWasherPrices without translateFn does not append signals',
  run: () => {
    const result = formatWasherPrices('Goya', runtime)  // no 3rd arg
    if (!result) throw new Error('formatWasherPrices must return non-null')
    if (result.includes('TPV cobra') || result.includes('solo se acepta tarjeta')) {
      throw new Error(`F87: without translateFn, no signal must be appended (legacy behaviour), got:\n${result}`)
    }
  },
},
{
  name: 'F87 — backwards compat: formatWasherPrices for location without payment does not crash',
  run: () => {
    const result = formatWasherPrices('NoPaymentLoc', runtime, translateEsForTest)
    if (!result) throw new Error('formatWasherPrices must return non-null')
    if (result.includes('TPV cobra') || result.includes('solo se acepta tarjeta')) {
      throw new Error(`F87: NoPaymentLoc has no payment field, no signal expected, got:\n${result}`)
    }
  },
},
{
  name: 'F87 — append order: cardOnly BEFORE tpvExact when both present (synthetic edge case)',
  run: () => {
    // Synthetic location with both signals (none real in CSV today, but
    // the formatter must handle the case for future-proofing)
    const syntheticRuntime = {
      locations: {
        locations: {
          BothSignals: {
            pueblo: 'Test',
            displayName: 'BothSignals',
            metadata: {
              hours: '8:00-22:00',
              machines: {
                washers: [{ number: 'L1', weightKg: 10, fidelity: '5€', cash: '5€' }],
              },
              payment: { methods: ['card'], tpvExact: 9 },
            },
          },
        },
      },
    } as unknown as typeof runtime
    const result = formatWasherPrices('BothSignals', syntheticRuntime, translateEsForTest)
    if (!result) throw new Error('formatWasherPrices must return non-null')
    const idxCardOnly = result.indexOf('solo se acepta tarjeta')
    const idxTpvExact = result.indexOf('TPV cobra el importe exacto')
    if (idxCardOnly === -1 || idxTpvExact === -1) {
      throw new Error(`F87: both signals must be present, got:\n${result}`)
    }
    if (idxCardOnly > idxTpvExact) {
      throw new Error(`F87: cardOnly must come BEFORE tpvExact (gravity decreasing), got order reversed:\n${result}`)
    }
  },
},
```

- [ ] **Step 3: Run il test (deve fallire — formatter non ancora esteso)**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/faq-location-formatter.test.ts 2>&1 | grep -E "F87 — format"`
Expected: tutti rossi `✗ F87 — format...` perché `formatWasherPrices` ancora non accetta `translateFn` né appende signal.

- [ ] **Step 4: Commit (test rossi che documentano il contratto)**

```bash
git add apps/backend/custom-ecolaundry/__tests__/unit/faq-location-formatter.test.ts
git commit -m "test(F87): add failing tests for formatWasherPrices/formatDryerPrices payment append

Tests assert:
- cardOnly appended when payment.methods === ['card']
- tpvExact appended with {amount} substituted when tpvExact !== null
- Baseline locations (Hortes/Alemanya) get neither
- Backwards compat: no translateFn → no append
- Append order: cardOnly BEFORE tpvExact
Formatter not yet extended — RED state."
```

---

### Task 7: Implement `formatPaymentSignals` + extend `formatWasherPrices`/`formatDryerPrices`

**Files:**
- Modify: `apps/backend/custom-ecolaundry/utils/faq-location-formatter.ts`

**Context:** Implementare il minimo per far passare i test di Task 6. Aggiungere parametro opzionale `translateFn` (riusare il tipo `ProgramTranslateFn` esistente da `faq-programs-formatter.ts`, già importato). Aggiungere helper privato `formatPaymentSignals`. Estendere i 2 export `formatWasherPrices`/`formatDryerPrices`.

- [ ] **Step 1: Verifica che `ProgramTranslateFn` sia disponibile in `faq-location-formatter.ts`**

Run: `cd apps/backend/custom-ecolaundry && grep -n "ProgramTranslateFn" utils/faq-location-formatter.ts`
Expected: la riga `type ProgramTranslateFn,` già esiste nel re-export iniziale (riga ~13).

- [ ] **Step 2: Importa il tipo in modo accessibile localmente**

Modifica l'import in cima a `utils/faq-location-formatter.ts`:

```typescript
// Re-exports from faq-programs-formatter.ts for backward compatibility:
export {
  formatWasherPrograms,
  formatDryerPrograms,
  buildPushProgList,
  type ProgramTranslateFn,
} from './faq-programs-formatter.js'

// F87 — import the type for internal use (cannot use a single 'export {} ... from'
// + value import without splitting):
import type { ProgramTranslateFn } from './faq-programs-formatter.js'
```

(Nota: il file ha già un re-export. Aggiungere l'`import type` separato è il pattern TS standard per usare lo stesso tipo localmente. Verifica con typecheck dopo.)

- [ ] **Step 3: Aggiungi helper privato `formatPaymentSignals` (sotto `formatDryerPrices`, riga ~97)**

```typescript
// F87 — Build the boundary-payment lines appended to washer/dryer price replies.
// Order matters (gravity decreasing):
//   1. paymentCardOnly  — show-stopper: customer with coins/bills wasted the trip
//   2. paymentTpvExact  — money-loss:   customer pays more than the exact amount
// Returns '' (empty) when no signal applies, otherwise '\n\n<signals>'.
function formatPaymentSignals(
  payment: PaymentInfo,
  translateFn: ProgramTranslateFn,
): string {
  const lines: string[] = []
  if (payment.methods.length === 1 && payment.methods[0] === 'card') {
    lines.push(translateFn('paymentCardOnly'))
  }
  if (payment.tpvExact !== null && payment.tpvExact !== undefined) {
    lines.push(
      translateFn('paymentTpvExact').replace('{amount}', String(payment.tpvExact)),
    )
  }
  return lines.length > 0 ? `\n\n${lines.join('\n\n')}` : ''
}
```

- [ ] **Step 4: Estendi `formatWasherPrices`**

Trova la firma corrente e aggiungi il parametro:

```typescript
export function formatWasherPrices(
  locationKey: string,
  runtime: Runtime,
  translateFn?: ProgramTranslateFn,  // F87 — optional for backwards compat
): string | null {
  const machines = readMachines(runtime, locationKey)
  if (!machines?.washers || machines.washers.length === 0) return null
  const displayName = readDisplayName(runtime, locationKey)
  const groups = groupBySpecs(machines.washers)
  const lines = groups.map((g) => formatGroupLine(g, 'Lavadoras'))
  const base = `En ${displayName}, los precios de lavadora son:\n\n${lines.join('\n')}`

  // F87 — append boundary payment signals when payment data + translateFn present.
  if (translateFn) {
    const payment = readPayment(runtime, locationKey)
    if (payment) return base + formatPaymentSignals(payment, translateFn)
  }
  return base
}
```

- [ ] **Step 5: Estendi `formatDryerPrices`**

Identica modifica:

```typescript
export function formatDryerPrices(
  locationKey: string,
  runtime: Runtime,
  translateFn?: ProgramTranslateFn,  // F87
): string | null {
  const machines = readMachines(runtime, locationKey)
  if (!machines?.dryers || machines.dryers.length === 0) return null
  const displayName = readDisplayName(runtime, locationKey)
  const groups = groupBySpecs(machines.dryers)
  const lines = groups.map((g) => formatGroupLine(g, 'Secadoras'))
  const base = `En ${displayName}, los precios de secadora son:\n\n${lines.join('\n')}`

  // F87 — append boundary payment signals when payment data + translateFn present.
  if (translateFn) {
    const payment = readPayment(runtime, locationKey)
    if (payment) return base + formatPaymentSignals(payment, translateFn)
  }
  return base
}
```

- [ ] **Step 6: Run typecheck**

Run: `cd apps/backend/custom-ecolaundry && npm run typecheck`
Expected: 0 errori.

- [ ] **Step 7: Run i test di Task 6 (devono passare)**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/faq-location-formatter.test.ts 2>&1 | grep -E "F87 —"`
Expected: tutti verdi `✓ F87 — ...`.

- [ ] **Step 8: Run ALL unit test esistenti per verificare zero regressione**

Run: `cd apps/backend/custom-ecolaundry && npm run test:unit 2>&1 | grep -cE "failed: [1-9]"`
Expected: `0` (zero file con failure).

- [ ] **Step 9: Verifica check-architecture**

Run: `cd apps/backend/custom-ecolaundry && bash scripts/check-architecture.sh`
Expected: tutti 6 check verdi.

- [ ] **Step 10: Verifica che `utils/faq-location-formatter.ts` resti ≤ 150 righe (iron rule #3) o sia già in `ALLOWED_LARGE_FILES`**

Run: `cd apps/backend/custom-ecolaundry && wc -l utils/faq-location-formatter.ts`

Se > 150 righe: cercare `ALLOWED_LARGE_FILES` in `scripts/check-architecture.sh`. Se il file è già nella lista, OK. Se no E supera 150, fermarsi e segnalare ad Andrea per decidere se aggiungere alla lista o split del file.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/custom-ecolaundry/utils/faq-location-formatter.ts
git commit -m "feat(F87): extend formatWasherPrices/formatDryerPrices with payment signals

- Add PaymentInfo type + PaymentMethod literal union
- Add readPayment(runtime, locationKey) reader
- Add formatPaymentSignals(payment, translateFn) helper
- Extend formatWasherPrices/formatDryerPrices with optional translateFn
  parameter — when present + payment data exists, append cardOnly +
  tpvExact lines (in gravity-decreasing order).
- Backwards compat: no translateFn → no append (legacy callers unchanged)."
```

---

### Task 8: Wire `translateFn` in `guards/faq-prices.ts`

**Files:**
- Modify: `apps/backend/custom-ecolaundry/utils/guards/faq-prices.ts`

**Context:** Il guard `guardFaqPrices` (e i suoi T2/T3) chiamano `formatWasherPrices(loc, ar.runtime)` e `formatDryerPrices(loc, ar.runtime)` senza translateFn. Per attivare i signal F87, dobbiamo costruire un `translateFn` da `t()` + `lang(ar)` e passarlo come terzo argomento. 3 call site totali da modificare.

- [ ] **Step 1: Trova i 3 call site di `formatWasherPrices`/`formatDryerPrices` nel file**

Run: `cd apps/backend/custom-ecolaundry && grep -n "formatWasherPrices\|formatDryerPrices" utils/guards/faq-prices.ts`
Expected: ~5 righe (1 import + ~3-4 call site).

- [ ] **Step 2: Aggiungi un helper inline `makeTranslateFn` in `renderPrices` (la funzione che owner di T1 + le 2 T3 confirm chiamano)**

Cerca la funzione `renderPrices` (intorno a riga 95-100, è quella interna che fa il rendering effettivo). All'inizio della funzione, dopo `const lng = lang(ar)`, aggiungi:

```typescript
// F87 — translateFn for formatWasher/DryerPrices to append payment signals.
const translateFn = (key: string): string => t(key as any, lng)
```

- [ ] **Step 3: Passa `translateFn` ai call site di `formatWasherPrices` e `formatDryerPrices` dentro `renderPrices`**

Modifica le 2-3 chiamate (vedi riga 116, 127, 139 nel file attuale):

PRIMA:
```typescript
const formatted = formatWasherPrices(loc, ar.runtime)
// ...
const formatted = formatDryerPrices(loc, ar.runtime)
// ...
const washers = formatWasherPrices(loc, ar.runtime)
```

DOPO:
```typescript
const formatted = formatWasherPrices(loc, ar.runtime, translateFn)
// ...
const formatted = formatDryerPrices(loc, ar.runtime, translateFn)
// ...
const washers = formatWasherPrices(loc, ar.runtime, translateFn)
```

- [ ] **Step 4: Verifica anche i call site DENTRO i guard `guardFaqPricesAwaitDryerConfirm` / `guardFaqPricesAwaitWasherConfirm` (se chiamano i formatter direttamente, non via `renderPrices`)**

Run: `cd apps/backend/custom-ecolaundry && grep -nB 3 "formatDryerPrices\|formatWasherPrices" utils/guards/faq-prices.ts`

Per ogni call site fuori `renderPrices`, costruire `translateFn` localmente:

```typescript
const lng = lang(ar)
const translateFn = (key: string): string => t(key as any, lng)
const formatted = formatDryerPrices(ar.state.location, ar.runtime, translateFn)
```

- [ ] **Step 5: Run typecheck**

Run: `cd apps/backend/custom-ecolaundry && npm run typecheck`
Expected: 0 errori.

- [ ] **Step 6: Run unit test (i test del formatter passano già, ma verifichiamo che nessun test di faq-prices guard sia rotto)**

Run: `cd apps/backend/custom-ecolaundry && npm run test:unit 2>&1 | grep -cE "failed: [1-9]"`
Expected: `0`.

- [ ] **Step 7: Smoke test live (1 chiamata reale per verifica end-to-end)**

Run:
```bash
cd apps/backend/custom-ecolaundry && npm run demo -- --batch '[["cuanto cuesta lavar en Goya?"]]' 2>&1 | tail -20
```
Expected: il reply del bot include `💡 El TPV cobra el importe exacto de **7€**` accanto alla lista prezzi.

- [ ] **Step 8: Smoke test L'Escala**

Run:
```bash
npm run demo -- --batch '[["cuanto cuesta lavar en LEscala?"]]' 2>&1 | tail -20
```
Expected: il reply include `⚠️ En esta lavandería solo se acepta tarjeta de crédito.`.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/custom-ecolaundry/utils/guards/faq-prices.ts
git commit -m "feat(F87): wire translateFn into guardFaqPrices formatters

Build translateFn from t() + lang(ar) inside renderPrices and confirm
guards. Pass as 3rd arg to formatWasherPrices/formatDryerPrices so the
boundary payment signals get appended to the reply.

Smoke verified live:
- Goya  → '💡 El TPV cobra el importe exacto de **7€**'
- LEscala → '⚠️ En esta lavandería solo se acepta tarjeta de crédito.'"
```

---

### Task 9: Add F87 pins to f-log-regression.test.ts

**Files:**
- Modify: `apps/backend/custom-ecolaundry/__tests__/unit/f-log-regression.test.ts`

**Context:** Iron rule #11 obbliga a pin per ogni F-entry. 3 pin minimi: (1) i18n keys esistono in tutti 6 cataloghi; (2) `locations.json` ha `metadata.payment` popolato; (3) formatter file espone `readPayment` + helper.

- [ ] **Step 1: Trova il punto di inserimento (in fondo all'array `cases`, prima del `]` finale)**

Run: `cd apps/backend/custom-ecolaundry && grep -n "F86 —" __tests__/unit/f-log-regression.test.ts | tail -3`
Expected: gli ultimi pin F86 sono il vicino di casa dei nuovi pin F87.

- [ ] **Step 2: Aggiungi 3 nuovi pin F87 prima della `]` di chiusura dell'array**

```typescript
{
  // F87 — FAQ payment location-aware (boundary signals).
  // Data-driven via metadata.payment + 2 new i18n keys.
  // Pattern identical to F50/F81. Triggered by skill chatbot-eval MIX 3
  // analysis (datafono-wrong-amount escalation root cause).
  name: 'F87 — paymentCardOnly + paymentTpvExact i18n keys exist in all 6 catalogues',
  run: () => {
    const langs = ['es', 'it', 'en', 'ca', 'pt', 'fr']
    for (const lng of langs) {
      const cat = JSON.parse(
        fs.readFileSync(path.join(ECOLAUNDRY_ROOT, `json/i18n/${lng}.json`), 'utf8'),
      )
      if (!cat.paymentCardOnly) {
        throw new Error(`F87: ${lng}.json missing key 'paymentCardOnly'`)
      }
      if (!cat.paymentCardOnly.includes('⚠️')) {
        throw new Error(`F87: ${lng}.json paymentCardOnly must include ⚠️ marker, got: ${cat.paymentCardOnly}`)
      }
      if (!cat.paymentTpvExact) {
        throw new Error(`F87: ${lng}.json missing key 'paymentTpvExact'`)
      }
      if (!cat.paymentTpvExact.includes('{amount}')) {
        throw new Error(`F87: ${lng}.json paymentTpvExact must include {amount} placeholder, got: ${cat.paymentTpvExact}`)
      }
    }
  },
},
{
  name: 'F87 — metadata.payment populated for all 6 locations',
  run: () => {
    const j = JSON.parse(
      fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'json/locations.json'), 'utf8'),
    )
    const expected: Record<string, { methods: string[]; tpvExact: number | null }> = {
      Goya:        { methods: ['coins','bills','fidelity','card'], tpvExact: 7 },
      Pineda:      { methods: ['coins','bills','fidelity','card'], tpvExact: 8 },
      "L'Escala":  { methods: ['card'],                            tpvExact: null },
      PlatjaDAro:  { methods: ['card'],                            tpvExact: null },
      Hortes:      { methods: ['coins','bills','fidelity','card'], tpvExact: null },
      Alemanya:    { methods: ['coins','bills','fidelity','card'], tpvExact: null },
    }
    for (const [key, exp] of Object.entries(expected)) {
      const loc = j.locations.locations[key]
      if (!loc) throw new Error(`F87: location '${key}' missing in locations.json`)
      const p = loc.metadata?.payment
      if (!p) throw new Error(`F87: ${key} has no metadata.payment`)
      if (JSON.stringify(p.methods.slice().sort()) !== JSON.stringify(exp.methods.slice().sort())) {
        throw new Error(`F87: ${key}.payment.methods mismatch — expected ${JSON.stringify(exp.methods)}, got ${JSON.stringify(p.methods)}`)
      }
      if (p.tpvExact !== exp.tpvExact) {
        throw new Error(`F87: ${key}.payment.tpvExact mismatch — expected ${exp.tpvExact}, got ${p.tpvExact}`)
      }
    }
  },
},
{
  name: 'F87 — faq-location-formatter.ts exports readPayment + formatWasher/DryerPrices accept translateFn',
  run: () => {
    const src = fs.readFileSync(
      path.join(ECOLAUNDRY_ROOT, 'utils/faq-location-formatter.ts'),
      'utf8',
    )
    if (!/export function readPayment/.test(src)) {
      throw new Error('F87: faq-location-formatter.ts must export readPayment')
    }
    if (!/export type PaymentInfo/.test(src)) {
      throw new Error('F87: faq-location-formatter.ts must export PaymentInfo type')
    }
    if (!/translateFn\?:\s*ProgramTranslateFn/.test(src)) {
      throw new Error('F87: formatWasherPrices/formatDryerPrices must accept optional translateFn parameter')
    }
    if (!/function formatPaymentSignals/.test(src)) {
      throw new Error('F87: faq-location-formatter.ts must define formatPaymentSignals helper')
    }
  },
},
```

(Nota: prima dell'array di chiusura `]`, separare con la virgola del pin precedente.)

- [ ] **Step 3: Run i pin F87**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/f-log-regression.test.ts 2>&1 | grep "F87 —"`
Expected: 3 righe verdi `✓ F87 — ...`.

- [ ] **Step 4: Run ALL F-log pins per verifica zero regressione**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/f-log-regression.test.ts 2>&1 | tail -3`
Expected: `N passed, 0 failed (out of N)` con N ≥ 128 (era 125 prima del fix F87 + 3 nuovi = 128).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/custom-ecolaundry/__tests__/unit/f-log-regression.test.ts
git commit -m "test(F87): add 3 regression pins for payment FAQ data-driven

Pins:
1. paymentCardOnly + paymentTpvExact exist in all 6 i18n catalogues
   with required markers (⚠️, {amount}) intact
2. locations.json has metadata.payment populated for all 6 locations
   with expected methods + tpvExact values
3. faq-location-formatter.ts exports readPayment, PaymentInfo,
   formatPaymentSignals, and the 2 formatters accept translateFn"
```

---

### Task 10: Add F87 entry to CLAUDE.md F-log + B6/B7/B8 to pending refactors

**Files:**
- Modify: `apps/backend/custom-ecolaundry/CLAUDE.md`

**Context:** Iron rule + check-architecture #11 obbliga a entry F-log per ogni pin. La tabella F-log è in ordine decrescente (F86 prima della F85, ecc.) — inserire F87 SOPRA F86. Inoltre, aggiungere B6/B7/B8 nella tabella `Pending refactors` (se ancora non esiste come tabella separata, crearla; altrimenti aggiungere righe in fondo).

- [ ] **Step 1: Trova il punto di inserimento per F87 (sopra F86)**

Run: `cd apps/backend/custom-ecolaundry && grep -nE "^\| F86 " CLAUDE.md | head -3`
Expected: 1 riga col numero della riga F86 entry.

- [ ] **Step 2: Inserisci la riga F87 PRIMA della riga F86**

Riga da inserire (1 sola riga lunga, formato tabella markdown):

```markdown
| F87 | Andrea brainstorming 2026-05-23 (skill brainstorming + audit `docs/csv/tables.md`): il CSV `preus.csv` documenta per ogni location i metodi di pagamento accettati e l'importo TPV esatto, ma il bot NON comunica questi 2 boundary signals critici al cliente quando risponde alle FAQ prezzi (Caso 12.2). Concretamente: (a) L'Escala + Platja d'Aro accettano SOLO carta di credito → cliente che arriva con monete spreca il viaggio; (b) Goya cobra TPV 7€ esatto, Pineda 8€ esatto → cliente che paga di più perde i soldi rimanenti (root cause dell'escalation 'datafono-wrong-amount' osservata in MIX 3 live test 2026-05-22). | Il `metadata.payment` non esisteva in `locations.json` e i formatter `formatWasherPrices`/`formatDryerPrices` non avevano accesso al `translateFn` per emettere righe i18n condizionali. Dato presente nel CSV ma non esposto al cliente — gap UX → escalation evitabili. | Pattern identico a F50/F81 (data-driven location-aware via metadata): (1) **L0 data** `json/locations.json:metadata.payment` per 6 location con `methods: PaymentMethod[]` (subset di `coins\|bills\|fidelity\|card`) + `tpvExact: number\|null`. (2) **L3 formatter** `utils/faq-location-formatter.ts` esteso con `readPayment` + `formatPaymentSignals` (helper privato) + parametro opzionale `translateFn?: ProgramTranslateFn` su `formatWasherPrices`/`formatDryerPrices`. (3) **L4 guard** `utils/guards/faq-prices.ts` costruisce `translateFn` da `t()` + `lang(ar)` e lo passa ai 2 formatter (3 call site). Zero modifiche a state/branch/router/router-prompt. (4) **L5 i18n** 2 nuove chiavi (`paymentCardOnly` con ⚠️, `paymentTpvExact` con placeholder `{amount}`) in 6 cataloghi; cleanup `pricingDeflect` dead code. (5) **Cleanup** `faqs.json:pricing` dead entry rimossa (delegate-to-legacy stabilito da F82). (6) **Test** sibling `__tests__/unit/faq-location-formatter.test.ts` esteso con ~12 nuovi pin (readPayment + format integration + backwards compat + append order) + 3 pin F87 in `f-log-regression.test.ts`. (7) **Append order**: `paymentCardOnly` PRIMA di `paymentTpvExact` (gravità decrescente — show-stopper poi money-loss). **Pattern preservativo (per future FAQ data-driven)**: ogni informazione operazionale per-location già presente nel CSV ma silenziata nell'UX bot è un candidato per estensione `metadata.<key>` + formatter. Quando aggiungi un nuovo signal: (a) dato strutturato in `metadata`, (b) i18n key con placeholder `{X}` se ha un parametro, (c) helper read + format helper, (d) parametro `translateFn?` sui formatter caller per backwards compat, (e) pin F-log + sibling test multi-lang. Iron rules rispettate: NO patches in agent.txt (rule #1), NO regex hardcoded (rule #6 — non c'è detector), 6 lingue obbligatorie (rule #8), sibling test (rule #5), F-log entry + pin (rule #11). Scope check: estensione narrow di formatter esistente, no cross-Caso change. |
```

- [ ] **Step 3: Trova/crea la sezione `Pending refactors`**

Run: `cd apps/backend/custom-ecolaundry && grep -nE "Pending refactors|## .*refactor" CLAUDE.md | head -3`
Expected: sezione esistente OR niente.

Se ESISTE: aggiungi 3 righe (B6, B7, B8) in fondo alla tabella.

Se NON ESISTE: crea una nuova sezione `## 🛠 Pending refactors` (sotto la F-log oppure dove sembra naturale nel documento), con header tabella + 3 righe.

Righe da inserire:

```markdown
| **B6** | AD2 — estendere FAQ prices con `metadata.extras` esistente (aclarado/lavado 1€ per L'Escala+PlatjaDAro) + extended tier dryer L'Escala (5€/25min via `dryers[].extended` esistente) | Primo cliente in produzione che chiede "c'è extra cost?" o "5€ programma?" | `metadata.extras` già esiste; serve solo estendere `formatWasherPrices`/`formatDryerPrices` per esporli condizionalmente |
| **B7** | AD3 — risolvere `weightKg: null` per Goya secadoras S1/S2/S3 | Telefonata operatore Olga / proprietà Goya per ottenere il dato fisico | Solo data fix in `locations.json:metadata.machines.dryers[].weightKg`, no code change |
| **B8** | F87 follow-up — validation al boot per `metadata.payment` (verificare che per ogni location esistano `methods` non-vuoto + subset di `{coins,bills,fidelity,card}` + `tpvExact` null o int positivo) | Se in produzione qualcuno edita `locations.json` malformato e il bot fallisce silenziosamente in `formatPaymentSignals` | Estendere `utils/runtime.ts:validateSettings` (o creare `validateLocations`). Fail-fast al boot con log esplicito |
```

- [ ] **Step 4: Run check-architecture (verifica che la pin F87 e la entry F87 siano allineate)**

Run: `cd apps/backend/custom-ecolaundry && bash scripts/check-architecture.sh`
Expected: 6/6 verdi (in particolare rule #11 — F-log entry hanno tutte un pin).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/custom-ecolaundry/CLAUDE.md
git commit -m "docs(F87): add F-log entry + B6/B7/B8 pending refactors

F87 documents the FAQ payment location-aware fix (boundary signals
cardOnly + tpvExact). B6/B7/B8 track scope-deferred items (extras,
weightKg data fix, validation at boot)."
```

---

### Task 11: Update usecases.md §12.2 + tables.md

**Files:**
- Modify: `apps/backend/custom-ecolaundry/docs/usecases.md`
- Modify: `apps/backend/custom-ecolaundry/docs/csv/tables.md`

**Context:** Triple-update rule (rule #11 corollary): ogni F-log entry richiede docs aggiornati. `usecases.md §12.2` deve avere il nuovo criterio + 2 dialoghi aggiornati. `tables.md` aggiorna riga "Metodi di pagamento" 80% → 100%.

- [ ] **Step 1: Trova §12.2 in usecases.md**

Run: `cd apps/backend/custom-ecolaundry && grep -n "^### 12\.2\|^## .*Precios" docs/usecases.md | head -5`

- [ ] **Step 2: Aggiungi nuovo criterio di accettazione in §12.2**

Cerca i criteri esistenti del §12.2 e aggiungi alla lista numerata:

```markdown
N. **F87 — Boundary signals payment**: il bot DEVE includere nell'output dei prezzi (sia lavadora sia secadora) un avviso `⚠️ paymentCardOnly` quando `metadata.payment.methods === ['card']` (L'Escala, Platja d'Aro), e un avviso `💡 paymentTpvExact` con `{amount}` sostituito quando `metadata.payment.tpvExact !== null` (Goya 7€, Pineda 8€). Posizione: dopo la lista prezzi, prima del dryer/washer follow-up hint. Ordine: cardOnly PRIMA di tpvExact (gravità decrescente).
```

(N è il prossimo numero dopo i criteri esistenti — leggere il documento e usare il numero giusto.)

- [ ] **Step 3: Aggiungi/aggiorna 1 dialogo esempio Goya con tpvExact**

Cerca un dialogo Goya esistente in §12.2 e aggiungi l'avviso TPV, oppure aggiungi un esempio nuovo:

```markdown
**Esempio dialogo F87 — Goya (tpvExact):**

Utente: `cuanto cuesta lavar en Goya?`
Bot:
```
En Goya, los precios de lavadora son:

- **L4-L5** 20kg: 6,5€ (fidelidad) / 7€ (efectivo)
- **L6-L7** 10kg: 3,5€ (fidelidad) / 4€ (efectivo)

💡 El TPV cobra el importe exacto de **7€** (no devuelve cambio).

¿También quieres información de secadora?
```

- [ ] **Step 4: Aggiungi/aggiorna 1 dialogo esempio L'Escala con cardOnly**

```markdown
**Esempio dialogo F87 — L'Escala (cardOnly):**

Utente: `cuanto cuesta lavar en L'Escala?`
Bot:
```
En L'Escala, los precios de lavadora son:

- **Lavadoras** 10kg: 6€
- **Lavadoras** 20kg: 9€

⚠️ En esta lavandería solo se acepta tarjeta de crédito.

¿También quieres información de secadora?
```

- [ ] **Step 5: Aggiorna `tables.md` riga "Metodi di pagamento"**

Run: `cd apps/backend/custom-ecolaundry && grep -n "Metodi di pagamento" docs/csv/tables.md`

Cerca la riga corrente:
```markdown
| **Metodi di pagamento** | instruccions-pagament-lavadora.csv | locations.json → `metadata.loyaltyCard`, `metadata.returnsChangeCoins`, `metadata.tpvCobra` | **80%** | L'Escala e Platja d'Aro: no monete/billetes non documentato esplicitamente nel JSON. |
```

Sostituiscila con:
```markdown
| **Metodi di pagamento** | instruccions-pagament-lavadora.csv + colonna "Cobrament datáfon" di preus.csv | locations.json → `metadata.payment` ({methods, tpvExact}) + ancora `metadata.loyaltyCard`/`returnsChangeCoins`/`tpvCobra` legacy | **100%** | F87 (2026-05-23): `methods` ora elenca i metodi accettati (coins/bills/fidelity/card), `tpvExact` documenta TPV con importo fisso (Goya 7€, Pineda 8€). Bot comunica `paymentCardOnly` per L'Escala+PlatjaDAro e `paymentTpvExact` per Goya+Pineda nelle FAQ prezzi (Caso 12.2). |
```

- [ ] **Step 6: Aggiungi nota in fondo a `tables.md` (sezione "Cross-flow architectural fixes")**

Cerca la sezione e aggiungi una riga F87:

```markdown
| **F87** | FAQ prezzi location-aware: `metadata.payment` con `methods` + `tpvExact` esposto via `formatPaymentSignals` (helper privato in `faq-location-formatter.ts`) | L3 formatter + L5 i18n | Data-driven location-aware: ogni dato CSV operazionale (payment methods, TPV exact) emerge come signal i18n condizionale nel reply. Pattern identico a F50/F81. |
```

- [ ] **Step 7: Verifica markdown sano**

Run: `cd apps/backend/custom-ecolaundry && head -5 docs/csv/tables.md && echo "---" && grep -c "F87" docs/csv/tables.md docs/usecases.md`
Expected: header tabella intatto, F87 conta ≥ 2 in tables.md, ≥ 3 in usecases.md.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/custom-ecolaundry/docs/usecases.md apps/backend/custom-ecolaundry/docs/csv/tables.md
git commit -m "docs(F87): triple-update — usecases.md §12.2 + tables.md

- usecases.md: add new criterion for boundary payment signals + 2
  example dialogues (Goya tpvExact 7€, L'Escala cardOnly)
- tables.md: 'Metodi di pagamento' coverage 80% → 100%; new F87 row
  in cross-flow architectural fixes section"
```

---

### Task 12: Final verification — 4-gate live test

**Files:** None (verification only)

**Context:** Iron rule "verification before completion": prima di considerare F87 chiuso, tutti i 4 gate devono essere verdi + smoke test live a conferma end-to-end.

- [ ] **Step 1: Typecheck**

Run: `cd apps/backend/custom-ecolaundry && npm run typecheck`
Expected: 0 errori.

- [ ] **Step 2: Unit tests**

Run: `cd apps/backend/custom-ecolaundry && npm run test:unit 2>&1 | tail -3`
Expected: 0 failed.

- [ ] **Step 3: Architecture check**

Run: `cd apps/backend/custom-ecolaundry && bash scripts/check-architecture.sh`
Expected: 6/6 verdi.

- [ ] **Step 4: F-log regression**

Run: `cd apps/backend/custom-ecolaundry && node --import tsx __tests__/unit/f-log-regression.test.ts 2>&1 | tail -3`
Expected: `N passed, 0 failed`, N ≥ 128 (era 125 pre-F87).

- [ ] **Step 5: Smoke test live — Goya (TPV exact)**

Run:
```bash
cd apps/backend/custom-ecolaundry && npm run demo -- --batch '[["cuanto cuesta lavar?","Goya"]]' 2>&1 | tail -30
```
Expected:
- Bot T2 emette lista prezzi Goya
- Reply include la riga `💡 El TPV cobra el importe exacto de **7€** (no devuelve cambio).`

- [ ] **Step 6: Smoke test live — Pineda (TPV exact 8€)**

Run:
```bash
npm run demo -- --batch '[["cuanto cuesta lavar?","Pineda"]]' 2>&1 | tail -30
```
Expected: reply include `💡 ... **8€** ...`.

- [ ] **Step 7: Smoke test live — L'Escala (cardOnly)**

Run:
```bash
npm run demo -- --batch '[["cuanto cuesta lavar?","L'\''Escala"]]' 2>&1 | tail -30
```
Expected: reply include `⚠️ En esta lavandería solo se acepta tarjeta de crédito.`.

- [ ] **Step 8: Smoke test live — Platja d'Aro (cardOnly)**

Run:
```bash
npm run demo -- --batch '[["cuanto cuesta lavar?","Platja d'\''Aro"]]' 2>&1 | tail -30
```
Expected: reply include `⚠️ ... solo se acepta tarjeta de crédito.`.

- [ ] **Step 9: Smoke test live — Hortes (baseline, no signals)**

Run:
```bash
npm run demo -- --batch '[["cuanto cuesta lavar?","Hortes"]]' 2>&1 | tail -30
```
Expected: reply NON include né `⚠️` né `💡 El TPV cobra`. Solo lista prezzi pulita.

- [ ] **Step 10: Smoke test multi-lang — Goya in IT (tenant ES-only, F80 sticky → bot resta ES)**

Run:
```bash
npm run demo -- --batch '[["quanto costa lavare?","Goya"]]' 2>&1 | tail -30
```
Expected: reply in ES (per F80, tenant ES-only) include `💡 El TPV cobra el importe exacto de **7€**`. NESSUN mix lingua.

- [ ] **Step 11: Final commit (se Andrea vuole un commit di chiusura — opzionale, può non commitare nulla)**

NON committare automaticamente. Andrea fa il `git add` finale manualmente come da iron rule "git only by Andrea".

Riportare ad Andrea il summary:
- 12 task completed
- All 4 gates green
- 5 smoke tests live OK
- N nuovi pin in f-log-regression (N ≥ 3)
- ~12 nuovi pin in faq-location-formatter.test.ts
- 6 location aggiornate in locations.json (+metadata.payment)
- 12 nuove i18n key (2 keys × 6 langs)
- 6 chiavi dead code rimosse (`pricingDeflect`)
- 1 entry dead rimossa da faqs.json
- F87 documented in CLAUDE.md F-log
- B6/B7/B8 tracked nei pending refactor
- docs/usecases.md §12.2 e docs/csv/tables.md aggiornati

---

## Self-Review (writing-plans)

### 1. Spec coverage

| Spec section | Task | Status |
|---|---|---|
| §3 Architettura 5 layer | Task 1 (L0) + Task 7 (L3) + Task 8 (L4) + Task 2 (L5) | ✅ |
| §4.1 Schema `metadata.payment` | Task 1 | ✅ |
| §4.2 Valori per 6 location | Task 1 step 2-7 | ✅ |
| §4.3 Convenzione `methods` set chiuso | Tipo `PaymentMethod` in Task 5 | ✅ |
| §4.4 Convenzione `tpvExact` | Task 7 (substitution `{amount}`) + Task 1 (data) | ✅ |
| §5.1 `paymentCardOnly` 6 lingue | Task 2 step 2-7 | ✅ |
| §5.2 `paymentTpvExact` 6 lingue + placeholder | Task 2 step 2-7 + Task 9 step 2 pin | ✅ |
| §6.1 Helper `readPayment` + `formatPaymentSignals` | Task 5 + Task 7 | ✅ |
| §6.2 Estensione formatter | Task 7 | ✅ |
| §6.3 Caller wire-up | Task 8 | ✅ |
| §7 Validation al boot | Tracked as B8 (Task 10) | ✅ (deferred per decision §15.1) |
| §8.1 Cleanup `pricingDeflect` | Task 2 step 1 + 2-7 + 10 | ✅ |
| §8.2 Cleanup `faqs.json:pricing` (8.2a) | Task 3 | ✅ |
| §9.1 Sibling test unit | Task 4 + Task 6 (~12 pin totali) | ✅ |
| §9.2 F-log pin | Task 9 (3 pin) | ✅ |
| §9.3 Coverage 6 lingue | Task 9 pin #1 (loop su 6 langs) | ✅ |
| §10.1 usecases.md §12.2 | Task 11 step 2-4 | ✅ |
| §10.2 tables.md | Task 11 step 5-6 | ✅ |
| §10.3 CLAUDE.md F87 entry | Task 10 step 2 | ✅ |
| §11 Pending refactor B6/B7/B8 | Task 10 step 3 | ✅ |
| §12 Iron rules verificate | Implicito in ogni task (no patch agent.txt, no inline mutation, no regex, ecc.) | ✅ |
| §13 Verifiche pre-commit | Task 12 (final verification) | ✅ |

Gap: nessuno.

### 2. Placeholder scan

- ❌ Nessun "TBD", "TODO", "implement later" trovato nel plan
- ❌ Nessun "Similar to Task N" senza ripetizione codice
- ❌ Nessuno step descrittivo senza code block dove serve

### 3. Type consistency

- `PaymentInfo` definito in Task 5 step 1, riferito in Task 5 step 2 (`readPayment` return type), Task 7 step 3 (`formatPaymentSignals` param type). ✅ Consistente.
- `PaymentMethod` literal union (`'coins' | 'bills' | 'fidelity' | 'card'`) definito in Task 5 step 1, usato implicitamente in `methods` field. ✅ Consistente.
- `ProgramTranslateFn` riusato da `faq-programs-formatter.ts` (esistente). ✅ No nuovo tipo, no drift.
- `translateFn?` opzionale in Task 7 step 4-5, chiamato condizionalmente. ✅ Backwards compat preservato.

### 4. Step granularity

Ogni step è 2-5 minuti di lavoro: trova file (10s), edit narrow (1-2 min), run command (10-30s), verifica output (10s). Aderente al criterio bite-sized.

### 5. Frequent commits

12 task, ognuno con 1 commit alla fine. Granularità: ogni layer cambiato è un commit. Andrea può fare cherry-pick / revert atomico per ogni step. ✅

---

## Risks / Notes

1. **Iron rule #3 (file ≤ 150 lines)**: `utils/faq-location-formatter.ts` attualmente è 134 righe. Dopo Task 5 (+~10) + Task 7 (+~15) → ~160. Possibile superamento. Task 7 step 10 lo verifica; se eccede, decidere con Andrea se aggiungere a `ALLOWED_LARGE_FILES` o split (poco probabile sia necessario perché tutti i nuovi helper sono coerenti con l'unico responsibility "format FAQ replies per location").

2. **i18n placement**: i 2 nuovi key vanno aggiunti vicino a `priceWarning` (riga ~83 in es.json). Se l'engineer aggiunge altrove, è OK funzionalmente — il test cerca la chiave globalmente.

3. **`grep` su `pricingDeflect`** (Task 2 step 1): se l'engineer trova un consumer TS non noto, **fermarsi** e segnalare ad Andrea — la chiave forse non è dead.

4. **Task 8 step 4** (call site dentro confirm guards): cerca tutti i call site DENTRO `guards/faq-prices.ts` perché possono esistere chiamate dirette fuori da `renderPrices`. Il `grep -nB 3 "formatDryerPrices|formatWasherPrices"` listcoperto è esaustivo.

5. **F-log pin sull'ordine append** (Task 6 step 2): il test "append order" usa una location sintetica (`BothSignals`) perché nessuna delle 6 reali ha contemporaneamente `cardOnly` e `tpvExact`. Future-proofing.
