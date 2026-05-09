# Orchestrator — `agent.ts:agentTurn()`

`agentTurn()` is THE orchestrator. There is no separate intent router.
Every customer turn flows through these five steps in this order:

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1 — Language detection                                          │
│   regex heuristic on user message; falls back to a tiny LLM call     │
│   (`prompts/language.txt`) only if the heuristic returns null.       │
│   Locked to `settings.enabledLanguages`.                             │
└──────────────────────────────────────────────────────────────────────┘
                                 │
┌──────────────────────────────▼───────────────────────────────────────┐
│ STEP 2 — autoExtractFacts (utils/agent-extract.ts)                   │
│   PURE / DETERMINISTIC. Pulls sticky facts from the user message:    │
│     location, machineType, machineNumber, displayState, payment.     │
│   Sets pendingFlow markers (caso 4 / 6 / 7 / 17 / 18 / 26 / 28) when │
│   the message uniquely identifies a known incident.                  │
│   No LLM, no I/O.                                                    │
│                                                                      │
│   PRE-STEP SNAPSHOT: just BEFORE calling autoExtractFacts, the       │
│   orchestrator records `state.displayStateAtTurnStart =              │
│   state.displayState`. This snapshot lets downstream guards detect   │
│   when the customer volunteered a NEW display in the same message    │
│   (e.g. "No, ahora aparece PUSH PROG") so they can pivot to the new  │
│   flow instead of re-asking. See utils/guards/display.ts Phase B.    │
└──────────────────────────────────────────────────────────────────────┘
                                 │
┌──────────────────────────────▼───────────────────────────────────────┐
│ STEP 3 — runGuardPipeline (utils/guards/) ← MAIN DECISION            │
│   26 ordered guards. Each is a pure (state, msg) → reply | null.     │
│   FIRST MATCH WINS — pipeline halts and the canned reply is sent     │
│   to the customer. ~70% of real conversations close here without     │
│   ever reaching the LLM. This is by design: deterministic replies    │
│   are auditable, free, instant, and easy to test.                    │
└──────────────────────────────────────────────────────────────────────┘
                                 │ no guard matched
┌──────────────────────────────▼───────────────────────────────────────┐
│ STEP 4 — LLM agent loop with TOOL CALLING                            │
│                                                                      │
│   The LLM (model from `settings.model`) receives:                    │
│     - system prompt = `prompts/agent.txt` + injected `reglas.md`     │
│       + sticky state placeholders + tenant settings                  │
│     - full conversation history                                      │
│     - schemas of 12 tools (set_location, set_machine_facts,          │
│       start_machine_flow, advance_machine_flow, apply_faq_override,  │
│       capture_customer_name, escalate_to_operator, ...).             │
│                                                                      │
│   On EACH iteration the LLM either:                                  │
│     (a) returns a plain text reply → loop exits, that's the answer.  │
│     (b) returns one or more tool_calls → executeTool() runs them,    │
│         their JSON results are appended as `role:'tool'` messages,   │
│         and the loop iterates again so the LLM can continue with     │
│         fresh data (e.g. it called start_machine_flow and now wants  │
│         to phrase the first step prompt for the customer).           │
│                                                                      │
│   Capped at `settings.maxToolHops` iterations to prevent runaway     │
│   loops. NO tool call also exits the loop immediately.               │
└──────────────────────────────────────────────────────────────────────┘
                                 │
┌──────────────────────────────▼───────────────────────────────────────┐
│ STEP 5 — Post-processing                                             │
│   - Sanitize the reply (strip role-leak, format quirks)              │
│   - On turn 1: prepend the configured welcome (unless the LLM        │
│     already greeted or the customer already gave concrete facts)     │
│   - On turn 2+: strip any greeting paragraph the LLM may have        │
│     reintroduced ("Hola, soy Eco" → removed)                         │
│   - If the pipeline marked an escalation AND we have customerName,   │
│     append the operator handover summary                             │
└──────────────────────────────────────────────────────────────────────┘
```

## Why hybrid (deterministic + LLM)?

- Deterministic guards = auditable, free, instant, regression-friendly.
- LLM tool calling = handles the long tail / context switches / FAQ.
- Sticky state survives across turns so context-switching is natural
  (the customer can ask about pricing mid-troubleshooting and come back).

## Run modes — same code in both

- **CLI**: `npm run demo` → calls `agentTurn()` interactively in a REPL.
- **Web**: `index.ts:chatbotFn` wraps `agentTurn()` with the API shape the
  `CustomClientChatbotService` expects. Identical behaviour.
