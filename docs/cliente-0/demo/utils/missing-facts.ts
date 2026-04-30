// Missing-fact computation and question generation.
// Determines what the bot needs to ask next to complete troubleshooting triage.

import type { RouterDecision } from './types.js'
import type { SessionState } from './state.js'
import {
  isPaidButNotActivatedCase,
  hasWasherPostCycleIssue,
} from './intent.js'
import {
  isWasherPaymentPendingDisplay,
  doesDryerDisplayNeedIdentityDetails,
} from './display-state.js'
import {
  hasExtraButtonIssue,
  hasStopIntent,
} from './message-parsing.js'
import { QUESTIONS } from './localization.js'

// ── Question rendering ────────────────────────────────────────────────────────

export function renderMissingFactQuestion(routerDecision: RouterDecision, state: SessionState): string {
  const firstMissing = routerDecision.missingFacts[0]
  const resolvedMachineType = routerDecision.route === 'dryer' || state.machineType === 'dryer'
    ? 'dryer'
    : routerDecision.route === 'washer' || state.machineType === 'washer'
      ? 'washer'
      : ''

  if (firstMissing === 'location') {
    return state.locationClarificationCount > 0 ? QUESTIONS.locationClarification : QUESTIONS.location
  }
  if (firstMissing === 'machine type') return QUESTIONS.machineType
  if (firstMissing === 'machine number') {
    return resolvedMachineType === 'dryer' ? QUESTIONS.machineNumberDryer : QUESTIONS.machineNumberWasher
  }
  if (firstMissing === 'payment completed or not') return QUESTIONS.payment
  if (firstMissing === 'dryer started or not') return QUESTIONS.dryerStarted
  if (firstMissing === 'dryer first cycle or added time') return QUESTIONS.dryerCycleContext
  if (firstMissing === 'service completed or not') return QUESTIONS.serviceCompleted
  if (firstMissing === 'double charge step by step') return QUESTIONS.doubleChargeNarrative
  if (firstMissing === 'last 4 card digits') return QUESTIONS.last4Digits
  if (firstMissing === 'payment proof') return QUESTIONS.paymentProof
  if (firstMissing === 'exact display state') {
    return resolvedMachineType === 'washer' ? QUESTIONS.displayWasher : QUESTIONS.displayDryer
  }
  return QUESTIONS.defaultHelp
}

// ── Fact priority reordering ──────────────────────────────────────────────────

export function pickSingleMissingFact(routerDecision: RouterDecision, state: SessionState): RouterDecision {
  if (!routerDecision.missingFacts.length) {
    return routerDecision
  }

  const orderedMissingFacts = [...routerDecision.missingFacts].sort((left, right) => {
    const priority = [
      'service completed or not',
      'double charge step by step',
      'last 4 card digits',
      'payment proof',
      'location',
      'machine type',
      'machine number',
      'payment completed or not',
      'exact display state',
    ]
    return priority.indexOf(left) - priority.indexOf(right)
  })

  return {
    ...routerDecision,
    missingFacts: [orderedMissingFacts[0]],
  }
}

// ── Fallback messages ─────────────────────────────────────────────────────────

export function fallbackBlockedMessage(language: SessionState['language']): string {
  return {
    it: 'Il caso verrà controllato manualmente da un operatore: qui ci vuole un aiuto in carne e ossa.',
    es: 'El caso será revisado manualmente por un operador: aquí hace falta ayuda en carne y hueso.',
    ca: 'El cas sera revisat manualment per un operador: aqui cal ajuda humana.',
    fr: 'Le cas sera examine manuellement par un operateur: ici il faut une aide humaine.',
    pt: 'O caso será analisado manualmente por um operador: aqui e preciso ajuda humana.',
    en: 'The case will be reviewed manually by an operator: hands-on human help is needed here.',
  }[language]
}

export function getNameQuestion(language: SessionState['language']): string {
  return {
    it: 'Come ti chiami?',
    es: '¿Como te llamas?',
    ca: 'Com et dius?',
    fr: 'Comment t\'appelles-tu?',
    pt: 'Como te chamas?',
    en: 'What is your name?',
  }[language]
}

export function forceLocationQuestion(routerDecision: RouterDecision): RouterDecision {
  return {
    ...routerDecision,
    missingFacts: ['location'],
    customerFacingGoal: 'Ask only which lavandería autoservicio (pueblo only) the customer is at.',
  }
}

// ── Identity missing facts ────────────────────────────────────────────────────

export function getTroubleshootingIdentityMissingFacts(state: SessionState): string[] {
  const missingFacts: string[] = []
  if (!state.location) missingFacts.push('location')
  if (!state.machineType) missingFacts.push('machine type')
  if (!state.machineNumber) missingFacts.push('machine number')
  return missingFacts
}

export function computeTroubleshootingMissingFacts(params: {
  state: SessionState
  routeMachineType: 'washer' | 'dryer' | ''
  issueSummary: string
  displayState: string
  machineNumber: string
  dryerStarted: boolean | null
  dryerCycleContext: '' | 'first_cycle' | 'time_added'
  askLocationFirst?: boolean
}): string[] {
  const {
    state,
    routeMachineType,
    issueSummary,
    displayState,
    machineNumber,
    askLocationFirst = false,
  } = params

  const missingFacts: string[] = []
  const postCycleLikeIssue = hasWasherPostCycleIssue(issueSummary)
  const extraButtonIssue = hasExtraButtonIssue(issueSummary)
  const stopLikeIssue = hasStopIntent(issueSummary)
  const hasDisplay = Boolean(displayState)

  if (routeMachineType === 'washer') {
    if (isPaidButNotActivatedCase(state, issueSummary, routeMachineType)) {
      if (askLocationFirst && !state.location) {
        missingFacts.push('location')
      }
      if (!machineNumber) {
        missingFacts.push('machine number')
      }
      return missingFacts
    }

    if (!hasDisplay && !postCycleLikeIssue && !extraButtonIssue && !stopLikeIssue) {
      missingFacts.push('exact display state')
      return missingFacts
    }

    if (hasDisplay && !isWasherPaymentPendingDisplay(displayState)) {
      if (askLocationFirst && !state.location) {
        missingFacts.push('location')
      }
      if (!machineNumber) {
        missingFacts.push('machine number')
      }
    }

    return missingFacts
  }

  if (routeMachineType === 'dryer') {
    if (!hasDisplay) {
      missingFacts.push('exact display state')
      return missingFacts
    }

    if (doesDryerDisplayNeedIdentityDetails(displayState)) {
      if (askLocationFirst && !state.location) {
        missingFacts.push('location')
      }
      if (!machineNumber) {
        missingFacts.push('machine number')
      }
    }

    return missingFacts
  }

  if (askLocationFirst && !state.location) {
    missingFacts.push('location')
  }

  if (routeMachineType && !machineNumber) {
    missingFacts.push('machine number')
  }

  return missingFacts
}

export function getTroubleshootingBlockingMissingFacts(state: SessionState, userMessage: string): string[] {
  const missingFacts = getTroubleshootingIdentityMissingFacts(state)

  if (state.machineType === 'washer' || state.machineType === 'dryer') {
    return missingFacts.concat(
      computeTroubleshootingMissingFacts({
        state,
        routeMachineType: state.machineType,
        issueSummary: `${state.issueSummary} ${userMessage}`,
        displayState: state.displayState,
        machineNumber: state.machineNumber,
        dryerStarted: state.dryerStarted,
        dryerCycleContext: state.dryerCycleContext,
      }),
    )
  }

  return missingFacts
}

export function applyMachineSpecificMissingQuestion(
  routerDecision: RouterDecision,
  state: SessionState,
): RouterDecision {
  const routeMachineType = routerDecision.route === 'washer' || routerDecision.route === 'dryer'
    ? routerDecision.route
    : state.machineType
  const paidButNotActivatedCase = isPaidButNotActivatedCase(state, state.issueSummary, routeMachineType)

  const preferredMissingFacts: string[] = []
  if (!state.machineType && routeMachineType !== 'washer' && routeMachineType !== 'dryer') {
    preferredMissingFacts.push('machine type')
  }

  if (routeMachineType === 'washer') {
    if (paidButNotActivatedCase) {
      if (!state.machineNumber) preferredMissingFacts.push('machine number')
    } else if (!state.displayState) {
      preferredMissingFacts.push('exact display state')
    } else if (!isWasherPaymentPendingDisplay(state.displayState)) {
      if (!state.location) preferredMissingFacts.push('location')
      if (!state.machineNumber) preferredMissingFacts.push('machine number')
    }
  }

  if (routeMachineType === 'dryer') {
    if (!state.displayState) {
      preferredMissingFacts.push('exact display state')
    } else if (doesDryerDisplayNeedIdentityDetails(state.displayState)) {
      if (!state.location) preferredMissingFacts.push('location')
      if (!state.machineNumber) preferredMissingFacts.push('machine number')
    }
  }

  const normalizedMissingFacts = preferredMissingFacts.length > 0
    ? [preferredMissingFacts[0]]
    : routerDecision.missingFacts.filter((fact) => fact !== 'payment completed or not')

  if (!normalizedMissingFacts.length) {
    return routerDecision
  }

  const firstMissing = normalizedMissingFacts[0]

  if (firstMissing === 'dryer started or not') {
    return {
      ...routerDecision,
      missingFacts: [firstMissing],
      customerFacingGoal: 'Ask only whether the dryer has managed to start. Do not mention payment or display yet.',
    }
  }

  if (firstMissing === 'dryer first cycle or added time') {
    return {
      ...routerDecision,
      missingFacts: [firstMissing],
      customerFacingGoal: 'Ask only whether it is the first dryer cycle or whether extra time was added.',
    }
  }

  if (firstMissing === 'machine number') {
    if (routeMachineType === 'dryer') {
      return {
        ...routerDecision,
        missingFacts: [firstMissing],
        customerFacingGoal: 'Ask only for the dryer machine number. Do not mention washer, payment, or display yet.',
      }
    }

    if (routeMachineType === 'washer') {
      return {
        ...routerDecision,
        missingFacts: [firstMissing],
        customerFacingGoal: 'Ask only for the machine number. Respond in the SAME language as the customer. You MUST use the word "máquina" in Spanish or Catalan responses. Do not mention payment or display.',
      }
    }
  }

  if (firstMissing !== 'exact display state') {
    return {
      ...routerDecision,
      missingFacts: [firstMissing],
    }
  }

  if (routeMachineType === 'washer') {
    return {
      ...routerDecision,
      missingFacts: [firstMissing],
      customerFacingGoal: 'Ask only what the washer display shows right now.',
    }
  }

  return {
    ...routerDecision,
    missingFacts: [firstMissing],
    customerFacingGoal: 'Ask only what the machine display shows right now.',
  }
}
