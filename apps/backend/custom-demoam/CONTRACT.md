rifacciamo, vediamo se hai capito, cosa ti torna e cosa manca

- se il channel è disattivo parte il wip message
- se l'utente è nuovo facciamo il welcome message, se l'utente non è nuovo facciamo il welcome back message chiamandolo con il nome
- se riconosciamo che è un problema chiediamo prima di tutto il serial number, la spiegazione, quando è successo e poi seguiamo il flusso dello Human operator flow
- se è una faq non c'è bisogno del numero di serie
- il numero di serie deve essere di 19 caratteri, deve essere validato; dopo 3 volte contatta operatore
- se riconosciamo che è una faq rispondiamo con la risposta
- se riconosciamo lo scontento dell'utente lo colleghiamo a un operatore
- prima del supporto umano dobbiamo essere sicuri di avere Serial Number, nome, robot acceso, wifi acceso, cut scheduling acceso, abbastanza batteria.
  Prima di collegare con l'operatore chiediamo il nome e facciamo l'handing-off message
- se non trova né faq né flow parte con Human operator flow
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

**IMPO**

- in tutto questo abbiamo un file settings.json che si popola al salvataggio dei setting dentro l'app, che mette dentro i testi con variabili tradotte

- in tutto questo abbiamo un main prompt che orchestra tutto con eventuali variabili

- sei libero di modificare il DB con query sql su supabase, modificando main prompt e altri campi

- non mi interessano i test unitari

- non commentare il codice, lascia che il codice parli da solo con i giusti nomi dei file, funzioni, variabili
