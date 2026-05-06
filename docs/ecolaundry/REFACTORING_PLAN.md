# Piano di refactoring `handleTurn` — ecolaundry

**Stato**: proposta da approvare prima di toccare codice.
**Owner**: Andrea
**Scopo**: ridurre la fragilità di `chatbot.ts handleTurn()` (1235 righe, ~25 guard sovrapposti), garantire ordine deterministico, rendere ogni regressione tracciabile.

**Documenti collegati (da leggere prima di partire)**:
- [`CANONICAL_FLOWS.md`](./CANONICAL_FLOWS.md) — sequenze di domande estratte dalla doc (01usecaases.md + 02reglas.md). Sorgente di verità per validare ogni dialog.
- [`HARDCODING_RULES.md`](./HARDCODING_RULES.md) — 5 regole vincolanti sull'uso delle regex hardcoded.
- [`ROADMAP.md`](./ROADMAP.md) — vista di prodotto, Step A/B/C.

---

## 1. Problema attuale

`handleTurn()` è un solo grande function che, in ordine, chiama ~25 blocchi di guard. Ognuno è una `if (cond) { ...; return }` con condizioni complesse. Quando si aggiunge un caso:

- una nuova `return` precoce maschera guard successivi → bug silenziosi (Mataró)
- una condizione mancata fa cadere nel router LLM → comportamento non deterministico
- non si sa **quale guard ha vinto** in un turno senza loggare manualmente
- ogni nuovo bug si fixa appiccicando un altro guard, peggiorando la fragilità

## 2. Obiettivo

Suddividere `handleTurn()` in **fasi numerate**, ognuna in un modulo separato. Ogni fase produce un `Decision` strutturato (ritorna direttamente la reply, oppure passa). Il debug trace mostra **quale fase ha deciso e perché**.

Niente cambiamenti di logica nel primo passo: **solo riorganizzazione**. Test usecase (32/32) devono passare uguali. Solo dopo si interviene sui bug funzionali.

## 2-bis. Principio di transversal context-switching (CRITICO)

> L'utente può cambiare argomento in **qualunque momento**: non possiamo presumere che resti dentro un flusso una volta entrato.

Esempi di salti reali da supportare:

- Cliente in **flusso troubleshooting alarm** → fa una FAQ ("a che ora chiudete?") → torna al troubleshooting
- Cliente in **flusso doble-cobro** → cambia idea ("anzi è un altro problema, la lavatrice non parte")
- Cliente in **flusso loyalty card** → "no aspetta prima dimmi quanto costa"
- Cliente sta dando il **nome** durante l'escalation → "no aspetta non chiamate l'operatore, ho risolto"
- Cliente ha già la **location/machine** noti → fa una **nuova** segnalazione: i fatti restano sticky
- Cliente cambia **lingua** a metà ("hablemos en italiano") → tutte le risposte successive in IT

Regole non negoziabili:

1. **Sticky facts**: `location`, `locationStreet`, `machineType`, `machineNumber`, `displayState`, `paymentCompleted`, `language` non si cancellano mai per "sicurezza". Si sovrascrivono solo se il cliente esplicitamente li smentisce.

2. **Pause/resume universale**: ogni fase che entra in un sotto-flusso (FAQ, double-charge, photo path, name capture) deve poter essere **interrotta** da un nuovo intent e **ripresa** quando il cliente torna sul tema. Lo state ha già `pausedFlow`, va esteso anche a `pausedFaq`, `pausedNameCapture`, ecc.

3. **Detection sempre attiva**: P6 (FAQ multi-turn) e P7 (FAQ detect) **non possono** essere bypassate da P15 (specialist+flow). Anche dentro un flow attivo, una FAQ pura ("a che ora aprite?") deve essere riconosciuta, servita, e poi riprendere il flow.

4. **Topic switch detection**: il Router LLM deve classificare ogni turno in `{ continue, switch_to_other_problem, switch_to_faq, abandon }`. Lo stato gli passa il flow attivo come contesto. Quando rileva uno switch:
   - SWITCH → salva `pausedFlow`, marca lo stato, esegui il nuovo intent
   - ABANDON → chiede "vuoi davvero abbandonare X? sì/no" prima di pulire

5. **Reset volontario**: l'unico modo per cancellare i fatti è il messaggio esplicito di reset (`/reset`, "ricomincia", "altro caso"). Mai automaticamente.

6. **No keyword-detection per il topic-switch**: il riconoscimento del cambio topic è **sempre** del Router LLM, mai regex su parole italiane/spagnole. Per principio progetto.

Implementazione:

- Lo `state` ha tre slot di pausa: `pausedFlow`, `pausedFaq`, `pausedNameCapture`.
- Una nuova fase **P0.5 topicSwitchDetect** legge la routerDecision (o un classifier LLM dedicato) e gestisce i salvataggi/ripristini di stato prima delle fasi di gather.
- Le fasi di gather (P10/P11) si rifiutano di sovrascrivere uno sticky fact senza esplicita conferma del cliente (es: "Mi dicevi Goya prima, ora è Pineda. È giusto?").

Test di accettazione (oltre i 32 usecase):

- **TS-1**: cliente in flow case_alm dice "a che ora aprite?" → bot risponde all'orario, poi riprende l'ALM dal punto in cui era
- **TS-2**: cliente fornisce location Goya, machineType washer, machineNumber 4, poi "no aspetta è la 5" → state.machineNumber diventa 5 senza ripartire da zero
- **TS-3**: cliente in escalation chiamata "Andrea" → bot conferma → cliente dice "no aspetta ho risolto" → bot esce dall'escalation pulitamente
- **TS-4**: cliente cambia lingua a metà → tutte le risposte successive nella nuova lingua, sticky facts intatti
- **TS-5**: cliente fa 3 FAQ consecutive a metà di un flow ALM → ognuna risposta correttamente, poi un "torniamo all'allarme" riprende il flow dal check_result

## 3. Architettura target

```
handleTurn(runtime, state, userMessage)
   │
   ▼
┌──────────────────────────────────────────────────────────┐
│ Phase pipeline (each phase returns Decision | null)      │
└──────────────────────────────────────────────────────────┘

  P0  closureAck            → ack a "ok grazie" / "perfetto"
  P1  preprocess            → mutazioni di state da regex/heuristic
  P2  earlyDetectors        → displayUnreadable, nonTroubleshootingIncident,
                              mixedIncident, angryTone, unknownLocation
  P3  customerNameCapture   → cattura nome se richiesto
  P4  pendingClosureFlush   → chiusura "operator/resolved" → name → escalation
  P5  languageResolution    → set state.language
  P6  faqMultiTurn          → discount-code, location-aware FAQ resume
  P7  faqDetect             → first-turn / mid-flow FAQ (con pausa flow)
  P8  resumePausedFlow      → ripristina flow se era in pausa
  P9  routerLLM             → chiama il Router LLM (riceve flow attivo)
  P9.5 topicSwitchHandle    → CRITICO: rileva switch_to_other_problem /
                              switch_to_faq / abandon dalla routerDecision e
                              salva/ripristina pausedFlow, pausedFaq,
                              pausedNameCapture. Sticky facts vengono
                              preservati a meno di smentita esplicita.
  P10 locationGatherers     → Mataró-street, location-insist, location-clarif.
                              Non sovrascrive location esistente senza
                              chiederla esplicitamente.
  P11 machineGatherers      → machineType → machineNumber → displayState.
                              Non sovrascrive senza chiederla esplicitamente.
  P12 escalateOnlyDisplays  → AL001/ALN/ERR-codes
  P13 doubleChargeChain     → step doble-cobro
  P14 paidNotActivatedChain → central change → activate-after-review
  P15 specialistLLM + flow  → washer/dryer flow execution
  P16 finalRender           → renderHistory con flowEngineResult
  P17 escalationFinalize    → contactOperator + handover summary

Ogni fase: function isolata, input (runtime, state, ctx), output Decision | null.
ctx = { userMessage, normalizedUserMessage, debug, routerDecision (se P9 fatta) }.

Decision = {
  kind: 'reply' | 'continue',
  reply?: string,
  reason: string,    // es "P10.mataroStreetEarly"
  mutations?: Partial<SessionState>  // mutate state via patch (testabile)
}

Logger: ogni fase pushDebug(ctx.debug, `phase:${name}`, decision.reason).
```

## 4. Struttura file

```
apps/backend/custom-ecolaundry/
├── chatbot.ts                    # solo orchestrazione: chiama le fasi in ordine
└── phases/
    ├── index.ts                  # export di tutte le fasi nel giusto ordine
    ├── 00-closure-ack.ts
    ├── 01-preprocess.ts          # già esiste utils/preprocess.ts → spostare
    ├── 02-early-detectors.ts
    ├── 03-customer-name-capture.ts
    ├── 04-pending-closure.ts
    ├── 05-language.ts
    ├── 06-faq-multi-turn.ts
    ├── 07-faq-detect.ts
    ├── 08-resume-flow.ts
    ├── 09-router-llm.ts
    ├── 09.5-topic-switch.ts
    ├── 10-location-gather.ts
    ├── 11-machine-gather.ts
    ├── 12-escalate-displays.ts
    ├── 13-double-charge.ts
    ├── 14-paid-not-activated.ts
    ├── 15-specialist-flow.ts
    ├── 16-render.ts
    └── 17-escalation-finalize.ts
```

Ogni fase è ~30-80 righe. `chatbot.ts` finale: ~150 righe.

## 5. Migrazione step-by-step (8 step incrementali)

Ognuno è un commit a sé. Tra uno e l'altro: la suite usecase deve passare uguale.

### Step 1 — Skeleton (no logic change)
- Crea `phases/index.ts` con la firma `Phase = (runtime, state, ctx) => Decision | null`
- Crea il loop in `chatbot.ts` che itera le phases ma **lasciale tutte vuote** (return null)
- Lascia `handleTurn` originale come fallback (commentato).
- `npm run demo:check` deve passare.

### Step 2 — Estrai P0 closureAck e P3 customerNameCapture
- Sono i blocchi più piccoli e self-contained.
- Usecase suite deve passare invariata.

### Step 3 — Estrai P1 preprocess + P5 language
- Sposta `preprocessUserInput` come fase, niente cambio.
- Language resolution diventa fase.

### Step 4 — Estrai P2 earlyDetectors
- Tutti i blocchi `hasX` early (displayUnreadable, mixedIncident, angryTone, unknownLocation).
- Test mirato con `--usecase 17 25 31 32`.

### Step 5 — Estrai P6 e P7 (FAQ)
- `advanceDiscountCodeFlow`, `pendingLocationAwareFaq`, `detectFaqIntent`.
- Test mirato `--usecase 8 9 10 11 12`.

### Step 6 — Estrai P9 routerLLM + P10/P11/P12 (gather)
- Qui c'è il guaio del Mataró: dopo lo step si **rifà la verifica manuale** che il guard Mataró scatta prima di machineType. Si scrivono test specifici.
- Test mirato `--usecase 1 2 3 14 16`.

### Step 7 — Estrai P13 P14 (double-charge, paid-not-activated)
- `--usecase 4 6 7 28`.

### Step 8 — Estrai P15 P16 P17 (specialist + render + escalation)
- `--usecase 5 13 15 26 27 30`.
- A questo punto `chatbot.ts` originale può essere rimosso.

## 6. Garanzie durante il refactoring

- **Nessun cambiamento di comportamento nei 32 usecase**.
- Ogni step finisce con `npm run demo:usecase` verde.
- Lo step finale aggiunge un test di **regressione architetturale**: dato un dialog interattivo (Andrea ne fornisce 3), lo riproduco con expect e verifico la trace di fasi.

## 7. Dopo il refactoring (fix funzionali)

Solo a refactoring concluso si toccano i bug aperti. In ordine:

1. **Tono freddo** (P16 finalRender) — il History prompt va riscritto per:
   - Recap progressivo affidabile ("OK, sei a Goya con la lavatrice 4")
   - Frasi di rassicurazione ("Tranquillo, lo risolviamo")
   - Mai 3 domande in 3 turni senza un acknowledgment

2. **Escalation prematura** (P15) — quando un display non è riconosciuto, prima di chiamare l'operatore:
   - Il bot chiede al cliente di rileggere/foto
   - Solo dopo 2 tentativi falliti escala

3. **PUSH PROG sull'asciugatrice** — non esiste come display dell'asciugatrice. Il bot deve dirlo: "PUSH PROG è un codice della lavatrice, sicuro che è un'asciugatrice?" → branch al flow lavatrice se conferma.

4. **Mataró persistente** (Step 6) — già fixed dal refactoring se il guard è in P10 (prima di P11).

## 8. Cosa serve da Andrea per partire

1. **Approva il piano** (sezioni 3, 5)
2. **Conferma l'ordine** delle fasi (qualcosa è stato dimenticato?)
3. **Fornisci 3 dialog ideali** che vuoi vedere funzionare al 100% — li uso come test di accettazione finale (oltre ai 32 usecase)

Tempo stimato: 3-4 sessioni di lavoro per gli 8 step. Ogni step lascia il sistema funzionante.

---

## 9. Cosa NON facciamo in questo refactoring

- Non tocchiamo i prompt LLM (router.txt, history.txt, …) — solo struttura TS
- Non cambiamo i JSON dei flow
- Non aggiungiamo nuove lingue
- Non aggiungiamo nuovi usecase
- Non rimuoviamo i guard hardcoded esistenti — solo li spostiamo in fasi

I bug funzionali (tono, escalation prematura, asciugatrice-PUSH) si fixano DOPO, su un terreno pulito.

---

## 10. Rischi

| Rischio | Mitigazione |
|---|---|
| Suite usecase rompe a uno step | Ogni step è un commit a sé → si rivede senza affondare |
| Mataró ancora non scatta | Step 6 ha un test di accettazione dedicato |
| Tempo > 4 sessioni | Ogni step lascia il sistema funzionante: si può fermare a metà |
| LLM flaky (UC14 noto) | Già scontato come retry-stable, non bloccante |
