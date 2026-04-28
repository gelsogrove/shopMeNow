// PRE-ROUTER FACT EXTRACTOR — PRODUCTION LAYER (Step 1)
// Runs before the Router LLM. Extracts known facts from the raw customer message
// deterministically. Updates SessionState directly and returns an enriched input
// string for the Router.
// Rule: hardware display codes (SEL, PUSH, AL001, etc.) are finite and safe to match.
//       Everything else (intent, tone, FAQ topics) must go to the LLM layers.

import {
  extractDisplayState,
  isLikelyStandaloneLocationInput,
  normalizeMachineType,
  isAwaitingLocation,
  hasDoubleChargeConcern,
  hasDryerPostCycleIssue,
  hasWasherPostCycleIssue,
  shouldTreatAsDoubleChargeNarrative,
  isAlreadyAnsweredReply,
  parseServiceCompletedAnswer,
  parseDryerStartedAnswer,
  parseDryerCycleContext,
  extractLast4CardDigits,
  parsePaymentProofProvided,
  extractExplicitLocation,
  hasTechnicalIssueIntent,
  hasOperationalContextIntent,
  parsePaymentAnswer,
  extractUnknownDisplayCode,
} from './intent.js'
import {
  inferPaymentCompletedFromDisplayState,
} from './display-state.js'
import {
  parseExplicitPaymentSignal,
  resolveKnownLocation,
} from './message-parsing.js'
import type { SessionState } from './state.js'

export function preprocessUserInput(state: SessionState, userMessage: string): string {
  const trimmed = userMessage.trim()
  const extractedFacts: string[] = []
  const shouldPreserveIssueSummary =
    hasTechnicalIssueIntent(trimmed) ||
    hasOperationalContextIntent(trimmed) ||
    hasDryerPostCycleIssue(trimmed) ||
    hasWasherPostCycleIssue(trimmed)

  const explicitPaymentSignal = parseExplicitPaymentSignal(trimmed)
  if (explicitPaymentSignal !== null && state.paymentCompleted === null) {
    state.paymentCompleted = explicitPaymentSignal
    extractedFacts.push(`Payment completed is ${explicitPaymentSignal ? 'yes' : 'no'}`)
  }

  // If payment is signalled AND an unknown display code is present, persist the original
  // message as issueSummary so the case-4.3 escalation path can find the code later.
  if (explicitPaymentSignal === true && !state.displayState && !state.issueSummary) {
    const earlyUnknownCode = extractUnknownDisplayCode(trimmed)
    if (earlyUnknownCode) {
      state.issueSummary = trimmed
    }
  }

  if (hasDryerPostCycleIssue(trimmed) && !state.machineType) {
    state.machineType = 'dryer'
    state.issueSummary = 'Dryer post-cycle wet clothes issue after multiple drying attempts.'
    extractedFacts.push('Machine type is dryer')
  }

  if (hasWasherPostCycleIssue(trimmed) && state.paymentCompleted === null) {
    state.paymentCompleted = true
    extractedFacts.push('Payment completed is yes')
  }

  if (hasDoubleChargeConcern(trimmed) && !state.issueSummary) {
    state.issueSummary = 'double charge'
    extractedFacts.push('Issue summary is double charge')
  }

  if (state.lastMissingFacts.includes('service completed or not')) {
    const parsedServiceCompleted = parseServiceCompletedAnswer(trimmed)
    if (parsedServiceCompleted !== null) {
      state.serviceCompleted = parsedServiceCompleted
      extractedFacts.push(`Service completed is ${parsedServiceCompleted ? 'yes' : 'no'}`)
    }
  }

  if (state.lastMissingFacts.includes('dryer started or not')) {
    const parsedDryerStarted = parseDryerStartedAnswer(trimmed)
    if (parsedDryerStarted !== null) {
      state.dryerStarted = parsedDryerStarted
      extractedFacts.push(`Dryer started is ${parsedDryerStarted ? 'yes' : 'no'}`)
    }
  }

  if (state.lastMissingFacts.includes('dryer first cycle or added time')) {
    const parsedDryerCycleContext = parseDryerCycleContext(trimmed)
    if (parsedDryerCycleContext) {
      state.dryerCycleContext = parsedDryerCycleContext
      extractedFacts.push(`Dryer cycle context is ${parsedDryerCycleContext}`)
    }
  }

  if (state.lastMissingFacts.includes('double charge step by step') && shouldTreatAsDoubleChargeNarrative(trimmed)) {
    state.doubleChargeNarrativeProvided = true
    state.doubleChargeNarrativeText = trimmed
    extractedFacts.push('Double charge narrative provided is yes')
    extractedFacts.push(`Double charge narrative text is ${trimmed}`)
    extractedFacts.push(`Issue summary is double charge; customer narrative: ${trimmed}`)
  } else if (
    state.lastMissingFacts.includes('double charge step by step') &&
    isAlreadyAnsweredReply(trimmed) &&
    state.doubleChargeNarrativeProvided &&
    state.doubleChargeNarrativeText
  ) {
    extractedFacts.push('Double charge narrative provided is yes')
    extractedFacts.push(`Double charge narrative text is ${state.doubleChargeNarrativeText}`)
  }

  if (state.lastMissingFacts.includes('last 4 card digits')) {
    const last4Digits = extractLast4CardDigits(trimmed)
    if (last4Digits) {
      state.last4CardDigitsProvided = true
      extractedFacts.push('Last 4 card digits provided is yes')
    }
  }

  if (state.lastMissingFacts.includes('payment proof')) {
    const paymentProofProvided = parsePaymentProofProvided(trimmed)
    if (paymentProofProvided !== null) {
      state.paymentProofProvided = paymentProofProvided
      extractedFacts.push(`Payment proof provided is ${paymentProofProvided ? 'yes' : 'no'}`)
    }
  }

  const explicitLocation = extractExplicitLocation(trimmed)
  if (explicitLocation && !state.location) {
    const knownLocation = resolveKnownLocation(explicitLocation)
    if (knownLocation) {
      state.location = knownLocation
      state.locationClarificationCount = 0
      extractedFacts.push(`Location is ${knownLocation}`)
    } else {
      state.locationClarificationCount += 1
    }
  } else if (isLikelyStandaloneLocationInput(state, trimmed)) {
    const knownLocation = resolveKnownLocation(trimmed)
    if (knownLocation) {
      state.location = knownLocation
      state.locationClarificationCount = 0
      extractedFacts.push(`Location is ${knownLocation}`)
    } else {
      state.locationClarificationCount += 1
    }
  }

  const explicitMachineType = normalizeMachineType(trimmed)
  if (explicitMachineType && (!state.machineType || state.machineType !== explicitMachineType)) {
    state.machineType = explicitMachineType
    extractedFacts.push(`Machine type is ${explicitMachineType}`)
  }

  const explicitMachineNumber = trimmed.match(/(?:numero|num(?:ero)?|n\.?|machine number|macchina)\s*[:#-]?\s*(\d{1,3})\b/i)?.[1]
  if (explicitMachineNumber && state.machineType && !state.machineNumber) {
    state.machineNumber = explicitMachineNumber
    extractedFacts.push(`Machine number is ${explicitMachineNumber}`)
  } else if (/\b\d{1,3}\b/.test(trimmed) && state.machineType && !state.machineNumber) {
    const inlineMachineNumber = trimmed.match(/\b(\d{1,3})\b/)?.[1]
    if (inlineMachineNumber) {
      state.machineNumber = inlineMachineNumber
      extractedFacts.push(`Machine number is ${inlineMachineNumber}`)
    }
  } else if (/^\d{1,3}$/.test(trimmed) && state.machineType && !state.machineNumber) {
    state.machineNumber = trimmed
    extractedFacts.push(`Machine number is ${trimmed}`)
  }

  const explicitDisplayState = extractDisplayState(trimmed)
  if (explicitDisplayState && state.machineType && !state.displayState) {
    state.displayState = explicitDisplayState
    extractedFacts.push(`Display state is ${explicitDisplayState}`)

    const paymentCompletedFromDisplay = inferPaymentCompletedFromDisplayState(state.machineType, explicitDisplayState)
    if (paymentCompletedFromDisplay !== null) {
      state.paymentCompleted = paymentCompletedFromDisplay
      extractedFacts.push(`Payment completed is ${paymentCompletedFromDisplay ? 'yes' : 'no'}`)
    }
  }

  if (state.machineType && state.paymentCompleted === null && !state.activeFlowId && !isAwaitingLocation(state)) {
    const parsedPaymentAnswer = parsePaymentAnswer(trimmed)
    if (parsedPaymentAnswer !== null) {
      state.paymentCompleted = parsedPaymentAnswer
      extractedFacts.push(`Payment completed is ${parsedPaymentAnswer ? 'yes' : 'no'}`)
    }
  }

  if (extractedFacts.length) {
    if (shouldPreserveIssueSummary) {
      extractedFacts.push(`Issue summary is ${trimmed}`)
    }
    return extractedFacts.join('; ')
  }

  return userMessage
}
