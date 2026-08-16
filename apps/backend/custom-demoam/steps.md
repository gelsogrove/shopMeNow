# custom-demoam — flusso ipotizzato

> Bozza di design, non ancora implementata. `custom-demoam/` oggi contiene
> solo `settings.json` e `.env` — nessun `agent.ts`/`state.ts`/`index.ts`.

## Requisiti generali

- Il DB (`Workspace` + colonna `customChatbotAdvancedSettings`) è la fonte di
  verità, **non** il file. Il form Settings in app ha un campo per ogni
  colonna dedicata (chatbotName, welcomeMessage, welcomeBackMessage,
  defaultLanguage, enabledLanguages, model, temperature, maxTokens, ecc.) più
  un box "Advanced Settings (JSON)" in `AIPersonalitySection.tsx` per tutto
  ciò che non ha una colonna propria (maxToolHops, intakeQuestions,
  serialNumberPattern, rateLimitedMessage, ecc.).
- Ad ogni save, il backend (`chatbot-settings-json.service.ts →
  writeChatbotSettingsJson`) **rigenera** `custom-demoam/settings.json`
  mergiando: file attuale su disco ← advanced settings JSON ← colonne
  dedicate del workspace (le colonne vincono se valorizzate, altrimenti resta
  il valore già su disco — mai scritto un blank). Le chiavi widget
  (colore/icona/titolo/quick replies) sono escluse a prescindere.
- Conseguenza pratica: se un campo manca nel `settings.json` letto a runtime,
  **non è un bug del codice del modulo** — è che nessun save è ancora
  avvenuto con quel campo valorizzato (visto oggi: il file su Heroku non ha
  `defaultLanguage`/`enabledLanguages`/`welcomeMessage`/`welcomeBackMessage`
  perché il deploy è precedente all'aggiunta di quei campi nel form).
- Il modulo (`agent.ts`/`state.ts` da scrivere) legge solo da questo file
  generato — non deve mai contenere copy cliente hardcoded (Rule 1A/1C).
- Nessun hardcoded phrase/keyword detection sull'input cliente (Rule 14) —
  tutta la classificazione di intento è LLM, il codice decide solo i
  meccanismi deterministici (gate, contatori, formato seriale).

## Step 1 — Identificazione cliente + lingua

1. Il canale è disattivo → rispondere con `wipMessage` (da settings), stop.
2. Cliente nuovo (numero di telefono non visto prima) → `welcomeMessage`.
3. Cliente noto:
   - ultimo messaggio nello storico più vecchio di 2 ore → `welcomeBackMessage`
     (welcome-back). Soglia di 2 ore **hardcoded nel codice** (decisione
     esplicita di Andrea, 2026-08-03 — eccezione a Rule 1A registrata qui;
     nel codice, commentare la costante con riferimento a questo file).
     Portata da 1 ora a 2 ore il 2026-08-16, CONTRACT.md riga 32.
   - ultimo messaggio entro 2 ore → non è uno di questi due casi, si passa
     alla chat normale gestita dall'LLM (step successivo, fuori da questo
     step 1).
4. Lingua di risposta: quella rilevata dal messaggio del cliente, **solo se**
   presente in `settings.enabledLanguages`; altrimenti `settings.defaultLanguage`.
5. Qui si inizializza lo state di sessione con almeno la lingua risolta.

## Step 2 — Classificazione dell'intento

L'LLM classifica il turno in una delle tre categorie (nessun pattern-matching
nel codice):

- **A. Lamentela** (complaint)
- **B. Domanda generica** (FAQ)
- **C. Descrizione di un problema da risolvere** (troubleshooting)

### Gate pre-operatore (condiviso da A e C)

I due path che finiscono dall'operatore passano dallo **stesso gate**, non
duplicato: stessi campi, stesso ordine, un solo posto nel codice dove è
definito (pattern già in produzione in `custom-demorobot`, vedi
`flow-runtime.md` § 8 "Escalation — un solo gate, da ogni strada").

Campi richiesti, nell'ordine, solo quelli mancanti:

1. numero di serie (se non già raccolto)
2. descrizione del problema (se non già raccolta)
3. robot ON?
4. wifi ON?
5. su schedule cutting?
6. batteria sufficiente?
7. nome del cliente → `callfunction` per aggiornare il nome utente

Messaggio finale sempre da `settings` (es. `humanSupportMessage` con
placeholder `{{customerName}}`), mai testo scritto nel codice.

### 2-A — Lamentela

Va dritto al gate pre-operatore sopra, poi escalation.

### 2-B — FAQ

1. Cercare la risposta nelle FAQ (fonte dati esistente, non da inventare).
2. Trovata → rispondere con quella.
3. Non trovata → chiedere solo il nome (`callfunction` per salvarlo) e
   passare all'operatore — **non** l'intero gate di 7 campi sopra, qui basta
   il nome perché non c'è un problema tecnico da diagnosticare.
   - Poiché in questo path seriale/descrizione/stato macchina non sono mai
     stati raccolti, il messaggio di handoff verso l'operatore in questo
     caso specifico deve segnalarlo (es. variante di `humanSupportMessage`
     o flag nello stato passato all'operatore), così chi risponde sa di
     dover chiedere lui i dettagli tecnici da zero invece di aspettarseli
     già raccolti.

### 2-C — Troubleshooting

1. Chiedere il numero di serie.
   - Validazione formato deterministica nel codice (regex), non nel prompt:
     inizia con `HK`, 19 caratteri totali. Pattern e messaggio di errore
     vanno in `settings.json` (es. `serialNumberPattern`,
     `serialNumberFormatHint`), **non** hardcoded — è specifico di questo
     tenant (vedi CLAUDE.md § 1A, esempio esplicito di violazione passata).
   - Dopo 3 tentativi non validi → gate pre-operatore, poi escalation.
     Contatore **per-sessione**, non persistito (confermato — coerente col
     pattern `registerFieldRequest` di demorobot, vedi `flow-runtime.md` § 6).
2. Chiedere quando è iniziato il problema.
3. Cercare un flow che risponda al problema descritto:
   - **Trovato** → agganciare quel flow ed eseguirlo con lo stesso motore
     deterministico già in produzione in `custom-demorobot`
     (`flow-machine.ts` + `currentNodeId` in `state.ts`): il codice sa sempre
     qual è la domanda dovuta ora (`FlowNode.question`), l'LLM la traduce e
     classifica solo la risposta del cliente fra gli edge disponibili
     (`answer_step` con enum dinamico). Nessuna deduzione della posizione nel
     flow dallo storico — quello è il bug che `flow-runtime.md` di demorobot
     documenta e ha già risolto.
   - Il flow termina in un nodo `ESCALATE` → gate pre-operatore (di norma già
     soddisfatto a quel punto, essendo passato da qui), poi escalation.
     ⚠️ **Non dare per scontato il riuso automatico dei campi**: verificato
     su `custom-demorobot` (2026-08-03) che il motore flow-machine oggi
     **non** copia le risposte dei nodi flow nel bucket che il gate legge
     (`SessionState.collectedData`) — `FlowNode.fieldKey` esiste nel tipo ma
     non è mai letto a runtime (`agent.ts`, handler di `answer_step`).
     Risultato: se un nodo flow chiede "wifi acceso?" e poi si arriva al
     gate, oggi il gate lo richiederebbe di nuovo. Per demoam, decidere
     esplicitamente una delle due:
     (a) auto-scrivere in `collectedData[node.fieldKey]` quando
         `answer_step` matcha un nodo il cui `fieldKey` coincide con un
         campo del gate;
     (b) accettare la ridondanza per la prima versione e rivalutare se dà
         fastidio in pratica.
     Nessuna delle due è ancora stata scelta — bloccante per l'implementazione
     del riuso campi, non per l'implementazione del resto del flusso.
   - **Non trovato** → gate pre-operatore, poi escalation (stesso comportamento
     di 2-A per il "non so aiutarti direttamente").

## Decisioni prese con Andrea (2026-08-03)

- ✅ Gate pre-operatore condiviso: 7 campi e ordine confermati come sopra.
- ✅ Timeout welcome-back: hardcoded nel codice (eccezione a Rule 1A, vedi
  nota nello Step 1). 1 ora inizialmente, portato a 2 ore il 2026-08-16
  (CONTRACT.md riga 32).
- ✅ Contatore "3 tentativi" sul seriale: per-sessione, non persistito.

## Domande aperte / da decidere con Andrea prima di implementare

- Riuso campi flow ↔ gate (vedi nota ⚠️ in 2-C.3): auto-copiare le risposte
  dei nodi flow nel bucket del gate, o accettare la domanda ridondante nella
  prima versione? Verificato che oggi non succede automaticamente in
  demorobot, quindi va scelto esplicitamente, non presunto.
