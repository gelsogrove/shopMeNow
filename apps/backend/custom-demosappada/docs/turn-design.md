# Il turno — design "il modello capisce, il codice decide"

Stato: **IMPLEMENTATO** (`turn.ts`, `understand.ts`, `date-parse.ts`; 2026-08-28). Default in produzione; il vecchio loop resta in `agent.ts` come fallback (`turnEngine: 'v1'`) per una release.
Scenari di accettazione A–D passati su Haiku 4.5 via OpenRouter (log nel commit).
Sostituisce lo strato di guardie/retry di `agent.ts`; non cambia una riga di
`contratto.md`, che resta la specifica.

## Perché

Oggi una chiamata al modello fa quattro cose insieme: capire i fatti del
cliente, rispondere alla sua domanda, fare la domanda di intake, salvare lo
state "se si ricorda". Dietro ognuna c'è una guardia che ripara il sintomo con
una nota in conversazione e un retry. Ogni modello nuovo reagisce alle note in
modo diverso (Haiku 4.5, 2026-08-28: risposte alla nota spedite al cliente,
risposte vuote, consenso chiesto due volte). Il pattern di riferimento del
settore (Rasa CALM; Anthropic "Building effective agents"; state machine +
LLM) è l'opposto: **il modello emette comandi, il codice decide e compone**.

## Il turno, in quattro passi

```
messaggio ──► 1. COMPRENSIONE ──► 2. DECISIONE ──► 3. RISPOSTA ──► 4. COMPOSIZIONE ──► reply
              (LLM, comandi)      (codice)         (LLM, solo se     (codice, template)
                                                    c'è una richiesta)
```

### 1. Comprensione — una chiamata, risposta obbligata nello schema

Prompt corto: regole operative, **scheda ospite** (state), **storico** (30
messaggi), ultimo messaggio. Niente FAQ, niente catalogo. Il modello DEVE
chiamare il tool `understand` (`tool_choice` forzato): non può scrivere prosa,
quindi non può far trapelare nulla. Schema:

| campo | contenuto | validazione (codice) |
|---|---|---|
| `slots` | `adults, children, seniors, childrenAges, arrivalDate, departureDate, presence, constraints, interests, origin, name, consent, itinerary, doneAlready, transport, diet, pets…` (le chiavi le decide il tenant nel DB: stato dinamico chiuso) | provenienza come oggi: numeri (`party-parse`, `partyMembers`), date (`dateSaidAs`), enum per `presence`/`consent`/`itinerary`; chiavi ignote scartate |
| `request` | cosa il cliente ha chiesto, con le sue parole, o vuoto | testo libero; vuoto = nessuna risposta da scrivere |
| `chitchat` | true se il messaggio è saluto/convenevole senza richiesta | bool |
| `opt_out` | true se chiede di non ricevere più messaggi | bool → `savePushConsent(false)` |
| `language` | ISO del messaggio | validato contro `enabledLanguages` |

Il modello legge lo **storico intero**: "io e mio marito" detto due turni fa
riempie `adults` ora, se non era già stato salvato. Le catture deterministiche
(`parseParty`, giorno della settimana, sì/no) restano come **rete sotto**: se
il modello non emette lo slot, il codice lo legge dall'ultimo messaggio.

### 2. Decisione — codice puro, già esistente

`applySlots` (provenienza) → `nextIntakeStep` (intake-machine.ts) → domanda
dettata → `renderIntakeQuestion` (toglie le frasi già risposte). Niente di
nuovo: è il pezzo sano di oggi.

### 3. Risposta — solo se `request` non è vuoto

Seconda chiamata: FAQ del turno, catalogo, meteo, tool di contenuto
(`get_weather`, `check_accommodation`, webhook del tenant). Il modello scrive
**solo la risposta**: il prompt non contiene l'intake, non sa che esiste una
domanda da fare, non può farne. Content-guard come oggi (URL, telefoni, orari,
prezzi, fasce, liste inventate). Se la risposta esce vuota → riga configurata
"non ho il dato, InfoPoint" (settings, §1A), nessun retry.

### 4. Composizione — template

`[saluto/benvenuto] + [risposta] + [intro intake, una volta] + [domanda dettata]`
con le regole di `intake-compose.ts` (una domanda sola, la nostra). Un "si"
alla domanda del consenso produce **zero** chiamate di prosa: comprensione →
state → prossima domanda dal template.

## Cosa il codice garantisce (per costruzione)

- Nessun testo del modello raggiunge il cliente se non è la risposta a una
  richiesta: il passo 1 non produce prosa, il passo 3 non conosce l'intake.
- Mai richiedere un dato presente nello state (state machine).
- Mai una risposta vuota: template.
- Mai un numero/data inventato: provenienza.
- Mai la stessa domanda due volte nello stesso turno: la memoria è UNA
  (`state`), aggiornata dal passo 1 prima del passo 2.

## Cosa sparisce da `agent.ts`

Le note `[SYSTEM]` e tutti i retry (salva-forzato, vuoto, sostanza, esempi,
meteo), `pendingRequest` portato dal codice, `classifyTurn` sul "?",
`droppedQuestionRetryDone`/`forceContentTool`/`extraHops`, il loop di hop a
budget. Il meteo: il passo 3 lo chiama quando serve (tool); se propone
attività senza averlo chiamato, il codice **non** ritenta — aggiunge la
previsione da `weather.ts` in una riga template. Circa 1.500 righe in meno.

## Cosa resta com'è

`intake-machine.ts`, `intake-compose.ts`, `intake-question.ts`,
`party-parse.ts`, `provenance.ts`, `content-guards.ts`, `language-guards.ts`,
`welcome.ts`, `weather.ts`, `stay.ts`, `faq-media.ts`, `tools.manifest.ts`
(+ il tool `understand`), `llm.ts` (cache, `tool_choice`), e i loro test.

## Costo

Oggi: 2–4 chiamate da ~29k token a turno. Domani: passo 1 ≈ 4–5k token
(niente FAQ), passo 3 solo quando c'è una richiesta. Turno di solo intake:
**una** chiamata piccola. Turno con richiesta: due, la seconda con cache.

## Ordine di lavoro

1. Tool `understand` + `applySlots` (riuso provenienza) + test unitari.
2. Nuovo `turn.ts` (passi 1–4) accanto ad `agent.ts`; `agent.ts` resta
   l'entry point e delega. Il vecchio loop non si tocca finché il nuovo non
   passa gli scenari.
3. Scenari nel simulatore, **uno per volta, ognuno approvato con il costo**:
   a. "io e mio marito vogliamo vedere Sappada e non abbiamo la macchina" → si
      → fino a domenica → no nessuna → si (consenso) → nome → itinerario
   b. "hola que tal?" → si, hasta el domingo
   c. "cerchiamo un albergo e vogliamo spendere poco"
   d. "dove devo buttare la pattumiera" a intake finito
4. Switch: `agent.ts` usa `turn.ts`; il vecchio loop viene rimosso nello
   stesso commit dei test verdi. Deploy.
5. `architecture.md` aggiornato riga per riga.

Stima: 2–3 giorni. Nessuna prova a pagamento senza OK esplicito (CLAUDE.md §16B).
