# FLOW Architecture — Ecolaundry (Sofia)

> Analisi completa del pipeline messaggi per workspace `channelMode=FLOW`.
> Obiettivo: capire se la struttura copre tutti i casi e se il JSON dei flow va rivisto.

---

## 1. Pipeline Completa — Visione d'Insieme

```
Customer Message
       │
       ▼
┌─────────────────────────────────────────────┐
│  FlowWorkspaceStrategy (orchestratore)      │
│                                             │
│  PATH A: QR Code rilevato?                  │
│    → Carica FlowNodeConfig                  │
│    → Messaggio benvenuto                    │
│                                             │
│  PATH B: FlowState attivo?                  │
│    → FlowEngineService (deterministico)     │
│    → 0 token LLM, solo JSON                │
│                                             │
│  PATH C: Nessun flow attivo?                │
│    → FlowAgentLLM (LLM decide)             │
│    → Può: rispondere FAQ, startFlow(),      │
│      contactOperator()                      │
│                                             │
│  PATH D: Nessun flowKey?                    │
│    → "Scansiona il QR code"                 │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Post-Processing                            │
│  1. Link replacement ([LINK_REGISTRATION])  │
│  2. Translation Agent (se lingua ≠ base)    │
│  3. Security Agent (solo widget)            │
│  4. contactOperator() (se richiesto)        │
└─────────────────────────────────────────────┘
       │
       ▼
   WhatsApp / Widget Response
```

---

## 2. I 3 Livelli — Chi Fa Cosa

### Livello 1: Router (INFO_AGENT)

| Aspetto | Dettaglio |
|---------|-----------|
| **Tipo** | LLM conversazionale (AgentConfig in DB) |
| **Quando** | Primo contatto, PRIMA di identificare una macchina |
| **Gestisce** | FAQ generiche, pagamenti, rimborsi, orari, carta fedeltà, frode |
| **Tools** | Nessun tool (solo risposta conversazionale) |
| **Routing** | Identifica numero macchina → smista a Sub-LLM corretto |
| **Prompt** | Da DB (`AgentConfig.promptContent` per INFO_AGENT) |

**Casi gestiti dal Router:**
- "Come pago?" → Risponde direttamente (FAQ pagamento nel prompt)
- "Ho un doppio addebito" → Risponde con procedura compensazione
- "Che orari avete?" → Risponde con orari dal prompt
- "La macchina 42 non parte" → Estrae numero → routing a Sub-LLM lavatrice

**Perché il pagamento sta nel Router:**
Il pagamento NON dipende dalla macchina. "La carta non funziona" è uguale per lavatrice e asciugatrice. Il Router risponde subito senza smistare inutilmente.

---

### Livello 2: Sub-LLM (FlowAgentLLM — uno per macchina)

| Aspetto | Dettaglio |
|---------|-----------|
| **Tipo** | LLM con tools (FlowNodeConfig in DB) |
| **Quando** | Dopo routing, flowKey assegnato, nessun flow attivo |
| **Gestisce** | Benvenuto macchina, capire il problema, avviare flow |
| **Tools** | `startFlow(flowId)` + `contactOperator(reason)` |
| **Prompt** | Da DB (`FlowNodeConfig.systemPrompt`) |
| **Config** | model, temperature, maxTokens — tutto da DB |

**Logica:**
1. Carica `FlowNodeConfig` dal DB (per `flowKey`)
2. Costruisce tools dinamicamente da `Object.keys(config.flows)`:
   ```
   startFlow:
     flowId: ENUM ["non_parte", "door_lock", "post_ciclo"]
     desc: "Avvia flow troubleshooting"
   
   contactOperator:
     reason: string (opzionale)
     desc: "Scala a operatore umano"
   ```
3. Carica history conversazione (`ConversationMessage`)
4. Chiama LLM → LLM decide: rispondere, startFlow, o escalare
5. Se `startFlow("non_parte")` → passa controllo a FlowEngine

**FlowNodeConfig per lavatrice_hs60xx:**
```json
{
  "flowKey": "lavatrice_hs60xx",
  "flowLabel": "Lavatrice HS-60XX",
  "systemPrompt": "Sei Sofia, assistente Ecolaundry...",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 2048,
  "availableFunctions": ["startFlow", "contactOperator"],
  "flows": { ... }  // ← i flow JSON deterministici
}
```

---

### Livello 3: Flow Engine (deterministico — 0 token LLM)

| Aspetto | Dettaglio |
|---------|-----------|
| **Tipo** | Motore JSON deterministico |
| **Quando** | `flowState.flowStatus === "ACTIVE"` |
| **Gestisce** | Steps predefiniti, albero decisionale |
| **Costo** | 0 token LLM — solo logica JSON |
| **Velocità** | Istantaneo (no API call) |

---

## 3. FlowState — Gestione Stato

```typescript
interface FlowState {
  flowId: string;           // "non_parte"
  currentNodeId: string;    // "non_parte.step_0"
  flowStatus: FlowStatus;  // "ACTIVE" | "PAUSED" | "COMPLETED" | "ESCALATED"
  interruptCount: number;   // Conta domande fuori-tema
  lastInterruptType?: string; // "FAQ" | "AMBIGUOUS"
  lastValidStepAt: string;  // ISO timestamp per TTL
}
```

**Lifecycle:**
```
QR Scan → context = { flowKey, flowNumber }
                    ↓
Sub-LLM → startFlow() → flowState = { flowId, currentNodeId: "flowId.step_0", status: ACTIVE }
                    ↓
Flow Engine → aggiorna currentNodeId ad ogni step
                    ↓
isTerminal=true → flowStatus = COMPLETED | ESCALATED
```

**Persistenza:** `ChatSession.context` (JSONB) — aggiornato dopo ogni messaggio.

---

## 4. Struttura JSON dei Flow — Analisi

### Tipi di Nodo

| Tipo | Uso | Input Atteso |
|------|-----|-------------|
| `CHOICE` | Domanda con opzioni numerate (1, 2, 3...) | Numero |
| `INFO` | Istruzione + conferma (Sì/No) | Sì/No |
| `ACTION` | Chiede esecuzione + verifica | Testo libero |
| `CONFIRMATION` | Conferma finale | Sì/No |
| `FREE_TEXT` | Input libero (descrizione problema) | Qualsiasi testo |

### Struttura Nodo

```typescript
interface FlowNode {
  type: "CHOICE" | "ACTION" | "INFO" | "CONFIRMATION" | "FREE_TEXT";
  prompt: string;                        // Messaggio mostrato al cliente
  transitions?: Record<string, string>;  // "1" → "nodeId", "YES" → "nodeId"
  isTerminal?: boolean;                  // true = fine flow
  onInterruptFallback?: string;          // Risposta se domanda fuori-tema
}
```

### Esempio: Flow "non_parte" (Lavatrice)

```json
{
  "non_parte": {
    "step_0": {
      "type": "CHOICE",
      "prompt": "Il servizio è partito?\n1. No, non parte\n2. Sì, ma c'è un problema",
      "transitions": {
        "1": "non_parte.display_check",
        "2": "non_parte.cycle_check"
      },
      "onInterruptFallback": "Risolviamo prima il problema della macchina 🔧"
    },
    "display_check": {
      "type": "CHOICE",
      "prompt": "Cosa dice il display?\n1. Porta aperta\n2. Selezionare programma\n3. Premere avvio\n4. Credito insufficiente\n5. Altro",
      "transitions": {
        "1": "non_parte.fix_door",
        "2": "non_parte.fix_program",
        "3": "non_parte.fix_start",
        "4": "non_parte.fix_credit",
        "5": "non_parte.escalate"
      }
    },
    "fix_door": {
      "type": "INFO",
      "prompt": "Chiudi bene la porta della lavatrice e premi avvio. Ha funzionato?",
      "transitions": {
        "YES": "non_parte.resolved",
        "NO": "non_parte.display_check"
      }
    },
    "fix_program": {
      "type": "INFO",
      "prompt": "Seleziona un programma di lavaggio dal pannello. Ha funzionato?",
      "transitions": {
        "YES": "non_parte.resolved",
        "NO": "non_parte.display_check"
      }
    },
    "fix_start": {
      "type": "INFO",
      "prompt": "Premi il pulsante di avvio (il grande pulsante verde). Ha funzionato?",
      "transitions": {
        "YES": "non_parte.resolved",
        "NO": "non_parte.display_check"
      }
    },
    "fix_credit": {
      "type": "INFO",
      "prompt": "Verifica di avere credito sufficiente. Puoi pagare con carta, monete o app. Ha funzionato?",
      "transitions": {
        "YES": "non_parte.resolved",
        "NO": "non_parte.escalate"
      }
    },
    "cycle_check": {
      "type": "CHOICE",
      "prompt": "Il ciclo è finito?\n1. No, è ancora in corso\n2. Sì, è finito ma c'è un problema",
      "transitions": {
        "1": "non_parte.wait_cycle",
        "2": "non_parte.post_cycle"
      }
    },
    "wait_cycle": {
      "type": "INFO",
      "prompt": "Attendi la fine del ciclo. Al termine, se persiste un problema, scrivi 'aiuto'. Buon lavaggio! 🧺",
      "isTerminal": true
    },
    "post_cycle": {
      "type": "CHOICE",
      "prompt": "Quale problema hai?\n1. Vestiti ancora bagnati\n2. Non scarica acqua\n3. Non carica acqua\n4. Rumore anomalo\n5. Porta bloccata\n6. Vestiti rovinati",
      "transitions": {
        "1": "non_parte.fix_wet",
        "2": "non_parte.escalate_drain",
        "3": "non_parte.escalate_water",
        "4": "non_parte.escalate_noise",
        "5": "non_parte.fix_lock",
        "6": "non_parte.damage_info"
      }
    },
    "fix_wet": {
      "type": "INFO",
      "prompt": "I vestiti bagnati sono spesso causati da un carico eccessivo. Prova a ridurre il carico e ripeti il ciclo. Ha funzionato?",
      "transitions": {
        "YES": "non_parte.resolved",
        "NO": "non_parte.escalate"
      }
    },
    "fix_lock": {
      "type": "INFO",
      "prompt": "Attendi 2-3 minuti dopo la fine del ciclo, la porta si sblocca automaticamente. Ha funzionato?",
      "transitions": {
        "YES": "non_parte.resolved",
        "NO": "non_parte.escalate"
      }
    },
    "damage_info": {
      "type": "INFO",
      "prompt": "Mi dispiace per il danno. Verifica di aver selezionato il programma corretto per il tipo di tessuto. Per un reclamo, contatta l'operatore.",
      "transitions": {
        "default": "non_parte.escalate"
      }
    },
    "escalate_drain": {
      "type": "CONFIRMATION",
      "prompt": "Sembra un guasto tecnico (scarico). Ti metto in contatto con un tecnico.",
      "isTerminal": true
    },
    "escalate_water": {
      "type": "CONFIRMATION",
      "prompt": "Sembra un guasto tecnico (carico acqua). Ti metto in contatto con un tecnico.",
      "isTerminal": true
    },
    "escalate_noise": {
      "type": "CONFIRMATION",
      "prompt": "Rumore anomalo può indicare un guasto. Ti metto in contatto con un tecnico.",
      "isTerminal": true
    },
    "escalate": {
      "type": "CONFIRMATION",
      "prompt": "Non sono riuscita a risolvere il problema. Ti metto in contatto con un operatore.",
      "isTerminal": true
    },
    "resolved": {
      "type": "INFO",
      "prompt": "Perfetto! Sono contenta che funzioni. Buon lavaggio! 🧺✨",
      "isTerminal": true
    }
  }
}
```

---

## 5. Classificazione Input — Come il Flow Engine Capisce

```
Customer Input
      │
      ▼
classifyInput(input)
      │
      ├── /^(operator|operatore|umano|help)$/i  → HARD_BREAK → Escalare subito
      ├── /^(stop|basta|annulla|esci)$/i        → SOFT_BREAK → Pausa flow (riprendibile)
      ├── /^[1-9]$/  o  /^(sì|no|ok|yes)$/i     → MATCH      → Transizione normale
      ├── domanda tipo FAQ?                      → INTERRUPT   → onInterruptFallback + contatore
      └── altro                                  → AMBIGUOUS   → "Puoi ripetere?" + contatore
```

**Limiti interruzioni:**
- 3 interruzioni → avviso morbido ("Risolviamo prima il problema")
- 4+ interruzioni → escalazione automatica a operatore

**TTL:** Se >30 min senza input valido → reset `interruptCount` (l'utente è tornato fresco)

---

## 6. Decisioni Architetturali — Cosa Copre Cosa

### Router (INFO_AGENT) — FAQ Generiche

| Caso | Gestito? | Come |
|------|----------|------|
| "Come pago?" | ✅ | FAQ nel systemPrompt |
| "Quanto costa un lavaggio?" | ✅ | FAQ nel systemPrompt |
| "Ho un doppio addebito" | ✅ | FAQ + procedura compensazione |
| "La carta non funziona" | ✅ | FAQ pagamento |
| "Che orari avete?" | ✅ | FAQ nel systemPrompt |
| "Dove siete?" | ✅ | FAQ nel systemPrompt |
| "Carta fedeltà" | ✅ | FAQ nel systemPrompt |
| "Voglio un rimborso" | ✅ | FAQ + regole compensazione |
| "Macchina 42 non parte" | ✅ | Routing → Sub-LLM lavatrice |
| "Ho un problema" (senza numero) | ✅ | Chiede numero macchina |

### Sub-LLM (FlowAgentLLM) — Per Macchina

| Caso | Gestito? | Come |
|------|----------|------|
| "Non parte" | ✅ | `startFlow("non_parte")` |
| "C'è un errore" | ✅ | `startFlow("errore_display")` |
| "La porta è bloccata" | ✅ | `startFlow("non_parte")` → nodo specifico |
| "Voglio parlare con qualcuno" | ✅ | `contactOperator()` |
| Problema non chiaro | ✅ | LLM conversazionale chiede dettagli |

### Flow Engine (Deterministico) — Troubleshooting

| Caso | Gestito? | Come |
|------|----------|------|
| Albero decisionale (display, check, etc.) | ✅ | Nodi CHOICE → transitions |
| Istruzioni passo-passo | ✅ | Nodi INFO/ACTION |
| Loop "Ha funzionato?" | ✅ | Transizione YES→resolved, NO→retry/escalate |
| Escalazione automatica | ✅ | `isTerminal: true` su nodi escalation |
| Domanda fuori-tema durante flow | ✅ | `onInterruptFallback` + contatore |
| Utente vuole uscire | ✅ | SOFT_BREAK → pausa |
| Utente vuole operatore | ✅ | HARD_BREAK → escalazione immediata |

---

## 7. Gap Analysis — Codice/DB vs PDF Playbook

### 🔴 BUG CRITICO: Escalazione Hardcoded su Nome Nodo

**File:** `flow-engine.service.ts` linea 140
```typescript
const shouldCallOperator = nextNodeId.endsWith("handle_escalate");
```

**Problema:** L'escalazione funziona SOLO se il nodo si chiama `*.handle_escalate`.
Ma i JSON del cliente (`01_asciugatrice.json`, `02_wascher.json`) usano nomi come `step_7`, `step_8`.
Risultato: **nessun nodo terminale del cliente chiamerà mai `contactOperator()`**.

**Fix necessario:** Usare il campo `action: "escalate"` (sezione 8) invece di parsare il nome nodo.

```typescript
// PRIMA (BUG):
const shouldCallOperator = nextNodeId.endsWith("handle_escalate");

// DOPO (FIX):
const shouldCallOperator = nextNode.action === "escalate";
```

---

### 🔴 Gap 2: Transition Keys — YES/NO vs Testo Libero  

**Problema:** Il `classifyInput()` ritorna `"MATCH"` solo per:
- Singolo numero: `1`, `2`, `3`...
- Sì/No: `sì`, `no`, `ok`, `yes`

Ma i JSON del cliente usano transition keys come:
```json
"transitions": {
  "DOOR": "entry.step_4",
  "ALM": "entry.step_5",
  "SEL": "entry.step_2",
  "PUSH PROG": "entry.step_3"
}
```

L'utente scrive "DOOR" o "vedo door" → `classifyInput()` ritorna `AMBIGUOUS` → non matcha!

**Opzioni:**
1. L'utente deve SEMPRE scegliere da lista numerata (noi convertiamo le transition keys in numeri)
2. Il `normalizeInput()` deve estrarre keywords dai transitions disponibili
3. I flow JSON usano SOLO numeri come keys (1, 2, 3) e il prompt elenca le opzioni

**Raccomandazione:** Opzione 3 — tutti i flow usano CHOICE con opzioni numerate.
Questo è il pattern più robusto (multilingual, nessun parsing di parole).

```json
// PRIMA (non funziona col classificatore):
"transitions": { "DOOR": "...", "ALM": "...", "SEL": "..." }

// DOPO (funziona):
"step_1": {
  "type": "CHOICE",
  "prompt": "Cosa vedi sul display?\n1. DOOR\n2. ALM\n3. SEL\n4. PUSH PROG\n5. Altro",
  "transitions": { "1": "...", "2": "...", "3": "...", "4": "...", "5": "..." }
}
```

---

### 🔴 Gap 3: Transition Key YES/NO — Normalizzazione Mancante

**Problema:** Il classificatore matcha `sì`, `no`, `ok`, `yes` come `MATCH`.
Ma `normalizeInput()` deve poi convertire "sì" → "YES", "no" → "NO" per matchare le transition keys.

**Verifica necessaria:** Controllare che `normalizeInput("sì")` ritorni `"YES"` e `normalizeInput("no")` ritorni `"NO"`.
Se non lo fa, le transizioni YES/NO non funzioneranno.

---

### ⚠️ Gap 4: Allarmi Macchina (Playbook §5.4-5.5)

Il Playbook Ecolaundry prevede codici allarme: ALM/A, ALM/E, ALM/door, ALM/VAr.
I flow attuali (flow2, flow3) NON li gestiscono come flow separato.

**Soluzione:** Nel flow `non_parte`, il nodo "Cosa dice il display?" include già l'opzione ALM.
Non serve un flow separato — basta un ramo nel flow esistente:

```json
"display_check": {
  "type": "CHOICE",
  "prompt": "Cosa vedi sul display?\n1. Porta\n2. Seleziona programma\n3. Premi avvio\n4. ALM (errore)\n5. Credito\n6. Altro",
  "transitions": {
    "1": "non_parte.fix_door",
    "2": "non_parte.fix_program",
    "3": "non_parte.fix_start",
    "4": "non_parte.handle_alm",
    "5": "non_parte.fix_credit",
    "6": "non_parte.escalate"
  }
}

"handle_alm": {
  "type": "INFO",
  "prompt": "La macchina ha rilevato un'incidenza (ALM). Prova a premere il pulsante STOP una volta. Ha funzionato?",
  "transitions": {
    "YES": "non_parte.resolved",
    "NO": "non_parte.escalate"
  }
}
```

---

### ⚠️ Gap 5: Flow Entry — Saluto Iniziale (step_0)

I JSON del cliente hanno un nodo `step_0` di benvenuto:
```json
"step_0": {
  "type": "INFO",
  "prompt": "Hola, soy el asistente de Ecolaundry...",
  "transitions": { "default": "entry.step_1" }
}
```

**Problema:** Transition `"default"` NON è gestita dal classificatore.
Quando il FlowEngine mostra step_0 e l'utente scrive qualsiasi cosa, 
`classifyInput()` potrebbe dare `AMBIGUOUS` invece di avanzare.

**Opzioni:**
1. I nodi INFO con singola transizione `"default"` avanzano automaticamente (auto-advance)
2. Rimuovere step_0 dal flow — il Sub-LLM dà il benvenuto prima di `startFlow()`

**Raccomandazione:** Opzione 2 — il benvenuto NON è nel flow JSON.
Il Sub-LLM (FlowAgentLLM) gestisce il saluto nel `systemPrompt`. 
Il flow inizia direttamente dalla prima domanda diagnostica.

---

### ✅ Nessun Gap: Pagamento

Pagamento gestito dal Router → nessun flow necessario. OK.

### ✅ Nessun Gap: Ritorno dopo flow completato

`flowStatus = COMPLETED` → PATH C (Sub-LLM) → può avviare un altro flow. OK.

---

## 8. Proposta: Campo `action` nei FlowNode Terminali (APPROVATO)

**Fix per BUG sezione 7 — Gap 1.**

Attualmente:
```typescript
interface FlowNode {
  type: FlowNodeType;
  prompt: string;
  transitions?: Record<string, string>;
  isTerminal?: boolean;
  onInterruptFallback?: string;
}
```

**Proposta — aggiungere `action`:**
```typescript
interface FlowNode {
  type: FlowNodeType;
  prompt: string;
  transitions?: Record<string, string>;
  isTerminal?: boolean;
  action?: "escalate" | "resolve";  // ← NUOVO: cosa fare quando terminale
  onInterruptFallback?: string;
}
```

**Vantaggi:**
- Nessun parsing di testo per capire se escalare
- Ogni nodo terminale dice esplicitamente cosa fare
- Il FlowEngine chiama `contactOperator()` solo se `action: "escalate"`
- Nodi `action: "resolve"` → flow finito, messaggio di chiusura

---

## 9. Diagramma Completo — Flusso Decisionale

```
CUSTOMER MESSAGE
       │
       ▼
  ┌─ QR Code? ─────── YES ──→ [Salva flowKey + flowNumber]
  │                              → Benvenuto macchina
  │                              → Aspetta domanda
  │
  NO
  │
  ▼
  ┌─ FlowState ACTIVE? ─── YES ──→ [FlowEngine deterministico]
  │                                   │
  │                                   ├─ MATCH      → Transizione nodo
  │                                   ├─ HARD_BREAK → contactOperator()
  │                                   ├─ SOFT_BREAK → Pausa (riprendibile)
  │                                   ├─ INTERRUPT  → onInterruptFallback
  │                                   └─ AMBIGUOUS  → "Ripeti" / +contatore
  │                                   │
  │                                   ├─ isTerminal + action:"escalate"
  │                                   │    → contactOperator() 
  │                                   └─ isTerminal + action:"resolve"
  │                                        → "Problema risolto! 🎉"
  │
  NO
  │
  ▼
  ┌─ FlowKey exists? ─── YES ──→ [FlowAgentLLM (Sub-LLM)]
  │                                 │
  │                                 ├─ LLM risponde (FAQ macchina)
  │                                 ├─ LLM chiama startFlow("non_parte")
  │                                 │    → FlowEngine.startFlow()
  │                                 │    → step_0.prompt
  │                                 └─ LLM chiama contactOperator()
  │                                      → Scala a operatore
  │
  NO
  │
  ▼
  [Router INFO_AGENT]
    │
    ├─ FAQ generiche (pagamento, orari, rimborsi, carta fedeltà, frode)
    ├─ Identifica numero macchina → assegna flowKey → routing a Sub-LLM
    └─ "Non ho capito, puoi ripetere?"
```

---

## 10. Riepilogo Configurazione Database

### AgentConfig (Router)

| Campo | Valore |
|-------|--------|
| `agentType` | INFO_AGENT |
| `promptContent` | System prompt con FAQ pagamento, orari, regole, routing |
| `isActive` | true |
| `workspaceId` | {workspace_id} |

### FlowNodeConfig (Sub-LLM per macchina)

| Campo | Lavatrice | Asciugatrice |
|-------|-----------|-------------|
| `flowKey` | lavatrice_hs60xx | asciugatrice_ed340 |
| `flowLabel` | Lavatrice HS-60XX | Asciugatrice ED-340 |
| `systemPrompt` | Sofia prompt + regole macchina | Sofia prompt + regole macchina |
| `model` | openai/gpt-4o-mini | openai/gpt-4o-mini |
| `temperature` | 0.3 | 0.3 |
| `maxTokens` | 2048 | 2048 |
| `availableFunctions` | ["startFlow","contactOperator"] | ["startFlow","contactOperator"] |
| `flows` | { "non_parte": {...}, "allarmi": {...} } | { "non_parte": {...}, "allarmi": {...} } |

---

## 11. MATRICE COMPLETA: PDF Playbook vs Struttura Codice/DB

### Playbook Sezione 1-3: Obiettivi, Tono, Limiti

| Requisito PDF | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|
| Nome bot: Sofia | `FlowNodeConfig.systemPrompt` | String @db.Text | ✅ C'è |
| Tono: calmo, professionale, frasi corte | `FlowNodeConfig.systemPrompt` | String @db.Text | ✅ C'è |
| Una domanda per messaggio | `FlowNode.prompt` (ogni nodo = 1 prompt) | JSON flows | ✅ C'è |
| Non diagnosticare guasti tecnici | `FlowNodeConfig.systemPrompt` (regole) | String @db.Text | ✅ C'è |
| Non parlare di programmi (asciugatrice) | `FlowNodeConfig.systemPrompt` (regole) | String @db.Text | ✅ C'è |
| Escalare se dubbio | `FlowNode.isTerminal` + `action:"escalate"` | JSON flows | ⚠️ Serve campo `action` |

### Playbook Sezione 4: Flow Completi (Troubleshooting)

| Caso Playbook | Tipo | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|---|
| **Display SEL** (seleziona programma) | Flow deterministico | `FlowNodeConfig.flows.non_parte.display_check` → transition "2" | JSON FlowNode CHOICE | ✅ Coperto |
| **Display PUSH PROG** (conferma) | Flow deterministico | `FlowNodeConfig.flows.non_parte.display_check` → transition "3" | JSON FlowNode CHOICE | ✅ Coperto |
| **Display DOOR** (porta aperta) | Flow deterministico | `FlowNodeConfig.flows.non_parte.display_check` → transition "1" | JSON FlowNode CHOICE | ✅ Coperto |
| **Display ALM** (allarme) | Flow deterministico | `FlowNodeConfig.flows.non_parte.handle_alm` | JSON FlowNode INFO | ⚠️ Da aggiungere nei flowchart |
| **Non parte** (generico) | Flow deterministico | `FlowNodeConfig.flows.non_parte` | JSON FlowMap | ✅ Coperto |
| **Vestiti bagnati** | Flow deterministico | `FlowNodeConfig.flows.non_parte.fix_wet` | JSON FlowNode INFO | ✅ Coperto |
| **Non scarica acqua** | Flow deterministico | `FlowNodeConfig.flows.non_parte.escalate_drain` | JSON FlowNode terminal | ✅ Coperto |
| **Rumore anomalo** | Flow deterministico | `FlowNodeConfig.flows.non_parte.escalate_noise` | JSON FlowNode terminal | ✅ Coperto |
| **Porta bloccata** | Flow deterministico | `FlowNodeConfig.flows.non_parte.fix_lock` | JSON FlowNode INFO | ✅ Coperto |
| **Vestiti rovinati** | Flow deterministico | `FlowNodeConfig.flows.non_parte.damage_info` | JSON FlowNode INFO | ✅ Coperto |
| **Asciugatrice: non asciuga** | Flow deterministico | `FlowNodeConfig.flows.non_parte.fix_dry` | JSON FlowNode INFO | ✅ Coperto |
| **Asciugatrice: troppo umida** | Flow deterministico | `FlowNodeConfig.flows.non_parte.fix_humid` | JSON FlowNode INFO | ✅ Coperto |
| **Asciugatrice: odore** | Flow deterministico | `FlowNodeConfig.flows.non_parte.fix_smell` | JSON FlowNode INFO | ✅ Coperto |
| **Asciugatrice: filtro** | Flow deterministico | `FlowNodeConfig.flows.non_parte.fix_filter` | JSON FlowNode INFO | ✅ Coperto |
| **Loop "Ha funzionato?"** | Flow deterministico | `FlowNode.transitions.YES/NO` | JSON transitions | ✅ Coperto |

### Playbook Sezione 5: Gestione Intents

| Intent Playbook | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|
| Saluto / benvenuto | Sub-LLM (systemPrompt) — NON nel flow! | `FlowNodeConfig.systemPrompt` | ✅ C'è |
| Richiesta info pagamento | Router (INFO_AGENT) | `AgentConfig.promptContent` | ✅ C'è |
| Richiesta orari | Router (INFO_AGENT) | `AgentConfig.promptContent` | ✅ C'è |
| Richiesta posizione | Router (INFO_AGENT) | `AgentConfig.promptContent` | ✅ C'è |
| Richiesta operatore | Flow classifier → HARD_BREAK | Codice (classifyInput) | ✅ C'è |
| Uscire dal flow | Flow classifier → SOFT_BREAK | Codice (classifyInput) | ✅ C'è |
| Domanda fuori-tema durante flow | `FlowNode.onInterruptFallback` + contatore | JSON + codice | ✅ C'è |

### Playbook Sezione 5.7-5.9: Compensazioni, Rimborsi, Carta Fedeltà

| Caso | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|
| Doppio addebito | Router FAQ (systemPrompt) | `AgentConfig.promptContent` | ✅ C'è spazio |
| Compensazione con codice | Router FAQ (systemPrompt) | `AgentConfig.promptContent` | ✅ C'è spazio |
| Rimborso regole | Router FAQ (systemPrompt) | `AgentConfig.promptContent` | ✅ C'è spazio |
| Carta fedeltà info | Router FAQ (systemPrompt) | `AgentConfig.promptContent` | ✅ C'è spazio |
| Fattura | Router FAQ (systemPrompt) | `AgentConfig.promptContent` | ✅ C'è spazio |

> Nota: "C'è spazio" = la struttura DB supporta il campo (Text illimitato), 
> ma il contenuto specifico va ancora scritto nel systemPrompt del Router.

### Playbook Sezione 6: Frode Detection

| Caso | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|
| Richieste sospette ripetute | Router FAQ + regole nel systemPrompt | `AgentConfig.promptContent` | ✅ C'è spazio |
| Pattern compensazione abuso | Router FAQ + regole nel systemPrompt | `AgentConfig.promptContent` | ✅ C'è spazio |
| Alert operatore per frode | `contactOperator(reason)` con motivo specifico | Codice + contactOperator | ✅ C'è |

### Playbook Sezione 10: Escalazione

| Caso | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|
| Escalare a operatore | `contactOperator()` function | Codice (calling function) | ✅ C'è |
| Summary 1 frase | SummaryAgentLLM | `AgentConfig` + LLM call | ✅ C'è |
| Email a operatore | contactOperator → email service | Codice + workspace.operatorEmail | ✅ C'è |
| Link supporto con token | SecureTokenService | Codice + DB | ✅ C'è |
| Reset sessione dopo timeout | sessionResetTimeout | Workspace field | ✅ C'è |

### Playbook Sezione 11: System Prompt

| Requisito | Dove va? | Struttura DB | ✅/❌ |
|---|---|---|---|
| Prompt dinamico da DB | `FlowNodeConfig.systemPrompt` + `AgentConfig.promptContent` | String @db.Text | ✅ C'è |
| Temperatura configurabile | `FlowNodeConfig.temperature` | Float | ✅ C'è |
| Model configurabile | `FlowNodeConfig.model` | String | ✅ C'è |
| Max tokens configurabile | `FlowNodeConfig.maxTokens` | Int | ✅ C'è |
| Functions configurabili | `FlowNodeConfig.availableFunctions` | Json array | ✅ C'è |

---

## 12. RIEPILOGO: Cosa Toccare nel Codice

### 🔴 FIX OBBLIGATORI (Bloccanti)

| # | Cosa | File | Impatto |
|---|------|------|---------|
| 1 | **Campo `action` in FlowNode** | `flow.types.ts` | Aggiungere `action?: "escalate" \| "resolve"` |
| 2 | **Fix escalazione** — usare `action` invece di nome nodo | `flow-engine.service.ts:140` | Sostituire `endsWith("handle_escalate")` con `nextNode.action === "escalate"` |
| 3 | **Flow JSON con numeri** — TUTTE le transition keys devono essere numeri o YES/NO | JSON nei FlowNodeConfig | Riscrivere i JSON del cliente |

### ⚠️ MIGLIORAMENTI (Raccomandati)

| # | Cosa | File | Impatto |
|---|------|------|---------|
| 4 | Aggiungere nodo ALM nei flow | JSON flowchart → JSON FlowNodeConfig | Coprire allarmi Playbook |
| 5 | Rimuovere step_0 benvenuto dai JSON | JSON FlowNodeConfig | Il Sub-LLM gestisce il saluto |
| 6 | Verificare `normalizeInput("sì")` → "YES" | `flow-classifier.service.ts` | Garantire YES/NO matching |
| 7 | Scrivere contenuto FAQ pagamento nel Router prompt | `AgentConfig` (SQL su Heroku) | Coprire sezioni 5.7-6 Playbook |

### ✅ STRUTTURA OK (Nessun Cambio Necessario)

| Cosa | Perché |
|------|--------|
| `FlowNodeConfig` schema | Tutti i campi necessari ci sono |
| `FlowNode` types (eccetto `action`) | CHOICE/ACTION/INFO/CONFIRMATION/FREE_TEXT coprono tutti i casi |
| `FlowState` | flowId, currentNodeId, interruptCount, TTL — tutto presente |
| `ChatContext` | flowKey, flowNumber, flowState — tutto presente |
| `classifyInput()` | Pattern strutturali OK (numeri, sì/no, operatore, stop) |
| `contactOperator()` | Email, summary, token, sales routing — tutto funziona |
| `FlowWorkspaceStrategy` 4 paths | QR, active flow, no flow + key, no key — copre tutto |
| Translation + Security post-processing | OK |
| Session reset timeout | Workspace.sessionResetTimeout — configurabile |

---

## 13. Cosa Verificare Prima di Convertire i Flowchart in JSON

1. ✅ **Pagamento**: NO flow, gestito dal Router (FAQ) — CONFERMATO
2. ✅ **Struttura DB**: FlowNodeConfig ha TUTTI i campi necessari
3. 🔴 **Fix `action` field**: Aggiungere a FlowNode PRIMA di creare JSON
4. 🔴 **Fix escalazione**: Cambiare logica in flow-engine.service.ts PRIMA di testare
5. 🔴 **Transition keys**: Usare SOLO numeri (1,2,3) + YES/NO nei JSON
6. ⚠️ **Allarmi ALM**: Aggiungere nei flowchart (flow2, flow3) PRIMA di convertire
7. ⚠️ **Step 0 saluto**: Rimuovere dai flow JSON — il Sub-LLM saluta
8. ⚠️ **Contenuto Router FAQ**: Scrivere pagamento/rimborsi/orari nel prompt
