# Debug View — FLOW Pipeline Integration

## Overview

The existing `MessageFlowDialog` component (the timeline that shows how a message was processed) needs **2 new DebugStep types** for FLOW workspaces:

| New type | Agent label | Color | Icon | Replaces |
|---|---|---|---|---|
| `"flow-engine"` | "⚙️ Flow Engine" | `#7C3AED` (violet) | `<Workflow />` | Nothing — new |
| `"flow-agent"` | "🤖 Flow Agent" | `#1D4ED8` (dark blue) | `<Bot />` | Sub-agent but specialized |

These integrate into the existing timeline alongside Security, Translation, WhatsApp Queue steps.

---

## What gets logged at each stage

### Stage 1 — SecurityAgent (existing, unchanged)

```json
{
  "type": "safety",
  "agent": "🛡️ Widget Security Layer",
  "model": "N/A",
  "timestamp": "...",
  "input": { "userMessage": "la lavatrice non parte" },
  "output": { "decision": "allow", "safe": true }
}
```

### Stage 3A — FlowAgentLLM call (NEW type: "flow-agent")

```json
{
  "type": "flow-agent",
  "agent": "🤖 Flow Agent",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.3,
  "timestamp": "...",
  "tokenUsage": {
    "promptTokens": 1200,
    "completionTokens": 18,
    "totalTokens": 1218
  },
  "input": {
    "userMessage": "la lavatrice non parte",
    "flowKey": "lavatrice_hs60xx",
    "flowLabel": "Washer HS-60XX",
    "historyMessages": 4,
    "toolsAvailable": ["startFlow", "contactOperator"],
    "flowsAvailable": ["non_parte", "errore_alm", "lavaggio_problema"]
  },
  "output": {
    "decision": "tool_call",
    "toolCall": {
      "name": "startFlow",
      "arguments": { "flowId": "non_parte" }
    }
  }
}
```

### Stage 3B — FlowEngineService (NEW type: "flow-engine")

```json
{
  "type": "flow-engine",
  "agent": "⚙️ Flow Engine",
  "model": "N/A",
  "timestamp": "...",
  "tokenUsage": {
    "promptTokens": 0,
    "completionTokens": 0,
    "totalTokens": 0
  },
  "input": {
    "flowId": "non_parte",
    "action": "startFlow",
    "userInput": null
  },
  "output": {
    "nodeId": "non_parte.step_0",
    "nodeType": "CHOICE",
    "flowStatus": "ACTIVE",
    "responseText": "Is the door closed? What do you see...",
    "shouldCallOperator": false,
    "interruptCount": 0
  }
}
```

When FlowEngine is called for **subsequent messages** (handleMessage, not startFlow):

```json
{
  "type": "flow-engine",
  "agent": "⚙️ Flow Engine",
  "model": "N/A",
  "timestamp": "...",
  "tokenUsage": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0 },
  "input": {
    "flowId": "non_parte",
    "action": "handleMessage",
    "userInput": "1",
    "previousNodeId": "non_parte.step_0",
    "classification": "MATCH"
  },
  "output": {
    "nodeId": "non_parte.caso_sel",
    "nodeType": "CHOICE",
    "flowStatus": "ACTIVE",
    "transitionKey": "1",
    "responseText": "Which symptom best describes...",
    "shouldCallOperator": false,
    "interruptCount": 0
  }
}
```

### Stage 5 — TranslationAgent (existing, unchanged)

```json
{
  "type": "sub_agent",
  "agent": "🌐 Translation Layer",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.1,
  "timestamp": "...",
  "tokenUsage": { ... },
  "input": {
    "previousResponse": "Is the door closed? What do you see...",
    "targetLanguage": "IT"
  },
  "output": {
    "translatedText": "Lo sportello è chiuso? Cosa vedi..."
  }
}
```

---

## Debug View — Timeline Wire for a FLOW Message

This is what the MessageFlowDialog looks like for Path B (FlowAgentLLM → startFlow):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Message Flow Debug                                                    [✕]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  👤  "la lavatrice non parte"                                               │
│      Customer · 09:00:01                                                    │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  🛡️  Widget Security Layer                                    ▶ EXPAND      │
│      safe · 0ms · 0 tokens                                                  │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
│      INPUT:  "la lavatrice non parte"                                       │
│      OUTPUT: ✅ Safe — allowed                                               │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  🤖  Flow Agent       [gpt-4o-mini · 0.3]          ▶ EXPAND  1218 tokens  │
│      tool_call: startFlow("non_parte") · 340ms                              │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
│      INPUT:  "la lavatrice non parte"                                       │
│              Machine: Washer HS-60XX                                         │
│              History: 4 messages                                            │
│              Tools: startFlow, contactOperator                              │
│              Flows: non_parte, errore_alm, lavaggio_problema                │
│      OUTPUT: → startFlow("non_parte")                                       │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  ⚙️  Flow Engine       [no LLM · deterministic]     ▶ EXPAND  0 tokens     │
│      startFlow → non_parte.step_0 · 2ms                                    │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
│      INPUT:  flowId: "non_parte", action: startFlow                         │
│      OUTPUT: node: non_parte.step_0 (CHOICE)                                │
│              status: ACTIVE                                                 │
│              response: "Is the door closed? What do you see on..."          │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  🌐  Translation Layer  [gpt-4o-mini · 0.1]        ▶ EXPAND   210 tokens  │
│      en → it · 180ms                                                        │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
│      INPUT:  "Is the door closed? What do you see..."                       │
│              Target: IT                                                     │
│      OUTPUT: "Lo sportello è chiuso? Cosa vedi sul display..."              │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  💾  Save to History                               ▶ EXPAND  0 tokens      │
│      ConversationMessage saved · 5ms                                        │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  📤  WhatsApp Queue                                ▶ EXPAND  0 tokens      │
│      queued for delivery                                                    │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│  Total: 1428 tokens · 527ms                                                 │
│  Flow: non_parte · Node: step_0 · Status: 🟢 ACTIVE                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Debug View — Timeline Wire for Path A (FlowEngine direct, no LLM)

This is what the timeline looks like when the flow is already active and the customer types "1":

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Message Flow Debug                                                    [✕]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  👤  "1"                                                                    │
│      Customer · 09:01:04                                                    │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  ⚙️  Flow Engine       [no LLM · deterministic]     ▶ EXPAND  0 tokens     │
│      MATCH → non_parte.caso_sel · 1ms                                      │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
│      INPUT:  "1", flow: non_parte, node: step_0                             │
│              classification: MATCH                                          │
│      OUTPUT: transition "1" → non_parte.caso_sel                            │
│              status: ACTIVE, interruptCount: 0                              │
│              response: "Which symptom best describes your issue?..."        │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  🌐  Translation Layer  [gpt-4o-mini · 0.1]        ▶ EXPAND   190 tokens  │
│      en → it · 160ms                                                        │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  💾  Save to History + 📤 WhatsApp Queue                       0 tokens     │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│  Total: 190 tokens · 162ms                                                  │
│  Flow: non_parte · Node: caso_sel · Status: 🟢 ACTIVE                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Notice**: Path A has **no FlowAgentLLM step** — the whole message is handled by FlowEngine in 1ms. The token count goes from ~1200 (per message in Path B) to 190 (just translation). This is the efficiency advantage of the deterministic flow.

---

## Debug View — Escalation (HARD_BREAK / too many interrupts)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Message Flow Debug                                                    [✕]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  👤  "operator"                                                             │
│      Customer · 09:03:22                                                    │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  ⚙️  Flow Engine       [no LLM · deterministic]     ▶ EXPAND  0 tokens     │
│      HARD_BREAK → ESCALATED · 1ms                                           │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
│      INPUT:  "operator", classification: HARD_BREAK                         │
│      OUTPUT: flowStatus: ESCALATED, shouldCallOperator: true               │
│              response: "I'm connecting you with an operator 👍"             │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  📧  Contact Operator                              ▶ EXPAND  500 tokens     │
│      email sent → admin@brand.it · 2100ms                                  │
│      ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄              │
    │  flowKey: lavatrice_hs60xx, conversationId: ...                 │
│      OUTPUT: ✅ Email sent with 1-sentence summary:                         │
│              "Customer is having trouble with the HS-60XX              │
│               drum and requested operator assistance"                       │
│                                                                              │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  🌐  Translation Layer  + 💾 Save + 📤 Queue                                │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│  Total: 690 tokens · 2262ms                                                 │
│  Flow: non_parte · Status: 🔴 ESCALATED                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Footer bar — Flow State Summary

At the bottom of every MessageFlowDialog for FLOW messages, add a **flow state bar**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Flow: non_parte  ·  Node: caso_sel  ·  Status: 🟢 ACTIVE  ·  Interrupts: 0 │
└──────────────────────────────────────────────────────────────────────────────┘
```

Status color coding:
- `🟢 ACTIVE` — flow running normally
- `⏸️ PAUSED` — customer said stop/basta
- `✅ COMPLETED` — reached terminal node
- `🔴 ESCALATED` — sent to operator

---

## Changes needed in MessageFlowDialog.tsx

### 1. New DebugStep types to add

In the `DebugStep` interface (line ~33 of `MessageFlowDialog.tsx`):

```typescript
type:
  | "router"
  | "function_call"
  | "function_result"
  | "safety"
  | "sub_agent"
  | "summary_agent"
  | "operator_message"
  | "user"
  | "token-replacement"
  | "flow-engine"    // NEW
  | "flow-agent"     // NEW
```

### 2. New colors in `getAgentColor()`

```typescript
if (type === "flow-engine")   return "#7C3AED"  // violet
if (type === "flow-agent")    return "#1D4ED8"  // dark blue (matches brand)
```

### 3. New icons in `getAgentIcon()`

```typescript
if (type === "flow-engine")   return <Workflow className="w-5 h-5" />
if (type === "flow-agent")    return <Bot className="w-5 h-5" />
```

### 4. Timeline ordering

FLOW message steps order in `timelineSequence`:

```
userStep
  ↓
securityStep (widget only)
  ↓
machineAgentStep (PATH B/C: LLM was called)
  ↓                 OR
flowEngineStep ─── flowEngineStep (PATH A: flow was already active, direct)
  ↓
contactOperatorStep (if shouldCallOperator)
  ↓
translationStep
  ↓
saveToHistoryStep
  ↓
queueStep
```

### 5. Footer — Flow State bar

Add a new section after the timeline if the message has any `flow-engine` step:

```typescript
const flowEngineStep = allSteps.find(s => s.type === "flow-engine")

// At the bottom:
{flowEngineStep && (
  <FlowStateSummaryBar
    flowId={flowEngineStep.input?.flowId}
    nodeId={flowEngineStep.output?.nodeId}
    flowStatus={flowEngineStep.output?.flowStatus}
    interruptCount={flowEngineStep.output?.interruptCount}
  />
)}
```

---

## What the admin sees vs what the developer sees

| Element | Admin (default view) | Dev (expanded view) |
|---|---|---|
| Flow Engine step | "handled by flow logic — 2ms, 0 tokens" | full input/output JSON |
| Flow Agent step | "asked LLM to start flow non_parte" | systemPrompt, full messages array, tool definitions |
| FlowStatus bar | colored badge + node name | all FlowState fields |
| Translation step | "translated to Italian" | source text, target text, tokens |
| Escalation | "sent to operator" | email address, summary text, ticket ID |

The toggle between admin/dev view can reuse the existing expand/collapse pattern already in `MessageFlowDialog`.
