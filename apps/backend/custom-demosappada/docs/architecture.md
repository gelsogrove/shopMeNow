# custom-demosappada — architettura

Come le regole di `contratto.md` sono garantite dal codice. Il contratto è la
voce di Andrea e non si tocca (CLAUDE.md §16B); questo file documenta il COME e
va tenuto allineato al codice, come `flow-runtime.md` per demorobot.

Principio unico (CLAUDE.md §16, iron rule 1): il modello scrive la prosa e
legge le sfumature; ogni **garanzia** è codice deterministico che gira prima o
dopo di lui. Quando una regola viene violata dal vivo, la correzione è un
guard, mai un'altra frase nel prompt.

## Layout dei file (dopo lo split del 2026-08-27)

| File | Responsabilità |
|---|---|
| `agent.ts` | Il turno: guardie pre-LLM, prompt assembly, hop loop, dispatch dei tool, uscita. Superficie pubblica del modulo (re-esporta ciò che ha sempre esportato). |
| `intake-machine.ts` | LA tabella dell'intake: quale domanda tocca adesso. Pura, un'unica autorità (`nextIntakeStep`) per coda e guard. |
| `intake-compose.ts` | Come si CHIUDE il turno: una domanda sola (la nostra), risposta dell'ospite prima, domande inventate/filler strippati, cooldown di ripetizione. |
| `stay.ts` | Ciclo di vita della vacanza: rollover a fine vacanza, giorni rimanenti, tag campagne, blocco «QUESTO OSPITE» che detta la domanda al modello. |
| `faq-media.ts` | Selezione FAQ a budget e regola media: overlap di argomento (IDF), mai frasi/intenti. |
| `language-guards.ts` | Lingua: saluto d'apertura inequivocabile, strip del saluto del modello, riparazione «risposta nella lingua sbagliata». |
| `welcome.ts` | Welcome/welcome-back: traduzione cachata, `{{customerName}}`, `{{firstQuestion}}`, video di presentazione. |
| `content-guards.ts` | Anti-invenzione su fatti puntuali: URL, telefoni, orari, prezzi verificati contro il contenuto approvato. |
| `intake-question.ts` | Come la domanda dettata viene RESA: il codice la spezza in frasi ed elenca i fatti noti; il modello risponde SOLO in JSON quale frase è risposta da quale fatto; il codice cancella quelle frasi e traduce il resto. Il modello non scrive una parola. |
| `party-parse.ts` | `parseParty`: chi c'è nel gruppo letto dal CODICE dalle parole dell'ospite — cifre, parole-numero, categorie (bambini/adulti/anziani), «coppia» e i nomi delle persone («io e mio marito», «my wife and I», «con la nonna»). Vocabolari chiusi, puro, testato da solo. |
| `provenance.ts` | Provenienza dei numeri del gruppo: `quoteAnchoredIn` (la citazione `partySaidAs` deve esistere nel messaggio, stesso contratto di `dateSaidAs`), `rulesOutParty` / `isRuleOutOnly` (un «no» a una domanda sul gruppo vale 0 bambini / 0 anziani senza bisogno di un numero). |
| `llm.ts` | Client OpenRouter e forme dei messaggi. Niente logica di dominio. |
| `state.ts` | Stato per-sessione in RAM + idrata/deidrata su `ChatSession.context`; trailer `⟦LANG:xx⟧`. |
| `weather.ts` | Open-Meteo per Sappada; `TIMEZONE`. Cache oraria in `agent.ts`. |
| `tools.manifest.ts` | Gli schemi dei 7 tool built-in, seedati come righe DB switchabili dal backoffice. |
| `bounds.ts` | I limiti di meccanismo (hop, staleness del welcome-back), in un posto solo. |

`runTurn` in agent.ts resta lungo di proposito: è la sequenza del turno, e
spezzarla in funzioni che si passano venti variabili locali sarebbe l'accrocchio.
Gli helper coesi sono fuori; la sequenza si legge dall'alto in basso.

## Regola del contratto → meccanismo → test

| Contratto | Meccanismo (codice, non prompt) | Test / origine |
|---|---|---|
| «il primo messaggio deve essere il welcome o il welcome back» | `resolveGreeting` (state.ts): deciso da CODICE su history + `hasWrittenBefore` del profilo; `withWelcome` (welcome.ts) lo prepone alla risposta del modello, il cui saluto improvvisato viene strippato per forma (`stripLeadingGreeting`). | `demosappada-language.spec.ts` — bug: nome dal form ⇒ finto returning (2026-08-23) |
| «prima deve riconoscere la lingua e poi rispondere con la lingua del cliente» | Il modello dichiara con `⟦LANG:xx⟧` (mai regex di intento, §14); `greetingLanguage` decide da CODICE quando l'apertura è inequivocabile e batte il seed del browser; `looksLikeWrongLanguage`+`translateText` riparano la risposta uscita nella lingua sbagliata, anche sul percorso hop-esauriti. | `demosappada-language.spec.ts` — bug: «CIAO PIACERE VOGLIAMO VEDERE SAPPADA» risposto in spagnolo (2026-08-27) |
| «abbiamo uno state: fino a che non è chiaro e pieno devi far domande» | Pipeline stretta in `intake-machine.ts`: il primo step non soddisfatto È la domanda, e resta tale finché non risposto. Un fatto offerto spontaneamente ritira lo step senza che la domanda sia mai posta (`satisfiedBy` prima di `asked`). | `demosappada-intake-machine.spec.ts` |
| «Siete già a Sappada?» — i tre casi (in loco / pianificata / remoto) | Step `location` in testa alla tabella; ramo `remote` salta ogni domanda di soggiorno (`relevantWhen: isRemote`) e pone la sola `remoteNeeds`; `planned` segue il flusso standard. Tag `NO-A-SAPPADA` da codice. | `demosappada-intake-machine.spec.ts` |
| «una alla volta le domande», wording dettato | La domanda è DETTATA da settings (`intakeQuestions`), mai composta dal modello; `composeIntakeTurn` (intake-compose.ts) garantisce: una sola domanda, la nostra, in coda; su turno senza richiesta dell'ospite la domanda È il messaggio. | `demosappada-compose.spec.ts` — bug: tre domande in lista numerata (2026-08-24) |
| «se dico io e mio marito devi capire che sono 2 persone e non ci sono bambini» (2026-08-28) | Il party-guard di `save_preferences` (agent.ts) rifiuta adults/children/seniors senza provenienza: un numero nel messaggio (`parseParty`) OPPURE `partySaidAs` — le parole esatte dell'ospite che nominano il gruppo, verificate con `quoteAnchoredIn` (provenance.ts). Il modello legge il significato, il codice controlla solo che la citazione sia stata scritta (§14). Il manifest chiede `children: 0` nella stessa chiamata quando nessun bambino è nominato. | `demosappada-provenance.spec.ts` — bug live: «io e mio marito siamo a sappada» → «E in quanti siete?» (il guard scartava l'`adults: 2` corretto del modello) |
| «no nessuna» alla domanda `constraints` → non richiedere «Ci sono bambini o anziani?» (2026-08-28, 14:40) | Il wording di `constraints` (settings, tenant) chiede ANCHE di bambini/anziani, ma la machine tiene `composition` come step a sé: contenuto e meccanismo divergevano. Ora la cattura deterministica del «no» (`rulesOutParty`) azzera children/seniors anche sul turno `constraints`, e il party-guard accetta gli zeri del modello (`isRuleOutOnly`) sui turni che hanno chiesto del gruppo (`partyTurn`, gemello di `dateTurn`). Un conteggio positivo richiede ancora cifra o `partySaidAs`. | `demosappada-provenance.spec.ts` — bug live: «no nessuna» → «Ci sono bambini o anziani?» |
| «non posso farti 1000 casi: se hai già la info non la devi più richiedere» (2026-08-28) | `partyKnown` in `intake-machine.ts`: QUALSIASI conteggio (adults, children o seniors) chiude `party` e `headcount` e rende rilevante `stay`. «siamo due anziani» riempie `seniors` e non `adults`; letto su `adults` soltanto, il machine richiedeva «E in quanti siete?». Regola generale, non lista di frasi: ciò che manca (gli adulti «semplici») è inferenza del modello, mai una domanda ripetuta. | `demosappada-intake-machine.spec.ts` — «siamo due anziani» → prossimo step `stay`, non `headcount` |
| «se ti dico siamo senza macchina non puoi chiedermi 'Sarete senza macchina?' — è il minimo che un utente si aspetta» (2026-08-28) | `renderIntakeQuestion` (intake-question.ts) in entrambi i punti in cui la domanda va al composer: `splitSentences` + `knownFacts` (codice) → il modello restituisce `[{sentence, fact}]` → `parseDrops` accetta solo coppie che puntano a una frase E a un fatto reali, mai tutte le frasi → il codice cancella e POI traduce (`translateWelcome`, cache). Il modello sceglie, il codice edita: la prima versione lo lasciava riscrivere e gpt-4o-mini ha tolto «Sarete senza macchina?» senza saper nulla dell'auto (sim, 2026-08-28). Nessuna chiamata extra a state vuoto o con domanda di una sola frase. | `demosappada-intake-question.spec.ts` — bug live: «no nessuna» / «senza macchina» e la domanda `constraints` riletta per intero |
| «sono domande che puoi gestire?» — albergo economico, rifugio con funivia, mangiare tipico, gruppo in pullman (sim 2026-08-28) | Quattro guardie in più, tutte lato bot: (0) sul retry «messaggio ignorato» l'hop successivo offre SOLO i tool di contenuto con `tool_choice: required` (llm.ts `CallOptions`): il modello deve recuperare dati, non può scrivere altro filler; (1) `contentFetched` — se il modello ha chiamato un tool di contenuto (meteo, alloggi, webhook) il turno È una risposta (`classifyTurn`), qualunque forma abbia il messaggio: «cerchiamo un rifugio con funivia» perdeva la lista appena recuperata; (2) `stripOfferParagraphs` (intake-compose.ts) — i paragrafi di sola offerta («fammi sapere!») non escono mai in intake; (3) `withinQuoteAnchoredCap` + `membersAnchored` (provenance.ts) — senza numero nel messaggio, il conteggio passa solo se il modello ELENCA le persone (`partyMembers`, una voce ciascuna, ognuna ancorata alle parole del cliente), il totale coincide ed è ≤ 3: «un gruppo di persone» aveva prodotto `adults 5`, «cerchiamo un albergo» `adults 2` da un verbo plurale. Sopra il tetto o senza elenco il tool rifiuta e il numero viene CHIESTO. Un gruppo elencato per intero senza bambini/anziani nominati → `children 0, seniors 0` messi dal codice; (4) `parseParty` non legge più «un/una/one» come numero se non è seguito da una categoria o da un giorno («un gruppo» valeva 1 adulto); (5) il retry «messaggio ignorato» estende il budget di hop di 2 (uno per il tool, uno per la prosa): prima cadeva sull'ultimo hop e il tool forzato non partiva mai. | `demosappada-compose.spec.ts`, `demosappada-provenance.spec.ts` |
| «sbagliato! ancora» — live 15:44, 2026-08-28: «io e mip marito…» → «E in quanti siete?» | Il modello di produzione ha salvato `adults 2` SENZA `partySaidAs`/`partyMembers`; il guard ha rifiutato (log Heroku: «quote missing, members anchored 0/2»). Dipendere dai campi che il modello decide di mandare è la dipendenza probabilistica che il contratto rifiuta: ora `parseParty` (party-parse.ts) conta da solo le persone NOMINATE — «io e mio marito» = 2 adulti, 0 bambini, 0 anziani (`enumerated`) — e la cattura deterministica le scrive nello state su QUALSIASI turno (anche il primo, dove la domanda pendente è `location`), mai sopra un conteggio già presente. I numeri del modello, se arrivano, sono ancorati dallo stesso conteggio. Plurali senza numero («i figli», «un gruppo») non dicono quanti: nulla. | `demosappada-party-parse.spec.ts` |
| «non avevamo detto di fare la domanda 'permettimi di farti delle domande per…'?» (2026-08-28) | `settings.intakeIntro` (contenuto, DB → `customChatbotAdvancedSettings.intakeIntro`): una riga anteposta dal codice alla PRIMA domanda di intake del soggiorno, tradotta come le domande, segnata con `intakeIntroSent` sul profilo (azzerato dal rollover). Senza la chiave configurata non esce nulla (§1A: silenzio, non inglese). | — meccanismo: agent.ts `introDue` |
| ospite che scavalca la domanda | `holdRepeatedQuestion` + `repeatCooldownKey` (state.ts): il turno finisce sulla risposta, la stessa domanda torna quello dopo — turni tenuti e posti si alternano. | `demosappada-compose.spec.ts` — «me la chiedi 2 volte?» (2026-08-27) |
| «rispondi all'utente e POI chiedi quello che ti serve» — sempre, senza eccezioni | `classifyTurn` (intake-compose.ts): UN'unica autorità decide se il turno è `answer` (l'ospite ha portato contenuto → risposta prima, la nostra domanda in coda) o `advance` (ha solo risposto alla domanda → la prossima domanda È il messaggio). Guard di sostanza (`replyLacksSubstance` — anche una risposta fatta di sole domande o solo ack+filler è vuota), composer e fallback leggono TUTTI questo verdetto: prima ognuno votava con segnali propri e divergevano. `pendingRequest` sul profilo porta la richiesta non ancora servita ATTRAVERSO i turni (blocco RICHIESTA IN SOSPESO nel prompt, sentinella `RISOLTO` per chiuderla). | `demosappada-compose.spec.ts` — 4 bug live in un giorno (2026-08-28: escursione ignorata ×3, «com'è il tempo?» risposto con un ack, «cerchiamo un albergo» archiviato come vincolo) |
| «quando è chiaro lo salviamo» | Salvataggio forzato: se l'ospite ha risposto e il modello non ha chiamato `save_preferences`, un hop viene speso a imporlo; cattura deterministica delle risposte con FORMA (numeri anche in lettere, giorni, sì/no) nei campi giusti. | pin su sorgente in `demosappada-tools-from-db.spec.ts`; bug 2026-08-23/25 |
| «riempi le note», «tutti questi campi devono riempire il main prompt» | La scheda è derivata dai campi strutturati, mai il contrario; tutto entra nel main prompt come variabili risolte a runtime (`renderPromptVariables`), così il tenant decide DOVE atterrano. | — |
| push: consenso, «NO PUSH», tag | Revoca = comando pubblicato al consenso (`pushOptOutCommands` da settings), riconosciuta PRIMA di ogni altra guardia; la riga «puoi toglierti con NO PUSH» è prepesa da codice UNA volta nella vita (`pushOptOutHintSent` sul customer). Tag `INLOCO` derivato dalle date ogni turno, mai dal modello (`@shared/stay-inloco`, condiviso con lo scheduler). | bug: riga opt-out ripetuta (2026-08-25) |
| fine vacanza: feedback, rinnovo, pulizia note/itinerario | `isStayOverAndClosed` + `rolloverStay` (stay.ts): archivio in `pastStays`, note e itinerario azzerati, consenso e identità conservati. CODICE a inizio turno, mai un tool che il modello può dimenticare. | bug: profilo congelato sull'estate prima (2026-08-23) |
| «le liste non hanno mai video link o foto», «singolo caso mostra il video» | `withFaqMedia` (faq-media.ts): al massimo UN link, solo su risposta di dettaglio (vincitore netto per overlap IDF + nominato nella risposta), mai su lista. | `demosappada-faq-media.spec.ts` |
| «non inventare risposte!» | `OPERATING_RULES` + due guardie: `stripUnverifiableContacts` (URL/telefoni/orari/prezzi contro il contenuto approvato) e `stripInventedLists` (blocchi-lista non riscontrati). `get_weather` è l'unico modo di sapere il meteo; `save_itinerary` rifiuta un piano costruito senza averlo chiamato. | bug: menù inventato al celiaco (2026-08-25) |
| «usa la cache, ma la cache su meteo può essere pericolosa» | Cache meteo per sessione con chiave ORARIA nel fuso di Sappada (`sappadaHourKey`): dentro l'ora il testo resta vero, allo scatto si ricarica. Traduzioni del welcome cachate per processo. | bug: «pioggia fino alle 11» detto alle 11:20 (2026-08-25) |
| chiusura dell'itinerario (2026-08-27) | `itineraryJustSaved` + `applyItineraryClosing` (agent.ts) con `stripTrailingOffers` (intake-compose.ts): i paragrafi-offerta di coda («se avete domande, fatemelo sapere») vengono rimossi e la domanda configurata `itineraryClosingQuestion` è appesa da codice, una volta per vacanza (`closingQuestionAsked` sul customer, azzerato dal rollover). | `demosappada-compose.spec.ts` |
| niente prezzi per gli alloggi (2026-08-27) | `formatCatalogue` non rende il `price` del DB: fuori dal blocco è fuori anche da `approvedContent`, quindi un prezzo inventato per una struttura viene STRIPPATO dal guard di content-guards invece che approvato. La struttura fa il suo prezzo quando l'ospite chiama. | `demosappada-no-invented-prices.spec.ts` — «NON METTERE PREZZO INDICATIVO! QUI STAI INVENTANDO» |
| «altri hotel?» non ripete le stesse strutture (2026-08-27) | `accommodationShown` in sessione (state.ts): `check_accommodation` offre al modello SOLO le strutture non ancora viste; a catalogo esaurito risponde con l'istruzione onesta «sono tutte quelle in scheda» + rimando al sito. Come «vista» conta solo la struttura il cui nome è nella risposta FINALE (`recordShownAccommodations`, su entrambi i percorsi di uscita). | `demosappada-accommodation-dedup.spec.ts` — «chiedo altri hotel e mi ridai gli stessi» |

## Cosa resta probabilistico (per scelta)

- La **prosa** delle risposte e la combinazione meteo × preferenze × FAQ: è il
  lavoro del modello, il prompt lo orienta ma nessun guard lo sostituisce.
- La lettura delle sfumature di `presence` (in loco / pianificata / remoto):
  salva il modello via `save_preferences`; il sì/no secco alla domanda ha un
  backstop deterministico nella cattura.
- Le domande a risposta libera (vincoli, interessi): nessuna forma da
  riconoscere, quindi nessuna cattura — solo il salvataggio forzato.

## Config: chiavi non ovvie

- `intakeQuestions` — il wording di ogni step, una lingua sola, il modello traduce.
- `closingLine` — chiusura del turno che chiude l'intake.
- `itineraryClosingQuestion` — chiusura del messaggio-itinerario (es. «Vuoi
  consigli su dove andare a mangiare prodotti tipici locali?»). Senza
  configurazione non viene appeso nulla (§1A: mai inglese hardcodeato).
- `pushOptOutHint` / `pushOptOutCommands` — la promessa e le parole che la onorano, insieme.

`settings.json` è GENERATO dall'app (CLAUDE.md §1D): le chiavi si cambiano dal
backoffice, mai a mano nel file.
