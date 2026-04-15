# Neapolis FLOW Workspace — Complete Configuration

## Channel Data (existing)

```
Channel ID:   9d5cc88b-a550-416f-9b3b-4bcc4a11d00d
Workspace:    Neapolis
channelMode:  FLOW
```

---

## Architecture — Confirmed

```
                    Inbound Message
                         │
              ┌──────────▼──────────┐
              │   SecurityAgent     │  (widget only)
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   FlowWorkspace     │  (strategy routing)
              │   Strategy          │
              └──────────┬──────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
    ┌──────▼──────┐  ┌───▼────┐  ┌────▼─────┐
    │  QR CODE    │  │ FLOW   │  │  Machine  │
    │  (welcome)  │  │ ACTIVE │  │  Agent    │
    └─────────────┘  │        │  │  LLM      │
                     │        │  └────┬──────┘
                     │        │       │ tool_call
                     │        │       ▼
              ┌──────▼────────▼──────────────┐
              │     FlowEngineService        │  (deterministic, 0 LLM)
              │     reads FlowNodeConfig.flows│
              └──────────┬──────────────────┘
                         │
              ┌──────────▼──────────┐
              │   contactOperator() │  (if shouldCallOperator)
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   TranslationAgent  │  (LLM — translates to customer lang)
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   Save + Queue      │  (ConversationMessage + WhatsApp)
              └─────────────────────┘
```

**Key**:
- **Router** = `FlowWorkspaceStrategy.route()` — checks QR / flowActive / else
- **Sub-LLM** = `FlowAgentLLM` — one LLM instance per message, reads `FlowNodeConfig.systemPrompt` + builds tools from `Object.keys(flows)`
- **Calling Functions** = `startFlow(flowId)` and `contactOperator` — tools inside FlowAgentLLM
- **FlowEngine** = deterministic — reads JSON, applies transitions, returns `node.prompt`
- **History** = `ConversationManager.loadHistory()` — injected as messages array into the single FlowAgentLLM call
- **Translation** = separate LLM call on output of both paths
- **Security** = only on widget input, before routing

The Calling Functions (startFlow, contactOperator) are NOT from `WorkspaceCallingFunction` table — they are **built dynamically** inside `FlowAgentLLM` from `FlowNodeConfig.availableFunctions`. This is different from ECOMMERCE where CallingFunctions come from the `workspace_calling_functions` table.

---

## 1. Channel Settings — Update Required

These fields need to be updated on the existing Neapolis channel:

```json
{
  "chatbotName": "Sofia",
  "botIdentityResponse": "I'm Sofia, the self-service laundry digital assistant. I help customers use the washing machines and dryers. When a customer scans the QR code on a machine, I guide them step-by-step through troubleshooting. I can help with startup issues, error codes, and washing problems. If I can't resolve the issue, I connect them with a human operator.",
  "toneOfVoice": "friendly",
  "welcomeMessage": "Hi! 👋 I'm {{chatbotName}}, your laundry assistant.\nScan the QR code on the machine to get started, or describe your problem and I'll help you right away.",
  "wipMessage": "The service is temporarily unavailable. Please contact the laundry staff directly.",
  "businessType": "services",
  "language": "en",
  "defaultLanguage": "en",
  "hasHumanSupport": true,
  "operatorContactMethod": "email",
  "operatorEmail": "gelsogrove@gmail.com",
  "humanSupportInstructions": "Hello {{nameUser}}, I'm connecting you with our maintenance team. Someone will assist you shortly (email: {{agentEmail}}). The chatbot is paused until they respond. Thank you for your patience! 🤝"
}
```

---

## 2. AgentConfig Entries — FLOW workspace agents

A FLOW workspace needs **6 agent configs** — same as Informational (all agents EXCEPT the 3 ECOMMERCE-only types: PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING):

### 2.1 FlowAgentLLM (INFO_AGENT type — reused for FLOW)

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "name": "Flow Agent",
  "type": "INFO_AGENT",
  "description": "LLM agent that reads FlowNodeConfig and decides which troubleshooting flow to start. Answers FAQs when no flow is active.",
  "icon": "Bot",
  "systemPrompt": "",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 2048,
  "order": 0,
  "isActive": true,
  "availableFunctions": null
}
```

**Note**: `systemPrompt` is empty here because the actual prompt comes from the specific `FlowNodeConfig.systemPrompt` at runtime — it changes based on which config the customer is interacting with. This is the key difference from ECOMMERCE where the prompt is fixed per agent.

### 2.2 TranslationAgent

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "name": "Translation Agent",
  "type": "TRANSLATION",
  "description": "Translates responses to customer's preferred language",
  "icon": "Globe",
  "systemPrompt": "<<same TRANSLATION_PROMPT used by other workspaces>>",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.2,
  "maxTokens": 1024,
  "order": 99,
  "isActive": true,
  "availableFunctions": null
}
```

### 2.3 SecurityAgent

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "name": "Security Agent",
  "type": "SECURITY",
  "description": "Validates incoming messages for safety (widget only)",
  "icon": "Shield",
  "systemPrompt": "<<same SECURITY_PROMPT used by other workspaces>>",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.0,
  "maxTokens": 512,
  "order": 98,
  "isActive": true,
  "availableFunctions": null
}
```

### 2.4 CustomerSupportAgent

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "name": "Customer Support Agent",
  "type": "CUSTOMER_SUPPORT",
  "description": "Handles operator escalation, generates conversation summary, contacts human operator via email. Same implementation as Informational workspace.",
  "icon": "Headphones",
  "systemPrompt": "<<same CUSTOMER_SUPPORT_PROMPT used by Informational workspaces>>",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 1024,
  "order": 1,
  "isActive": true,
  "availableFunctions": null
}
```

**Note**: CUSTOMER_SUPPORT agent is included exactly as in Informational workspaces. The `contactOperator()` calling function delegates to this agent via `executionType: "DELEGATE_TO_AGENT"`.

### 2.5 ProfileManagementAgent

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "name": "Profile Management Agent",
  "type": "PROFILE_MANAGEMENT",
  "description": "Handles customer profile updates: email, notification preferences, personal data.",
  "icon": "UserCog",
  "systemPrompt": "<<same PROFILE_MANAGEMENT_PROMPT used by other workspaces>>",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 1024,
  "order": 2,
  "isActive": true,
  "availableFunctions": null
}
```

### 2.6 NotificationsAgent

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "name": "Notifications Agent",
  "type": "NOTIFICATIONS",
  "description": "Manages push notification preferences and settings for the customer.",
  "icon": "Bell",
  "systemPrompt": "<<same NOTIFICATIONS_PROMPT used by other workspaces>>",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 1024,
  "order": 3,
  "isActive": true,
  "availableFunctions": null
}
```

---

## 3. WorkspaceCallingFunction Entries — FLOW-specific

A FLOW workspace has these calling functions (shared across all machines):

### 3.1 contactOperator (always present)

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "functionName": "customerSupportAgent",
  "description": "Delegate to Customer Support Agent when the customer requests a human operator or when the troubleshooting flow escalates. Use for frustrated customers or unresolved machine issues.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Support request context" }
    },
    "required": ["query"]
  },
  "isSystemFunction": true,
  "executionType": "DELEGATE_TO_AGENT",
  "attachedLlm": "CUSTOMER_SUPPORT",
  "isActive": true
}
```

### 3.2 changeLanguage (shared utility)

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "functionName": "changeLanguage",
  "description": "Change the customer's preferred language. Supported: Italian (it), English (en), Spanish (es), Portuguese (pt).",
  "parameters": {
    "type": "object",
    "properties": {
      "language": { "type": "string", "enum": ["it", "en", "es", "pt"], "description": "ISO 639-1 language code" }
    },
    "required": ["language"]
  },
  "isSystemFunction": true,
  "executionType": "INTERNAL",
  "isActive": true
}
```

### 3.3 profileManagementAgent (shared utility)

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "functionName": "profileManagementAgent",
  "description": "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Profile-related request" }
    },
    "required": ["query"]
  },
  "isSystemFunction": true,
  "executionType": "DELEGATE_TO_AGENT",
  "attachedLlm": "PROFILE_MANAGEMENT",
  "isActive": true
}
```

**Note**: Functions like `productSearchAgent`, `cartManagementAgent`, `orderTrackingAgent` are **NOT seeded** — they are ECOMMERCE-specific and have no meaning in a FLOW workspace.

---

## 4. FlowNodeConfig — Config #1: Washer HS-60XX

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "flowKey": "lavatrice_hs60xx",
  "flowLabel": "Washer HS-60XX",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 2048,
  "isActive": true,

  "availableFunctions": ["startFlow", "contactOperator"],

  "systemPrompt": "You are Sofia, the expert technical assistant for the HS-60XX self-service washing machine at the Neapolis laundry.\n\nYour role:\n- Help customers who scanned the QR code on the washer\n- Guide them through troubleshooting using the available flows\n- Answer simple questions about the machine (capacity, programs, prices)\n\nMachine specs:\n- Capacity: 8 kg\n- Programs: Cotton, Synthetics, Delicates, Wool, Quick 30min\n- Price: €4.00 (Cotton), €3.50 (Synthetics), €3.00 (Delicates/Wool), €2.50 (Quick)\n- Payment: coins or contactless\n- Spin speed: 800/1000/1200 RPM (selectable)\n- EXTRA options: Extra rinse (+€0.50), Pre-wash (+€1.00)\n\nRules:\n1. ALWAYS respond in English — TranslationAgent handles i18n\n2. If the customer describes a problem → call startFlow with the matching flowId\n3. If the customer asks a general question (hours, prices, etc.) → answer directly from the specs above\n4. If you're unsure which flow to start → ask a clarifying question\n5. NEVER invent technical information not listed above\n6. If the customer is frustrated or asks for help → call contactOperator\n\nAvailable flows:\n- non_parte: Machine doesn't start (display issues, door, credit)\n- errore_alm: Error/alarm code on display (ALM/A, ALM/E, ALM/door, ALM/VAr)\n- lavaggio_problema: Problems during or after the wash (no spin, unbalanced load)\n\nTone: Friendly, concise, use emojis sparingly (👋 🔧 ✅ 👍).",

  "flows": {
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
        "onInterruptFallback": "Check the display 👀\nWhat does it show? Reply with a number (1-5)"
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
        "prompt": "The door is open.\n👉 Close the door firmly until you hear it click.",
        "transitions": { "default": "non_parte.ask_resolved" }
      },
      "caso_importo": {
        "type": "ACTION",
        "prompt": "Not enough credit.\n👉 Insert the amount shown on the display (e.g. €4.00).\nYou can pay with coins or contactless.",
        "transitions": { "default": "non_parte.ask_resolved" }
      },
      "caso_extra": {
        "type": "INFO",
        "prompt": "An EXTRA option may be active.\n👉 If an EXTRA button is lit:\n- if you don't want it → press the button to deactivate\n- if you want it → insert the remaining credit shown on display",
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
        "prompt": "I understand 😔 I'm contacting an operator to help you.",
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
        "onInterruptFallback": "Tell me the code after ALM 🔧\nReply with 1, 2, 3, or 4"
      },
      "alm_acqua": {
        "type": "ACTION",
        "prompt": "Water intake problem.\n👉 Press STOP once.\n\nIf the issue persists, please use another machine.\nI'll notify maintenance.",
        "isTerminal": true
      },
      "alm_scarico": {
        "type": "ACTION",
        "prompt": "Drainage problem.\n👉 Press STOP once.\n\n⚠️ The door may stay locked for up to 30 minutes while the water drains.\n\nIf the issue persists, please use another machine.",
        "isTerminal": true
      },
      "alm_door": {
        "type": "ACTION",
        "prompt": "Door latch problem.\n👉 Press STOP once.\n\nIf the issue persists, please use another machine.",
        "isTerminal": true
      },
      "alm_var": {
        "type": "INFO",
        "prompt": "Technical machine fault.\n👉 Please use another machine.\nWe'll provide a compensation 👍\n\nI'm notifying maintenance.",
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
        "onInterruptFallback": "Describe what happened during the wash 🔧\nReply with 1 or 2"
      },
      "no_centrifuga": {
        "type": "INFO",
        "prompt": "The load was probably too large or unbalanced.\n👉 Split the load and run a new spin cycle (Quick program at €2.50).",
        "isTerminal": true
      },
      "end_bal": {
        "type": "INFO",
        "prompt": "The wash finished but the spin cycle failed due to an unbalanced load.\n👉 Split the load and run a new spin cycle (Quick program at €2.50).",
        "isTerminal": true
      }
    }
  }
}
```

---

## 5. FlowNodeConfig — Config #2: Dryer ED-340

```json
{
  "workspaceId": "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d",
  "flowKey": "asciugatrice_ed340",
  "flowLabel": "Dryer ED-340",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 2048,
  "isActive": true,

  "availableFunctions": ["startFlow", "contactOperator"],

  "systemPrompt": "You are Sofia, the expert technical assistant for the ED-340 self-service dryer at the Neapolis laundry.\n\nYour role:\n- Help customers who scanned the QR code on the dryer\n- Guide them through troubleshooting using the available flows\n- Answer simple questions about the dryer (capacity, programs, prices)\n\nMachine specs:\n- Capacity: 15 kg\n- Programs: Cotton High Temp, Cotton Low Temp, Synthetics, Delicates\n- Duration: 30 min (standard), 45 min (+€1.50), 15 min (quick dry)\n- Price: €3.00 (30 min), €4.50 (45 min), €2.00 (15 min quick)\n- Payment: coins or contactless\n- Lint filter: should be cleaned before each use\n\nRules:\n1. ALWAYS respond in English — TranslationAgent handles i18n\n2. If the customer describes a problem → call startFlow with the matching flowId\n3. If the customer asks a general question (hours, prices, etc.) → answer directly from the specs above\n4. If you're unsure which flow to start → ask a clarifying question\n5. NEVER invent technical information not listed above\n6. If the customer is frustrated or asks for help → call contactOperator\n\nAvailable flows:\n- non_parte: Dryer doesn't start (door, display, credit)\n- errore_reset: Error/alarm on dryer (alarm light, not heating, won't start)\n\nTone: Friendly, concise, use emojis sparingly (👋 🔧 ✅ 👍).",

  "flows": {
    "non_parte": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "What's happening with the dryer?\n\n1️⃣ Display shows nothing / blank\n2️⃣ Door won't close properly\n3️⃣ Shows a price but won't start",
        "transitions": {
          "1": "non_parte.display_blank",
          "2": "non_parte.door_issue",
          "3": "non_parte.credit_issue"
        },
        "onInterruptFallback": "Tell me what you see on the dryer 🔧\nReply with 1, 2, or 3"
      },
      "display_blank": {
        "type": "ACTION",
        "prompt": "The dryer may need a reset.\n👉 Open the door, wait 10 seconds, close it firmly, then try again.\n\nIf the display stays blank, please use another dryer.",
        "transitions": { "default": "non_parte.ask_resolved" }
      },
      "door_issue": {
        "type": "ACTION",
        "prompt": "The door latch may be stuck.\n👉 Check that no clothes are caught in the door seal.\n👉 Close the door firmly until you hear it click.",
        "transitions": { "default": "non_parte.ask_resolved" }
      },
      "credit_issue": {
        "type": "ACTION",
        "prompt": "You may need to insert more credit.\n👉 Check the amount shown on the display and insert coins or tap contactless.\n\nIf the issue persists after paying, try pressing the START button firmly.",
        "transitions": { "default": "non_parte.ask_resolved" }
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
        "prompt": "Great! ✅ Your clothes will be dry soon 👍",
        "isTerminal": true
      },
      "handle_escalate": {
        "type": "INFO",
        "prompt": "I understand 😔 I'm contacting an operator to help you.",
        "isTerminal": true
      }
    },

    "errore_reset": {
      "step_0": {
        "type": "CHOICE",
        "prompt": "What problem do you see?\n\n1️⃣ Alarm / red light\n2️⃣ Not heating (clothes still wet after full cycle)\n3️⃣ Dryer stops mid-cycle",
        "transitions": {
          "1": "errore_reset.allarme",
          "2": "errore_reset.non_scalda",
          "3": "errore_reset.mid_stop"
        },
        "onInterruptFallback": "Tell me what you see on the dryer 🔧\nReply with 1, 2, or 3"
      },
      "allarme": {
        "type": "ACTION",
        "prompt": "To reset the alarm:\n👉 Press and hold the STOP button for 3 seconds.\n👉 Open the door, clean the lint filter, close the door.\n👉 Try starting again.",
        "transitions": { "default": "errore_reset.ask_resolved" }
      },
      "non_scalda": {
        "type": "ACTION",
        "prompt": "First, check the lint filter — a clogged filter reduces heat.\n👉 Pull out the filter, remove lint, put it back.\n👉 Run a new cycle.\n\nIf it still doesn't heat, the heating element may need service. Please use another dryer.",
        "transitions": { "default": "errore_reset.ask_resolved" }
      },
      "mid_stop": {
        "type": "ACTION",
        "prompt": "The dryer may have overheated (safety shut-off).\n👉 Wait 5 minutes for it to cool down.\n👉 Check and clean the lint filter.\n👉 Try starting again with a smaller load.",
        "transitions": { "default": "errore_reset.ask_resolved" }
      },
      "ask_resolved": {
        "type": "CONFIRMATION",
        "prompt": "Did that solve the problem? (yes / no)",
        "transitions": {
          "YES": "errore_reset.end_success",
          "NO": "errore_reset.handle_escalate"
        }
      },
      "end_success": {
        "type": "INFO",
        "prompt": "Great! ✅ Your clothes will be dry soon 👍",
        "isTerminal": true
      },
      "handle_escalate": {
        "type": "INFO",
        "prompt": "I understand 😔 I'm contacting an operator to help you.",
        "isTerminal": true
      }
    }
  }
}
```

---

## 6. QR Code Mapping

Each physical machine gets a QR code sticker:

| Machine | QR Text | Where to place |
|---|---|---|
| Washer #1 | `START_FLOW_1_lavatrice_hs60xx` | Back panel of washer |
| Washer #2 | `START_FLOW_2_lavatrice_hs60xx` | Back panel of washer |
| Dryer #1 | `START_FLOW_3_asciugatrice_ed340` | Side panel of dryer |
| Dryer #2 | `START_FLOW_4_asciugatrice_ed340` | Side panel of dryer |

The number after `START_FLOW_` is the **physical machine number** (for the laundry to identify which specific unit). The `flowKey` after it (`lavatrice_hs60xx`) determines which `FlowNodeConfig` to load.

QR extraction regex:
```
/^START_FLOW_(\d+)_(.+)$/
  group 1: flow number (stored in context.flowNumber for operator reference)
  group 2: flowKey (used to query FlowNodeConfig)
```

---

## 7. Conversation Example — Full walkthrough

### Customer scans QR on Washer #2

```
Customer scans QR → "START_FLOW_2_lavatrice_hs60xx"

Strategy: QR detected
  → flowKey = "lavatrice_hs60xx", flowNumber = "2"
  → loads FlowNodeConfig for lavatrice_hs60xx
  → saves context: { flowKey: "lavatrice_hs60xx", flowNumber: "2" }

Response: "Hi! 👋 I'm Sofia, your assistant for the Washer HS-60XX (machine #2).
           How can I help you? Describe your problem or ask me anything about the machine."

Customer: "la lavatrice non parte"

Strategy: no active flow → FlowAgentLLM
  → loads history (1 message)
  → builds tools: startFlow(enum: ["non_parte","errore_alm","lavaggio_problema"]), contactOperator
  → LLM: tool_call startFlow("non_parte")
  → FlowEngine.startFlow("non_parte", context)
  → context.flowState = { flowId: "non_parte", currentNodeId: "non_parte.step_0", flowStatus: "ACTIVE" }

Response: "What do you see on the washer display?

           1️⃣ SEL
           2️⃣ PUSH / Pr
           3️⃣ door
           4️⃣ A number (e.g. 04.00)
           5️⃣ EXTRA light is on"

Customer: "3"

Strategy: flowState.flowStatus === "ACTIVE" → FlowEngine.handleMessage("3", context)
  → classifyInput("3") = MATCH
  → node = non_parte.step_0 (CHOICE)
  → transitions["3"] = "non_parte.caso_door"
  → nextNode = non_parte.caso_door (ACTION)
  → context.flowState.currentNodeId = "non_parte.caso_door"

Response: "The door is open.
           👉 Close the door firmly until you hear it click."

Customer: "done"

Strategy: flowState ACTIVE → FlowEngine.handleMessage("done", context)
  → classifyInput("done") = AMBIGUOUS (not a number or yes/no)
  → node = non_parte.caso_door (ACTION)
  → transitions["default"] = "non_parte.ask_resolved"
  → advances to ask_resolved

Response: "Did that solve the problem? (yes / no)"

Customer: "yes"

Strategy: flowState ACTIVE → FlowEngine.handleMessage("yes", context)
  → classifyInput("yes") = MATCH
  → node = non_parte.ask_resolved (CONFIRMATION)
  → transitions["YES"] = "non_parte.end_success"
  → nextNode = end_success (INFO, isTerminal: true)
  → flowState.flowStatus = "COMPLETED"
  → context.flowState = undefined

Response: "Great! ✅ Enjoy your wash 👍"

(Flow completed — next message goes to FlowAgentLLM again)
```

---

## 8. Adding New Configs (CRUD pattern)

When the laundry buys a new machine type, the admin:

1. Opens `/settings/flow-configs`
2. Clicks **[+ Add Flow Config]**
3. Fills in:
   - `flowKey`: e.g. `centrifuga_x200`
   - `flowLabel`: e.g. `Spin Dryer X200`
   - `systemPrompt`: write the specs + rules for this config
   - `availableFunctions`: check `startFlow`, `contactOperator`
4. In the **Flows** section, adds:
   - A flow (e.g. `non_parte`) with `step_0` node
   - Adds nodes with transitions
5. Saves → FlowNodeConfig created in DB
6. Prints QR code: `START_FLOW_{N}_centrifuga_x200`
7. Done — the new config is live immediately

**No code changes needed**. The FlowAgentLLM dynamically builds its tools from `Object.keys(flows)`, so the new flow IDs are automatically available as `startFlow` enum values.
