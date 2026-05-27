# v1 vs v2 — Side-by-side comparison

Same bug scenario: Andrea's DOOR-sticky conversation.

## The conversation

| Turn | User says                                                 |
|------|-----------------------------------------------------------|
| T1   | "ciao non mi funziona la lavatrice"                       |
| T2   | "Pineda"                                                  |
| T3   | "lavatrice"                                               |
| T4   | "5"                                                       |
| T5   | "DOOR"                                                    |
| T6   | "bene grazie funziona ma dimmi che orari avete?"          |
| T7   | "e che prezzo avete?"                                     |

## v1 behaviour (current, in production)

| Turn | Reply                                                       | Bug? |
|------|-------------------------------------------------------------|------|
| T1   | "In quale lavanderia ti trovi adesso?"                      | ✅   |
| T2   | "Qual è il numero della tua lavatrice?"                     | ✅   |
| T3   | (skipped — extractor reads "lavatrice" from T1)             | ✅   |
| T4   | "Che cosa vedi esattamente sullo schermo?"                  | ✅   |
| T5   | "Non preoccuparti... apri e richiudi la porta..."           | ✅   |
| T6   | "A Pineda, siamo aperti tutti i giorni dalle 8 alle 22"     | ✅   |
| T7   | **"Dai, lo risolviamo... apri e richiudi la porta..."**    | ❌❌ |

T7 is the bug: the bot re-emits the DOOR troubleshooting instead of replying
about prices. Root cause traced in `architecture.md → DOOR-sticky bug`.

## v2 behaviour (this POC)

```
T1 » ciao non mi funziona la lavatrice
    state    : gathering.askLocation
    reply key: machine.askLocation

T2 » Pineda
    state    : gathering.askType
    reply key: machine.askType

T3 » lavatrice
    state    : gathering.askNumber
    reply key: machine.askNumber

T4 » 5
    state    : gathering.askDisplay
    reply key: machine.askDisplay

T5 » DOOR
    state    : flow.guiding
    reply key: machine.fix.washer.DOOR

T6 » bene grazie funziona ma dimmi che orari avete?
    state    : closed
    reply key: machine.resolutionAck

T7 » e che prezzo avete?
    state    : closed
    reply key: machine.topicHandoff

✅ BUG FIXED: v2 closes the dialogue cleanly. DOOR is gone.
```

## Where the difference comes from — code-wise

### v1 cleanup on resolution

```typescript
// utils/state-transitions.ts
export function releaseActiveFlow(ar: AgentRuntime): void {
  ar.state.activeFlowId = null;
  ar.state.activeStepId = null;
  ar.state.lastPresentedStepId = null;
  ar.state.retryCount = 0;
  // displayState NOT cleared
  // machineType NOT cleared
  // machineNumber NOT cleared
  // activeBranch NOT cleared
}
```

### v2 cleanup on resolution

```typescript
// machines/trouble-machine.machine.ts
resolved: {
  entry: ['resetOperationalFacts', 'emitResolutionAck'],
  always: { target: 'closed' },
},

// resetOperationalFacts action
resetOperationalFacts: assign({
  location: null,
  machineType: null,
  machineNumber: null,
  displayState: null,
  displayHistory: [],
  locationAskAttempts: 0,
  typeAskAttempts: 0,
  numberAskAttempts: 0,
  displayAskAttempts: 0,
  pendingReply: null,
}),
```

Plus: `closed` state has no `PROVIDE_DISPLAY` transition, so even if the
detector mistakenly emitted one, nothing would happen.

## Numbers

| Metric                          | v1                | v2 POC           | Δ           |
|---------------------------------|-------------------|------------------|-------------|
| LoC for trouble-machine logic   | ~1500             | 320              | **−79%**    |
| State fields touched by branch  | ~25               | 13               | **−48%**    |
| Guard functions in pipeline     | 11                | 0 (replaced by SC)| **−100%**  |
| Cleanup helpers (partial wipe)  | 3                 | 1                | **−66%**   |
| Boundary-reset code lines       | ~200              | 0                | **−100%**  |
| Can DOOR-sticky bug occur?      | yes               | no (structural)  | ✅          |

LoC counts exclude i18n JSON, tests, and prompts (which stay shared).

## What v2 keeps from v1 (untouched)

- All `json/i18n/*.json` translation keys
- All `prompts/*.txt` (used by L5 response synthesis when integrated)
- The `json/washer_hs60xx.json` and `json/dryer_ed340.json` flow definitions
  (they will be modelled as nested statecharts in the production migration)
- F-log structure and `cases.json` (porting is mechanical)
- Settings tenant config

## What v2 throws away

- The 11+ guards in `utils/guards/` for trouble-machine
- The sticky `activeBranch` mechanism
- `releaseActiveFlow`, `resetMachineFacts`, `resetIncidentDetails` (collapsed
  into a single on-entry hook)
- `applyBranchEntryResets`, `clearFaqContextOnTroubleEntry` (terminal state
  makes them unnecessary)
- The "pipeline of guards in sequence" mental model (replaced by explicit
  state graph)
