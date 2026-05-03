// Session state management
export type SessionState = {
  language: 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr'
  preferredLanguage: 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr' | null
  location: string
  locationStreet: string
  locationStreetRequested: boolean
  locationClarificationCount: number
  machineType: '' | 'washer' | 'dryer'
  machineNumber: string
  paymentCompleted: boolean | null
  dryerStarted: boolean | null
  dryerCycleContext: '' | 'first_cycle' | 'time_added'
  serviceCompleted: boolean | null
  paymentMethod: string
  displayState: string
  issueSummary: string
  doubleChargeNarrativeProvided: boolean
  doubleChargeNarrativeText: string
  last4CardDigitsProvided: boolean
  paymentProofProvided: boolean
  activeFlowId: string | null
  activeStepId: string | null
  // Saved flow position so a transversal FAQ (asked mid-troubleshooting) does not
  // wipe the current flow. After serving the FAQ reply, the flow can resume from
  // pausedFlow.{flowId, stepId} on the next turn.
  pausedFlow: { flowId: string; stepId: string | null } | null
  retryCount: number
  lastResolvedIntent: 'washer' | 'dryer' | 'faq' | 'operator' | 'reset' | 'greeting' | 'unknown' | null
  escalationReason: string | null
  operatorRequested: boolean
  customerName: string | null
  customerNameRequested: boolean
  turnCount: number
  lastPresentedStepId: string | null
  lastMissingFacts: string[]
  pendingClosure: 'resolved' | 'escalated' | null
  lastActivityAt: number
  activeFaqFlow: string | null  // e.g. 'discount-code'
  faqStep: number               // 0 = inactive, 1+ = step index within the flow
  // Set when a location-aware FAQ (buy-loyalty-card, recharge-loyalty-card) was
  // served on a previous turn and the bot is now waiting for the customer's
  // location to apply the per-location faqOverride.
  pendingLocationAwareFaq: '' | 'buy-loyalty-card' | 'recharge-loyalty-card'
  // UC17: customer cannot read the display. After detecting this we ask for a
  // photo; if they cannot send one, escalate.
  displayUnreadable: boolean
  photoRequested: boolean
  // UC32: mixed incident detected on turn 1. After location is captured the
  // bot asks about the display directly to clarify whether it's a machine or
  // payment problem.
  mixedIncident: boolean
  // Set on turn 1 when the customer reports a NON machine-troubleshooting
  // incident (card payment fails, datafono wrong amount, dryer minutes not
  // credited, cameras / AJAX request, refund/compensation demand, contradictory
  // double-charge narrative, undocumented display code). Used downstream to
  // skip machineType/machineNumber/displayState gathering and force escalation
  // after location is captured. Multilingua TODO: today the trigger patterns
  // are in Spanish only.
  nonTroubleshootingIncident: '' | 'card-payment' | 'datafono-wrong-amount' | 'dryer-minutes-not-credited' | 'refund-demand' | 'compensation-demand' | 'cameras-or-ajax' | 'contradictory-narrative' | 'numeric-only-code' | 'undocumented-display'
  faqCodeValue: string          // code received from the customer in the codice flow
  refundDataAsked: boolean      // Caso 26/27: bot has already asked refund data once
  empathicResponseSent: boolean // Caso 25: empathic opener already issued
  faqTopic: '' | 'buy-loyalty-card' | 'recharge-loyalty-card' | 'hours-prices' | 'invoice'
  // Pending multi-turn flow markers used by the agent's deterministic guards.
  // Replaces the old hack of storing markers inside escalationReason.
  //   - 'caso7-ask-cambio'    : after a "He pagado pero no he podido usar"
  //                              opener, next turn we ask "¿La central te ha
  //                              devuelto el cambio?"
  //   - 'caso7-await-display' : the customer just said "sí" to cambio; next
  //                              turn we ask the display state.
  //   - 'numeric-code-ask-letters' : customer typed a numbers-only code →
  //                                   ask "¿ves alguna letra delante?"
  //   - 'numeric-code-await-answer' : waiting for the yes/no on letters
  pendingFlow:
    | ''
    | 'caso7-ask-cambio'
    | 'caso7-await-display'
    | 'numeric-code-ask-letters'
    | 'numeric-code-await-answer'
    | 'caso6-ask-podido-lavar'   // Caso 6 step 1: ask "¿has podido lavar/secar?"
    | 'caso6-ask-relato'         // Caso 6 step 2: ask "explícame paso a paso"
    | 'caso6-ask-4-digitos'      // Caso 6 step 3: ask last 4 card digits
    | 'caso6-ask-captura'        // Caso 6 step 4: ask payment screenshot
    | 'caso17-ask-photo'         // Caso 17: customer can't read display → ask photo
    | 'caso17-await-photo'       // Caso 17 step 2: waiting yes/no on photo
}

export function createInitialState(): SessionState {
  return {
    language: 'en',
    preferredLanguage: null,
    location: '',
    locationStreet: '',
    locationStreetRequested: false,
    locationClarificationCount: 0,
    machineType: '',
    machineNumber: '',
    paymentCompleted: null,
    dryerStarted: null,
    dryerCycleContext: '',
    serviceCompleted: null,
    paymentMethod: '',
    displayState: '',
    issueSummary: '',
    doubleChargeNarrativeProvided: false,
    doubleChargeNarrativeText: '',
    last4CardDigitsProvided: false,
    paymentProofProvided: false,
    activeFlowId: null,
    activeStepId: null,
    pausedFlow: null,
    retryCount: 0,
    lastResolvedIntent: null,
    escalationReason: null,
    operatorRequested: false,
    customerName: null,
    customerNameRequested: false,
    turnCount: 0,
    lastPresentedStepId: null,
    lastMissingFacts: [],
    pendingClosure: null,
    lastActivityAt: Date.now(),
    activeFaqFlow: null,
    faqStep: 0,
    pendingLocationAwareFaq: '',
    displayUnreadable: false,
    photoRequested: false,
    mixedIncident: false,
    faqCodeValue: '',
    refundDataAsked: false,
    empathicResponseSent: false,
    faqTopic: '',
    nonTroubleshootingIncident: '',
    pendingFlow: '',
  }
}

/**
 * Wipe machine-incident facts when the customer switches to a different
 * incident (e.g. from "la lavadora SEL" to "datáfono ha cobrado 10€").
 *
 * Preserved: location, locationStreet, customerName, language. Those are
 * about the customer, not the incident.
 *
 * Wiped: everything that describes the machine problem (machineType,
 * machineNumber, displayState, paymentCompleted, active flow markers,
 * photoRequested, displayUnreadable, mixedIncident, pendingFlow).
 */
export function resetMachineFacts(state: SessionState): void {
  state.machineType = ''
  state.machineNumber = ''
  state.displayState = ''
  state.paymentCompleted = null
  state.paymentMethod = ''
  state.dryerStarted = null
  state.dryerCycleContext = ''
  state.serviceCompleted = null
  state.activeFlowId = null
  state.activeStepId = null
  state.pendingFlow = ''
  state.displayUnreadable = false
  state.photoRequested = false
  state.mixedIncident = false
  state.nonTroubleshootingIncident = ''
  state.lastMissingFacts = []
  state.retryCount = 0
}

export function summarizeState(state: SessionState): string {
  return JSON.stringify(state, null, 2)
}

export function pushDebug(debug: string[], label: string, value: unknown): void {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  debug.push(`${label}: ${rendered}`)
}
