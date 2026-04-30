// Router layer — wraps LLM router/specialist calls with deterministic safety corrections.

import type { RouterDecision, SpecialistDecision } from './types.js'
import type { SessionState } from './state.js'
import type { Runtime } from './runtime.js'
import { summarizeState } from './state.js'
import { buildLocationContext } from './runtime.js'
import { callModel, extractJson } from './llm.js'
import {
  normalizeMachineType,
  normalizeRoute,
  pickAllowedToken,
  hasExplicitResetIntent,
  hasDoubleChargeConcern,
  hasNoFoamConcern,
  hasTroubleshootingIntent,
  hasWasherPostCycleIssue,
  hasDryerPostCycleIssue,
  isContextualHeuristicInput,
  isShortContextReply,
  hasOperationalContextIntent,
  parseServiceCompletedAnswer,
  shouldTreatAsDoubleChargeNarrative,
  shouldForceDoubleChargeNarrativeStep,
  extractLast4CardDigits,
  parsePaymentProofProvided,
} from './intent.js'
import { inferPaymentCompletedFromDisplayState } from './display-state.js'
import { hasStopIntent } from './message-parsing.js'
import { resolveKnownLocation } from './message-parsing.js'
import { computeTroubleshootingMissingFacts } from './missing-facts.js'

// ── Router safety corrector ───────────────────────────────────────────────────

export function applyContextualRouterFallback(
  decision: RouterDecision,
  state: SessionState,
  originalInput: string,
  normalizedInput: string,
): RouterDecision {
  const nextDecision = { ...decision }

  const isDoubleChargeCase =
    hasDoubleChargeConcern(originalInput) ||
    /double charge/i.test(String(nextDecision.extractedFacts?.issueSummary || state.issueSummary || '')) ||
    state.lastMissingFacts.some((fact) =>
      ['service completed or not', 'double charge step by step', 'last 4 card digits', 'payment proof'].includes(fact),
    )

  if (isDoubleChargeCase) {
    // Angry customer explicitly demanding a human on first double-charge contact → immediate escalation
    const isAngryWithExplicitOperatorRequest =
      /enfadad[oa]|furioso|molt molest|muy molest|enojad[oa]|angry|furieux|arrabiat[oa]/i.test(originalInput) &&
      /operador|operatore|humano|persona|agente|hablar con|parler [aà]|voglio parlare|quiero hablar/i.test(originalInput)

    if (isAngryWithExplicitOperatorRequest && !state.location && !state.serviceCompleted && !state.doubleChargeNarrativeProvided) {
      return {
        ...nextDecision,
        route: 'operator',
        functionName: 'contactOperator',
        nextOwner: 'conversation_history',
        missingFacts: ['customer name'],
        extractedFacts: {
          ...nextDecision.extractedFacts,
          issueSummary: 'double charge',
        },
        customerFacingGoal:
          'The customer is very angry and explicitly requested a human. Ask for their name and immediately escalate without collecting review data.',
        escalationReason: 'Customer is very angry and explicitly demanded a human operator on first contact.',
      }
    }

    const isAwaitingServiceCompleted = state.lastMissingFacts.includes('service completed or not')
    const isAwaitingNarrative = state.lastMissingFacts.includes('double charge step by step')
    const isAwaitingLast4Digits = state.lastMissingFacts.includes('last 4 card digits')
    const isAwaitingPaymentProof = state.lastMissingFacts.includes('payment proof')

    const currentTurnServiceCompleted = isAwaitingServiceCompleted ? parseServiceCompletedAnswer(originalInput) : null
    const currentTurnNarrativeProvided = isAwaitingNarrative
      ? shouldTreatAsDoubleChargeNarrative(originalInput) || shouldForceDoubleChargeNarrativeStep(state, originalInput)
      : false
    const currentTurnLast4Digits = isAwaitingLast4Digits ? extractLast4CardDigits(originalInput) : null
    const currentTurnPaymentProof = isAwaitingPaymentProof ? parsePaymentProofProvided(originalInput) : null

    const resolvedServiceCompleted =
      currentTurnServiceCompleted !== null
        ? currentTurnServiceCompleted
        : typeof nextDecision.extractedFacts?.serviceCompleted === 'boolean'
          ? nextDecision.extractedFacts.serviceCompleted
          : state.serviceCompleted
    const resolvedDoubleChargeNarrativeProvided = currentTurnNarrativeProvided
      ? true
      : typeof nextDecision.extractedFacts?.doubleChargeNarrativeProvided === 'boolean'
        ? nextDecision.extractedFacts.doubleChargeNarrativeProvided
        : state.doubleChargeNarrativeProvided
    const resolvedDoubleChargeNarrativeText = currentTurnNarrativeProvided
      ? originalInput.trim()
      : typeof nextDecision.extractedFacts?.doubleChargeNarrativeText === 'string' &&
          nextDecision.extractedFacts.doubleChargeNarrativeText.trim()
        ? String(nextDecision.extractedFacts.doubleChargeNarrativeText).trim()
        : state.doubleChargeNarrativeText
    const resolvedLast4CardDigitsProvided =
      Boolean(currentTurnLast4Digits) ||
      (typeof nextDecision.extractedFacts?.last4CardDigitsProvided === 'boolean'
        ? nextDecision.extractedFacts.last4CardDigitsProvided
        : state.last4CardDigitsProvided)
    const resolvedPaymentProofProvided =
      currentTurnPaymentProof === true ||
      (typeof nextDecision.extractedFacts?.paymentProofProvided === 'boolean'
        ? nextDecision.extractedFacts.paymentProofProvided
        : state.paymentProofProvided)

    const paymentProofAnswered =
      (isAwaitingPaymentProof && currentTurnPaymentProof !== null) || state.paymentProofProvided === true

    const missingFacts: string[] = []
    if (!state.location && !(typeof nextDecision.extractedFacts?.location === 'string' && nextDecision.extractedFacts.location)) {
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
      ...nextDecision,
      route: missingFacts.length > 0 ? 'unknown' : 'operator',
      nextOwner: 'conversation_history',
      functionName: missingFacts.length > 0 ? null : 'contactOperator',
      extractedFacts: {
        ...nextDecision.extractedFacts,
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
              ? 'Greet the customer warmly as the laundry virtual assistant (use "asistente virtual de la lavandería"). You MUST include the exact phrase "estoy aquí para ayudarte" in your greeting. Then ask only which lavandería (pueblo only) the customer is at. Do NOT mention the double charge concern.'
              : 'Ask only which lavandería (pueblo only) the customer is at. Do NOT mention the double charge concern.'
            : 'Collect the documented double-charge review details step by step. Do not escalate yet.'
          : 'Confirm that the double-charge case will be reviewed manually now that the required details were collected.',
      escalationReason: missingFacts.length > 0 ? null : 'Double charge evidence collected and ready for manual review.',
    }
  }

  if (hasNoFoamConcern(originalInput)) {
    return {
      ...nextDecision,
      route: 'faq',
      nextOwner: 'conversation_history',
      functionName: null,
      missingFacts: [],
      extractedFacts: {
        ...nextDecision.extractedFacts,
        issueSummary: originalInput,
        machineType:
          normalizeMachineType(nextDecision.extractedFacts?.machineType) || state.machineType || 'washer',
        paymentCompleted:
          typeof nextDecision.extractedFacts?.paymentCompleted === 'boolean'
            ? nextDecision.extractedFacts.paymentCompleted
            : state.paymentCompleted,
      },
      customerFacingGoal: 'Answer the no-foam detergent question directly without technical troubleshooting or gather.',
      escalationReason: null,
    }
  }

  const shouldTreatAsContextual =
    isContextualHeuristicInput(originalInput, normalizedInput) ||
    isShortContextReply(originalInput) ||
    hasOperationalContextIntent(originalInput)

  if (shouldTreatAsContextual && nextDecision.functionName === 'resetSession') {
    nextDecision.functionName = null
    if (nextDecision.route === 'reset') {
      nextDecision.route =
        state.machineType || state.activeFlowId ? (state.machineType || 'unknown') : 'unknown'
    }
  }

  if (
    nextDecision.functionName === 'resetSession' &&
    !hasExplicitResetIntent(originalInput) &&
    !state.activeFlowId &&
    !state.machineType
  ) {
    nextDecision.functionName = null
    if (nextDecision.route === 'reset') nextDecision.route = 'unknown'
  }

  if (
    (nextDecision.route === 'unknown' || nextDecision.route === 'greeting') &&
    (state.machineType || normalizeMachineType(nextDecision.extractedFacts?.machineType))
  ) {
    const routedMachineType =
      normalizeMachineType(nextDecision.extractedFacts?.machineType) || state.machineType
    if (routedMachineType) {
      nextDecision.route = routedMachineType
      nextDecision.nextOwner =
        routedMachineType === 'washer' ? 'washer_specialist' : 'dryer_specialist'
    }
  }

  if (hasDryerPostCycleIssue(originalInput)) {
    nextDecision.route = 'dryer'
    nextDecision.nextOwner = 'dryer_specialist'
    nextDecision.functionName = null
    nextDecision.extractedFacts = {
      ...nextDecision.extractedFacts,
      machineType: 'dryer',
      issueSummary: 'Dryer post-cycle wet clothes issue after multiple drying attempts.',
    }
    nextDecision.customerFacingGoal =
      'Treat this as a dryer post-cycle wet-clothes issue and ask only the next required troubleshooting detail.'
  }

  if (nextDecision.route === 'washer' || nextDecision.route === 'dryer') {
    const resolvedMachineNumber = String(
      nextDecision.extractedFacts?.machineNumber || state.machineNumber || '',
    ).trim()
    const resolvedDisplayState = String(
      nextDecision.extractedFacts?.displayState || state.displayState || '',
    ).trim()
    const resolvedIssueSummary = String(
      nextDecision.extractedFacts?.issueSummary || state.issueSummary || originalInput,
    )
    const shouldAskLocationFirst =
      !state.location &&
      hasTroubleshootingIntent(resolvedIssueSummary) &&
      !resolvedMachineNumber &&
      !resolvedDisplayState

    nextDecision.extractedFacts = {
      ...nextDecision.extractedFacts,
      machineType: nextDecision.route,
      machineNumber: resolvedMachineNumber,
      displayState: resolvedDisplayState,
      paymentCompleted:
        typeof nextDecision.extractedFacts?.paymentCompleted === 'boolean'
          ? nextDecision.extractedFacts.paymentCompleted
          : inferPaymentCompletedFromDisplayState(nextDecision.route, resolvedDisplayState) !== null
            ? inferPaymentCompletedFromDisplayState(nextDecision.route, resolvedDisplayState)
            : hasWasherPostCycleIssue(resolvedIssueSummary)
              ? true
              : state.paymentCompleted,
    }

    nextDecision.missingFacts = computeTroubleshootingMissingFacts({
      state,
      routeMachineType: nextDecision.route,
      issueSummary: resolvedIssueSummary,
      displayState: resolvedDisplayState,
      machineNumber: resolvedMachineNumber,
      dryerStarted: state.dryerStarted,
      dryerCycleContext: state.dryerCycleContext,
      askLocationFirst: shouldAskLocationFirst,
    })
    nextDecision.functionName = resolvedMachineNumber
      ? nextDecision.route === 'washer'
        ? 'lavatrice_hs60xx'
        : 'asciugatrice_ed340'
      : null
  }

  if (!shouldTreatAsContextual) return nextDecision

  if (nextDecision.route === 'unknown' && state.machineType) {
    nextDecision.route = state.machineType
    nextDecision.nextOwner =
      state.machineType === 'washer' ? 'washer_specialist' : 'dryer_specialist'
  }

  nextDecision.missingFacts = (nextDecision.missingFacts || []).filter((fact) => {
    if (fact === 'machine number' && state.machineNumber) return false
    if (fact === 'exact display state' && state.displayState) return false
    if (fact === 'payment completed or not' && state.paymentCompleted !== null) return false
    if (fact === 'dryer started or not' && state.dryerStarted !== null) return false
    if (fact === 'dryer first cycle or added time' && state.dryerCycleContext) return false
    return true
  })

  return nextDecision
}

// ── Normalizers ───────────────────────────────────────────────────────────────

export function normalizeRouterDecision(decision: RouterDecision, state: SessionState): RouterDecision {
  const route = normalizeRoute(decision.route)
  const machineType =
    normalizeMachineType(decision.extractedFacts?.machineType) || state.machineType
  const functionName = pickAllowedToken(decision.functionName, [
    'lavatrice_hs60xx',
    'asciugatrice_ed340',
    'contactOperator',
    'resetSession',
  ]) as RouterDecision['functionName']
  const normalizedLocation =
    resolveKnownLocation(String(decision.extractedFacts?.location || '').trim()) || state.location
  const extractedFacts = {
    ...decision.extractedFacts,
    location: normalizedLocation,
    machineType,
    machineNumber: String(
      decision.extractedFacts?.machineNumber || state.machineNumber || '',
    ).trim(),
    displayState: String(
      decision.extractedFacts?.displayState || state.displayState || '',
    ).trim(),
  }

  return {
    ...decision,
    route,
    functionName,
    nextOwner:
      route === 'washer'
        ? 'washer_specialist'
        : route === 'dryer'
          ? 'dryer_specialist'
          : 'conversation_history',
    extractedFacts,
    missingFacts: Array.isArray(decision.missingFacts) ? decision.missingFacts : [],
  }
}

export function normalizeSpecialistDecision(
  decision: SpecialistDecision,
  state: SessionState,
): SpecialistDecision {
  const allowed =
    state.machineType === 'dryer'
      ? ['non_parte', 'errore_reset']
      : ['non_parte', 'post_ciclo', 'stop_error']
  const flowId = pickAllowedToken(decision.flowId, allowed)
  return {
    ...decision,
    flowId,
    missingFacts: Array.isArray(decision.missingFacts) ? decision.missingFacts : [],
    shouldEscalate: decision.shouldEscalate === true,
  }
}

export function applySpecialistFallback(
  decision: SpecialistDecision,
  state: SessionState,
  originalInput: string,
): SpecialistDecision {
  const issue = `${state.issueSummary} ${originalInput}`.toLowerCase()
  const displayState = state.displayState.toUpperCase()

  if (state.machineType === 'dryer') {
    if (hasStopIntent(issue)) return { ...decision, flowId: 'errore_reset', shouldEscalate: false }
    if (['SEL', 'PUSH', 'PR', 'ALM', 'AL001', 'END'].includes(displayState))
      return { ...decision, flowId: 'non_parte', shouldEscalate: false }
    if (['FILTRO', 'FALLO DE ROTACION', 'FALLO DE ASPIRACION'].includes(displayState))
      return { ...decision, flowId: 'errore_reset', shouldEscalate: false }
    if (displayState === 'DOOR') return { ...decision, flowId: 'non_parte', shouldEscalate: false }
    if (hasDryerPostCycleIssue(issue)) return { ...decision, flowId: 'errore_reset', shouldEscalate: false }
    if (decision.flowId) return decision
  }

  if (state.machineType === 'washer') {
    if (hasStopIntent(issue)) return { ...decision, flowId: 'stop_error', shouldEscalate: false }
    if (['SEL', 'PUSH', 'PR', 'DOOR', 'ALM', 'AL001', 'END'].includes(displayState))
      return { ...decision, flowId: 'non_parte', shouldEscalate: false }
    if (hasWasherPostCycleIssue(issue)) return { ...decision, flowId: 'post_ciclo', shouldEscalate: false }
    if (decision.flowId) return decision
  }

  return decision
}

// ── Fact merging ──────────────────────────────────────────────────────────────

export function mergeFactsIntoState(state: SessionState, decision: RouterDecision): void {
  const facts = decision.extractedFacts || {}
  if (typeof facts.location === 'string' && facts.location) state.location = facts.location
  if ((facts.machineType === 'washer' || facts.machineType === 'dryer') && facts.machineType)
    state.machineType = facts.machineType
  if (typeof facts.machineNumber === 'string' && facts.machineNumber)
    state.machineNumber = facts.machineNumber
  if (typeof facts.paymentMethod === 'string' && facts.paymentMethod)
    state.paymentMethod = facts.paymentMethod
  if (typeof facts.displayState === 'string' && facts.displayState) {
    state.displayState = facts.displayState
    const machineTypeForDisplayInference =
      facts.machineType === 'washer' || facts.machineType === 'dryer'
        ? facts.machineType
        : state.machineType
    const paymentCompletedFromDisplay = inferPaymentCompletedFromDisplayState(
      machineTypeForDisplayInference,
      facts.displayState,
    )
    if (paymentCompletedFromDisplay !== null) state.paymentCompleted = paymentCompletedFromDisplay
  }
  if (typeof facts.issueSummary === 'string' && facts.issueSummary)
    state.issueSummary = facts.issueSummary
  if (typeof facts.paymentCompleted === 'boolean') state.paymentCompleted = facts.paymentCompleted
  if (typeof facts.dryerStarted === 'boolean') state.dryerStarted = facts.dryerStarted
  if (facts.dryerCycleContext === 'first_cycle' || facts.dryerCycleContext === 'time_added')
    state.dryerCycleContext = facts.dryerCycleContext
  if (typeof facts.serviceCompleted === 'boolean') state.serviceCompleted = facts.serviceCompleted
  if (typeof facts.doubleChargeNarrativeProvided === 'boolean')
    state.doubleChargeNarrativeProvided = facts.doubleChargeNarrativeProvided
  if (typeof facts.doubleChargeNarrativeText === 'string' && facts.doubleChargeNarrativeText)
    state.doubleChargeNarrativeText = facts.doubleChargeNarrativeText
  if (typeof facts.last4CardDigitsProvided === 'boolean')
    state.last4CardDigitsProvided = facts.last4CardDigitsProvided
  if (typeof facts.paymentProofProvided === 'boolean')
    state.paymentProofProvided = facts.paymentProofProvided
}

// ── LLM wrappers ──────────────────────────────────────────────────────────────

export async function runRouter(
  runtime: Runtime,
  state: SessionState,
  message: string,
): Promise<RouterDecision> {
  const fallback: RouterDecision = {
    route: 'unknown',
    nextOwner: 'conversation_history',
    functionName: null,
    extractedFacts: {},
    missingFacts: [],
    customerFacingGoal: 'Ask the most useful missing question.',
    escalationReason: null,
  }
  const prompt = `${runtime.prompts.router}\n\nCurrent session state:\n${summarizeState(state)}\n\nCustomer message:\n${message}`
  const output = await callModel({ userPrompt: prompt, json: true, maxTokens: 500 })
  return extractJson<RouterDecision>(output, fallback)
}

export async function runSpecialist(
  runtime: Runtime,
  state: SessionState,
  message: string,
): Promise<SpecialistDecision> {
  const machineType = state.machineType || 'washer'
  const prompt = machineType === 'dryer' ? runtime.prompts.dryer : runtime.prompts.washer
  const fallback: SpecialistDecision = {
    flowId: null,
    shouldEscalate: true,
    escalationReason: 'Specialist could not classify the technical path safely.',
    technicalSummary: '',
    missingFacts: [],
    customerFacingGoal: 'Escalate to operator.',
  }
  const locationContext = buildLocationContext(runtime, state)
  const userPrompt = [
    prompt,
    locationContext,
    `Session state:\n${summarizeState(state)}`,
    `Customer message:\n${message}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const output = await callModel({ userPrompt, json: true, maxTokens: 300 })
  return extractJson<SpecialistDecision>(output, fallback)
}
