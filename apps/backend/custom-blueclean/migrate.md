# Migration Plan — `custom-ecolaundry` → `custom-blueclean`

> **Status**: ANALYSIS ONLY — nessun file ancora duplicato o modificato.
> **Owner**: Andrea
> **Target**: demo per nuovo cliente "BlueClean". Identità del cliente reale (Ecolaundry) **NON deve trapelare**: né brand, né città, né asset, né log.
> **Scope concordato**: (1) rename brand `ecolaundry` → `blueclean`, (2) anonimizzazione delle 6 location reali con nomi fittizi, (3) mantenere dominio lavanderia self-service.

---

## 1 — Sommario esecutivo

`custom-ecolaundry` è un modulo chatbot multi-tenant isolato in `apps/backend/custom-ecolaundry/`. È caricato dinamicamente dal backend principale via `workspace.customChatbotId === "ecolaundry"` (lookup in `custom-client-chatbot.service.ts:199-210`). Il modulo è **a-deps verso il core** (zero import da `src/`), quindi la duplicazione è meccanica: copia cartella → rinomina identifier → trova-e-sostituisci.

**Cardinalità intervento**:

| Area | Files toccati | Occorrenze testuali |
|---|---|---|
| Modulo `custom-ecolaundry/` (interno) | ~30 file | 178 occorrenze `ecolaundry`/`Ecolaundry` |
| Backend `apps/backend/src/` (esterno) | 9 file | ~25 occorrenze + 2 fallback hardcoded |
| Frontend `apps/frontend/src/` | 9 file | ~15 occorrenze (path `/demo/ecolaundry`, storage keys, commenti) |
| Database seed | `packages/database/prisma/seed.ts` | ~50 occorrenze (workspace fixture) |
| Asset/i18n/dati | i18n × 6 lingue, `locations.json`, `faqs.json`, PDF, CSV | Citazioni di brand + nomi località reali |
| Documenti (ecolaundry-specifici) | `docs/ecolaundry/`, `apps/backend/custom-ecolaundry/docs/` | Riferimenti diffusi |

**Tre dimensioni di rename** (NON confonderle):

1. **Identifier tecnico** (slug, folder name, module id, env var):
   - `custom-ecolaundry` → `custom-blueclean` (folder)
   - `ecolaundry` (chatbotId/slug) → `blueclean`
   - `ecolaundry-demo` (package name) → `blueclean-demo`
2. **Brand visibile al cliente** (testi UI/risposte bot):
   - `Ecolaundry` → `BlueClean`
   - `Eco` (chatbotName) → `LaWa` *(suggerimento — Andrea decide)*
3. **Identità del cliente reale** (dati operativi che lo identificano):
   - 6 nomi località catalane → 6 nomi fittizi
   - Indirizzi/CAP → indirizzi fittizi o omessi
   - Riferimenti a CSV/PDF Playbook → mantenere struttura, rimuovere nome cliente

---

## 2 — Mappa del modulo `custom-ecolaundry/`

```
custom-ecolaundry/
├── CLAUDE.md                    # 10 iron rules — referenzia path con nome modulo
├── README.md                    # branding diffuso ("Ecolaundry Chatbot")
├── package.json / package-lock  # name="ecolaundry-demo"
├── tsconfig.json
├── index.ts                     # agentChain: ['custom-ecolaundry']
├── agent.ts                     # commenti, "Ecolaundry Agent Demo"
├── testingLLM.md                # report (cita Goya/Pineda/Mataró)
│
├── prompts/                     # 5 file txt
│   ├── agent.txt                # NON cita brand (good) — solo ruolo
│   ├── router.txt               # cita "Ecolaundry self-service laundromat chain (Spain)"
│   ├── rephrase.txt
│   ├── language.txt
│   └── operator-briefing.txt
│
├── json/
│   ├── settings.json            # companyName="Ecolaundry", chatbotName="Eco", _comment brand, smtp credenziali, refundFormUrl
│   ├── locations.json           # 6 location reali (Hortes/Goya/Alemanya/Pineda/...) + aliases + landmarks + metadata
│   ├── faqs.json                # cita "Ecolaundry" + "App Ecolaundry" + nomi store
│   ├── i18n/{es,it,en,ca,pt,fr}.json  # 279 righe l'una, cita "Ecolaundry" in 5-7 chiavi
│   ├── cases.json               # bridge doc-code (semantic ids, no brand)
│   ├── nlu-patterns.json
│   ├── display-flows.json
│   ├── washer_hs60xx.json       # modello specifico macchine
│   └── dryer_ed340.json
│
├── docs/
│   ├── architecture.md          # cita "ecolaundry", "Ecolaundry"
│   ├── usecases.md              # cita "Ecolaundry" in conversazioni esempio
│   ├── f-log.md                 # F1→F105 log — cita Ecolaundry in commenti
│   ├── reglas.md                # "asistente virtual de Ecolaundry"
│   ├── settings.md              # tabella default companyName="Ecolaundry"
│   ├── contracts.md, orchestrator.md, branch-router-architecture.md, adding-use-cases.md, TESTING.md, testing-llm-report-*.md
│   ├── csv/                     # tables.md + 9 CSV operativi (preus, programes, horaris, locals…)
│   └── pdf/                     # 4 PDF (Playbook + PROGRAMES + SOLUCIÓN…)
│
├── models/                      # 9 file .ts (chatbot-io, runtime, i18n cita "ecolaundry")
├── utils/                       # ~70 file .ts (locations, agent-llm, llm, router-prompt, agent-welcome, human-message-email, runtime cita brand)
│   ├── tool-handlers/, output-invariants/, message-parsing/, intent/, branches/, guards/, agent-extract/
└── __tests__/unit/              # ~70 test .ts (helpers, alcuni file di test citano "ecolaundry")
```

**Statistica chiave**:
- 178 occorrenze testuali `ecolaundry`/`Ecolaundry` dentro il modulo
- 166 occorrenze fuori dal modulo (backend + frontend + seed + docs/ecolaundry)
- Zero import dal core (`src/`) → modulo è **drop-in copiabile**

---

## 3 — Strategia di rename (3 dimensioni separate)

### 3.1 Identifier tecnico (LOWERCASE)

Tutti i seguenti devono cambiare in maniera **coordinata e simultanea** — è la chiave primaria che lega frontend, backend, DB seed, e folder filesystem:

| Token attuale | Sostituire con | Dove appare |
|---|---|---|
| `custom-ecolaundry` (folder) | `custom-blueclean` | filesystem |
| `ecolaundry` (chatbotId / slug / module id) | `blueclean` | `seed.ts`, `playground.controller.ts`, `custom-client-chatbot.service.ts`, frontend routes, DB record |
| `ecolaundry-demo` (npm package name) | `blueclean-demo` | `package.json`, `package-lock.json` |
| `CUSTOM_CLIENT_0_WORKSPACE_IDS` (env var) | invariato — è semantico al codice, lo manteniamo | `custom-client-chatbot.service.ts` (no rename) |
| storage keys frontend (`ecolaundry-demo-chat-titles`, etc.) | `blueclean-demo-chat-titles`, etc. | `PlaygroundPage.tsx` |
| route path `/demo/ecolaundry` | `/demo/blueclean` | `App.tsx`, `ChatPage.tsx`, `PlaygroundPage.tsx` |
| variabili JS (`ecolaundryWorkspaceIdCache`, `getEcolaundryWorkspaceId`, `ECOLAUNDRY_SLUG`, `ecolaundryWorkspace`) | rispettivi `blueclean*` / `BLUECLEAN_SLUG` | `playground.controller.ts`, `seed.ts` |
| log pipeline tag (`'custom-ecolaundry'` in logger.info) | `'custom-blueclean'` | `ultramsg-webhook.controller.ts`, `whatsapp-webhook.controller.ts` |
| `agentChain: ['custom-ecolaundry']` | `agentChain: ['custom-blueclean']` | `custom-blueclean/index.ts` (dopo copia) |
| `X-Title: 'Ecolaundry Agent'`, `'Ecolaundry'` (OpenRouter header) | `'BlueClean Agent'`, `'BlueClean'` | `utils/agent-llm.ts`, `utils/llm.ts` |

### 3.2 Brand cliente (DISPLAY)

Solo testi visibili al cliente finale o all'operatore in chat/email:

| Token attuale | Sostituire con | File chiave |
|---|---|---|
| `Ecolaundry` (parola) | `BlueClean` | `settings.json:companyName`, `i18n/*.json`, `faqs.json`, `router.txt`, `runtime.ts:298`, `agent-welcome.ts:68` |
| `Eco` (chatbotName) | da decidere — opzioni: `LaWa`, `Wash`, `Bub` *(Andrea sceglie)* | `settings.json:chatbotName` |
| `welcomeMessage.{es,it,en,ca,pt,fr}` | aggiornare (oggi: "asistente virtual de la lavandería" — già generico, accettabile per BlueClean; valutare se aggiungere brand) | `settings.json` |
| `smtpFrom: 'Ecolaundry <…>'` | `'BlueClean <…>'` | `seed.ts:1633` |
| `Ecolaundry App` (nelle FAQ payment) | `BlueClean App` o generico `nostra App` | `faqs.json`, `i18n/*.json` chiavi `paymentMethods` + `appDownload` |
| Detector regex `\b…\sde?\s+ecolaundry\b` (riconosce "asistente virtual de ecolaundry") | aggiornare regex con `blueclean` o generalizzare via `companyName` da settings | `utils/agent-welcome.ts:68` |

⚠️ **Rule #15 (English-Only UI)**: vale per backoffice React, NON per i testi del bot rivolti al cliente che restano multilingua. Non confondere.

⚠️ **Caso speciale `chatbotName`**: oggi nei prompt `"Eco"` è iniettato come variabile (`{{chatbotName}}`). Se cambiamo solo `settings.json`, tutti i prompt seguono. Verificare che nessun prompt hardcoda "Eco" (`grep -rn "\\bEco\\b" prompts/ json/`).

### 3.3 Anonimizzazione GEOGRAFICA completa (città + vie + landmark)

**Decisione concordata con Andrea** (sez. 8 risposte):
- **1 città fittizia** (catena single-city, realistico per lavanderie self-service)
- **Città + vie + quartieri inventati** (no toponimi reali, no riferimenti a Spain/Catalonia)
- **Landmark inventati** (non rimossi — preservano la capacità di disambiguare del bot)

**Città fittizia proposta**: `Villanova del Sole` (mediterraneo neutro, non corrisponde a nessuna città reale rilevante). Alternative se non piace: `San Marco`, `Porto Verde`, `Sant'Elia`. → **ASK Andrea: ok Villanova del Sole?**

#### 3.3.1 Mappatura completa delle 6 location

Dati reali letti da [`utils/locations.ts`](../custom-ecolaundry/utils/locations.ts) e [`json/locations.json`](../custom-ecolaundry/json/locations.json):

| # | REALE — canonical / pueblo / address / aliases | DEMO BlueClean — canonical / quartiere / via / aliases |
|---|---|---|
| 1 | `Hortes` / Granollers / `Plaça de les Hortes 4` / `[Granollers, Plaça de les Hortes, Plaza de les Hortes, Plaça Hortes, Plaza Hortes]` | `Centro` / Villanova del Sole — Centro / `Piazza dei Tigli 4` / `[Centro, Piazza dei Tigli, Piazza Tigli, Centro Storico]` |
| 2 | `Goya` / Mataró / `C/ Francisco de Goya 117` / `[Francisco de Goya, C/ Goya, Calle Goya, Goya 117]` | `Marina` / Villanova del Sole — Marina / `Via del Porto 117` / `[Marina, Via del Porto, Porto, Via Porto 117]` |
| 3 | `Alemanya` / Mataró / `C/ Alemanya 17` / `[C/ Alemanya, Calle Alemanya, Alemanya 17]` | `Aurora` / Villanova del Sole — Aurora / `Via dell'Aurora 17` / `[Aurora, Via dell'Aurora, Via Aurora 17, Quartiere Aurora]` |
| 4 | `Pineda` / Pineda de Mar / `Crta. N-II 1, Centro Carrefour` / `[Pineda de Mar, Carrefour Pineda]` | `Olivetto` / Villanova del Sole — Olivetto / `Strada Provinciale 1, Centro Commerciale Sole` / `[Olivetto, Centro Commerciale Sole, CC Sole]` |
| 5 | `L'Escala` / L'Escala / `Av. Girona, Carrefour` / `[Escala, Carrefour Escala]` | `Belvedere` / Villanova del Sole — Belvedere / `Viale del Belvedere, Centro Commerciale Stella` / `[Belvedere, CC Stella, Centro Commerciale Stella]` |
| 6 | `Platja d'Aro` / Platja d'Aro / `Av. Castell d'Aro 37` / `[Platja Aro, Castell d'Aro, …, Playa Aro, …]` | `Castello` / Villanova del Sole — Castello / `Viale del Castello 37` / `[Castello, Viale del Castello, Via Castello 37]` |

**Razionale**:
- Tutti i 6 quartieri (`Centro`, `Marina`, `Aurora`, `Olivetto`, `Belvedere`, `Castello`) sono **distinti senza ambiguità** → niente collisioni nei fuzzy match
- Le **6 vie sono diverse tra loro** → nessuna ambiguità nell'address resolution
- I 2 quartieri Mataró-equivalenti (`Marina` + `Aurora`) restano nella **stessa città fittizia** → preserva la logica di `AMBIGUOUS_PUEBLOES` se serve (ma ora la città è univoca, quindi `AMBIGUOUS_PUEBLOES` può anche svuotarsi — vedi nota sotto)
- I **2 landmark commerciali** (Carrefour Pineda + Carrefour Escala) diventano `Centro Commerciale Sole` + `Centro Commerciale Stella` (brand-free)

⚠️ **`AMBIGUOUS_PUEBLOES`** (oggi: `['Mataró']`): nella nuova mappatura tutte le 6 location stanno in `Villanova del Sole`, quindi la città non disambigua nulla. **Due opzioni**:
- (a) Svuotare il set (`new Set([])`) e affidarsi a `Villanova del Sole` come pueblo univoco
- (b) Spostare l'ambiguità sul concetto "centro città" — ma non serve. Scelgo (a) per semplicità. **ASK Andrea: ok?**

#### 3.3.2 Landmark — mappatura dettagliata

Da [`json/locations.json:metadata.landmarks`](../custom-ecolaundry/json/locations.json) (881 righe, sezione `landmarks` per ciascuna location). Sostituzione totale, **landmark inventati ma plausibili**:

| Location reale → demo | Esempi landmark reali (da locations.json) | Sostituire con (demo) |
|---|---|---|
| Hortes → Centro | "Mercadona di Granollers", "Plaça de les Hortes", "Ajuntament" | "supermercato del Centro", "Piazza dei Tigli", "Municipio" |
| Goya → Marina | "Mercadona di Goya", "C/ Francisco de Goya", "Estación de tren" | "supermercato di Marina", "Via del Porto", "Stazione marittima" |
| Alemanya → Aurora | "Mercadona di Alemanya", "Plaça d'Espanya" | "minimarket di Aurora", "Piazza dell'Alba" |
| Pineda → Olivetto | "Carrefour", "Crta. N-II", "Estación Renfe Pineda" | "Centro Commerciale Sole", "Strada Provinciale", "fermata bus Olivetto" |
| L'Escala → Belvedere | "Carrefour Escala", "Av. Girona", "Port d'Escala" | "Centro Commerciale Stella", "Viale del Belvedere", "molo del Belvedere" |
| Platja d'Aro → Castello | "Av. Castell d'Aro", "Pueblo de Platja d'Aro", "Plaja Gran" | "Viale del Castello", "centro di Castello", "Spiaggia Grande" |

⚠️ **Nota brand commerciale**: "Mercadona" / "Carrefour" sono brand reali della catena spagnola di supermercati. Nella demo li sostituisco con riferimenti **generici** (`supermercato`, `minimarket`, `Centro Commerciale Sole/Stella`) per evitare di geo-localizzare automaticamente la demo in Spagna. **ASK Andrea: ok riferimenti generici o vuoi brand commerciali inventati specifici (es. "SuperEco", "CentroPiù")?**

#### 3.3.3 Regione/Paese

`prompts/router.txt:5` cita:
```
You are the FIRST-TURN ROUTER of a multilingual chatbot for the Ecolaundry self-service laundromat chain (Spain).
```

→ Sostituire con: `BlueClean self-service laundromat chain` (senza paese — il bot supporta 6 lingue, meglio neutro). **ASK Andrea: ok tagliare "(Spain)" del tutto, o sostituire con altra geografia (es. "(Italy)" o "(Mediterranean)")?**

Stesso check su:
- `docs/architecture.md`
- `docs/reglas.md`
- `docs/usecases.md` (testi conversazione possono citare "España" / "Cataluña" / "catalán")
- `README.md` ("catena lavanderie self-service")

#### 3.3.4 Modelli macchina

[`json/washer_hs60xx.json`](../custom-ecolaundry/json/washer_hs60xx.json) (438 righe) + [`json/dryer_ed340.json`](../custom-ecolaundry/json/dryer_ed340.json) (215 righe) usano sigle modello reali:
- `HS60xx` (lavatrici Domus HS-6017/HS-6023)
- `ED340` (asciugatrici Domus ED-340)

Per demo → rinominare in nomenclatura generica neutra:
- `washer_hs60xx.json` → `washer_wm100.json` (Washing Machine 100)
- `dryer_ed340.json` → `dryer_dm200.json` (Drying Machine 200)
- Sigle interne (`HS-6017`, `ED-340`) → `WM-100A`, `DM-200B` o simili

⚠️ Le sigle macchina appaiono in **display flow id** (`flow.washer_hs60xx`), in `seed.ts` come flowKey, e nei file CSV `programes.csv` / `alarmes-*.csv`. Rinomina coordinata necessaria. **ASK Andrea: confermi rinomina modelli macchina?**

#### 3.3.5 Inventario file impattati dall'anonimizzazione geografica

Tutti questi vanno rivisti in modo **coordinato** durante il Passo 4 (anonimizzazione luoghi):

| File | Cosa contiene | Tipo intervento |
|---|---|---|
| [`utils/locations.ts`](../custom-ecolaundry/utils/locations.ts) (106 righe) | `LAUNDROMATS[]` con 6 oggetti `{canonical, pueblo, address, aliases[]}` + `AMBIGUOUS_PUEBLOES` | **Sostituzione completa** da tabella 3.3.1 |
| [`utils/locations-landmarks.ts`](../custom-ecolaundry/utils/locations-landmarks.ts) | Logica `resolveLocationByLandmarks` (data-driven da JSON) | Solo verifica typecheck — il file non hardcoda landmark, li legge da JSON |
| [`json/locations.json`](../custom-ecolaundry/json/locations.json) (881 righe) | `locations.<canonical>.{pueblo, address, metadata: {landmarks, programs, hours, prices, alarms}}` per 6 loc | **Riscrittura completa** delle 6 location — sezione più voluminosa |
| [`docs/csv/locals.csv`](../custom-ecolaundry/docs/csv/locals.csv) | Tabella 6 location con address/pueblo | Sostituzione integrale |
| [`docs/csv/horaris.csv`](../custom-ecolaundry/docs/csv/horaris.csv) | Orari per location | Riscrivere headers location |
| [`docs/csv/preus.csv`](../custom-ecolaundry/docs/csv/preus.csv) | Prezzi per location (€) | Riscrivere headers location (prezzi possono restare) |
| [`docs/csv/programes.csv`](../custom-ecolaundry/docs/csv/programes.csv) | Programmi macchina per location | Riscrivere headers location |
| [`docs/csv/instruccions-*.csv`](../custom-ecolaundry/docs/csv/) (4 file) | Istruzioni pagamento + uso | Verifica: se citano location o brand → sanitize |
| [`docs/csv/alarmes-*.csv`](../custom-ecolaundry/docs/csv/) (2 file) | Codici errore macchina (DOOR, SEL, PUSH PROG, AL001…) | Probabilmente neutri — verifica |
| [`docs/csv/tables.md`](../custom-ecolaundry/docs/csv/tables.md) | Manifest dei CSV | Aggiorna riferimenti |
| [`docs/usecases.md`](../custom-ecolaundry/docs/usecases.md) | Conversazioni esempio in 6 lingue, citano Goya/Pineda/Mataró/Hortes/L'Escala/Platja d'Aro | **Riscrittura puntuale** — alta cardinalità, ~50+ menzioni |
| [`docs/f-log.md`](../custom-ecolaundry/docs/f-log.md) | 105 F-entries che citano location reali nei commenti | Per scelta Andrea: reset a F0 oppure sanitize |
| [`docs/reglas.md`](../custom-ecolaundry/docs/reglas.md) | Regole base con esempi citano location | Riscrittura puntuale |
| [`prompts/router.txt`](../custom-ecolaundry/prompts/router.txt) | Cita "Spain" + 6 esempi multi-lang con "Goya"/"Pineda" | Riscrittura introduzione + esempi |
| [`prompts/agent.txt`](../custom-ecolaundry/prompts/agent.txt) | Verifica se cita location | Sanitize se cita |
| [`agent.ts`](../custom-ecolaundry/agent.ts) | Commenti JSDoc citano "Goya/Pineda" come esempi (linee 192-193, 323, 342) | Solo commenti — sanitize |
| [`utils/state-transitions.ts`](../custom-ecolaundry/utils/state-transitions.ts) | Commenti JSDoc citano "Goya/Pineda" (linee 258-260) | Solo commenti — sanitize |
| [`__tests__/unit/_helpers.ts`](../custom-ecolaundry/__tests__/unit/_helpers.ts) | Helper di test, cita location reali in fixture | **Riscrittura fixture** — toccare con cautela (può rompere ~40 test che usano helper) |
| [`__tests__/unit/*.test.ts`](../custom-ecolaundry/__tests__/unit/) | Diversi test usano location reali come input/assert | Riscrittura input/assert coordinata con `_helpers.ts` |
| `testingLLM.md`, `docs/testing-llm-report-*.md` | Report storici Ecolaundry | **Eliminare** in Passo 1 (già previsto) |

**Stima impatto**: il Passo 4 del workflow originale (anonimizzazione, 1-2 ore) sale a **2-4 ore** con questa estensione (la rinomina coordinata di location + città + vie + landmark + modelli macchina nei test impatta ~50+ file).

### 3.4 Anonimizzazione FINGERPRINT TECNICI (anti-leak settoriale)

Anche con brand/città/vie/landmark cambiati, ci sono **10 fingerprint tecnici** che un esperto del settore self-service spagnolo riconoscerebbe come Ecolaundry / fornitore Domus-Girbau. Decisioni concordate con Andrea:

#### 3.4.1 Codici display macchina (🔴 ALTO RISCHIO)

I codici display `SEL`, `PUSH`, `DOOR`, `ALM`, `ALN`, `AL001`, `T-28`, `STOP:`, `END:`, `001` sono **specifici dei produttori Domus / Girbau** (leader Spagna self-service). Decisione: **sostituire tutto con codici generici neutri**.

| Codice originale | Sostituire con | Significato preservato |
|---|---|---|
| `SEL` | `READY` | Pendiente de selección |
| `PUSH` | `START` | Premere per avviare. La dicitura completa "PUSH PROG" diventa "**START PROG**" (decisione Andrea 2026-05-26) |
| `DOOR` | `LOCK` | Puerta mal cerrada |
| `ALM` | `ERR` | Allarme generica |
| `ALN` | `ERR` (idem) | Variante allarme |
| `AL001` | `ERR-01` | Error sequencia |
| `T-28` | `T-28` | Countdown — neutro, può restare |
| `STOP:` | `STOP:` | Desaguando — neutro, può restare |
| `END:` | `END:` | Terminado — neutro, può restare |
| `001` | `ERR-01` | Selección antes del pago |
| `ALM DOOR` | `ERR-LOCK` | Combo allarme+porta |

⚠️ **Impatto sostituzione**: questi codici hardcoded sono in ~40+ file:
- [`json/washer_hs60xx.json`](../custom-ecolaundry/json/washer_hs60xx.json) (438 righe — `case_sel`, `case_push`, `case_door`, `case_alm`, `case_al001` + prompt content)
- [`json/dryer_ed340.json`](../custom-ecolaundry/json/dryer_ed340.json) (215 righe — `interpret_display.logic` switch)
- [`json/display-flows.json`](../custom-ecolaundry/json/display-flows.json) (id `door_issue`, etc.)
- [`json/locations.json`](../custom-ecolaundry/json/locations.json) (override per location citano codici)
- [`docs/csv/alarmes-lavadora.csv`](../custom-ecolaundry/docs/csv/alarmes-lavadora.csv) + `alarmes-secadora.csv` (tabella completa codici)
- [`utils/intent/display.ts`](../custom-ecolaundry/utils/intent/display.ts), `display-unreadable.ts`, `machine.ts` (detector con regex su codici)
- [`utils/message-parsing/display-signals.ts`](../custom-ecolaundry/utils/message-parsing/display-signals.ts) (parser regex)
- [`utils/agent-extract/machine-and-display.ts`](../custom-ecolaundry/utils/agent-extract/machine-and-display.ts) (extract regex)
- [`utils/guards/display.ts`](../custom-ecolaundry/utils/guards/display.ts), `display-flow.ts`, `dryer-minutes-stuck.ts` (guard con switch su display)
- [`utils/branches/trouble-machine/`](../custom-ecolaundry/utils/branches/trouble-machine/) (handler con switch)
- [`utils/agent-prompt.ts`](../custom-ecolaundry/utils/agent-prompt.ts) (lista codici nel prompt)
- [`prompts/agent.txt`](../custom-ecolaundry/prompts/agent.txt) (lista codici nel system prompt)
- [`json/i18n/{6 lang}.json`](../custom-ecolaundry/json/i18n/) (chiavi `displayCheckPrompt` etc.)
- `__tests__/unit/*.test.ts` (~15 test che assertano sui codici literal — `displayCheckPrompt`, `force-machine-number-retry.test.ts`, `display-pivot-phase-b.test.ts`, ecc.)
- [`docs/usecases.md`](../custom-ecolaundry/docs/usecases.md) (Casi 1-5, 13-18, conversazioni esempio)
- [`docs/architecture.md`](../custom-ecolaundry/docs/architecture.md), `f-log.md`, `contracts.md` (citano codici nei flussi)

→ Sostituzione **scriptable con sed** sui literal nei JSON/CSV/MD, ma **manuale** nei detector TS (regex come `/\bDOOR\b/i`, `/\bSEL\b/i`) e nei test che fanno match esatto.

#### 3.4.2 Architettura pagamento — "central de pago" → "totem di pagamento" (🔴 ALTO RISCHIO)

Il modello "**central de pago / centralita**" (cassa centrale separata dalle macchine) è il modello self-service spagnolo classico (vs USA/UK = coin slot per machine, vs Italia = app-only). Decisione: **generalizzare in label neutra**.

| Termine originale | Sostituire con — multi-lang |
|---|---|
| `central de pago` (ES) | `totem de pago` ES — `totem di pagamento` IT — `payment terminal` EN — `caisse centrale` FR — `terminal de pagamento` PT — `terminal de pagament` CA |
| `centralita` (ES) | `totem` ES — `totem` IT — `payment kiosk` EN |
| `caja` (ES, in contesto pagamento) | `totem` |

⚠️ **Impatto**: 40+ occorrenze in:
- `json/washer_hs60xx.json`, `dryer_ed340.json`, `locations.json` (prompt content)
- `json/faqs.json`, `json/i18n/*.json` (chiave `howToUse`, `paymentMethods`)
- `docs/csv/instruccions-pagament-lavadora.csv`, `instruccions-pagament-secadora.csv`
- `docs/usecases.md`, `reglas.md`
- `__tests__/unit/_helpers.ts` + test fixture

L'architettura **del flow rimane invariata** (paghi alla cassa centrale prima, poi vai alla macchina) — è solo il **nome della cassa** che cambia. Niente rewrite di stati/transition.

#### 3.4.3 Modelli macchina (🔴 ALTO RISCHIO — già in 3.3.4)

Già coperto in 3.3.4: `HS60xx` → `WM-100`, `ED340` → `DM-200`. Aggiungo che le **sigle interne** vanno coordinate con:
- File names (`washer_hs60xx.json`, `dryer_ed340.json`)
- Flow keys in `seed.ts` (`lavatrice_hs60xx`, `asciugatrice_ed340`) + DB FlowNodeConfig
- Commenti documentazione

#### 3.4.4 Prefisso codice sconto `SAU` → `BC` (🔴 ALTO RISCHIO)

`settings.json:discountCodePrefix = "SAU"` è un fingerprint del cliente. Decisione: **cambiare in `BC`** (BlueClean).

| File | Modifica |
|---|---|
| [`json/settings.json`](../custom-ecolaundry/json/settings.json) | `"discountCodePrefix": "SAU"` → `"BC"` |
| [`utils/runtime.ts`](../custom-ecolaundry/utils/runtime.ts) | validator `/^[A-Z]+$/` (accetta entrambi — no change) |
| [`utils/customer-name.ts`](../custom-ecolaundry/utils/customer-name.ts) | usa `options.discountCodePrefix` dinamico — no change |
| [`utils/discount-code-format.ts`](../custom-ecolaundry/utils/discount-code-format.ts) | verifica se hardcoda `SAU` — sanitize |
| [`utils/escalation.ts`](../custom-ecolaundry/utils/escalation.ts) | commenti `// (a) code matches SAU2904266 format` → aggiornare a `BC...` |
| `__tests__/unit/discount-code-format.test.ts` | assertion su `SAU2904266` — aggiornare a `BC2904266` |
| `docs/usecases.md` (Caso 8) | esempi conversazione citano `SAU2904266` → `BC2904266` |
| `docs/f-log.md` (F46) | menziona `SAU` nei commenti — sanitize |
| `README.md` | `discountCodePrefix | "SAU"` nella tabella |

Pattern del codice resta uguale: `^BC\d{6}\d+$` (prefix + DDMMYY + amount). Esempio: `BC2904266` = BlueClean + 29/04/26 + 6€.

#### 3.4.5 Email/dominio cliente reale `alberwaz.net` (🔴 CRITICO)

**Più critico di tutti** — `alberwaz.net` è un dominio **reale** che identifica direttamente l'azienda. Decisione: **email + form fittizi**.

| Asset originale | Sostituire con | Note |
|---|---|---|
| `service@alberwaz.net` | `support@blueclean.demo` | `.demo` è un TLD non registrabile (riservato) → garantito che NON esista. Niente leak. |
| `alberwaz.net` (in `allowedExternalLinks`) | rimuovere | Sostituire con `blueclean.demo` (anche se non esiste, è coerente) |
| `https://forms.gle/XFGPAd9581AhC9eu7` | `https://blueclean.demo/refund` | URL placeholder che non esiste. Demo non clicca (è solo display). |
| `gelsogrove@gmail.com` (smtp, notification, support) | mantenere SOLO se Andrea testa escalation in locale | Per demo cliente → `support@blueclean.demo` ovunque. Smtp resta `gelsogrove@gmail.com` se SMTP deve funzionare. |

| File da modificare | Occorrenze |
|---|---|
| [`json/settings.json`](../custom-ecolaundry/json/settings.json) | `supportEmails.{invoice, support}`, `notificationEmails`, `smtp.{user, from}`, `refundFormUrl`, `allowedExternalLinks` |
| [`json/faqs.json`](../custom-ecolaundry/json/faqs.json) | chiavi `doubleCharge`, `refundRequest` (contengono URL + email hardcoded) |
| [`json/i18n/{6 lang}.json`](../custom-ecolaundry/json/i18n/) | stesse chiavi × 6 lingue → **12 modifiche totali** |
| [`docs/usecases.md`](../custom-ecolaundry/docs/usecases.md) | esempi conversazione citano `https://forms.gle/...` (Casi 26-29) |
| [`apps/backend/custom-ecolaundry/.env`](../custom-ecolaundry/.env) | `SMTP_USER/SMTP_FROM` = gelsogrove@gmail.com → **NON TOCCARE .env (regola Andrea)**. Eventuale switch in `custom-blueclean/.env` separato. |
| `packages/database/prisma/seed.ts` | `smtpFrom: 'Ecolaundry <…>'` → `'BlueClean <support@blueclean.demo>'` |

⚠️ **Verifica anti-leak**: i 7 file i18n hanno tutti la chiave `refundRequest` con URL+email hardcoded. Aggiornarli in lockstep — il check `rule #12` (parità chiavi) lo enforcement, ma il **contenuto** non è validato.

#### 3.4.6 Lingue: ordine `enabledLanguages` (🟠 MEDIO)

Oggi: `["es", "ca", "en", "it", "fr", "pt"]` con `defaultLanguage: "es"`. Catalano (ca) al 2° posto → **fortemente indicativo Catalogna/Baleari**.

**Opzioni per demo neutra**:
- (a) Tieni 6 lingue ma riordina: `["es", "en", "it", "fr", "ca", "pt"]` — sposta `ca` in fondo, sembra una lingua minore aggiuntiva
- (b) Sposta `defaultLanguage: "it"` (Italia, neutro) e tieni `ca` in fondo
- (c) Rimuovi `ca` completamente (richiede eliminazione `i18n/ca.json` + check rule #12)

→ **Raccomandazione**: opzione (a). Bot supporta sempre 6 lingue, sembra meno spagnolo-catalano specifico.
→ **ASK Andrea: ok (a)?**

#### 3.4.7 PDF + CSV in catalano (🟠 MEDIO)

I file CSV hanno **nomi file in catalano** che identificano la regione:
- `alarmes-lavadora.csv`, `alarmes-secadora.csv` (catalano `alarmes`)
- `instruccions-pagament-lavadora.csv`, `instruccions-pagament-secadora.csv` (catalano `instruccions`)
- `instruccions-us.csv` (catalano)
- `programes.csv` (catalano, non spagnolo `programas`)
- `horaris.csv` (catalano, non spagnolo `horarios`)
- `locals.csv` (catalano, non spagnolo `locales`)
- `preus.csv` (catalano, non spagnolo `precios`)

→ **Rinominare in inglese neutro**: `alarms-washer.csv`, `payment-instructions-washer.csv`, `usage-instructions.csv`, `programs.csv`, `hours.csv`, `locations.csv`, `prices.csv`.

→ PDF `Ecolaundry Chatbot Playbook.pdf`, `PROGRAMES.pdf`, `SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf`, `SOLUCIÓN-DE-PROBLEMAS-SECADORAS.pdf`: **eliminare** in Passo 1 (già previsto in 5.3).

#### 3.4.8 Numerologia prezzi (🟠 MEDIO)

`preus.csv` + `locations.json:metadata.prices` contengono prezzi specifici (es. 6.50€, 3.00€). Se il cliente reale ha listini online, matching pubblico possibile.

**Mitigazione semplice**: **shift random** dei prezzi (es. +0.50€ ovunque, o arrotondare diversamente):
- 6.50€ → 6.00€ o 7.00€
- 3.00€ → 2.50€ o 3.50€
- 4.50€ → 4.00€ o 5.00€

Manualmente in `preus.csv` + `locations.json` (6 location × 4-6 prezzi ciascuna).

→ **ASK Andrea: shift random sì/no?**

#### 3.4.9 Etichette programmi macchina (🟠 MEDIO)

`60º (muy caliente)`, `40º (templado)`, `30º (suave)`, `FRÍO` — diciture specifiche che potrebbero matchare materiali marketing del cliente. **Generalizzare**:
- `60º (muy caliente)` → `60ºC — White cotton`
- `40º (templado)` → `40ºC — Color cotton`
- `30º (suave)` → `30ºC — Delicate`
- `FRÍO` → `Cold — Wool/Silk`

→ ASK Andrea (low priority — testi standard del settore, basso rischio).

#### 3.4.10 Logger/telemetria fingerprint (🟡 BASSO)

- `X-Title: 'Ecolaundry Agent'` in `utils/agent-llm.ts:63` + `utils/llm.ts:80` (header OpenRouter) — già coperto in 3.2
- Niente Sentry/Datadog tags specifici trovati — verificare se `seed.ts` o env espone qualche tag con brand reale

---

### 3.5 Riduzione `usecases.md` per la demo

`usecases.md` ha oggi **47 Casi in 2081 righe**. Per una demo è troppo pesante: rallenta lettura/demo, espone storia interna, contiene 40+ riferimenti geografici reali nei testi conversazione. Decisione: **selezionare 10 Casi rappresentativi** che mostrano TUTTE le capability del bot.

#### 3.5.1 Short-list FINALE (13 Casi — concordata con Andrea)

Selezione driven dalle priorità di business reali, non da copertura architetturale astratta:

| # demo | Caso (label demo) | Mappa su Caso originale | Cosa dimostra |
|---|---|---|---|
| 1 | **Orari** | Caso 12 (parte horarios) + Caso 36 (estensione L'Escala 7-23 → Belvedere) | FAQ data-driven `metadata.hours` location-gated |
| 2 | **Prezzi** | Caso 12 (parte precios) + Caso 37/38 (estensione listino macchina) | FAQ data-driven `metadata.prices` location-gated |
| 3 | **Come funziona** | Caso 35 (lavadora) + Caso 45 (secadora) + Caso 42 (howToUse override per location) | FAQ override per location + multi-lang + topic-switch IN |
| 4 | **Non funziona la lavatrice** (ex DOOR → `LOCK`) | Caso 2 | Display flow base + retry ladder + escalation |
| 5 | **Non funziona — ex PUSH PROG** (→ `START PROG`) | Caso 1 | Display flow + insegnamento "premi un programma" |
| 6 | **Non mi dà il resto** | Caso 19 (Goya → Marina) o Caso 20 (Pineda → Olivetto) — "datáfono 10€" | Edge case pagamento POS + escalation |
| 7 | **Mi ha fatto pagare due volte** (doble cobro) | Caso 6 | FAQ `doubleCharge` + raccolta strutturata (last 4 card + screenshot + form rimborso) |
| 8 | **Ho pagato e non si è attivata** | Caso 4 | Gather forzato (machine number + display) + 3-strikes ladder (rule #10) |
| 8.1 | **(sub) Cambio restituito ma non parte** | Variante Caso 4 + Caso 7 | Edge case: detail aggiuntivo "resto ok" ma macchina ferma — stesso flow gather |
| 9 | **È partito un allarme** | Caso 5 (AL001 → `ERR-01`) + Caso 16 (ALM/ALN → `ERR`) | Codice errore + decisione automatica ESCALAR vs riparare |
| 10 | **Voglio parlare con un operatore** | Caso 25 (cliente molto arrabbiato) | Detector intent `operator-request` + escalation immediata umana (bypassa gather) |
| 11 | **Voglio la fattura** | Caso 9 | Multi-step gather (razon social + direccion + notes) + state patches → DB customer |
| 12 | **Tessera di fidelizzazione** | Caso 10 (comprare) + Caso 11 (ricaricare) | Branch loyalty + state machine + price/saldo |
| 13 | **Tessera comprata in un altro quartiere** | Caso 10.2 (adattato: cross-location → cross-quartiere) | Detector cross-location warning + scope tessera per quartiere |

**Coverage architetturale ottenuta** (verifica copertura senza forzare):
- ✅ Tutti i **5 layer** (L1..L5)
- ✅ Tutti i **branch router**: greeting (implicito T1), faq (1,2,3), trouble-machine (4,5,9), invoice (11), loyalty (12,13), escalation (10), feedback (non incluso — bassa priorità business)
- ✅ FAQ data-driven con metadata location (1, 2, 3)
- ✅ Display flow lavatrice + asciugatrice (4, 5, 9)
- ✅ Multi-step gather (8, 8.1, 11, 12)
- ✅ Detector emozione + escalation umana (10)
- ✅ Edge cases pagamento (6, 7, 8.1)
- ✅ Cross-quartiere warning (13)
- ✅ Multi-lang 6 lingue (es/it/en/ca/pt/fr) per ogni Caso

**Razionale ordine**: parte da FAQ semplici (1-3 = "wow effect" immediato) → problemi tecnici progressivi (4-5 = ovvi, 6-8 = pagamento, 9 = errore) → escalation/back-office (10-13 = workflow umano).

**Casi originali SCARTATI** (34 Casi, eliminati da `usecases.md`):
- Casi 8 (codice sconto SAU→BC), 13-18 (varianti display), 21-24 (datáfono per location specifica), 26-32 (gestione reclami avanzata), 33-34 (feedback + detergente), 39-41 (FAQ specifiche), 43-44 (combinatori), 46 (countdown 120)
- Motivo: ridondanti rispetto ai 13 selezionati, oppure verbose location-specific, oppure bassa priorità per la demo

#### 3.5.2 Cosa fare con i 37 Casi NON selezionati

**3 opzioni**:
- (a) **Eliminare dal `usecases.md` del modulo demo** — più rapido, contesto pulito per cliente
- (b) **Tenere in file separato `usecases-archive.md`** — riferimento storico (sanitizzato comunque)
- (c) **Tenere tutto, sanitizzare 40+ riferimenti geografici e brand** — lavoro pesante

→ **Raccomandazione (a)**: eliminare. Il valore architetturale è nel **codice + iron rules** (CLAUDE.md), non nei 47 Casi documentati. La demo deve essere snella.

⚠️ **Vincolo tecnico**: `usecases.md` è citato da:
- `json/cases.json` (bridge doc-Caso → code-semanticId — devo rimuovere/sanitizzare le entries dei Casi eliminati)
- `__tests__/unit/f-log-regression.test.ts` (alcuni pin citano N° Caso)
- `check-architecture.sh` Rule #11 (F-entries devono avere pin) — non impatta direttamente i Casi
- `playground.controller.ts` (lo serve via `/api/v1/playground/usecases`)

→ Quando taglio i Casi, devo coordinare: rimozione da `usecases.md` + cleanup `cases.json` + verifica test non si rompono.

#### 3.5.3 Riscrittura della short-list

Per ciascuno dei 10 Casi tenuti, riscrivere:
- Sostituire ovunque Goya/Mataró/Hortes/Granollers/Pineda/L'Escala/Platja d'Aro → mapping 3.3.1 (Centro/Marina/Aurora/Olivetto/Belvedere/Castello)
- Sostituire codici display SEL/PUSH/DOOR/AL001 → READY/START/LOCK/ERR-01 (mapping 3.4.1)
- Sostituire `SAU2904266` → `BC2904266` (Caso 8)
- Sostituire URL `forms.gle/XFGPAd9581AhC9eu7` → `blueclean.demo/refund` (Caso 6, 26-29 se mantenuti)
- Sostituire `Ecolaundry` → `BlueClean` (tutte le menzioni nelle conversazioni)
- Sostituire `central de pago` / `centralita` → `totem di pagamento` (mapping 3.4.2)
- Mantenere conversazioni multi-lang (es/it/en/ca/pt/fr) — sono il valore demo

**Stima tempo riscrittura usecases.md**: ~1.5-2 ore (10 Casi × 8-12 min per riscrittura conversazione + verifica iron rules).

---

#### 3.3.6 Checklist anti-leak GEOGRAFICA (PRE-DEMO)

Aggiungere a sez. 7.2:

```bash
# 0 risultati attesi DOPO Passo 4:
grep -rni 'Hortes\|Goya\|Alemanya\|Pineda\|Escala\|Platja\|Castell.*Aro\|Playa.*Aro' apps/backend/custom-blueclean/
grep -rni 'Granollers\|Mataró\|Mataro\|Pineda de Mar' apps/backend/custom-blueclean/
grep -rni 'Catalonia\|Cataluña\|catalan\|català' apps/backend/custom-blueclean/
grep -rni 'Mercadona\|Carrefour' apps/backend/custom-blueclean/
grep -rni 'HS60xx\|HS-60\|ED340\|ED-340\|Domus' apps/backend/custom-blueclean/     # se confermata rinomina modelli
grep -rn 'Spain\|España' apps/backend/custom-blueclean/                              # opzionale se rimosso paese
```

Se uno qualsiasi torna risultati → fix prima della demo.

---

## 4 — Inventario completo dei riferimenti fuori dal modulo

### 4.1 Backend (`apps/backend/src/`)

Solo questi 9 file hanno reference hardcoded; tutti gli altri usano `workspace.customChatbotId` dinamico (no rename):

| File | Linee | Cosa fare |
|---|---|---|
| [`src/application/services/custom-client-chatbot.service.ts`](../src/application/services/custom-client-chatbot.service.ts) | 157-161, 195, 203-207, 279 | Cambiare fallback hardcoded slug `"ecolaundry"` → `"blueclean"` (3 occorrenze in `resolveChatbotId`). Aggiornare commenti. |
| [`src/application/services/escalation-email.service.ts`](../src/application/services/escalation-email.service.ts) | 1-32 | Import statico da `'../../../custom-ecolaundry/utils/human-message-email'` → cambiare in `custom-blueclean`. **NB**: questo è un import statico, NON dinamico → richiede rebuild. |
| [`src/application/chat-engine/chat-engine.service.ts`](../src/application/chat-engine/chat-engine.service.ts) | 1638 | Solo commento. |
| [`src/application/chat-engine/chat-engine.types.ts`](../src/application/chat-engine/chat-engine.types.ts) | 29 | Solo commento (`customChatbotId?: string \| null  // e.g. "ecolaundry"`). |
| [`src/interfaces/http/controllers/playground.controller.ts`](../src/interfaces/http/controllers/playground.controller.ts) | 13-83, 343-346, 565 | **Critico**: cache singleton `ECOLAUNDRY_SLUG = "ecolaundry"` + funzione `getEcolaundryWorkspaceId()` + 3 path di fallback `custom-ecolaundry/docs/usecases.md` |
| [`src/interfaces/http/controllers/ultramsg-webhook.controller.ts`](../src/interfaces/http/controllers/ultramsg-webhook.controller.ts) | 1416, 1438, 1468, 1483 | Logger tag `pipeline: 'custom-ecolaundry'` |
| [`src/interfaces/http/controllers/whatsapp-webhook.controller.ts`](../src/interfaces/http/controllers/whatsapp-webhook.controller.ts) | 2592, 2611, 2631, 2661, 2678 | Logger tag `pipeline: "custom-ecolaundry"` |
| [`src/interfaces/http/controllers/widget-chat.controller.ts`](../src/interfaces/http/controllers/widget-chat.controller.ts) | 1009, 1777, 1854 | Solo commenti |
| [`src/domain/entities/workspace.entity.ts`](../src/domain/entities/workspace.entity.ts) | 80 | Solo commento JSDoc |
| [`src/routes/index.ts`](../src/routes/index.ts) | 436, 671 | Commenti su route playground |
| [`src/utils/welcome-message.handler.ts`](../src/utils/welcome-message.handler.ts) | 134 | Solo commento |
| [`src/templates/flow/00-router.template.md`](../src/templates/flow/00-router.template.md) | N/A | Verifica contenuto |

**Test esistenti che falliranno** (da aggiornare):

- [`apps/backend/__tests__/unit/escalation-email-notification.spec.ts`](../__tests__/unit/escalation-email-notification.spec.ts) — assert su path `custom-ecolaundry/utils/human-message-email`
- [`apps/backend/src/__tests__/unit/chat-engine/skip-translation-custom-chatbot.spec.ts`](../src/__tests__/unit/chat-engine/skip-translation-custom-chatbot.spec.ts) — fixture cita "ecolaundry"
- [`apps/backend/__tests__/unit/strategies/flow-workspace.strategy.spec.ts`](../__tests__/unit/strategies/flow-workspace.strategy.spec.ts) — citato in grep results

**Decisione critica — coesistenza vs sostituzione**:
- **Opzione A** (raccomandata per demo): **mantenere `custom-ecolaundry` IN PARALLELO** e aggiungere `custom-blueclean` come secondo modulo. Più sicuro, zero rischio di rompere produzione, demo isolata. Il resolver in `custom-client-chatbot.service.ts:199-210` già supporta entrambi via `workspace.customChatbotId` dinamico. **Da rimuovere solo i 2 fallback hardcoded** (slug=="ecolaundry" → "ecolaundry") che ora andrebbero generalizzati o ignorati.
- **Opzione B** (sostituzione): rinominare la cartella e rompere il workspace ecolaundry esistente. Sconsigliato per demo.

→ **ASK Andrea** quale opzione. Il documento prosegue assumendo **Opzione A**.

### 4.2 Frontend (`apps/frontend/src/`)

| File | Modifica |
|---|---|
| [`App.tsx:213-215`](../../frontend/src/App.tsx#L213) | Route `/demo/ecolaundry/*` → aggiungere route parallela `/demo/blueclean/*` (Opzione A) o rinominare (Opzione B). |
| [`pages/PlaygroundPage.tsx`](../../frontend/src/pages/PlaygroundPage.tsx) | Storage keys (`ecolaundry-demo-chat-titles`, …), 8 occorrenze nei title/href `/demo/ecolaundry`. Per demo isolata → fork del componente `PlaygroundPage` in `BluecleanPlaygroundPage` OR parametrizzazione via prop `clientSlug`. **ASK Andrea**: vuoi un Playground generico parametrico o due componenti distinti? |
| [`pages/ChatPage.tsx:2087-2091`](../../frontend/src/pages/ChatPage.tsx#L2087) | Iframe playground src → cambiare path |
| [`pages/AgentConfigurationPage.tsx`](../../frontend/src/pages/AgentConfigurationPage.tsx) | Solo commento JSDoc |
| [`pages/SettingsPage.tsx`](../../frontend/src/pages/SettingsPage.tsx) | Solo commenti |
| [`pages/WorkspaceSelectionPage.tsx:2549`](../../frontend/src/pages/WorkspaceSelectionPage.tsx#L2549) | Solo commento |
| [`components/layout/Sidebar.tsx`](../../frontend/src/components/layout/Sidebar.tsx) | Solo commento |
| [`components/settings/sections/AIPersonalitySection.tsx:340,344`](../../frontend/src/components/settings/sections/AIPersonalitySection.tsx) | Placeholder UI `"e.g. ecolaundry"` + code snippet → aggiornare a `"e.g. blueclean"` |
| [`contexts/WorkspaceContext.tsx`](../../frontend/src/contexts/WorkspaceContext.tsx) | Solo commento JSDoc |
| [`services/workspaceApi.ts`](../../frontend/src/services/workspaceApi.ts) | Solo commenti JSDoc |

⚠️ **Rule #15 (English-Only UI)** vale qui: i placeholder e label rimangono in inglese, è solo lo string letterale `"ecolaundry"` → `"blueclean"` che cambia.

### 4.3 Database seed (`packages/database/prisma/seed.ts`)

**Critico** — definisce il workspace fixture:

| Linea | Contenuto attuale | Modifica per BlueClean |
|---|---|---|
| 1543 | `console.log("🏢 Creating/updating FLOW workspace (Ecolaundry) …")` | "(BlueClean)" |
| 1546 | `where: { slug: "ecolaundry" }` | `slug: "blueclean"` |
| 1553-1554 | `name: "Ecolaundry"`, `slug: "ecolaundry"` | `name: "BlueClean"`, `slug: "blueclean"` |
| 1575 | `customChatbotId: "ecolaundry"` | `"blueclean"` |
| 1633 | `smtpFrom: \`Ecolaundry <…>\`` | `BlueClean <…>` |
| 1695, 1721 | systemPrompt strings citano "Ecolaundry assistant" | "BlueClean assistant" |
| 1775-1778 | `ECOLAUNDRY_SYSTEM_PROMPT` constant name + content | Rinominare costante + sostituire brand nel body |
| 1820, 2012 | Welcome string template "Hi, I'm the Ecolaundry assistant…" | "BlueClean assistant…" |
| 2235, 2237, 2372, 2374, 2388, 2390, 2402, 2400-2491 | Flow keys + workspaceId references | flow keys/labels: `"Router - Asistente Ecolaundry"` → `"Router - Asistente BlueClean"` (label only, key può rimanere `router`) |
| 2491 | `console.log("✅ Ecolaundry FLOW workspace configured…")` | "BlueClean" |

⚠️ **Importante**: questo è il **seed di sviluppo** (`packages/database/prisma/seed.ts`). In produzione il workspace è già nel DB. La modifica del seed serve a generare un nuovo workspace `blueclean` per la demo. **Decisione**: tenere il workspace ecolaundry nel seed (Opzione A) e aggiungere blocco parallelo per `blueclean`, oppure sostituire (Opzione B).

**Script ad-hoc** da considerare:
- [`packages/database/scripts/sync-ecolaundry-flow.ts`](../../../packages/database/scripts/sync-ecolaundry-flow.ts) — script di sync. Decidere se duplicare in `sync-blueclean-flow.ts`.

### 4.4 Documentazione root (`docs/ecolaundry/`)

Cartella separata con docs storici/refactoring:

```
docs/ecolaundry/
├── CANONICAL_FLOWS.md
├── HARDCODING_RULES.md
├── REFACTORING_PLAN.md
├── docs/{achitecture,demo,overrides,prompt3-history,variables}.md
├── pdf/
└── test-runs/
```

→ **Per demo**: NON dare al cliente accesso al repo `/docs/ecolaundry/`. Se la demo è solo `npm run demo` da custom-blueclean → non visibile. Se è web/git tour → escludere via `.gitignore` per la branch demo, o rimuovere.

### 4.5 Root del repo

| File | Modifica |
|---|---|
| [`CLAUDE.md`](../../../CLAUDE.md) | Sezione "F50 — Visual Flow Builder DEPRECATED" cita "ecolaundry" — solo commento storico, lasciare o aggiornare con esempio neutro `custom-<name>`. |
| `.github/copilot-instructions.md` | Cita ecolaundry — verificare e aggiornare |
| `prompt.md` | Verificare contenuto |

---

## 5 — Inventario interno: cosa toccare dentro `custom-blueclean/` (dopo copia)

Dopo `cp -r custom-ecolaundry custom-blueclean`, eseguire un find-and-replace **case-aware**:

### 5.1 Sostituzioni testuali sicure (sed-friendly)

| Pattern | Replace | Note |
|---|---|---|
| `ecolaundry-demo` | `blueclean-demo` | package.json, package-lock.json |
| `custom-ecolaundry` | `custom-blueclean` | path references, agentChain, logger tag |
| `ecolaundry` (lowercase, parola intera `\b`) | `blueclean` | chatbotId, slug, module id |
| `Ecolaundry` | `BlueClean` | brand display (con spazio — verificare se rompe layout) |
| `ECOLAUNDRY` | `BLUECLEAN` o `BLUE_CLEAN` | constant names, ENV-like |
| `Ecolaundry Agent` | `BlueClean Agent` | X-Title header OpenRouter |

⚠️ **CASE TRAP**: il pattern `Ecolaundry` (PascalCase, 1 parola) ha sostituto `BlueClean` (2 parole + maiuscolo). Questo **rompe** sintassi in posti come:
- Variabili JS: `const ecolaundryWorkspaceIdCache` ✅ (lowercase ok)
- Identificatori npm: `ecolaundry-demo` → `blueclean-demo` ✅
- Stringhe display ("Hola, soy el asistente virtual de Ecolaundry") → "…de BlueClean" ✅
- Constant names: `ECOLAUNDRY_SLUG` → `BLUECLEAN_SLUG` (no spazio) — usare regex separate

→ **NON USARE** un singolo `sed -i 's/Ecolaundry/BlueClean/g'` globale. Suddividere in passate ordinate:

```
1. sed -i 's/ecolaundry-demo/blueclean-demo/g'            (package name)
2. sed -i 's/custom-ecolaundry/custom-blueclean/g'        (path)
3. sed -i 's/ECOLAUNDRY/BLUECLEAN/g'                       (constants)
4. sed -i 's/\becolaundry\b/blueclean/g'                   (slug/module id — lowercase parole intere)
5. sed -i 's/Ecolaundry/BlueClean/g'                      (display only — ULTIMA passata, dopo aver verificato che (3)+(4) non lascino nulla)
```

**Approfondire prima di sed**: verificare se `prompts/agent.txt` ha hardcode di `Eco` (chatbotName) o se è sempre injected via `{{chatbotName}}`. Se hardcoded → decidere nuovo chatbotName.

### 5.2 File che richiedono **intervento manuale** (no sed)

| File | Perché manuale |
|---|---|
| `json/settings.json` | Cambio brand + (se anonimizziamo) cambio refundFormUrl, allowedExternalLinks, supportEmails, notificationEmails (oggi: `gelsogrove@gmail.com`). Se demo → mantenere gelsogrove. Se cliente vero → ASK Andrea. |
| `json/locations.json` (881 righe) | Rimappatura 6 location reali → 6 nomi fittizi. Include `canonical`, `aliases[]`, `pueblo`, `address`, `metadata.programs[]`, `landmarks`. **Manuale**, alta probabilità di errore. |
| `utils/locations.ts` | Stesso problema — canonical + aliases hardcoded TypeScript |
| `json/faqs.json` | 5-7 chiavi citano brand: `washDryTime`, `detergents`, `paymentMethods`, `appDownload` — riscrivere |
| `json/i18n/{6 lang}.json` | Per ogni lingua, ~5 chiavi citano "Ecolaundry" — 30 modifiche totali. Mantenere parità chiavi (rule #12 di `check-architecture.sh`). |
| `prompts/router.txt` | Cita "Ecolaundry self-service laundromat chain (Spain)" + esempi multi-lang con location reali. Riscrivere intro + esempi neutri. |
| `prompts/agent.txt` | Verificare se cita brand (probabilmente solo via variabili) |
| `docs/csv/*.csv` (9 file) | locals.csv contiene nomi località reali; preus.csv/programes.csv/horaris.csv contengono dati operativi per ciascuna location. Riscrivere coerentemente con anonimizzazione. |
| `docs/pdf/*.pdf` (4 file) | "Ecolaundry Chatbot Playbook.pdf" è il **prompt-source di partenza** + 3 PDF tecnici. Per demo: o (a) ometterli (non li serve al runtime, sono solo doc) o (b) sostituirli con versioni anonimizzate. PER DEMO IO RACCOMANDO **OMETTERLI** dalla cartella `custom-blueclean/` (non sono read dal runtime — sono solo docs source-of-truth). |
| `docs/usecases.md` | 14+ conversazioni esempio citano "Ecolaundry" / Goya / Pineda. Riscrittura puntuale necessaria. |
| `docs/reglas.md` | Diversi paragrafi citano "Ecolaundry" — riscrivere |
| `docs/architecture.md` | Header "Architecture — ecolaundry" → "Architecture — blueclean"; 1 path cita `custom-ecolaundry/docs/pdf/...` |
| `docs/f-log.md` | Log storico di F1→F105 — cita Ecolaundry in entries. Per demo: tenere come `f-log.md` ma considerare se i 100+ F-entries sono utili a BlueClean o se andrebbe troncato/riassunto. **ASK Andrea**: il cliente BlueClean avrà accesso al repo? Se no → tenere; se sì → resettare a F0 con nota "log iniziato da fork di base condivisa". |
| `docs/testing-llm-report-2026-05-24.md` | Report storico ecolaundry-specifico — eliminare per demo |
| `testingLLM.md` (root del modulo) | Report storico — eliminare per demo |
| `agent.ts:712` | Stringa "Ecolaundry Agent Demo (Step X)" |
| `utils/agent-welcome.ts:68` | Regex `\b(asistente virtual\|…)\s+de?\s+ecolaundry\b` — questa regex riconosce se l'utente prova ad usare "soy l'asistente virtual de ecolaundry" come nome (anti-impersonation guard). Va aggiornata a `\b…\s+de?\s+blueclean\b` |
| `utils/runtime.ts:298` | `companyName: settings.companyName \|\| 'Ecolaundry'` — fallback hardcoded. Cambiare in `'BlueClean'` |
| `utils/agent-llm.ts:63`, `utils/llm.ts:80` | Header `X-Title: 'Ecolaundry Agent'` / `'Ecolaundry'` — telemetria OpenRouter |
| `models/i18n.ts:30`, `models/runtime.ts:63`, `models/chatbot-io.ts:1`, `models/index.ts:1` | JSDoc comments citano "ecolaundry" — aggiornare |
| `__tests__/unit/_helpers.ts` | Helper di test cita "ecolaundry" — verificare se è solo commento o se assert su valori reali (es. `companyName === 'Ecolaundry'`). Aggiornare. |
| `__tests__/unit/branch-dispatcher.test.ts`, `f-log-regression.test.ts`, `human-message-email.test.ts` | Citano "ecolaundry" — controllo manuale per non rompere assert. |

### 5.3 File da ELIMINARE in `custom-blueclean/`

| File | Perché |
|---|---|
| `testingLLM.md` (root) | Report storico ecolaundry-specifico, contiene dati reali di test |
| `docs/testing-llm-report-2026-05-24.md` | Idem |
| `docs/pdf/Ecolaundry Chatbot Playbook.pdf` | Playbook brand cliente reale |
| `docs/pdf/PROGRAMES.pdf`, `SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf`, `SOLUCIÓN-DE-PROBLEMAS-SECADORAS.pdf` | Manuali in Catalano specifici del cliente reale |
| `package-lock.json` | Rigenerare con `npm install` dopo rename in package.json |

### 5.4 File da considerare ridotti/sanitizzati

| File | Approccio |
|---|---|
| `docs/f-log.md` | Mantenere ma **review manuale** delle 105 entries — eliminare riferimenti diretti a brand/luoghi reali. Alternativa: tronca a "F0 — clean slate for BlueClean". |
| `docs/usecases.md` | Mantenere struttura Casi 1..N, riscrivere conversazioni esempio con location anonime e brand BlueClean. |
| `docs/reglas.md` | Riscrittura puntuale paragrafi 22, 385+ |
| `docs/csv/locals.csv` | Cambio header + 6 righe location |
| `docs/csv/preus.csv`, `programes.csv`, `horaris.csv` | Dati operativi — generare versioni demo coerenti con nuove location |

---

## 6 — Workflow di esecuzione (proposto, NON eseguire ora)

> Quando Andrea darà OK, procedere in questi 7 passi sequenziali con verifica intermedia.

### 6.0 Filosofia esecuzione: COPIA prima, RIADATTA dopo (decisione Andrea)

> **Andrea, 2026-05-26**: *"ovviamente va mappato tutto, cambiato tutto il codice, bisognerà farlo passo a passo perché la prima cosa è copiare quello che abbiamo e poi riadattarlo"*

L'approccio NON è "riscrivi da zero" ma **incrementale a checkpoint**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 0 — DUPLICAZIONE FEDELE                              │
│   Stato: custom-blueclean/ = copia 1:1 di custom-ecolaundry/    │
│   Verifica: typecheck + test:unit + check-architecture VERDI    │
│   Niente è ancora cambiato a livello logico/contenuto           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 1 — RENAME TECNICO (identifier-only)                 │
│   Cambio: folder, slug, module id, package name, npm package    │
│   Niente cambio brand/contenuto/dati                            │
│   Verifica: typecheck + test:unit + npm run demo CLI funziona   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 2 — REBRAND DISPLAY (Ecolaundry → BlueClean)         │
│   Cambio: companyName, chatbotName, welcomeMessage, X-Title     │
│   I dati location/codici/programmi/email RESTANO REALI ancora   │
│   Verifica: demo CLI parla in BlueClean ma flow identici        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 3 — ANONIMIZZAZIONE GEOGRAFICA (sez. 3.3)            │
│   Cambio: città, 6 quartieri, 6 vie, landmark, AMBIGUOUS_PUEBLOES│
│   File: locations.ts, locations.json, CSV, agent.ts commenti    │
│   Verifica: test:unit verde + grep anti-leak Hortes/Goya/... 0  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 4 — ANONIMIZZAZIONE FINGERPRINT TECNICI (sez. 3.4)   │
│   Cambio: codici display, central de pago, modelli HS60xx/ED340,│
│   SAU→BC, email/URL fittizi, ordine lingue, CSV rinominati      │
│   Verifica: test:unit verde + grep anti-leak 0 risultati su 10  │
│   pattern (SEL/PUSH/DOOR/ALM/SAU/alberwaz/forms.gle/Domus/...)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 5 — RIDUZIONE USECASES (sez. 3.5: 47→13 Casi)        │
│   Cambio: usecases.md riscritto con 13 Casi sanitizzati         │
│   File: usecases.md + cases.json + cleanup f-log pin            │
│   Verifica: test:unit verde + npm run demo dei 13 Casi          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 6 — INTEGRAZIONE BACKEND + DB SEED                   │
│   Cambio: src/, frontend route /demo/blueclean, seed.ts         │
│   Verifica: npm run dev:all → /demo/blueclean funziona web      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Checkpoint 7 — SMOKE TEST FINALE + ANTI-LEAK                    │
│   Verifica: 5 conversazioni rappresentative end-to-end          │
│   Verifica: 11 grep anti-leak (sez. 3.3.6 + 3.4)                │
│   Verifica: PDF/CSV catalani eliminati                          │
└─────────────────────────────────────────────────────────────────┘
```

**Regola d'oro**: tra un checkpoint e l'altro, **commit + push** (Andrea fa il commit manualmente, regola git workflow). Se un checkpoint introduce regressioni, il rollback è semplice. **NESSUN big-bang refactor**.

**Mapping Checkpoint → Passi (sez. 6.1-6.8)**:
- Checkpoint 0 ↔ Passo 1
- Checkpoint 1 ↔ Passo 2
- Checkpoint 2 ↔ Passo 3
- Checkpoint 3 ↔ Passo 4
- Checkpoint 4 ↔ Passo 4b (nuovo)
- Checkpoint 5 ↔ Passo 4c (nuovo)
- Checkpoint 6 ↔ Passo 6 + Passo 7
- Checkpoint 7 ↔ Passo 8 + checklist anti-leak

---

### 6.1-6.8 Dettaglio passi sequenziali

**Passo 1 — Duplica cartella**
```bash
cp -r apps/backend/custom-ecolaundry apps/backend/custom-blueclean
cd apps/backend/custom-blueclean
rm package-lock.json
rm testingLLM.md
rm docs/testing-llm-report-2026-05-24.md
rm -rf docs/pdf
```

**Passo 2 — Rename identifier tecnici (sed scriptato)**
- Eseguire le 5 passate sed in ordine (sez. 5.1)
- Aggiornare `package.json` name → `blueclean-demo`
- `npm install` per rigenerare lock

**Passo 3 — Branding manuale (settings + i18n + faqs)**
- `json/settings.json`: companyName/chatbotName/welcomeMessage
- `json/i18n/*.json`: 5-7 chiavi per lingua × 6 lingue
- `json/faqs.json`: 4 chiavi

**Passo 4 — Anonimizzazione luoghi**
- `json/locations.json`: rimappatura completa 6 location
- `utils/locations.ts`: canonical + aliases coerenti
- `docs/csv/*`: dati allineati

**Passo 5 — Test interni passano**
```bash
cd apps/backend/custom-blueclean
npm run typecheck
npm run test:unit
bash scripts/check-architecture.sh
```
Aggiustare i test che assertano valori specifici (`companyName === 'Ecolaundry'` → `'BlueClean'`).

**Passo 6 — Integrazione backend (Opzione A: coesistenza)**
- `seed.ts`: aggiungere blocco "Creating BlueClean workspace" parallelo (mantenere ecolaundry esistente)
- `playground.controller.ts`: rimuovere hardcode `ECOLAUNDRY_SLUG`, parametrizzare via header/query → fallback `blueclean` per demo
- `custom-client-chatbot.service.ts`: rimuovere fallback hardcoded slug `"ecolaundry"` (linea 203-207) o aggiungerlo anche per `"blueclean"`
- `escalation-email.service.ts`: dato che è un import **statico** (`require('../../../custom-ecolaundry/utils/human-message-email')`), questo è il **vincolo architetturale più grosso**. Opzioni:
  - (a) **Trasformarlo in import dinamico** in funzione di `chatbotId` (richiede piccolo refactor + test)
  - (b) duplicare il path: provare prima `custom-blueclean/utils/human-message-email`, fallback `custom-ecolaundry`
  - (c) Andrea sceglie cosa preferisce
- Frontend routes: aggiungere `/demo/blueclean/*` parallel a `/demo/ecolaundry/*`

**Passo 7 — DB sync per la demo**
```bash
npm run prisma:migrate     # se schema invariato, skip
npm run prisma:seed        # ricrea workspace blueclean
```
Verifica via Admin: `slug=blueclean`, `customChatbotId=blueclean`.

**Passo 8 — Smoke test demo end-to-end**
- Avvia `npm run dev:all`
- Apri `http://localhost:3000/demo/blueclean`
- Conversazione test: "Hola" → bot risponde "Hola, soy el asistente virtual de la lavandería. ¿En qué local estás?"
- Verifica: NESSUNA stringa "ecolaundry"/"Ecolaundry"/Goya/Pineda/Mataró nel reply o nel log

---

## 7 — Rischi e checklist di sicurezza

### 7.1 Rischi durante la migrazione

| Rischio | Mitigazione |
|---|---|
| Sed troppo aggressivo rompe `package-lock.json` / commenti tecnici | Eliminare `package-lock.json` prima di sed; rigenerare dopo. |
| Test rotti dopo rename (assert su `companyName='Ecolaundry'`) | Passo 5 dedicato: typecheck + test:unit + check-architecture. |
| Import statico in `escalation-email.service.ts` punta ancora a ecolaundry | Risolvere in Passo 6 — opzioni a/b/c. |
| `playground.controller.ts` cache singleton serve workspace sbagliato dopo restart | Passo 6: rimuovere `ecolaundryWorkspaceIdCache` o parametrizzare. |
| Stringhe brand "Ecolaundry" → "BlueClean" rompono layout UI (spazio extra) | Test visivo Passo 8 prima di mostrare a cliente. |
| `i18n/<lang>.json` chiavi non in parità → rule #12 check-architecture fallisce | Verifica diff `es.json` vs altre lingue prima di commit. |
| Asset PDF/CSV con metadati Ecolaundry leakano | Rimossi in Passo 1 (rm docs/pdf, sanitize csv). |
| F-log con 105 entries cita Ecolaundry → cliente lo vede al primo `cat docs/f-log.md` | Decisione binaria con Andrea: tenere o resettare. |
| Logger pipeline tag `'custom-blueclean'` non coerente con `agentChain` | Stessa stringa, verificare Passo 8. |

### 7.2 Checklist anti-leak (PRE-DEMO)

Eseguire dopo Passo 7, prima di Passo 8:

```bash
# 0 risultati attesi:
grep -rni 'ecolaundry\|Ecolaundry' apps/backend/custom-blueclean/
grep -rni 'Goya\|Hortes\|Pineda\|Alemanya\|Mataró\|Granollers' apps/backend/custom-blueclean/
grep -rni 'gelsogrove\|venezia44' apps/backend/custom-blueclean/        # email/password di test
grep -rni 'alberwaz' apps/backend/custom-blueclean/                      # vecchio link allowedExternalLinks
```

Se uno qualsiasi torna risultati → fix prima della demo.

### 7.3 Cosa NON cambia (intenzionale)

- Iron rules in `CLAUDE.md` del modulo → architettura condivisa, riusabile per qualsiasi cliente
- Struttura `prompts/`, `utils/branches/`, `utils/guards/`, `models/` → invariante, è il **valore tecnologico** del modulo
- Schema `chatbot-io.ts` (`ChatbotInput` / `ChatbotOutput`) → contratto col core backend
- Lingue supportate (es/it/en/ca/pt/fr) → invariate
- Logica detector/guard/router → invariata
- Test framework + check-architecture.sh → invariati
- Seed admin user (`admin@echatbot.ai`) → invariato

---

## 8 — Domande aperte da risolvere con Andrea PRIMA di iniziare

1. **Coesistenza o sostituzione?** Tenere `custom-ecolaundry` in parallelo (Opzione A) oppure sostituirlo (Opzione B)?
2. **Nome chatbot (`chatbotName`)?** Oggi è `Eco`. Per BlueClean proposta: `Blu`, `Bubbles`, `Clean`, altro?
3. **Città fittizia**: ok `Villanova del Sole` o preferisci `San Marco`, `Porto Verde`, `Sant'Elia`, altro?
4. **6 quartieri demo**: ok la mappatura (Centro, Marina, Aurora, Olivetto, Belvedere, Castello) o vuoi cambiarne qualcuno?
5. **6 vie demo**: ok (Piazza dei Tigli 4, Via del Porto 117, Via dell'Aurora 17, Strada Provinciale 1, Viale del Belvedere, Viale del Castello 37)?
6. **`AMBIGUOUS_PUEBLOES`**: svuotare il set (catena single-city, una sola città fittizia → niente ambiguità) — ok?
7. **Brand commerciali landmark**: sostituire "Mercadona"/"Carrefour" con generico ("supermercato", "Centro Commerciale Sole/Stella") o vuoi brand commerciali inventati specifici?
8. **Regione/Paese**: tagliare "(Spain)" dal `router.txt` (neutro multi-lang) o sostituire con altra geografia?
9. **Modelli macchina** (HS60xx / ED340): rinominare in `WM-100` / `DM-200` o tenere reali (raramente esposti al cliente)?
10. **F-log**: tenere le 105 entries (rischio leak storia ecolaundry) o resettare a F0 per demo?
11. **PDF Playbook**: confermi rimozione completa di `docs/pdf/` (raccomandato)?
12. **Import statico `escalation-email.service.ts`**: refactor dinamico (a) o doppio fallback path (b)?
13. **Frontend Playground**: forkare `PlaygroundPage.tsx` in `BlueCleanPlaygroundPage.tsx` o parametrizzare il componente esistente?
14. **Email/SMTP**: oggi `gelsogrove@gmail.com` ovunque. Per la demo cliente → mantenere o cambiare? (notification + smtp.from + supportEmails)
15. **Workspace DB**: la demo gira su DB locale dev (con `slug=blueclean` seeded), o c'è un ambiente staging dedicato?
16. **Documenti `docs/ecolaundry/` (root repo)**: tenere o nascondere/eliminare per la branch demo?

**Fingerprint tecnici (sez. 3.4)** — già concordati con Andrea ma confermare i dettagli:

17. **`enabledLanguages` ordine**: confermi opzione (a) `["es", "en", "it", "fr", "ca", "pt"]` (sposta `ca` in fondo, tieni 6 lingue)?
18. **Prezzi shift random**: vuoi che li shifti (+/- 0.50€) per evitare matching con listini pubblici del cliente reale?
19. **Etichette programmi macchina** (`60º (muy caliente)` etc.): tenere come sono (testo standard settore) o riscrivere generico?
20. **Codici display**: confermi mapping SEL→READY, PUSH→START, DOOR→LOCK, ALM→ERR, AL001→ERR-01?

**Usecases (sez. 3.5)** — Andrea ha chiesto di ridurre. Confermare:

21. **Short-list di 10 Casi**: confermi la selezione (Casi 2, 4, 6, 8, 9, 12, 25, 31, 33, 35) o vuoi cambiare alcuni?
22. **Casi non selezionati**: ok eliminarli da `usecases.md` (opzione a) o tenerli in `usecases-archive.md` (opzione b)?
23. **`cases.json` bridge**: confermi cleanup delle entries dei Casi eliminati per mantenere coerenza?

---

## 9 — Stima impatto (rough)

| Attività | Tempo stimato |
|---|---|
| Passo 1 (cp + rm) | 2 min |
| Passo 2 (sed scriptato + npm install) | 15 min |
| Passo 3 (settings + i18n + faqs manuale) | 30 min |
| Passo 4 (anonimizzazione geografica completa: città + 6 quartieri + 6 vie + landmark + modelli macchina + CSV + test fixture) | **2-4 ore** (881 righe locations.json + 9 CSV + ~40 test che usano `_helpers.ts` + usecases.md + f-log.md + prompts) |
| **Passo 4b — Anonimizzazione fingerprint tecnici** (codici display + central de pago + SAU→BC + email/URL fittizi + lingue + prezzi + programmi + CSV rinomina) | **3-5 ore** (40+ file: JSON, CSV, detector, guard, prompt, i18n × 6, ~15 test display, .env switch) |
| **Passo 4c — Riduzione + riscrittura usecases.md** (47 Casi → 10 Casi rappresentativi + sanitize geografica/fingerprint dei tenuti + cleanup cases.json) | **1.5-2 ore** |
| Passo 5 (test + fix assert hardcoded) | 30-60 min |
| Passo 6 (integrazione backend Opzione A) | 30-45 min |
| Passo 7 (DB seed + verify) | 15 min |
| Passo 8 (smoke test end-to-end) | 30 min |
| Sanitization checklist (PRE-DEMO) | 15 min |
| **Totale** | **10-15 ore di lavoro focalizzato** (anonimizzazione completa: geografia + fingerprint tecnici + riduzione usecases). NB: se Andrea vuole consegna rapida con rischio leak medio, si può saltare 4b/4c e tenere il modulo solo geo-anonimizzato (resta a 5-8 ore). |

---

## 10 — File "checkpoint" raccomandato

Quando inizierà l'esecuzione, mantenere `apps/backend/custom-blueclean/migrate.md` aggiornato spuntando i passi completati:

```
- [ ] Passo 1 — Duplica cartella
- [ ] Passo 2 — Rename identifier tecnici
- [ ] Passo 3 — Branding manuale
- [ ] Passo 4 — Anonimizzazione luoghi
- [ ] Passo 5 — Test interni passano
- [ ] Passo 6 — Integrazione backend
- [ ] Passo 7 — DB sync
- [ ] Passo 8 — Smoke test end-to-end
- [ ] Sanitization checklist
- [ ] Demo PRONTA
```

---

**End of analysis.** Nessun file modificato fuori da `apps/backend/custom-blueclean/migrate.md`. Prossimo step: Andrea risponde alle 12 domande (sez. 8) e dà il go per il Passo 1.
