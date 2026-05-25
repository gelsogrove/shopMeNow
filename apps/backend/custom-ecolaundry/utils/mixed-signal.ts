// Mixed-signal detection for mark_resolved validation.
//
// A "mixed signal" is a message where the customer acknowledges progress
// AND reports a NEW concern in the same turn:
//   "yes it works BUT there's a strange noise"
//   "ahora arranca pero huele mal"
//   "ora va però fa un rumore strano"
//
// In these cases the LLM must NOT call mark_resolved — the issue isn't
// closed. The customer expects the bot to address the new concern.
//
// Detection is sentence-level, language-agnostic at the connector level
// (the same connectors are matched across all 6 supported languages),
// and complaint-keyword matching covers the most frequent symptoms.

import { CONNECTOR_RE, COMPLAINT_RE } from './patterns.js'

export interface MixedSignalReport {
  detected: boolean
  /** The connector + complaint span captured, useful for the error message. */
  evidence?: string
}

/**
 * Detect a "yes-but-X" message. Returns `{detected: true, evidence}` when a
 * contrast connector is followed (within the same message) by a complaint
 * keyword. The order matters: complaint must come AFTER the connector,
 * otherwise the message is just stating the new issue without acknowledging
 * progress (which is a different scenario).
 */
export function detectMixedSignal(message: string): MixedSignalReport {
  if (typeof message !== 'string' || !message.trim()) {
    return { detected: false }
  }
  const connectorMatch = CONNECTOR_RE.exec(message)
  if (!connectorMatch) return { detected: false }
  const connectorEnd = connectorMatch.index + connectorMatch[0].length
  const after = message.slice(connectorEnd)
  const complaintMatch = COMPLAINT_RE.exec(after)
  if (!complaintMatch) return { detected: false }
  const evidence = `${connectorMatch[0]}${after.slice(0, complaintMatch.index + complaintMatch[0].length)}`.trim()
  return { detected: true, evidence }
}
