# BlueClean Migration — Execution Plan (Step by Step)

> **Reference document**: [`migrate.md`](./migrate.md) — analisi tecnica completa.
> **Questo file**: piano operativo da eseguire **un checkpoint alla volta**, con commit tra l'uno e l'altro.
> **Filosofia (Andrea 2026-05-26)**: *"COPIA prima, RIADATTA dopo, passo a passo"*. No big-bang refactor.

---

## Riepilogo decisioni concordate (snapshot)

| Item | Decisione |
|---|---|
| Nuovo brand | **BlueClean** |
| Folder | `apps/backend/custom-blueclean/` |
| Slug / chatbotId | `blueclean` |
| Brand display | `BlueClean` |
| Coesistenza | **Opzione A** — `custom-ecolaundry` resta in parallelo |
| Città fittizia | `Villanova del Sole` *(pending conferma)* |
| 6 quartieri | Centro / Marina / Aurora / Olivetto / Belvedere / Castello |
| 6 vie | Piazza dei Tigli 4 / Via del Porto 117 / Via dell'Aurora 17 / Strada Provinciale 1 / Viale del Belvedere / Viale del Castello 37 |
| Codici display | SEL→READY, PUSH→START, DOOR→LOCK, ALM→ERR, AL001→ERR-01 |
| "central de pago" | → `totem di pagamento` (multi-lang) |
| Modelli macchina | HS60xx → WM-100, ED340 → DM-200 *(pending conferma)* |
| Prefisso codice sconto | SAU → **BC** |
| Email demo | `support@blueclean.demo` |
| URL form rimborso | `https://blueclean.demo/refund` |
| `enabledLanguages` | riordino `["es","en","it","fr","ca","pt"]` *(pending conferma)* |
| Casi documentati | 47 → **13** (vedi sez. usecases sotto) |

---

## Decisioni ANCORA da prendere (10 punti)

> Andrea decide ora oppure al checkpoint in cui servono.

1. `chatbotName` (oggi "Eco") → "Blu" / "Bubbles" / "Clean" / altro?
2. `AMBIGUOUS_PUEBLOES` svuotare? (raccomandato SÌ — single city)
3. Brand commerciali landmark (Mercadona/Carrefour) — generici o inventati specifici?
4. "(Spain)" in `router.txt` — tagliare?
5. Modelli macchina rinomina HS60xx→WM-100 confermi?
6. F-log 105 entries — tenere / reset / sanitize?
7. Frontend Playground — fork o parametrizzare?
8. Email/SMTP gelsogrove@gmail.com — tenere per test SMTP?
9. Documenti `docs/ecolaundry/` root — tenere/eliminare?
10. Prezzi shift random (+0.50€) per evitare matching listini pubblici?

---

# CHECKPOINT 0 — Duplicazione fedele

**Obiettivo**: `custom-blueclean/` = copia 1:1 di `custom-ecolaundry/`. Niente cambio logico/contenuto. Verifica che la copia compili e i test passino identici.

## Step 0.1 — Copia ricorsiva
```bash
cp -r apps/backend/custom-ecolaundry apps/backend/custom-blueclean
```

## Step 0.2 — Pulizia file inutili nella copia
```bash
cd apps/backend/custom-blueclean
rm -f package-lock.json
rm -rf node_modules dist
rm -rf .tmp-i18n-patch
```
**NB**: il file `migrate.md` e `plan.md` (creato a mano prima) restano nella cartella. Spostali temporaneamente se intralciano:
```bash
# Solo se necessario:
mv migrate.md plan.md /tmp/blueclean-docs/
```

## Step 0.3 — Conserva i contenuti originali per riferimento
**NON eliminare ancora** `testingLLM.md`, `docs/pdf/`, `docs/testing-llm-report-*.md` — li elimineremo al Checkpoint 4 dopo aver verificato che non servono.

## Step 0.4 — Verifica gates (devono restare verdi)
```bash
cd apps/backend/custom-blueclean
npm install
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```
Se uno dei 4 fallisce → STOP, capire perché la copia non è identica all'originale.

## Step 0.5 — Verifica integrità
```bash
diff -r apps/backend/custom-ecolaundry apps/backend/custom-blueclean \
  --exclude=node_modules --exclude=dist --exclude=package-lock.json \
  --exclude=migrate.md --exclude=plan.md
```
Atteso: nessun diff (a parte i file esclusi).

## ✅ Checkpoint 0 — Done when:
- [ ] Cartella `custom-blueclean/` esiste
- [ ] `npm install` ha rigenerato `package-lock.json`
- [ ] `npm run typecheck` verde
- [ ] `npm run test:unit` verde (~70 test)
- [ ] `bash scripts/check-architecture.sh` verde
- [ ] **Andrea fa commit**: `git add apps/backend/custom-blueclean && git commit -m "blueclean: checkpoint 0 — copia fedele da custom-ecolaundry"`

---

# CHECKPOINT 1 — Rename tecnico (identifier-only)

**Obiettivo**: cambiare gli identifier tecnici (folder già fatto, slug interni, package name, module id) senza toccare contenuto/brand visibile. Il bot deve continuare a parlare di "Ecolaundry" perché il rebrand è il prossimo checkpoint.

## Step 1.1 — Rename package npm
File: `apps/backend/custom-blueclean/package.json`
```diff
- "name": "ecolaundry-demo",
+ "name": "blueclean-demo",
- "description": "Ecolaundry Chatbot — LLM-as-agent with deterministic guards",
+ "description": "BlueClean Chatbot — LLM-as-agent with deterministic guards",
  "keywords": [
    "chatbot",
-   "ecolaundry",
-   "ecolaundry",
+   "blueclean",
+   "llm-agent"
  ],
```
Eseguire `npm install` per rigenerare `package-lock.json` con il nuovo name.

## Step 1.2 — Rename module identifier interno
File: `apps/backend/custom-blueclean/index.ts:65`
```diff
- const agentChain: string[] = ['custom-ecolaundry']
+ const agentChain: string[] = ['custom-blueclean']
```

## Step 1.3 — Path commenti JSDoc (interni al modulo)
Sed delle occorrenze `custom-ecolaundry` SOLO nei commenti TS/JS (non nelle stringhe brand):
```bash
cd apps/backend/custom-blueclean
grep -rl 'custom-ecolaundry' --include='*.ts' | xargs sed -i '' 's|custom-ecolaundry|custom-blueclean|g'
```
File attesi modificati: `models/chatbot-io.ts`, `models/index.ts`, `models/runtime.ts`, `models/i18n.ts`, `utils/human-message-email.ts`, `docs/architecture.md`, `CLAUDE.md`, ecc. **Solo i commenti — il brand "Ecolaundry" resta invariato.**

## Step 1.4 — Verifica anti-double-rename
```bash
# Non deve restare nessun "custom-ecolaundry" nel modulo blueclean:
grep -rn 'custom-ecolaundry' apps/backend/custom-blueclean/ | grep -v node_modules
# Atteso: 0 risultati
```

## Step 1.5 — Gates
```bash
cd apps/backend/custom-blueclean
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## Step 1.6 — Smoke test CLI (opzionale, costa OpenRouter)
```bash
cd apps/backend/custom-blueclean
echo "hola" | npm run demo
# Atteso: bot risponde con welcome Ecolaundry (brand ancora invariato)
```

## ✅ Checkpoint 1 — Done when:
- [ ] `package.json` name = `blueclean-demo`
- [ ] `package-lock.json` rigenerato
- [ ] `agentChain` = `['custom-blueclean']`
- [ ] 0 occorrenze `custom-ecolaundry` dentro `custom-blueclean/`
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] **Andrea commit**: `"blueclean: checkpoint 1 — rename tecnico (slug/package/module)"`

---

# CHECKPOINT 2 — Rebrand display (Ecolaundry → BlueClean)

**Obiettivo**: il bot inizia a chiamarsi BlueClean nei testi visibili. Dati location/codici/programmi/email restano REALI ancora (rischio leak medio, ma controllato).

## Step 2.1 — Settings (cuore del branding)
File: `apps/backend/custom-blueclean/json/settings.json`
```diff
- "_comment": "Tenant configuration for Ecolaundry / ecolaundry. …",
+ "_comment": "Tenant configuration for BlueClean / blueclean. …",
- "chatbotName": "Eco",
+ "chatbotName": "Blu",                    // pending Andrea: Blu / Bubbles / Clean
- "companyName": "Ecolaundry",
+ "companyName": "BlueClean",
```
**NON toccare ancora**: `discountCodePrefix`, `supportEmails`, `notificationEmails`, `smtp`, `refundFormUrl`, `allowedExternalLinks` — sono in Checkpoint 4.

## Step 2.2 — i18n × 6 lingue
File: `json/i18n/{es,it,en,ca,pt,fr}.json` — sostituire la parola "Ecolaundry" nelle chiavi che la contengono. Cercare prima:
```bash
grep -n 'Ecolaundry' apps/backend/custom-blueclean/json/i18n/*.json
```
Chiavi attese: `washDryTime`, `detergents`, `paymentMethods`, `appDownload` (e poche altre). Replace `Ecolaundry` → `BlueClean` **manualmente** per ogni lingua (è una parola che cambia significato nel contesto della frase).

Aggiornare anche il `_comment` di ogni file i18n:
```diff
- "_comment": "Localised strings for tenant ecolaundry (Ecolaundry). …",
+ "_comment": "Localised strings for tenant blueclean (BlueClean). …",
```

## Step 2.3 — FAQs
File: `json/faqs.json`
- `washDryTime`: "En Ecolaundry …" → "En BlueClean …"
- `detergents`: "Las máquinas Ecolaundry …" → "Las máquinas BlueClean …"
- `paymentMethods`: "App Ecolaundry" → "App BlueClean" (NB: il dominio app reale Domus si chiama "Ecolaundry" — qui anonimizziamo come app generica)
- `appDownload`: "Búscala como Ecolaundry …" → "Búscala como BlueClean …"

## Step 2.4 — Fallback hardcoded in runtime.ts
File: `utils/runtime.ts:298`
```diff
- companyName: settings.companyName || 'Ecolaundry',
+ companyName: settings.companyName || 'BlueClean',
```

## Step 2.5 — Header OpenRouter (telemetria)
- `utils/agent-llm.ts:63`: `'X-Title': 'Ecolaundry Agent'` → `'BlueClean Agent'`
- `utils/llm.ts:80`: `'X-Title': 'Ecolaundry'` → `'BlueClean'`

## Step 2.6 — Detector anti-impersonation
File: `utils/agent-welcome.ts:68`
```diff
- const isAssistantPhrase = /\b(asistente virtual|…|assistant virtuel)\s+de?\s+ecolaundry\b/i.test(n)
+ const isAssistantPhrase = /\b(asistente virtual|…|assistant virtuel)\s+de?\s+blueclean\b/i.test(n)
```

## Step 2.7 — Router prompt
File: `prompts/router.txt:5`
```diff
- You are the FIRST-TURN ROUTER of a multilingual chatbot for the Ecolaundry self-service laundromat chain (Spain).
+ You are the FIRST-TURN ROUTER of a multilingual chatbot for the BlueClean self-service laundromat chain.
```
*(Il taglio di "(Spain)" è già concordato per anonimizzazione regione — sez. 3.3.3 di migrate.md)*

## Step 2.8 — Stringhe brand sparse
- `agent.ts:712`: `'Ecolaundry Agent Demo (Step X)'` → `'BlueClean Agent Demo (Step X)'`
- `utils/locations.ts:1` commento: `// Single source of truth for the 6 Ecolaundry laundromats.` → `// Single source of truth for the 6 BlueClean laundromats.`
- `models/runtime.ts:63` JSDoc: `Tenant brand name, e.g. "Ecolaundry"` → `"BlueClean"`
- `models/i18n.ts:30`: idem
- `models/chatbot-io.ts:1`: `Public contract between the ecolaundry chatbot …` → `… blueclean chatbot …`
- `models/index.ts:1`: `Barrel re-export for ecolaundry type definitions` → `blueclean`

## Step 2.9 — Aggiornare i test affetti
Test che assertano `companyName === 'Ecolaundry'`:
```bash
grep -rln 'Ecolaundry' apps/backend/custom-blueclean/__tests__/
# Atteso: 3-4 file (_helpers.ts, branch-dispatcher.test.ts, f-log-regression.test.ts, human-message-email.test.ts)
```
Aggiornare gli assert hardcoded a `'BlueClean'`. **NON toccare la logica del test, solo i valori attesi.**

## Step 2.10 — README + CLAUDE.md
- `README.md`: titolo "Ecolaundry Chatbot" → "BlueClean Chatbot"; sezioni successive
- `CLAUDE.md`: header `# custom-ecolaundry — Orchestration rules` → `# custom-blueclean`

## Step 2.11 — Gates anti-leak parziale
```bash
cd apps/backend/custom-blueclean
# Brand visibile non deve più contenere "Ecolaundry" o "ecolaundry" come slug:
grep -rni 'ecolaundry\|Ecolaundry' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf
# Atteso: 0 risultati (a parte i 2 doc file di progetto)

# Test verdi:
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## ✅ Checkpoint 2 — Done when:
- [ ] settings.json: companyName=BlueClean, chatbotName=Blu (o scelta Andrea)
- [ ] i18n × 6 lingue aggiornati (~5 chiavi cadauno)
- [ ] faqs.json aggiornato
- [ ] runtime.ts fallback aggiornato
- [ ] Header OpenRouter aggiornati
- [ ] Detector agent-welcome.ts aggiornato
- [ ] router.txt aggiornato
- [ ] Test fixture (`_helpers.ts` + 3 test) aggiornati
- [ ] README.md + CLAUDE.md aggiornati
- [ ] 0 occorrenze `Ecolaundry`/`ecolaundry` nel modulo (esclusi migrate.md/plan.md)
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] Smoke CLI: `echo "hola" | npm run demo` → bot saluta come "BlueClean"
- [ ] **Andrea commit**: `"blueclean: checkpoint 2 — rebrand display (Ecolaundry→BlueClean)"`

---

# CHECKPOINT 3 — Anonimizzazione geografica

**Obiettivo**: sostituire città/quartieri/vie/landmark reali con Villanova del Sole + 6 quartieri fittizi. Il bot continua a funzionare con dati operativi reali (prezzi, programmi, hours).

## Step 3.1 — `utils/locations.ts`
Riscrittura completa di `LAUNDROMATS[]` secondo mapping sez. 3.3.1 di `migrate.md`:

```typescript
export const LAUNDROMATS: LaundromatLocation[] = [
  { canonical: 'Centro',     pueblo: 'Villanova del Sole', address: 'Piazza dei Tigli 4',
    aliases: ['Centro', 'Piazza dei Tigli', 'Piazza Tigli', 'Centro Storico'] },
  { canonical: 'Marina',     pueblo: 'Villanova del Sole', address: 'Via del Porto 117',
    aliases: ['Marina', 'Via del Porto', 'Porto', 'Via Porto 117'] },
  { canonical: 'Aurora',     pueblo: 'Villanova del Sole', address: "Via dell'Aurora 17",
    aliases: ['Aurora', "Via dell'Aurora", 'Via Aurora 17', 'Quartiere Aurora'] },
  { canonical: 'Olivetto',   pueblo: 'Villanova del Sole', address: 'Strada Provinciale 1, Centro Commerciale Sole',
    aliases: ['Olivetto', 'Centro Commerciale Sole', 'CC Sole'] },
  { canonical: 'Belvedere',  pueblo: 'Villanova del Sole', address: 'Viale del Belvedere, Centro Commerciale Stella',
    aliases: ['Belvedere', 'CC Stella', 'Centro Commerciale Stella'] },
  { canonical: 'Castello',   pueblo: 'Villanova del Sole', address: 'Viale del Castello 37',
    aliases: ['Castello', 'Viale del Castello', 'Via Castello 37'] },
]

// AMBIGUOUS_PUEBLOES vuoto: tutte le 6 location stanno nella stessa città fittizia
export const AMBIGUOUS_PUEBLOES: ReadonlySet<string> = new Set([])
```

## Step 3.2 — `json/locations.json` (881 righe)
File più voluminoso del Checkpoint. Per ogni location:
- Top-level key (`hortes` → `centro`, `goya` → `marina`, etc.)
- `pueblo`, `address`, `aliases`
- `metadata.landmarks[]` — sostituzione 1:1 secondo mapping sez. 3.3.2
- `metadata.howToUse` — ogni override cita la location reale → riscrivere con quartiere demo
- `metadata.programs` — i nomi programma neutri (`60º`, `40º`, etc.) restano, ma se citano location → sanitize
- `metadata.hours`, `metadata.prices`, `metadata.machines` — dati numerici restano

**Approccio operativo**: Riscrivere SEZIONE PER SEZIONE (una location alla volta), gates dopo ogni location. 6 location × ~150 righe ciascuna.

## Step 3.3 — CSV operativi
- `docs/csv/locals.csv` → riscrivere headers e 6 righe con nuovi nomi
- `docs/csv/horaris.csv` → headers location aggiornati
- `docs/csv/preus.csv` → headers location aggiornati
- `docs/csv/programes.csv` → headers location aggiornati
- `docs/csv/instruccions-*.csv` → verifica se citano location/landmark
- `docs/csv/alarmes-*.csv` → probabilmente neutri (codici tecnici), verificare

**NB**: i nomi FILE in catalano (`alarmes-lavadora.csv`, `preus.csv`, `horaris.csv`, ecc.) **NON li rinominiamo qui** — quello è Checkpoint 4 (fingerprint linguistico).

## Step 3.4 — Commenti TS che citano location reali
- `agent.ts:192-193, 323, 342` — commenti citano "Goya/Pineda" come esempi
- `utils/state-transitions.ts:258-260` — idem

Solo commenti: sostituire con nuovi quartieri demo (es. "Goya" → "Marina", "Pineda" → "Olivetto").

## Step 3.5 — Test helpers e fixture
- `__tests__/unit/_helpers.ts` — se contiene location reali nelle fixture, sostituire
- Altri test che fanno match esatto su "Goya"/"Pineda" — aggiornare

## Step 3.6 — Prompts
- `prompts/router.txt` — esempi multi-lang con "Goya"/"Pineda" → "Marina"/"Olivetto"
- `prompts/agent.txt` — verifica

## Step 3.7 — Doc interni
- `docs/usecases.md` — riscrittura completa rimandata al Checkpoint 5 (è incluso nella riduzione 47→13)
- `docs/reglas.md` — sanitize riferimenti location
- `docs/architecture.md` — header `Architecture — ecolaundry` → `blueclean`, path commenti
- `docs/f-log.md` — decisione separata (Checkpoint 5: reset/sanitize/keep)

## Step 3.8 — Gates anti-leak geografico
```bash
cd apps/backend/custom-blueclean
# 0 risultati attesi su location reali:
grep -rni 'Hortes\|Goya\|Alemanya\|Pineda\|Escala\|Platja\|Castell.*Aro\|Playa.*Aro' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf | grep -v testingLLM | grep -v testing-llm-report
grep -rni 'Granollers\|Mataró\|Mataro' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf | grep -v testingLLM | grep -v testing-llm-report
grep -rni 'Catalonia\|Cataluña\|catalan\|català' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf
# Atteso: 0 risultati per tutti e 3

npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## ✅ Checkpoint 3 — Done when:
- [ ] `utils/locations.ts` con 6 location demo + AMBIGUOUS_PUEBLOES vuoto
- [ ] `json/locations.json` 6 sezioni riscritte (landmarks + howToUse override)
- [ ] CSV operativi con headers location demo (file names invariati per ora)
- [ ] Commenti TS sanitize (`agent.ts`, `state-transitions.ts`)
- [ ] Test helpers + fixture aggiornati
- [ ] `router.txt` con esempi multi-lang sui nuovi quartieri
- [ ] `reglas.md`, `architecture.md` sanitize
- [ ] Grep anti-leak geografico = 0 risultati (3 pattern)
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] Smoke CLI: `"hola, estoy en Marina"` → bot riconosce location
- [ ] **Andrea commit**: `"blueclean: checkpoint 3 — anonimizzazione geografica (città/quartieri/vie/landmark)"`

---

# CHECKPOINT 4 — Anonimizzazione fingerprint tecnici

**Obiettivo**: rimuovere tutti i fingerprint settoriali (codici Domus, central de pago, modelli macchina, prefisso SAU, email/URL reali, lingue, CSV catalani). Dopo questo checkpoint, un esperto del settore non riconosce il cliente.

## Step 4.1 — Codici display
Sostituzione coordinata in **40+ file** (vedi sez. 3.4.1 di `migrate.md`):

**Mapping**:
- `SEL` → `READY`
- `PUSH` → `START` (inclusa dicitura "PUSH PROG" → "START PROG")
- `DOOR` → `LOCK`
- `ALM` → `ERR`
- `ALN` → `ERR`
- `AL001` → `ERR-01`
- `001` → `ERR-01` (in CSV alarmes)
- `ALM DOOR` → `ERR-LOCK`

**Ordine sostituzioni** (importante — più lunghe per prime per evitare match parziali):
1. `ALM DOOR` → `ERR-LOCK`
2. `AL001` → `ERR-01`
3. `PUSH PROG` → `START PROG`
4. `SEL` → `READY` (whole word `\bSEL\b`)
5. `PUSH` → `START` (whole word)
6. `DOOR` → `LOCK` (whole word)
7. `ALM` → `ERR` (whole word, dopo aver fatto ALM DOOR)
8. `ALN` → `ERR` (whole word)
9. `001` → `ERR-01` (solo in `alarmes-*.csv`, ATTENZIONE: non sostituire `001` in altri contesti tipo `T-001`)

**File coinvolti** (lista in sez. 3.4.1 migrate.md):
- JSON: `washer_hs60xx.json`, `dryer_ed340.json`, `display-flows.json`, `locations.json` (override metadata)
- CSV: `alarmes-lavadora.csv`, `alarmes-secadora.csv`
- TS detector: `utils/intent/display.ts`, `display-unreadable.ts`, `machine.ts`
- TS parser: `utils/message-parsing/display-signals.ts`, `utils/agent-extract/machine-and-display.ts`
- TS guard: `utils/guards/display.ts`, `display-flow.ts`, `dryer-minutes-stuck.ts`
- TS handler: `utils/branches/trouble-machine/`
- Prompt: `utils/agent-prompt.ts`, `prompts/agent.txt`
- i18n: `json/i18n/*.json` (chiavi displayCheckPrompt etc.)
- Test: ~15 file `__tests__/unit/*.test.ts` (display-pivot, force-machine-number-retry, machine-type-faq-flip, ecc.)

**Approccio**: NON usare sed globale. Andare file per file, con typecheck dopo ogni 5-10 file.

## Step 4.2 — "central de pago" / "centralita"
Sostituzione multi-lang:

| Originale | Lingua | Sostituire con |
|---|---|---|
| `central de pago` | es | `totem de pago` |
| `centralita` | es | `totem` |
| `central de pago` | it (raro) | `totem di pagamento` |
| `caja` (in contesto pago) | es | `totem` |

**File**: `washer_hs60xx.json`, `dryer_ed340.json`, `locations.json`, `faqs.json`, `i18n/*.json` (chiave howToUse + paymentMethods), `docs/csv/instruccions-pagament-*.csv`, `docs/reglas.md`, `__tests__/unit/_helpers.ts`.

## Step 4.3 — Modelli macchina (rename file + flow keys)
File rename:
```bash
cd apps/backend/custom-blueclean/json
git mv washer_hs60xx.json washer_wm100.json
git mv dryer_ed340.json dryer_dm200.json
```

Aggiornare riferimenti interni:
- `models/flow.ts` o equivalente — flow keys
- `utils/runtime.ts` — load file per nome
- `utils/branches/trouble-machine/` — switch su flowKey
- `__tests__/unit/*.test.ts` — assert sui flowKey
- `json/cases.json` — bridge semantic id
- `json/display-flows.json`

Sigle interne nel contenuto JSON:
- `HS-6017`, `HS-6023` → `WM-100A`, `WM-100B`
- `ED-340` → `DM-200A`

## Step 4.4 — Prefisso codice sconto SAU → BC
- `json/settings.json`: `"discountCodePrefix": "SAU"` → `"BC"`
- `utils/escalation.ts` commento: `SAU2904266 format` → `BC2904266 format`
- `__tests__/unit/discount-code-format.test.ts` — assert su `SAU2904266` → `BC2904266`
- `docs/f-log.md` (entry F46) — sanitize riferimenti

## Step 4.5 — Email/URL (CRITICO — link importantissimi per Andrea)

**Sostituzioni in `json/settings.json`**:
```diff
  "supportEmails": {
-   "invoice": "gelsogrove@gmail.com",
-   "support": "gelsogrove@gmail.com"
+   "invoice": "support@blueclean.demo",
+   "support": "support@blueclean.demo"
  },
- "notificationEmails": "gelsogrove@gmail.com",
+ "notificationEmails": "support@blueclean.demo",
  "smtp": {
-   "user": "gelsogrove@gmail.com",
-   "pass": "bhfg vynq uwqm jckm",
+   "user": "support@blueclean.demo",
+   "pass": "<DEMO_PLACEHOLDER>",     // SMTP demo: real send disabilitato
    …
-   "from": "gelsogrove@gmail.com"
+   "from": "support@blueclean.demo"
  },
- "refundFormUrl": "https://forms.gle/XFGPAd9581AhC9eu7",
+ "refundFormUrl": "https://blueclean.demo/refund",
- "allowedExternalLinks": "echatbot.ai, www.echatbot.ai, forms.gle, alberwaz.net",
+ "allowedExternalLinks": "echatbot.ai, www.echatbot.ai, blueclean.demo",
```

**⚠️ DECISIONE PENDING (Andrea Domanda #8)**: se vuoi mantenere SMTP funzionante per testare escalation in locale, **tenere `smtp.user/pass/from` come gelsogrove@gmail.com** ma cambiare solo `supportEmails`, `notificationEmails`, `refundFormUrl`, `allowedExternalLinks`.

**File i18n × 6 lingue** (chiavi `doubleCharge` + `refundRequest`):
- ES (`json/i18n/es.json` + `json/faqs.json`)
- IT, EN, CA, PT, FR (in `json/i18n/<lang>.json`)

Per ogni file, sostituire:
- `https://forms.gle/XFGPAd9581AhC9eu7` → `https://blueclean.demo/refund`
- `service@alberwaz.net` → `support@blueclean.demo`

## Step 4.6 — Ordine `enabledLanguages`
File: `json/settings.json`
```diff
- "enabledLanguages": ["es", "ca", "en", "it", "fr", "pt"],
+ "enabledLanguages": ["es", "en", "it", "fr", "ca", "pt"],
```
`defaultLanguage: "es"` resta (concordato).

## Step 4.7 — CSV rinomina (catalano → inglese neutro)
```bash
cd apps/backend/custom-blueclean/docs/csv
git mv alarmes-lavadora.csv alarms-washer.csv
git mv alarmes-secadora.csv alarms-dryer.csv
git mv instruccions-pagament-lavadora.csv payment-instructions-washer.csv
git mv instruccions-pagament-secadora.csv payment-instructions-dryer.csv
git mv instruccions-us.csv usage-instructions.csv
git mv programes.csv programs.csv
git mv horaris.csv hours.csv
git mv locals.csv locations.csv
git mv preus.csv prices.csv
```
Aggiornare `docs/csv/tables.md` con i nuovi nomi.

## Step 4.8 — Etichette programmi macchina (opzionale, pending Andrea)
Se Andrea conferma sez. 3.4.9: tradurre `60º (muy caliente)` → `60ºC — White cotton`, ecc. nelle chiavi i18n + locations.json metadata.

## Step 4.9 — Elimina file storici Ecolaundry
```bash
cd apps/backend/custom-blueclean
rm -f testingLLM.md
rm -f docs/testing-llm-report-2026-05-24.md
rm -rf docs/pdf
```

## Step 4.10 — Gates anti-leak fingerprint
```bash
cd apps/backend/custom-blueclean
# Nessun codice Domus/Girbau:
grep -rni '\bSEL\b\|\bPUSH\b\|\bDOOR\b\|\bALM\b\|\bAL001\b' . --include='*.json' --include='*.ts' --include='*.md' --include='*.csv' --include='*.txt' | grep -v node_modules
# Atteso: 0 risultati (eccetto eventuali test che VERIFICANO il rename — sanitize il riferimento)

# Nessun modello Domus reale:
grep -rni 'HS60xx\|HS-60\|ED340\|ED-340\|Domus\|Girbau' . | grep -v node_modules
# Atteso: 0

# Nessun riferimento "central de pago"/"centralita":
grep -rni 'central de pago\|centralita' . | grep -v node_modules
# Atteso: 0

# Nessun fingerprint email/URL/codice sconto:
grep -rni 'alberwaz\|forms.gle/XFGPAd\|"SAU"\|SAU2904266' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md
# Atteso: 0

# Test verdi:
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## ✅ Checkpoint 4 — Done when:
- [ ] Codici display sostituiti (SEL→READY, PUSH→START, DOOR→LOCK, ALM→ERR, AL001→ERR-01) in ~40 file
- [ ] "central de pago"/"centralita" → "totem di pagamento" multi-lang in ~10 file
- [ ] Modelli macchina rinominati (file + flow keys + sigle interne)
- [ ] SAU → BC ovunque
- [ ] Email/URL fittizi `support@blueclean.demo` + `blueclean.demo/refund`
- [ ] enabledLanguages riordinato
- [ ] 9 CSV rinominati in inglese neutro
- [ ] PDF/testingLLM eliminati
- [ ] 4 grep anti-leak fingerprint = 0 risultati
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] **Andrea commit**: `"blueclean: checkpoint 4 — anonimizzazione fingerprint tecnici"`

---

# CHECKPOINT 5 — Riduzione usecases (47 → 13 Casi)

**Obiettivo**: `usecases.md` snello con i 13 Casi business-critical concordati. Tutti gli altri 34 Casi eliminati. `cases.json` bridge aggiornato.

## Step 5.1 — Backup completo
```bash
cp apps/backend/custom-blueclean/docs/usecases.md /tmp/usecases-backup-$(date +%Y%m%d).md
cp apps/backend/custom-blueclean/json/cases.json /tmp/cases-backup-$(date +%Y%m%d).json
```

## Step 5.2 — Identifica e taglia i 34 Casi da eliminare
Casi da TENERE (con mapping al loro N° originale):
```
Caso  1 (Orari) ............... ← originale Caso 12 + Caso 36
Caso  2 (Prezzi) .............. ← originale Caso 12 + Caso 37/38
Caso  3 (Come funziona) ....... ← originale Caso 35 + Caso 45 + Caso 42
Caso  4 (Non funziona lavatrice) ← originale Caso 2 (DOOR→LOCK)
Caso  5 (Non funziona — START PROG) ← originale Caso 1 (PUSH PROG→START PROG)
Caso  6 (Non mi dà il resto) .. ← originale Caso 19 (Goya→Marina)
Caso  7 (Pagato due volte) .... ← originale Caso 6 (doble cobro)
Caso  8 (Ho pagato e non si attiva) ← originale Caso 4
Caso 8.1 (Cambio dato, non parte) ← variante Caso 4 + Caso 7
Caso  9 (È partito un allarme) ← originale Caso 5 (AL001→ERR-01) + Caso 16
Caso 10 (Parlare con operatore) ← originale Caso 25
Caso 11 (Voglio la fattura) ... ← originale Caso 9
Caso 12 (Tessera fidelizzazione) ← originale Caso 10 + Caso 11
Caso 13 (Tessera altro quartiere) ← originale Caso 10.2 (adattato)
```

Casi da ELIMINARE: 3, 7 (orig.), 8 (orig.), 13-18, 21-24, 26-32, 33-34, 36-46.
*(NB: Caso 6, 9, 10 originali sono TENUTI e remappati; non confondere con numeri demo)*

## Step 5.3 — Riscrittura `usecases.md`
Per ciascuno dei 13 Casi tenuti:
1. **Trovare la sezione originale** (es. Caso 2 originale = "DOOR")
2. **Estrarla** mantenendo struttura: criterios + Conversación multi-lang
3. **Rinumerare** secondo nuovo schema demo
4. **Sanitizzare**:
   - Codici display (DOOR→LOCK, ecc.)
   - Location (Goya→Marina, ecc.)
   - Brand (Ecolaundry→BlueClean) ← già fatto in Checkpoint 2
   - "central de pago"→"totem di pagamento" ← già fatto in Checkpoint 4
   - SAU→BC se applicabile
   - URL forms.gle→blueclean.demo/refund
5. **Verificare iron rules** (rule #6 trigger phrases, rule #8 multi-lang)

**Approccio**: un Caso per volta, gates dopo ogni 3 Casi.

## Step 5.4 — Aggiornamento `json/cases.json`
Il bridge doc-Caso → code-semanticId va aggiornato:
- Rimuovere entries dei Casi eliminati
- Rinumerare entries dei Casi tenuti secondo nuovo schema (1-13)
- Mantenere `semanticId` invariato (è la chiave per il codice)

## Step 5.5 — Pin in `f-log-regression.test.ts`
Verificare che i pin esistenti non citino numeri ordinali (rule #9). Se citano "Caso 19" → sostituire con `semanticId`.

## Step 5.6 — `f-log.md` (decisione Andrea Domanda #6)
Tre opzioni:
- (a) **Reset a F0** — pulizia totale, log "F0 — clean slate for BlueClean demo"
- (b) **Sanitize 105 entries** — mantengo storia ma rimuovo riferimenti Ecolaundry/Goya/etc.
- (c) **Tenere as-is** — rischio leak

**Raccomandato**: (a) per la demo. È un fork pulito.

## Step 5.7 — Gates
```bash
cd apps/backend/custom-blueclean
# usecases.md ha solo 13 Casi:
grep -c '^## Caso ' docs/usecases.md
# Atteso: 13 (+ eventuali sub-casi annidati ## ##)

# cases.json coerente:
node -e "console.log(Object.keys(require('./json/cases.json')).length)"
# Atteso: ~13-14

npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## Step 5.8 — Smoke test dei 13 Casi (CLI)
```bash
cd apps/backend/custom-blueclean
# Per ciascuno dei 13 Casi, eseguire il primo turn del flow di esempio:
npm run demo -- --batch '[
  ["Que horarios tienen?"],                    # Caso 1
  ["Cuanto cuesta?"],                          # Caso 2
  ["Como se usa la lavanderia?"],              # Caso 3
  ["No funciona la lavadora"],                 # Caso 4
  ["Sale START PROG"],                         # Caso 5
  ["No me da el cambio"],                      # Caso 6
  ["Me ha cobrado dos veces"],                 # Caso 7
  ["He pagado y no se ha activado"],           # Caso 8
  ["Sale ERR-01"],                             # Caso 9
  ["Quiero hablar con un operador"],           # Caso 10
  ["Quiero la factura"],                       # Caso 11
  ["Quiero comprar tarjeta fidelizacion"],     # Caso 12
  ["La tarjeta la compre en otro barrio"]      # Caso 13
]'
```
Atteso: tutti i Casi rispondono coerentemente, niente errori/escalation premature.

## ✅ Checkpoint 5 — Done when:
- [ ] `usecases.md` contiene 13 Casi rinumerati e sanitizzati
- [ ] `cases.json` ha solo le 13-14 entries dei Casi tenuti
- [ ] `f-log.md` gestito (reset/sanitize/keep secondo Andrea)
- [ ] Pin `f-log-regression.test.ts` aggiornati
- [ ] Smoke test 13 Casi CLI: tutti rispondono coerentemente
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] **Andrea commit**: `"blueclean: checkpoint 5 — riduzione usecases (47→13)"`

---

# CHECKPOINT 6 — Integrazione backend + DB seed

**Obiettivo**: il modulo `custom-blueclean` è caricabile dal backend principale tramite `workspace.customChatbotId === "blueclean"`. Frontend ha una route `/demo/blueclean` parallela.

## Step 6.1 — `src/application/services/custom-client-chatbot.service.ts`
**Decisione (Opzione A — coesistenza)**: il resolver legge `workspace.customChatbotId` dinamico, niente cambio necessario per supportare `blueclean`. Però i fallback hardcoded (linee 199-210) attualmente puntano solo a "ecolaundry":
```diff
  private resolveChatbotId(params: InvokeParams): string | null {
    if (params.customChatbotId) {
      return params.customChatbotId.trim()
    }
-   if (params.workspaceSlug?.toLowerCase() === "ecolaundry") {
-     return "ecolaundry"
-   }
+   if (params.workspaceSlug?.toLowerCase() === "ecolaundry") return "ecolaundry"
+   if (params.workspaceSlug?.toLowerCase() === "blueclean")  return "blueclean"
    if (this.customClient0WorkspaceIds.has(params.workspaceId)) {
      return "ecolaundry"
    }
    return null
  }
```
Aggiornare anche commenti JSDoc che citano "ecolaundry".

## Step 6.2 — `src/application/services/escalation-email.service.ts`
**Problema** (sez. 4.1 di migrate.md): import statico hardcoded:
```typescript
const mod = await import('../../../custom-ecolaundry/utils/human-message-email')
```
**Soluzione raccomandata (opzione a — refactor dinamico)**: parametrizzare via chatbotId.
```diff
- const mod = await import('../../../custom-ecolaundry/utils/human-message-email')
+ const folderName = chatbotId.startsWith('custom-') ? chatbotId : `custom-${chatbotId}`
+ const mod = await import(`../../../${folderName}/utils/human-message-email`)
```
Aggiornare anche il chiamante per passare `chatbotId`.

**Soluzione minima (opzione b)**: doppio import try/catch:
```typescript
let mod
try { mod = await import('../../../custom-blueclean/utils/human-message-email') }
catch { mod = await import('../../../custom-ecolaundry/utils/human-message-email') }
```

→ ASK Andrea Domanda #12: a o b? **Raccomandato a** (clean).

## Step 6.3 — `src/interfaces/http/controllers/playground.controller.ts`
**Critico** (linee 13-83): cache singleton `ECOLAUNDRY_SLUG` + path fallback hardcoded.

```diff
- const ECOLAUNDRY_SLUG = "ecolaundry"
- let ecolaundryWorkspaceIdCache: string | null = null
+ const DEFAULT_DEMO_SLUG = process.env.DEFAULT_DEMO_SLUG || "blueclean"
+ const workspaceIdCache = new Map<string, string>()
```
Rifattorizzare `getEcolaundryWorkspaceId()` in `getDemoWorkspaceId(slug)` con cache per-slug.

I 3 path di fallback `custom-ecolaundry/docs/usecases.md` (linee 80-83): rimuovere il fallback o estendere a `custom-<slug>/docs/usecases.md` dinamico (già parzialmente fatto nelle prime 3 linee 77-79).

## Step 6.4 — Logger pipeline tag
File: `src/interfaces/http/controllers/ultramsg-webhook.controller.ts` + `whatsapp-webhook.controller.ts` + `widget-chat.controller.ts`.

Logger tag attualmente hardcoded `pipeline: 'custom-ecolaundry'`. Sostituire con dinamico:
```diff
- pipeline: 'custom-ecolaundry',
+ pipeline: `custom-${chatbotId}`,
```

## Step 6.5 — Frontend routes (Opzione A — coesistenza)
File: `apps/frontend/src/App.tsx`
```diff
  <Route path="/demo/ecolaundry/*" element={<PlaygroundPage />} />
+ <Route path="/demo/blueclean/*"  element={<PlaygroundPage clientSlug="blueclean" />} />
```

File: `apps/frontend/src/pages/PlaygroundPage.tsx`
**Decisione Andrea Domanda #13**: fork o parametrizzazione?
- **Parametrizzazione** (raccomandato): accetta `clientSlug` prop, deriva tutto da quello (storage keys, label, title, iframe path)
- **Fork**: duplica `BlueCleanPlaygroundPage.tsx`

→ ASK Andrea.

## Step 6.6 — `packages/database/prisma/seed.ts`
Aggiungere blocco "Creating BlueClean workspace" parallelo al blocco Ecolaundry esistente (linee 1543-2491):

```typescript
// ── BlueClean demo workspace ─────────────────────────────────
console.log("🏢 Creating/updating FLOW workspace (BlueClean) for admin user...")

let bluecleanWorkspace = await prisma.workspace.findFirst({
  where: { slug: "blueclean" },
})

if (!bluecleanWorkspace) {
  bluecleanWorkspace = await prisma.workspace.create({
    data: {
      name: "BlueClean",
      slug: "blueclean",
      customChatbotId: "blueclean",
      // … altri campi clonati dal blocco Ecolaundry, adattati
    },
  })
}

// Associate admin user (idem Ecolaundry pattern)
// WhatsApp settings (idem)
// Languages (riordinate: es, en, it, fr, ca, pt)
// AgentConfigs (riusare ecoAgents pattern)
// FlowNodeConfigs (riusare i 3 flow node con label BlueClean)
// WorkspaceCallingFunctions (idem)
```

⚠️ Lavoro voluminoso (~150 righe del seed). Da fare con cura, NON sed.

## Step 6.7 — Migrate + seed DB
```bash
npm run prisma:migrate     # se schema invariato → skip
npm run prisma:seed
```
Verifica via Prisma Studio o psql:
```sql
SELECT slug, "customChatbotId" FROM "Workspace" WHERE slug IN ('ecolaundry','blueclean');
```
Atteso: 2 righe.

## Step 6.8 — Gates
```bash
cd apps/backend
npm run typecheck
npm run test:unit
# Test backend non devono rompersi:
npm run test -- __tests__/unit/escalation-email-notification.spec.ts
npm run test -- src/__tests__/unit/chat-engine/skip-translation-custom-chatbot.spec.ts
```

## ✅ Checkpoint 6 — Done when:
- [ ] `custom-client-chatbot.service.ts` resolver supporta "blueclean"
- [ ] `escalation-email.service.ts` refactor (opzione a o b)
- [ ] `playground.controller.ts` parametrizzato per slug demo
- [ ] Logger pipeline tag dinamici
- [ ] Frontend route `/demo/blueclean/*` aggiunta
- [ ] `seed.ts` con blocco BlueClean workspace
- [ ] DB seed eseguito → 2 workspace (ecolaundry + blueclean)
- [ ] Test backend verdi
- [ ] **Andrea commit**: `"blueclean: checkpoint 6 — integrazione backend + DB seed"`

---

# CHECKPOINT 7 — Smoke test finale + anti-leak

**Obiettivo**: tutto funziona end-to-end via web. La demo è "demo-ready".

## Step 7.1 — Avvio stack completo
```bash
npm run dev:all
# Atteso: backend su 3001, frontend su 3000, DB su 5434, no errori al boot
```

## Step 7.2 — Web smoke test (5 scenari rappresentativi)
Aprire `http://localhost:3000/demo/blueclean` in browser.

Scenari da provare:
1. **Greeting + FAQ**: "hola, que horarios tienen en Marina?" → bot risponde con orari del quartiere Marina
2. **Trouble machine**: "lavadora no funciona, sale LOCK" → bot guida display flow (3-4 turn)
3. **Pagamento problema**: "he pagado y la lavadora 5 no se ha activado en Centro" → gather + 3-strikes
4. **Escalation immediata**: "quiero hablar con un operador YA" → escalation senza gather
5. **Multi-lang**: "che programmi avete a Olivetto?" (IT) → bot risponde in IT con programmi quartiere

Verifica per ciascuno:
- ✅ Lingua sticky (il bot non switcha lingua)
- ✅ Niente parola "Ecolaundry"/"Goya"/"Mataró"/"central de pago"/"SAU" nel reply
- ✅ Branding "BlueClean" visibile
- ✅ Location demo corrette

## Step 7.3 — Final anti-leak grep (11 pattern)
```bash
cd apps/backend/custom-blueclean

# Brand:
grep -rni 'ecolaundry\|Ecolaundry' . | grep -v node_modules | grep -v dist | grep -v migrate.md | grep -v plan.md

# Geografia:
grep -rni 'Hortes\|Goya\|Alemanya\|Pineda\|Escala\|Platja\|Castell.*Aro' . | grep -v node_modules | grep -v dist
grep -rni 'Granollers\|Mataró\|Mataro\|Pineda de Mar' . | grep -v node_modules | grep -v dist
grep -rni 'Catalonia\|Cataluña\|catalan\|català\|España\|Spain' . | grep -v node_modules | grep -v dist
grep -rni 'Mercadona\|Carrefour' . | grep -v node_modules | grep -v dist

# Fingerprint settoriali:
grep -rni '\bSEL\b\|\bPUSH\b\|\bDOOR\b\|\bALM\b\|\bAL001\b' . --include='*.json' --include='*.ts' --include='*.md' --include='*.csv' | grep -v node_modules | grep -v dist
grep -rni 'HS60xx\|HS-60\|ED340\|ED-340\|Domus\|Girbau' . | grep -v node_modules | grep -v dist
grep -rni 'central de pago\|centralita' . | grep -v node_modules | grep -v dist

# Email/URL cliente reale:
grep -rni 'alberwaz\|forms.gle/XFGPAd' . | grep -v node_modules | grep -v dist

# Codice sconto:
grep -rni '"SAU"\|SAU2904266' . | grep -v node_modules | grep -v dist | grep -v migrate.md

# Credenziali personali:
grep -rni 'gelsogrove\|venezia44' . | grep -v node_modules | grep -v dist | grep -v migrate.md
```

**Atteso**: 0 risultati per tutti gli 11 grep (eccetto eventuali `gelsogrove@gmail.com` in `smtp.user` se Andrea ha scelto di mantenerlo per testing).

## Step 7.4 — Test backend integrazione
```bash
cd apps/backend
npm run test:unit
# Atteso: tutti i test backend (1600+) verdi
```

## Step 7.5 — Verifica check-architecture finale
```bash
cd apps/backend/custom-blueclean
bash scripts/check-architecture.sh
# Atteso: 8 enforcement check verdi
```

## ✅ Checkpoint 7 — Done when:
- [ ] `npm run dev:all` boot pulito
- [ ] `/demo/blueclean` funziona via browser
- [ ] 5 scenari smoke test → tutti coerenti
- [ ] 11 grep anti-leak finali → 0 risultati
- [ ] Test unit backend verdi
- [ ] check-architecture.sh verde
- [ ] **DEMO PRONTA per il cliente**
- [ ] **Andrea commit finale**: `"blueclean: checkpoint 7 — demo ready"`

---

# Tracker progressivo

> Aggiornare man mano. Spuntare con X.

```
- [ ] CHECKPOINT 0 — Duplicazione fedele                    (stima: 30 min)
- [ ] CHECKPOINT 1 — Rename tecnico                         (stima: 45 min)
- [ ] CHECKPOINT 2 — Rebrand display                        (stima: 1h)
- [ ] CHECKPOINT 3 — Anonimizzazione geografica             (stima: 2-4h)
- [ ] CHECKPOINT 4 — Anonimizzazione fingerprint tecnici    (stima: 3-5h)
- [ ] CHECKPOINT 5 — Riduzione usecases (47→13)             (stima: 2-3h)
- [ ] CHECKPOINT 6 — Integrazione backend + DB seed         (stima: 1-2h)
- [ ] CHECKPOINT 7 — Smoke test finale + anti-leak          (stima: 1h)
```

**Totale stimato**: 10-16 ore di lavoro focalizzato, distribuibili su 2-3 giornate.

**Punto di NON ritorno**: dopo Checkpoint 4 (rimozione fingerprint), tornare indietro è costoso. Verificare TUTTO ai Checkpoint 0-3 prima di proseguire.

---

# Note operative

## Rollback strategy
Tra ogni Checkpoint Andrea fa commit. Se un Checkpoint introduce regressioni:
```bash
git reset --hard <commit del Checkpoint precedente>
```

## Hot-reload
Backend e frontend hanno hot-reload attivo (CLAUDE.md rule #3). NON riavviare server manualmente — salvare e attendere 1-2 sec.

## Test policy
- Solo `test:unit` (CLAUDE.md rule #7B — niente integration test)
- Tests sono "the bible" — fix codice prima di modificare assert (rule #7A)
- Comunque test che assertano valori hardcoded (`'Ecolaundry'`, `'SEL'`, `'Goya'`) DEVONO essere aggiornati ai checkpoint 2/3/4 — è valore atteso che cambia, non logica

## Anti-leak come gate
Ai Checkpoint 3/4/7, i grep anti-leak sono **gate bloccanti**: se uno torna risultati, NON procedere al checkpoint successivo. Fix prima.

## Coordinamento con custom-ecolaundry
`custom-ecolaundry` resta intatto durante tutta la migrazione (Opzione A). Niente modifiche concorrenti. Se Andrea vuole sviluppi paralleli su ecolaundry, farli su branch separato.

---

**End of plan.** Quando Andrea dà OK al Checkpoint 0, parte l'esecuzione.
