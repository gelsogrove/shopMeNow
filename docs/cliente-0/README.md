# Cliente-0 — Flow Workspace Documentation

Design and UX reference for the **ChannelMode.FLOW** chatbot — guided, deterministic troubleshooting flows for appliance brands.

---

## Documents in this folder

| # | File | Contents |
|---|---|---|
| 01 | [message-pipeline.md](./01-message-pipeline.md) | Full message processing pipeline — how every piece connects (Security → Routing → FlowEngine/LLM → Translation → Debug log) |
| 02 | [flow-config-editor.md](./02-flow-config-editor.md) | Admin UI wireframes — list page, slide editor, 3-panel visual flow designer |
| 03 | [debug-view.md](./03-debug-view.md) | Debug view integration — new DebugStep types, MessageFlowDialog timeline for FLOW messages |
| 04 | [neapolis-seed-config.md](./04-neapolis-seed-config.md) | Complete seed data for Neapolis FLOW workspace — channel settings, AgentConfig, CallingFunctions, 2 FlowNodeConfigs (washer + dryer), QR mapping, conversation walkthrough |
| 05 | [master-plan.md](./05-master-plan.md) | **Master plan**: all epics (E0-E8), test plans (58 tests), build checks, security audits, PRD update, architecture validation, welcome message flag |

---

## Reference Materials

### Design docs

| File | Content |
|---|---|
| [flow-design-hs60xx.md](./flow-design-hs60xx.md) | Complete HS-60XX washer flow spec — 4 flows, ~20 nodes |

### PDFs (machine manuals)

| File | Content | Language |
|---|---|---|
| `PROGRAMES.pdf` / `PROGRAMES (1).pdf` | Washing machine programs / operation manual | Catalan |
| `SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf` | Washer troubleshooting — **source for HS-60XX flows** | Catalan |
| `SOLUCIÓN-DE-PROBLEMAS-SECADORAS.pdf` | Dryer troubleshooting — **source for ED-340 flows** | Spanish |

---

## Quick Glossary

| Term | Meaning |
|---|---|
| **FlowNodeConfig** | DB record per appliance model — holds `systemPrompt`, `flows` JSON, `model`, etc. |
| **MachineAgentLLM** | LLM agent that reads FlowNodeConfig and decides which flow to start |
| **FlowEngineService** | Deterministic engine — never calls LLM, reads flow JSON, applies transitions |
| **FlowState** | `{ flowId, currentNodeId, flowStatus, interruptCount }` — saved in `ChatSession.context` |
| **QR trigger** | Message format: `START_MACHINE_{workspaceId}_{machineId}` e.g. `START_MACHINE_2_lavatrice_hs60xx` |
| **DebugStep** | Unit of observable work in the pipeline — rendered in MessageFlowDialog |
