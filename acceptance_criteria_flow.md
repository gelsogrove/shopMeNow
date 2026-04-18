# Acceptance Criteria — FLOW Workspace Chatbot

## AC-1: Routing corretto per channelMode=FLOW

- **DATO** un workspace con `channelMode=FLOW`
- **QUANDO** un utente invia qualsiasi messaggio
- **ALLORA** il sistema NON deve mai invocare `CUSTOMER_SUPPORT`, `INFO_AGENT`, o qualsiasi agente ECOMMERCE
- **E** il sistema deve delegare a `FlowWorkspaceStrategy` → `FlowAgentLLM` o `FlowEngineService`

## AC-2: ROUTER risponde alle FAQ generali

- **DATO** un workspace FLOW con un `FlowNodeConfig` di tipo `router` in DB
- **QUANDO** l'utente fa una domanda generica (es. orari, prezzi, come funziona)
- **ALLORA** il `FlowAgentLLM` con `flowKey="router"` deve rispondere usando le FAQ del workspace
- **E** la risposta deve essere tradotta nella lingua del cliente

## AC-3: FlowAgentLLM avvia un flow guidato per problemi tecnici

- **DATO** un workspace FLOW con `FlowNodeConfig` che contiene flows (es. `non_parte`, `errore_alm`)
- **QUANDO** l'utente descrive un problema tecnico (es. "ho pagato ma non parte la lavatrice")
- **ALLORA** `FlowAgentLLM` deve chiamare `startFlow(flowId)` con il flow appropriato
- **E** il sistema deve mostrare il primo nodo del flow (es. "Cosa vedi sul display? 1️⃣ SEL 2️⃣ PUSH...")
- **E** `ChatSession.context.flowState` deve essere salvato con `flowStatus=ACTIVE`

## AC-4: FlowEngineService gestisce la navigazione deterministica

- **DATO** un flow ACTIVE in `ChatSession.context`
- **QUANDO** l'utente risponde con un numero valido (es. "1", "3")
- **ALLORA** il sistema NON deve chiamare l'LLM per decidere il prossimo step
- **E** il sistema deve avanzare al nodo corrispondente nella `transitions` map
- **E** `ChatSession.context.flowState.currentNodeId` deve aggiornarsi al nuovo nodo

## AC-5: Gestione corretta dei nodi terminali

- **DATO** un nodo con `isTerminal: true`
- **QUANDO** il flow raggiunge quel nodo
- **ALLORA** il sistema deve inviare il prompt del nodo
- **E** `flowState` deve essere impostato a `COMPLETED`
- **E** il contesto del flow deve essere pulito dalla sessione

## AC-6: Interrupt FAQ durante un flow attivo

- **DATO** un flow ACTIVE in sessione
- **QUANDO** l'utente fa una domanda off-topic (es. "quanto costa?")
- **ALLORA** il sistema deve rispondere alla domanda tramite `FlowAgentLLM`
- **E** dopo la risposta deve riproporre il nodo corrente del flow con `onInterruptFallback`
- **E** `interruptCount` deve incrementare di 1

## AC-7: Escalation automatica per troppi interrupt

- **DATO** un flow ACTIVE con `interruptCount >= 4`
- **QUANDO** l'utente fa un'altra domanda off-topic
- **ALLORA** il sistema deve escalare automaticamente all'operatore
- **E** deve inviare il messaggio di escalation configurato nel workspace

## AC-8: Escalation esplicita (HARD_BREAK)

- **DATO** un flow ACTIVE in sessione
- **QUANDO** l'utente scrive "voglio parlare con un operatore" o "chiamami" o simili
- **ALLORA** il sistema deve interrompere immediatamente il flow
- **E** invocare `contactOperator()` che disabilita il chatbot e notifica l'operatore
- **E** `flowState` deve passare a `ESCALATED`

## AC-9: Pausa gentile (SOFT_BREAK)

- **DATO** un flow ACTIVE in sessione
- **QUANDO** l'utente scrive "lascia stare", "basta", "stop"
- **ALLORA** il sistema deve sospendere il flow senza escalare
- **E** `flowState` deve passare a `PAUSED`
- **E** il sistema deve confermare che il flow è stato messo in pausa

## AC-10: Nessun flow configurato in DB

- **DATO** un workspace FLOW senza `FlowNodeConfig` con `flowKey="router"` in DB
- **QUANDO** l'utente invia un messaggio
- **ALLORA** il sistema deve loggare un warning
- **E** deve rispondere con un messaggio di fallback generico (NON crashare, NON invocare CUSTOMER_SUPPORT)

## AC-11: Welcome message + flow

- **DATO** un workspace FLOW con `welcomeMessage` configurato e `enableWelcomeMessage=true`
- **QUANDO** un nuovo cliente invia il primo messaggio
- **ALLORA** il sistema deve anteporre il welcome message alla risposta del flow
- **E** il flow deve essere avviato normalmente (non solo il welcome)

## AC-12: Traduzione della risposta

- **DATO** un cliente con lingua diversa dall'italiano (es. inglese, spagnolo)
- **QUANDO** il flow o il router risponde
- **ALLORA** la risposta deve essere tradotta nella lingua del cliente da `TranslationAgent`
- **E** i prompt dei nodi del flow devono essere tradotti (non hardcoded in una lingua)

## AC-13: Nessuna risposta da CUSTOMER_SUPPORT in FLOW mode

- **DATO** qualsiasi scenario in un workspace FLOW
- **QUANDO** viene processato un messaggio
- **ALLORA** l'`agentType` nella risposta NON deve mai essere `CUSTOMER_SUPPORT`
- **E** nei log NON deve apparire "CustomerSupportAgentLLM" per workspace FLOW

## AC-14: Persistenza della storia conversazione

- **DATO** una conversazione FLOW in corso
- **QUANDO** l'utente invia messaggi successivi
- **ALLORA** `FlowAgentLLM` deve caricare la storia dalla tabella `conversation_messages`
- **E** il contesto degli ultimi 24 ore deve essere disponibile all'LLM

## AC-15: Reset del flow dopo TTL (30 minuti)

- **DATO** un flow ACTIVE con `lastValidStepAt` più vecchio di 30 minuti
- **QUANDO** l'utente invia un nuovo messaggio
- **ALLORA** `interruptCount` deve essere resettato a 0
- **E** il flow deve riprendere dal nodo corrente senza escalare


voglio che il cusomer flow possa sopporare quest