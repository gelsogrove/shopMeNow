 

rispondi alla domande

- se un utente non e' registrato e manda un mesaggio viene fuori il messagigo di welcome con il link?

- se un utente non e' registrato e continua a mandare piu di 5 messaggi cosa succede?

- se il canale e' disable manda il messaggio di wip presneteo in workspace Settings?

- nella coda di whataspp (cronjob) prima di inviare si punta al LM di sicurezza? 

- il viaggio del messaggio e' sempre trackeato dentro message flow timeline?

- se utente ha chatbotAtive disable cosa succede se riceve messaggi?

- se utente e'bloccato cosa riceve?

- Il token tranne nelle chiamate di login viene sempre passato? abbiamo un test sui middlewares presenti ? 

- lato FE abbiamo test su invio middleware (interceptor)?

- contatore dei soldi , transazione billing sono per ownerId ? nel senso che comprendono i costi di tutti i canali che hanno ?

- siamo sicuri che i mesasggi tra canali e utenti non si mescolano abbiamo sempre tutti i filtri correttamente impostati nell chatbot ? per esempio per le variabili di replce abbiamo sempre il filtro workspaceId ? 

- cosa succede se un utente arriva a 50 prodotti e vuole aggiungerne uno ed ha un plan Basic?

- cosa succede se scrive il clente 51 esimo ? con plan basic?
- e se fosse Premium viene rispsttato ?
- i pagamenti vengono effettuati sempre il primo del mese?
- se un untente scrive troppe volte senza regitrarsi viene bloccato?
- anche se registato se un utente manda piu di 15 messaggi al minuto deeve essere bloccato 

- se il flag di debugTest e' a true si ferma la queue di whatsapp? vero ?(cronjobs) 

- se ho diversi ownserId(untenti) non si accavalleranno mai messaggi canali prodotti statistiche, soldi, fatture ??? ho bisogno qui di un coverage al 100% ed esssere sicuro che non ci sia nessuna query che non abbia correttamente il suo filtro per token/workspacekId/ownerID dipende dai casi....
e anche i metodi GET PUT DELETE POST devono essere ben controllati 


- ci sono endpoint che soo ridondanti ?

- ci sono endopiint che non si usano piu

- esiste codice morto dentro il BE?

- esiste codice morto dentro il FE?

- vedi problemi di sicurezza ? 

- documtnazione e' inerente a quello sviluppato ? almeno all'80%?

- la piattaforma di backend e homepage sono responsive(
    ovviamente la chat non lo puo' essere in questo momento
)

- ci sono file temporanei da cancellare ? .bak.skip file temp script temporanei

- readme globale e' aggiornato ?

- .gitignore e' ben fatto e pulito?

- le tabelle anno gli indici per gestire numerosi dati ?

- npm run test funziona ? 
- abbiaom un check che prima di fare commit deve fare bene la build e il test deve passare?  non so un hook su git?

- puoi pulire almeno un 10 console.log sia di Fe che di BE che non servono ? 

- IL FE possiamo assicurarci che no ci siano chiamate doppie o inutili nelle pagine? spesso vedo chiamate inutili e doppie devi fare un analisi forse

- le tabelle del DB sono tutte utilizzate ? i campi sono utilizzati tutti ? ci sono campi morti ?

- possiamo uniformare tutte le migrazionioni ad una sola ?

- possiamo aggiugnere 2 o 3 test critici che tu reputi importanti nel BE? ? 

- tutti i file sonon nelle giuste cartelle ?

- suggerisci un improvments di BE or FE scegli tu

- vedi bugs? incongruenze con la documentaizone?

- aggiorna le librerie all'ultima versione ma dobbiamo stare attenti che tutto funziona quindi ecco perche' it est unitari sono imporanti e devono essere ben fatti e deveono avere logiche che hanno senso 

- FE e BE stanno usando correttamente la best practise?

- tutto quello che ci siamo detti hanno i test unitari?


- ottimizzazoni necessarie per le query ? sopratutto per le tabelle piu popolate?

- abbiamo solo uno schema di prisma?
- i comandi di prisma non si lanciano in produzione dovrebbe esserci un blocco per NODE_ENV=production

- c'e' qualche .env che non si utilizza piu ?

- mi confermi che le api che abbiamo fatto di admin sono tutte dentro backoffice e che dentro FE abbiamo solo delle api de get per prednere i valori ? 

- im confermi che se canLogin e' false il chatbot rispodne con il messaggio di WIP ?

- mi conferni che se CanRegister e' true non ci  si puo' 
registrare?

- mi confermi che il backoffice nonha problemi di sicurezzA?

- utenti isDeveloperUser e isPlatformAdmin  mi assicuri che non fanno il qr code step ?

- abbiamo problemi di vulnerability ?

- non devi editare questo file ricordatelo !

- FIlename fai un rename dei files tutto in minuscolo dovrebbero essere , ma non puoi farlu tutti scegli 5 file e fai il rename e il fix.

- tutti i prezzi vengono letti da un unico prezzo

- se cambio i prezzi nell'arco del tempo non affetta il passato e le vecchie fatture vero e le transizioni vero ?  cambia dal momento che cambio il valore del prezzo in avanti vero? confermi?

- i messaggi passano sempre da un layer di traduzione?

- SAFETY_TRANSLATION e' stato tolto dalla documtnazione dal codice etcd..etc..

- il flusso del messggio e' Router Agent → (specialist agents) → Translation Layer → Save to History > Quueue di wahtasppp

- non c'e' nulla di harcodeato vero?

- ogni LLM ha il suo scopo giusto e non ci sono cose di altri LLM in mezzo ? 

- mi controlli che 

- fammi una tabella per vedere il risultato ma solo quelle cose che non vanno le cose che vanno non fammele vedere