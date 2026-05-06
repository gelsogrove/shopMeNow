// Session state runtime helpers. The SessionState type itself lives in
// ../models/state.ts so it can be shared without importing this module
// (which carries runtime-only side effects).

import type { SessionState } from '../models/index.js'

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
    customerPhone: null,
    paymentRequested: false,
    caso7Active: false,
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
    invoiceData: {
      razonSocial: '',
      direccion: '',
      cif: '',
      fecha: '',
      fechaIso: '',
      email: '',
    },
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
