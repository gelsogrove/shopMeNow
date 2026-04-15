# Flow Design Specification — HS-60XX Washer

## Overview

This document defines the deterministic flows for the HS-60XX washer, derived from the technical manual.

Flows are designed to be executed by `FlowEngineService` without LLM involvement, guaranteeing:

- Predictable behavior
- Zero ambiguity
- Step-by-step guided resolution

---

## Flow Patterns

The system uses two structural patterns:

### 🔀 1. Decision Flows (branching)

Based on user choices. Tree-structured graph with semantic node names.

```
step_0 → caso_sel
       → caso_push
       → caso_door
```

### 🔢 2. Sequential Flows (procedural)

Physical step-by-step actions. Numbered nodes (`step_0`, `step_1`, …).

```
step_0 → step_1 → step_2
```

---

## Entry Point

The entry flow is the top-level dispatcher. It is triggered by `startFlow("entry")` when `FlowAgentLLM` cannot determine which specific sub-flow to activate.

```json
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
}
```

---

## Flow: `non_parte` — Machine Won't Start

### Description

Handles all cases where the machine fails to start. Branches on what the user sees on the display.

### Initial Node

```json
"step_0": {
  "type": "CHOICE",
  "prompt": "What do you see on the display?\n\n1️⃣ SEL\n2️⃣ PUSH / Pr\n3️⃣ door\n4️⃣ A number (e.g. 04.00)\n5️⃣ EXTRA light is on",
  "transitions": {
    "1": "non_parte.caso_sel",
    "2": "non_parte.caso_push",
    "3": "non_parte.caso_door",
    "4": "non_parte.caso_importo",
    "5": "non_parte.caso_extra"
  },
  "onInterruptFallback": "Check the display 👀\nWhat does it say?"
}
```

### Nodes

| Node | Type | Description |
|---|---|---|
| `caso_sel` | INFO | Display shows SEL — program not yet selected |
| `caso_push` | INFO | Credit inserted but program not selected |
| `caso_door` | ACTION | Door is open — user must close it |
| `caso_importo` | ACTION | Insufficient credit — user must insert remaining amount |
| `caso_extra` | INFO | EXTRA option is active — user must deactivate or add credit |
| `ask_resolved` | CONFIRMATION | Verify whether issue was resolved |
| `end_success` | INFO (terminal) | Positive resolution — end of flow |
| `handle_escalate` | INFO (terminal) | Negative resolution — triggers `contactOperator()` |

### Node Definitions

```json
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
    "NO":  "non_parte.handle_escalate"
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
```

---

## Flow: `errore_alm` — ALM Error Code

### Description

Handles all error states where the display shows an `ALM` code.

### Initial Node

```json
"step_0": {
  "type": "CHOICE",
  "prompt": "What code do you see after ALM?\n\n1️⃣ ALM/A (water intake)\n2️⃣ ALM/E (drainage)\n3️⃣ ALM/door\n4️⃣ ALM/VAr",
  "transitions": {
    "1": "errore_alm.alm_acqua",
    "2": "errore_alm.alm_scarico",
    "3": "errore_alm.alm_door",
    "4": "errore_alm.alm_var"
  },
  "onInterruptFallback": "Tell me the code you see after ALM 🔧"
}
```

### Nodes

| Node | Type | Problem | Action |
|---|---|---|---|
| `alm_acqua` | ACTION (terminal) | Water intake failure | Press STOP once |
| `alm_scarico` | ACTION (terminal) | Drainage failure | Press STOP once — door may stay locked up to 30 min |
| `alm_door` | ACTION (terminal) | Door latch failure | Press STOP once |
| `alm_var` | INFO (terminal) | Hardware fault | Use another machine — compensation provided |

### Node Definitions

```json
"alm_acqua": {
  "type": "ACTION",
  "prompt": "Water intake problem.\n👉 Press STOP once.\nIf the issue persists, please use another machine.",
  "isTerminal": true
},

"alm_scarico": {
  "type": "ACTION",
  "prompt": "Drainage problem.\n👉 Press STOP once.\n\n⚠️ The door may remain locked for up to 30 minutes while the water drains.\n\nIf the issue persists, please use another machine.",
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
```

---

## Flow: `lavaggio_problema` — Problem During or After Wash

### Description

Handles complaints about wash quality or centrifuge issues.

### Initial Node

```json
"step_0": {
  "type": "CHOICE",
  "prompt": "What problem did you notice?\n\n1️⃣ Clothes didn't spin / still wet\n2️⃣ Display shows END + bAL",
  "transitions": {
    "1": "lavaggio_problema.no_centrifuga",
    "2": "lavaggio_problema.end_bal"
  },
  "onInterruptFallback": "Describe what happened during the wash 🔧"
}
```

### Nodes

| Node | Type | Cause | Action |
|---|---|---|---|
| `no_centrifuga` | INFO (terminal) | Overloaded drum | Split the load and rewash |
| `end_bal` | INFO (terminal) | Unbalanced drum — spin aborted | Split the load and rewash |

### Node Definitions

```json
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
```

---

## Node Types Reference

| Type | Expected Input | Transition Logic | LLM Needed |
|---|---|---|---|
| `CHOICE` | `"1"` – `"N"` (digit) | `transitions[digit]` | No |
| `CONFIRMATION` | `"yes"` / `"no"` | `transitions["YES"]` or `transitions["NO"]` | No |
| `ACTION` | Any response | Always `transitions["default"]` | No |
| `INFO` | — | `isTerminal: true` → COMPLETE, else `transitions["default"]` | No |
| `FREE_TEXT` | Free text | Passed to sub-LLM for classification | Yes |

---

## State Management

Flow state is stored in `ChatSession.context.flowState` — no new tables required.

```typescript
interface FlowState {
  flowId: string               // e.g. "non_parte"
  currentNodeId: string        // e.g. "non_parte.step_0"
  flowStatus: "ACTIVE" | "COMPLETED" | "ESCALATED" | "PAUSED"
  interruptCount: number       // incremented on off-topic messages
  lastInterruptType: string | null
  lastValidStepAt: string      // ISO timestamp — used for 30-min TTL reset
}
```

### NodeId Format

`currentNodeId` always uses the format `"flowId.nodeId"`:

```
"non_parte.step_0"        → flows["non_parte"]["step_0"]
"errore_alm.alm_acqua"   → flows["errore_alm"]["alm_acqua"]
"entry.step_0"            → flows["entry"]["step_0"]
```

---

## Execution Rules

1. **`FlowEngineService` is fully deterministic** — no LLM calls during active flow execution
2. **LLM is used only for**:
   - Initial intent detection (which `startFlow(flowId)` to call)
   - Answering FAQ interrupts while a flow is active
3. **Interrupt handling**:
   - Interrupts 1–2: answer the FAQ via `FlowAgentLLM`, then re-send `node.onInterruptFallback`
   - Interrupt 3: `"Let's solve the machine issue first, then we'll handle the rest"`
   - Interrupt 4+: escalate to operator via `contactOperator()`
4. **`interruptCount` resets** when:
   - User provides a valid transition response (advances to next node)
   - More than 30 minutes have passed since `lastValidStepAt` (TTL)
5. **`handle_escalate` nodes** always trigger `contactOperator()` — this is handled by `FlowEngineService` checking `flowStepResult.shouldCallOperator`

---

## Fundamental Principle

> **The flow is code, not a prompt.**
>
> `FlowEngineService` executes transitions deterministically from the JSON graph.
> The LLM decides *which flow to start* — it never decides *what to do next inside a flow*.

---

## Extensibility

This exact format is reusable for any guided domain:

| Domain | `flowKey` example | Flow examples |
|---|---|---|
| Washer | `lavatrice_hs60xx` | `non_parte`, `errore_alm`, `lavaggio_problema` |
| Dryer | `asciugatrice_ed340` | `non_parte`, `errore_reset`, `non_scalda` |
| Tech support | `router_tplink` | `no_internet`, `wifi_slow`, `reset_factory` |
| Onboarding | `onboarding_v1` | `account_setup`, `first_product`, `payment_config` |
| Structured support | `support_ecommerce` | `return_request`, `wrong_item`, `delivery_issue` |

Each workspace can have **multiple `FlowNodeConfig` records** — one per machine/process type.
