# v1 — Root cause analysis of structural defects

Document of record for why we built v2.

## Defect #1 — State sparso in 10+ campi

**Evidence**: `apps/backend/custom-ecolaundry/models/state.ts` defines
~40 fields on `AgentState`. For trouble-machine alone, these fields are
mutated by independent agents:

- `activeBranch` ← router LLM, `escalate()`, `pivotToTroubleMachine()`
- `activeFlowId` ← `startFlow`, `guardDisplayFlowStart`
- `activeStepId` ← flow engine
- `displayState` ← `autoExtractFacts`, `set_display_state` tool, router
- `machineType` ← extractor, `set_machine_facts` tool
- `machineNumber` ← extractor
- `location` ← `resolveKnownLocation`, location guard
- `pendingFlow` ← multiple guards
- `pendingClosure` ← `markResolved`, `closeAsEscalated`
- `lastResolvedIntent` ← post-LLM

No central authority. Each guard reads what it needs and writes what it
wants. Implicit invariants are not enforceable.

## Defect #2 — Guard pipeline ad accumulo, stateless dentro stato

**Evidence**: `utils/guards/index.ts:110-252` defines a fixed pipeline:

```
guardResolutionAck
guardAnonymousEscalateClosure
guardForceMachineType
guardForceMachineNumber
guardForceDisplay
guardForceLocation
guardMataroStreet
guardInsistLocation
guardUnknownLocation
guardDisplayFlowStart
guardDisplayFlowFollowUp
guardAskPhoto
guardPostInstructionFailure
guardEscalateUnknownDisplay
guardNumericCode*
guardAutoStartMachineFlow
guardAdvanceMachineFlow
guardAlmDisambiguation
```

Each guard runs in sequence, checks its own preconditions, may fire. The
guard at position N has no first-class knowledge of what guard N-5 did.
Coordination happens through shared state mutation, which is by nature
incremental and lossy.

## Defect #3 — Router LLM single point of failure

**Evidence**: `utils/router.ts` calls an LLM to classify `branch`,
`turnMode`, `displayHint`, `locationHint`, `subCase`. When the LLM
mis-classifies a composite message (e.g. "bene grazie funziona MA orari"
returns `branch='faq'` and `turnMode='faq-pivot'` instead of `'resolution'`),
no deterministic fallback exists. The system has no second source of truth.

## Defect #4 — Cleanup parziale

**Evidence**: `utils/state-transitions.ts:207-212`

```typescript
export function releaseActiveFlow(ar: AgentRuntime): void {
  ar.state.activeFlowId = null;
  ar.state.activeStepId = null;
  ar.state.lastPresentedStepId = null;
  ar.state.retryCount = 0;
}
```

Releases the flow ID but does not wipe operational facts
(`displayState`, `machineType`, `machineNumber`). Therefore, next turn,
those facts trigger `guardAutoStartMachineFlow` again. The DOOR-sticky
bug Andrea reported on 2026-05-26 is a direct consequence of this.

There is a `resetMachineFacts` function in `utils/state.ts:114-187`
that DOES wipe operational facts, but it is called inconsistently — only
from some transition functions, not all. The naming + duplication of
"release vs reset" obscures intent.

## Defect #5 — Manca boundary-reset post-troubleshooting

**Evidence**: `utils/branches/boundary-resets.ts:26-55` defines
`applyBranchEntryResets` for entering trouble-machine from FAQ, but
nothing fires on the inverse path (trouble-machine → FAQ → closed).
The branch `trouble-machine` remains sticky in `activeBranch` until
something explicitly clears it; nothing does.

## Defect #6 — Iron rules contraddittorie nella pratica

**Evidence**: from `CLAUDE.md`:

- Rule #1: "No patches in the prompt — fix in code (guard, tool validator,
  post-processor invariant)"
- Rule #6: "No hardcoded phrase detection for INTENT — phrase routing
  belongs in the LLM"
- Rule #14: "No hardcoded phrase/keyword detection (`includes`, regex on
  user text)"

Result: when a phrase-based intent (like "bene grazie funziona" =
resolution) needs reliable detection, the only allowed solution is to
fix the LLM router prompt. But Rule #1 forbids fixes in the prompt. The
developer is trapped between two iron rules that contradict each other
in the case that matters most.

## How v2 addresses each

| Defect | v2 mechanism                                                                    |
|--------|---------------------------------------------------------------------------------|
| #1     | Single `TroubleContext` mutated only by `assign(...)` actions in the statechart |
| #2     | Statechart transitions replace pipeline; events explicit, not inferred          |
| #3     | Detector is deterministic-first; LLM is fallback, not arbiter                   |
| #4     | `resetOperationalFacts` on-entry of `resolved` state                            |
| #5     | `closed` is a terminal absorbing state; no sticky branch concept                |
| #6     | Detector lives outside the statechart and is allowed to use regex/heuristics    |

Defect #6 needs explicit rule-set update in v2 CLAUDE.md: phrase detection
is **allowed** in the event detector layer (L2), since it produces typed
events not state mutations. The original prohibition in v1 was conflating
"intent detection" with "state mutation"; v2 separates them.
