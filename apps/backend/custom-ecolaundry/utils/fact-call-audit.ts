// Fact-call audit logger.
//
// Implements the deterministic backstop for the rule "the LLM should call
// set_* whenever the customer's words contain a fact". The architectural
// front-line is `utils/agent-extract.ts:autoExtractFacts`, which runs
// BEFORE the LLM (agent.ts:72) and pre-populates state from regex patterns.
//
// This audit runs AFTER the LLM has produced its final reply and compares:
//   - Facts present in state (already extracted by autoExtract OR by LLM)
//   - Tool calls the LLM made this turn (which set_* did it actually call)
//
// If a fact was extracted from the user message but the LLM did NOT
// acknowledge it via the corresponding set_*, we log a warning. This is
// observability: the system is still correct (autoExtract populated state)
// but we want to detect LLM drift in tool-call discipline.
//
// Per rule #1 (no patches in prompts/agent.txt): this replaces the prompt
// rule "NEVER skip a set_* tool when the fact is in the customer's words".
// The deterministic backstop is the autoExtract pre-population; this audit
// is the observability layer.

import { logger } from './logger.js'
import type { AgentMessage, SessionState } from '../models/index.js'

/** Snapshot of state fields before/after the turn used to detect what was set. */
export interface FactSnapshot {
  location: string | null
  machineType: string | null
  machineNumber: string | null
  displayState: string | null
  paymentCompleted: boolean | null
}

const TRACKED_TOOLS = new Set([
  'set_location',
  'set_machine_facts',
  'set_payment_facts',
  'set_display_state',
])

/** Take a structural snapshot of the fact fields from state. */
export function snapshotFacts(state: SessionState): FactSnapshot {
  return {
    location: state.location ? String(state.location) : null,
    machineType: state.machineType ? String(state.machineType) : null,
    machineNumber: state.machineNumber ? String(state.machineNumber) : null,
    displayState: state.displayState ? String(state.displayState) : null,
    paymentCompleted:
      state.paymentCompleted === null || state.paymentCompleted === undefined
        ? null
        : Boolean(state.paymentCompleted),
  }
}

/**
 * Inspect the LLM messages produced during this turn and return the names
 * of the set_* tools that were invoked.
 */
export function collectInvokedSetTools(messages: AgentMessage[]): Set<string> {
  const invoked = new Set<string>()
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.tool_calls) continue
    for (const tc of m.tool_calls) {
      const name = tc.function?.name
      if (name && TRACKED_TOOLS.has(name)) invoked.add(name)
    }
  }
  return invoked
}

/**
 * Audit fact discipline: if state gained facts during this turn but the LLM
 * did not call the matching set_*, log a warning. State that was already
 * populated before the turn is ignored (sticky state).
 *
 * The function never throws and never alters control flow — it is purely
 * observational. The deterministic safety net is `autoExtractFacts`.
 */
export function auditFactDiscipline(
  before: FactSnapshot,
  after: FactSnapshot,
  invokedTools: Set<string>,
  context: { sessionId?: string; turnCount?: number },
): void {
  const drift: Array<{ field: keyof FactSnapshot; expectedTool: string }> = []

  if (!before.location && after.location && !invokedTools.has('set_location')) {
    drift.push({ field: 'location', expectedTool: 'set_location' })
  }
  if (
    !before.machineType &&
    after.machineType &&
    !invokedTools.has('set_machine_facts')
  ) {
    drift.push({ field: 'machineType', expectedTool: 'set_machine_facts' })
  }
  if (
    !before.machineNumber &&
    after.machineNumber &&
    !invokedTools.has('set_machine_facts')
  ) {
    drift.push({ field: 'machineNumber', expectedTool: 'set_machine_facts' })
  }
  if (
    !before.displayState &&
    after.displayState &&
    !invokedTools.has('set_display_state')
  ) {
    drift.push({ field: 'displayState', expectedTool: 'set_display_state' })
  }
  if (
    before.paymentCompleted === null &&
    after.paymentCompleted !== null &&
    !invokedTools.has('set_payment_facts')
  ) {
    drift.push({ field: 'paymentCompleted', expectedTool: 'set_payment_facts' })
  }

  if (drift.length === 0) return

  logger.warn('LLM tool-call discipline drift detected', {
    drift: drift.map((d) => ({
      field: d.field,
      expectedTool: d.expectedTool,
      newValue:
        d.field === 'paymentCompleted'
          ? after.paymentCompleted
          : after[d.field],
    })),
    sessionId: context.sessionId,
    turnCount: context.turnCount,
  })
}
