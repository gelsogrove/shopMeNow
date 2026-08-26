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
| ospite che scavalca la domanda | `holdRepeatedQuestion` + `repeatCooldownKey` (state.ts): il turno finisce sulla risposta, la stessa domanda torna quello dopo — turni tenuti e posti si alternano. | `demosappada-compose.spec.ts` — «me la chiedi 2 volte?» (2026-08-27) |
| «quando è chiaro lo salviamo» | Salvataggio forzato: se l'ospite ha risposto e il modello non ha chiamato `save_preferences`, un hop viene speso a imporlo; cattura deterministica delle risposte con FORMA (numeri anche in lettere, giorni, sì/no) nei campi giusti. | pin su sorgente in `demosappada-tools-from-db.spec.ts`; bug 2026-08-23/25 |
| «riempi le note», «tutti questi campi devono riempire il main prompt» | La scheda è derivata dai campi strutturati, mai il contrario; tutto entra nel main prompt come variabili risolte a runtime (`renderPromptVariables`), così il tenant decide DOVE atterrano. | — |
| push: consenso, «NO PUSH», tag | Revoca = comando pubblicato al consenso (`pushOptOutCommands` da settings), riconosciuta PRIMA di ogni altra guardia; la riga «puoi toglierti con NO PUSH» è prepesa da codice UNA volta nella vita (`pushOptOutHintSent` sul customer). Tag `INLOCO` derivato dalle date ogni turno, mai dal modello (`@shared/stay-inloco`, condiviso con lo scheduler). | bug: riga opt-out ripetuta (2026-08-25) |
| fine vacanza: feedback, rinnovo, pulizia note/itinerario | `isStayOverAndClosed` + `rolloverStay` (stay.ts): archivio in `pastStays`, note e itinerario azzerati, consenso e identità conservati. CODICE a inizio turno, mai un tool che il modello può dimenticare. | bug: profilo congelato sull'estate prima (2026-08-23) |
| «le liste non hanno mai video link o foto», «singolo caso mostra il video» | `withFaqMedia` (faq-media.ts): al massimo UN link, solo su risposta di dettaglio (vincitore netto per overlap IDF + nominato nella risposta), mai su lista. | `demosappada-faq-media.spec.ts` |
| «non inventare risposte!» | `OPERATING_RULES` + due guardie: `stripUnverifiableContacts` (URL/telefoni/orari/prezzi contro il contenuto approvato) e `stripInventedLists` (blocchi-lista non riscontrati). `get_weather` è l'unico modo di sapere il meteo; `save_itinerary` rifiuta un piano costruito senza averlo chiamato. | bug: menù inventato al celiaco (2026-08-25) |
| «usa la cache, ma la cache su meteo può essere pericolosa» | Cache meteo per sessione con chiave ORARIA nel fuso di Sappada (`sappadaHourKey`): dentro l'ora il testo resta vero, allo scatto si ricarica. Traduzioni del welcome cachate per processo. | bug: «pioggia fino alle 11» detto alle 11:20 (2026-08-25) |
| chiusura dell'itinerario (2026-08-27) | `itineraryJustSaved` + `applyItineraryClosing` (agent.ts) con `stripTrailingOffers` (intake-compose.ts): i paragrafi-offerta di coda («se avete domande, fatemelo sapere») vengono rimossi e la domanda configurata `itineraryClosingQuestion` è appesa da codice, una volta per vacanza (`closingQuestionAsked` sul customer, azzerato dal rollover). | `demosappada-compose.spec.ts` |

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
