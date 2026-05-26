// Barrel re-export for utils/agent-extract/*. Keeps every consumer importing
// `from '../agent-extract.js'` working while the original 700-line file is
// split into single-concern step modules per iron rule #3. New extraction
// steps go in a new sibling file under utils/agent-extract/, then wired
// into the autoExtractFacts pipeline below.
//
// Mirror of the utils/message-parsing.ts barrel pattern.

import type { AgentRuntime } from '../models/index.js'
import { extractFaqPauseAndPaymentQuestion } from './agent-extract/faq-pause-and-payment-question.js'
import { extractPostResolutionReset } from './agent-extract/post-resolution.js'
import { extractTroubleResolution } from './agent-extract/trouble-resolution.js'
import { extractTopicSwitch } from './agent-extract/topic-switch.js'
import { extractNonTroubleIncident } from './agent-extract/non-trouble-incident.js'
import { extractLocation } from './agent-extract/location.js'
import { extractMachineAndDisplay } from './agent-extract/machine-and-display.js'
import { extractPaymentFlags } from './agent-extract/payment-flags.js'
import { applyCaseMarkers } from './agent-extract/case-markers.js'

/**
 * Deterministic fact extraction from the customer message. Runs before the
 * LLM call so sticky facts always reflect what the customer said, even when
 * the agent fails to call set_* tools.
 *
 * Pipeline order is contractual — each step assumes the state left by the
 * previous one (e.g. machine + display block snapshots
 * `machineNumberWasAlreadySet` BEFORE the number extractor mutates it).
 * Reorder only if you trace every consumer.
 */
export function autoExtractFacts(ar: AgentRuntime, userMessage: string): void {
  const trimmed = userMessage.trim()
  if (!trimmed) return

  extractFaqPauseAndPaymentQuestion(ar, trimmed)
  extractPostResolutionReset(ar, trimmed)
  // F109 Opt C — must run BEFORE topic-switch/non-trouble-incident/etc. so
  // that an explicit "ora funziona" resolution wipes machine facts before
  // any other extractor reads them. Runs AFTER post-resolution (which clears
  // a stale pendingClosure='resolved' from a previous turn) and BEFORE the
  // FAQ branch handler sees the message.
  extractTroubleResolution(ar, trimmed)
  extractTopicSwitch(ar, trimmed, userMessage)
  extractNonTroubleIncident(ar, userMessage)
  extractLocation(ar, trimmed)
  extractMachineAndDisplay(ar, trimmed)
  extractPaymentFlags(ar, trimmed)
  applyCaseMarkers(ar, userMessage, trimmed)
}
