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
  // Branch-router architecture (target — see docs/branch-router-architecture.md):
  //   activeBranch: the branch chosen by the router at T1, sticky across turns.
  //                 null when the legacy guard pipeline is in use.
  //   previousBranch: when a topic-switch happens (T2+ message goes off-topic),
  //                   the previous branch is stashed here so the conversation
  //                   can resume after answering the off-topic question.
  activeBranch:
    | 'greeting'
    | 'faq'
    | 'trouble-machine'
    | 'invoice'
    | 'loyalty'
    | 'escalation'
    | 'unknown'
    | null
  previousBranch:
    | 'greeting'
    | 'faq'
    | 'trouble-machine'
    | 'invoice'
    | 'loyalty'
    | 'escalation'
    | 'unknown'
    | null
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
  // Invoice request — multi-step invoice data collection. Filled progressively as the
  // bot asks each question. Sent to the operator via escalation summary.
  invoiceData: {
    razonSocial: string
    direccion: string
    cif: string
    fecha: string       // raw text as typed by the customer
    fechaIso: string    // normalized YYYY-MM-DD when parseable, else ''
    email: string
  }
  // Discount code — discount code parsed from `state.faqCodeValue` once the format
  // SAU2904266 (3 letters + DDMMYY + amount) is validated.
  discountCodeData: {
    letters: string
    fechaIso: string    // YYYY-MM-DD when format is valid, else ''
    importe: string     // raw amount as typed
    doorClosed: boolean | null
  }
  // Pending multi-turn flow markers used by the agent's deterministic guards.
  // Saved displayState at the moment Phase B of guardPostInstructionFailure fired.
  // Lets Phase C detect a genuine display change even after autoExtractFacts has
  // already updated state.displayState for the current turn.
  displayReaskPrevCode: string
  pendingFlow:
    | ''
    | 'paid-not-used-ask-change'
    | 'paid-not-used-await-display'
    | 'display-reask-pending'
    | 'numeric-code-ask-letters'
    | 'numeric-code-await-answer'
    | 'double-charge-ask-used'
    | 'double-charge-ask-narrative'
    | 'double-charge-ask-card-digits'
    | 'double-charge-ask-receipt'
    | 'photo-await-decision'
    | 'photo-await-confirmation'
    | 'discount-code-ask'
    | 'discount-code-await'
    | 'discount-code-await-name'
    | 'discount-code-await-location'
    | 'discount-code-await-machine'
    | 'discount-code-await-door'
    | 'no-change-ask'
    | 'no-change-await-confirm'
    | 'no-change-await-confirmation'
    | 'invoice-ask-location'
    | 'invoice-ask-machine-type'
    | 'invoice-ask-company-name'
    | 'invoice-ask-address'
    | 'invoice-ask-tax-id'
    | 'invoice-ask-date'
    | 'invoice-ask-email'
    | 'invoice-ask-name'
}
