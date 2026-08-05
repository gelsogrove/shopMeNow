rifacciamo, vediamo se hai capito, cosa ti torna e cosa manca

- se il channel è disattivo parte il wip message
- se l'utente è nuovo facciamo il welcome message, se l'utente non è nuovo facciamo il welcome back message chiamandolo con il nome
- il chatbot deve rispodnere nella lignau del cliene se la lignua e' presente nel settings..come lignua dispobibile altrimenti usa lignua di degault che anch'essa dovrebbe essere nel settigs.json
- se riconosciamo che è un problema chiediamo prima di tutto il serial number, la spiegazione, quando è successo .... e poi seguiamo il flusso dello Human operator flow
- la spiegazione del problema non può essere generica, deve avere un minimo di dettaglio
- se è una faq non c'è bisogno del numero di serie
- il numero di serie deve essere di 19 caratteri, deve essere validato; dopo 3 volte contatta operatore
- se riconosciamo che è una faq rispondiamo con la risposta
- se riconosciamo lo scontento dell'utente lo colleghiamo a un operatore
- prima del supporto umano dobbiamo essere sicuri di avere Serial Number, nome, robot acceso, wifi acceso, cut scheduling acceso, abbastanza batteria.
  Prima di collegare con l'operatore chiediamo il nome e facciamo l'handing-off message
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
chiediamo il nome dell'utente se non lo abbiamo
mostriamo l'handing-off message
lanciamo la calling function per human support

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
- il numero di serie è sempre la prima domanda, anche se il messaggio del cliente è vago — nessuna domanda di chiarimento la precede
- l'ordine delle domande (serial → spiegazione → quando → Human operator flow) è deciso dal codice, mai dal modello
- ogni domanda del gate e del flow è dettata parola per parola dal codice; il modello la traduce, non la inventa
- il modello non può rispondere a una domanda con testo libero: deve sempre chiamare un tool (salvare un dato, rispondere da FAQ, avanzare nel flow, scalare)
- il codice sa sempre se una domanda del gate è l'ultima o no, e lo dice al modello — mai lasciato indovinare ("un'ultima cosa" detto più volte)
- l'annuncio del passaggio all'operatore può avvenire solo nel turno in cui l'operatore è stato davvero contattato, mai prima
- se una domanda del gate resta senza risposta salvata, il modello non può richiederne un'altra: deve prima salvare quella in sospeso
- le risposte alle FAQ passano da un tool che verifica che la FAQ citata esista davvero, mai testo libero
- il messaggio finale di un flow (quello di successo, non di escalation) è dettato dal codice, mai inventato dal modello
- se il flow porta a un'escalation, passa dallo stesso Human operator flow di ogni altro percorso
- se il cliente cita un codice errore diverso da quello del flow scelto, il flow viene rifiutato

NEVER

- NEVER invent a diagnosis, a cause, a fix, or a question of your own.',
- NEVER invent product facts: models, prices, warranty, parts, delivery times.',
- NEVER confirm a serial number or warranty unless SESSION STATE says so,
- never change the DB IN LOCAL alwasys su heroku!

PROSSIMO — da pianificare, non ancora iniziato

- Human operator flow diventa un flow vero e proprio nel flow builder (non un
  oggetto di domande nel codice/settings) — non cancellabile, tutti i
  percorsi verso l'operatore (nessun match, complaint, emergenza, FAQ non
  trovata, ESCALATE terminal di un altro flow) confluiscono lì invece che nel
  meccanismo attuale di escalate_to_operator

- trova un metodo per non inventare nulla sia lato faq che flow che di main prompt e conferma che e' attivo ! se gia' c'e' verifica se e' attivo e che non ha bug e che sia nel posto giusto
- ricordati il fatto che nondebba invenatare non signigica che non deve applicare fantasia...sonon i concetti che non dev inventare !

**non toccare questo file se non hiil pemesso utente**

FLOW:
e' possibile cheun flow passi ad un altro flow ! deve essere un opzione da gestire
