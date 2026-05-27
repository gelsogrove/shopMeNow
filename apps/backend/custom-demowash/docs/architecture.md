# v2 Architecture

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  L1 — Transport (WhatsApp / WebSocket / demo CLI)           │
│  Raw user text in, raw bot text out                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  L2 — Event Detector  (src/adapters/event-detector.ts)      │
│  raw text  →  TroubleEvent                                  │
│  - Deterministic regex / token match first                  │
│  - LLM-assist fallback (future)                             │
│  - PURE FUNCTION: no state mutation                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  L3 — Statechart  (src/machines/trouble-machine.machine.ts) │
│  TroubleEvent + current state  →  next state + pendingReply │
│  - Single source of truth for dialogue state                │
│  - Declarative transitions, guards, actions                 │
│  - on-entry / on-exit hooks for cleanup                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  L4 — Orchestrator  (src/adapters/orchestrator.ts)          │
│  Reads pendingReply, returns i18n key + stage to L1         │
│  - Owns actor lifecycle (start/stop/snapshot)               │
│  - Will own LLM call for response generation                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  L5 — Response Synthesis (future)                           │
│  i18n key + stage + context  →  human-readable reply        │
│  - LLM-rendered, tone-aware (per stage)                     │
└─────────────────────────────────────────────────────────────┘
```

## Statechart (trouble-machine)

```
idle
 │
 │ OPEN_INCIDENT
 ▼
gathering
 ├── evaluating  (always-guard cascade picks first missing slot)
 ├── askLocation  → on PROVIDE_LOCATION → evaluating
 ├── askType      → on PROVIDE_TYPE     → evaluating
 ├── askNumber    → on PROVIDE_NUMBER   → evaluating
 └── askDisplay   → on PROVIDE_DISPLAY  → evaluating
                                          │
                                          │ allFactsCollected
                                          ▼
                                         flow
                                          ├── evaluating
                                          │    ├ displayRecoverable → guiding
                                          │    └ otherwise          → escalating
                                          └── guiding
                                               ├ CONFIRM_RESOLVED  → resolved
                                               ├ REPORT_PERSISTENCE → escalating
                                               └ PROVIDE_DISPLAY (new) → evaluating

resolved
 entry: [resetOperationalFacts, emitResolutionAck]
 always → closed

escalating
 ├── askName       → on PROVIDE_NAME → done
 └── done          → always → closed

closed                                  ← ABSORBING STATE
 │   ignores: PROVIDE_*, CONFIRM_RESOLVED, REPORT_PERSISTENCE
 │   accepts: REQUEST_TOPIC_SWITCH (handled at top level)
 │
 │ OPEN_INCIDENT (only escape)
 ▼
gathering   (with resetOperationalFacts as entry action)
```

## Cleanup contract (Rule 3 elaborated)

| Transition           | Action(s) on entry                            |
|----------------------|-----------------------------------------------|
| `* → resolved`       | `resetOperationalFacts`, `emitResolutionAck`  |
| `* → escalating.done`| `emitEscalationDone`                          |
| `closed → gathering` | `resetOperationalFacts` (new incident clean)  |

**Invariant**: after entering `closed`, the context is in a known-clean state.
`displayState=null`, `machineType=null`, `machineNumber=null`. No detector can
re-inject these without the user explicitly opening a new incident
(`OPEN_INCIDENT` event), and even then, `resetOperationalFacts` runs again.

## How v2 prevents the DOOR-sticky bug

Bug trace in v1:

```
T5: state.activeBranch = 'trouble-machine'
    state.displayState = 'DOOR'   ← still set
    state.machineType  = 'washer' ← still set
    state.machineNumber = '5'     ← still set
T6: detectTroubleResolution() runs → markResolved + releaseActiveFlow
    BUT releaseActiveFlow does NOT wipe displayState/type/number
    BUT activeBranch is still 'trouble-machine' (sticky)
T7: dispatchSubsequentTurn re-enters trouble-machine handler
    guardAutoStartMachineFlow sees 4 facts present → RESTARTS DOOR guide
```

Same conversation in v2:

```
T5: state = flow.guiding
    context = { location='Pineda', type='washer', number='5', display='DOOR', ... }
T6: detector → CONFIRM_RESOLVED
    machine: flow.guiding → resolved
      entry: resetOperationalFacts  ← wipes display/type/number
             emitResolutionAck       ← reply key set
    machine: resolved --always--> closed
    state = closed
    context = { location=null, type=null, number=null, display=null, ... }
T7: detector → REQUEST_TOPIC_SWITCH (pricing)
    machine: closed handles via top-level `on` block
    NO transition to gathering (would require OPEN_INCIDENT explicitly)
    DOOR cannot be re-emitted (context.displayState is null, and even if
    it weren't, `closed` has no PROVIDE_DISPLAY transition).
```

## Comparison metrics (preliminary)

|                         | v1 (current)                  | v2 (POC)                          |
|-------------------------|-------------------------------|-----------------------------------|
| State fields            | ~40 in `AgentState`           | 13 in `TroubleContext`            |
| Guards for trouble-machine | 11+ functions, ~1500 LoC | 8 named guards, ~70 LoC inline    |
| Cleanup functions       | 3 (partially overlapping)     | 1 (`resetOperationalFacts`)       |
| Boundary reset code     | ~200 LoC                      | 0 (terminal absorbing state)      |
| Stickiness bug surface  | high                          | structurally zero                 |

LoC counts above for trouble-machine logic only, excluding tests, i18n, prompts.
