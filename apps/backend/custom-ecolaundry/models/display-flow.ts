// Declarative display-state intermediate flows.
//
// Each entry maps a customer-reported display token (e.g. "AL001", "ALM/DOOR",
// "C001") to a deterministic two-phase mini-flow:
//
//   Phase A — START: when the display matches and prerequisite session fields
//   are populated, the bot emits a single guidance reply (replyKey from
//   localization.ts) and marks `state.activeFlowId = flow.id`.
//
//   Phase B — FOLLOW-UP: on the next customer turn, the bot checks the reply
//   against `resolvedRegex` (→ closes the case) and `persistFailureRegex`
//   (→ escalates with `escalationReason`). `alwaysEscalateOnNextTurn` short-
//   circuits Phase B straight to escalation regardless of the customer reply
//   (used by Caso 15 where the explanation is always followed by handover).
//
// This data structure is the SINGLE source of truth for the previously
// hardcoded TS guards (guardCaso5Al001AskBefore, guardCaso14AlmDoor,
// guardCaso14AlmDoorEscalate, guardCaso15Explain001, guardCaso15Escalate001).
// New "display X → guide → escalate" cases must be added here, not as new
// TS guards.

import type { TranslationKey } from '../utils/localization.js'

/** Fields of SessionState that a flow can declare as a prerequisite. */
export type DisplayFlowRequirement =
  | 'location'
  | 'machineType'
  | 'machineNumber'
  | 'locationStreet'

export interface DisplayFlowDefinition {
  /** Stable id, used as `state.activeFlowId`. Must match `^[a-z0-9-]+$`. */
  id: string
  /** Display tokens (case-insensitive, whitespace-stripped) that activate this flow. */
  displayMatches: string[]
  /** SessionState fields that must be truthy before Phase A fires. */
  requires: DisplayFlowRequirement[]
  /** Phase A configuration: the deterministic guidance reply. */
  step: {
    /** Localization key for the guidance reply. */
    replyKey: TranslationKey
    /** Optional localization key for the resolved-case acknowledgment. */
    resolvedReplyKey?: TranslationKey
    /** When true, Phase B always escalates regardless of customer reply. */
    alwaysEscalateOnNextTurn?: boolean
  }
  /** Optional regex (case-insensitive) that marks the issue as resolved. */
  resolvedRegex?: string
  /** Optional regex (case-insensitive) that marks the issue as persistent → escalate. */
  persistFailureRegex?: string
  /** Optional override for the escalation reply prefix (defaults to `reaffirmEscalate`). */
  escalationReplyKey?: TranslationKey
  /** Stored in `state.escalationReason` and surfaced in the operator handover. */
  escalationReason: string
  /**
   * When true, Phase B asks the customer to confirm the current display code
   * before escalating. Only triggers re-ask when `persistFailureRegex` matches
   * AND the customer's message does NOT already contain a known display token
   * from `displayMatches` (so "sigue saliendo AL001" still escalates directly).
   */
  reaskBeforeEscalate?: boolean
}

export interface DisplayFlowsFile {
  _principle?: string
  _schemaVersion: 1
  flows: DisplayFlowDefinition[]
}

const ID_RE = /^[a-z0-9-]+$/
const VALID_REQUIREMENTS: ReadonlySet<DisplayFlowRequirement> = new Set([
  'location',
  'machineType',
  'machineNumber',
  'locationStreet',
])

/**
 * Validate a parsed display-flows file. Throws on the first violation so the
 * process fails fast at boot rather than misbehaving at runtime.
 */
export function validateDisplayFlowsFile(raw: unknown): DisplayFlowsFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('display-flows.json: root must be an object')
  }
  const root = raw as Record<string, unknown>
  if (root._schemaVersion !== 1) {
    throw new Error(`display-flows.json: _schemaVersion must be 1, got ${String(root._schemaVersion)}`)
  }
  if (!Array.isArray(root.flows)) {
    throw new Error('display-flows.json: "flows" must be an array')
  }

  const seenIds = new Set<string>()
  const flows: DisplayFlowDefinition[] = root.flows.map((entry, index) => {
    const ctx = `display-flows.json[${index}]`
    if (!entry || typeof entry !== 'object') throw new Error(`${ctx}: must be an object`)
    const f = entry as Record<string, unknown>

    if (typeof f.id !== 'string' || !ID_RE.test(f.id)) {
      throw new Error(`${ctx}: id must match ${ID_RE.source}`)
    }
    if (seenIds.has(f.id)) throw new Error(`${ctx}: duplicate id "${f.id}"`)
    seenIds.add(f.id)

    if (!Array.isArray(f.displayMatches) || f.displayMatches.length === 0) {
      throw new Error(`${ctx}: displayMatches must be a non-empty array`)
    }
    const displayMatches = f.displayMatches.map((m, j) => {
      if (typeof m !== 'string' || !m.trim()) {
        throw new Error(`${ctx}.displayMatches[${j}]: must be a non-empty string`)
      }
      return m
    })

    if (!Array.isArray(f.requires)) throw new Error(`${ctx}: requires must be an array`)
    const requires = f.requires.map((r, j) => {
      if (typeof r !== 'string' || !VALID_REQUIREMENTS.has(r as DisplayFlowRequirement)) {
        throw new Error(`${ctx}.requires[${j}]: invalid field "${String(r)}"`)
      }
      return r as DisplayFlowRequirement
    })

    if (!f.step || typeof f.step !== 'object') throw new Error(`${ctx}: step must be an object`)
    const step = f.step as Record<string, unknown>
    if (typeof step.replyKey !== 'string' || !step.replyKey) {
      throw new Error(`${ctx}.step.replyKey: must be a non-empty string`)
    }
    if (step.resolvedReplyKey !== undefined && typeof step.resolvedReplyKey !== 'string') {
      throw new Error(`${ctx}.step.resolvedReplyKey: must be a string when present`)
    }
    if (step.alwaysEscalateOnNextTurn !== undefined && typeof step.alwaysEscalateOnNextTurn !== 'boolean') {
      throw new Error(`${ctx}.step.alwaysEscalateOnNextTurn: must be a boolean when present`)
    }

    // Compile regex lazily here so a malformed pattern fails at boot.
    if (f.resolvedRegex !== undefined) {
      if (typeof f.resolvedRegex !== 'string') throw new Error(`${ctx}.resolvedRegex: must be a string`)
      // eslint-disable-next-line no-new
      new RegExp(f.resolvedRegex as string, 'i')
    }
    if (f.persistFailureRegex !== undefined) {
      if (typeof f.persistFailureRegex !== 'string') throw new Error(`${ctx}.persistFailureRegex: must be a string`)
      // eslint-disable-next-line no-new
      new RegExp(f.persistFailureRegex as string, 'i')
    }
    if (f.escalationReplyKey !== undefined && typeof f.escalationReplyKey !== 'string') {
      throw new Error(`${ctx}.escalationReplyKey: must be a string when present`)
    }
    if (f.reaskBeforeEscalate !== undefined && typeof f.reaskBeforeEscalate !== 'boolean') {
      throw new Error(`${ctx}.reaskBeforeEscalate: must be a boolean when present`)
    }
    if (typeof f.escalationReason !== 'string' || !f.escalationReason) {
      throw new Error(`${ctx}.escalationReason: must be a non-empty string`)
    }

    // Phase B reachability: a flow needs at least one exit (resolved, persist,
    // or alwaysEscalateOnNextTurn) — otherwise it would trap the customer in
    // activeFlowId forever.
    const hasExit =
      Boolean(f.resolvedRegex) ||
      Boolean(f.persistFailureRegex) ||
      step.alwaysEscalateOnNextTurn === true
    if (!hasExit) {
      throw new Error(`${ctx}: flow has no exit (need resolvedRegex, persistFailureRegex, or step.alwaysEscalateOnNextTurn)`)
    }

    return {
      id: f.id,
      displayMatches,
      requires,
      step: {
        replyKey: step.replyKey as TranslationKey,
        resolvedReplyKey: step.resolvedReplyKey as TranslationKey | undefined,
        alwaysEscalateOnNextTurn: step.alwaysEscalateOnNextTurn === true,
      },
      resolvedRegex: f.resolvedRegex as string | undefined,
      persistFailureRegex: f.persistFailureRegex as string | undefined,
      escalationReplyKey: f.escalationReplyKey as TranslationKey | undefined,
      escalationReason: f.escalationReason,
      reaskBeforeEscalate: f.reaskBeforeEscalate === true,
    }
  })

  return {
    _principle: typeof root._principle === 'string' ? root._principle : undefined,
    _schemaVersion: 1,
    flows,
  }
}
