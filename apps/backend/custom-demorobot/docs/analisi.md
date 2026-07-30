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
- **Playground**: percorso separato dalla pipeline WhatsApp (`playground.controller.ts` chiama `chatbotFn` direttamente, bypassa il flow-engine legacy). History reale (ultimi 20 messaggi della sessione, stesso shape `HistoryEntry[]`), nessuna deduzione credito. Compatibile senza modifiche.
- **Debug — buco reale, non ereditato automaticamente**: `ChatbotOutput.meta.debug` esiste come campo TypeScript ma **nessun modulo custom lo popola oggi**, e l'host lo espone solo sul percorso WhatsApp (`debugInfo` nella response), **non** su playground/widget — e comunque nessuna UI del backoffice lo legge (dead plumbing anche dove l'host lo passa). Il debug di demowash (`LLM_DEBUG`, `[tool_call]`/`[state]`/`[usage]` via `--debug`) è puro CLI locale, sparisce completamente una volta deployato via host. **Per demoRobot questo pesa più che per demowash**: qui non basta sapere "il prompt era quello" (statico, sempre uguale) — serve sapere *quale flow è stato agganciato dal retrieval e perché* (§8), dato che cambia turno per turno. Va costruito da zero: popolare `meta.debug` con l'evento di retrieval (§8.1) e non affidarsi a nessun meccanismo esistente.

**Da individuare in fase di piano**: come si provisiona/pubblica concretamente il widget per un nuovo workspace (stesso meccanismo di demowash).

---

## 3. Editor visuale (flow-builder)

### 3.0 Dove nell'app — `apps/frontend`, non `apps/backoffice` (verificato nel codice)

Correzione importante rispetto a quanto assunto implicitamente finora: **`apps/backoffice` è la console admin interna** (multi-tenant, gestisce tutti i clienti della piattaforma — nav statica in `Layout.tsx`: Platforms, Channels, Clients, Analytics, ecc., nessun concetto di "dentro un workspace specifico"). L'editor dei flow, essendo qualcosa che **il cliente demoRobot stesso** deve poter usare per configurare il proprio chatbot, appartiene invece ad **`apps/frontend`** — l'app dove il singolo workspace gestisce le proprie impostazioni.

Pattern già esistente da riusare: `apps/frontend/src/pages/SettingsPage.tsx` con `SettingsDropdown`/`SettingsLayout` e sezioni modulari (`AIPersonalitySection.tsx`, `WhatsAppChannelSection.tsx`, `WebsiteWidgetSection.tsx`, ecc. in `apps/frontend/src/components/settings/sections/`). Il flow-builder entra come **nuova sezione settings**, visibile solo se `workspace.customChatbotId` è configurato per un modulo di questo tipo — coerente col pattern già in uso, non un'invenzione. Il canvas React Flow (troppo grande per stare dentro il dropdown) vive probabilmente dietro un bottone "Apri editor flow" che porta a una rotta dedicata a schermo intero, non dentro il pannello settings stesso.

**Nessun residuo del vecchio Visual Flow Builder da riusare**: verificato che il flow-builder deprecato (CLAUDE.md §17, F50) non ha lasciato componenti UI (`FlowBuilder`/`FlowEditor`) né pattern di collegamento alla nav — solo un tipo `FlowConfig` residuo (`apps/frontend/src/services/flowConfigApi.ts`) usato altrove per tutt'altro (lista `availableFunctions`). Si parte da zero per questa parte, nessuna scorciatoia disponibile.

### 3.1 Due livelli di navigazione: lista Flow (CRUD) → canvas

Prima di entrare nel canvas (sotto) c'è un livello di navigazione non ancora descritto: come si arriva a "dentro un flow".

```
Sezione settings del workspace (apps/frontend)
  → Lista RobotModel ("RoboCut X200", "RoboCut X400", ...)
      ↓ click su un modello
  → Lista dei suoi Flow (tabella/griglia): "Rumore strano", "Wifi non si connette", ...
      azioni Crea / Modifica / Elimina — nessuna colonna status: ogni Flow salvato è già online (§12)
      ↓ click su "Crea nuovo" → Flow vuoto creato → apre il canvas
      ↓ click su un Flow esistente → apre il canvas su quel Flow
  → Canvas (React Flow, sotto): dentro si costruisce l'albero nodi/risposte
```

### 3.2 Isolamento multi-cliente — se due clienti usano questo paradigma

Se in futuro un secondo cliente (non solo demoRobot) usa lo stesso meccanismo a grafo, l'isolamento è **già garantito dal design esistente**, senza nulla da aggiungere: ogni `RobotModel`/`Flow` è `workspaceId`-scoped (§5, ownership — stessa regola CLAUDE.md §2 valida per tutta la piattaforma). Un utente che fa login vede solo il proprio workspace, quindi solo i propri `RobotModel`/`Flow` — mai quelli di un altro cliente. La sezione settings/editor in `apps/frontend` non è cablata su demoRobot specificamente: si attiva per qualunque workspace con `customChatbotId` puntato a un modulo di questo tipo.

Lato backend, ogni cliente mantiene comunque il proprio modulo `custom-<nome>` (§2) — ma **compilatore, retrieval e runtime generico dovrebbero essere componenti condivisi**, parametrizzati per `workspaceId`/`RobotModel`, non riscritti per ogni nuovo cliente che adotta questo paradigma. Coerente con il punto già aperto in §13 ("se il flow-builder diventa un componente riusabile") — qui la risposta pratica è sì, va progettato per esserlo fin da subito, anche se demoRobot resta l'unico cliente reale per ora.

**Navigazione a due livelli, non una lista piatta di tutti i Flow di tutti i modelli**: coerente con la gerarchia già decisa in §5 (`RobotModel → Flow`) e necessaria alla scala attesa (centinaia di Flow totali, §8) — una tabella unica con tutti i Flow di tutti i modelli sarebbe ingestibile da scorrere.

**Duplicazione di un Flow esistente**: non nella prima versione — si crea sempre da zero. Punto segnalato come possibile miglioramento futuro se emerge davvero il bisogno (es. Flow simili ripetuti su più modelli), coerente con "non costruire in anticipo su un problema non ancora osservato".

Pannello backoffice dove un utente non tecnico può: creare un nodo (domanda), definire risposte possibili, collegare ogni risposta a un nodo figlio diverso, spostare i nodi sul canvas, allegare documenti/immagini/video/link a qualunque nodo.

**Libreria**: [React Flow](https://reactflow.dev/) (`@xyflow/react`) — MIT license, gratuita in produzione, nessuna feature core dietro paywall. Standard de facto per editor a nodi in React (Typebot, n8n). Nessun conflitto con lo stack del backoffice (React 19 + Vite + TypeScript + Tailwind + Radix UI).

Il grafo è **UX di authoring, non un motore di esecuzione**: non esiste un flow-engine deterministico che esegue nodo-per-nodo (sarebbe reintrodurre XState/guard-layer, il paradigma legacy già abbandonato). Il grafo viene compilato in prosa markdown; l'esecuzione del flow durante la chat resta 100% in capo all'LLM, che può saltare domande già coperte dal contesto e non è vincolato da una state machine.

### UX dell'editor — il punto critico per l'usabilità reale

Verificato: React Flow **non è un editor pronto all'uso**, è un motore di canvas (drag, zoom, pan, connessioni tra nodi con handle) dentro cui il contenuto dei nodi si costruisce con componenti React normali — la feature che serve è **"Custom Nodes"** ("Display any content inside of a node"), inclusa gratis nella libreria core. Esiste un template Pro a pagamento ("Workflow Editor", con drag-and-drop sidebar e componenti shadcn/ui pronti) che replica esattamente il pattern descritto sotto — non necessario: lo stack del backoffice ha già Radix UI + Tailwind, la stessa base di shadcn, quindi lo stesso pattern si costruisce gratis con i componenti già in uso.

**Pattern scelto — nodo compatto sul canvas + pannello laterale per l'editing**:

```
[Canvas React Flow]
  Nodo sul canvas: rappresentazione COMPATTA — titolo della domanda + conteggio risposte
                    + icona se ha allegati. Niente form dentro il nodo stesso.
      ↓ click
[Sidebar destra, componente custom con Radix Sheet]
  - Campo testo: la domanda (question)
  - fieldKey / fieldType (§5) — se il nodo raccoglie un dato
  - Lista risposte: ognuna con label — vedi "Aggiungere una risposta" sotto per cosa succede
  - Drop zone allegati: upload immagine/PDF/video, con anteprima — Asset condiviso
    per modello (§5), quindi se il file esiste già nel RobotModel il pannello lo
    propone da una libreria invece di ricaricarlo
  - Selettore terminalType se il nodo è un terminale (§5)
```

### Aggiungere una risposta — nasce subito un nodo figlio collegato

Meccanismo esatto, non solo "collega via drag": quando l'utente clicca "aggiungi risposta" nel pannello e scrive il testo (es. "Sì"), il sistema in un solo passo:

1. Crea il `FlowEdge` (`sourceNodeId` = nodo corrente, `label` = testo scritto)
2. Crea **automaticamente** un nuovo `FlowNode` vuoto sul canvas, posizionato accanto al nodo genitore
3. Collega subito `FlowEdge.targetNodeId` al nuovo nodo — l'edge non nasce mai "orfano"

L'utente poi clicca sul nodo appena creato per compilarlo (scriverci la domanda successiva). Nessun drag manuale richiesto per il caso comune (ogni risposta apre una domanda nuova, il caso più frequente in un flow diagnostico).

**Collegare invece a un nodo GIÀ esistente** (es. due risposte diverse convergono sullo stesso nodo, o un ramo torna a un punto già presente nel flow): resta possibile via drag manuale sul canvas — l'utente trascina l'handle dell'edge dal nodo auto-creato (ora orfano/da eliminare) fino al nodo esistente, oppure elimina il nodo auto-creato e ricollega. Ogni risposta genera comunque un **handle** dedicato sul bordo destro del nodo sul canvas (uno per risposta, non uno per nodo) — comportamento nativo di React Flow.

### Implementazione tecnica — verificata sulla documentazione ufficiale React Flow

Punti API concreti, non solo il comportamento atteso, per evitare sorprese in fase di piano:

**Handle multipli sullo stesso nodo — nessun auto-layout**: React Flow **non** posiziona automaticamente più handle sullo stesso lato di un nodo — di default li centra tutti nello stesso punto, sovrapposti. Il componente custom del nodo deve calcolare esplicitamente lo spacing verticale (CSS/inline style, es. `top: ${index * 28 + 16}px`) mappando `node.data.responses` in una lista di `<Handle type="source" position={Position.Right} id={edge.id} style={{ top: ... }} />` — un handle per risposta, ognuno con `id` univoco (l'id del `FlowEdge` stesso, coerente col data model già in §5).

**Come l'edge sa da quale risposta parte**: il campo `sourceHandle` sull'edge di React Flow (distinto da `source`, che identifica solo il nodo) referenzia l'`id` dell'handle specifico — è quello che, salvato lato backend, corrisponde a `FlowEdge.id` stesso. Non serve un campo aggiuntivo nel data model: l'edge React Flow *è* il `FlowEdge`, il suo `sourceHandle` è banalmente il suo stesso `id`.

**Creazione automatica nodo+edge dal pannello (non dal canvas)**: si usa l'hook `useReactFlow()`, che espone `addNodes(node)` e `addEdges(edge)` con firma diretta (non serve gestire lo stato manualmente). La posizione del nuovo nodo figlio si calcola con un offset fisso dal genitore (es. `{x: parent.position.x + 280, y: parent.position.y + responseIndex * 120}`) — non serve `screenToFlowPosition` in questo caso (quello serve solo per drop da coordinate schermo reali, es. drag da una sidebar esterna, non per posizionamento programmatico relativo a un nodo esistente).

**Editing del contenuto del nodo dal pannello laterale**: `updateNodeData(nodeId, dataUpdate)` — non un drag, non un evento canvas. Il pannello (Sheet) scrive direttamente nello stato del nodo tramite questo metodo ad ogni modifica di campo (domanda, `fieldKey`, `terminalType`), con debounce per non generare uno store-write per ogni keystroke.

**Perché questo pattern e non le alternative**: un modale a schermo intero nasconderebbe il resto del flow mentre si edita un nodo — proprio quello che serve vedere per capire dove collegarlo. Editing inline dentro il nodo sul canvas farebbe crescere i nodi e affollerebbe canvas con decine di nodi (il caso reale di demoRobot, centinaia di flow — §8). Il pannello laterale mantiene il canvas sempre visibile per il contesto; l'auto-creazione del nodo figlio riduce l'attrito per il caso comune, il drag nativo di React Flow resta disponibile per i casi di riuso/convergenza — nessuna reinvenzione, solo un pannello di proprietà attorno a una feature già pronta, usando esclusivamente API pubbliche documentate (`useReactFlow`, `Handle`, `sourceHandle`), nessun workaround.

**Aperto in fase di piano**: comportamento della libreria allegati condivisa quando si trascina un file nuovo vs si riusa uno esistente nel `RobotModel`; larghezza/comportamento responsive del pannello laterale su canvas grandi; se serve `isValidConnection` per impedire collegamenti non ammessi (es. un nodo che punta a se stesso, o cicli non consentiti — già validati comunque dal compilatore in §4, quindi qui sarebbe solo un blocco preventivo in UI, non l'unica difesa).

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

**Determinismo obbligatorio**: stesso grafo → `compiledPrompt` identico byte-per-byte → stesso hash. Nessun elemento non deterministico (timestamp, ordinamento instabile, ID casuali nel testo). Rende triviali cache, diff, versioning e test.

**Precisazione**: l'embedding non dipende dal grafo in sé, dipende dal `retrievalDocument` — la regola corretta è *stesso `retrievalDocument` byte-per-byte → stesso embedding*, non "stesso grafo". Due grafi diversi (es. posizione dei nodi sul canvas cambiata, o un ID edge rigenerato) possono produrre lo stesso `retrievalDocument` se non toccano titolo/testo del nodo radice/keywords — in quel caso l'embedding non va ricalcolato, coerente con "non ricalcolare ad ogni edit se il titolo/sintomi non sono cambiati" già detto sopra.

**Due documenti separati, non uno**: `compiledPrompt` (verboso, per l'esecuzione) e `retrievalDocument` (denso, solo per l'embedding — titolo, sintomi, sinonimi, mai le istruzioni operative tipo "Se NO → rispondi così", che diluirebbero l'embedding). Entrambi generati dallo stesso `compileFlow()`, mai scritti a mano dall'utente.

**Collegamenti tra domande nel testo compilato**: prosa lineare (sequenza numerata, rami "Se NO/Se SÌ" scritti inline) per flow semplici come quello di §6. Riferimenti nominati con ancore (`[nodo:wifi]`) solo se emerge un caso reale di sotto-flusso condiviso da più nodi genitori — non costruito preventivamente. In nessun caso i "link" sono navigabili a runtime: restano testo che l'LLM legge e interpreta, mai un meccanismo di jump nel codice.

**Fallimento della validazione**: un `Flow` con validazione fallita non diventa mai raggiungibile dal retrieval. Il salvataggio viene **respinto** (§12 — niente più salvataggio "in bozza" con errori: o il grafo è valido e va online, o il salvataggio non avviene e il `Flow` resta con l'ultimo contenuto valido già salvato). Aperto in fase di piano: dove nel canvas vengono mostrati gli errori (probabile: sul `FlowNode.id` incriminato).

**Testabilità — snapshot testing**, conseguenza diretta del determinismo richiesto sopra: dato un `flow.json` fisso in input, `compile()` deve produrre sempre lo stesso `compiledPrompt`, verificabile con un normale test a snapshot (`expect(compileFlow(fixture)).toMatchSnapshot()`). Cattura regressioni nel compilatore stesso (es. un refactor che cambia l'ordine di attraversamento) senza dover verificare a mano l'intero testo generato.

---

## 5. Data model

```
Workspace   1 ─── N  RobotModel
RobotModel  1 ─── N  Flow
RobotModel  1 ─── N  Asset
Flow        1 ─── N  FlowNode
FlowNode    1 ─── N  FlowEdge
FlowNode    N ─── N  Asset   (tramite FlowNodeAttachment)
```

### Ownership: workspace-scoped, niente condivisione cross-tenant

Coerente con l'isolamento multi-tenant già obbligatorio in tutta la piattaforma (CLAUDE.md §2 — ogni query filtrata per `workspaceId`):

- **`RobotModel` appartiene a un solo workspace** (`RobotModel.workspaceId`, sempre presente). Nessun `RobotModel` condiviso tra clienti diversi.
- **`Asset` eredita l'ownership dal `RobotModel`** (già `robotModelId` in §5) — nessuna condivisione tra workspace, coerente.
- **Il flow generico (§6) è per-workspace, non globale**: modellato come `Flow` con `robotModelId: null` invece di una tabella `GlobalFlow` separata — più semplice, e il retrieval fa naturalmente "prima i flow del modello, poi i flow globali dello stesso workspace" con la stessa tabella e la stessa query, solo `WHERE robotModelId = X OR robotModelId IS NULL`.
- **Nessun template cross-workspace referenziato direttamente** in questa versione — se in futuro serve un catalogo di flow di partenza riusabili tra clienti (es. "flow tipici per robot da giardinaggio"), va clonato in un `RobotModel` del workspace di destinazione al momento dell'uso, non referenziato live da un'origine condivisa (eviterebbe che un edit del template originale si propaghi in modo imprevedibile a clienti diversi).

**RobotModel**: `id`, `workspaceId`, `name` (es. "RoboCut X200"), `slug`, `manufacturer?`, `description?`, `lookupRules` (come si risolve `serialNumber → questo modello`, §10), `createdAt`/`updatedAt`.

**Flow**: `id`, `workspaceId`, `robotModelId?` (**nullable** — `null` = flow generico del workspace, §6), `title` (es. "Rumore strano"), `description`, `keywords?` (sinonimi/varianti che il grafo potrebbe non contenere — es. "vibra", "cigola", "ronzio" per un flow chiamato "Rumore strano" — compilati a mano dall'utente, opzionali), `retrievalDocument`, `embedding`, `compiledPrompt`, `hash`, `createdAt`/`updatedAt`. **Niente `status`/`version`**: un salvataggio riuscito è sempre online (§12) — non esiste più uno stato bozza da distinguere né uno storico di versioni pubblicate da tracciare con un contatore.

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

**FlowEdge**: `id`, `sourceNodeId`, `label` (es. "Sì"/"No", o testo libero), `targetNodeId` (nullable = fine flusso), `triggersEscalation?` (bool — vedi correzione sotto).

**Escalation su singola risposta, non solo sul nodo terminale**: `terminalType: 'ESCALATE'` (sopra) copre solo il caso in cui l'escalation è la **chiusura naturale** del flow (es. dopo tutti i check falliti, §6). Serve anche il caso in cui **una specifica risposta di un nodo intermedio** deve deviare subito all'operatore, mentre le altre risposte dello stesso nodo proseguono il flow normale — es. nodo "Il robot fa fumo?" con risposta "Sì" → escalation immediata, risposta "No" → continua la diagnostica. Il flag vive su `FlowEdge.triggersEscalation`, non su `FlowNode`: è la risposta scelta a determinare l'escalation, non il nodo in sé. Il compilatore (§4) tratta un edge con questo flag come un punto di uscita immediato dal flow verso `escalate_to_operator`, indipendentemente da dove si trova nell'albero — stessa istruzione emessa oggi solo per `terminalType: 'ESCALATE'`, ora disponibile anche a metà percorso.

**Asset**: `id`, `robotModelId` (vive a livello di modello, non di nodo — deduplicato), `type` (`document`|`image`|`video`|`link`), `url`, `title`, `summary?` (riassunto breve, scritto a mano dall'utente — metadato di instradamento per l'LLM, MAI contenuto indicizzato/embeddato, §8), `language?` (per documenti tradotti).

**FlowNodeAttachment**: `nodeId`, `assetId` — relazione molti-a-molti, così lo stesso `Asset` (es. `manuale-x200.pdf`) è caricato una sola volta e referenziato da più nodi senza duplicazione.

**Punti aperti**: modellazione di sotto-flussi condivisi da più genitori (riuso vs duplicazione — deciso di partire senza, §4); distinzione nodi "raccolta libera" vs "scelta chiusa" nell'editor (probabilmente coperta da `fieldType`).

### Tool disponibili per nodo terminale — capabilities, non lista chiusa

Oggi `terminalType: 'ESCALATE'` implica sempre `escalate_to_operator`, `SELF_SERVICE`/`END` nessun tool con side-effect. Per non dover cambiare il paradigma quando in futuro servirà un tool diverso (es. `request_photo`, `schedule_visit`, `send_manual`, `create_ticket`), il compilatore espone il concetto come `allowedTools: string[]` derivato da `terminalType` invece che come mapping cablato nel codice — oggi `ESCALATE → ['remember', 'escalate_to_operator']`, `SELF_SERVICE/END → ['remember']`. Aggiungere un nuovo tool in futuro significa aggiungere un valore a `TerminalType` (o un campo esplicito sul nodo) e la relativa entry nel mapping, non riscrivere la logica del compilatore.

### Limiti dimensionali — da dichiarare, non necessariamente valori finali

Nessun limite oggi definito: un utente potrebbe costruire un flow da 500 nodi pensando sia supportato. Vanno dichiarati dei guardrail (valori indicativi, da tarare in fase di piano): **nodi per flow**, **allegati per nodo**, **riferimenti totali ad allegati per flow**, **caratteri massimi di `compiledPrompt`**. Il compilatore può emettere un `warning` (non bloccante, §4) quando un flow si avvicina al limite, e un errore bloccante solo oltre una soglia dura — coerente con `validationReport`/`warnings` già presenti nel contratto del compilatore.

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

**Passo 0 — validazione formato, prima ancora del lookup**: un `serialNumber` deve avere **almeno 12 caratteri** per essere considerato plausibile — sotto quella soglia, non si tenta nemmeno il lookup (evita query inutili su input palesemente sbagliati, es. il cliente scrive "123" pensando sia il serial). Solo un vincolo di **lunghezza minima** per ora, non un pattern preciso — il formato esatto (charset, eventuale prefisso) resta parte del punto bloccante in §13, da chiudere col cliente. Un serial sotto i 12 caratteri viene trattato come non fornito, non come `unknown_model` (§7) — non è "cercato e non trovato", è "input non nella forma attesa", distinzione utile per l'eventuale messaggio al cliente ("il numero di serie sembra incompleto, puoi ricontrollarlo?").

**Passo 1 — deterministico**: `serialNumber → RobotModel` (lookup, non intent detection — matching su un fatto fisso, stesso principio di `detectVenue` in demowash). Ristringe drasticamente lo spazio prima del passo semantico.

**Passo 2 — semantico**: dentro il sottoinsieme già ristretto al modello, embedding del problema descritto → top-K flow più simili.

```typescript
findRelevantFlows({
  robotModelId: string,
  query: string,
  k: number,        // topK — quanti candidati considerare (es. 3)
}) → Array<{ flow: Flow, similarity: number }>
```

Layer separato dal compilatore per contratto — permette di cambiare provider/strategia di embedding senza toccare la compilazione, e viceversa.

### Contratto esplicito: cosa succede quando arrivano più risultati

`findRelevantFlows` può tornare più di un candidato (es. `Flow A: 0.84`, `Flow B: 0.81`, `Flow C: 0.78`) — va deciso esplicitamente cosa il runtime ne fa, perché il paradigma di questo sistema è "**un** flow agganciato per volta" (§10), non "l'LLM sceglie tra più manuali contemporaneamente nello stesso prompt":

```
topK = 3   (recupera i 3 candidati più vicini, per poter loggare/debuggare il secondo/terzo posto — §8.1)

se bestScore < threshold:
    nessun match → escalation (reason: no_matching_flow)
altrimenti:
    aggancia SOLO il candidato migliore (bestScore) → SessionState.activeFlowId
    (B e C restano solo nel log diagnostico, non entrano nel prompt)
```

Questo evita che il prompt del turno contenga più flow contemporaneamente — coerente con "un flow ad-hoc alla volta" già descritto in §10, e mantiene l'LLM concentrato su una sola procedura invece di doverne confrontare più d'una.

### Dove vive l'embedding e quale provider

```
Flow.retrievalDocument → EmbeddingProvider (via OpenRouter) → vettore salvato in Flow.embedding
```

**Provider già disponibile, verificato**: OpenRouter espone un endpoint `POST /api/v1/embeddings` (OpenAI-compatible in request/response), che fa da proxy a più modelli di embedding (OpenAI `text-embedding-3-*`, Cohere, Google, Mistral, ecc.) selezionabili via `model` — stessa API key/base URL già usati per le chat completion di demowash/demoRobot. **Nessun secondo provider da integrare**, coerente con la regola CLAUDE.md "usa OpenRouter, mai OpenAI direttamente" — il retrieval gira sullo stesso account.

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
}
```

Interfaccia astratta anche se il provider concreto è già noto (OpenRouter): disaccoppia il resto del sistema dal dettaglio di quale modello di embedding è configurato, permettendo di cambiarlo in `settings.json` senza toccare il chiamante.

Il vettore vive come colonna sul `Flow` stesso (es. `pgvector` su Postgres, coerente con lo stack esistente — non un vector store esterno separato, a meno che il volume lo giustifichi in futuro). Il retrieval (`findRelevantFlows`) fa una query di similarità su questa colonna, ristretta a `robotModelId` (passo 1).

**Non un router-LLM classico**: niente call LLM dedicata a "che problema è questo?" prima della call che risponde (pattern esplicitamente scartato da demowash, raddoppia costo/latenza senza guadagno alla scala buona). Il retrieval è un pre-filtro deterministico: seleziona quali flow entrano nel prompt, non decide cosa rispondere — la decisione resta sempre in capo all'unica call LLM del turno.

### Il retrieval gira solo per agganciare, non ad ogni turno

Un messaggio breve/ambiguo ("sì", "no", un numero) non porta segnale semantico sufficiente per un retrieval affidabile. Se rigirasse ad ogni turno, rischierebbe di perdere l'aggancio proprio mentre il cliente sta rispondendo a una domanda del flow in corso.

**Regola**: il retrieval gira solo se `SessionState.activeFlowId` è vuoto, oppure se il messaggio è abbastanza sostanzioso da rappresentare un cambio volontario di problema (soglia da definire — punto aperto, §10). Una volta agganciato, il flow resta fisso finché non si chiude per una di tre condizioni: nodo terminale raggiunto, escalation, o cambio volontario di problema.

**"Cambio volontario di problema"**: tre strade valutate, nessuna ancora scelta — soglia euristica su lunghezza/parole (economica, un po' euristica), l'LLM stesso segnala il cambio (tool o marker dedicato, più affidabile ma nuovo meccanismo da progettare), tool dedicato esplicito. Partire dalla soglia euristica per il primo giro, passare alle altre se produce troppi falsi positivi/negativi.

### Il flow agganciato può essere sbagliato — serve una via d'uscita

Caso concreto: cliente scrive *"il robot non taglia bene"*, il retrieval aggancia il flow "lama rumorosa" (il candidato più vicino, ma non quello giusto). L'LLM segue quel flow. Il meccanismo di "cambio volontario di problema" sopra copre questo caso solo se il cliente scrive esplicitamente una frase nuova e sostanziosa — ma se durante l'esecuzione del flow emerge (dalle risposte del cliente ai nodi) che il problema non corrisponde a quello agganciato, serve la stessa via d'uscita anche senza un input "voluto" del cliente:

```
Se durante il flow agganciato emerge che il problema non corrisponde
(l'LLM lo riconosce semanticamente dalle risposte, non da un trigger nel codice):
    chiudi activeFlowId
    esegui un nuovo retrieval sul problema effettivo
```

Senza questo, il primo aggancio diventerebbe troppo vincolante — un errore di retrieval al primo turno bloccherebbe l'intera conversazione su una procedura sbagliata fino all'escalation finale. Il meccanismo di chiusura è lo stesso già descritto (una delle tre condizioni di chiusura del flow, §10), solo innescato dal contenuto della conversazione stessa e non da un nuovo messaggio esplicito del cliente — coerente con "l'LLM interpreta liberamente", nessuna logica di trigger deterministica nel codice.

### Nessun serial number — non blocca il flow

Caso frequente: la prima domanda del flow generico (§6) chiede il serial number, ma il cliente non ce l'ha a portata di mano ("il robot non funziona", senza numero). Bloccare la conversazione finché non lo fornisce è un attrito inutile quando il problema potrebbe comunque risolversi con un flow generico.

**Regola**: il serial number resta il modo preferito per risolvere il modello (passo 1), ma non è un prerequisito rigido:
```
se serial number assente:
    prova comunque il retrieval sul flow generico del workspace (robotModelId: null, §5)
    se insufficiente a risolvere:
        richiedi il serial number (es. "puoi leggerlo dall'etichetta sul retro?")
```
Coerente con "l'LLM salta step già coperti dal contesto" (§6) applicato al contrario: non forza un dato che potrebbe non servire subito.

### Log diagnostici del retrieval — indispensabili per il debug (§2)

Dato il buco di osservabilità già identificato in §2 (nessun meccanismo esistente mostra quale flow è stato scelto e perché), ogni esecuzione del retrieval deve produrre un evento strutturato:

```typescript
interface RetrievalEvent {
  conversationId:   string
  serialNumber?:    string
  robotModelId?:    string
  query:            string
  candidates:       Array<{ flowId: string, similarity: number }>   // topK, non solo il vincitore
  selectedFlowId?:  string   // assente se nessun match
}
```

Non necessariamente una tabella dedicata fin da subito — anche solo logging strutturato (es. verso lo stesso sistema di log applicativo già in uso) è sufficiente per il primo giro, e alimenta sia il debug per-conversazione (`meta.debug`, §2) sia le analytics (§8.2).

### Nessun match → operatore, con due fallback distinti

| | Fallisce il passo 1 | Fallisce il passo 2 |
|---|---|---|
| Situazione | Serial number non riconosciuto | Modello confermato, nessun Flow abbastanza simile |
| `reason` | `unknown_model` | `no_matching_flow` |
| Comportamento | Probabilmente un tentativo di ricontrollo prima di escalare (possibile errore di trascrizione) | Escalation diretta, il modello è già confermato |

Mai improvvisare o agganciare il flow più vicino ma sbagliato — coerente con la regola anti-allucinazione già in demowash ("se non è documentato, non inventare, dichiaralo"), estesa qui dalla scelta dei dati alla scelta del flow.

**Aperto**: soglia numerica di similarità per "nessun match" — si parte con un valore prudente, si valida sui casi reali dopo il primo giro di test.

### Allegati: consegna al cliente, MAI knowledge base per l'LLM

**Decisione**: un `Asset` (PDF, immagine, video, link) non è mai contenuto che l'LLM legge per rispondere — è sempre e solo materiale da **consegnare al cliente**. L'unica conoscenza che il sistema usa per generare risposte è il `compiledPrompt` del `Flow` (scritto/disegnato dall'utente), mai il contenuto di un documento allegato. Questo esclude dal design, non solo le rimanda, le opzioni "indicizzato per intero" e "RAG/chunking sui documenti" già scartate in bozze precedenti di questa sezione — non sono un'estensione futura, sono fuori scope per principio.

Cosa entra nel `compiledPrompt` per ogni `Asset` referenziato: **titolo/filename** (per il link/bottone offerto al cliente) + un **riassunto breve** (`Asset.summary?`, campo nuovo in §5) — ma il riassunto non serve a dare "sapere" all'LLM, serve solo come **metadato di instradamento**: gli dice *quando* offrire quel file (es. "questo PDF spiega il reset wifi" → propostolo nel nodo giusto), non è materiale su cui basa la risposta. Il nodo stesso, nel grafo, resta la fonte primaria di "quando" (l'utente attacca l'allegato al nodo giusto); il riassunto aiuta l'LLM a descrivere il file al cliente in una frase invece di limitarsi al nome del file.

### Rinominare un `fieldKey` non rompe le sessioni in corso

Se un `FlowNode.fieldKey` cambia (es. `wifiEnabled` → `wifiStatus`) tra un edit e l'altro, le sessioni già in corso su quel flow non ne risentono: `collectedData` di una sessione attiva è già stato scritto con la chiave vecchia, e il flow che quella sessione sta eseguendo è lo **snapshot** preso all'aggancio (§10, `activeFlowPromptSnapshot`), non la versione appena editata — coerenza garantita dallo stesso meccanismo di versioning leggero già descritto, nessuna migrazione dati da gestire esplicitamente. Le nuove sessioni, agganciando il flow aggiornato, useranno naturalmente la chiave nuova.

### 8.1 Analytics — cosa misurare, minimo indispensabile

Con un sistema basato su retrieval e prompt compilati, capire *perché* un flow è stato scelto (o non trovato) è tanto importante quanto il flow stesso — senza questi dati, migliorare la knowledge base nel tempo è alla cieca. Costruito sopra i `RetrievalEvent` già loggati (sopra):

- flow più agganciati / mai trovati
- % conversazioni finite in escalation, per `reason` (§7)
- similarity media dei match riusciti vs dei "nessun match"
- serial number non riconosciuti (§10, `unknown_model`) — segnale diretto su dove il lookup fallisce
- tempo/turni medi dall'aggancio del flow alla risoluzione

Non richiede infrastruttura dedicata al lancio — query sui `RetrievalEvent` loggati bastano per una prima dashboard, coerente con "non costruire in anticipo su un problema non ancora osservato".

### 8.2 Errori a runtime — percorso degradato, non solo quello ideale

La specifica finora descrive il percorso quando tutto funziona. Serve anche il comportamento quando un componente esterno non risponde:

| Guasto | Comportamento |
|---|---|
| Embedding provider offline/timeout | Retry breve, poi fallback al flow generico (§6) invece di bloccare il turno — coerente con "nessun match → operatore" già previsto, stesso esito pratico |
| Retrieval timeout (query DB lenta) | Stesso fallback: flow generico invece di far attendere il cliente |
| SMTP non disponibile (escalation) | L'escalation non deve fallire silenziosamente — comportamento già presente in demowash (log su console se SMTP non configurato in dev); in produzione va garantita almeno una notifica alternativa o un retry, punto da definire in fase di piano |
| LLM (OpenRouter) timeout/down | Stesso comportamento già esistente in demowash: `error: 'llm_unavailable'` nell'output, nessun crash — ereditato automaticamente |
| Lookup serial number fallisce (errore tecnico, non "non trovato") | Va distinto da `unknown_model` (§7, quello è "non trovato", non "errore") — un errore tecnico nel lookup non deve essere confuso con un serial number davvero sconosciuto; probabile fallback anch'esso al flow generico piuttosto che un errore esposto al cliente |

Non serve definire ora l'implementazione esatta di ogni retry, ma il principio guida è coerente in tutti i casi: **nessun guasto tecnico deve mai risultare in un messaggio di errore grezzo al cliente** — degrada sempre verso il flow generico o l'escalation, mai verso un crash visibile.

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
  activeFlowHash?:             string   // hash (§4) del Flow.compiledPrompt agganciato — per log/debug,
                                         // distinto dallo snapshot: lo snapshot serve al modello,
                                         // l'hash serve al sistema (confronto con la versione pubblicata
                                         // corrente, correlazione nei log/analytics senza portarsi dietro
                                         // l'intero testo)
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

Componente esplicito, non concatenazione di stringhe sparse nel turn loop:

```typescript
PromptBuilder.build({
  commonPrompt:        string,          // blocco fisso, §9
  sessionState:        SessionState,
  activeFlowSnapshot?: string,          // Flow.compiledPrompt agganciato, se presente
  history:             HistoryEntry[],
}) → string   // prompt finale mandato all'LLM
```

Non cambia nulla architetturalmente rispetto a quanto già descritto — rende solo esplicito che l'assemblaggio è responsabilità di un componente dedicato e testabile, non logica sparsa nel turn loop.

**Cambio di paradigma rispetto a demowash**: demowash manda sempre lo stesso blob (`Prompt fisso → LLM`), interamente cachato al ~99%. demoRobot aggiunge un terzo ingrediente sempre variabile (`Prompt fisso + Session + Flow compilato → LLM`) — la parte dinamica **non** beneficia della stessa cache (trade-off consapevole, conseguenza diretta della scala: centinaia di flow in crescita vs ~30 casi stabili di demowash). Da quantificare in fase di piano: costo per turno atteso con retrieval + blocchi non cachati.

---

## 11. Multilingua e audio

**Lingua**: italiano, inglese, spagnolo, danese. Nessun campo "traduzione" nel data model — un solo testo per nodo/flow in lingua base (italiano), l'LLM traduce nativamente a runtime, lingua sticky via trailer `⟦LANG:xx⟧` (stesso meccanismo di demowash, `VALID_ISO` esteso con `da`). Documenti allegati non tradotti automaticamente — se serve un documento vero in più lingue, allegati multipli per nodo (uno per lingua, punto aperto).

**Audio**: solo output (TTS), stesso schema di demowash — `audioOutput`/`audioVoices` in `settings.json`. Nessuna detection/trascrizione di input audio dentro il modulo: se il cliente manda un vocale, la trascrizione (se avviene) è responsabilità del backend host, `chatbotFn` riceve sempre e solo testo.

---

## 12. Ciclo di vita del Flow — un solo "Salva", niente preview né draft/publish separati

**Decisione (semplificazione rispetto a versioni precedenti di questa specifica)**: **nessuno stadio di preview**, e **nessuna distinzione bozza/pubblicato**. Un solo pulsante "Salva" nell'editor esegue tutta la catena in un'unica azione:

```
click "Salva" → compile → validate
                              ├─ valido   → salva + subito raggiungibile dal retrieval (online)
                              └─ non valido → salvataggio rifiutato, errori mostrati in UI (§4, validationReport)
```

Non esiste un `status: draft | published` sul `Flow` (correzione rispetto a §5/§7/§8/§10/§13, che finora lo citavano — il campo `status` va rimosso dal data model): un `Flow` esiste solo in due stati impliciti — **non ancora salvato con successo** (non esiste nel DB, o esiste con l'ultima versione valida precedente se si tratta di un edit fallito) oppure **salvato e valido** (quindi sempre online, sempre raggiungibile dal retrieval). Non c'è un salvataggio "a metà" persistito col grafo invalido — se la validazione fallisce, il salvataggio è respinto e il `Flow` resta con l'ultimo contenuto valido già presente (comportamento identico a quanto già descritto in §4 per il fallimento della validazione, qui generalizzato: non serve più distinguerlo da un "publish" separato perché non esiste più un publish separato).

**Conseguenza pratica**: **niente workflow di pubblicazione a più stadi** da progettare — elimina anche la domanda "granularità per-Flow vs per-RobotModel" che una versione precedente di questa sezione poneva: non si "pubblica" mai esplicitamente, quindi la domanda non si pone. Resta comunque vero che ogni `Flow` vive/fallisce la validazione **indipendentemente dagli altri Flow dello stesso RobotModel** (salvare un Flow non tocca gli altri) — la stessa proprietà utile che il vecchio ragionamento sulla granularità cercava di garantire, ottenuta qui semplicemente perché ogni `Flow` è un'unità di salvataggio a sé.

**Permessi**: non serve un modello RBAC completo, ma va chiarita almeno la distinzione tra chi modifica i flow, chi gestisce gli asset condivisi del `RobotModel`, chi consulta le analytics (§8.1) — coerente con la sicurezza a 3 livelli già richiesta da CLAUDE.md per ogni endpoint protetto della piattaforma. Nessun ruolo "chi pubblica" separato da "chi modifica", dato che salvare = mettere online. Dettaglio dei ruoli da definire in fase di piano.

**Concorrenza sull'editing**: va scelto almeno un modello esplicito — lock pessimistico (un utente blocca il flow mentre lo edita), lock ottimistico (conflitto rilevato al salvataggio, tramite `Flow.hash` già presente nel data model), o last-write-wins. Qui il rischio è più concreto che nel modello draft/publish: un salvataggio concorrente va **subito** online, quindi un conflitto non gestito potrebbe rendere raggiungibile una versione scritta sopra quella di un collega senza preavviso. Anche se la scelta finale è last-write-wins (la più semplice), va **dichiarata esplicitamente** in fase di piano — qui ancora di più che prima, proprio perché non c'è più uno stadio bozza che assorbe il conflitto prima che diventi visibile ai clienti.

---

## 12.1 Seed di sviluppo — dati finti per testare, non import dati reali

**Decisione**: serve un seed, ma con scopo di **sviluppo/test**, non di caricamento dei dati veri del cliente demoRobot — sono due bisogni distinti, e questo copre solo il primo. Analogo a come demowash ha dati di esempio (le 6 sedi, i codici display) per poter provare i casi senza doverli ricreare a mano ogni volta.

**Contenuto minimo**, coerente con gli esempi già usati in tutta questa specifica:

```
RobotModel "RoboCut X200" (workspace di test/demo)
  Flow "Rumore strano"           (§6-stile: robot acceso? → wifi on? → cut scheduling attivo? → escalate)
  Flow "Wifi non si connette"    (self-service, terminalType: SELF_SERVICE)
  Flow "Il robot fa fumo"        (nodo con FlowEdge.triggersEscalation, §5 — copre il caso escalation
                                   su singola risposta, non solo terminale)

Flow generico del workspace (robotModelId: null, §6) — il fallback

Asset di esempio: 1 PDF finto + 1 immagine, per verificare §8 (consegna al cliente, mai knowledge base)
```

**Perché questi tre Flow specifici**: coprono i tre pattern strutturali distinti già descritti nella specifica — flow con più check sequenziali fino a escalation finale (§6), flow puramente self-service senza mai coinvolgere l'operatore, e flow con escalation immediata su una risposta specifica a metà percorso (§5) — così il seed esercita da subito compilatore, retrieval e i due tipi di escalation, non solo il caso più semplice.

**Cosa il seed NON copre**: non è un meccanismo di import per la documentazione tecnica reale del cliente (un bisogno diverso, ancora aperto — vedi §13, punto sull'adozione iniziale). Il seed resta dati di fixture, sostituibili/cancellabili, mai promossi a dati di produzione.

---

## 13. Cosa resta da chiudere prima del piano

**Valutazione complessiva**: la specifica copre bene l'architettura (compilatore, retrieval, data model, runtime, ciclo di vita, fallback, emergenze) — circa il livello di dettaglio giusto per iniziare a pianificare. Restano cinque blocchi da chiudere **prima** del piano (non durante), perché toccano decisioni che cambierebbero la forma del sistema se lasciate aperte fino all'implementazione:

1. **Lookup `serialNumber → RobotModel`** (§8, passo 1) — bloccante, richiede dati reali dal cliente demoRobot
2. **Ciclo di vita del Flow** — salva=online, niente draft/publish/preview (§12, già deciso); resta da confermare in dettaglio solo il modello di concorrenza sull'editing (permessi, lock)
3. **Contratto del retrieval** — topK/threshold (§8, già schematizzato), da tarare con dati reali
4. **Ownership dei dati workspace/RobotModel** — già deciso in §5 (workspace-scoped, flow generico come `robotModelId: null`), da validare che non emergano requisiti di condivisione cross-tenant non ancora previsti
5. **Logging e analytics minimi** — `RetrievalEvent` (§8, §8.1) già schematizzato, da confermare la forma di persistenza (log strutturato vs tabella)

Tutto il resto è deciso o rimandabile a un momento successivo alla stesura del piano, senza rischio di dover ripensare l'architettura.

### Lookup `serialNumber → RobotModel` — il punto bloccante

Prima domanda dell'intera pipeline (serial → model → retrieval → flow) — se non è definito, tutto il resto perde affidabilità a valle. Richiede informazioni reali dal cliente demoRobot (formato dei serial number, dove vive oggi quell'anagrafica), non deducibile dall'architettura:

| Approccio | Note |
|---|---|
| Lookup DB esatto | Richiede import/censimento di ogni serial venduto |
| Pattern/wildcard | Se il serial incorpora il codice modello |
| Regex su prefisso | Variante più rigida del pattern |
| Prefisso semplice | Il più semplice, fragile se i prefissi non sono ben distinti |
| API esterna del cliente | Nessuna duplicazione dati, ma dipendenza esterna nel turn loop |

### Altri punti aperti, non bloccanti

- Nome definitivo del modulo (`custom-demorobot`, da confermare — Andrea ha anche detto "demoRobots")
- Se il flow-builder diventa un componente riusabile per altri clienti o resta specifico di demoRobot
- Storage fisico degli allegati (`Asset.url`)
- Provisioning del widget per un nuovo workspace
- URL della privacy policy reale
- Trattamento definitivo degli allegati (§8)
- Modellazione di sotto-flussi condivisi (§4/§5)
- Limiti dimensionali esatti (§5 — nodi/allegati/caratteri per flow, valori indicativi da tarare)

---

*Documento aggiornato: 2026-07-30.*
