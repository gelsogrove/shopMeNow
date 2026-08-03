# TODO — custom-demoam

> Scritto 2026-08-04. Stato di avanzamento dell'implementazione. Il design è
> in `steps.md` (bozza + decisioni prese con Andrea) — questo file traccia
> cosa è stato scritto, cosa manca, e cosa resta da verificare prima del
> primo giro reale.

---

## ✅ Fatto — prima implementazione (2026-08-04)

Modulo scritto da zero seguendo `steps.md`, riusando i pattern già in
produzione in `custom-demorobot` (vedi il suo `docs/flow-runtime.md`).

- `state.ts` — `SessionState` con `intent` (A/B/C), `greeting` (new/returning/
  none), `skippedTechnicalGate`; `askedCounts` per-campo per il gate a 7 e per
  il contatore seriale (`serialNumber_invalid`); lingua sticky via trailer
  `⟦LANG:xx⟧`; persistenza in `ChatSession.context` identica a demorobot.
  **Nuovo rispetto a demorobot**: `resolveEnabledLanguage` +
  `seedLanguageIfNeeded` ora filtrano contro `enabledLanguages`/
  `defaultLanguage` — demorobot non lo fa (verificato, vedi steps.md).
- `flow-machine.ts` — copiato pressoché 1:1 da demorobot (`advance`,
  `allowedLabels`, `rootNodeId`, `buildFlowGraph`). Pure, testabile in
  isolamento.
- `gate.ts` — equivalente di `flow-selection.ts` di demorobot, ma:
  - `PRE_OPERATOR_ORDER` a **7 campi** (serialNumber, problemDescription,
    robotPoweredOn, wifiActive, cutSchedulingActive, batterySufficient, name)
    invece dei 4 di demorobot — ordine confermato da Andrea.
  - `nextPreOperatorStep` accetta `skipTechnical`: quando true (path FAQ non
    trovata, steps.md 2-B.3) l'ordine collassa a solo `['name']`.
  - Nessun "intake" separato come in demorobot — qui serialNumber e
    problemDescription sono dentro lo stesso gate a 7, non un gate a parte
    prima.
- `agent.ts` — tool `start_flow`/`answer_step`/`abandon_flow`/`remember`/
  `escalate_to_operator`; classificazione A/B/C delegata al prompt (nessun
  tool dedicato — il modello sceglie il binario descrivendolo nel testo,
  niente pattern-matching in codice, CLAUDE.md §14); validazione seriale con
  contatore a 3 tentativi (`MAX_SERIAL_ATTEMPTS`) che poi salta dritto al
  gate; welcome/welcome-back decisi in codice da
  `isReturningCustomer`/`lastMessageAt`, non dedotti dall'LLM
  (`WELCOME_BACK_STALE_MS` = 1h, hardcoded per decisione esplicita di Andrea).
- `prompts/common.md` — riscritto da zero per il flusso A/B/C/gate di
  demoam, non è un porting di quello di demorobot.
- `settings.json` — aggiunte le chiavi mancanti: `wipMessage`,
  `humanSupportMessage`, `rateLimitedMessage`, `sessionTooLongMessage`,
  `serialNumberPattern`/`Hint`, `gateQuestions` (7 chiavi).
- `package.json`/`tsconfig.json` — scaffolding copiato da demorobot,
  `include` list adattata ai file di demoam.
- **Typecheck pulito** (`npx tsc --noEmit -p tsconfig.json`), verificato che
  `custom-demorobot` continua a compilare invariato (non toccato).

## ⚠️ Deciso ma NON implementato — riuso campi flow ↔ gate

steps.md 2-C.3: risposto ad Andrea con "accetta ridondanza" per la v1 — se
un nodo flow chiede "wifi acceso?" e poi si arriva al gate, oggi **verrà
richiesto di nuovo**, esattamente come in demorobot (verificato che
`FlowNode.fieldKey` non viene mai letto a runtime né in demorobot né in
questa nuova implementazione — `answer_step` non scrive in `collectedData`).
Da rivalutare se in pratica dà fastidio ai clienti reali.

## ✅ Test unitari scritti (2026-08-04)

60 test in `apps/backend/__tests__/unit/`, mirror della suite di demorobot
(Rule 7B — solo unit test, nessun `__tests__/integration/`):

- `demoam-flow-machine.spec.ts` — `advance`/`allowedLabels`/`rootNodeId`,
  porting 1:1 dei test di demorobot (il modulo è identico).
- `demoam-flow-step.spec.ts` — `startFlow` fissa `currentNodeId` alla root,
  `formatFlowStepBlock` detta la domanda verbatim.
- `demoam-gate.spec.ts` — catalogo flow, `start_flow`, **e il pezzo nuovo**:
  ordine dei 7 campi del gate, skip dei campi non configurati/esauriti,
  short-circuit `skipTechnical` per il path FAQ-non-trovata (solo `name`).
- `demoam-language.spec.ts` — sticky-language via trailer, **e il pezzo
  nuovo**: `resolveEnabledLanguage`/`seedLanguageIfNeeded` filtrati contro
  `enabledLanguages`/`defaultLanguage` (demorobot non lo fa).
- `demoam-orchestration.spec.ts` — grep del sorgente per copy hardcodato
  (stesso pattern di `demorobot-orchestration.spec.ts`), verifica che il
  cap a 3 tentativi seriale sia nel codice e che `askedCounts` non sia mai
  persistito in `dehydrateState`.

Tutti e 60 passano; suite completa (`npm run test:unit`) verde, 266/266 suite,
nessuna regressione su demorobot o altri moduli.

## ✅ Wiring host — risolto senza toccare l'host (2026-08-04)

Verificato leggendo `custom-client-chatbot.service.ts`: il dispatch è
completamente generico (`customChatbotId = "demoam"` → import dinamico di
`custom-demoam/index.ts`, nessuno switch da aggiungere). Adattato il modulo
al contratto REALE dell'host invece di chiedere plumbing nuovo:

- **Canale spento**: gestito UPSTREAM dall'host (`invoke()` risponde con
  `workspace.wipMessage` prima di caricare il modulo) — rimosso il gate
  interno `channelActive` che era dead code. Stesso contratto di demorobot.
- **Welcome vs welcome-back**: derivato in codice da ciò che l'host già
  passa — history con timestamp ISO + nome cliente — via `resolveGreeting`
  (funzione pura in `state.ts`), ricalcolato ogni turno. Niente
  `isReturningCustomer`/`lastMessageAt` da aggiungere all'host.
- **`config.messages`**: rinominati i campi per matchare quello che l'host
  emette davvero (`welcomeBack`, `humanSupport`, `rateLimited`,
  `sessionTooLong`, con `{{customerName}}` già sostituito); tutto il resto
  arriva da `settings` (il blob DB-merged che l'host passa a ogni turno).
- **Handler `getFaqs`/`listFlows`/`loadFlow`**: iniettati incondizionatamente
  dall'host per ogni custom chatbot, stesse tabelle Prisma — zero modifiche.

## 📋 Setup Heroku — da eseguire (Andrea, manualmente)

`heroku-amrobots-setup.sql` in questa cartella: punta il channel amrobots a
`customChatbotId='demoam'`, valorizza le colonne dedicate (welcome, welcome
back, wip, human support, lingue) e mette in `customChatbotAdvancedSettings`
le chiavi senza colonna propria (gateQuestions, serialNumberPattern, …).
Dopo lo script: UN save dalla pagina Settings dell'app rigenera
`settings.json` sul dyno. Prima di eseguire: verificare il WHERE con la
SELECT in testa al file.

⚠️ Nota: il commento su `Workspace.enabledLanguages` nello schema Prisma dice
"documentation only, does NOT restrict runtime behaviour" — per demoam non è
più vero (il modulo la usa davvero per filtrare la lingua). Non ho toccato lo
schema (Rule 13); il commento andrà aggiornato quando capita.

## ✅ Primo giro reale — bug trovato e fissato (2026-08-04)

Prima conversazione vera (taglio irregolare, canale amrobots): validazione
seriale OK, raccolta caso OK, "non ho una procedura" onesto — MA il modello
ha poi **inventato una domanda** ("il display mostra un codice di errore?")
invece di passare dal gate, e ha escalato senza chiedere nome né check.

Due cause, due fix:
1. **Mancava `tool_choice: 'required'`** (il §10 di flow-runtime.md di
   demorobot, non portato in demoam). Ora in `agent.ts`: col caso raccolto
   (seriale + descrizione) e nessun flow attaccato, l'API obbliga il modello
   a chiamare `start_flow` o `escalate_to_operator` — il testo libero (=la
   domanda inventata) è strutturalmente impossibile. Le conversazioni FAQ
   non raccolgono mai il seriale, quindi non vengono mai forzate.
2. **`gateQuestions`/`humanSupportMessage` non configurati nel DB** → il
   gate "fails toward silence" saltava tutto. Risolve lo script SQL.

Decisioni Andrea 2026-08-04:
- Path "nessun flow trovato" → gate COMPLETO (4 check tecnici + nome), non
  solo il nome.
- Hand-off message (base italiano, LLM traduce): "Grazie {{customerName}},
  disattivo il chatbot e ti metto in comunicazione con il nostro customer
  care, che ti contatterà il prima possibile."
- Copy nel DB in italiano (lingua base, CLAUDE.md §1) — vedi SQL aggiornato.

## ✅ Secondo giro reale su demoam — due bug trovati e fissati (2026-08-04)

Setup completato: SQL eseguito su Supabase (workspace `5870e678-…`),
deploy v1044, switch `customChatbotId='demoam'` fatto. Primo test demoam:
niente welcome + domanda improvvisata ("quando hai notato? all'improvviso o
gradualmente?"). Cause e fix:

1. **Welcome mancante**: il numero nuovo aveva nome auto-generato
   "Visitor o5thgaq6" → `hasKnownName=true` → `greeting='returning'` invece
   di `'new'`. Fix in `chatbotFn`: un nome che inizia con `"Visitor "`
   (convenzione host, `visitor-id.service.ts` — stesso check di
   `prompt-variable-builder.service.ts`) non conta come nome noto.
2. **Domanda improvvisata durante la raccolta**: mancava il gate di intake
   di demorobot. Portato in `gate.ts` (`nextIntakeStep`/`formatIntakeBlock`,
   ordine seriale → descrizione → quando, wording da `gateQuestions` incl.
   nuova chiave `problemStartedWhen`): mentre il caso è incompleto il codice
   detta LA domanda, l'LLM traduce. `tool_choice` forzato ora scatta a
   intake completo, e **si spegne dopo il primo tool call del turno** —
   altrimenti il loop resterebbe intrappolato (il testo dopo un rifiuto del
   gate È la domanda dettata, non improvvisazione).

⚠️ Nota per demorobot: il suo `mustForceToolChoice` NON ha lo spegnimento
post-tool-call (punto 2) — sospetto abbia lo stesso rischio di trappola
quando il gate rifiuta a intake già completo. Non toccato (Rule 13), da
verificare con Andrea.

## 🔬 Non ancora verificato

- [ ] **Deploy dei fix di questo giro** (Visitor-name + intake gate) — il
      build v1044 NON li contiene, serve nuovo commit+push+deploy.
- [ ] **Terzo giro di test** dopo il deploy: welcome per numero nuovo,
      seriale → descrizione → quando dettati dal codice, gate completo,
      hand-off col nome.
- [ ] **Nessun flow reale creato** nel builder per demoam.

## 📌 Note di design da ricordare

- Timeout welcome-back: **1 ora, hardcoded nel codice** (`agent.ts` —
  `WELCOME_BACK_STALE_MS`), eccezione esplicita a CLAUDE.md §1A concordata
  con Andrea il 2026-08-03/04 — vedi `steps.md` Step 1.
- Contatore tentativi seriale: **per-sessione, non persistito**
  (`askedCounts['serialNumber_invalid']` in `state.ts`, mai scritto in
  `dehydrateState`) — stesso principio di `turnCount`/rate-limit timestamps.
- Path FAQ-non-trovata: il briefing operatore segnala esplicitamente
  `skippedTechnicalGate` così l'operatore sa di dover chiedere lui i dettagli
  tecnici da zero (steps.md 2-B.3).

Dettaglio completo del design/decisioni: `steps.md` in questa stessa cartella.
