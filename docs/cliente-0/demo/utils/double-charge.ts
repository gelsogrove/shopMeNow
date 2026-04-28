// Double-charge state-machine decision builder.
// Sole arbiter of the double-charge collection flow inside handleTurn.

import type { RouterDecision } from './types.js'
import type { SessionState } from './state.js'
import {
  shouldForceDoubleChargeNarrativeStep,
  parseServiceCompletedAnswer,
  extractLast4CardDigits,
  parsePaymentProofProvided,
  hasInconsistentDoubleChargeNarrative,
} from './intent.js'

export function buildDoubleChargeStepDecision(
  routerDecision: RouterDecision,
  state: SessionState,
  userMessage: string,
): RouterDecision {
  // Preserve escalation decisions already set deterministically
  if (routerDecision.functionName === 'contactOperator' && routerDecision.route === 'operator') {
    return routerDecision
  }

  const forcedNarrativeProvided = shouldForceDoubleChargeNarrativeStep(state, userMessage)
  const currentTurnServiceCompleted = state.lastMissingFacts.includes('service completed or not')
    ? parseServiceCompletedAnswer(userMessage)
    : null
  const currentTurnLast4DigitsProvided = state.lastMissingFacts.includes('last 4 card digits')
    ? Boolean(extractLast4CardDigits(userMessage))
    : false
  const currentTurnPaymentProofResult = state.lastMissingFacts.includes('payment proof')
    ? parsePaymentProofProvided(userMessage)
    : null
  const currentTurnPaymentProofAnswered = currentTurnPaymentProofResult !== null

  const resolvedServiceCompleted =
    currentTurnServiceCompleted !== null ? currentTurnServiceCompleted : state.serviceCompleted

  const resolvedDoubleChargeNarrativeProvided = forcedNarrativeProvided || state.doubleChargeNarrativeProvided

  const resolvedDoubleChargeNarrativeText = forcedNarrativeProvided
    ? userMessage.trim()
    : state.doubleChargeNarrativeText

  const resolvedLast4CardDigitsProvided = currentTurnLast4DigitsProvided || state.last4CardDigitsProvided

  const resolvedPaymentProofProvided =
    currentTurnPaymentProofResult === true || state.paymentProofProvided

  const paymentProofAnswered =
    currentTurnPaymentProofAnswered || state.paymentProofProvided === true

  const resolvedLocation =
    (typeof routerDecision.extractedFacts?.location === 'string' && routerDecision.extractedFacts.location) ||
    state.location

  // Scenario 6.3: inconsistent narrative → immediate escalation
  const isNarrativeInconsistent =
    forcedNarrativeProvided && hasInconsistentDoubleChargeNarrative(userMessage)

  if (isNarrativeInconsistent) {
    return {
      ...routerDecision,
      route: 'operator',
      functionName: 'contactOperator',
      nextOwner: 'conversation_history',
      missingFacts: ['customer name'],
      extractedFacts: {
        ...routerDecision.extractedFacts,
        issueSummary: 'double charge',
        serviceCompleted: resolvedServiceCompleted,
        doubleChargeNarrativeProvided: true,
        doubleChargeNarrativeText: userMessage.trim(),
      },
      customerFacingGoal:
        'The customer\'s narrative is inconsistent (unclear number of charges or amount mismatch). You MUST ask for their name in the same message using the phrase "¿Cómo te llamas?" and announce operator escalation using the word "operador". Do NOT request card digits or payment proof.',
      escalationReason:
        'Inconsistent double-charge narrative: unclear number of charges or amount mismatch.',
    }
  }

  const missingFacts: string[] = []
  if (!resolvedLocation) {
    missingFacts.push('location')
  } else if (resolvedServiceCompleted === null) {
    missingFacts.push('service completed or not')
  } else if (!resolvedDoubleChargeNarrativeProvided) {
    missingFacts.push('double charge step by step')
  } else {
    if (!resolvedLast4CardDigitsProvided) missingFacts.push('last 4 card digits')
    if (!paymentProofAnswered) missingFacts.push('payment proof')
  }

  return {
    ...routerDecision,
    route: missingFacts.length > 0 ? 'unknown' : 'operator',
    nextOwner: 'conversation_history',
    functionName: missingFacts.length > 0 ? null : 'contactOperator',
    extractedFacts: {
      ...routerDecision.extractedFacts,
      issueSummary: 'double charge',
      serviceCompleted: resolvedServiceCompleted,
      doubleChargeNarrativeProvided: resolvedDoubleChargeNarrativeProvided,
      doubleChargeNarrativeText: resolvedDoubleChargeNarrativeText,
      last4CardDigitsProvided: resolvedLast4CardDigitsProvided,
      paymentProofProvided: resolvedPaymentProofProvided,
    },
    missingFacts,
    customerFacingGoal:
      missingFacts.length > 0
        ? missingFacts[0] === 'location'
          ? state.turnCount === 1
            ? 'Greet the customer warmly as the Ecolaundry virtual assistant. You MUST include the exact phrase "estoy aquí para ayudarte" in your greeting. Then acknowledge the double charge concern and ask only which lavandería (town and street) the customer is at.'
            : 'Acknowledge the double charge concern briefly. Ask only which lavandería (town and street) the customer is at.'
          : missingFacts[0] === 'service completed or not'
            ? '[EXACT] ¿Pudiste completar el lavado o secado?'
            : missingFacts[0] === 'double charge step by step'
              ? '[EXACT] Por favor, cuéntame paso a paso qué pasó: cómo empezó, qué hiciste, cuándo viste el doble cobro.'
              : missingFacts[0] === 'last 4 card digits'
                ? '[EXACT] ¿Cuáles son los últimos 4 dígitos de la tarjeta con la que pagaste?'
                : missingFacts[0] === 'payment proof'
                  ? '[EXACT] ¿Tienes una captura de pantalla del pago o comprobante?'
                  : 'Collect the documented double-charge review details step by step. Do not escalate yet.'
        : '[EXACT] Hemos recibido toda la información necesaria. ¿Cómo te llamas?',
    escalationReason:
      missingFacts.length > 0 ? null : 'Double charge evidence collected and ready for manual review.',
  }
}
