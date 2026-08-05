rifacciamo, vediamo se hai capito, cosa ti torna e cosa manca

- se il channel è disattivo parte il wip message
- se l'utente è nuovo facciamo il welcome message, se l'utente non è nuovo facciamo il welcome back message chiamandolo con il nome
- il chatbot deve rispodnere nella lignau del cliene se la lignua e' presente nel settings..come lignua dispobibile altrimenti usa lignua di degault che anch'essa dovrebbe essere nel settigs.json
- se riconosciamo che è un problema chiediamo prima di tutto il serial number, la spiegazione, quando è successo .... e poi cerchiamo il problmema dentro flow se non lo trovi allora passa a human support flow
  se lo trova seguie ogni passaggio e quando incontra il passaggio escalete to user...allora chiamiamo human support flow
- la spiegazione del problema non può essere generica, deve avere un minimo di dettaglio
- se è una faq non c'è bisogno del numero di serie
- il numero di serie deve essere di 19 caratteri, deve essere validato; dopo 3 volte contatta operatore
- se c'è un problema (non una FAQ) e il cliente non fornisce il numero di serie, NON si può avanzare nella diagnostica — dopo 3 tentativi falliti si passa direttamente a Human Support Flow, mai a domande diagnostiche improvvisate dal modello
- se riconosciamo che è una faq rispondiamo con la risposta
- se riconosciamo lo scontento dell'utente lo colleghiamo a un operatore
- Prima di collegare con l'operatore chiediamo il nome e facciamo l'handing-off message
- se non trova né faq né flow parte con Human operator flow spiegando che non abbiamo la ifo ma non inventi
- NON DEVI INVENTARE, OGNI RISPOSTA DEVE ARRIVARE DA UNA FONTE
  (faq o Flow)
- se non hai la riposta scrivi non ho quesat informazione e passiamo a **Human operator flow**
- abbiamo uno storico dei messaggi; se passa un'ora rispondiamo con il welcome back message + risposta
- abbiamo un session state e dei guard

**Human operator flow**
dobbiamo avere già chiesto il serial number
se e' una domanda che non abbiamo nelle faq non serve chidere i dati del robot

chiediamo se il robot è acceso
chiediamo se il wifi è on
chiediamo se il cut scheduling è schedulato
chiediamo se c'è abbastanza batteria
(fine del flow — il flow builder oggi classifica solo Yes/No, non testo libero)

subito dopo, chiediamo il nome dell'utente se non lo abbiamo già
e mostriamo l'handing-off message che arriva dal settings.
e imporante lanciamo la calling function per human support in questo momento quando c''e il handing-off message

e' tutto nel flow di default che non deve essere cancellato
editato si cancellarlo mai !

[STATO 2026-08-06 — implementato e scritto sul DB di produzione]

La sequenza, un meccanismo per ogni pezzo:

  caso TECNICO
    gate  → serial → descrizione → quando        (intake: precede il flow,
                                                  serve a SCEGLIERLO)
    flow  → robot acceso? → wifi? → cut scheduling? → batteria?
            (No su scheduling/batteria → nodo correttivo LOOP → ri-chiede)
          → terminale ESCALATE
    gate  → nome                                 (testo libero)
          → escalate_to_operator                 (mail operatore)
          → handoff message DETTATO da settings
          → host: activeChatbot = false

  caso NO_DEVICE (complaint / faq_not_found / requested_operator)
    gate  → nome → escalate → handoff → spegnimento
    Niente flow, niente serial, niente check tecnici: non c'è dispositivo da
    diagnosticare, e interrogare chi è già scontento è la risposta sbagliata.

Chi fa cosa, e perché non è ridondanza:
- il FLOW fa le 4 domande tecniche — ogni risposta cambia il percorso
- il GATE fa solo ciò che il motore non sa fare: l'intake (viene prima che un
  flow esista) e il nome (testo libero; `answer_step` classifica solo
  etichette fisse)

Garanzie in codice, non nel prompt (CLAUDE.md §16):
- `escalate_to_operator` RIFIUTA con `human_support_flow_required` +
  `force_tool: 'start_flow'` finché il flow non è stato percorso
- `humanSupportFlowDone` impedisce che il terminale ESCALATE del flow rimandi
  il cliente dentro lo stesso flow — marcato su ENTRAMBE le uscite (nodo
  terminale e edge triggersEscalation)
- `CHECKLIST.technical` = serial / descrizione / quando / nome. I 4 booleani
  NON sono più nel gate né in `gateQuestions`: sarebbero config morta.

Flow in produzione (`cmsfavpet0000qwngacwdutj6`), 9 nodi / 10 archi:
  hf_powered_on → hf_wifi → hf_cut_scheduling → hf_battery → ESCALATE
  hf_cut_fix e hf_battery_fix sono `terminalType: LOOP` con back-edge "Done"
Il compiler accetta i cicli SOLO attraverso nodi LOOP. Il tetto è `maxAsks`
in gate.ts, non nel grafo: un LOOP è infinito per costruzione, e un cliente
che non può completare un check deve comunque arrivare a un umano.

⚠️ Bug corretto nello stesso passaggio: `hf_handoff_powered_off` era
`terminalType: SELF_SERVICE`, non ESCALATE. Un cliente col robot spento
chiudeva il flow in self-service — niente nome, niente handoff, niente
operatore, chatbot acceso. Ogni strada di questo flow deve finire da un
umano: è quello che il flow è.

Script: `apps/backend/scripts/update-amrobots-human-support-flow.ts`
(aggiorna il flow esistente, non lo ricrea — "editato si, cancellarlo mai").
Test: `__tests__/unit/demoam-human-support.spec.ts`.

[SPEGNIMENTO CHATBOT — verificato 2026-08-05, FUNZIONA]
`recordEscalation` nel modulo fa solo un console.error, ma lo spegnimento
avviene lato host: whatsapp-inbound.pipeline.ts manda la mail all'operatore
e poi setta `activeChatbot: false` sul customer, quindi i messaggi
successivi non arrivano più all'LLM. L'humanSupportMessage ("disattivo il
chatbot") dice il vero.

La condizione lato host è `shouldEscalate && escalationSummary`: un summary
vuoto disinnescherebbe sia la mail sia lo spegnimento. Non può succedere,
per due guardie indipendenti:
1. `escalate_to_operator` rifiuta un summary vuoto (agent.ts, ok:false)
2. all'uscita del modulo il summary ha comunque un default non-vuoto
   (agent.ts: `|| "Session ... escalated (no briefing captured)"`), che
   copre anche il fallback maxToolHops — quel percorso non passa da
   escalate_to_operator e quindi non è coperto dalla guardia 1.
Se una delle due viene toccata, lo spegnimento torna probabilistico.

**IMPO**

- in tutto questo abbiamo un file settings.json che si popola al salvataggio dei setting dentro l'app, che mette dentro i testi con variabili tradotte

- in tutto questo abbiamo un main prompt che orchestra tutto con eventuali variabili

- sei libero di modificare il DB con query sql su supabase, modificando main prompt e altri campi

- non mi interessano i test unitari

- non commentare il codice, lascia che il codice parli da solo con i giusti nomi dei file, funzioni, variabili

GUARDS

- il numero di serie viene validato dal codice (formato/lunghezza), mai dal modello; dopo 3 tentativi falliti si passa oltre e non viene richiesto di nuovo nel gate finale
- la spiegazione del problema troppo generica viene rifiutata dal codice e richiesta di nuovo (max 2 volte), non accettata come se fosse un dettaglio reale
- se riscontriamo che e' un problema e non una faq il numero di serie è sempre la prima domanda
- l'ordine delle domande (serial → spiegazione → quando → Human operator flow) è deciso dal codice, mai dal modello
- ogni domanda del gate e del flow è dettata parola per parola dal codice; il modello la traduce, non la inventa
- il modello non può rispondere a una domanda con testo libero: deve sempre chiamare un tool (salvare un dato, rispondere da FAQ, avanzare nel flow, scalare)
- il codice sa sempre se una domanda del gate è l'ultima o no, e lo dice al modello — mai lasciato indovinare ("un'ultima cosa" detto più volte)
- l'annuncio del passaggio all'operatore può avvenire solo nel turno in cui l'operatore è stato davvero contattato, mai prima
- se una domanda del gate resta senza risposta salvata, il modello non può richiederne un'altra: deve prima salvare quella in sospeso
- le risposte alle FAQ passano da un tool che verifica che la FAQ citata esista davvero, mai testo libero
- il messaggio finale di un flow (quello di successo, non di escalation) è dettato dal codice, mai inventato dal modello
- se il flow porta a un'escalation, vai a human support flow
- se il cliente cita un codice errore diverso da quello del flow scelto, il flow viene rifiutato
- Human operator flow è un flow vero nel flow builder (non un oggetto di domande nel codice), protetto e non cancellabile — ogni percorso tecnico verso l'operatore ci passa
- "non inventare" riguarda i FATTI, non il tono: il modello resta libero di essere caloroso e naturale nel modo di dire le cose, mai libero di dire cose non vere
- appena il cliente dice il suo nome, nome società, telefono o indirizzo — anche di passaggio, non richiesto — lo salviamo subito con una calling function che scrive nel record cliente sul DB (name/company/phone/address)
- ogni nodo del flow builder può portare a: un nuovo nodo, la fine del flusso, l'escalation a un operatore, oppure un altro flow intero — tutte e quattro le destinazioni sono opzioni valide per ogni risposta
- quando il flow builder riconosce il problema del cliente e attacca il flow giusto, prende il testo del nodo corrente, lo dà al cliente nella sua lingua, e aspetta la sua risposta prima di passare al nodo successivo — un nodo alla volta, mai più di uno per messaggio

PROSSIMO — da pianificare, non ancora iniziato

- trova un metodo per non inventare nulla sia lato faq che flow che di main prompt e conferma che e' attivo ! se gia' c'e' verifica se e' attivo e che non ha bug e che sia nel posto giusto
- ricordati il fatto che nondebba invenatare non signigica che non deve applicare fantasia...sonon i concetti che non dev inventare !
- [2026-08-05] ORCHESTRATOR non riusa risposte già date fuori sequenza: test
  custom-demoam/cli/scenarios/05-flow/05-orchestrator.json — il cliente dice
  "la luce rossa è accesa e lampeggia in continuazione" (risposta SIA al nodo
  radice di ERROR 001 SIA al secondo nodo), ma il flow chiede comunque "C'è
  una luce rossa accesa?" da capo invece di saltare le due domande già
  risposte. Il flow builder oggi avanza solo su answer_step con un label
  Yes/No esplicito per il nodo CORRENTE — non prova mai a leggere le risposte
  dalla history/dal messaggio del cliente per i nodi che seguiranno. Serve
  probabilmente: il modello tenta answer_step anche per nodi non ancora
  correnti quando la history già contiene la risposta, con la validazione nel
  codice (gate.ts/flow-machine.ts) che quell'answer_step sia legittimo
  (nodo raggiungibile dal path già percorso) — non un problema di prompt.
  Nello stesso scenario è comparso anche un turno con reply vuota (bug
  separato, non ancora isolato).
- [2026-08-05] escalate_to_operator non può forzare STRUTTURALMENTE quale
  tool venga chiamato dopo un refusal — solo tool_choice:'required' generico
  (un tool qualsiasi), mai un tool_choice vincolato a un nome specifico.
  Visto live: test custom-demoam/cli/scenarios/04-serial-number/02-serial-number-ko.json
  — il refusal human_support_flow_required dice "call start_flow with flowId
  '...' NOW", ma humanSupportFlowOffered si marca true alla PRIMA chiamata
  del gate, prima ancora che il modello abbia davvero chiamato start_flow.
  Il modello ha scritto testo libero ("mi serve il tuo nome") invece di
  seguire l'istruzione, il flow Human Support non si è mai attaccato, e la
  domanda del nome è arrivata fuori sequenza rispetto ai controlli tecnici
  (acceso/wifi/cut-scheduling/batteria) — confusione reale per il cliente,
  che risponde "sì è collegato alla corrente" pensando di rispondere al
  nome. Fix pulito: tool_choice vincolato a un function name specifico
  (supportato da OpenAI/OpenRouter: {type:'function', function:{name:...}}),
  da propagare in callLLM/agentTurnInternal — stessa portata del gap
  ORCHESTRATOR sopra, non un fix mirato.
  [FATTO 2026-08-05] implementato forceSpecificTool in callLLM/agentTurnInternal
  (agent.ts), usato dal refusal human_support_flow_required (gate.ts).
- [2026-08-05] remember accettava valori chiaramente inventati per campi
  obbligatori — visto live: il modello chiamava remember({key:'name',
  value:'unknown'}) quando il cliente non aveva ancora detto il proprio nome,
  e con quel placeholder salvato escalate_to_operator andava a segno subito,
  saltando la domanda vera e l'handing-off message. Stesso problema visto per
  i campi tecnici del flow Human Support (robotPoweredOn ecc. inventati in
  una raffica di remember invece di rispondere via answer_step, nodo per
  nodo). [FATTO 2026-08-05] due guard aggiunti: validateCustomerName
  (content-guards.ts, rifiuta placeholder come "unknown"/"n/a"/stringa vuota
  per key:'name') e un guard in agent.ts che rifiuta remember su qualunque
  fieldKey appartenente al grafo del flow attivo — quei campi possono
  arrivare SOLO da answer_step. Residuo NON risolto: quando più remember
  vengono rifiutati nello stesso hop (es. cutSchedulingActive + name insieme,
  entrambi placeholder), il turno può produrre una reply VUOTA invece del
  testo dettato dal guard — visto in
  custom-demoam/cli/scenarios/07-human-support/04-vague-problem-full-gate.json.
  Non ancora isolata la causa esatta (probabile interazione tra due
  dictates_text:true nello stesso hop, l'ultimo vince e il testo si perde).

**non toccare questo file se non hiil pemesso utente**

FLOW:
e' possibile cheun flow passi ad un altro flow ! deve essere un opzione da gestire
[FATTO 2026-08-05] un'answer puo' puntare a targetFlowId invece che a un nodo (FlowEdge.targetFlowId, migration 20260805140000_add_flow_edge_target_flow) — il flow editor ha il picker "go to another flow" (flowApi.listAll / GET .../demorobot/flows/all)
[FATTO 2026-08-05] rimosso il dialog "Flow instructions" (generate/save di un human-readable prompt via LLM dopo il Save): non veniva mai letto a runtime, il flow gira nodo-per-nodo su compiledPrompt + graph. Salva ora torna direttamente alla lista flow

- le parti harcodeate devon essee portate al minimo parliamo con l'utente per ogni scelta di hard-code non dico di non usarle dico di condividere

UI/UX

- l'interfaccia del flow builder è fondamentale, è il cuore del backend: deve
  aiutare l'utente a capire chiaramente cosa sta facendo in ogni momento
  (dove porta ogni risposta — nodo, fine, operatore, o un altro flow — quali
  campi sta salvando, cosa succede al Save). Va curata con la stessa
  attenzione della logica che governa

ORCHESTRATOR

- se il cliente, descrivendo il problema, ha già dato la risposta a una
  domanda del flow (es. dice "ho la luce accesa" mentre spiega cosa succede),
  l'orchestratore non deve richiederla di nuovo: la salva e passa alla
  prossima domanda non ancora risposta. Se anche quella è già stata detta,
  salta anche quella, e così via — mai fermarsi su una domanda il cui dato
  è già presente in SESSION STATE.

PULIZIA

- mai lasciare file temporanei/di scratch appesi nella root del progetto
  (script one-off tipo scratch_*.ts per query dirette al DB, ecc.) — vanno
  rimossi subito dopo l'uso, la soluzione deve restare pulita in ogni momento
