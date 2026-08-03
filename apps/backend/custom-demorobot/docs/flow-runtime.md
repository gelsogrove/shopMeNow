# DemoRobot — flow runtime architecture

> Documento vivo. Aggiornare qui ad ogni cambiamento del meccanismo
> flow/gate/escalation — non lasciarlo indietro rispetto al codice.
> Origine: `TODO.md` (root), sezione "ARCHITETTURA TARGET", discusso con
> Andrea 2026-08-03. Questo file ne è la versione mantenuta nel tempo.
>
> Grafico visuale del processo completo (apri in un browser):
> [`full-process-flow.html`](./full-process-flow.html)

---

## Il principio

> Una volta scelto il flow, il **codice** sa sempre quale domanda è dovuta
> adesso. L'LLM la traduce e classifica la risposta. Nient'altro.

Quando un flow è attivo, l'LLM **non deve mai decidere**:
- quale step viene dopo
- quale domanda fare
- se un terminale richiede escalation
- quali controlli fare prima dell'operatore

L'LLM **deve solo**:
- tradurre la domanda del nodo nella lingua del cliente
- classificare la risposta del cliente fra gli edge disponibili
- gestire tono e naturalezza

Vincoli permanenti: nessuna regola nuova nel prompt per compensare un buco nel
meccanismo, nessuna libreria nuova, nessun framework agent (XState, LangGraph,
Mastra — vedi TODO.md § "Librerie — perché nessuna").

---

## Stato oggi (2026-08-03)

`FlowNode` / `FlowEdge` esistono nello schema Prisma (`packages/database/prisma/schema.prisma`,
modelli intorno alla riga 2390) e sono già una macchina a stati validata dal
compiler. Ma **a runtime il grafo viene appiattito in prosa markdown** e
l'LLM deduce ad ogni turno dove si trova leggendo storico + prosa — quando la
deduzione sbaglia, non si ferma: inventa. `state.ts` lo dichiarava
esplicitamente:

```ts
// No currentNode/pendingQuestion — position is inferred by the LLM every turn
```

⚠️ Questa frase rappresenta il bug, non va reintrodotta quando si toccherà
`state.ts` per il punto 3 sotto.

⚠️ **Verificato 2026-08-03**: le tabelle fisiche `demorobot_flow_nodes` /
`demorobot_flow_edges` **non esistono** nel database a cui l'ambiente locale
si connette — le migrazioni che le creano (`20260731000000_add_demorobot_flow_chatbot`
e successive) non risultano applicate lì. Prima di validare qualunque dato
reale (label puliti? duplicati?) va chiarito quale database è quello con i
flow di produzione.

---

## Ordine di implementazione

Il punto 0 è bloccante per tutti gli altri: senza validazione delle label
duplicate, `advance()` (punto 4) sceglierebbe il primo edge in silenzio — un
bug mascherato, peggiore di quello che si sta risolvendo.

### ✅ 0 — Validazione `duplicate_edge_label` nel compiler — FATTO (2026-08-03)

Con una macchina a stati, due edge dello stesso nodo con la stessa label sono
ambigui. Il salvataggio del flow **fallisce**, non solo avvisa.

Implementato in `flow-compiler.service.ts` dentro `validateGraph` (subito dopo
il controllo `dangling_edge`, stesso ciclo sugli edge, raggruppati per
`sourceNodeId` via `groupBy` già presente nel file). Confronto **trimmed +
lowercased** ("Sì" e " sì " contano come la stessa risposta). Nuovo codice
`duplicate_edge_label` aggiunto a `ValidationError` in
`flow-compiler.types.ts`.

4 nuovi test in `flow-compiler.spec.ts`: rifiuta due edge duplicati sullo
stesso nodo, li rifiuta anche con case/whitespace diversi, accetta due label
diverse sullo stesso nodo, accetta la stessa label riusata da nodi sorgente
**diversi** (non ambiguo — `advance()` guarda un nodo alla volta). 21/21 test
del file passano, nessuna regressione sui 17 esistenti.

**Garanzia nuova, ora deterministica**: un flow con label duplicate sullo
stesso nodo non può più essere salvato — prima non c'era nessun controllo, né
a livello DB (`@@unique` assente su `FlowEdge`) né a livello validator.

Non serve il DB per scrivere/testare questo punto — è puro codice + test
unitari sul compiler.

### ✅ 1 — `loadFlow` restituisce il grafo, non solo `compiledPrompt` — FATTO (2026-08-03)

Implementato in `custom-client-chatbot.service.ts:722` esattamente con la
select allargata sotto. `LoadedFlow` (sia il mirror qui sia l'originale in
`custom-demorobot/flow-selection.ts`) ha ora un campo `nodes?` opzionale con
i nuovi tipi `FlowGraphNode`/`FlowGraphEdge` — opzionale apposta: un
`loadFlow` che non lo fornisce (host più vecchio, test double) continua a
funzionare come prima, il flow si attacca solo da `compiledPrompt` e
`currentNodeId` semplicemente non viene mai impostato. Nessuna rottura dei
43 test demorobot esistenti; nessun test ancora presente su
`custom-client-chatbot.service.ts` (0 file trovati) quindi nessuna
regressione possibile lì. Entrambi i moduli (`apps/backend` e
`custom-demorobot` isolato) compilano puliti.

Prima (`custom-client-chatbot.service.ts:722`):

```ts
select: { compiledPrompt: true, hash: true }
```

Deve restituire anche:

```ts
select: {
  compiledPrompt: true, hash: true,
  nodes: {
    select: {
      id: true, question: true, fieldKey: true, terminalType: true,
      outgoingEdges: {
        select: { label: true, targetNodeId: true, triggersEscalation: true },
      },
    },
  },
}
```

Nessun nuovo schema database: `FlowNode.outgoingEdges` è già una relazione
Prisma esistente (`@relation("EdgeSource")`). Poi allargare `LoadedFlow` in
`flow-selection.ts`.

### ✅ 2/3 — Stato del flow: `currentNodeId` + la macchina `flow-machine.ts` — FATTO (2026-08-03)

`SessionState` (`state.ts`) ora contiene:

```ts
activeFlowGraphSnapshot?: FlowGraphNodeSnapshot[]   // congelato all'attach, stessa garanzia di activeFlowPromptSnapshot
currentNodeId?: string                               // ← la fonte della verità
```

La frase che rappresentava il bug ("position is inferred by the LLM every
turn") è stata **rimossa**, non lasciata accanto al nuovo campo.

`flow-machine.ts` (nuovo file) espone funzioni pure, senza I/O:

```ts
buildFlowGraph(nodes: FlowGraphNodeSnapshot[]): FlowGraph
rootNodeId(graph): string | null        // l'unico nodo mai target di un edge (LOOP escluso, come nel compiler)
currentNode(graph, nodeId): FlowGraphNodeSnapshot | null
allowedLabels(graph, nodeId): string[]  // le label uscenti da QUEL nodo, per l'enum del tool
advance(graph, nodeId, label): { nextNodeId: string | null; escalate: boolean } | null
```

- cerca solo gli edge uscenti dal nodo dato
- trova un edge con quella label (confronto trim+lowercase, stessa
  normalizzazione della validazione `duplicate_edge_label`) → ritorna il target
- `triggersEscalation === true` → segnala escalation, **`nextNodeId: null`**
  in quel caso: l'escalation chiude il flow lì, non c'è "prossima domanda" a
  cui andare — il chiamante stacca il flow invece di muovere `currentNodeId`
  verso un nodo che non chiederà mai (scelta di design scoperta scrivendo il
  test, non ovvia dalla sola specifica — vedi commento su `AdvanceResult`)
- nessun edge trovato → `null` (il codice lo sa, non inventa un salto)

Il nodo radice si ricava dal grafo ad ogni attach (nessun nodo target di
alcun edge, i LOOP esclusi) — non si persiste, coerente con TODO.md § "Il
nodo iniziale — ricavato, non salvato". Calcolato in `startFlow`
(`flow-selection.ts`) e passato ad `attachFlow`, che lo scrive come
`currentNodeId` iniziale insieme al grafo congelato. Se `loadFlow` non
fornisce nodi (host più vecchio, flow senza grafo salvato), `attachFlow`
riceve `graph: undefined` e il comportamento resta identico a prima — nessun
`currentNodeId` viene mai impostato.

15 nuovi test in `__tests__/unit/demorobot-flow-machine.spec.ts`: root node,
grafo senza radice univoca, grafo vuoto, il caso LOOP, lookup nodo
sconosciuto, tutte le combinazioni di `advance()` inclusa la
normalizzazione case/whitespace e la garanzia che guarda solo gli edge del
nodo dato (non di altri nodi con la stessa label). 58/58 test demorobot
passano nell'insieme (43 esistenti + 15 nuovi), nessuna regressione.

⚠️ Nota tecnica: `flow-selection.ts` e `flow-machine.ts` non erano
nell'`include` di `custom-demorobot/tsconfig.json` — il typecheck isolato del
modulo li saltava silenziosamente. Aggiunti entrambi all'`include`.

### 4 — Tool `answer_step`

Enum **dinamico**, calcolato dal grafo per il nodo corrente:

```ts
{
  name: 'answer_step',
  parameters: {
    properties: { label: { type: 'string', enum: allowedLabels(graph, currentNodeId) } },
  },
}
```

Il modello non può inviare una label che non esiste per quel nodo — non è
nello schema.

Implementato: `answerStepTool(labels)` in `agent.ts`, enum ricalcolato ad
ogni turno da `allowedLabels(graph, currentNodeId)`. L'handler in
`executeTool` chiama `advance()`: se `escalate === true`, `detachFlow()` e
nessun avanzamento (`nextNodeId` è sempre `null` in quel caso, vedi §2/3
sopra); se un `nextNodeId` reale esiste, `currentNodeId` si muove lì; se
`advance()` restituisce `null` (label non riconosciuta), il tool rifiuta con
`error: 'unrecognized_answer'` e un'istruzione a chiedere chiarimento sullo
stesso nodo — mai un avanzamento a caso.

### ✅ 5 — Prompt minimale in fase flow — FATTO (2026-08-03)

Quando `currentNodeId` è impostato, `callLLM` (`agent.ts`) **sostituisce**
l'intero blocco `ACTIVE FLOW` (il `compiledPrompt` congelato) con
`formatFlowStepBlock(node.question, labels)` — non lo aggiunge accanto.
Fallback: se il nodo non ha archi uscenti (terminale raggiunto a metà turno)
o il grafo manca, torna al vecchio blocco `ACTIVE FLOW` completo — nessuna
regressione per i flow senza grafo salvato.

```
## THE QUESTION TO ASK NOW
[node.question]

- traduci questa domanda
- fai solo questa domanda
- non aggiungere domande, non inventare opzioni
- dopo la risposta usa answer_step
- se il cliente cambia argomento, usa abandon_flow
```

Stesso pattern già in produzione per l'intake (`formatIntakeBlock` in
`flow-selection.ts`) — qui si applica al nodo del flow invece che ai campi di
raccolta. Nuova funzione: `formatFlowStepBlock` in `flow-selection.ts`.

### ✅ 6 — Risposta non classificabile — FATTO (2026-08-03)

Se il cliente non corrisponde a nessun edge: non avanzare, non inventare,
restare sul nodo. Implementato nel turn loop di `agentTurnInternal`
(`agent.ts`): quando `answer_step` fallisce con `unrecognized_answer`, il
tentativo è contato via `registerFieldRequest(sessionId, `flow_node:${nodeId}`)`
— riuso della stessa infrastruttura per-campo già esistente per il gate
pre-operatore, solo con una chiave diversa (`flow_node:<id>` invece del nome
campo). Dopo **2 tentativi** falliti sullo stesso nodo, `detachFlow()` fa
cadere il turno successivo naturalmente in intake/gate. Il conteggio è **per
nodo**, mai globale (§14 — niente rilevamento per frase, "no"/"non so"/silenzio
contano identico: quello che conta è che `advance()` non abbia trovato un
edge, non le parole usate).

### ✅ 7 — `abandon_flow` — FATTO (2026-08-03)

Disponibile **solo** quando `currentNodeId` esiste (vedi `buildToolsForTurn`
sotto). Serve quando il cliente cambia chiaramente argomento (non quando la
risposta è solo ambigua — per quello si richiede chiarimento, punto 6).

Handler in `executeTool`: chiama `detachFlow()`, che pulisce
`currentNodeId`, `activeFlowId`, `activeFlowHash`, `activeFlowPromptSnapshot`,
`activeFlowGraphSnapshot`. `collectedData` **non si tocca** — quanto raccolto
resta per il briefing operatore.

### 8 — Escalation — un solo gate, da ogni strada

Ogni percorso verso l'operatore passa dallo stesso gate: `robotPowered`,
`wifiActive`, `cutScheduleActive`, `name`. Vale sia dall'intake sia da un
terminale `ESCALATE` dentro un flow specifico. **Non vale** per le emergenze
(escalation immediata, gate saltato).

Il messaggio finale arriva sempre da `humanSupportMessage` (Settings/DB) —
mai testo cliente scritto nel codice.

⚠️ Questo punto era già in gran parte implementato prima di questa sessione
(`nextPreOperatorStep`/`formatPreOperatorInstruction` esistevano già in
`flow-selection.ts`, vedi la sezione "Stato oggi" più sotto sul fix di
`agent.ts` che non compilava) — non richiede ulteriore lavoro per la parte
"un solo gate da ogni strada", già vera perché il gate vive nel tool
`escalate_to_operator`, non nel flow.

### ✅ 9 — Tool disponibili per fase — FATTO (2026-08-03)

`buildToolsForTurn(state, labels)` in `agent.ts` decide l'array di tool per
il turno, non una costante statica sempre uguale (`TOOLS` prima):

| Fase | Tool esposti |
| --- | --- |
| Flow attivo (`currentNodeId` set) | `answer_step` (enum dinamico), `remember`, `abandon_flow`, `escalate_to_operator` |
| Nessun flow attivo | `start_flow`, `remember`, `escalate_to_operator` |

Un flow attivo non espone `start_flow` — cambiare flow a metà diagnosi non è
più possibile, va fatto passando da `abandon_flow`. Un tool non esposto non
può essere usato male: è un vincolo dello schema passato all'API, non una
richiesta nel prompt.

---

## Il canale disattivato — guard a monte, fuori da questo modulo

⚠️ **Non fa parte del ciclo flow sopra** — vale la pena documentarlo qui
perché è il primo controllo che l'host esegue, prima di chiamare
`chatbotFn()` di `custom-demorobot`.

Verificato 2026-08-03 in `custom-client-chatbot.service.ts:338-349`:

```ts
if (!params.channelActive) {
  return {
    handled: true,
    output: { reply: null, wipMessage: ..., shouldEscalate: false, ... },
  }
}
```

- `channelActive` viene da `workspace.channelStatus` (default `true`)
- Il testo viene da `workspace.wipMessage` (default in DB, non nel codice)
- Tradotto da `TranslationAgent`, **non** dal meccanismo `⟦LANG:xx⟧` interno
  al modulo (quello richiede una risposta LLM che qui non avviene — il
  canale è disattivato, nessuna chiamata al modello)

⚠️ **Incoerenza confermata, ma solo parziale** (verificato leggendo il codice
esatto, 2026-08-03): la priorità della lingua **non è uguale su tutti i
canali**, e in nessun caso legge il testo scritto ora dal cliente — per
definizione, col canale disattivato nessun LLM lo legge.

| Canale | Catena di priorità | `customer.language` storico? |
| --- | --- | --- |
| WhatsApp, cliente **esistente** | `customer.language → prefisso telefonico → workspace.defaultLanguage` (`ultramsg-webhook.controller.ts:1051`) | ✅ Sì, ha priorità sul prefisso |
| WhatsApp, cliente **nuovo** | `prefisso telefonico → workspace.defaultLanguage` (righe 497-498, 675-676) | ❌ Non esiste ancora storia |
| Widget, ramo WIP | `explicitLanguage → prefisso → browser Accept-Language` (`widget-chat.controller.ts:1553`) | ❌ Non entra in questa catena specifica |

Quindi: un cliente **noto** su WhatsApp riceve il WIP message nella lingua in
cui l'LLM l'aveva già sentito parlare in passato — ragionevole, non un bug.
Il punto debole resta **solo** il cliente nuovo (qualunque canale) e il
**path widget** in generale: lì la lingua è un'euristica (prefisso/browser),
mai il testo del messaggio corrente, perché nessuna chiamata LLM avviene
quando il canale è disattivato. Non risolvibile senza introdurre un
rilevamento testuale a basso costo (fuori standard di questo modulo) o
accettare l'euristica come compromesso — da decidere con Andrea, non
assumere.

---

## Cosa diventa garanzia, cosa resta probabilistico

✅ Questa tabella descrive lo stato **implementato** al 2026-08-03 (punti
0-7, 9 fatti — vedi sezioni sopra), non più solo il target.

| Decisione | Chi |
| --- | --- |
| Quale domanda si fa adesso | 🔵 CODICE (`FlowNode.question`) |
| A che punto è il flow | 🔵 CODICE (`currentNodeId`) |
| Dove si va dopo la risposta | 🔵 CODICE (`FlowEdge.targetNodeId` via `advance()`) |
| Se si escala | 🔵 CODICE (`triggersEscalation`, gate) |
| Quali tool sono disponibili | 🔵 CODICE (per fase / `terminalType`) |
| Quale flow corrisponde al problema | 🟠 LLM (validato da `start_flow`, non dalla pertinenza) |
| Su quale edge cade la risposta | 🟠 LLM (fra i label esistenti) |
| Tono, naturalezza, traduzione | 🟠 LLM |

**Criterio di successo**: un flow attivo non può più produrre una domanda che
non esiste in `FlowNode.question`. Se il modello sbaglia, può scegliere un
ramo sbagliato — non può inventare un ramo o una domanda.

---

## Regola di lavoro per chi tocca questo file

- Piccoli passi verificabili, nell'ordine 0→9 sopra — non refactor massivi.
- Dopo ogni modifica: aggiungere test, e annotare qui quale garanzia nuova è
  diventata deterministica (sposta una riga dalla colonna 🟠 alla 🔵 nella
  tabella sopra, se applicabile).
- Prima di modificare codice: leggere lo schema Prisma, `flow-compiler.service.ts`,
  `custom-client-chatbot.service.ts`, `state.ts`, e i test esistenti
  (`__tests__/unit/demorobot-*.spec.ts`).
