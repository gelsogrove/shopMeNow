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
    locationAckPending: null,
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
    activeBranch: null,
    previousBranch: null,
    retryCount: 0,
    lastResolvedIntent: null,
    faqPricesType: null,
    lastFaqKey: null,
    escalationReason: null,
    operatorRequested: false,
    customerName: null,
    customerNameRequested: false,
    customerPhone: null,
    paymentRequested: false,
    turnCount: 0,
    lastUserMessage: '',
    lastPresentedStepId: null,
    displayPhaseBTurnCount: 0,
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
    displayReaskPrevCode: '',
    displayStateAtTurnStart: '',
    displayAskAttempts: 0,
    cardDigitsAskAttempts: 0,
    machineNumberAskAttempts: 0,
    machineTypeAskAttempts: 0,
    awaitNameAskAttempts: 0,
    displayLabel: '',
    displayHistory: [],
    faqPause: false,
    discountCodeAskAttempts: 0,
    pendingFlow: '',
    invoiceData: {
      razonSocial: '',
      direccion: '',
      cif: '',
      fecha: '',
      fechaIso: '',
      costeTotal: '',
      email: '',
      notes: '',
    },
    discountCodeData: {
      letters: '',
      fechaIso: '',
      importe: '',
      doorClosed: null,
    },
  }
}

/**
 * F38 (Andrea 2026-05-11) — lighter reset for post-resolved transitions.
 * The previous incident is closed (`mark_resolved`) but the SAME machine
 * is still identified. A follow-up flow (e.g. factura for the wash that
 * just finished) should NOT re-ask "lavadora o secadora?" / "qué número?"
 * because that information is still valid in the session TTL window
 * (1 hour, settings.json:historyResetTtlMs).
 *
 * Preserved: location, locationStreet, customerName, language,
 * **machineType, machineNumber** (the new bits).
 *
 * Wiped: display state, payment, active flow markers, retry counters,
 * pendingFlow. Anything specific to the incident trajectory.
 *
 * resetMachineFacts() below is the FULL reset used on topic switch
 * (different incident: machine → datáfono); resetIncidentDetails() is
 * used on resolution (same machine, new question).
 */
export function resetIncidentDetails(state: SessionState): void {
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
  state.displayReaskPrevCode = ''
  state.displayStateAtTurnStart = ''
  state.displayAskAttempts = 0
  state.cardDigitsAskAttempts = 0
  state.awaitNameAskAttempts = 0
  state.displayLabel = ''
  state.displayHistory = []
  state.faqPause = false
  state.discountCodeAskAttempts = 0
  state.displayPhaseBTurnCount = 0
  state.mixedIncident = false
  state.nonTroubleshootingIncident = ''
  state.lastMissingFacts = []
  state.retryCount = 0
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
  state.displayReaskPrevCode = ''
  state.displayStateAtTurnStart = ''
  state.displayAskAttempts = 0
  state.cardDigitsAskAttempts = 0
  state.machineNumberAskAttempts = 0
  state.machineTypeAskAttempts = 0
  state.awaitNameAskAttempts = 0
  state.displayLabel = ''
  state.displayHistory = []
  state.faqPause = false
  state.discountCodeAskAttempts = 0
  state.displayPhaseBTurnCount = 0
  state.mixedIncident = false
  state.nonTroubleshootingIncident = ''
  state.lastMissingFacts = []
  state.retryCount = 0
}
