// SessionState: sticky facts and multi-turn flow markers persisted across
// agentTurn() invocations within a session.

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
  customerPhone: string | null
  // Set when guardForcePayment has just asked "¿Has podido realizar el pago?".
  // Allows the next-turn extractor to accept a bare yes/no without requiring
  // payment-context keywords ("pagado", "monedas", …).
  paymentRequested: boolean
  // Set when Caso 7 flow is active: customer paid but didn't use the machine.
  // Skips machineType / machineNumber gather guards because the doc only asks
  // for location + cambio + display, then redirects to the display-specific
  // instruction (PUSH PROG, DOOR, SEL, …) without needing tipo or numero.
  caso7Active: boolean
  turnCount: number
  // Last user message of the current turn. Set by `agentTurn` after sanitisation
  // so tool validators (mark_resolved, escalate_to_operator, …) can inspect it
  // without threading it through every executeTool call.
  lastUserMessage: string
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
  // incident. Used downstream to skip machineType/machineNumber/displayState
  // gathering and force escalation after location is captured.
  nonTroubleshootingIncident: '' | 'card-payment' | 'datafono-wrong-amount' | 'dryer-minutes-not-credited' | 'refund-demand' | 'compensation-demand' | 'cameras-or-ajax' | 'contradictory-narrative' | 'numeric-only-code' | 'undocumented-display'
  faqCodeValue: string          // code received from the customer in the codice flow
  refundDataAsked: boolean      // Caso 26/27: bot has already asked refund data once
  empathicResponseSent: boolean // Caso 25: empathic opener already issued
  faqTopic: '' | 'buy-loyalty-card' | 'recharge-loyalty-card' | 'hours-prices' | 'invoice'
  // Caso 9 — multi-step invoice data collection. Filled progressively as the
  // bot asks each question. Sent to the operator via escalation summary.
  invoiceData: {
    razonSocial: string
    direccion: string
    cif: string
    fecha: string       // raw text as typed by the customer
    fechaIso: string    // normalized YYYY-MM-DD when parseable, else ''
    email: string
  }
  // Caso 8 — discount code parsed from `state.faqCodeValue` once the format
  // SAU2904266 (3 letters + DDMMYY + amount) is validated.
  caso8Data: {
    letters: string
    fechaIso: string    // YYYY-MM-DD when format is valid, else ''
    importe: string     // raw amount as typed
    doorClosed: boolean | null
  }
  // Pending multi-turn flow markers used by the agent's deterministic guards.
  pendingFlow:
    | ''
    | 'caso7-ask-cambio'
    | 'caso7-await-display'
    | 'numeric-code-ask-letters'
    | 'numeric-code-await-answer'
    | 'caso6-ask-podido-lavar'
    | 'caso6-ask-relato'
    | 'caso6-ask-4-digitos'
    | 'caso6-ask-captura'
    | 'caso17-ask-photo'
    | 'caso17-await-photo'
    | 'caso8-ask-code'
    | 'caso8-await-code'
    | 'caso8-await-name'
    | 'caso8-await-pueblo'
    | 'caso8-await-machine-number'
    | 'caso8-await-puerta'
    | 'caso4-ask-cambio'
    | 'caso4-await-cambio'
    | 'caso4-await-confirmation'
    | 'caso9-ask-lavanderia'
    | 'caso9-ask-machine-type'
    | 'caso9-ask-razon-social'
    | 'caso9-ask-direccion'
    | 'caso9-ask-cif'
    | 'caso9-ask-fecha'
    | 'caso9-ask-email'
    | 'caso9-ask-name'
}
