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
  // Snapshot of `displayState` taken at the very start of the current turn,
  // BEFORE autoExtractFacts runs. Lets guards that fire on "user reports a
  // failure" (post-instruction-failure-reask) detect the case where the
  // customer ALSO volunteered a NEW display token in the same message
  // (e.g. "No, ahora aparece PUSH PROG"): if `displayState !==
  // displayStateAtTurnStart`, the customer is signalling a display change,
  // not just a failure → pivot to the new flow instead of re-asking.
  // Reset every turn at the top of agentTurn (agent.ts).
  displayStateAtTurnStart: string
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
  // 'resolved'    — case closed by markResolved (machine works).
  // 'escalated'   — case handed over to a human operator (operatorHandoffFinal appended).
  // 'refund-form' — case closed via refund flow (Caso 6.1 Sí branch): the bot asks
  //                 the name, then closes with a refund-form message. NO operator
  //                 handover line, NO "Human Support message" summary.
  pendingClosure: 'resolved' | 'escalated' | 'refund-form' | null
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
  // Counts how many times guardForceDisplay has asked for the display code
  // without the customer providing one we could recognise (autoExtractFacts
  // returned no match). Drives the unrecognised-display retry path:
  //   0 → first ask: "qué aparece en pantalla"
  //   1 → second ask: "no reconozco ese código, ¿podrías comprobarlo nuevamente?"
  //   ≥2 → escalate (asks the customer name and hands off to operator)
  // Reset to 0 by resetMachineFacts and when displayState is finally captured.
  displayAskAttempts: number
  // Caso 6 step 4 — counts invalid replies to "últimos 4 dígitos de la tarjeta".
  // The customer must give exactly 4 digits (e.g. "4821"); if they type 3, 5,
  // or non-digit text, the guard re-asks. After 2 invalid attempts, the case
  // is escalated to a human operator.
  //   0 → not yet asked OR last reply was valid (counter reset on success)
  //   1 → first invalid → re-ask "necesito exactamente 4 dígitos…"
  //   ≥2 → escalate
  // Reset to 0 by resetMachineFacts.
  cardDigitsAskAttempts: number
  // Counts how many times guardForceMachineNumber has asked for the machine
  // number without the customer providing one. Same retry+escalate pattern
  // as displayAskAttempts:
  //   0 → first ask "¿qué número tiene la lavadora/secadora?"
  //   1 → second ask with hint ("el número está pegado en la máquina")
  //   ≥2 → escalate
  // Reset to 0 by resetMachineFacts and when machineNumber is finally captured.
  machineNumberAskAttempts: number
  // Customer-facing display label preserved verbatim from what the customer
  // typed. While `displayState` is the *canonical* token (e.g. "PUSH" — used
  // by the flow engine for routing), `displayLabel` keeps the original
  // wording (e.g. "PUSH PROG") so the operator handover summary shows
  // exactly what the customer reported. Empty string when unknown.
  // REGRESSION (Andrea, 2026-05-09): the operator was reading "La pantalla
  // muestra PUSH" while the customer had clearly typed "PUSH PROG", because
  // the canonical extractor collapsed the trailing word.
  displayLabel: string
  // Counts how many invalid attempts the customer has made when typing the
  // discount code (Caso 8). The format is `^[A-Z]{3}\d{6}\d+$`. The retry
  // ladder is:
  //   0 → first ask: "¿podrías indicarme el código exacto?"
  //   1 → first invalid → re-ask: "no encaja con el formato, ¿podrías escribirlo de nuevo?"
  //   ≥2 → escalate to operator
  // Reset by resetMachineFacts and on a successful parse.
  // REGRESSION (Andrea, 2026-05-09): the customer typed "xxjdse7" and the
  // bot escalated immediately without giving a chance to retype.
  discountCodeAskAttempts: number
  // Counts how many times the bot has asked "¿lavadora o secadora?" inside
  // the double-charge YES branch without the customer providing a recognisable
  // type. Same 3-strikes ladder as displayAskAttempts.
  //   0 → first ask "¿lavadora o secadora?"
  //   1 → second ask with hint ("fíjate en la etiqueta — L lavadora, S secadora")
  //   ≥2 → escalate to operator
  // Reset to 0 by resetMachineFacts and when machineType is finally captured.
  machineTypeAskAttempts: number
  // Counts how many times the bot has asked "¿cómo te llamas?" inside ANY
  // closure flow (refund-form / discount-code / future flows) without the
  // customer providing a valid name. Iron rule #10 corollary — every
  // gather step has a 3-strikes retry+escalate ladder, including the
  // terminal name capture.
  //   0 → first ask "¿cómo te llamas?" (canonical key customerNameAsk)
  //   1 → second ask "¿cómo te llamas?" (counter increments)
  //   ≥2 → escalate to operator (the customer is unable to provide a name,
  //         we cannot keep looping)
  // Shared counter across flows on purpose: the ladder is about the
  // customer's ability to reply with a valid name, not about the specific
  // case — and at most one closure flow is active per turn.
  // Reset to 0 by captureCustomerName (state-transitions.ts) and by
  // resetForNewIncident.
  awaitNameAskAttempts: number
  pendingFlow:
    | ''
    | 'display-reask-pending'
    | 'numeric-code-ask-letters'
    | 'numeric-code-await-answer'
    | 'double-charge-ask-used'
    | 'double-charge-ask-type'
    | 'double-charge-ask-number'
    | 'double-charge-ask-narrative'
    | 'double-charge-ask-card-digits'
    | 'double-charge-ask-receipt'
    | 'double-charge-await-name'
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
