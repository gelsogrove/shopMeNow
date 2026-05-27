# Demowash Migration — Execution Plan (Step by Step)

> **Reference document**: [`migrate.md`](./migrate.md) — analisi tecnica completa.
> **Questo file**: piano operativo da eseguire **un checkpoint alla volta**, con commit tra l'uno e l'altro.
> **Filosofia (Andrea 2026-05-26)**: *"COPIA prima, RIADATTA dopo, passo a passo"*. No big-bang refactor.

---

## 🔓 PERMESSI OPERATIVI (Andrea 2026-05-26)

> *"dal momento che prima fai una copia hai tutti i permessi per cancellare dentro custom-demowash"*

**Pieno consenso preventivo** a operare DENTRO `apps/backend/custom-demowash/` senza chiedere conferma a ogni passo:

| Azione | Dentro `custom-demowash/` | Fuori da `custom-demowash/` |
|---|---|---|
| Leggere file | ✅ libero | ✅ libero |
| Modificare file (`Edit`/`Write`) | ✅ **libero — no conferma** | ⚠️ conferma esplicita |
| Cancellare file (`rm`) | ✅ **libero — no conferma** | ⚠️ conferma esplicita |
| Cancellare cartelle (`rm -rf`) | ✅ **libero — no conferma** | ⚠️ conferma esplicita |
| Rinominare/spostare (`mv`, `git mv`) | ✅ **libero — no conferma** | ⚠️ conferma esplicita |
| Sed/replace massiva | ✅ **libero — no conferma** | ⚠️ conferma esplicita |
| Rigenerare `package-lock.json` | ✅ **libero** | ✅ libero |

**Razionale**: la copia in `custom-demowash/` è materiale grezzo di lavoro — non è codice "production" finché non arriva al Checkpoint 7. Posso quindi:
- Eliminare PDF, testingLLM, doc obsoleti senza chiedere
- Rinominare CSV e file modello senza chiedere
- Cancellare i 34 Casi scartati da `usecases.md` senza chiedere
- Riscrivere interi blocchi di `locations.json` senza chiedere
- Resettare `f-log.md` a F0 se concordato (decisione separata in sez. Decisioni Pending)
- Fare commit Andrea quando completa il checkpoint (Andrea mantiene la regola git workflow)

**Limitazioni preservate** (anche dentro `custom-demowash/`):
- ❌ NON toccare `.env` (regola Andrea — anche se è dentro custom-demowash)
- ❌ NON eseguire `git add`/`git commit`/`git push` (Andrea fa commit manualmente al termine di ogni checkpoint)
- ❌ NON cancellare `migrate.md` / `plan.md` (sono i doc di progetto)

**Fuori da `custom-demowash/`** (backend src, frontend, seed, docs root) → conferma esplicita per ogni modifica al Checkpoint 6.

---

## Riepilogo decisioni concordate (snapshot)

| Item | Decisione |
|---|---|
| Nuovo brand | **Demowash** |
| Folder | `apps/backend/custom-demowash/` |
| Slug / chatbotId | `demowash` |
| Brand display | `Demowash` |
| Coesistenza | **Opzione A** — `custom-demowash` resta in parallelo |
| Città fittizia | `Villanova del Sole` *(pending conferma)* |
| 6 quartieri | Centro / Marina / Aurora / Olivetto / Belvedere / Castello |
| 6 vie | Piazza dei Tigli 4 / Via del Porto 117 / Via dell'Aurora 17 / Strada Provinciale 1 / Viale del Belvedere / Viale del Castello 37 |
| Codici display | WAIT→SELECT, PUSH→START, OPEN→LOCK, ALERT→ERR, ERR-12→ERR-01 |
| "central de pago" | → `totem di pagamento` (multi-lang) |
| Modelli macchina | HS60xx → WM-100, ED340 → DM-200 *(pending conferma)* |
| Prefisso codice sconto | SAU → **BC** |
| Email demo | `support@demowash.demo` |
| URL form rimborso | `https://demowash.demo/refund` |
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
9. Documenti `docs/demowash/` root — tenere/eliminare?
10. Prezzi shift random (+0.50€) per evitare matching listini pubblici?

---

# CHECKPOINT 0 — Duplicazione fedele

**Obiettivo**: `custom-demowash/` = copia 1:1 di `custom-demowash/`. Niente cambio logico/contenuto. Verifica che la copia compili e i test passino identici.

## 🟢 `npm run demo` funzionerà dentro la nuova cartella?

**SÌ, out-of-the-box** (con 2 accortezze sotto). Verificato:

- Lo script `"demo": "node --import tsx agent.ts"` in `package.json` è **path-relativo** — gira nella cwd dove lanci `npm`
- `.env` è cercato con `path.resolve(path.dirname(import.meta.url), '.env')` → **accanto a `agent.ts`** (cioè dentro `custom-demowash/`)
- Config JSON (settings, locations, faqs, i18n, washer, dryer, display-flows, nlu-patterns): in [`utils/runtime.ts:185-186`](../custom-demowash/utils/runtime.ts#L185) `flowDir = path.resolve(demoDir, 'json')` — tutto relativo al modulo
- Test (`test:unit`, `test:agent`, `typecheck`) idem: nessun path assoluto hardcoded a `custom-demowash/`

**Quindi** una volta che `custom-demowash/` contiene la stessa struttura di file, `npm run demo` parte e funziona uguale.

### 🟡 Accortezza A — `.env` (ANDREA LO GESTISCE)

> **Decisione Andrea 2026-05-26**: *"il .env lo farò io, tu mettilo nel piano e al massimo me lo ricordi"*

Regola CLAUDE.md: **NEVER touch `.env`**. Quindi al Checkpoint 0 io **NON copio/scrivo** mai il `.env`. È Andrea a popolarlo.

**Reminder per Andrea** — fra Step 0.2 (rm pulizia) e Step 0.4 (npm install + gates), inserire il `.env` in `apps/backend/custom-demowash/.env`. Tre opzioni che puoi scegliere tu:

- **(a)** `cp apps/backend/custom-demowash/.env apps/backend/custom-demowash/.env` — copia indipendente (file separato, modificabile)
- **(b)** `ln -s ../custom-demowash/.env apps/backend/custom-demowash/.env` — symlink, condivide la chiave OpenRouter
- **(c)** `.env` nuovo dedicato a Demowash (utile se vuoi SMTP diverso per la demo, es. con `support@demowash.demo`)

⚠️ **Se manca il `.env`**: `npm run typecheck` e `npm run test:unit` passano comunque (non leggono OPENROUTER_API_KEY al boot), ma `npm run demo` parte e fallisce alla prima chiamata LLM con `OPENROUTER_API_KEY missing`. Quindi al gate del Checkpoint 0 ricorderò ad Andrea **DOPO** typecheck/test, **PRIMA** dello smoke CLI.

### 🟡 Accortezza B — `node_modules` e lock
`cp -r` copierebbe anche `node_modules` (può causare path-resolution bug di tsx). Lo Step 0.2 li elimina e Step 0.4 fa `npm install` pulito.

### ⚠️ Da ricordare al Checkpoint 4
[`utils/runtime.ts:209-210`](../custom-demowash/utils/runtime.ts#L209) ha hardcoded i filename modello macchina:
```typescript
const washer = JSON.parse(await readFile(path.join(flowDir, 'washer_hs60xx.json'), 'utf8'))
const dryer  = JSON.parse(await readFile(path.join(flowDir, 'dryer_ed340.json'), 'utf8'))
```
Quando rinomineremo i file (Step 4.3: `washer_hs60xx.json` → `washer_wm100.json`, `dryer_ed340.json` → `dryer_dm200.json`), questi 2 import vanno aggiornati in `runtime.ts`. Già previsto in Step 4.3 — qui solo nota.

## Step 0.1 — Copia ricorsiva
```bash
cp -r apps/backend/custom-demowash apps/backend/custom-demowash
```

## Step 0.2 — Pulizia file inutili nella copia
```bash
cd apps/backend/custom-demowash
rm -f package-lock.json
rm -rf node_modules dist
rm -rf .tmp-i18n-patch
```
**NB**: il file `migrate.md` e `plan.md` (creato a mano prima) restano nella cartella. Spostali temporaneamente se intralciano:
```bash
# Solo se necessario:
mv migrate.md plan.md /tmp/demowash-docs/
```

## Step 0.3 — Conserva i contenuti originali per riferimento
**NON eliminare ancora** `testingLLM.md`, `docs/pdf/`, `docs/testing-llm-report-*.md` — li elimineremo al Checkpoint 4 dopo aver verificato che non servono.

## Step 0.4 — Verifica gates (devono restare verdi)
```bash
cd apps/backend/custom-demowash
npm install
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```
Se uno dei 4 fallisce → STOP, capire perché la copia non è identica all'originale.

## Step 0.5 — Verifica integrità
```bash
diff -r apps/backend/custom-demowash apps/backend/custom-demowash \
  --exclude=node_modules --exclude=dist --exclude=package-lock.json \
  --exclude=migrate.md --exclude=plan.md
```
Atteso: nessun diff (a parte i file esclusi).

## ✅ Checkpoint 0 — Done when:
- [ ] Cartella `custom-demowash/` esiste
- [ ] `npm install` ha rigenerato `package-lock.json`
- [ ] `npm run typecheck` verde
- [ ] `npm run test:unit` verde (~70 test)
- [ ] `bash scripts/check-architecture.sh` verde
- [ ] 🔔 **REMINDER ad Andrea**: copia/symlink `.env` in `apps/backend/custom-demowash/.env` (regola Andrea: Claude non tocca `.env`)
- [ ] Smoke CLI opzionale: `echo "hola" | npm run demo` → bot saluta (richiede `.env` con OPENROUTER_API_KEY)
- [ ] **Andrea fa commit**: `git add apps/backend/custom-demowash && git commit -m "demowash: checkpoint 0 — copia fedele da custom-demowash"`

---

# CHECKPOINT 1 — Rename tecnico (identifier-only)

**Obiettivo**: cambiare gli identifier tecnici (folder già fatto, slug interni, package name, module id) senza toccare contenuto/brand visibile. Il bot deve continuare a parlare di "Demowash" perché il rebrand è il prossimo checkpoint.

## Step 1.1 — Rename package npm
File: `apps/backend/custom-demowash/package.json`
```diff
- "name": "demowash-demo",
+ "name": "demowash",
- "description": "Demowash Chatbot — LLM-as-agent with deterministic guards",
+ "description": "Demowash Chatbot — LLM-as-agent with deterministic guards",
  "keywords": [
    "chatbot",
-   "demowash",
-   "demowash",
+   "demowash",
+   "llm-agent"
  ],
```
Eseguire `npm install` per rigenerare `package-lock.json` con il nuovo name.

## Step 1.2 — Rename module identifier interno
File: `apps/backend/custom-demowash/index.ts:65`
```diff
- const agentChain: string[] = ['custom-demowash']
+ const agentChain: string[] = ['custom-demowash']
```

## Step 1.3 — Path commenti JSDoc (interni al modulo)
Sed delle occorrenze `custom-demowash` SOLO nei commenti TS/JS (non nelle stringhe brand):
```bash
cd apps/backend/custom-demowash
grep -rl 'custom-demowash' --include='*.ts' | xargs sed -i '' 's|custom-demowash|custom-demowash|g'
```
File attesi modificati: `models/chatbot-io.ts`, `models/index.ts`, `models/runtime.ts`, `models/i18n.ts`, `utils/human-message-email.ts`, `docs/architecture.md`, `CLAUDE.md`, ecc. **Solo i commenti — il brand "Demowash" resta invariato.**

## Step 1.4 — Verifica anti-double-rename
```bash
# Non deve restare nessun "custom-demowash" nel modulo demowash:
grep -rn 'custom-demowash' apps/backend/custom-demowash/ | grep -v node_modules
# Atteso: 0 risultati
```

## Step 1.5 — Gates
```bash
cd apps/backend/custom-demowash
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## Step 1.6 — Smoke test CLI (opzionale, costa OpenRouter)
```bash
cd apps/backend/custom-demowash
echo "hola" | npm run demo
# Atteso: bot risponde con welcome Demowash (brand ancora invariato)
```

## ✅ Checkpoint 1 — Done when:
- [ ] `package.json` name = `demowash`
- [ ] `package-lock.json` rigenerato
- [ ] `agentChain` = `['custom-demowash']`
- [ ] 0 occorrenze `custom-demowash` dentro `custom-demowash/`
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] **Andrea commit**: `"demowash: checkpoint 1 — rename tecnico (slug/package/module)"`

---

# CHECKPOINT 2 — Rebrand display (Demowash → Demowash)

**Obiettivo**: il bot inizia a chiamarsi Demowash nei testi visibili. Dati location/codici/programmi/email restano REALI ancora (rischio leak medio, ma controllato).

## Step 2.1 — Settings (cuore del branding)
File: `apps/backend/custom-demowash/json/settings.json`
```diff
- "_comment": "Tenant configuration for Demowash / demowash. …",
+ "_comment": "Tenant configuration for Demowash / demowash. …",
- "chatbotName": "Eco",
+ "chatbotName": "Blu",                    // pending Andrea: Blu / Bubbles / Clean
- "companyName": "Demowash",
+ "companyName": "Demowash",
```
**NON toccare ancora**: `discountCodePrefix`, `supportEmails`, `notificationEmails`, `smtp`, `refundFormUrl`, `allowedExternalLinks` — sono in Checkpoint 4.

## Step 2.2 — i18n × 6 lingue
File: `json/i18n/{es,it,en,ca,pt,fr}.json` — sostituire la parola "Demowash" nelle chiavi che la contengono. Cercare prima:
```bash
grep -n 'Demowash' apps/backend/custom-demowash/json/i18n/*.json
```
Chiavi attese: `washDryTime`, `detergents`, `paymentMethods`, `appDownload` (e poche altre). Replace `Demowash` → `Demowash` **manualmente** per ogni lingua (è una parola che cambia significato nel contesto della frase).

Aggiornare anche il `_comment` di ogni file i18n:
```diff
- "_comment": "Localised strings for tenant demowash (Demowash). …",
+ "_comment": "Localised strings for tenant demowash (Demowash). …",
```

## Step 2.3 — FAQs
File: `json/faqs.json`
- `washDryTime`: "En Demowash …" → "En Demowash …"
- `detergents`: "Las máquinas Demowash …" → "Las máquinas Demowash …"
- `paymentMethods`: "App Demowash" → "App Demowash" (NB: il dominio app reale Domus si chiama "Demowash" — qui anonimizziamo come app generica)
- `appDownload`: "Búscala como Demowash …" → "Búscala como Demowash …"

## Step 2.4 — Fallback hardcoded in runtime.ts
File: `utils/runtime.ts:298`
```diff
- companyName: settings.companyName || 'Demowash',
+ companyName: settings.companyName || 'Demowash',
```

## Step 2.5 — Header OpenRouter (telemetria)
- `utils/agent-llm.ts:63`: `'X-Title': 'Demowash Agent'` → `'Demowash Agent'`
- `utils/llm.ts:80`: `'X-Title': 'Demowash'` → `'Demowash'`

## Step 2.6 — Detector anti-impersonation
File: `utils/agent-welcome.ts:68`
```diff
- const isAssistantPhrase = /\b(asistente virtual|…|assistant virtuel)\s+de?\s+demowash\b/i.test(n)
+ const isAssistantPhrase = /\b(asistente virtual|…|assistant virtuel)\s+de?\s+demowash\b/i.test(n)
```

## Step 2.7 — Router prompt
File: `prompts/router.txt:5`
```diff
- You are the FIRST-TURN ROUTER of a multilingual chatbot for the Demowash self-service laundromat chain (Spain).
+ You are the FIRST-TURN ROUTER of a multilingual chatbot for the Demowash self-service laundromat chain.
```
*(Il taglio di "(Spain)" è già concordato per anonimizzazione regione — sez. 3.3.3 di migrate.md)*

## Step 2.8 — Stringhe brand sparse
- `agent.ts:712`: `'Demowash Agent Demo (Step X)'` → `'Demowash Agent Demo (Step X)'`
- `utils/locations.ts:1` commento: `// Single source of truth for the 6 Demowash laundromats.` → `// Single source of truth for the 6 Demowash laundromats.`
- `models/runtime.ts:63` JSDoc: `Tenant brand name, e.g. "Demowash"` → `"Demowash"`
- `models/i18n.ts:30`: idem
- `models/chatbot-io.ts:1`: `Public contract between the demowash chatbot …` → `… demowash chatbot …`
- `models/index.ts:1`: `Barrel re-export for demowash type definitions` → `demowash`

## Step 2.9 — Aggiornare i test affetti
Test che assertano `companyName === 'Demowash'`:
```bash
grep -rln 'Demowash' apps/backend/custom-demowash/__tests__/
# Atteso: 3-4 file (_helpers.ts, branch-dispatcher.test.ts, f-log-regression.test.ts, human-message-email.test.ts)
```
Aggiornare gli assert hardcoded a `'Demowash'`. **NON toccare la logica del test, solo i valori attesi.**

## Step 2.10 — README + CLAUDE.md
- `README.md`: titolo "Demowash Chatbot" → "Demowash Chatbot"; sezioni successive
- `CLAUDE.md`: header `# custom-demowash — Orchestration rules` → `# custom-demowash`

## Step 2.11 — Gates anti-leak parziale
```bash
cd apps/backend/custom-demowash
# Brand visibile non deve più contenere "Demowash" o "demowash" come slug:
grep -rni 'demowash\|Demowash' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf
# Atteso: 0 risultati (a parte i 2 doc file di progetto)

# Test verdi:
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```

## ✅ Checkpoint 2 — Done when:
- [ ] settings.json: companyName=Demowash, chatbotName=Blu (o scelta Andrea)
- [ ] i18n × 6 lingue aggiornati (~5 chiavi cadauno)
- [ ] faqs.json aggiornato
- [ ] runtime.ts fallback aggiornato
- [ ] Header OpenRouter aggiornati
- [ ] Detector agent-welcome.ts aggiornato
- [ ] router.txt aggiornato
- [ ] Test fixture (`_helpers.ts` + 3 test) aggiornati
- [ ] README.md + CLAUDE.md aggiornati
- [ ] 0 occorrenze `Demowash`/`demowash` nel modulo (esclusi migrate.md/plan.md)
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] Smoke CLI: `echo "hola" | npm run demo` → bot saluta come "Demowash"
- [ ] **Andrea commit**: `"demowash: checkpoint 2 — rebrand display (Demowash→Demowash)"`

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
- `agent.ts:192-193, 323, 342` — commenti citano "Mataró/Rubí" come esempi
- `utils/state-transitions.ts:258-260` — idem

Solo commenti: sostituire con nuovi quartieri demo (es. "Mataró" → "Marina", "Rubí" → "Olivetto").

## Step 3.5 — Test helpers e fixture
- `__tests__/unit/_helpers.ts` — se contiene location reali nelle fixture, sostituire
- Altri test che fanno match esatto su "Mataró"/"Rubí" — aggiornare

## Step 3.6 — Prompts
- `prompts/router.txt` — esempi multi-lang con "Mataró"/"Rubí" → "Marina"/"Olivetto"
- `prompts/agent.txt` — verifica

## Step 3.7 — Doc interni
- `docs/usecases.md` — riscrittura completa rimandata al Checkpoint 5 (è incluso nella riduzione 47→13)
- `docs/reglas.md` — sanitize riferimenti location
- `docs/architecture.md` — header `Architecture — demowash` → `demowash`, path commenti
- `docs/f-log.md` — decisione separata (Checkpoint 5: reset/sanitize/keep)

## Step 3.8 — Gates anti-leak geografico
```bash
cd apps/backend/custom-demowash
# 0 risultati attesi su location reali:
grep -rni 'Sant Cugat\|Mataró\|Eixample\|Rubí\|Escala\|Platja\|Castell.*Aro\|Playa.*Aro' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf | grep -v testingLLM | grep -v testing-llm-report
grep -rni 'Sant Cugat\|Mataró\|Mataro' . | grep -v node_modules | grep -v migrate.md | grep -v plan.md | grep -v docs/pdf | grep -v testingLLM | grep -v testing-llm-report
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
- [ ] **Andrea commit**: `"demowash: checkpoint 3 — anonimizzazione geografica (città/quartieri/vie/landmark)"`

---

# CHECKPOINT 4 — Anonimizzazione fingerprint tecnici

**Obiettivo**: rimuovere tutti i fingerprint settoriali (codici Domus, central de pago, modelli macchina, prefisso SAU, email/URL reali, lingue, CSV catalani). Dopo questo checkpoint, un esperto del settore non riconosce il cliente.

## Step 4.1 — Codici display
Sostituzione coordinata in **40+ file** (vedi sez. 3.4.1 di `migrate.md`):

**Mapping**:
- `WAIT` → `SELECT`
- `PUSH` → `START` (inclusa dicitura "SELECT" → "START PROG")
- `OPEN` → `LOCK`
- `ALERT` → `ERR`
- `BLOCK` → `ERR`
- `ERR-12` → `ERR-01`
- `ERR-01` → `ERR-01` (in CSV alarmes)
- `ALERT OPEN` → `ERR-LOCK`

**Ordine sostituzioni** (importante — più lunghe per prime per evitare match parziali):
1. `ALERT OPEN` → `ERR-LOCK`
2. `ERR-12` → `ERR-01`
3. `SELECT` → `START PROG`
4. `WAIT` → `SELECT` (whole word `\bSEL\b`)
5. `PUSH` → `START` (whole word)
6. `OPEN` → `LOCK` (whole word)
7. `ALERT` → `ERR` (whole word, dopo aver fatto ALERT OPEN)
8. `BLOCK` → `ERR` (whole word)
9. `ERR-01` → `ERR-01` (solo in `alarmes-*.csv`, ATTENZIONE: non sostituire `ERR-01` in altri contesti tipo `T-001`)

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
cd apps/backend/custom-demowash/json
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
+   "invoice": "support@demowash.demo",
+   "support": "support@demowash.demo"
  },
- "notificationEmails": "gelsogrove@gmail.com",
+ "notificationEmails": "support@demowash.demo",
  "smtp": {
-   "user": "gelsogrove@gmail.com",
-   "pass": "bhfg vynq uwqm jckm",
+   "user": "support@demowash.demo",
+   "pass": "<DEMO_PLACEHOLDER>",     // SMTP demo: real send disabilitato
    …
-   "from": "gelsogrove@gmail.com"
+   "from": "support@demowash.demo"
  },
- "refundFormUrl": "https://forms.gle/XFGPAd9581AhC9eu7",
+ "refundFormUrl": "https://demowash.demo/refund",
- "allowedExternalLinks": "echatbot.ai, www.echatbot.ai, forms.gle, alberwaz.net",
+ "allowedExternalLinks": "echatbot.ai, www.echatbot.ai, demowash.demo",
```

**⚠️ DECISIONE PENDING (Andrea Domanda #8)**: se vuoi mantenere SMTP funzionante per testare escalation in locale, **tenere `smtp.user/pass/from` come gelsogrove@gmail.com** ma cambiare solo `supportEmails`, `notificationEmails`, `refundFormUrl`, `allowedExternalLinks`.

**File i18n × 6 lingue** (chiavi `doubleCharge` + `refundRequest`):
- ES (`json/i18n/es.json` + `json/faqs.json`)
- IT, EN, CA, PT, FR (in `json/i18n/<lang>.json`)

Per ogni file, sostituire:
- `https://forms.gle/XFGPAd9581AhC9eu7` → `https://demowash.demo/refund`
- `service@alberwaz.net` → `support@demowash.demo`

## Step 4.6 — Ordine `enabledLanguages`
File: `json/settings.json`
```diff
- "enabledLanguages": ["es", "ca", "en", "it", "fr", "pt"],
+ "enabledLanguages": ["es", "en", "it", "fr", "ca", "pt"],
```
`defaultLanguage: "es"` resta (concordato).

## Step 4.7 — CSV rinomina (catalano → inglese neutro)
```bash
cd apps/backend/custom-demowash/docs/csv
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

## Step 4.9 — Elimina file storici Demowash
```bash
cd apps/backend/custom-demowash
rm -f testingLLM.md
rm -f docs/testing-llm-report-2026-05-24.md
rm -rf docs/pdf
```

## Step 4.10 — Gates anti-leak fingerprint
```bash
cd apps/backend/custom-demowash
# Nessun codice Domus/Girbau:
grep -rni '\bSEL\b\|\bPUSH\b\|\bDOOR\b\|\bALM\b\|\bERR-12\b' . --include='*.json' --include='*.ts' --include='*.md' --include='*.csv' --include='*.txt' | grep -v node_modules
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
- [ ] Codici display sostituiti (WAIT→SELECT, PUSH→START, OPEN→LOCK, ALERT→ERR, ERR-12→ERR-01) in ~40 file
- [ ] "central de pago"/"centralita" → "totem di pagamento" multi-lang in ~10 file
- [ ] Modelli macchina rinominati (file + flow keys + sigle interne)
- [ ] SAU → BC ovunque
- [ ] Email/URL fittizi `support@demowash.demo` + `demowash.demo/refund`
- [ ] enabledLanguages riordinato
- [ ] 9 CSV rinominati in inglese neutro
- [ ] PDF/testingLLM eliminati
- [ ] 4 grep anti-leak fingerprint = 0 risultati
- [ ] typecheck + test:unit + check-architecture verdi
- [ ] **Andrea commit**: `"demowash: checkpoint 4 — anonimizzazione fingerprint tecnici"`

---

# CHECKPOINT 5 — Riduzione usecases (47 → 13 Casi)

**Obiettivo**: `usecases.md` snello con i 13 Casi business-critical concordati. Tutti gli altri 34 Casi eliminati. `cases.json` bridge aggiornato.

## Step 5.1 — Backup completo
```bash
cp apps/backend/custom-demowash/docs/usecases.md /tmp/usecases-backup-$(date +%Y%m%d).md
cp apps/backend/custom-demowash/json/cases.json /tmp/cases-backup-$(date +%Y%m%d).json
```

## Step 5.2 — Identifica e taglia i 34 Casi da eliminare
Casi da TENERE (con mapping al loro N° originale):
```
Caso  1 (Orari) ............... ← originale Caso 12 + Caso 36
Caso  2 (Prezzi) .............. ← originale Caso 12 + Caso 37/38
Caso  3 (Come funziona) ....... ← originale Caso 35 + Caso 45 + Caso 42
Caso  4 (Non funziona lavatrice) ← originale Caso 2 (OPEN→LOCK)
Caso  5 (Non funziona — START PROG) ← originale Caso 1 (SELECT→START PROG)
Caso  6 (Non mi dà il resto) .. ← originale Caso 19 (Mataró→Marina)
Caso  7 (Pagato due volte) .... ← originale Caso 6 (doble cobro)
Caso  8 (Ho pagato e non si attiva) ← originale Caso 4
Caso 8.1 (Cambio dato, non parte) ← variante Caso 4 + Caso 7
Caso  9 (È partito un allarme) ← originale Caso 5 (ERR-12→ERR-01) + Caso 16
Caso 10 (Parlare con operatore) ← originale Caso 25
Caso 11 (Voglio la fattura) ... ← originale Caso 9
Caso 12 (Tessera fidelizzazione) ← originale Caso 10 + Caso 11
Caso 13 (Tessera altro quartiere) ← originale Caso 10.2 (adattato)
```

Casi da ELIMINARE: 3, 7 (orig.), 8 (orig.), 13-18, 21-24, 26-32, 33-34, 36-46.
*(NB: Caso 6, 9, 10 originali sono TENUTI e remappati; non confondere con numeri demo)*

## Step 5.3 — Riscrittura `usecases.md`
Per ciascuno dei 13 Casi tenuti:
1. **Trovare la sezione originale** (es. Caso 2 originale = "OPEN")
2. **Estrarla** mantenendo struttura: criterios + Conversación multi-lang
3. **Rinumerare** secondo nuovo schema demo
4. **Sanitizzare**:
   - Codici display (OPEN→LOCK, ecc.)
   - Location (Mataró→Marina, ecc.)
   - Brand (Demowash→Demowash) ← già fatto in Checkpoint 2
   - "central de pago"→"totem di pagamento" ← già fatto in Checkpoint 4
   - SAU→BC se applicabile
   - URL forms.gle→demowash.demo/refund
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
- (a) **Reset a F0** — pulizia totale, log "F0 — clean slate for Demowash demo"
- (b) **Sanitize 105 entries** — mantengo storia ma rimuovo riferimenti Demowash/Mataró/etc.
- (c) **Tenere as-is** — rischio leak

**Raccomandato**: (a) per la demo. È un fork pulito.

## Step 5.7 — Gates
```bash
cd apps/backend/custom-demowash
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
cd apps/backend/custom-demowash
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
- [ ] **Andrea commit**: `"demowash: checkpoint 5 — riduzione usecases (47→13)"`

---

# CHECKPOINT 6 — Integrazione backend + DB seed

**Obiettivo**: il modulo `custom-demowash` è caricabile dal backend principale tramite `workspace.customChatbotId === "demowash"`. Frontend ha una route `/demo/demowash` parallela.

## Step 6.1 — `src/application/services/custom-client-chatbot.service.ts`
**Decisione (Opzione A — coesistenza)**: il resolver legge `workspace.customChatbotId` dinamico, niente cambio necessario per supportare `demowash`. Però i fallback hardcoded (linee 199-210) attualmente puntano solo a "demowash":
```diff
  private resolveChatbotId(params: InvokeParams): string | null {
    if (params.customChatbotId) {
      return params.customChatbotId.trim()
    }
-   if (params.workspaceSlug?.toLowerCase() === "demowash") {
-     return "demowash"
-   }
+   if (params.workspaceSlug?.toLowerCase() === "demowash") return "demowash"
+   if (params.workspaceSlug?.toLowerCase() === "demowash")  return "demowash"
    if (this.customClient0WorkspaceIds.has(params.workspaceId)) {
      return "demowash"
    }
    return null
  }
```
Aggiornare anche commenti JSDoc che citano "demowash".

## Step 6.2 — `src/application/services/escalation-email.service.ts`
**Problema** (sez. 4.1 di migrate.md): import statico hardcoded:
```typescript
const mod = await import('../../../custom-demowash/utils/human-message-email')
```
**Soluzione raccomandata (opzione a — refactor dinamico)**: parametrizzare via chatbotId.
```diff
- const mod = await import('../../../custom-demowash/utils/human-message-email')
+ const folderName = chatbotId.startsWith('custom-') ? chatbotId : `custom-${chatbotId}`
+ const mod = await import(`../../../${folderName}/utils/human-message-email`)
```
Aggiornare anche il chiamante per passare `chatbotId`.

**Soluzione minima (opzione b)**: doppio import try/catch:
```typescript
let mod
try { mod = await import('../../../custom-demowash/utils/human-message-email') }
catch { mod = await import('../../../custom-demowash/utils/human-message-email') }
```

→ ASK Andrea Domanda #12: a o b? **Raccomandato a** (clean).

## Step 6.3 — `src/interfaces/http/controllers/playground.controller.ts`
**Critico** (linee 13-83): cache singleton `DEMOWASH_SLUG` + path fallback hardcoded.

```diff
- const DEMOWASH_SLUG = "demowash"
- let demowashWorkspaceIdCache: string | null = null
+ const DEFAULT_DEMO_SLUG = process.env.DEFAULT_DEMO_SLUG || "demowash"
+ const workspaceIdCache = new Map<string, string>()
```
Rifattorizzare `getDemowashWorkspaceId()` in `getDemoWorkspaceId(slug)` con cache per-slug.

I 3 path di fallback `custom-demowash/docs/usecases.md` (linee 80-83): rimuovere il fallback o estendere a `custom-<slug>/docs/usecases.md` dinamico (già parzialmente fatto nelle prime 3 linee 77-79).

## Step 6.4 — Logger pipeline tag
File: `src/interfaces/http/controllers/ultramsg-webhook.controller.ts` + `whatsapp-webhook.controller.ts` + `widget-chat.controller.ts`.

Logger tag attualmente hardcoded `pipeline: 'custom-demowash'`. Sostituire con dinamico:
```diff
- pipeline: 'custom-demowash',
+ pipeline: `custom-${chatbotId}`,
```

## Step 6.5 — Frontend routes + utente DEMO scope-limitato

**Decisione Andrea 2026-05-26** (https://www.echatbot.ai/demo/demowash):
- Aggiungere route `/demo/demowash` (parallela a `/demo/demowash`)
- Login dedicato: **utente `DEMO` / password `Admin123`**
- **Scope-limitato**: `DEMO` accessibile SOLO su `/demo/demowash` (su `/demo/demowash` restano ANDREA/OLGA)
- **Workspace isolato**: chat/TODO/commenti di DEMO vanno sul workspace `demowash` (slug=demowash, creato in Step 6.6)
- **Permessi pieni**: DEMO può chattare + creare/modificare TODO + commentare (stessa logica ANDREA/OLGA)

### Step 6.5.a — Route in `apps/frontend/src/App.tsx`
```diff
  {/* Demowash Playground — hardcoded login (ANDREA/OLGA), no providers */}
  <Route path="/demo/demowash/*" element={<PlaygroundPage />} />
+
+ {/* Demowash Playground — hardcoded login (DEMO), no providers */}
+ <Route path="/demo/demowash/*" element={<PlaygroundPage clientSlug="demowash" />} />
```

### Step 6.5.b — Parametrizzazione di `PlaygroundPage.tsx`

**Decisione (Andrea Domanda #13)**: **parametrizzazione** invece di fork (no duplicazione codice; il valore tecnologico è 1 solo componente che cambia tenant via prop).

#### B.1 — Props del componente
```typescript
type PlaygroundPageProps = {
  clientSlug?: "demowash" | "demowash"  // default "demowash" per backward-compat
}

export default function PlaygroundPage({ clientSlug = "demowash" }: PlaygroundPageProps) {
  // ...
}
```

#### B.2 — `ALLOWED_USERS` per-tenant
Sostituire la costante hardcoded con una mappa per-tenant:

```typescript
// PRIMA (linee 57-60):
const ALLOWED_USERS = {
  ANDREA: { password: "Admin123", color: "#2563eb" },
  OLGA:   { password: "Admin123", color: "#db2777" },
} as const

// DOPO:
const ALLOWED_USERS_BY_TENANT = {
  demowash: {
    ANDREA: { password: "Admin123", color: "#2563eb" },
    OLGA:   { password: "Admin123", color: "#db2777" },
  },
  demowash: {
    DEMO:   { password: "Admin123", color: "#0ea5e9" },  // azzurro = brand Demowash
  },
} as const

// All'interno del componente:
const ALLOWED_USERS = ALLOWED_USERS_BY_TENANT[clientSlug]
type PlaygroundUser = keyof typeof ALLOWED_USERS
```

#### B.3 — Storage keys per-tenant (anti-collision in localStorage)
```typescript
// PRIMA (linee 123-125):
const TITLE_STORAGE_KEY    = "demowash-demo-chat-titles"
const FEEDBACK_STORAGE_KEY = "demowash-demo-chat-feedback"
const ORDER_STORAGE_KEY    = "demowash-demo-chat-order"

// DOPO:
const TITLE_STORAGE_KEY    = `${clientSlug}-demo-chat-titles`
const FEEDBACK_STORAGE_KEY = `${clientSlug}-demo-chat-feedback`
const ORDER_STORAGE_KEY    = `${clientSlug}-demo-chat-order`
```
Così Demowash e Demowash hanno store separati nello stesso browser.

#### B.4 — Path basePath check (linee 254)
```typescript
// PRIMA:
const isBasePath = window.location.pathname === "/demo/demowash" || window.location.pathname === "/demo/demowash/"

// DOPO:
const basePath = `/demo/${clientSlug}`
const isBasePath = window.location.pathname === basePath || window.location.pathname === `${basePath}/`
```

Stesso pattern per le altre 8 occorrenze di `/demo/demowash` (kanban links, todo links, navigate calls) — sostituire con `/demo/${clientSlug}/...`.

#### B.5 — Default user da query-string auth (linee 251-252)
```typescript
// PRIMA:
localStorage.setItem("playgroundUser", "ANDREA")
setUser("ANDREA")

// DOPO — default user = primo utente disponibile per il tenant:
const defaultUser = Object.keys(ALLOWED_USERS)[0] as PlaygroundUser  // ANDREA per demowash, DEMO per demowash
localStorage.setItem("playgroundUser", defaultUser)
setUser(defaultUser)
```

#### B.6 — Label brand nella LoginScreen (linea 298 + 346)
```typescript
// PRIMA:
<h1 className="text-2xl font-bold text-center text-emerald-700">
  Demowash Playground
</h1>

// DOPO:
const brandName = clientSlug === "demowash" ? "Demowash" : "Demowash"
const brandColor = clientSlug === "demowash" ? "text-sky-700" : "text-emerald-700"
<h1 className={`text-2xl font-bold text-center ${brandColor}`}>
  {brandName} Playground
</h1>
```

Stesso pattern per il titolo nella top-bar `<h1>Demowash Playground</h1>` (linea 346).

### Step 6.5.c — Backend: estensione `ALLOWED_USERS` in `playground.controller.ts`

File: `apps/backend/src/interfaces/http/controllers/playground.controller.ts:45`

**Decisione "scope-limitato"**: il controller deve validare che `DEMO` può scrivere solo sul workspace `demowash`, e `ANDREA`/`OLGA` solo su workspace `demowash`.

```diff
- const ALLOWED_USERS = ["ANDREA", "OLGA"] as const
- type PlaygroundUser = (typeof ALLOWED_USERS)[number]
+ const ALLOWED_USERS_BY_WORKSPACE: Record<string, readonly string[]> = {
+   demowash: ["ANDREA", "OLGA"],
+   demowash:  ["DEMO"],
+ } as const
+ const ALL_ALLOWED_USERS = Object.values(ALLOWED_USERS_BY_WORKSPACE).flat()
+ type PlaygroundUser = "ANDREA" | "OLGA" | "DEMO"

  function isAllowedUser(name: unknown): name is PlaygroundUser {
-   return typeof name === "string" && ALLOWED_USERS.includes(name as PlaygroundUser)
+   return typeof name === "string" && ALL_ALLOWED_USERS.includes(name)
+ }
+
+ async function isUserAllowedForWorkspace(name: PlaygroundUser, workspaceId: string): Promise<boolean> {
+   const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } })
+   if (!ws?.slug) return false
+   const allowedForWs = ALLOWED_USERS_BY_WORKSPACE[ws.slug]
+   return allowedForWs?.includes(name) ?? false
  }
```

Poi nei 3 punti dove appare `isAllowedUser(createdBy)` (linee 160, 588, 626), aggiungere il check workspace-aware:
```typescript
if (!isAllowedUser(createdBy)) return res.status(403).json({ error: "Invalid user" })
const workspaceId = await resolveWorkspaceId(req)
if (!await isUserAllowedForWorkspace(createdBy, workspaceId)) {
  return res.status(403).json({ error: `User ${createdBy} not allowed for this workspace` })
}
```

### Step 6.5.d — Backend: `resolveWorkspaceId` default per-tenant

Oggi `resolveWorkspaceId()` (linea 31-43 di `playground.controller.ts`) ha fallback hardcoded su demowash. Da rendere parametrico:

```diff
+ const SLUG_BY_PATH: Record<string, string> = {
+   "/demo/demowash": "demowash",
+   "/demo/demowash":  "demowash",
+ }
+
  async function resolveWorkspaceId(req: Request): Promise<string> {
    if ((req as any).workspaceId) return (req as any).workspaceId
    const wsId = (req.headers["x-workspace-id"] || req.query.workspaceId) as string
    if (wsId) return wsId
-   return await getDemowashWorkspaceId()
+   // Fallback dal `Referer` header: se la chiamata arriva da /demo/demowash → workspace demowash
+   const referer = req.headers.referer || ""
+   const matchedSlug = Object.entries(SLUG_BY_PATH).find(([prefix]) => referer.includes(prefix))?.[1] || "demowash"
+   return await getDemoWorkspaceId(matchedSlug)
  }
```

Già documentato in Step 6.3 il refactor da `getDemowashWorkspaceId()` a `getDemoWorkspaceId(slug)`. Qui lo combiniamo col routing per-path.

### Step 6.5.e — Verifica: `/demo/demowash` funziona

```bash
# Avvia stack:
npm run dev:all

# 1. Apri http://localhost:3000/demo/demowash
# 2. Vedi LoginScreen con titolo "Demowash Playground" (colore sky)
# 3. Tenta login con ANDREA/Admin123 → rifiutato (non in tenant demowash)
# 4. Tenta login con DEMO/wrong → "Invalid password"
# 5. Login con DEMO/Admin123 → entra
# 6. Manda messaggio "hola" → bot risponde con welcome Demowash
# 7. Crea un TODO → verifica via Prisma Studio che è sul workspace slug=demowash (NON demowash)
# 8. Apri http://localhost:3000/demo/demowash
# 9. Login con DEMO/Admin123 → rifiutato (DEMO non in tenant demowash)
# 10. Login con ANDREA/Admin123 → entra
```

### Step 6.5.f — Aggiornare Sidebar / ChatPage iframe

File: `apps/frontend/src/pages/ChatPage.tsx:2087-2091`
```diff
- src={`/demo/demowash?token=${...}&workspaceId=${...}`}
- title="Demowash Playground"
+ src={`/demo/${tenantSlug}?token=${...}&workspaceId=${...}`}
+ title={`${brandName} Playground`}
```
(`tenantSlug` derivato da `workspace.customChatbotId` o da una nuova prop.)

## Step 6.6 — Workspace Demowash nel DB

> **Decisione Andrea 2026-05-26**: *"in locale si farà il seed, ma in prod devo fare il canale"*

Due ambienti, due percorsi distinti:

### 6.6.LOCAL — Sviluppo (Claude esegue tramite seed.ts)
Workspace creato automaticamente da `seed.ts`. Dati dummy (no WhatsApp reale collegato).

### 6.6.PROD — Produzione su echatbot.ai (Andrea esegue manualmente da backoffice)

> 🔔 **REMINDER timing (Andrea 2026-05-26)**: *"mi dirai tu quando farlo, mettilo nel plan"*
>
> **QUANDO te lo ricorderò**: alla **fine del Checkpoint 7** (smoke test finale locale passato + anti-leak 0 risultati). Solo allora la prod è pronta. Non prima.
>
> **Il mio testo verbatim al momento giusto sarà**: *"Andrea, ora la demo Demowash è verde in locale. Per attivarla su `https://www.echatbot.ai/demo/demowash` vai nel backoffice prod e crea il canale Demowash (steps qui sotto)."*

Andrea va nel backoffice e **crea manualmente il canale Demowash** come fa per gli altri clienti reali:
1. Login admin su `https://www.echatbot.ai`
2. Workspaces → Create new
3. Nome: `Demowash`, Slug: `demowash`, `customChatbotId: demowash` (campo in AI Personality Section)
4. WhatsappSettings: phone reale, apiKey reale UltraMsg, webhook configurato
5. AgentConfigs / FlowNodeConfigs / Languages: replica del setup Demowash adattato

Quando il workspace prod esiste, `https://www.echatbot.ai/demo/demowash` funziona automaticamente perché:
- Il frontend (Step 6.5) ha la route `/demo/demowash` parametrica
- Il backend (Step 6.5.d) risolve il workspaceId via `slug=demowash` dal DB prod
- Il modulo `apps/backend/custom-demowash/` è caricato dinamicamente quando `customChatbotId=demowash`

**Niente seed da eseguire in prod**. Il seed è dev-only (regola: prod usa migration + creazione manuale da backoffice).

---

### Dettaglio Step 6.6.LOCAL — `packages/database/prisma/seed.ts`

Aggiungere blocco "Creating Demowash workspace" parallelo al blocco Demowash esistente (linee 1543-2491):

```typescript
// ── Demowash demo workspace ─────────────────────────────────
console.log("🏢 Creating/updating FLOW workspace (Demowash) for admin user...")

let demowashWorkspace = await prisma.workspace.findFirst({
  where: { slug: "demowash" },
})

if (!demowashWorkspace) {
  demowashWorkspace = await prisma.workspace.create({
    data: {
      name: "Demowash",
      slug: "demowash",
      customChatbotId: "demowash",
      // … altri campi clonati dal blocco Demowash, adattati
    },
  })
}

// Associate admin user (idem Demowash pattern)
// WhatsApp settings (idem)
// Languages (riordinate: es, en, it, fr, ca, pt)
// AgentConfigs (riusare ecoAgents pattern)
// FlowNodeConfigs (riusare i 3 flow node con label Demowash)
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
SELECT slug, "customChatbotId" FROM "Workspace" WHERE slug IN ('demowash','demowash');
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
- [ ] `custom-client-chatbot.service.ts` resolver supporta "demowash"
- [ ] `escalation-email.service.ts` refactor (opzione a o b)
- [ ] `playground.controller.ts` parametrizzato per slug demo
- [ ] Logger pipeline tag dinamici
- [ ] Frontend route `/demo/demowash/*` aggiunta
- [ ] `seed.ts` con blocco Demowash workspace
- [ ] DB seed eseguito → 2 workspace (demowash + demowash)
- [ ] Test backend verdi
- [ ] **Andrea commit**: `"demowash: checkpoint 6 — integrazione backend + DB seed"`

---

# CHECKPOINT 7 — Smoke test finale + anti-leak

**Obiettivo**: tutto funziona end-to-end via web. La demo è "demo-ready".

## Step 7.1 — Avvio stack completo
```bash
npm run dev:all
# Atteso: backend su 3001, frontend su 3000, DB su 5434, no errori al boot
```

## Step 7.2 — Web smoke test (5 scenari rappresentativi)
Aprire `http://localhost:3000/demo/demowash` in browser.

Scenari da provare:
1. **Greeting + FAQ**: "hola, que horarios tienen en Marina?" → bot risponde con orari del quartiere Marina
2. **Trouble machine**: "lavadora no funciona, sale LOCK" → bot guida display flow (3-4 turn)
3. **Pagamento problema**: "he pagado y la lavadora 5 no se ha activado en Centro" → gather + 3-strikes
4. **Escalation immediata**: "quiero hablar con un operador YA" → escalation senza gather
5. **Multi-lang**: "che programmi avete a Olivetto?" (IT) → bot risponde in IT con programmi quartiere

Verifica per ciascuno:
- ✅ Lingua sticky (il bot non switcha lingua)
- ✅ Niente parola "Demowash"/"Mataró"/"Mataró"/"central de pago"/"SAU" nel reply
- ✅ Branding "Demowash" visibile
- ✅ Location demo corrette

## Step 7.3 — Final anti-leak grep (11 pattern)
```bash
cd apps/backend/custom-demowash

# Brand:
grep -rni 'demowash\|Demowash' . | grep -v node_modules | grep -v dist | grep -v migrate.md | grep -v plan.md

# Geografia:
grep -rni 'Sant Cugat\|Mataró\|Eixample\|Rubí\|Escala\|Platja\|Castell.*Aro' . | grep -v node_modules | grep -v dist
grep -rni 'Sant Cugat\|Mataró\|Mataro\|Rubí' . | grep -v node_modules | grep -v dist
grep -rni 'Catalonia\|Cataluña\|catalan\|català\|España\|Spain' . | grep -v node_modules | grep -v dist
grep -rni 'Mercadona\|Carrefour' . | grep -v node_modules | grep -v dist

# Fingerprint settoriali:
grep -rni '\bSEL\b\|\bPUSH\b\|\bDOOR\b\|\bALM\b\|\bERR-12\b' . --include='*.json' --include='*.ts' --include='*.md' --include='*.csv' | grep -v node_modules | grep -v dist
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
cd apps/backend/custom-demowash
bash scripts/check-architecture.sh
# Atteso: 8 enforcement check verdi
```

## ✅ Checkpoint 7 — Done when:
- [ ] `npm run dev:all` boot pulito
- [ ] `/demo/demowash` funziona via browser
- [ ] 5 scenari smoke test → tutti coerenti
- [ ] 11 grep anti-leak finali → 0 risultati
- [ ] Test unit backend verdi
- [ ] check-architecture.sh verde
- [ ] **DEMO PRONTA per il cliente**
- [ ] **Andrea commit finale**: `"demowash: checkpoint 7 — demo ready"`

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
- Comunque test che assertano valori hardcoded (`'Demowash'`, `'WAIT'`, `'Mataró'`) DEVONO essere aggiornati ai checkpoint 2/3/4 — è valore atteso che cambia, non logica

## Anti-leak come gate
Ai Checkpoint 3/4/7, i grep anti-leak sono **gate bloccanti**: se uno torna risultati, NON procedere al checkpoint successivo. Fix prima.

## Coordinamento con custom-demowash
`custom-demowash` resta intatto durante tutta la migrazione (Opzione A). Niente modifiche concorrenti. Se Andrea vuole sviluppi paralleli su demowash, farli su branch separato.

---

**End of plan.** Quando Andrea dà OK al Checkpoint 0, parte l'esecuzione.
