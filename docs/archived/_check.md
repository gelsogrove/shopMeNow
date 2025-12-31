> ⚠️ **ARCHIVED DOCUMENTATION**  
> This document contains obsolete checklists and Q&A from early development.  
> **Status**: Obsolete  
> **Date Archived**: December 31, 2025  
> **Current Documentation**: See [PRD.md](../PRD.md) for active specifications  
>
> ---

rispondi alla domande


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

- i prompt hanno esempi generici? funzionerebbero con altri prodotti ?

- fammi una tabella per vedere il risultato ma solo quelle cose che non vanno le cose che vanno non fammele vedere

---

## 🗑️ FEATURE 196 - SOFT DELETE SYSTEM CHECK

### Domande Critiche Soft-Delete:

- Se un utente si disiscrive ed è OWNER si disabilitano anche i suoi workspace? **SÌ ✅** (cascade completo)

- Se un utente si disiscrive ed è AGENTE si disabilitano i workspace? **NO ✅** (isolato)

- Se un utente si disiscrive ed è OPERATORE si disabilitano i workspace? **NO ✅** (isolato)

- Tutto quello che si può cancellare si può ripristinare? **SÌ ✅** (entro 90 giorni)

- Quando un utente si disiscrive blocchiamo il billing? **SÌ ✅** (deletedAt: null filter)

- Usiamo transazioni per cancellare? **SÌ ✅** ($transaction in tutti i metodi)

- Ordine FK rispettato? **SÌ ✅** (leaf → parent: Messages → Sessions → OrderItems → Orders → Customers → Workspaces → Users)

- Audit log salvato? **SÌ ✅** (SoftDeleteAuditLog per ogni operazione)

- Email notifica su disiscrizione? **SÌ ✅** (utente + CC admin)

- Scheduler hard-delete funziona? **SÌ ✅** (90 giorni retention, 23:20 daily)

### File Principali Feature 196:
- `apps/backend/src/services/user-unsubscribe.service.ts`
- `apps/backend/src/services/trash-restore.service.ts`
- `apps/scheduler/src/jobs/soft-delete-cleanup.job.ts`
- `apps/backend/src/interfaces/http/routes/trash.routes.ts`
- `apps/backoffice/src/pages/TrashPage.tsx`

### Sicurezza Implementata:
- ✅ Workspace isolation (workspaceId check su ogni query)
- ✅ 3-layer middleware (auth → loginBlocking → requirePlatformAdmin)
- ✅ Retention window 90 giorni
- ✅ Popup conferma "DELETE" / "PERMANENTLY DELETE"
- ✅ Full logout dopo delete account/workspace
- ✅ Billing stops per workspace soft-deleted

---

## 💰 FEATURE 197 - BILLING SUBSCRIPTION SEPARATION CHECK

### Domande Critiche Subscription:

- Subscription €19 separato dal Credit Wallet? **SÌ ✅** (planType + creditBalance separati)

- Credit può andare negativo fino a -€10? **SÌ ✅** (CREDIT_MIN_THRESHOLD = -10)

- Silent block quando credit < -€10? **SÌ ✅** (WorkspaceAccessService.canProcessMessages)

- Silent block quando subscriptionStatus = PAUSED? **SÌ ✅**

- Silent block quando subscriptionStatus = PAYMENT_FAILED? **SÌ ✅**

- WIP message SOLO per channelStatus=false? **SÌ ✅** (non per billing issues)

- Pause diventa effettiva il 1° del mese prossimo? **SÌ ✅** (PAUSE_PENDING → PAUSED)

- Downgrade effettivo il 1° del mese prossimo? **SÌ ✅** (pendingPlanType + pendingPlanEffectiveDate)

- Payment mock implementato? **SÌ ✅** (processPayment returns { success: true })

- Monthly billing job nel seed? **SÌ ✅** (schedulerJobStatus.monthly-billing.isActive=true)

- Job può essere disattivato? **SÌ ✅** (isActive flag in SchedulerJobStatus)

- Backoffice mostra subscriptionStatus? **SÌ ✅** (ClientsPage badge PAUSED/PAYMENT_FAILED)

### File Principali Feature 197:
- `apps/backend/src/application/services/workspace-access.service.ts`
- `apps/backend/src/application/services/subscription-billing.service.ts`
- `apps/scheduler/src/jobs/monthly-billing.job.ts`
- `apps/backend/src/interfaces/http/controllers/subscription-billing.controller.ts`
- `apps/frontend/src/components/billing/SubscriptionStatusCard.tsx`
- `specs/197-billing-subscription-separation/spec.md`

### Sicurezza Implementata:
- ✅ Workspace isolation (workspaceId in all billing queries)
- ✅ Owner-only for pause/resume/downgrade (requireOwnerForBilling middleware)
- ✅ Silent block - no message sent, no history saved
- ✅ Concurrent safety (Prisma transactions)

### Test Coverage:
- ✅ 31 tests WorkspaceAccessService
- ✅ 57 tests SubscriptionBillingService
- ✅ 6 tests monthly-billing.job (PAUSE_PENDING, downgrade, charge)



MODELLO DI PAGAMENTO eChatbot
Sistema a credito prepagato con fatturazione mensile.

Come funziona:
Inizi con FREE TRIAL (14 giorni)

Hai 14 giorni per provare la piattaforma
Dopo 14 giorni: se non ricarichi, il servizio si blocca
Prima ricarica = Upgrade automatico a BASIC

Quando fai la prima ricarica, passi automaticamente al piano BASIC
Il credito viene aggiunto al tuo saldo
Il credito scala ad ogni operazione

Ogni messaggio WhatsApp inviato/ricevuto scala dal credito
Ogni ordine processato scala dal credito
Ogni notifica push scala dal credito
Fattura mensile il 1° del mese

Il 1° di ogni mese ricevi la fattura del mese PRECEDENTE
La fattura include: costo piano + ricariche fatte nel mese precedente
Esempio: il 1° Novembre ricevi fattura di Ottobre
Soglia minima: -€10

Puoi andare in negativo fino a -€10
Sotto -€10 → account bloccato, devi ricaricare
Un owner, più canali, una fattura

Puoi avere più canali WhatsApp (workspaces)
Il credito è condiviso tra tutti i canali
Ricevi UNA sola fattura per tutto
Upgrade/Downgrade

Puoi cambiare piano quando vuoi
Upgrade: effetto immediato
Downgrade: devi prima ridurre prodotti/clienti/canali se superi i limiti
In sintesi: Ricarichi credito → il credito scala con l'uso → ogni mese ricevi fattura riepilogativa.


TUTTO QUELLO CHE HO SCRITTO E? VERO? 
CI SONO I TEST CHE COPRONO?



dobbiamo aggiungere quaclosa al gitignore?

trova nel codice un putno sia di BE che di FE che possiamo ottimizzare
magari possiamo evitare di duplicare codice, uniformare creareo un componente di grafica comdiviso, togliere codice morto trova qualche miglioramente da fare ma 1 di Fe e 1 di BE
