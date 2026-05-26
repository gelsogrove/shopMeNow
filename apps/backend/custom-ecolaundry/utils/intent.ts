// Barrel re-export for utils/intent/*. Keeps every consumer importing
// `from '../intent.js'` working while the implementation is split across
// single-concern cassettes (display extraction, payment classifiers, FAQ
// topic guards, machine vocab, language heuristic, conversation boundary
// signals). New detectors go in a new sibling file under utils/intent/,
// then re-exported here.
//
// Mirror of the utils/message-parsing.ts barrel pattern.

export { extractDisplayState, extractDisplayLabel, isDisplayCodeLikeInput } from './intent/display.js'
export { detectDisplayUnreadableIntent } from './intent/display-unreadable.js'

export { detectDoubleChargeIntent } from './intent/payment-charge.js'
export {
  detectPaidNotActivatedIntent,
  detectPaymentMention,
  detectPaymentMethodQuestion,
} from './intent/payment-paid.js'
export { isPaidButNotActivatedCase, parsePaymentAnswer } from './intent/payment-parse.js'

export { detectNumericCodeIntent, detectDiscountCodeIntent } from './intent/discount-code.js'

export {
  detectFaqPause,
  detectInvoiceIntent,
  detectHoursIntent,
  detectPriceIntent,
  detectProgramsIntent,
} from './intent/faq.js'
export { detectDetergentFaqIntent } from './intent/faq-detergent.js'
export { detectHowToUseIntent } from './intent/faq-how-to-use.js'

export { detectMachineTypeMention, normalizeMachineType } from './intent/machine.js'

export { detectLanguageHeuristic } from './intent/language.js'

export { detectIDontKnowReply } from './intent/dont-know.js'
export { hasGreetingIntent } from './intent/greeting.js'
export { isShortContextReply } from './intent/short-reply.js'
export { detectTopicSwitchDuringEscalation } from './intent/topic-switch-escalation.js'
export { detectTroubleResolution } from './intent/trouble-resolution.js'
export { detectTroubleSwitchDuringFlow } from './intent/trouble-switch-flow.js'
export {
  isAwaitingLocation,
  isLikelyStandaloneLocationInput,
  extractExplicitLocation,
} from './intent/location.js'

// Re-exports passthrough — kept here for the legacy import surface.
export { hasExtraButtonIssue, hasStopIntent } from './message-parsing.js'
export { findLandmarksInMessage as detectLandmarkMention } from './locations-landmarks.js'
