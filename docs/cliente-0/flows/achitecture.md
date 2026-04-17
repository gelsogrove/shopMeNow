# FLOW Architecture — Ecolaundry

> Architettura definitiva del pipeline messaggi per workspace `channelMode=FLOW`.
> 3 percorsi: **PATH A** (flow attivo → FlowEngine, 0 token) + **PATH B** (flowKey senza flow → FlowAgentLLM) + **PATH C** (no flowKey → FlowAgentLLM Router).

> ⚠️ **NOTA IMPLEMENTAZIONE** (codice reale vs documento):
> - `FlowAgentLLM` è **una singola chiamata LLM** che fa sia routing che risposta — NON esistono 2 LLM separati
> - Durante il **flow attivo (PATH A)**, il Router **non viene mai chiamato** — `FlowClassifierService` classifica l'input strutturalmente (0 token)
> - I subLLM (per macchina) hanno prompt dinamici configurati nel CRUD FlowNodeConfig — NON hanno template markdown
> - **Pipeline completa**: Router → subLLM → Conversation History → Translation → Security → WhatsApp Queue

---

## 1. I 3 Componenti — Chi Fa Cosa

### ROUTER (LLM leggero — il cervello decisionale)

| | |
|---|---|
| **Tipo** | LLM con calling functions |
| **Modello** | Economico (gpt-4o-mini), prompt corto |
| **Ruolo** | Classificare l'intent del cliente e smistare |
| **Parla al cliente?** | **MAI** — produce solo decisioni JSON interne |
| **Prompt contiene** | Solo regole di routing, lista macchine, context attivo |
| **Prompt NON contiene** | FAQ, specs macchina, tono di voice |
| **Input riceve** | Messaggio + ChatSession.context (flowKey, flowState, gatherState) |
| **Input extra se flow attivo** | Il prompt dello step corrente (per capire se il messaggio è una risposta al flow) |
| **Config DB** | `AgentConfig` tipo ROUTER |

**Calling functions del Router:**

| Function | Quando | Cosa fa |
|---|---|---|
| `assignMachine(flowKey, machineNumber)` | Ha raccolto locale + tipo + numero | Salva flowKey nel context |
| `startFlow(flowId)` | Problema identificato, macchina assegnata | Avvia flow deterministico |
| `contactOperator(reason)` | Cliente chiede operatore, o situazione ambigua | Scala a umano |
| `changeLanguage(lang)` | Cliente chiede altra lingua | Aggiorna lingua nel DB |

**Decisioni possibili del Router:**

| Action | Quando | Cosa succede dopo |
|---|---|---|
| `FLOW_INPUT` | Flow attivo + input è risposta al flow (numero, sì/no) | → FlowEngine → History |
| `FAQ` | Domanda su orari/prezzi/pagamento/rimborsi/fattura/carta | → History (ha le FAQ) |
| `START_FLOW` | Problema chiaro + macchina assegnata → chiama startFlow() | → FlowEngine → History |
| `GATHER_INFO` | Manca locale, tipo macchina, o numero | → History (formula la domanda) |
| `ASSIGN_MACHINE` | Ha tutti i dati → chiama assignMachine() | → History (conferma assegnazione) |
| `ESCALATE` | Cliente vuole operatore, o caso ambiguo → chiama contactOperator() | → History (messaggio escalazione) |
| `CHANGE_LANG` | Richiesta cambio lingua → chiama changeLanguage() | → History (conferma) |
| `GREETING` | Primo messaggio, saluto | → History (saluta con tono) |

---

### FLOW ENGINE (deterministico — 0 token LLM)

| | |
|---|---|
| **Tipo** | Codice puro, legge JSON |
| **Ruolo** | Eseguire step predefiniti dell'albero decisionale |
| **Parla al cliente?** | **MAI** — produce output strutturato per History Agent |
| **Costo** | 0 token, istantaneo |
| **Config DB** | `FlowNodeConfig.flows` (JSON) |

**Input:** flowId + currentNodeId + input utente (normalizzato)
**Output:** `{ responseText, nextNodeId, flowStatus, shouldCallOperator }`

**Tipi di nodo:**

| Tipo | Input atteso | Esempio |
|---|---|---|
| `CHOICE` | Numero (1, 2, 3...) | "Cosa vedi sul display? 1) Porta 2) SEL 3) ALM" |
| `ACTION` | Qualsiasi (conferma dopo istruzione) | "Chiudi la porta e riprova" |
| `INFO` | Transizione automatica o default | Messaggio informativo |
| `CONFIRMATION` | Sì / No | "Ha funzionato?" |

**Nodi terminali:**
- `isTerminal: true` + `action: "resolve"` → flow completato con successo
- `isTerminal: true` + `action: "escalate"` → flow fallito, l'orchestratore chiama contactOperator()

**I FlowNodeConfig NON sono LLM.** Contengono:
- `flowKey`: identificativo macchina (es. "lavatrice_hs60xx")
- `flowLabel`: nome leggibile (es. "Lavatrice HS-60XX Goya")
- `machineSpecs`: specs tecniche della macchina (capacità, programmi, prezzi)
- `flows`: JSON dell'albero decisionale
- `availableFunctions`: per future integrazioni API esterne
- `isActive`: on/off

---

### HISTORY AGENT / FlowAgentLLM (LLM — la voce del sistema)

> ⚠️ Nel codice questo è `FlowAgentLLM` — la stessa classe usata anche per il Router. È **1 call LLM** che decide e risponde insieme. Non esiste `AgentConfig` di tipo `HISTORY`.

| | |
|---|---|
| **Tipo** | LLM conversazionale (= `FlowAgentLLM` nel codice) |
| **Ruolo** | Formulare la risposta finale al cliente |
| **Parla al cliente?** | **SEMPRE LUI** — è l'unica voce |
| **Config DB** | `FlowNodeConfig` con `flowKey='router'` (per PATH C) o flowKey macchina (per PATH B) |

**Priorità delle fonti — REGOLA CRITICA DEL PROMPT:**

```
🥇 1. FlowEngineResult   → SE presente: è la fonte PRIMARIA e NON MODIFICABILE
                           Riformula con tono umano, non inventare alternative
🥈 2. Router decision    → la direttiva: cosa comunicare al cliente
🥉 3. FAQ del workspace  → risposta a domande generiche
   4. machineSpecs       → background knowledge per domande su programmi/prezzi
```

> **⚠️ REGOLA ASSOLUTA**: Se `flowEngineResult` è presente nel contesto, il testo risposta viene da lì.
> Il LLM può solo cambiare il **tono** (più caldo, più umano), MAI cambiare il **contenuto** (istruzioni, opzioni, next step).
> Non inventare alternative, non aggiungere possibilità non previste dal flow.
>
> **⚠️ UNA SOLA DOMANDA PER TURNO**: Il LLM non deve mai fare 2+ domande nello stesso messaggio.
> ❌ SBAGLIATO: "¿Qué ves en el display? ¿Es la primera vez que ocurre?"
> ✅ CORRETTO: "¿Qué ves en el display? 1️⃣ Puerta 2️⃣ SEL 3️⃣ ALM..."

**Cosa riceve in input (tutto):**

| # | Dato | Fonte | Priorità |
|---|---|---|---|
| 1 | Output FlowEngine | `FlowEngineService.handleMessage()` | 🥇 PRIMARIA se presente |
| 2 | Decisione del Router | Output routing | 🥈 Direttiva sempre presente |
| 3 | FAQ del workspace | `{{faqs}}` da DB | 🥉 Solo se senza FlowResult |
| 4 | Specs macchina | `FlowNodeConfig.machineSpecs` | Background knowledge |
| 5 | Storico ultima ora | `ConversationMessage` | Coerenza dialogo |
| 6 | Dati cliente | nome, lingua, storico | Personalizzazione |
| 7 | Tono di voice | `{{toneOfVoice}}` da workspace | Stile comunicazione |
| 8 | Flow state | flowKey, flowStatus, currentStep | Contesto flow in pausa |

**Cosa fa:**
1. **Se FlowEngineResult presente** → riformula con tono umano, mantieni istruzioni intatte
2. **Saluta** il cliente (primo messaggio, o bentornato se ha storico)
3. **Formula** risposte basate sulla decisione del Router (senza FlowEngine)
4. **Risponde** alle FAQ con contesto (se parlava della secadora e chiede il prezzo, risponde il prezzo della secadora)
5. **Ricorda** cosa ha già chiesto/detto (non ripete domande)
6. **Gestisce** il cambio di argomento con fluidità ("Il lavaggio costa 3€. Vuoi continuare con il problema della lavadora?")
7. **Gestisce** il cambio lingua (risponde nella nuova lingua da subito)

**Calling functions future di History Agent:**

| Function | Quando | Uso |
|---|---|---|
| `bookAppointment()` | Cliente vuole prenotare | Integrazione calendario |
| `checkPaymentStatus()` | Verifica pagamento | Integrazione payment |
| `generateCompensationCode()` | Compensazione approvata | Genera codice |

---

## 2. Pipeline Completa — Flusso Messaggio

```
Cliente scrive messaggio
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  ORCHESTRATORE (FlowWorkspaceStrategy — codice, no LLM) │
│                                                         │
│  1. Carica ChatSession.context                          │
│  2. Controlla flowStatus                                │
│  3. Sceglie PATH                                        │
└─────────────────────────────────────────────────────────┘
         │
         ├─────── flowStatus=ACTIVE ────────────────────────────────────────┐
         │                                                                   │
         │  PATH A (flow attivo — 0 token LLM)                              │
         │                                                                   ▼
         │                         ┌──────────────────────────────────────────────┐
         │                         │  FlowClassifierService (codice, 0 token)      │
         │                         │                                              │
         │                         │  MATCH     → FlowEngine.handleMessage()      │
         │                         │  HARD_BREAK → cancella flow → PATH C         │
         │                         │  SOFT_BREAK → flow in pausa → PATH C         │
         │                         │  INTERRUPT_FAQ → flow pausa → PATH C         │
         │                         │  AMBIGUOUS  → retry / escalate               │
         │                         └──────────────────────────────────────────────┘
         │                                    │
         │                   ┌────────────────┘
         │                   ▼
         │  ┌──────────────────────────────────────┐
         │  │  FlowEngine.handleMessage()           │
         │  │  (deterministico, 0 token LLM)        │
         │  │  Output: responseText (già completo)  │
         │  └──────────────────────────────────────┘
         │                   │
         │                   └──→ POST-PROCESSING → Risposta cliente
         │
         ├─────── flowKey set, no flow attivo ──────────────────────────────┐
         │                                                                   │
         │  PATH B (sub-macchina)                                            ▼
         │                         ┌──────────────────────────────────────────────┐
         │                         │  FlowAgentLLM (1 call LLM)                   │
         │                         │  Routing + risposta in una sola call          │
         │                         │  Può chiamare: startFlow, contactOperator     │
         │                         └──────────────────────────────────────────────┘
         │                                    │
         │                                    └──→ POST-PROCESSING → Risposta cliente
         │
         └─────── no flowKey ────────────────────────────────────────────────┐
                                                                              │
           PATH C (router generico)                                           ▼
                            ┌──────────────────────────────────────────────────────┐
                            │  FlowAgentLLM con flowKey='router' (1 call LLM)      │
                            │  Routing + risposta in una sola call                  │
                            │  Può chiamare: assignMachine, startFlow,              │
                            │               contactOperator, changeLanguage         │
                            └──────────────────────────────────────────────────────┘
                                         │
                                         └──→ POST-PROCESSING → Risposta cliente
```

**POST-PROCESSING (tutti i path):**
```
1. Salva messaggio utente + risposta bot in DB
2. Conversation History Agent (umanizza la risposta, aggiunge contesto)
3. Translation Agent (se lingua ≠ base)
4. Security Agent (solo widget)
5. Link replacement
6. WhatsApp Queue (scheduler, 6s cooldown)
```

**Pipeline UI (grafico AgentFlowDiagram):**
```
Customer Message → Router → subLLM (dinamico) → Historial → Translation → Security → WhatsApp Queue → Response
```

---

## 3. Scenari Completi — Verifica Caso per Caso

### Scenario 1: Primo contatto — "Hola"

```
Router:  { action: "GREETING" }
History: "¡Hola! Soy el asistente de Ecolaundry. ¿Cómo puedo ayudarte hoy?"
```

### Scenario 2: Raccolta info — "La lavadora no funciona"

```
Router:  no flowKey → { action: "GATHER_INFO", need: "locale" }
History: "No te preocupes, te ayudo. ¿En qué local estás?"
```

### Scenario 3: Raccolta info — "Goya"

```
Router:  context.locale=Goya → { action: "GATHER_INFO", need: "machine_type" }
History: "Perfecto. ¿Es una lavadora o una secadora?"
```

### Scenario 4: Raccolta info — "Lavadora número 42"

```
Router:  ha tutto → chiama assignMachine("lavatrice_hs60xx", 42) 
         → { action: "ASSIGN_MACHINE", flowKey: "lavatrice_hs60xx" }
History: "Entendido, te ayudo con la lavadora #42. ¿Qué problema tienes?"
```

### Scenario 5: Avvio flow — "No parte, ya he pagado"

```
Router:  flowKey assegnato, problema chiaro → chiama startFlow("non_parte")
         → FlowEngine.startFlow() → step_0: "Cosa vedi sul display? 1) Porta 2) SEL..."
         → { action: "START_FLOW", flowEngineResult: { step_0 prompt } }
History: "Vamos a revisarlo paso a paso. ¿Qué ves exactamente en el display?
          1️⃣ Puerta abierta
          2️⃣ Seleccionar programa
          3️⃣ Pulsar programa
          4️⃣ Crédito / precio
          5️⃣ ALM (alarma)
          6️⃣ Otro"
```

### Scenario 6: Step nel flow — "1" (Porta)

```
Router:  flow attivo, input numerico → { action: "FLOW_INPUT", input: "1" }
FlowEngine: transition → door node → "Chiudere porta" → ask_resolved
         → { responseText: "Chiudere porta", nextStep: ask_resolved }
History: "Prueba a abrir y cerrar bien la puerta, asegurándote de que queda bien bloqueada. ¿Ha funcionado?"
```

### Scenario 7: Risposta flow — "No"

```
Router:  flow attivo, input "no" → { action: "FLOW_INPUT", input: "NO" }
FlowEngine: transition → escalate node → isTerminal, action: "escalate"
         → { shouldCallOperator: true }
Orchestratore: chiama contactOperator("Problema porta non risolto, lavadora #42 Goya")
History: "Entiendo. Vamos a revisar tu caso con más detalle. Un operador te atenderá en breve."
```

### Scenario 8: FAQ durante flow attivo — "Quanto costa un lavaggio?"

```
Router:  riconosce FAQ nonostante flow attivo → { action: "FAQ", topic: "prezzi", flowPaused: true }
         (flow resta in PAUSA, non viene cancellato)
History: [ha FAQ prezzi + sa che il flow è in pausa]
         "El lavado cuesta 7€ en Goya. ¿Seguimos con el problema de la lavadora #42?"
```

### Scenario 9: Ritorno al flow dopo FAQ — "Sì"

```
Router:  flow in pausa, "sì" = ripresa → { action: "FLOW_INPUT", resumeFlow: true }
FlowEngine: riprende dallo step dove era rimasto
History: "Perfecto, continuamos. ¿Qué ves en el display?"
```

### Scenario 10: Doppio addebito — "Me han cobrado dos veces"

```
Router:  nessun flow, FAQ → { action: "FAQ", topic: "doppio_addebito" }
History: [ha FAQ doppio addebito]
         "Para verificarlo, necesitamos los últimos 4 dígitos de tu tarjeta y una captura del pago.
          También te enviaremos el formulario de devolución."
```

### Scenario 11: Fattura — "Quiero una factura"

```
Router:  → { action: "FAQ", topic: "fattura" }
History: "Para obtener la factura, envía un email a olga@alberwaz.net con:
          razón social, email, lavandería, CIF/NIF, dirección, fecha y máquinas utilizadas."
```

### Scenario 12: Carta fedeltà — "¿Cómo funciona la tarjeta?"

```
Router:  → { action: "FAQ", topic: "carta_fedelta" }
History: [sa che locale=Goya dal contesto]
         "La tarjeta se compra con 20€ en efectivo y solo funciona en Goya.
          En la central, pulsa el segundo botón de la fila derecha."
```

### Scenario 13: ALM durante flow — "5" (opzione ALM)

```
Router:  flow attivo, input "5" → { action: "FLOW_INPUT", input: "5" }
FlowEngine: transition → ALM_CHECK → "Premere STOP 1 volta" → ask_resolved
History: "La máquina ha detectado una incidencia. Pulsa el botón STOP una vez y dime si la máquina responde."
```

### Scenario 14: STOP premuto per errore (lavatrice)

```
Router:  flowKey=lavatrice, "he pulsado STOP" → startFlow("non_parte")
FlowEngine: navigates to STOP_INFO node → isTerminal, action: "escalate", reason: "stop_pressed"
Orchestrator: contactOperator("Cliente pulsó STOP - posible compensación, primera vez?")
History: "Cuando se pulsa STOP, se cancela el lavado. Lo revisamos y te ayudamos con la mejor solución."
```

> ⚠️ **MAI promettere compensazione automatica** — anche se è la prima volta. L'operatore decide. (Playbook §7: non promettere compensazioni automaticamente)

### Scenario 15: Cambio macchina — "Espera, es una secadora"

```
Router:  riconosce contraddizione → chiama assignMachine("asciugatrice_ed340", 42)
         → { action: "CHANGE_MACHINE", flowKey: "asciugatrice_ed340" }
         (cancella flow attivo se c'era)
History: "Entendido, es una secadora. ¿Qué problema tienes?"
```

### Scenario 16: Cambio lingua — "Parla in italiano"

```
Router:  → chiama changeLanguage("it") → { action: "CHANGE_LANG", lang: "it" }
History: risponde normalmente
Translation: da questo momento traduce in italiano
```

### Scenario 17: Operatore — "Voglio parlare con qualcuno"

```
Router:  → chiama contactOperator("Richiesta cliente") → { action: "ESCALATE" }
History: "Capisco, ti metto in contatto con un operatore. Ti contatterà il prima possibile."
```

### Scenario 18: Ropa bruciata (secadora)

```
Router:  flowKey=secadora → startFlow → FlowEngine arriva a "Rovinata/bruciata"
FlowEngine: nodo terminale → "Verificare etichetta: NO compensazione"
History: "Mi dispiace molto. Purtroppo, quando la temperatura non è adeguata al tessuto, non è possibile 
          offrire compensazione. È importante controllare sempre le etichette delle prendas."
```

### Scenario 19: Macchina occupata — "Hay ropa de otra persona"

```
Router:  → { action: "FAQ", topic: "macchina_occupata" }
History: "Puedes sacar la ropa de la otra persona y dejarla en una mesa de la lavandería, 
          así podrás usar la máquina. Si el otro cliente tiene algún problema, que nos llame."
```

### Scenario 20: Frode/incoerenza — Goya datàfon 10€

```
Router:  rileva incoerenza (Goya=7€, cliente dice 10€)
         → { action: "ESCALATE", reason: "import_mismatch" }
         → chiama contactOperator("Incoerenza importo: Goya 7€ vs cliente 10€")
History: "Necesitamos revisar este caso con más detalle. Lo derivamos a revisión para ayudarte mejor."
         (MAI accusa di frode)
```

### Scenario 21: No sapone/schiuma (lavatrice)

```
Router:  → { action: "FAQ", topic: "sapone" }
History: "Es normal que haya poca espuma. Nuestro detergente es industrial y no genera tanta espuma 
          como el doméstico. La espuma NO lava — tu ropa saldrá igual de limpia."
```

### Scenario 22: END + bAL (desequilibrio carico)

```
Router:  flowKey=lavatrice, durante flow → FlowEngine
FlowEngine: nodo END+bAL → "Separare ropa in 2 lavatrici + compensazione"
            → isTerminal, action: "escalate"
Orchestratore: contactOperator("Desequilibrio carico, serve compensazione")
History: "El ciclo no se ha completado correctamente por exceso de carga. 
          Tendrás que separar la ropa en dos lavadoras. Un operador te ayudará con la compensación."
```

---

## 4. Gestione dello Stato — ChatSession.context

```typescript
interface ChatContext {
  // Macchina assegnata
  flowKey?: string              // "lavatrice_hs60xx" | "asciugatrice_ed340"
  machineNumber?: string        // "42"
  locale?: string               // "Goya" | "Pineda" | "L'Escala" | "Alemanya" | "Hortes"

  // Flow attivo (deterministico)
  flowState?: {
    flowId: string              // "non_parte"
    currentNodeId: string       // "non_parte.door_issue"
    flowStatus: FlowStatus      // "ACTIVE" | "PAUSED" | "COMPLETED" | "ESCALATED"
    interruptCount: number      // FAQ durante flow → conta
    lastValidStepAt: string     // ISO timestamp per TTL
  }

  // Raccolta info (Router)
  gatherState?: {
    need: string                // "locale" | "machine_type" | "machine_number"
    retryCount: number          // 0-1: normale | 2: semplifica | 3: ESCALATE
    collected: {
      locale?: string
      machineType?: string      // "lavatrice" | "asciugatrice"
      machineNumber?: string
      problemDescription?: string
    }
  }
}
```

**Persistenza:** `ChatSession.context` (JSONB) — aggiornato dopo ogni messaggio dall'orchestratore.

---

## 5. Configurazione Database

### AgentConfig — Router

| Campo | Valore |
|---|---|
| `type` | ROUTER |
| `systemPrompt` | Regole di classificazione (corto, senza FAQ) |
| `model` | openai/gpt-4o-mini |
| `temperature` | 0.1 (deterministico) |
| `maxTokens` | 256 (output breve, solo JSON) |
| `availableFunctions` | ["assignMachine", "startFlow", "contactOperator", "changeLanguage"] |

### AgentConfig — History Agent

| Campo | Valore |
|---|---|
| `type` | HISTORY |
| `systemPrompt` | Regole di comunicazione, tono, saluto. Riceve variabili: {{faqs}}, {{toneOfVoice}}, {{chatbotName}}, {{machineSpecs}}, {{customerName}} |
| `model` | openai/gpt-4o-mini |
| `temperature` | 0.4 (più creativo per risposte naturali) |
| `maxTokens` | 512 |
| `availableFunctions` | [] (future: bookAppointment, checkPayment, etc.) |

### FlowNodeConfig — Configurazione Macchina (NON è un LLM)

| Campo | Uso |
|---|---|
| `flowKey` | Identificativo macchina (es. "lavatrice_hs60xx") |
| `flowLabel` | Nome leggibile (es. "Lavatrice HS-60XX") |
| `machineSpecs` | Specs tecniche: capacità, programmi, prezzi, note (testo passato a History Agent) |
| `flows` | JSON dell'albero decisionale (letto da FlowEngine) |
| `availableFunctions` | Per future integrazioni API esterne |
| `isActive` | on/off |

**Campi RIMOSSI da FlowNodeConfig** (non servono più):
- ~~systemPrompt~~ → rinominato in `machineSpecs` (non è un prompt LLM)
- ~~model~~ → FlowEngine non chiama LLM
- ~~temperature~~ → FlowEngine non chiama LLM
- ~~maxTokens~~ → FlowEngine non chiama LLM

### FAQ — Tabella FAQ (invariata)

| Campo | Uso |
|---|---|
| `question` | Domanda FAQ |
| `answer` | Risposta FAQ |
| `workspaceId` | Isolamento workspace |
| `isActive` | on/off |

Le FAQ vengono caricate e passate a History Agent come variabile `{{faqs}}`.

---

## 6. Costo LLM per Scenario

| Scenario | Path | FlowClassifier | FlowEngine | FlowAgentLLM | Totale LLM |
|---|---|---|---|---|---|
| "Hola!" | C | — | — | 1 call | **1 call** |
| "Che orari?" (FAQ) | C | — | — | 1 call | **1 call** |
| "Non parte" (gather info) | C | — | — | 1 call | **1 call** |
| "42" (assegna + startFlow) | B/C | — | 1 exec (0 token) | 1 call | **1 call** |
| "1" (step nel flow attivo) | **A** | 1 exec (0 token) | 1 exec (0 token) | — | **0 calls** |
| "Quanto costa?" (FAQ durante flow) | **A→C** | INTERRUPT_FAQ | — | 1 call | **1 call** |
| "Voglio operatore" | C | — | — | 1 call | **1 call** |
| Input ambiguo durante flow | **A** | AMBIGUOUS | retry/escalate | — | **0 calls** |

**PATH A (flow attivo) = sempre 0 chiamate LLM.** `FlowClassifierService` è codice puro.
**PATH B/C = 1 sola chiamata LLM** (`FlowAgentLLM` fa routing + risposta insieme).

---

## 7. Regole Anti-Conflitto

| Regola | Perché |
|---|---|
| Router NON ha FAQ nel prompt | Non può rispondere, solo classificare |
| Router NON ha tono di voice | Non può formulare risposte |
| Router NON ha specs macchina | Non può rispondere su programmi/prezzi |
| History Agent NON ha calling functions di routing | Non può smistare |
| History Agent NON decide quale flow avviare | Decisione è del Router |
| FlowEngine NON interpreta input | Solo numeri/sì/no normalizzati |
| Orchestratore gestisce contactOperator da FlowEngine | Non è compito di Router né History |
| Una sola voce (History Agent) | Tono sempre coerente |

---

## 8. Differenza con architettura precedente

| Aspetto | Prima | Adesso |
|---|---|---|
| SubLLM | LLM separato per macchina con proprio prompt | **NON ESISTE PIÙ** — FlowNodeConfig è solo dati (specs + JSON) |
| Chi parla al cliente | Chiunque (Router, SubLLM, FlowEngine) | **Solo History Agent** |
| FAQ | Nel prompt del Router | Nel prompt di **History Agent** via {{faqs}} |
| Specs macchina | Nel systemPrompt del SubLLM | In `FlowNodeConfig.machineSpecs`, passate a **History Agent** |
| Numero di LLM call | 1-2 variabile | **Sempre 2** (Router + History) |
| Flow durante FAQ | Interrotto o confuso | **Pausato**, History ricorda e chiede se riprendere |
| Calling functions routing | Sparse su Router e SubLLM | **Solo su Router** |
| Calling functions servizio | Sparse | **Solo su History Agent** (future) |

---

## 9. Flusso di Raccolta Info (Gathering)

Il Router raccoglie info conversazionalmente in più messaggi:

```
Msg 1: "Non parte"
  Router: salva problemDescription, need=locale
  History: "No te preocupes. ¿En qué local estás?"

Msg 2: "Goya"
  Router: salva locale=Goya, need=machine_type
  History: "¿Es una lavadora o una secadora?"

Msg 3: "Lavadora 42"
  Router: salva tipo+numero → assignMachine() → startFlow()
  FlowEngine: step_0
  History: "Perfecto. Vamos a revisarlo. ¿Qué ves en el display? 1️⃣ Puerta..."
```

Il Router può essere intelligente: se il cliente dice "La lavadora 42 de Goya no parte", raccoglie TUTTO in un colpo e salta direttamente ad assignMachine + startFlow.

---

## 10. Classificazione Input durante Flow Attivo

⚠️ **quando il flow è attivo, il Router NON viene chiamato.**

`FlowClassifierService` (codice puro, 0 token LLM) classifica l'input strutturalmente:

```
input: "1" / "2" / "sì" / "no" / "ok"  → MATCH         → FlowEngine.handleMessage() → avanza nodo
input: "quanto costa?" / "orari?"       → INTERRUPT_FAQ → flow in PAUSA → PATH C (risponde FAQ, poi ri-mostra step)
input: "STOP" / "annulla" / "restart"  → HARD_BREAK    → escalate → contactOperator()
input: "aspetta" / "un secondo"         → SOFT_BREAK    → flow in PAUSA, messaggio "ok quando vuoi"
input: "boh" / "non lo so" / "???" / qualsiasi testo → AMBIGUOUS → vedi sotto
```

**Regola MATCH:** solo `/^([1-9]|sì|yes|ok|no|nope)$/i` — nessun altro pattern.

**AMBIGUOUS → gestione già implementata nel codice (`handleAmbiguous()`):**
```
interruptCount++
se < INTERRUPT_HARD_LIMIT → restituisce node.onInterruptFallback (es. "No pasa nada 🙂 — dime el número")
se >= INTERRUPT_HARD_LIMIT → escalate → contactOperator()
```
> ⚠️ ChatGPT ha suggerito di aggiungere `FLOW_INVALID_INPUT` — **non serve**: AMBIGUOUS già copre "boh", "non lo so", "???" con retry+escalate. È un alias inutile.

**Resume dopo PAUSA — UX critica:**
Quando il flow era PAUSED e l'utente riprende (es. risponde "vale" dopo una FAQ), FlowEngine deve **ri-mostrare il prompt dello step corrente** prima di attendere input:
```
FlowEngine.handleResume() → return currentNode.prompt  // NON silenzioso
```
Senza questo, l'utente non ricorda cosa stava vedendo sul display.

**Zero keyword detection per contenuto semantico** — quella è responsabilità di FlowAgentLLM in PATH B/C.

---

## 11. Checklist Copertura — PDF Playbook vs Architettura

### Problemi macchina (PDF Lavadora + Secadora)

| Caso | Chi gestisce | Come |
|---|---|---|
| Display SEL/PUSH/DOOR/Credito | FlowEngine (nodi deterministici) | step → azione → "Ha funzionato?" |
| ALM (tutti i tipi) | FlowEngine (nodo ALM con sotto-tipi) | STOP → retry → escalate |
| END + bAL (desequilibrio) | FlowEngine (nodo terminale) | Escalate + compensazione |
| STOP premuto | FlowEngine (ramo STOP) | Prima volta? → **ESCALATE** (operatore decide compensazione, mai automatica) |
| Ropa bagnata/non centrifugata | FlowEngine (ramo post-ciclo) | Separare carico |
| Non asciuga / troppo umida | FlowEngine (ramo asciugatrice) | Aggiungere tempo / rilavare |
| Porta bloccata | FlowEngine (nodo) | Attendere sblocco |
| Rumore / guasto | FlowEngine (nodo terminale) | Escalate |
| Ropa bruciata / plastico / macchiata | FlowEngine (nodi terminali) | NO compensazione / compensazione parziale |
| Odore | FlowEngine (nodo) | Pulire cestello |
| No sapone/schiuma | History Agent (FAQ) | Detergente industriale, è normale |
| Macchina occupata | History Agent (FAQ) | Togli ropa, metti su tavolo |
| Filtro sporco (secadora) | FlowEngine (nodo) | Pulire filtro e sensore |

### FAQ generiche (Playbook §5.3-5.10)

| Caso | Chi gestisce | Come |
|---|---|---|
| Doppio addebito | History Agent (FAQ) | Chiede dati, formulario, email |
| Ho pagato ma non si attiva | Router (classifica) + FlowEngine | Se ha macchina → flow. Se no → FAQ |
| Errore AL001 | History Agent (FAQ) | Spiegazione sequenza |
| Ho un codice | History Agent (FAQ) | Regole codice compensazione |
| Rimborso | History Agent (FAQ) | Formulario + email |
| Fattura | History Agent (FAQ) | Email olga@alberwaz.net + dati |
| Carta fedeltà | History Agent (FAQ) | Regole per locale |
| Orari/prezzi | History Agent (FAQ) | Info per locale |
| Frode/incoerenza | Router (rileva) → Escalate | MAI accusare, raccogliere dati |
| Compensazioni | History Agent (FAQ) + Escalate | Regole, non promettere automaticamente |

### Gestione dialogo

| Caso | Chi gestisce | Come |
|---|---|---|
| Cambio argomento durante flow | Router (classifica) | Flow in pausa, History risponde + chiede se riprendere |
| Cambio lingua | Router (changeLanguage) | Translation Agent adatta |
| Cambio macchina | Router (reassign) | Cancella flow, riassegna |
| Richiesta operatore | Router (contactOperator) | History conferma escalazione |
| Saluto | Router (GREETING) | History saluta con tono |
| Messaggio ambiguo | Router (GATHER_INFO) | History chiede chiarimento |

---

## 12. Analisi Critica — ChatGPT Round 2 (5 punti)

### Punto 1 — `FLOW_INVALID_INPUT`: ChatGPT ha **TORTO** ❌

**Claim**: "boh", "non lo so", "???" finiscono in `FLOW_INPUT` e rompono FlowEngine.

**Realtà nel codice**: `FlowClassifierService` già classifica qualsiasi testo non-numerico come **AMBIGUOUS** (non MATCH). `handleAmbiguous()` in `FlowEngineService` gestisce esattamente questi casi con `node.onInterruptFallback` e poi escalate dopo `INTERRUPT_HARD_LIMIT`. Aggiungere `FLOW_INVALID_INPUT` è un alias di AMBIGUOUS — zero valore, solo rumore.

---

### Punto 2 — Resume step visibile: ChatGPT ha **RAGIONE** ✅

**Claim**: Quando il flow riprende dopo PAUSA, l'utente non ricorda più il prompt corrente.

**Gap reale**: Confermato. FlowEngine riprende silenziosamente dallo step — ma non ri-invia `currentNode.prompt`. Fix documentato in Section 10.

---

### Punto 3 — `gatherState.retryCount`: ChatGPT ha **RAGIONE PARZIALE** ⚠️

**Claim**: Loop infinito su GATHER_INFO se utente risponde "non lo so".

**Parte corretta**: Il loop è un rischio reale — senza contatore, Router può iterare indefinitamente.

**Parte over-engineered**: "Semplifica domanda al tentativo 2" è semantica che appartiene al prompt del Router/History, non a un campo nel context. Il fix giusto è solo `retryCount` con soglia di escalate — documentato in Section 4.

---

### Punto 4 — Compensazione automatica Scenario 14: ChatGPT ha **RAGIONE** ✅

**Claim**: "Prima volta → compensazione gratuita" contraddice il playbook (§7: non promettere automaticamente).

**Fix applicato**: Scenario 14 corretto — ora FlowEngine escala sempre, operatore decide.

---

### Punto 5 — "Una sola domanda per turno": ChatGPT ha **RAGIONE** ✅

**Claim**: History Agent può fare 2+ domande nello stesso messaggio, violando le regole di supporto.

**Fix applicato**: Regola aggiunta esplicitamente nella sezione priorità fonti.

---

**Verdetto finale Round 2**: 4/5 punti validi (1 falso positivo su FLOW_INVALID_INPUT, già gestito da AMBIGUOUS). I 3 fix reali (resume visibile, retryCount, no compensazione automatica) sono documentati.

---

## 13. Analisi Critica — ChatGPT Round 1

### 🟡 Problema 2: Flow TTL — ChatGPT ha PARZIALMENTE ragione

**Claim:** `lastValidStepAt` esiste ma il comportamento TTL non è definito → se l'utente torna dopo 2 ore/1 giorno il flow riprende, rompendo la UX.

**Codice reale:** `checkAndResetExpiredSession()` in `FlowWorkspaceStrategy` gestisce già un TTL basato su `workspace.sessionResetTimeout`, ma **solo dopo una escalation** (`chatSession.escalatedAt`). Un flow ACTIVE o PAUSED senza escalation non ha reset automatico.

**Dove ChatGPT ha ragione:**
- Se un cliente avvia la diagnosi alle 10:00, si ferma al passo 2 e torna alle 17:00, il flow riprende dove era rimasto. Tecnicamente è un rischio reale.

**Dove ChatGPT esagera:**
- Nel contesto **laundromat**, il cliente è fisicamente alla macchina quando scrive. Il flow diagnostico dura 3-5 messaggi in pochi minuti.
- Riprendere un flow "porta bloccata" dopo 2 ore non è drammatico: il cliente dice "sì" o "no" e si risolve. È UX friction, non UX failure.
- Non è comparabile a riprendere un checkout o un form multi-step complesso.

**Comportamento attuale per caso PAUSED:**
- Flow in PAUSA (dopo FAQ o SOFT_BREAK): riprende normalmente → accettabile
- Flow ACTIVE interrotto senza escalation: riprende dallo step → accettabile nel contesto

**Fix raccomandato (leggero, non urgente):**
```typescript
// In FlowEngineService.handleMessage() — dopo aver caricato il context
const FLOW_ACTIVE_TTL_HOURS = 4 // configurabile per workspace
if (chatContext.flowState?.lastValidStepAt) {
  const elapsed = Date.now() - new Date(chatContext.flowState.lastValidStepAt).getTime()
  if (elapsed > FLOW_ACTIVE_TTL_HOURS * 3600_000) {
    // Cancella flow silenziosamente → PATH B/C riparte da zero
    delete chatContext.flowState
    // FlowAgentLLM gestisce il re-entry naturalmente
  }
}
```

**Verdetto:** ⚠️ Valido ma bassa priorità per il caso laundromat. Da aggiungere come `FLOW_ACTIVE_TTL_HOURS` configurabile nel workspace.

---

### 🔴 Problema 3: "Super Prompt" — ChatGPT ha TORTO

**Claim:** History Agent / FlowAgentLLM riceve troppi dati (FAQ + machineSpecs + flow output + decisioni router + tono + storico + cliente) → "super prompt" → degrado qualità nel tempo.

**Perché il claim è sbagliato:**

| Argomento ChatGPT | Realtà |
|---|---|
| "Troppi dati → qualità cala" | LLM performano MEGLIO con più contesto, non peggio |
| "Super prompt = anti-pattern" | È il pattern RAG standard — tutte le piattaforme AI usano questo approccio |
| "Rischio degrado nel tempo" | Il degrado sarebbe da token overflow, non da "troppi tipi di dato" |

**Budget token reale:**
```
Storico ultima ora:    ~1.000 token (10 messaggi × 100 tok)
machineSpecs (1 macchina): ~300 token
FAQ Ecolaundry (~20 FAQ):  ~800 token
flowEngine output:          ~100 token
Tono + variabili:           ~200 token
─────────────────────────────────────
Totale prompt:          ~2.400 token
Limite gpt-4o-mini:   128.000 token
Utilizzo:               ~1.9% ✅
```

**Il VERO rischio (non quello di ChatGPT):**
L'unica minaccia reale è se le FAQ crescono a 500+ voci non filtrate:
- 500 FAQ × 150 tok = 75.000 token → problema reale
- Soluzione: pre-filtro semantico (top 5-10 FAQ rilevanti al messaggio), non rimozione del contesto

**Perché dividere sarebbe peggio:**
- 2 LLM separati (Router + History) = doppio costo, doppia latenza
- Il passaggio di informazioni tra LLM crea rischio di perdita di contesto
- Un solo LLM con tutto il contesto è più coerente e meno costoso

**Verdetto:** ❌ ChatGPT sbaglia. Il pattern attuale è corretto. L'unica ottimizzazione futura è il **pre-filtro semantico delle FAQ** se superano ~50 voci.

---

## 13. Riepilogo Finale

```
                 ┌─────────────────────────────────────┐
                 │  FlowWorkspaceStrategy (orchestratore)│
                 └─────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
      PATH A          PATH B          PATH C
   (flow attivo)   (flowKey set)    (no flowKey)
        │                │               │
        ▼                ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│FlowClassifier│  │ FlowAgentLLM │  │ FlowAgentLLM │
│(codice puro) │  │(sub-macchina)│  │  (router)    │
│              │  │              │  │              │
│MATCH/BREAK/  │  │ 1 call LLM   │  │ 1 call LLM   │
│FAQ/AMBIGUOUS │  │routing+reply │  │routing+reply │
│              │  │              │  │              │
│  0 token     │  │ ~500 tok     │  │ ~500 tok     │
└──────────────┘  └──────────────┘  └──────────────┘
        │
        ▼
┌──────────────┐
│  FlowEngine  │
│(deterministico)│
│  0 token     │
│  JSON puro   │
└──────────────┘
```

**PATH A = 0 LLM calls.** `FlowClassifierService` gestisce tutto strutturalmente.
**PATH B/C = 1 LLM call.** `FlowAgentLLM` fa routing + risposta finale in una sola call.
**3 percorsi, responsabilità chiare, zero conflitti, copertura 100% dei casi PDF.**
