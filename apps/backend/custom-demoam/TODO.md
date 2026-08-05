# TODO — custom-demoam

## Ora: far funzionare il chatbot, verificato dal vivo — non ancora la UI

Priorità di Andrea (2026-08-05): prima vedere che il chatbot rispetta il
contratto sui casi reali via CLI runner. La UI online per lanciare i test dal
backoffice è un passo successivo, non ancora deciso nei dettagli — vedi
sezione "Runner online" sotto, congelata finché il chatbot non è verificato.

## CLI runner — pronto, in uso

- `custom-demoam/cli/runtime.ts` — chiama `chatbotFn` in-process (mai
  WhatsApp), handler reali contro Prisma/Supabase (mai un DB locale — sempre
  `DATABASE_URL` da `heroku config:get -a echatbot-app`)
- `custom-demoam/cli/run-one.ts` — un turno singolo da riga di comando
- `custom-demoam/cli/run-scenarios.ts` — esegue gli scenari in
  `cli/scenarios/*.json`, uno alla volta (filtro per nome file) o tutti
- `custom-demoam/cli/scenarios/*.json` — 15 scenari (12 casi richiesti da
  Andrea + 3 di lingua), ognuno con `contractRule`: la riga esatta del
  CONTRACT.md che quello scenario verifica

Comando tipo:
```
DATABASE_URL="$(heroku config:get DATABASE_URL -a echatbot-app)" \
OPENROUTER_API_KEY="$(heroku config:get OPENROUTER_API_KEY -a echatbot-app)" \
npx tsx --tsconfig custom-demoam/tsconfig.json custom-demoam/cli/run-scenarios.ts <nome-scenario>
```

**Metodo confermato con Andrea**: uno scenario alla volta, mai tutti in
blocco. Se N fallisce, si corregge, poi si rilanciano N e tutti quelli prima
già confermati (non solo N isolato) prima di andare avanti.

## Stato dei 15 scenari (ultimo aggiornamento: 2026-08-05)

- ✅ 01-new-phone-number — PASS, riconfermato dopo fix welcome
- ✅ 02-existing-phone-number — PASS, riconfermato dopo fix remember/dictates_text
- ⏸️ 03-user-asks-question — visto passare nel run bulk (interrotto), da riconfermare isolato
- ✅ 04-user-has-a-problem — FAIL iniziale (escalation prematura, dati
  inventati `<UNKNOWN>`, `{{customerName}}` non sostituito) → corretto → PASS
- ⬜ 05-user-complains — non ancora testato isolato
- ⬜ 06-problem-present-in-flow — non ancora testato isolato dopo l'ultimo giro di fix
- ⬜ 07-problem-not-present-in-flow — non ancora testato
- ⬜ 08-flow-to-flow-handoff — non ancora testato
- ⬜ 09-serial-number-3-failed-attempts — non ancora testato
- ⏭️ 10-chatbot-disabled — skip strutturale (gate vive upstream nell'host, non testabile da qui)
- ⬜ 11-faq-no-answer — non ancora testato
- ⬜ 12-full-human-support-flow — non ancora testato
- ⬜ 13-language-english — non ancora testato
- ⬜ 14-language-spanish-not-enabled — non ancora testato
- ⬜ 15-language-unsupported-fallback — non ancora testato

## Bloccante attuale

`custom-demoam/prompts/common.md` era stato cancellato nella working tree
(non committato) — ripristinato da HEAD con `git checkout HEAD --`. Andrea
sta lavorando su modifiche a questo file non ancora pubblicate: **nessun test
va rilanciato finché non conferma il publish**, per non testare contro uno
stato del prompt che sta per cambiare sotto i piedi.

## Bug trovati e corretti oggi (tutti nel modulo, non nel runner)

1. Welcome mancante al primo turno — `awaitingDictatedReply` rilassava
   `tool_choice` ad `auto` invece di forzare solo testo; il saluto è ora un
   hop dedicato forzato a testo puro, prima del turno normale.
2. Root node del flow 001 saltato — stesso meccanismo, dopo `start_flow` il
   modello poteva chiamare `answer_step` con un'etichetta indovinata invece
   di scrivere la domanda dettata del nodo radice.
3. Escalation prematura + dati inventati (`<UNKNOWN>`) dopo il salvataggio
   del solo serial number — `remember` non segnalava `dictates_text` quando
   l'intake restava incompleto, lasciando il modello libero di chiamare
   `escalate_to_operator` invece di aspettare la domanda dettata successiva.
4. `{{customerName}}` non sostituito nel fallback di hand-off
   (`handoffFallback`) — mancava la stessa sostituzione già presente in
   `resolveGreetingText`.
5. Flow "Cables" (004/005/006) ricreati con contenuto reale sul filo
   perimetrale (prima avevano contenuto sbagliato: telecamera/mappa/sensore),
   categoria "Cables" separata da "Robotica".
6. Guard nuovo nel flow-compiler: `converging_edge_targets` — rifiuta un
   salvataggio dove due risposte diverse (Sì/No) portano allo stesso nodo,
   una domanda che non dirama davvero. Trovato prima nel flow 005, poi anche
   nel Human operator flow (nodi cut_schedule/battery, rimossi come nodi
   grafici, tornati intake testuale in gate.ts).
7. `humanSupportFlowId` mancava in `settings.json` — il flow esisteva nel DB
   (protetto, `isProtected: true`) ma il codice non sapeva quale fosse,
   quindi la Fase 2.5 di `escalate_to_operator` non si attivava mai.
8. Flow "Human operator flow" non raggiungibile dalla UI backoffice
   (categoria null, la pagina categorie non mostrava un bucket
   "uncategorized") — aggiunta riga sintetica in `FlowCategoriesPage.tsx`.

## Runner online (backoffice) — CONGELATO, non iniziare senza nuovo via libera

Andrea vuole poter lanciare i 15+ scenari da una pagina nel backoffice con
un bottone e vedere ✅/❌ per ciascuno invece di leggere output terminale.

**Nodo non risolto, discusso ma non deciso**: come si valida automaticamente
un PASS/FAIL quando la risposta è testo libero generato da un LLM?
- I check strutturali attuali (nessuna risposta vuota, nessun errore) sono
  affidabili ma DEBOLI — lo scenario 04 li superava (PASS) anche mentre il
  sistema inventava dati e mandava un'escalation rotta. Un'icona verde basata
  solo su questo sarebbe una falsa rassicurazione, lo stesso problema che ha
  fatto arrabbiare Andrea all'inizio della sessione.
- Opzioni sul tavolo, non ancora scelte: (a) più check strutturali sullo
  STATO del sistema — flow giusto attaccato, seriale salvato, escalation nel
  turno giusto, nessun placeholder tipo `{{` non sostituito nel testo — cosa
  affidabile ma non copre tutto; (b) un secondo LLM giudice che legge
  CONTRACT.md + trascrizione, più potente ma probabilistico anch'esso; (c)
  qualunque icona resta comunque un invito a leggere la trascrizione quando
  interessa, non un sostituto.

**Prossimo passo quando si riprende questo pezzo**: decidere con Andrea cosa
rende un check "abbastanza affidabile da mostrare come icona" prima di
scrivere endpoint/UI — è una domanda di design, non di codice.
