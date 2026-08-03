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
   - ultimo messaggio nello storico più vecchio di 1 ora → `welcomeBackMessage`
     (welcome-back).
   - ultimo messaggio entro 1 ora → non è uno di questi due casi, si passa
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

### 2-C — Troubleshooting

1. Chiedere il numero di serie.
   - Validazione formato deterministica nel codice (regex), non nel prompt:
     inizia con `HK`, 19 caratteri totali. Pattern e messaggio di errore
     vanno in `settings.json` (es. `serialNumberPattern`,
     `serialNumberFormatHint`), **non** hardcoded — è specifico di questo
     tenant (vedi CLAUDE.md § 1A, esempio esplicito di violazione passata).
   - Dopo 3 tentativi non validi → gate pre-operatore, poi escalation.
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
   - **Non trovato** → gate pre-operatore, poi escalation (stesso comportamento
     di 2-A per il "non so aiutarti direttamente").

## Domande aperte / da decidere con Andrea prima di implementare

- Il gate pre-operatore condiviso: conferma che i 7 campi e l'ordine sopra
  sono corretti e completi (batteria come ultimo controllo tecnico, nome per
  ultimo prima dell'escalation).
- Timeout di 1 ora per welcome-back: valore fisso o da `settings.json`?
- Contatore "3 tentativi" sul seriale: per-sessione o persistito? (in
  demorobot il pattern equivalente — tentativi falliti su un nodo di flow —
  usa `registerFieldRequest` per-campo, non globale, vedi `flow-runtime.md` § 6)
