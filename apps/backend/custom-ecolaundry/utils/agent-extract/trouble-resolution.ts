// F109 Opt C — Detect explicit trouble resolution from the customer message.
//
// When the customer says "ora funziona" / "ahora funciona" / "now it works"
// during an active trouble flow (activeFlowId set, or sticky machine facts
// like displayState/machineNumber present), this step:
//
//   1. fires `markResolved(ar)` so the closure is recorded atomically
//   2. wipes machine facts via `resetMachineFacts(state)` so the NEXT turn
//      does not trigger `guardAutoStartMachineFlow` from sticky displayState
//      + machineNumber and re-arm the resolved flow.
//
// Sticky customer facts (customerName, customerPhone, location) are preserved
// — they describe the customer, not the incident.
//
// This is the deterministic, explicit-signal complement to F109 part 1
// (`releaseActiveFlow` in `applyGuardOutcome`), which only releases the flow
// pointers when a FAQ guard already produced a reply. F109 Opt C catches the
// case where the customer EXPLICITLY says "the problem is fixed" before any
// guard had a chance to mark it resolved — without this step, the FAQ branch
// would answer the second-half-of-the-message FAQ and leave the trouble
// facts sticky, causing the next turn to be dragged back into a re-armed
// trouble flow (Andrea CLI demo 2026-05-26 — T9 repeating DOOR guidance).

import type { AgentRuntime } from '../../models/index.js'
import { detectTroubleResolution } from '../intent.js'
import { markResolved } from '../state-transitions.js'
import { resetMachineFacts } from '../state.js'

export function extractTroubleResolution(ar: AgentRuntime, trimmed: string): void {
  const state = ar.state

  // Gate: only fire if there is actual trouble context to close. Without
  // this, a standalone "now it works" greeting / off-topic message would
  // mutate state for no reason.
  const hasTroubleContext = Boolean(
    state.activeFlowId ||
    state.displayState ||
    state.machineNumber ||
    state.activeBranch === 'trouble-machine',
  )
  if (!hasTroubleContext) return

  // Skip if already resolved this turn (idempotency — don't re-fire when
  // post-resolution reset has already cleared pendingClosure earlier in the
  // pipeline).
  if (state.pendingClosure === 'resolved' || state.pendingClosure === 'escalated') return

  if (!detectTroubleResolution(trimmed)) return

  // Atomic closure: markResolved sets pendingClosure='resolved' and clears
  // escalation flags; resetMachineFacts wipes machine-side sticky state so
  // the next turn does not re-arm guardAutoStartMachineFlow from leftover
  // displayState + machineNumber.
  markResolved(ar)
  resetMachineFacts(state)
}
