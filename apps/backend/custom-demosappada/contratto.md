- il primo messaggio deve essere il welcome message o il welcome back message se utente esisteva gia quindi il primo check e' sapere se utente esiste o no

- il chatbot prima deve riconoscere la lingua e poi rispondere con la lignua del ciente, se e' un utente gia' esistente guardare la lingua del profilo, se 'e un utente nuovo aggiorna con call function la lingua dell'utente ovviamente la varibiale langialge o simile deve passare al main prompt

- dopo il welcome message chiediamo quanti siete e quanto vi fermate
  domanda che non e' dentro il welcome mesage dvi fare tu un moisto

- se utente dice siamo due adullti devi capire che non ha ancora risposto alla domanda quando vi fermate quindi devi chiedere quanto vi fermate?

- dopo devi chiedre
  Is there anything specific you would like to point out? Is there someone with celiac disease? Will you be without a car? Are there any other details or special needs we should know about, so we can provide you with tailored information and advice?

  > tutto questo riempe uno state quando lo state e' competo allora riempi le note con la CF dell'utente

- una volta riempito lo state chiedi se utente vuole ricevere le nottifiche su meteo eventi notizie offerte per la durata della vacanza

  > se si dici : "Perfetto potrai in qualsiasi momento toglierti scrivendo NO PUSH e mettiamo come tag "IN LOCO eventi, news. offerte, meteo"
  > se no , va bene ultima domanda come ti chiami ? e lanciamo CF per aggiornae profilo

- Ora possiamo salutare 'utente con il nome
  Perfetto NOMEUTENTE , oggi ...(guarda il meteo) consiglio di...guarda meteo
  date faq e consiglia un posto e se abbiam tira fuori il video e il dettaglio di quello che consigli una sola proposta
  e alla fine scrivi, vuoi che ti fccio un intinerario di Sappsaa per tutta la tua permanenza incrociando meteo permanenza e le tue prferenze?

  > aggiorni con cf intinerareio cosi non riproporre le sttesse cose e avere uno storico per le risposte

- a fine vcanza mandiao un feedcback di come e' andata la vacanza
  insieme ad un altra domanda:
  vuoi che ti invio offerte eventi di sappada per la prossima vacanza ?
  se si mettiamo il tag "NO IN LOCO" e i tag eventi offerte news e togliamo
  "IN LOCO" e cancelliamo le note e intinerario dal profilo

- tuti queti campi devono riempire il main prompt perche' dovremo chattare e conoscere queste rpeferenze nel tempo

- le liste non hanno mai video link o foto
- quando parliamo di un singolo caso mostra il viode se ce l'hai oppure link o foto diepnde cosa hai nel db
- ottimizza il codice cerca un design pattenr e rispettalo non volio accrocchi non voglio quasi nulla harcodeato
- ricodati che il settings.json viene salvato dall'applicazione
- ricordati che il main prompt dev essere fatto bene avere tutte le varibili
- usa la cache, ma la cachce su meteo puo' essere pericoloso visto che abbiamo una cf con dati esterni
- ricordati di incociare le risposte meteo preferenze e dati nel db quewto l fai ponendo attenzione al main prompt che abbia tute le variabili
- non inventare risposte ! le risposte devono arrivare dal db se non le hai di non ho queste informazioni ma non invnetare
- non cambare mai questo file!
- al cambio di lingua se utente dice voglio cambaire lingua fai partire la CF che aggiorna
- usa il bold delle risposte con criterio per me solo i nuomi dei posti devno essere in bold
- le lingue sono disonibili nel settings.json se non e' disponibile la lingua rispondi con la lingua di default che e' nel settings.json
- pulisci soluzione da file inutili o temporanei
- ripeto nessun accrocchio ma logica ben strutturata usa i guards bene usa la cache usa varibili nei prompt fai if con criterio ottimizza il codice usa il design pattners
- ricordati che lo scopo di questo chatbot e' di assistire l'utente durante la sua permanenza a sappada eventualmente inviando anche push pubblicitari e poi quando l'itente non e' a sappada inviare offerte eventi per una prossima vacanza

- attieniiti al contratto e fai un bel lavoro ! il dialogo deve essere fluido e naturale.

- le liste (piatti, ristoranti, punti di interesse) mostrano il nome in bold su una riga, poi la descrizione a capo — stesso formato degli itinerari

- abbiamo uno state fino a che non e' chiaro e pieno devi far domande
  per esempio abbiamo bambini? ok ma quant ianni? se lo state non c'e' questo dato lo chiedaiamo
  e cosi via per gli altri in modo intelligente e fluido chuediamo info fino a che lo state nnnon e' chiaro quando e' chiaro losalviamo e chiediamo della push notification e poi chiediamo dell'intinerari se lo vuole fare incronciando dati di meteo preferenze e eventi
