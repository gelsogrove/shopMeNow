# demoRobot — Specifica architetturale

> Specifica tecnica per l'implementazione. Non ancora un piano formale — resta da chiudere il lookup serial→modello (§10) prima di poter procedere.

Stato: **analisi completata, nessun codice scritto**.

---

## 1. Il progetto

**demoRobot** — nuovo cliente (settore robotica), custom chatbot di supporto tecnico/troubleshooting per robot (es. da taglio/giardinaggio — cfr. "cut scheduling").

**Chiave di lettura**: questo non è un chatbot visuale, è un **CMS per prompt** in cui il contenuto viene autorato tramite un editor a grafo invece che scrivendo markdown a mano. Il runtime conversazionale resta quasi identico a quello di `custom-demowash` (stesso turn loop, stessa PII redaction, stessa lingua sticky, stessi tool con side-effect); quello che cambia è **come il prompt viene prodotto**: non più un file `.md` scritto da uno sviluppatore, ma un grafo disegnato da un utente non tecnico e compilato automaticamente.

La pipeline reale del sistema:

```
Editor (React Flow) → Compiler → Knowledge Base (DB) → Retriever → Runtime (LLM)
```

Il runtime, ridotto all'osso:

```
se emergenza → escalate, fine turno
altrimenti:
  lookup modello (da serial number)
  se flow già agganciato → usa lo snapshot
  altrimenti → retrieval
  prompt = common + session + flow compilato
  → LLM → eventuali tool → persist session
```

La complessità reale del progetto è a monte del runtime — nell'editor, nel compilatore e nel data model, non nel turn loop.

---

## 2. Integrazione con la piattaforma

Verificato nel codice del backend host (non solo dedotto per analogia):

- **`customChatbotId`**: campo su `Workspace` (Prisma, `String?`), contiene l'id nudo (es. `"demorobot"`), **non** un path. Il resolver del backend (`custom-client-chatbot.service.ts`) applica una convenzione di naming (`"X"` → cartella `"custom-X"`) e importa il modulo con `tsImport`, equivalente funzionale a un `import()` dinamico. **Non esiste e non serve un `customChatbotPath` separato** — l'id stesso, via convenzione, è la fonte del path.
- **`ChatbotInput.channel`**: resta `'whatsapp' | 'widget' | 'playground'`, tipo invariato, nessuna estensione necessaria — demoRobot userà `'widget'`.
- **Non esiste un channel `'flow'`.** Esiste però, nello schema Prisma, un campo diverso — `Workspace.channelMode` (enum `ECOMMERCE | INFORMATIONAL | FLOW`) — che è il **vecchio** Visual Flow Builder, esplicitamente deprecato (CLAUDE.md §17, F50, 2026-05-13: *"Visual Flow Builder DEPRECATED... sostituito da: `workspace.customChatbotId` → modulo code-based"*). demoRobot **non** deve usare `channelMode: FLOW` — è il motore che il paradigma custom-chatbot ha sostituito. **Aperto**: come il sistema deve riconoscere "questo workspace usa il meccanismo a grafo/retrieval" — probabilmente basta la sola presenza di `customChatbotId = "demorobot"` (nessun flag aggiuntivo necessario), da confermare in fase di piano.
- **Nessun MCP**: verificato che i chatbot custom-* esistenti non usano Model Context Protocol per i tool — MCP nel repo è solo tooling di sviluppo (Claude Code), non qualcosa a cui i chatbot lato cliente si agganciano. I tool con side-effect (`escalate_to_operator`, `schedule_consultation`, ecc.) sono normali function-call OpenRouter, con handler iniettati in `ChatbotInput.config.handlers` — demoRobot segue lo stesso schema, nessun MCP da aggiungere.
- **Persistenza messaggi**: il modulo custom non tocca mai il DB per i messaggi. È il backend host che, dopo che `chatbotFn` ritorna, salva user+assistant message nella tabella `ConversationMessage` (non `Message`, che è un modello diverso/più vecchio) — stesso comportamento ereditato automaticamente, nessuna azione richiesta lato modulo.
- **Crediti**: gestiti interamente dall'host, in due fasi attorno alla chiamata al modulo — pre-check prima di invocare `chatbotFn` (blocca con HTTP 402 se il credito è insufficiente), deduzione reale dopo l'invio della risposta (deliver-then-bill, non pre-paid — un messaggio consegnato non si può ritirare). Scala `User.creditBalance`, condiviso tra i workspace dello stesso proprietario. In modalità playground nessuna deduzione. Ereditato automaticamente, nessuna azione richiesta lato modulo.

**Da individuare in fase di piano**: come si provisiona/pubblica concretamente il widget per un nuovo workspace (stesso meccanismo di demowash).

---

## 3. Editor visuale (flow-builder)

Pannello backoffice dove un utente non tecnico può: creare un nodo (domanda), definire risposte possibili, collegare ogni risposta a un nodo figlio diverso, spostare i nodi sul canvas, allegare documenti/immagini/video/link a qualunque nodo.

**Libreria**: [React Flow](https://reactflow.dev/) (`@xyflow/react`) — MIT license, gratuita in produzione, nessuna feature core dietro paywall. Standard de facto per editor a nodi in React (Typebot, n8n). Nessun conflitto con lo stack del backoffice (React 19 + Vite + TypeScript + Tailwind + Radix UI).

Il grafo è **UX di authoring, non un motore di esecuzione**: non esiste un flow-engine deterministico che esegue nodo-per-nodo (sarebbe reintrodurre XState/guard-layer, il paradigma legacy già abbandonato). Il grafo viene compilato in prosa markdown; l'esecuzione del flow durante la chat resta 100% in capo all'LLM, che può saltare domande già coperte dal contesto e non è vincolato da una state machine.

---

## 4. Il compilatore

Componente centrale del sistema — trasforma un grafo (nodi + edge) in artefatti pronti per l'LLM e per il retrieval.

```typescript
compileFlow(nodes, edges) → {
  compiledPrompt:      string           // markdown verboso, per l'LLM che esegue il flow
  retrievalDocument:   string           // testo breve e denso, solo per calcolare l'embedding
  hash:                string           // sha256(compiledPrompt)
  assets:              Asset[]          // allegati effettivamente referenziati dal grafo
  validationReport:    ValidationError[]  // vuoto se valido; altrimenti blocca la pubblicazione (sotto)
  warnings:            string[]         // non bloccanti (es. nodo isolato mai raggiunto, fieldKey duplicata)
}
```

`assets`/`validationReport`/`warnings` non sono un secondo giro di elaborazione — il compilatore li conosce già mentre valida e attraversa il grafo (§4.1), quindi li espone come output di prima classe invece di ricalcolarli altrove (es. per popolare l'UI del canvas con gli errori, o per un secondo controllo lato backoffice sugli allegati usati).

**Responsabilità**:
1. **Validazione del grafo**: nodo root unico, niente cicli non ammessi (eccetto `terminalType: 'LOOP'`), ogni percorso raggiunge un terminale, allegati referenziati esistono e appartengono al `RobotModel` corretto
2. **Ordinamento topologico** dal root, determina la sequenza nella prosa
3. **Compilazione markdown** → `compiledPrompt`
4. **Generazione retrieval document** → `retrievalDocument` (sotto-prodotto dello stesso passo, non un secondo giro)
5. **Estrazione allegati referenziati**
6. **Decisione su ricalcolo embedding** (solo se `retrievalDocument` cambia) e incremento versione

**Determinismo obbligatorio**: stesso grafo → `compiledPrompt` identico byte-per-byte → stesso hash → stesso embedding. Nessun elemento non deterministico (timestamp, ordinamento instabile, ID casuali nel testo). Rende triviali cache, diff, versioning e test.

**Due documenti separati, non uno**: `compiledPrompt` (verboso, per l'esecuzione) e `retrievalDocument` (denso, solo per l'embedding — titolo, sintomi, sinonimi, mai le istruzioni operative tipo "Se NO → rispondi così", che diluirebbero l'embedding). Entrambi generati dallo stesso `compileFlow()`, mai scritti a mano dall'utente.

**Collegamenti tra domande nel testo compilato**: prosa lineare (sequenza numerata, rami "Se NO/Se SÌ" scritti inline) per flow semplici come quello di §6. Riferimenti nominati con ancore (`[nodo:wifi]`) solo se emerge un caso reale di sotto-flusso condiviso da più nodi genitori — non costruito preventivamente. In nessun caso i "link" sono navigabili a runtime: restano testo che l'LLM legge e interpreta, mai un meccanismo di jump nel codice.

**Fallimento della validazione**: un `Flow` con validazione fallita non diventa mai raggiungibile dal retrieval. Se era già pubblicato, resta pubblicata l'ultima versione valida finché l'edit corrente non passa la validazione. Aperto in fase di piano: se il salvataggio in bozza resta comunque possibile con errori segnalati in UI, e dove nel canvas vengono mostrati (probabile: sul `FlowNode.id` incriminato).

**Testabilità — snapshot testing**, conseguenza diretta del determinismo richiesto sopra: dato un `flow.json` fisso in input, `compile()` deve produrre sempre lo stesso `compiledPrompt`, verificabile con un normale test a snapshot (`expect(compileFlow(fixture)).toMatchSnapshot()`). Cattura regressioni nel compilatore stesso (es. un refactor che cambia l'ordine di attraversamento) senza dover verificare a mano l'intero testo generato.

---

## 5. Data model

```
RobotModel  1 ─── N  Flow
RobotModel  1 ─── N  Asset
Flow        1 ─── N  FlowNode
FlowNode    1 ─── N  FlowEdge
FlowNode    N ─── N  Asset   (tramite FlowNodeAttachment)
```

**RobotModel**: `id`, `name` (es. "RoboCut X200"), `slug`, `manufacturer?`, `description?`, `lookupRules` (come si risolve `serialNumber → questo modello`, §10), `createdAt`/`updatedAt`.

**Flow**: `id`, `robotModelId`, `title` (es. "Rumore strano"), `description`, `keywords?` (sinonimi/varianti che il grafo potrebbe non contenere — es. "vibra", "cigola", "ronzio" per un flow chiamato "Rumore strano" — compilati a mano dall'utente, opzionali), `retrievalDocument`, `embedding`, `compiledPrompt`, `hash`, `status` (bozza/pubblicato), `version`, `createdAt`/`updatedAt`.

**FlowNode**: `id`, `flowId`, `question` (lingua base italiano), `position` (`{x,y}`), `fieldKey?` (slug della chiave con cui il dato raccolto finisce in `SessionState.collectedData`), `fieldType?` (`string`|`number`|`boolean`|`date`|`enum`), `terminalType`.

`fieldKey`/`fieldType` rendono il nodo il contratto esplicito del dato che raccoglie: il compilatore sa cosa aspettarsi, il backoffice può validare in editing, il tool `remember` (esteso, sotto) non deve inventare le chiavi — il set valido è sempre l'insieme dei `fieldKey` del `Flow` agganciato in quel momento, mai una lista statica nel codice.

```typescript
type TerminalType =
  | null              // nodo intermedio, ha ancora edge in uscita
  | 'SELF_SERVICE'     // terminale, risposta finale, nessuna escalation
  | 'ESCALATE'         // terminale, il compilatore emette escalate_to_operator
  | 'END'              // terminale, chiusura semplice
  | 'LOOP'             // riservato — riporta a un nodo precedente, non ancora un caso reale, da validare in fase di piano
```

Un unico campo enumerato invece di due bool indipendenti (`isTerminal`/`triggersEscalation`), che avrebbero permesso combinazioni prive di senso.

**FlowEdge**: `id`, `sourceNodeId`, `label` (es. "Sì"/"No", o testo libero), `targetNodeId` (nullable = fine flusso).

**Asset**: `id`, `robotModelId` (vive a livello di modello, non di nodo — deduplicato), `type` (`document`|`image`|`video`|`link`), `url`, `title`, `language?` (per documenti tradotti).

**FlowNodeAttachment**: `nodeId`, `assetId` — relazione molti-a-molti, così lo stesso `Asset` (es. `manuale-x200.pdf`) è caricato una sola volta e referenziato da più nodi senza duplicazione.

**Punti aperti**: modellazione di sotto-flussi condivisi da più genitori (riuso vs duplicazione — deciso di partire senza, §4); distinzione nodi "raccolta libera" vs "scelta chiusa" nell'editor (probabilmente coperta da `fieldType`).

---

## 6. Flow diagnostico generico (caso di riferimento)

```
[Numero di serie] → [Serial number] → [Descrizione problema] → [Quando è successo]
    → [Robot acceso?]
        No  → sotto-flusso "robot spento" → chiudi (self-service)
        Sì  → continua
    → [Wifi on?]
        No  → sotto-flusso "wifi off" → chiudi (self-service)
        Sì  → continua
    → [Cut scheduling attivo?]
        No  → sotto-flusso "cut scheduling" → chiudi (self-service)
        Sì  → tutti i check OK → escalate_to_operator(reason, summary) → email operatore
```

Non è un albero rigido a esecuzione cieca: se il cliente anticipa un'informazione (es. "il robot è acceso ma il wifi è spento"), l'LLM salta la domanda già coperta.

Questo flow resta il caso "generico", valido per qualunque modello — vive fuori dalle knowledge base per-modello e si aggancia solo come fallback quando il retrieval (§8) non trova un flow specifico sufficientemente simile al problema descritto.

---

## 7. Escalation → operatore

Il bot chiama `escalate_to_operator` (stesso tool con side-effect email di demowash, via nodemailer/SMTP). Il `summary` è costruito dall'LLM con i fatti raccolti lungo il percorso, stesso template briefing strutturato già usato in `custom-demowash/prompts/common.md`. Il nodo terminale con `terminalType: 'ESCALATE'` istruisce il compilatore a emettere questa istruzione invece di un semplice testo di chiusura.

**Lingua del summary**: fissa e configurabile (`operatorBriefingLanguage`), indipendente dalla lingua della conversazione.

**Reason distinti per i diversi casi di escalation**:

| `reason` | Trigger |
|---|---|
| Check tecnici tutti OK | Flow diagnostico esaurito, nessuna soluzione self-service |
| `unknown_model` | Lookup serial→modello fallito (§10) |
| `no_matching_flow` | Modello risolto, ma nessun Flow abbastanza simile al problema |
| `emergency` | Casi estremi — priorità assoluta, vedi §9 |

---

## 8. Retrieval — trovare il flow giusto

Con centinaia di flow configurati e in crescita, "tutto nel prompt sempre" (come fa demowash con ~30 casi/6 sedi) non regge — supera il limite pratico oltre cui serve RAG (`architecture.md §15` di demowash lo fissa a ~150 elementi). Serve un layer di retrieval, separato dal compilatore.

### Due passi, non uno

**Passo 1 — deterministico**: `serialNumber → RobotModel` (lookup, non intent detection — matching su un fatto fisso, stesso principio di `detectVenue` in demowash). Ristringe drasticamente lo spazio prima del passo semantico.

**Passo 2 — semantico**: dentro il sottoinsieme già ristretto al modello, embedding del problema descritto → top-K flow più simili.

```typescript
findRelevantFlows({
  robotModelId: string,
  query: string,
  k: number,        // tipicamente 1-3
}) → Array<{ flow: Flow, similarity: number }>
```

Layer separato dal compilatore per contratto — permette di cambiare provider/strategia di embedding senza toccare la compilazione, e viceversa.

**Dove vive l'embedding**:

```
Flow.retrievalDocument → EmbeddingProvider (chiamata esterna) → vettore salvato in Flow.embedding
```

Il vettore vive come colonna sul `Flow` stesso (es. `pgvector` su Postgres, coerente con lo stack esistente — non un vector store esterno separato, a meno che il volume lo giustifichi in futuro). Il retrieval (`findRelevantFlows`) fa una query di similarità su questa colonna, ristretta a `robotModelId` (passo 1).

**Non un router-LLM classico**: niente call LLM dedicata a "che problema è questo?" prima della call che risponde (pattern esplicitamente scartato da demowash, raddoppia costo/latenza senza guadagno alla scala buona). Il retrieval è un pre-filtro deterministico: seleziona quali flow entrano nel prompt, non decide cosa rispondere — la decisione resta sempre in capo all'unica call LLM del turno.

### Il retrieval gira solo per agganciare, non ad ogni turno

Un messaggio breve/ambiguo ("sì", "no", un numero) non porta segnale semantico sufficiente per un retrieval affidabile. Se rigirasse ad ogni turno, rischierebbe di perdere l'aggancio proprio mentre il cliente sta rispondendo a una domanda del flow in corso.

**Regola**: il retrieval gira solo se `SessionState.activeFlowId` è vuoto, oppure se il messaggio è abbastanza sostanzioso da rappresentare un cambio volontario di problema (soglia da definire — punto aperto, §10). Una volta agganciato, il flow resta fisso finché non si chiude per una di tre condizioni: nodo terminale raggiunto, escalation, o cambio volontario di problema.

**"Cambio volontario di problema"**: tre strade valutate, nessuna ancora scelta — soglia euristica su lunghezza/parole (economica, un po' euristica), l'LLM stesso segnala il cambio (tool o marker dedicato, più affidabile ma nuovo meccanismo da progettare), tool dedicato esplicito. Partire dalla soglia euristica per il primo giro, passare alle altre se produce troppi falsi positivi/negativi.

### Nessun match → operatore, con due fallback distinti

| | Fallisce il passo 1 | Fallisce il passo 2 |
|---|---|---|
| Situazione | Serial number non riconosciuto | Modello confermato, nessun Flow abbastanza simile |
| `reason` | `unknown_model` | `no_matching_flow` |
| Comportamento | Probabilmente un tentativo di ricontrollo prima di escalare (possibile errore di trascrizione) | Escalation diretta, il modello è già confermato |

Mai improvvisare o agganciare il flow più vicino ma sbagliato — coerente con la regola anti-allucinazione già in demowash ("se non è documentato, non inventare, dichiaralo"), estesa qui dalla scelta dei dati alla scelta del flow.

**Aperto**: soglia numerica di similarità per "nessun match" — si parte con un valore prudente, si valida sui casi reali dopo il primo giro di test.

### Allegati: cosa entra davvero nel prompt

Un `Asset` (es. un PDF) può essere trattato in modi molto diversi: solo linkato (nessuna elaborazione, l'LLM non vede il contenuto), riassunto breve (manuale, entra nel `compiledPrompt`), indicizzato per intero (costoso in token), recuperato via un secondo layer di RAG dedicato ai documenti, o chunked. **Per la prima versione**: solo linkato o riassunto manuale — nessuna infrastruttura nuova. Un secondo layer di RAG sui documenti è un'estensione naturale se il volume di documentazione tecnica cresce molto, non un prerequisito.

### Rinominare un `fieldKey` non rompe le sessioni in corso

Se un `FlowNode.fieldKey` cambia (es. `wifiEnabled` → `wifiStatus`) tra un edit e l'altro, le sessioni già in corso su quel flow non ne risentono: `collectedData` di una sessione attiva è già stato scritto con la chiave vecchia, e il flow che quella sessione sta eseguendo è lo **snapshot** preso all'aggancio (§10, `activeFlowPromptSnapshot`), non la versione appena editata — coerenza garantita dallo stesso meccanismo di versioning leggero già descritto, nessuna migrazione dati da gestire esplicitamente. Le nuove sessioni, agganciando il flow aggiornato, useranno naturalmente la chiave nuova.

---

## 9. Regole sempre presenti nel prompt

Blocco fisso, iniettato in ogni turno indipendentemente da quale flow sia agganciato — mai soggetto a retrieval.

**Welcome message + nota legale** (solo primo turno): saluto con brand in grassetto, poi come ultima riga un avviso privacy tradotto nativamente, con URL della privacy policy iniettata da `RUNTIME` (mai hardcoded) scritta verbatim/nuda. A differenza di demowash, **nessun video di presentazione** — solo testo. Non ripetuto dal secondo turno in poi.

**Emergenze** (robot impazzito, incendio, danni a cose/persone — set esatto da definire col cliente): priorità assoluta, scavalca qualunque flow in corso.

```
Emergency rilevata → ignora/scavalca il flow attivo → escalate_to_operator(reason: emergency) → fine turno
```

Riconoscimento semantico dell'LLM (il prompt descrive la categoria di situazioni, non un elenco esaustivo di frasi) — mai un detector deterministico su parole chiave nel codice.

**Aperto**: se il bot deve dare un'istruzione di primo soccorso prima di escalare; se `emergency` merita un canale di notifica più urgente della semplice email (es. SMS).

---

## 10. Session state e runtime

```typescript
interface SessionState {
  activeModelId?:             string   // modello risolto al passo 1
  activeFlowId?:               string   // flow agganciato, fisso finché non chiude — utile anche per analytics
  activeFlowPromptSnapshot?:  string   // copia di Flow.compiledPrompt al momento dell'aggancio
  collectedData?:             Record<string, JsonValue>   // fatti raccolti, chiave = FlowNode.fieldKey
  // + campi ereditati dal pattern demowash: language, PII lato server, ecc.
}
```

**Niente `currentNode`/`pendingQuestion`**: nessun puntatore esplicito a "dove siamo nel flow". La progressione è interamente inferita dal modello ad ogni turno, rileggendo `compiledPrompt` + `history` + `collectedData`. Un puntatore esplicito reintrodurrebbe il flow-engine deterministico scartato in §3. Costo pratico: su flow lunghi l'LLM rilegge una porzione crescente di history (mitigazione naturale: sliding window, già pratica nota per demowash oltre ~30 turni).

**`collectedData`**: valore tipizzato come `JsonValue` (string/number/boolean/array/oggetto), non ristretto a `string | boolean` — i nodi raccoglieranno anche numeri, date, enum, non solo Sì/No o testo libero. Popolato dallo stesso tool `remember` di demowash (semantica merge, non replace), esteso per accettare coppie chiave-valore libere corrispondenti ai `fieldKey` del Flow attivo.

**Versioning leggero, non uno storico completo**: se l'utente modifica un flow mentre una conversazione è a metà, la sessione in corso continua con lo snapshot preso all'aggancio (`activeFlowPromptSnapshot`), non con la versione appena pubblicata — come un lettore che finisce l'edizione del libro che ha in mano. Nessun `FlowVersion` storico per ora: se in futuro serve audit/rollback/diff tra versioni, si introduce come estensione.

**Storico della conversazione**: la `history` (passata per intero ad ogni turno dal backend host) non è mai potata né soggetta a retrieval — tutto ciò che è stato detto resta leggibile dall'LLM anche dopo che un flow si è chiuso. Il blocco markdown del flow chiuso invece esce dal prompt strutturato; per questo i fatti rilevanti vanno salvati esplicitamente in `collectedData`, non lasciati solo alla history. La cache Anthropic non è un meccanismo di memoria — copre solo il blocco fisso (§9), non aiuta a "ricordare" nulla del flow dinamico.

### Composizione del prompt per turno

```
prompt principale (FISSO)  = comportamento generale + welcome/nota legale (§9)
                              + regole emergenza (§9) + flow diagnostico generico (§6, fallback)
+ SESSION STATE             = fatti raccolti finora
+ [flow ad-hoc agganciato]  = esattamente lo snapshot compilato per QUEL modello + QUEL problema
→ UNA sola call LLM → risposta
```

**Cambio di paradigma rispetto a demowash**: demowash manda sempre lo stesso blob (`Prompt fisso → LLM`), interamente cachato al ~99%. demoRobot aggiunge un terzo ingrediente sempre variabile (`Prompt fisso + Session + Flow compilato → LLM`) — la parte dinamica **non** beneficia della stessa cache (trade-off consapevole, conseguenza diretta della scala: centinaia di flow in crescita vs ~30 casi stabili di demowash). Da quantificare in fase di piano: costo per turno atteso con retrieval + blocchi non cachati.

---

## 11. Multilingua e audio

**Lingua**: italiano, inglese, spagnolo, danese. Nessun campo "traduzione" nel data model — un solo testo per nodo/flow in lingua base (italiano), l'LLM traduce nativamente a runtime, lingua sticky via trailer `⟦LANG:xx⟧` (stesso meccanismo di demowash, `VALID_ISO` esteso con `da`). Documenti allegati non tradotti automaticamente — se serve un documento vero in più lingue, allegati multipli per nodo (uno per lingua, punto aperto).

**Audio**: solo output (TTS), stesso schema di demowash — `audioOutput`/`audioVoices` in `settings.json`. Nessuna detection/trascrizione di input audio dentro il modulo: se il cliente manda un vocale, la trascrizione (se avviene) è responsabilità del backend host, `chatbotFn` riceve sempre e solo testo.

---

## 12. Ciclo di vita del Flow

```
editing (React Flow) → compile → validate → preview → publish → embedding (se serve) → online
```

`preview`: l'utente vede una simulazione prima di renderla visibile ai clienti (es. playground ristretto a quel singolo Flow) — passo separato o effetto collaterale di `validate`, da definire.

**Aperto**: chi può pubblicare (permessi backoffice, coerente con la sicurezza a 3 livelli richiesta da CLAUDE.md); se un Flow in bozza è visibile/editabile da altri utenti dello stesso workspace (concorrenza sull'editing).

---

## 13. Cosa resta da chiudere prima del piano

**Bloccante**: il **lookup `serialNumber → RobotModel`** (§8, passo 1). Prima domanda dell'intera pipeline (serial → model → retrieval → flow) — se non è definito, tutto il resto perde affidabilità a valle. Richiede informazioni reali dal cliente demoRobot (formato dei serial number, dove vive oggi quell'anagrafica), non deducibile dall'architettura:

| Approccio | Note |
|---|---|
| Lookup DB esatto | Richiede import/censimento di ogni serial venduto |
| Pattern/wildcard | Se il serial incorpora il codice modello |
| Regex su prefisso | Variante più rigida del pattern |
| Prefisso semplice | Il più semplice, fragile se i prefissi non sono ben distinti |
| API esterna del cliente | Nessuna duplicazione dati, ma dipendenza esterna nel turn loop |

Non bloccanti, risolvibili internamente in fase di piano:

- Nome definitivo del modulo (`custom-demorobot`, da confermare — Andrea ha anche detto "demoRobots")
- Se il flow-builder diventa un componente riusabile per altri clienti o resta specifico di demoRobot
- Storage fisico degli allegati (`Asset.url`)
- Provisioning del widget per un nuovo workspace
- URL della privacy policy reale
- Quale strategia per il "cambio volontario di problema" (§8)
- Soglia di similarità per "nessun match" (§8)
- Trattamento definitivo degli allegati (§8)
- Dettagli del workflow di pubblicazione (§12)
- Modellazione di sotto-flussi condivisi (§4/§5)

---

*Documento aggiornato: 2026-07-30.*
