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
  faqCodeValue: string          // code received from the customer in the codice flow
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
    faqCodeValue: '',
  }
}

export function summarizeState(state: SessionState): string {
  return JSON.stringify(state, null, 2)
}

export function pushDebug(debug: string[], label: string, value: unknown): void {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  debug.push(`${label}: ${rendered}`)
}
