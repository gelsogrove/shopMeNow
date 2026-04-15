# Flow Config Editor — Admin UI

## Overview

The admin manages `FlowNodeConfig` records through two screens:
1. **List page** — shows all flow configs for the current workspace
2. **Editor panel** — slide-in panel (Sheet) to create or edit a config

The **critical UX challenge** is editing the `flows` field — it is a deeply nested JSON object. Instead of a raw textarea, we use a **3-panel visual flow designer** embedded inside the editor panel.

---

## Screen 1 — FlowConfigs List Page

**Route**: `/settings/flow-configs`
**Visible only for**: workspaces where `channelMode === "FLOW"`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⚙️  Flow Configurations                                   [+ Add Flow Config] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Flow Label          Flow Key             Model            Status    │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Washer HS-60XX      lavatrice_hs60xx     gpt-4o-mini    ● Active    │   │
│  │                                                          [Edit] [⋯]  │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Dryer ED-340        asciugatrice_ed340   gpt-4o-mini    ● Active    │   │
│  │                                                          [Edit] [⋯]  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  │  2 flow configurations                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Clicking [Edit]** → slides in the Editor Panel from the right.
**Clicking [⋯]** → dropdown: Edit, Duplicate, Delete (with confirmation).

---

## Screen 2 — Editor Panel (Sheet slide-in)

The panel slides in from the right and occupies **75% of the screen width** (wider than normal sheets — needs space for the 3-panel flow designer).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Edit Flow Config: Washer HS-60XX                               [Save] [✕]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────── SECTION: Flow Config ──────────────────────────────────────┐ │
│  │  Flow Label *             Flow Key *                                  │ │
│  │  [  Washer HS-60XX   ]  [  lavatrice_hs60xx  ]  (locked after save)   │ │
│  │                                                                        │ │
│  │  LLM Model              Temperature     Max Tokens     Status         │ │
│  │  [openai/gpt-4o-mini ▼] [  0.3        ] [  2048     ] [● Active ●]   │ │
│  │                                                                        │ │
│  │  Available Functions                                                   │ │
│  │  [✓] contactOperator   [ ] otherFunction                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────── SECTION: System Prompt ────────────────────────────────────────┐ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │ You are a helpful troubleshooting assistant for the HS-60XX    │   │ │
│  │  │ washing machine. You assist customers who scan the QR code     │   │ │
│  │  │ on their machine.                                              │   │ │
│  │  │                                                                │   │ │
│  │  │ Available flows:                                               │   │ │
│  │  │ - non_parte: Machine doesn't start                            │   │ │
│  │  │ - errore_alm: Error code displayed                            │   │ │
│  │  │ - lavaggio_problema: Washing problem                          │   │ │
│  │  │                                                                │   │ │
│  │  │ Always respond in English. TranslationAgent handles i18n.     │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────── SECTION: Flows ─────────────────────────────── [+ Add Flow] ──┐ │
│  │                (3-panel visual flow designer — see below)               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│                                                      [Cancel]  [Save Config] │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## The 3-Panel Visual Flow Designer

This is the core of the admin UX. It replaces editing raw JSON.

The "Flows" section expands to a **3-column layout**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  FLOWS SECTION                                                           [+ Add Flow]        │
├───────────────────┬──────────────────────────┬─────────────────────────────────────────────┤
│  FLOWS            │  NODES                   │  NODE DETAIL                                 │
│  (left panel)     │  (center panel)          │  (right panel)                               │
├───────────────────┼──────────────────────────┼─────────────────────────────────────────────┤
│                   │                          │                                               │
│  ▶ non_parte  ●  │  ┌─ step_0 (CHOICE) ─┐  │  Node ID: caso_sel                           │
│                   │  │ entry — 3 opts     │  │  Type: [CHOICE ▼]                            │
│  ▶ errore_alm    │  └────────────────────┘  │  Is terminal: [ ]                            │
│                   │           ↓              │                                               │
│  ▶ lavaggio_     │  ┌─ caso_sel (CHOICE)─┐  │  Prompt (English):                           │
│    problema      │  │ ← SELECTED         │  │  ┌────────────────────────────────────────┐  │
│                   │  └────────────────────┘  │  │ Which symptom best describes your       │  │
│  [+ Add Flow]    │           ↓ ↓ ↓           │  │ issue?                                  │  │
│                   │                          │  │ 1 – Drum visible, door open             │  │
│                   │  ┌─ caso_push  ─┐        │  │ 2 – Display shows error E3             │  │
│                   │  │ terminal ●   │        │  │ 3 – Drum is not moving                 │  │
│                   │  └─────────────┘        │  └────────────────────────────────────────┘  │
│                   │  ┌─ caso_door  ─┐        │                                               │
│                   │  │ terminal ●   │        │  Interrupt fallback (shown when ambiguous):   │
│                   │  └─────────────┘        │  ┌────────────────────────────────────────┐  │
│                   │  ┌─ caso_importo─┐       │  │ Please reply with a number:             │  │
│                   │  │               │       │  │ 1, 2, or 3 😊                          │  │
│                   │  └─────────────┘        │  └────────────────────────────────────────┘  │
│                   │                          │                                               │
│                   │  [+ Add Node]           │  Transitions:                                 │
│                   │                          │  ┌────────────────────────────────────────┐  │
│                   │                          │  │  Key   →   Node                         │  │
│                   │                          │  │  "1"   →   [caso_push     ▼]            │  │
│                   │                          │  │  "2"   →   [caso_importo  ▼]            │  │
│                   │                          │  │  "3"   →   [caso_door     ▼]            │  │
│                   │                          │  │  [+ Add transition]                     │  │
│                   │                          │  └────────────────────────────────────────┘  │
│                   │                          │                                               │
│                   │                          │              [Delete Node]  [Save Node]       │
└───────────────────┴──────────────────────────┴─────────────────────────────────────────────┘
```

### Left panel — Flow list

Shows all `flowId` keys from `FlowNodeConfig.flows`.
- Click a flow name → loads its nodes in center panel
- `[+ Add Flow]` → dialog asking for flowId (e.g. `blocco_programma`)
- Right-click → rename flow, delete flow

### Center panel — Node list

Shows all node keys for the selected flow in **tree-traversal order** (starting from `step_0`).
- Colored badges for node type: `CHOICE` (blue), `CONFIRMATION` (yellow), `ACTION` (green), `INFO` (gray), `FREE_TEXT` (purple)
- `●` dot = terminal node
- Click node → loads detail in right panel
- Arrows between nodes show transitions (scroll to next)
- `[+ Add Node]` → creates new empty node

### Right panel — Node detail editor

Fields change based on `type` selection:

**CHOICE node** (dropdown: 1–9 options):
```
Type: [CHOICE ▼]
Prompt textarea
Interrupt fallback textarea
Transitions: table with "option number" → "node selector (dropdown)"
[+ Add option]
```

**CONFIRMATION node** (yes/no split):
```
Type: [CONFIRMATION ▼]
Prompt textarea
Interrupt fallback textarea
Transitions:
  YES → [node selector]
  NO  → [node selector]
```

**ACTION node** (single path):
```
Type: [ACTION ▼]
Prompt textarea   (optional — can be empty for "silent" actions)
Default transition → [node selector]
```

**INFO node** (terminal or intermediate):
```
Type: [INFO ▼]
Prompt textarea
Is terminal: [toggle]
IF NOT terminal: Default transition → [node selector]
```

**FREE_TEXT node** (open input, routed by LLM):
```
Type: [FREE_TEXT ▼]
Prompt textarea
Default transition → [node selector]
Note: ⚠️ FREE_TEXT nodes ask FlowAgentLLM to classify the response
```

---

## Validation rules (before save)

The "Save Config" button runs these validations:

```
1. flowLabel is not empty
2. flowKey matches /^[a-z0-9_]+$/ (no spaces, lowercase only)
3. systemPrompt is not empty
4. Each flow has a "step_0" node
5. All transition targets point to existing nodes in the same flow
6. No node references a node in a different flow
   (cross-flow: FlowAgentLLM calls startFlow() — FlowEngine internal transitions stay within flow)
7. Terminal nodes have no transitions defined
8. At least one flow defined
9. systemPrompt does NOT contain {{products}}, {{offers}}, {{categories}}, {{services}}
   (these are ECOMMERCE variables — forbidden in FLOW workspace prompts — Principle III)
```

If validation fails → toast with specific error highlighting which flow/node has the problem.

---

## Export / Import raw JSON

Power users can toggle to **"Raw JSON editor"** at the bottom of the Flows section:

```
  ─────────────────────────────────────────────────────────────────────────────
  FLOWS    [Visual Editor]  [Raw JSON ▼]
  ─────────────────────────────────────────────────────────────────────────────
```

Raw JSON mode shows a Monaco-style code editor (or plain textarea) with:
- JSON syntax highlighting
- JSON.parse validation before save
- "Switch to Visual" button (re-validates structure)

---

## QR Code generation

At the bottom of the list page, each config row has a **[QR]** button that generates the QR code image. QR content:

```
START_FLOW_{workspaceId}_{flowKey}
e.g. START_FLOW_2_lavatrice_hs60xx
```

Clicking [QR]:
- Shows a modal with the QR image
- Buttons: Download PNG, Copy text, Print

```
┌──────────────────────────────────────────────────────────┐
│  QR Code — Washer HS-60XX                            [✕] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│      ┌───────────────────────────────┐                  │
│      │  ██████████████████████████  │                  │
│      │  ██  ██  ████  ██  ████  ██  │                  │
│      │  ██  ██  ████  ██  ████  ██  │                  │
│      │  ██████████████████████████  │                  │
│      └───────────────────────────────┘                  │
│                                                          │
│  Content: START_FLOW_2_lavatrice_hs60xx              │
│                                                          │
│  [Download PNG]   [Copy Text]   [Print]                 │
└──────────────────────────────────────────────────────────┘
```

This QR is placed physically on the appliance. When the customer scans it on WhatsApp, it triggers Path D from `01-message-pipeline.md`.
