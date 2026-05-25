// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts as
// part of the iron rule #3 split. Zero behavioural change. Iron rule #5 is
// NOT applicable (depth-2 file, out of `find utils -maxdepth 1` scope).
//
// Private predicates + constants used by the extract-step modules:
//  - shouldAcceptAsDisplay      → display-state extraction gate
//  - isDisplayContextCode       → contextual display capture (3-prereq case)
//  - isInNonMachineFlow         → non-machine flow detection (F83)
//  - detectTopicSwitch          → topic-switch detector (runtime patterns)
//  - NON_MACHINE_PENDING_PREFIXES

import type { Runtime } from '../../models/index.js'
import { getPattern, matchPattern } from '../nlu.js'

export function shouldAcceptAsDisplay(runtime: Runtime, rawInput: string): boolean {
  const sanitize = getPattern(runtime, 'displaySanitize')
  const compact = rawInput.replace(sanitize, '').trim()
  if (!compact) return false
  if (matchPattern(runtime, 'yesNoUppercase', compact)) return false
  if (matchPattern(runtime, 'displayKnownToken', compact)) return true
  if (matchPattern(runtime, 'displayErrCode', compact)) return true
  if (matchPattern(runtime, 'displayLongCode', compact)) return true
  return false
}

/**
 * Contextual display capture — used only when ALL THREE prerequisite facts
 * (location, machineType, machineNumber) are already known and displayState
 * is still empty. Covers bare digits, letter+digit combos and short
 * uppercase codes not in the main whitelist.
 */
export function isDisplayContextCode(runtime: Runtime, rawInput: string): boolean {
  const sanitize = getPattern(runtime, 'displaySanitize')
  const compact = rawInput.replace(sanitize, '').trim()
  if (!compact) return false
  if (matchPattern(runtime, 'yesNoUppercase', compact)) return false
  return matchPattern(runtime, 'displayContextCode', compact)
}

// F83 — non-machine flow prefixes. When pendingFlow starts with one of these
// the customer is in a legitimate non-troubleshooting flow whose per-turn
// replies MUST NOT be classified as a topic-switch.
const NON_MACHINE_PENDING_PREFIXES = [
  'invoice-',
  'discount-code-',
  'loyalty-',
  'faq-',
] as const

export function isInNonMachineFlow(pendingFlow: string): boolean {
  return NON_MACHINE_PENDING_PREFIXES.some((p) => pendingFlow.startsWith(p))
}

export function detectTopicSwitch(
  runtime: Runtime,
  state: { displayState: string; machineNumber: string; pendingFlow: string },
  userMessage: string,
): boolean {
  if (isInNonMachineFlow(state.pendingFlow)) return false
  const hasMachineFacts = !!(state.displayState || state.machineNumber || state.pendingFlow)
  if (!hasMachineFacts) return false
  const text = userMessage.toLowerCase()
  if (matchPattern(runtime, 'topicPayment', text)) return true
  if (matchPattern(runtime, 'topicOps', text)) return true
  if (matchPattern(runtime, 'topicDryerMinutes', text)) return true
  if (matchPattern(runtime, 'topicCardFail', text)) return true
  if (matchPattern(runtime, 'topicRefundDemand', text)) return true
  if (matchPattern(runtime, 'topicCompensation', text)) return true
  if (
    matchPattern(runtime, 'switchHint', text) &&
    matchPattern(runtime, 'topicCorrectionContext', text)
  ) {
    return true
  }
  return false
}
