# Flow Engine Architecture — Infrastruttura Generica per Workspace Guidati

## Panoramica

Infrastruttura generica per chatbot **deterministici a step** su qualsiasi dominio che richiede guida sequenziale: macchine self-service, processi di supporto tecnico, onboarding, troubleshooting strutturato.

**Esempio concreto**: lavanderia self-service — l'utente scansiona un QR sulla macchina → WhatsApp → chatbot guida il troubleshooting passo per passo. Ma il sistema è identico per qualsiasi altro caso d'uso.

---

## Pipeline Infrastrutturale Completa

```
MESSAGGIO IN INGRESSO (WhatsApp o Widget)
         ↓
FlowWorkspaceStrategy  (ChannelMode.FLOW — isolato da Ecommerce e Informational)
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — SECURITY (solo Widget)                                │
│  SecurityAgent.process()  ← già esistente, già cablato          │
│  WhatsApp: sicurezza gestita dal WhatsApp Queue Scheduler       │
│  → se unsafe: blocca e restituisce messaggio di rifiuto         │
└─────────────────────────────────────────────────────────────────┘
         ↓ (solo se safe)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2 — ROUTING                                               │
│  IF flowState ACTIVE in ChatSession.context                     │
│    → FlowEngineService  (deterministico, zero LLM)              │
│  ELSE IF QR code (START_FLOW_*)                                 │
│    → carica FlowNodeConfig, salva context, welcome message      │
│  ELSE                                                           │
│    → FlowAgentLLM  (sub-LLM isolato, config da DB)              │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3 — FlowAgentLLM (quando non c'è flow attivo)             │
│  - carica systemPrompt, model, temperature da FlowNodeConfig    │
│  - carica storia (ConversationManager, ultimi 24h, DB)          │
│  - costruisce tools dinamicamente da flows + availableFunctions │
│  - chiama OpenRouter                                            │
│  - tool_call "startFlow" → FlowEngineService.startFlow()        │
│    → risultato aggiunto alla history → LLM formula risposta     │
│  - tool_call "contactOperator" → contactOperator() esistente    │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4 — FlowEngineService (quando flow è ACTIVE)              │
│  - legge ChatSession.context.flowState                          │
│  - classifica input: HARD_BREAK / SOFT_BREAK / MATCH /          │
│    INTERRUPT_FAQ / AMBIGUOUS                                    │
│  - esegue transizione → nodo successivo                         │
│  - scrive nuovo stato in ChatSession.context                    │
│  - ritorna nodePrompt                                           │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5 — TRANSLATION                                           │
│  TranslationAgent  ← già esistente, da aggiungere al strategy   │
│  - traduce risposta nella lingua del cliente                    │
│  - applicato sia a risposte FlowEngine che FlowAgentLLM         │
└─────────────────────────────────────────────────────────────────┘
         ↓
Risposta → WhatsApp Queue / Widget

```

---

## Memoria Conversazione

**Dove è salvata**: `conversation_messages` (PostgreSQL) — stesso modello usato da Ecommerce e Informational.

**Chi la carica**: `ConversationManager.loadHistory(workspaceId, conversationId)` — ultimi **24 ore** di messaggi per conversationId. Il `FlowAgentLLM` usa questo identico servizio, nessuna implementazione nuova.

**Chi la pulisce**: Scheduler cron esistente — ogni domenica alle 03:00 → cancella messaggi più vecchi di **30 giorni**.

**Formato storia al LLM**:
```
[ { role: "user",      content: "la lavatrice non parte" },
  { role: "assistant", content: null, tool_calls: [startFlow] },
  { role: "tool",      content: "step_0: Cosa vedi sul display?" },
  { role: "assistant", content: "Dimmi cosa vedi sul display:\n1️⃣ SEL..." },
  { role: "user",      content: "SEL" },  ← prossimo messaggio
  ...
]
```

---

## Security & Translation — Copertura per Canale

| Layer | WhatsApp | Widget |
|---|---|---|
| **Security (input)** | Gestito da WhatsApp Queue Scheduler (delivery side) | `SecurityAgent` ✅ già cablato in `flow-workspace.strategy.ts` |
| **Translation (output)** | `TranslationAgent` ← da aggiungere al strategy | `TranslationAgent` ← da aggiungere al strategy |

**Nota**: `SafetyTranslationAgent` è DEPRECATED. I due agent separati (`SecurityAgent` + `TranslationAgent`) sono quelli attivi.

---

## Il Problema con LLM-only

Con un approccio 100% LLM:

```
Prompt: "Segui questi step nell'ordine: 1. chiedi display, 2. analizza, 3. rispondi"
Utente: "mi dice 4 euro"
LLM:    "Ti mancano 4€, inserisci il credito"  ← ha saltato il passo 1
```

L'LLM interpreta le istruzioni come **linee guida**, non come **regole eseguibili**.

---

## Architettura Dettagliata

```
Messaggio in ingresso
         ↓
FlowWorkspaceStrategy (entry point per ChannelMode.FLOW)
         ↓
┌─────────────────────────────────────────┐
│  Router LLM                             │
│  - risponde a FAQ generali del workspace│
│  - se messaggio = QR (START_FLOW_*)     │
│    → carica FlowNodeConfig dal DB       │
│    → identifica flowKey                 │
│    → salva in ChatSession.context       │
│    → mostra welcome message             │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  C'è flowState ACTIVE in sessione?      │
│  SÌ → FlowEngineService                 │ ← DETERMINISTICO
│       (step da JSON in DB, zero LLM)    │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  NO → FlowAgentLLM (sub-LLM)            │ ← LLM isolato, config da DB
│  - systemPrompt specifico per flowKey   │
│  - risponde a FAQ tecniche              │
│  - calling functions dinamiche:         │
│    → startFlow(flowId)                  │
│    → contactOperator()                  │
└─────────────────────────────────────────┘
```

---

## Componenti

### 1. FlowNodeConfig (DB)

**Un record per ogni tipo di entità configurabile** (macchina, processo, flusso di supporto) per workspace.
Il sistema è generico: la "macchina lavatrice" è solo un esempio di entità.

```json
{
  "id": "uuid",
  "workspaceId": "ws-123",
  "flowKey": "lavatrice_hs60xx",
  "flowLabel": "Lavatrice HS-60XX",
  "systemPrompt": "Sei l'assistente tecnico della lavatrice HS-60XX...",
  "temperature": 0.3,
  "model": "openai/gpt-4o-mini",
  "availableFunctions": ["startFlow", "contactOperator"],
  "flows": { ... }
}
```

**Le calling functions del `FlowAgentLLM` vengono costruite dinamicamente:**
```typescript
// Al runtime, NON hardcoded nel codice
const flowIds = Object.keys(flowNodeConfig.flows)
// → ["non_parte", "errore_alm", "lavaggio_problema"]

// startFlow enum creato dai flow presenti in DB
// contactOperator abilitato solo se in availableFunctions
```

```json
{
  "flows": {
    "non_parte": {
      "step_0": {
        "prompt": "What do you see on the display?\n1️⃣ SEL\n2️⃣ PUSH / Pr\n3️⃣ door\n4️⃣ A number (e.g. 04.00)\n5️⃣ Other",
        "transitions": {
          "1": "caso_sel",
          "2": "caso_push",
          "3": "caso_door",
          "4": "caso_importo",
          "5": "caso_extra"
        },
        "onInterruptFallback": "Let's focus on the machine 🔧\nWhat do you see on the display?"
      },
      "caso_sel": {
        "prompt": "SEL means you need to select a program.\n👉 Press any program button to start.",
        "isTerminal": true,
        "transitions": {}
      },
      "caso_push": {
        "prompt": "You've inserted the credit but haven't selected a program yet.\n👉 Press any program button to start the wash.",
        "isTerminal": true,
        "transitions": {}
      },
      "caso_door": {
        "prompt": "The door is open.\n👉 Close the door firmly to start the wash.",
        "isTerminal": false,
        "transitions": { "default": "ask_resolved" }
      },
      "caso_importo": {
        "prompt": "Not enough credit.\n👉 Insert the amount shown on the display.",
        "isTerminal": false,
        "transitions": { "default": "ask_resolved" }
      },
      "ask_resolved": {
        "prompt": "Did that solve the problem? (yes / no)",
        "transitions": { "YES": "end_success", "NO": "handle_escalate" }
      },
      "end_success": {
        "prompt": "Great! ✅ Enjoy your wash 👍",
        "isTerminal": true,
        "transitions": {}
      },
      "handle_escalate": {
        "prompt": "I understand 😔\nI'm contacting an operator — they'll get back to you shortly.",
        "isTerminal": true,
        "transitions": {}
      }
    },
    "errore_alm": {
      "step_0": {
        "prompt": "What code do you see after ALM?\n1️⃣ ALM/A (water intake)\n2️⃣ ALM/E (drainage)\n3️⃣ ALM/door\n4️⃣ ALM/VAr",
        "transitions": {
          "1": "alm_acqua",
          "2": "alm_scarico",
          "3": "alm_door",
          "4": "alm_var"
        },
        "onInterruptFallback": "Tell me the code you see after ALM 🔧"
      }
    },
    "lavaggio_problema": {
      "step_0": {
        "prompt": "What problem are you noticing?\n1️⃣ Didn't spin / clothes still wet\n2️⃣ END + bAL on the display",
        "transitions": {
          "1": "no_centrifuga",
          "2": "end_bal"
        },
        "onInterruptFallback": "Describe what happened during the wash 🔧"
      }
    }
  }
}
```

---

### 2. ChatSession.context (stato sessione)

Salvato nel campo `context` JSON già esistente in `ChatSession`.
Zero nuove tabelle necessarie.

```json
{
  "flowKey": "lavatrice_hs60xx",
  "flowNumber": "2",
  "flowState": {
    "flowId": "non_parte",
    "currentNodeId": "step_0",
    "flowStatus": "ACTIVE",
    "interruptCount": 0,
    "lastInterruptType": null,
    "lastValidStepAt": "2026-04-15T10:00:00Z"
  }
}
```

**flowStatus valori:**
- `ACTIVE` → flow in corso
- `PAUSED` → utente ha detto "lascia stare"
- `COMPLETED` → risolto con successo
- `ESCALATED` → passato a operatore

---

### 3. FlowEngineService (logica deterministica)

Responsabilità:
- Carica il flow da DB (`FlowNodeConfig.flows[flowId]`)
- Legge stato da `ChatSession.context`
- Classifica input utente
- Esegue transizione → nodo successivo
- Non chiama MAI l'LLM per decidere il prossimo step

**Pipeline di classificazione input** (in ordine di priorità):

```
1. HARD_BREAK  → "operatore", "umano", "chiama"  → escalation immediata
2. SOFT_BREAK  → "lascia stare", "basta", "stop" → pausa gentile
3. MATCH       → numero "1"-"5", "sì", "no"      → avanza nel flow
4. INTERRUPT_FAQ → "costa?", "orari?", "come funziona?" → rispondi + torna
5. AMBIGUOUS   → tutto il resto                  → chiedi chiarimento
```

**Gestione interrupt:**

```
interrupt 1-2 → rispondi + torna al flow
interrupt 3   → "Risolviamo prima il problema, poi ci occupiamo del resto"
interrupt 4+  → escalation a operatore
```

Reset `interruptCount` quando:
- l'utente avanza al nodo successivo
- sono passati più di 30 minuti dall'ultimo step valid

---

### 4. FlowAgentLLM (sub-LLM isolato)

**È un LLM completamente separato** da `EcommerceAgentLLM` e da `InformationalAgentLLM`.

- Istanziato dinamicamente quando `ChatSession.context.flowKey` è presente
- `systemPrompt`, `model`, `temperature` vengono letti dal `FlowNodeConfig` in DB — mai hardcoded
- Ha la propria storia conversazione isolata (non condivisa con altri workspace type)
- Le calling functions vengono costruite a runtime dai flow presenti in DB

**Costruzione dinamica delle calling functions:**

```typescript
// FlowAgentLLM.buildTools(flowNodeConfig)
const flowIds = Object.keys(flowNodeConfig.flows)

const tools = [
  {
    name: "startFlow",
    description: "Avvia un flow guidato di troubleshooting",
    parameters: {
      flowId: { type: "string", enum: flowIds }  // ← DINAMICO dal DB
    }
  },
  // contactOperator solo se configurato per questa macchina
  ...(flowNodeConfig.availableFunctions.includes("contactOperator")
      ? [contactOperatorTool]
      : [])
]
```

Quando l'LLM rileva un problema tecnico → chiama `startFlow(flowId)` → il FlowEngine prende il controllo.

**Storia conversazione:**

```typescript
// ConversationHistory isolata per sessionId + flowKey
// NON mescola messaggi di sessioni ecommerce/informational
```

---

### 5. Escalation a Operatore

**Già esistente nel progetto** — stessa implementazione degli altri agenti (ecommerce, info).

Viene attivata in 3 modi:

```
1. Utente scrive "voglio un operatore" / "parlare con una persona"
   → FlowEngine: classificazione HARD_BREAK
   → chiama contactOperator()

2. Nodo terminale "handle_escalate" nel flow JSON
   → FlowEngine imposta flowStatus = "ESCALATED"
   → chiama contactOperator()

3. FlowAgentLLM rileva frustrazione o lamentela
   → chiama direttamente contactOperator() come calling function
```

**Cosa fa `contactOperator()` (già implementato):**
- Manda email/WhatsApp all'operatore con riassunto conversazione
- Il riassunto include: flowKey, flowNumber, ultimo step del flow, messaggi recenti
- Stesso sistema usato da ecommerce e info workspace

**Nessun codice nuovo** per la parte di notifica operatore — basta passare `flowContext` come contesto aggiuntivo nel riassunto.

---

## Ordine di Implementazione

```
1. Schema Prisma — aggiornare FlowNodeConfig con i campi corretti
2. Migration DB
3. FlowEngineService — logica pura, testabile
4. FlowAgentLLM — agente LLM con calling functions
5. FlowWorkspaceStrategy — orchestratore (riscrivere il placeholder attuale)
6. Unit tests FlowEngineService
7. Seed dati — flow lavatrice HS-60XX di esempio
```

---

## Stato Attuale del Codice

| Componente | File | Stato |
|---|---|---|
| `ChannelMode.FLOW` | `packages/database/prisma/schema.prisma` | ✅ esiste |
| `FlowWorkspaceStrategy` | `apps/backend/src/strategies/flow-workspace.strategy.ts` | ⚠️ placeholder — usa LLM generica |
| Tabella `flow_node_configs` | migration SQL | ✅ migration esiste, schema Prisma da aggiornare |
| `WorkspaceCallingFunction` | `apps/backend/src/repositories/workspace-calling-function.repository.ts` | ✅ completo |
| `ChatSession.context` | schema Prisma | ✅ già disponibile per salvare flowState |
| `FlowEngineService` | — | ❌ da creare |
| `FlowAgentLLM` | — | ❌ da creare |

---

## Esempi Concreti — Macchine Identificate nei PDF

I due modelli identificati nei manuali tecnici reali:

| Macchina | flowKey | QR trigger |
|---|---|---|
| Lavatrice HS-60XX | `lavatrice_hs60xx` | `START_FLOW_2_WASHER` |
| Asciugatrice ED-340 | `asciugatrice_ed340` | `START_FLOW_1_DRYER` |

---

### FlowNodeConfig — Lavatrice HS-60XX (completo)

Questo è esattamente il record che viene salvato in DB e che `FlowAgentLLM` + `FlowEngineService` leggono.

```json
{
  "id": "cuid_generated",
  "workspaceId": "ws-lavanderia-123",
  "flowKey": "lavatrice_hs60xx",
  "flowLabel": "Lavatrice HS-60XX",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 512,
  "availableFunctions": ["startFlow", "contactOperator"],

  "systemPrompt": "You are the expert technical assistant for the HS-60XX self-service washer.\n\nYou know the machine perfectly and all common issues based on the real technical manual.\n\n## 🎯 OBJECTIVE\n- Help the user understand the problem with the washer\n- Guide them toward a simple and safe solution\n- ALWAYS activate a guided flow when the issue is technical\n\n## ⚠️ CORE RULE\nDO NOT resolve complex technical issues directly.\nIf the user has an operational problem:\n👉 YOU MUST call startFlow(flowId)\n\n## 📌 AVAILABLE FLOWS\n- \"won_t_start\" → startup issues (credit, display, door, program)\n- \"alm_error\" → ALM error codes\n- \"wash_issue\" → problems after wash (spin, wet clothes)\n\n## ✅ WHAT YOU CAN DO WITHOUT A FLOW\n- Answer simple questions (programs, temperatures, basic usage)\n- If the user asks non-technical questions → answer normally\n\n## ❌ DO NOT\n- DO NOT invent technical solutions\n- DO NOT skip directly to a technical answer\n- DO NOT bypass the flows",

  "flows": {
    "entry": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "Tell me what's happening 👇\n\n1️⃣ Machine won't start\n2️⃣ Error / alarm code\n3️⃣ Problem during or after the wash",
        "transitions": {
          "1": "non_parte.step_0",
          "2": "errore_alm.step_0",
          "3": "lavaggio_problema.step_0"
        },
        "onInterruptFallback": "Let's focus on the washer 🔧\nWhat's happening?"
      }
    },

    "non_parte": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "What do you see on the washer display?\n\n1️⃣ SEL\n2️⃣ PUSH / Pr\n3️⃣ door\n4️⃣ A number (e.g. 04.00)\n5️⃣ EXTRA light is on",
        "transitions": {
          "1": "non_parte.caso_sel",
          "2": "non_parte.caso_push",
          "3": "non_parte.caso_door",
          "4": "non_parte.caso_importo",
          "5": "non_parte.caso_extra"
        },
        "onInterruptFallback": "Check the display 👀\nWhat does it say?"
      },
      "caso_sel": {
        "type": "INFO",
        "prompt": "SEL means you need to select a program.\n👉 Press any program button to start.",
        "isTerminal": true
      },
      "caso_push": {
        "type": "INFO",
        "prompt": "You've inserted the credit but haven't selected a program yet.\n👉 Press any program button to start the wash.",
        "isTerminal": true
      },
      "caso_door": {
        "type": "ACTION",
        "prompt": "The door is open.\n👉 Close the door firmly to start the wash.",
        "transitions": { "default": "non_parte.ask_resolved" }
      },
      "caso_importo": {
        "type": "ACTION",
        "prompt": "Not enough credit.\n👉 Insert the amount shown on the display (e.g. €4.00).",
        "transitions": { "default": "non_parte.ask_resolved" }
      },
      "caso_extra": {
        "type": "INFO",
        "prompt": "An EXTRA option may be active.\n👉 If an EXTRA button is lit:\n- if you don't want it → deactivate it\n- if you want it → insert the remaining credit",
        "isTerminal": true
      },
      "ask_resolved": {
        "type": "CONFIRMATION",
        "prompt": "Did that solve the problem? (yes / no)",
        "transitions": {
          "YES": "non_parte.end_success",
          "NO": "non_parte.handle_escalate"
        }
      },
      "end_success": {
        "type": "INFO",
        "prompt": "Great! ✅ Enjoy your wash 👍",
        "isTerminal": true
      },
      "handle_escalate": {
        "type": "INFO",
        "prompt": "I understand 😔\nI'm contacting an operator to help you.",
        "isTerminal": true
      }
    },

    "errore_alm": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "What code do you see after ALM?\n\n1️⃣ ALM/A (water intake)\n2️⃣ ALM/E (drainage)\n3️⃣ ALM/door\n4️⃣ ALM/VAr",
        "transitions": {
          "1": "errore_alm.alm_acqua",
          "2": "errore_alm.alm_scarico",
          "3": "errore_alm.alm_door",
          "4": "errore_alm.alm_var"
        },
        "onInterruptFallback": "Tell me the code after ALM 🔧"
      },
      "alm_acqua": {
        "type": "ACTION",
        "prompt": "Water intake problem.\n👉 Press STOP once.\nIf the issue persists, please use another machine.",
        "isTerminal": true
      },
      "alm_scarico": {
        "type": "ACTION",
        "prompt": "Drainage problem.\n👉 Press STOP once.\n\n⚠️ The door may stay locked for up to 30 minutes while the water drains.\n\nIf the issue persists, please use another machine.",
        "isTerminal": true
      },
      "alm_door": {
        "type": "ACTION",
        "prompt": "Door latch problem.\n👉 Press STOP once.\nIf the issue persists, please use another machine.",
        "isTerminal": true
      },
      "alm_var": {
        "type": "INFO",
        "prompt": "Technical machine fault.\n👉 Please use another machine.\nWe'll provide a compensation 👍",
        "isTerminal": true
      }
    },

    "lavaggio_problema": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "What problem did you notice?\n\n1️⃣ Didn't spin / clothes still wet\n2️⃣ END + bAL on the display",
        "transitions": {
          "1": "lavaggio_problema.no_centrifuga",
          "2": "lavaggio_problema.end_bal"
        },
        "onInterruptFallback": "Describe what happened during the wash 🔧"
      },
      "no_centrifuga": {
        "type": "INFO",
        "prompt": "The load was probably too large or unbalanced.\n👉 Split the load and run a new wash cycle.",
        "isTerminal": true
      },
      "end_bal": {
        "type": "INFO",
        "prompt": "The wash finished but the spin cycle failed due to an unbalanced load.\n👉 Split the load and run a new wash cycle.",
        "isTerminal": true
      }
    }
  }
}
```

---

### FlowNodeConfig — Asciugatrice ED-340 (schema minimo)

```json
{
  "flowKey": "asciugatrice_ed340",
  "flowLabel": "Asciugatrice ED-340",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "availableFunctions": ["startFlow", "contactOperator"],
  "systemPrompt": "You are the technical assistant for the ED-340 self-service dryer. ...",

  "flows": {
    "non_parte": { "step_0": { "type": "CHOICE", "prompt": "...", "transitions": {} } },
    "errore_reset": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "What problem do you see?\n\n1️⃣ Alarm / red light\n2️⃣ Not heating\n3️⃣ Won't start",
        "transitions": {
          "1": "errore_reset.allarme",
          "2": "errore_reset.non_scalda",
          "3": "errore_reset.non_avvia"
        },
        "onInterruptFallback": "Tell me what you see on the dryer 🔧"
      },
      "allarme": {
        "type": "ACTION",
        "prompt": "To reset the alarm:\n👉 Press and hold the STOP button for 3 seconds.\nDid that work?",
        "transitions": { "default": "errore_reset.ask_resolved" }
      }
    }
  }
}
```

---

## Parser Logic — How FlowEngineService Reads the JSON

This is the logic `FlowEngineService` uses to read the JSON and determine what to send to the chat.

### NodeId Format

The `currentNodeId` in `ChatSession.context.flowState` uses the format `"flowId.nodeId"`:

```
"non_parte.step_0"       → flows["non_parte"]["step_0"]
"errore_alm.alm_acqua"  → flows["errore_alm"]["alm_acqua"]
"entry.step_0"          → flows["entry"]["step_0"]
```

```typescript
function resolveNode(flows: FlowsJson, nodeId: string): FlowNode {
  const [flowId, nId] = nodeId.split(".")
  return flows[flowId][nId]
}
```

---

### Dispatch Table per Tipo di Nodo

Il `type` di ogni nodo determina **come classificare l'input** e **quale transizione applicare**:

| `type` | Input atteso | Classificazione | Next node |
|---|---|---|---|
| `CHOICE` | `"1"` – `"N"` | Regex `/^[1-9]$/` | `transitions[input]` |
| `CONFIRMATION` | `"sì"` / `"no"` | Regex YES/NO | `transitions["YES"]` o `transitions["NO"]` |
| `ACTION` | Qualsiasi risposta | Sempre `default` | `transitions["default"]` |
| `INFO` | — | Terminal se `isTerminal: true`, altrimenti `default` | `transitions["default"]` o COMPLETED |
| `FREE_TEXT` | Testo libero | Passa a sub-LLM call | nodeId da risposta LLM |

```typescript
// FlowEngineService.processInput()
function processInput(node: FlowNode, userInput: string): ProcessResult {
  // 1. Controlla HARD_BREAK / SOFT_BREAK prima del dispatch
  if (isHardBreak(userInput)) return { action: "ESCALATE" }
  if (isSoftBreak(userInput))  return { action: "PAUSE" }

  switch (node.type) {
    case "CHOICE": {
      const match = userInput.trim().match(/^([1-9])$/)
      if (!match) return { action: "AMBIGUOUS", fallback: node.onInterruptFallback }
      const nextId = node.transitions[match[1]]
      if (!nextId) return { action: "AMBIGUOUS", fallback: node.onInterruptFallback }
      return { action: "ADVANCE", nextNodeId: nextId }
    }

    case "CONFIRMATION": {
      const yes = /^(s[iì]|yes|ok|certo|esatto)$/i.test(userInput.trim())
      const no  = /^(no|nope|negativo)$/i.test(userInput.trim())
      if (yes) return { action: "ADVANCE", nextNodeId: node.transitions["YES"] }
      if (no)  return { action: "ADVANCE", nextNodeId: node.transitions["NO"] }
      return { action: "AMBIGUOUS", fallback: "Rispondi sì o no 😊" }
    }

    case "ACTION": {
      // Qualsiasi risposta avanza
      return { action: "ADVANCE", nextNodeId: node.transitions["default"] }
    }

    case "INFO": {
      if (node.isTerminal) return { action: "COMPLETE" }
      return { action: "ADVANCE", nextNodeId: node.transitions?.["default"] }
    }

    case "FREE_TEXT": {
      // Delega a sub-LLM call con il testo dell'utente come input
      return { action: "LLM_CLASSIFY", userInput }
    }
  }
}
```

---

### Cosa Viene Inviato alla Chat

`FlowEngineService` restituisce sempre un oggetto `FlowStepResult`:

```typescript
interface FlowStepResult {
  responseText: string        // testo da inviare all'utente
  nextNodeId: string | null   // null se terminal/escalate
  flowStatus: "ACTIVE" | "COMPLETED" | "ESCALATED" | "PAUSED"
  shouldCallOperator: boolean // true se handle_escalate o HARD_BREAK
}
```

**Il `FlowWorkspaceStrategy` invia `responseText` alla WhatsApp Queue / Widget — nient'altro.**

Esempio di flusso completo:

```
User:    "the washer won't start"
  → FlowAgentLLM detects technical problem
  → calls startFlow("non_parte")
  → FlowEngineService.startFlow("non_parte", sessionContext)
  → loads flows["non_parte"]["step_0"]
  → responseText = "What do you see on the display...1️⃣ SEL..."
  → saves context: { flowId: "non_parte", currentNodeId: "non_parte.step_0", flowStatus: "ACTIVE" }

User:    "3"
  → FlowEngineService.processInput(node_step_0, "3")
  → type=CHOICE, match="3" → transitions["3"] = "non_parte.caso_door"
  → loads flows["non_parte"]["caso_door"]
  → responseText = "The door is open.\n👉 Close the door firmly..."
  → saves context: { currentNodeId: "non_parte.caso_door", flowStatus: "ACTIVE" }

User:    "ok closed it"
  → FlowEngineService.processInput(node_caso_door, "ok closed it")
  → type=ACTION → transitions["default"] = "non_parte.ask_resolved"
  → responseText = "Did that solve the problem? (yes / no)"
  → saves context: { currentNodeId: "non_parte.ask_resolved" }

User:    "yes"
  → type=CONFIRMATION, YES → transitions["YES"] = "non_parte.end_success"
  → responseText = "Great! ✅ Enjoy your wash 👍"
  → flowStatus = "COMPLETED"
  → context.flowState = null  (flow complete)
```

---

### Interrupt Handling During Active Flow

```
User:    "how much does it cost?"    ← INTERRUPT_FAQ (off-topic)
  → classified: not HARD/SOFT, not a digit, not yes/no
  → interruptCount++
  → if interruptCount <= 2: pass to FlowAgentLLM for FAQ answer
    → after FAQ answer: send node.onInterruptFallback + re-prompt current node
  → if interruptCount == 3: "Let's sort out the machine issue first 🔧"
  → if interruptCount >= 4: escalate to operator

interruptCount resets when:
  - user advances to next node (valid response)
  - more than 30 minutes have passed since lastValidStepAt (TTL)
```

---

## Fundamental Principle

> **The FlowEngine never asks the LLM what to do inside a flow.**
> The LLM is involved only for FAQ interrupts and for detecting the initial intent.
> The flow is code. It is not a prompt.
