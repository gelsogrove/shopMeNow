rifacciamo, vediamo se hai capito, cosa ti torna e cosa manca

- se il channel è disattivo parte il wip message
- se l'utente è nuovo facciamo il welcome message, se l'utente non è nuovo facciamo il welcome back message chiamandolo con il nome
- il chatbot deve rispodnere nella lignau del cliene se la lignua e' presente nel settings..come lignua dispobibile altrimenti usa lignua di degault che anch'essa dovrebbe essere nel settigs.json
- se riconosciamo che è un problema chiediamo prima di tutto il serial number, la spiegazione, quando è successo .... e poi cerchiamo il problmema dentro flow se non lo trovi allora passa a human support flow
  se lo trova seguie ogni passaggio e quando incontra il passaggio escalete to user...allora chiamiamo human support flow
- la spiegazione del problema non può essere generica, deve avere un minimo di dettaglio
- se è una faq non c'è bisogno del numero di serie
- il numero di serie deve essere di 19 caratteri, deve essere validato; dopo 3 volte contatta operatore
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
