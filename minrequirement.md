# eChatbot End-to-End Scenarios (Language, Campaigns, Escalation, Billing)

Use these scenarios to regression-test the flows the team cares about. All steps assume workspace isolation and main branch.

## 1) Language selection & Translation
- GIVEN customer.language = "es" → responses go to TranslationAgent with targetLanguage "es".
- GIVEN no language, phone prefix +34 → targetLanguage "es".
- GIVEN no language, phone prefix +39 → targetLanguage "it".
- GIVEN no language, phone prefix +351 → targetLanguage "pt".
- GIVEN no language, unknown prefix → targetLanguage "en" (default).
- Ensure TranslationAgent prompt variables include: frustrationEscalationInstructions, humanSupportInstructions, botIdentityResponse, allowedExternalLinks, etc., and are replaced (no {{VAR}} left).
- Widget debugMode=true → WIP message passes through TranslationAgent (still translated).

## 2) Registration & Profile Links (tokenized, short)
- WHEN user asks “see my profile” or “change my data” → webhook returns short link with token (LinkReplacementService) to registration/profile form.
- Registration form shows workspace logo & widgetPrimaryColor; button uses same color.
- Form allows “delete account”/opt-out.
- After registration:
  - If Require Manual Approval = false → customer isActive=true, registrationStatus=ACTIVE, send WhatsApp/message in customer language.
  - If Require Manual Approval = true → status=PENDING_APPROVAL, no message sent; when admin approves, send WhatsApp (if phone present).

## 3) Unregistered user reminders
- Every 6th assistant message to an unregistered customer appends [LINK_REGISTRATION] (replaced to short link) in the correct language.

## 4) Human operator escalation
- Intent “talk to human / servizio pessimo” triggers function `contactOperator`.
- contactOperator:
  - Disables chatbot for that customer (activeChatbot=false).
  - Uses humanSupportInstructions (translated) for user-facing message.
  - Uses frustrationEscalationInstructions only as trigger hints, not user text.
  - Sends summary to operator (email/WhatsApp depending on settings) with last-hour conversation.

## 5) Widget vs WhatsApp behavior parity
- Same welcome message and WIP message.
- Widget replies immediately (no WhatsApp queue entry).
- Channel disabled → Widget/WhatsApp return nothing (no response).

## 6) Billing & credit cutoffs
- WhatsApp message cost: $0.10; Widget message cost: $0.05; Push campaign message: $1.00.
- If owner balance <= -10.00 → block all channels (no responses, no sends).
- Push campaigns also blocked if credit insufficient before schedule/send.

## 7) Campaign CRUD & send
- Create/Update accepts targetingType in any client format (MANUAL/ALL/TAGS; quoted values handled).
- Manual selection rebuilds recipients and expectedRecipients; card shows real pending count.
- Delete (trash) removes campaign; Cancel sets status=CANCELLED only.
- Schedule/run respects channel/billing checks and workspace isolation.
- Messages generated include variables, then TranslationAgent localizes them before enqueue/send.

## 8) Profile updates notifications
- After profile edit, send WhatsApp/Widget message in customer language (if phone present for WhatsApp; otherwise widget response only).

## 9) Safety
- Widget security layer on widget channel; WhatsApp handled by scheduler before send.
- No queue insertion when widget channel is disabled/debug mode.

## How to validate quickly
- Check `/api/token/validate-secure-token` returns workspace { logoUrl, logoKey, widgetPrimaryColor }.
- For a campaign: `expectedRecipients` == length of `pushCampaignRecipient` PENDING+SKIPPED+FAILED? (SKIPPED counts toward expected; card pending uses PENDING).
- No enum errors on targetingType even with "\"MANUAL\"".

---

## Execution directive (orchestrare tutto, refactor + best practice)

*Obiettivo*: orchestrare end-to-end BE/FE/Scheduler, prendere in pasto l’intero progetto e ridurre errori LLM, lingua, campagne, billing. Se necessario spezzare file lunghi, migliorare servizi e prompt. Prendi decisioni autonomamente se il codice è troppo lungo o poco modulare (split, refactor, servizi dedicati).

**Orchestrazione obbligatoria**
- Chi prende in carico una feature deve coordinare e verificare tutti i layer (Backend, Frontend, Scheduler, DB, prompt, billing). Ogni modifica con impatto cross-layer (lingua, campagne, billing, escalation) va validata end-to-end prima di chiudere.
- Se una funzionalità non rispetta queste regole, si fa refactor e si aggiungono/aggiornano i test prima di rilasciare.
- Se un file è troppo lungo o denso per essere compreso facilmente (oltre ~300-400 righe), va spezzato/modularizzato: la IA fatica a seguire flussi troppo estesi; preferire servizi e moduli piccoli con responsabilità singola.

- **Refactor scope**: se un file/service supera ~300-400 righe (es. llm-router, translation), split in moduli: language-resolver, billing-guard, delegation-handler, token-replacement, translation-pipeline, campaign-recipient-builder. Frontend: estrarre hook (useCampaigns/useLanguage/useTokenValidation) e componenti (CampaignCard, CampaignForm, RegisterHeader, RegisterButton).  
- **Lingua**: default en. Ordine: customer.language > phone prefix (+34 es, +39 it, +351 pt, else en) > workspace.defaultLanguage. Passare sempre `customerLanguage` al TranslationAgent, anche WIP/debug. Welcome widget = WhatsApp.  
- **Multilingua**: nessun testo hardcodato nelle risposte cliente; ogni nuovo messaggio deve passare per TranslationAgent o template localizzati. Evitare stringhe fisse in controller/service/frontend: usare prompt/templating con variabili e traduzione.
- **Token links**: sempre short link+token per profilo/registrazione; form con logo/widgetPrimaryColor; include delete account. Reminder registrazione ogni 6 messaggi se non registrato.  
- **Escalation operatore**: intent frustration → `contactOperator`; usare humanSupportInstructions tradotto per cliente; frustrationEscalationInstructions solo come hint; disattivare chatbot; inviare summary (email/WA).  
- **Billing**: WA $0.10, widget $0.05, push $1.00; blocco totale a credit ≤ -10; blocco push se credito insufficiente prima di schedule/send. Widget disabled/debug → nessuna risposta.  
- **Campagne**: normalizzare targetingType anche se quotato; rebuild recipients su ALL/TAGS/manual change; delete ≠ cancel; pending = PENDING recipients; expectedRecipients coerente. Messaggi campagne → TranslationAgent → enqueue.  
- **Profile notifications**: dopo registrazione/aggiornamento profilo inviare messaggio nella lingua cliente (WA se telefono, altrimenti widget).  
- **Templates/prompt**: tutte le variabili sostituite (niente {{VAR}}); includere frustrationEscalationInstructions, humanSupportInstructions, botIdentityResponse, allowedExternalLinks.  
- **Safety**: channel disabled/debug → nessuna risposta; widget security layer solo widget; no enqueue per widget.  
- **Test**: coprire scenari sopra (Jest/Vitest). Aggiungere test targetingType `"MANUAL"` quotato; rebuild recipients; billing cut-off; language resolution; contactOperator flow; registration reminder ogni 6 messaggi.  

Se una regola non è rispettata, refactor e aggiungi test prima di rilasciare.

## Global objectives (cosa deve sempre garantire il sistema)
- Chatbot risponde nella lingua giusta (default en; regole su lingua cliente/prefisso).
- Campagne: CRUD senza errori enum, scelta tipo/periodo/schedule, invio sicuro, messaggi con variabili tradotte, facile creazione/analisi.
- Ricevere messaggi dalle campagne nelle lingue corrette.
- Profilo: se l’utente chiede di vedere/modificare dati → link corto con token; form consente anche cancellazione account.
- Utente non registrato: ogni 6 messaggi riceve invito a registrarsi (link corto).
- Registrazione: se Require Manual Approval true/false comportamenti corretti; dopo registrazione o approvazione invio messaggio in lingua cliente (WA se telefono, widget se no).
- Escalation operatore: messaggio al cliente uguale alle impostazioni (tradotto variabili); messo in coda per operatore; operatore avvisato via WA o email secondo settings.
- Billing: push $1, WA $0.10, widget $0.05; a -10$ stop totale; channel disattivato → nessuna risposta.
- Widget: non inserisce in coda WA, risponde subito; stesse funzionalità/welcome/WIP di WA.
- WIP message: solo se debugMode=true, comunque tradotto via TranslationAgent.
- LLM: tutte le variabili sostituite, nessun placeholder residuo.

## Acceptance Criteria (must pass)
- Nessun placeholder non sostituito (`{{VAR}}`, `[LINK_*]`) nelle risposte inviate a utenti.
- Language routing corretto: targetLanguage scelto secondo regole; log TranslationAgent coerente.
- Campagne: creazione/update/delete senza errori enum; pending = PENDING recipients reali; expectedRecipients coerente con recipients salvati; delete rimuove la campagna.
- Billing: blocco risposte e invii quando credit ≤ -10; push/WA/widget addebitano i costi previsti.
- Token link profilo/registrazione sempre generati; form mostra logo/widgetPrimaryColor; include delete account.
- Reminder registrazione ogni 6 messaggi per non registrati.
- Escalation operatore: chatbot disattivato per cliente, summary inviato, messaggio cliente tradotto da humanSupportInstructions.
- Widget parity: stesso welcome/WIP di WhatsApp, ma risposta immediata senza enqueue; channel disabled/debug → nessuna risposta.
- WIP message solo se debugMode=true e comunque tradotto.

## Test come “bibbia”
- I test (Jest/Vitest) descrivono il comportamento atteso; se un test è sbagliato, lo si corregge dopo attenta analisi del requisito, non lo si disabilita.  
- Ogni bug fix deve aggiungere/aggiornare il test che lo copre.  
- I test regressione elencati qui sono la fonte di verità operativa; modificare un test solo se il requisito è cambiato e documentarlo.
