// PRINCIPLE — NO HARDCODED KEYWORD MATCHING.
// All intent classification, language detection, FAQ selection, specialist routing,
// translation and history rendering go through the LLM, never through regex on the
// customer message. Regex on the customer message cannot cover all the languages
// and phrasings the chatbot must support, and would silently fail in multilingual cases.
// Local keyword detection is allowed ONLY for non-linguistic, deterministic tokens
// already enumerated by the device (e.g. exact display codes like SEL, PUSH, ALM/A,
// AL001) or for numeric/yes-no inputs in flow CHOICE nodes.

import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Utilities
import { createInitialState, pushDebug, type SessionState } from './utils/state.js'
import { sanitizeCustomerReply } from './utils/message-parsing.js'
import { printCliBanner, printCliMessage, printDebug } from './utils/cli.js'
import { loadRuntime, type Runtime } from './utils/runtime.js'
import { buildEscalationSummary, extractEscalationContext } from './utils/escalation.js'
import { API_KEY } from './utils/llm.js'
import { preprocessUserInput } from './utils/preprocess.js'
import {
  extractDisplayState,
  extractUnknownDisplayCode,
  isPaidButNotActivatedCase,
  hasTroubleshootingIntent,
  hasDoubleChargeConcern,
  hasNoFoamConcern,
  hasTechnicalIssueIntent,
  detectLanguageHeuristic,
  getRequestedLanguage,
  isShortContextReply,
  isClosureAcknowledgement,
  detectNonTroubleshootingIncident,
} from './utils/intent.js'
import { resolveLanguage, detectLanguage } from './utils/llm.js'
import {
  normalizeConfirmation,
  advanceActiveFlow,
  startFlow,
} from './utils/flow-engine.js'
import {
  applyContextualRouterFallback,
  normalizeRouterDecision,
  normalizeSpecialistDecision,
  applySpecialistFallback,
  mergeFactsIntoState,
  runRouter,
  runSpecialist,
} from './utils/router.js'
import { buildDoubleChargeStepDecision } from './utils/double-charge.js'
import { detectFaqIntent, buildFaqReply, isEscalatingFaqIntent, advanceDiscountCodeFlow } from './utils/faq-intents.js'
import {
  chooseFaqSource,
  renderHistory,
  createSystemRouterDecision,
  renderCustomerFacingSystemMessage,
} from './utils/response.js'
import {
  fallbackBlockedMessage,
  getNameQuestion,
  getTroubleshootingBlockingMissingFacts,
  getTroubleshootingIdentityMissingFacts,
  applyMachineSpecificMissingQuestion,
  pickSingleMissingFact,
} from './utils/missing-facts.js'
import { normalizeForRegression } from './utils/text.js'
import { runScripted as runScriptedEval, runRegressionSuite } from './evaluator/regression.js'
import { runUsecaseSuite } from './evaluator/suite.js'
import type { TurnResult, ScriptedScenario } from './utils/types.js'

// Load OPENROUTER_API_KEY (and any other secrets) from the .env file
// next to this script, so the key is never committed in source code.
try {
  const __envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env')
  process.loadEnvFile(__envFile)
} catch {
  // .env is optional; if missing, env vars must already be set in the shell
}

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2))
const DEBUG_MODE = args.has('--debug')
const SCRIPTED_MODE = args.has('--scripted')
const VERIFY_MODE = args.has('--verify')
const USECASES_MODE = args.has('--usecases') || args.has('--usecase') || args.has('--usecase-range')
const USECASE_NUM = (() => {
  const idx = process.argv.indexOf('--usecase')
  return idx !== -1 ? parseInt(process.argv[idx + 1] ?? '0', 10) : null
})()
const USECASE_RANGE = (() => {
  const idx = process.argv.indexOf('--usecase-range')
  const raw = idx !== -1 ? (process.argv[idx + 1] ?? '').trim() : ''
  if (!raw) return null
  const match = raw.match(/^(\d+)\s*[-.]\s*(\d+)$/) || raw.match(/^(\d+)\s*\.\.\s*(\d+)$/)
  if (!match) return null
  const start = parseInt(match[1], 10)
  const end = parseInt(match[2], 10)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1 || end < start) return null
  return { start, end }
})()

process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0)
  throw error
})

// ── Scripted scenarios ────────────────────────────────────────────────────────

const SCRIPTED_SCENARIOS: ScriptedScenario[] = [
  { name: 'washer-sel-start', turns: ['Ciao', 'lavatrice', '3', 'sì ho pagato', 'SEL', 'risolto'] },
  { name: 'washer-alm', turns: ['lavatrice 4, display ALM', 'water', 'ok risolto'] },
  { name: 'washer-post-cycle-wet', turns: ['ho finito il lavaggio ma i vestiti sono ancora bagnati', 'no', 'ok'] },
  { name: 'dryer-door', turns: ['asciugatrice 7, ho pagato, display DOOR', 'ora funziona'] },
  { name: 'dryer-filter', turns: ['asciugatrice mostra FILTRO', 'fatto'] },
  { name: 'faq-during-flow', turns: ['lavatrice 2', 'quanto costa il lavaggio a 40°?'] },
  { name: 'language-switch-spanish', turns: ['hola, la lavadora no funciona', '3', 'sí', 'SEL'] },
  { name: 'washer-paid-no-start-order', turns: ['Goya', 'lavatrice', '3', 'ho messo i soldi ma non parte', 'PUSH'] },
  { name: 'washer-direct-price-display', turns: ['lavatrice 5, display 12.00'] },
  { name: 'washer-occupied-machine-policy', turns: ['la lavadora de otra persona ha terminado pero sigue ocupando la máquina'] },
  { name: 'dryer-soaking-wet-clothes', turns: ['asciugatrice 7', 'sì ho pagato', 'i vestiti sono usciti fradici dalla lavatrice', 'yes'] },
  { name: 'dryer-burnt-clothes', turns: ['asciugatrice 2', 'dopo il secado la ropa ha salido quemada'] },
  { name: 'washer-extra-profit-plus', turns: ['Goya', 'lavatrice', '3', 'sì ho pagato', 'algún botón EXTRA tiene la luz fija', 'no'] },
  { name: 'washer-stop-first-time', turns: ['Goya', 'lavatrice', '3', 'he pulsado STOP para cambiar el programa', 'no', 'yes'] },
  { name: 'washer-alarm-persists', turns: ['Goya', 'lavatrice', '4', 'sì ho pagato', 'ALM/E', 'no', 'nothing changed'] },
]

// ── Main turn handler ─────────────────────────────────────────────────────────

export async function handleTurn(
  runtime: Runtime,
  state: SessionState,
  userMessage: string,
): Promise<TurnResult> {
  state.turnCount = (state.turnCount ?? 0) + 1
  const debug: string[] = []

  if (state.pendingClosure && isClosureAcknowledgement(userMessage)) {
    const closureKind = state.pendingClosure
    state.pendingClosure = null
    const { message: reply, safe } = await renderHistory(runtime, state, {
      routerDecision: createSystemRouterDecision(),
      action: 'closureAck',
      closureKind,
    })
    pushDebug(debug, 'closure.ack', { closureKind, reply, safe })
    return { reply: sanitizeCustomerReply(safe ? reply : fallbackBlockedMessage(state.language)), debug }
  }

  if (state.pendingClosure && !state.customerNameRequested) {
    state.pendingClosure = null
  }

  const normalizedUserMessage = preprocessUserInput(state, userMessage)
  pushDebug(debug, 'normalizedInput', normalizedUserMessage)

  // Case 4.3: detect unknown display code early to avoid asking display state again
  if (!state.displayState && state.turnCount <= 2) {
    const earlyUnknownCode = extractUnknownDisplayCode(userMessage)
    if (earlyUnknownCode) {
      state.displayState = earlyUnknownCode
      pushDebug(debug, 'earlyUnknownCode', earlyUnknownCode)
    }
  }

  // Detect non-troubleshooting incidents (UC19-24, UC26, UC27, UC29) on turn 1.
  // These customer reports DO NOT need machineType/machineNumber/displayState —
  // after capturing only the location, the case escalates with a manual-review
  // message. We persist the kind in state so downstream guards can skip the
  // machine-flow gathering and the LLM can phrase the right escalation reason.
  if (state.turnCount === 1 && !state.nonTroubleshootingIncident) {
    const incidentKind = detectNonTroubleshootingIncident(userMessage)
    if (incidentKind) {
      state.nonTroubleshootingIncident = incidentKind
      state.issueSummary = state.issueSummary || `${incidentKind}: ${userMessage.trim()}`
      pushDebug(debug, 'nonTroubleshootingIncident', incidentKind)
    }
  }

  // Mataró-specific: if location is Mataró, ask for street (only there)
  if (state.locationStreetRequested && !state.locationStreet) {
    state.locationStreet = userMessage.trim()
    pushDebug(debug, 'mataro.street.captured', state.locationStreet)
  }

  // Case-4 deterministic top check: all facts collected, handle paid-but-not-activated BEFORE router runs.
  // - If unknown display code present (LLM or preprocessor extracted it): escalate immediately (scenario 4.3)
  // - If no display code at all: ask about central change (scenarios 4.1 / 4.2)
  // - If known display code (SEL, PUSH, etc.): fall through to normal LLM router (cases 1-3)
  if (
    state.paymentCompleted === true &&
    state.machineType &&
    state.machineNumber &&
    state.location &&
    !state.lastMissingFacts.includes('central change returned or not') &&
    !state.lastMissingFacts.includes('activated after central balance review') &&
    !state.customerNameRequested &&
    !state.operatorRequested
  ) {
    const unknownCode =
      (state.displayState ? extractUnknownDisplayCode(state.displayState) : null) ||
      extractUnknownDisplayCode(state.issueSummary || '') ||
      extractUnknownDisplayCode(userMessage)
    if (unknownCode) {
      state.customerNameRequested = true
      state.issueSummary = state.issueSummary || `Código desconocido ${unknownCode} tras el pago; la máquina no se ha activado.`
      state.escalationReason = `Unknown display code ${unknownCode} after payment completed.`
      return {
        reply: `⚠️ El código ${unknownCode} no está documentado. Tenemos que notificar al operador para que revise el caso.\n\n${getNameQuestion(state.language)}`,
        debug,
      }
    }
    if (!state.displayState) {
      state.lastMissingFacts = ['central change returned or not']
      return { reply: '¿La central ha devuelto el cambio?', debug }
    }
  }

  if (state.lastMissingFacts.includes('central change returned or not')) {
    // If the customer reveals they paid with CARD (no coins), the "did the
    // central return change?" question doesn't apply — there's no change to
    // return. Skip it and ask the display state instead. Multilingua note:
    // covers Spanish / Italian / English roots that all share "tarj" or
    // "carta" or "card"; kept narrow to avoid false positives on unrelated
    // sentences.
    const m = normalizedUserMessage.toLowerCase()
    const paidWithCard = /\b(?:con\s+)?(?:la\s+)?(?:tarjeta|carta(?:\s+de\s+(?:cr[eé]dito|d[eé]bito))?|card)\b/.test(m)
    if (paidWithCard) {
      state.paymentMethod = 'card'
      state.lastMissingFacts = []
      pushDebug(debug, 'paymentMethod', 'card')
      return { reply: '¿Qué aparece exactamente en la pantalla de la lavadora?', debug }
    }
    const confirmation = normalizeConfirmation(normalizedUserMessage)
    if (confirmation === 'NO') {
      state.lastMissingFacts = ['activated after central balance review']
      return {
        reply: 'Es posible que se haya marcado mal el número de máquina. Revisa, por favor, el saldo en la central y prueba otra vez con el número correcto. Dime si la máquina ya se ha activado.',
        debug,
      }
    }
  }

  if (state.lastMissingFacts.includes('activated after central balance review')) {
    const confirmation = normalizeConfirmation(normalizedUserMessage)
    const stillNotActivated = confirmation === 'NO' || (confirmation === null && hasTechnicalIssueIntent(normalizedUserMessage))

    if (confirmation === 'YES') {
      state.pendingClosure = 'resolved'
      state.activeFlowId = null
      state.activeStepId = null
      state.lastMissingFacts = []
      return { reply: '✅ Perfecto. La máquina ha arrancado correctamente.', debug }
    }

    if (stillNotActivated) {
      state.lastMissingFacts = []
      state.customerNameRequested = true
      state.issueSummary = 'La máquina sigue sin activarse tras revisar el saldo en la central.'
      state.escalationReason = 'Machine still not activated after central balance review.'
      return {
        reply: `⚠️ Vamos a notificar al operador para revisar el caso. Pero antes dime qué te pone en la pantalla de la central de pago, y en la pantalla de la máquina, para que te dirija a la persona adecuada.\n\n${getNameQuestion(state.language)}`,
        debug,
      }
    }
  }

  // Deterministic washer happy-path close — when user confirms machine is now working and there is an active washer flow
  // NOTE: ^(si|sí)\s*$  matches ONLY a standalone "sí"/"si" (nothing after it).
  // We intentionally do NOT match "sí, [anything]" here because "Sí, bastante"
  // (answering a CONFIRMATION about clothes) would fire a false closure.
  // "Sí, ya funciona" is covered by the `ya funciona` branch below.
  const userConfirmsNowWorking = /^(si|sí)\s*[.!?]*\s*$|ahora funciona|ya funciona|funciona ahora|arranco|arranc[oó]|ha arrancado|ya func|ahora s[ií] funcion|ya s[ií] funcion/.test(
    normalizeForRegression(normalizedUserMessage),
  )
  if (
    state.machineType === 'washer' &&
    state.activeFlowId &&
    userConfirmsNowWorking &&
    !state.customerNameRequested &&
    !state.operatorRequested
  ) {
    state.pendingClosure = 'resolved'
    state.activeFlowId = null
    state.activeStepId = null
    return { reply: '✅ Perfecto. La lavadora ha comenzado correctamente.', debug }
  }

  if (state.customerNameRequested && !state.customerName && normalizedUserMessage.length > 0) {
    state.customerName = normalizedUserMessage.trim().split(/\s+/)[0]
    state.customerNameRequested = false

    // Case 6.1 resolved path: name collected, no escalation
    if (state.pendingClosure === 'resolved') {
      const resolvedRouterDecision = createSystemRouterDecision({
        route: 'chat',
        nextOwner: 'conversation_history',
        functionName: null,
        escalationReason: null,
        customerFacingGoal: `Confirm warmly to ${state.customerName} that all required data has been received. You MUST include the word "revisar" in infinitive form (e.g. "vamos a revisar tu caso"). Let the customer know a refund form will be sent. Add a brief tip: next time contact support before re-paying. Do NOT use the words "operador" or "desactivado".`,
      })
      const { message, safe } = await renderHistory(runtime, state, { routerDecision: resolvedRouterDecision })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }

    // Case 6.2/6.3 escalation path
    state.operatorRequested = true
    if (!state.escalationReason) state.escalationReason = 'Manual review requested.'
    const escalationRouterDecision = createSystemRouterDecision({
      route: 'operator',
      nextOwner: 'conversation_history',
      functionName: 'contactOperator',
      escalationReason: state.escalationReason,
      customerFacingGoal: 'Confirm escalation to a human operator and that the chatbot is now disabled.',
    })
    const finalReply = await renderCustomerFacingSystemMessage(runtime, state, {
      routerDecision: escalationRouterDecision,
      action: 'contactOperator',
    })
    state.pendingClosure = 'escalated'
    const escalationContext = extractEscalationContext(state, state.customerName)
    const operatorSummary = buildEscalationSummary(escalationContext)
    pushDebug(debug, 'escalation.withName', { finalReply, operatorSummary })
    const deterministicEscalationReply = state.language === 'es'
      ? `Gracias ${state.customerName}, vamos a revisar tu caso manualmente. Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?`
      : sanitizeCustomerReply(finalReply)
    return { reply: `${deterministicEscalationReply}\n\n**👤 Human Support message**\n${operatorSummary}`, debug }
  }

  const requestedLanguage = getRequestedLanguage(userMessage)
  const heuristicLanguage = detectLanguageHeuristic(userMessage)
  if (requestedLanguage) {
    state.preferredLanguage = resolveLanguage(requestedLanguage, runtime.settings)
    state.language = state.preferredLanguage
  }

  if (state.preferredLanguage) {
    state.language = resolveLanguage(state.preferredLanguage, runtime.settings)
    state.preferredLanguage = state.language
  } else {
    if (heuristicLanguage) {
      state.language = resolveLanguage(heuristicLanguage, runtime.settings)
    } else if (state.turnCount > 1 && state.language) {
      state.language = state.language || runtime.settings.defaultLanguage
    } else if (isShortContextReply(userMessage) && state.language) {
      state.language = state.language || runtime.settings.defaultLanguage
    } else {
      const detected = await detectLanguage(runtime, userMessage)
      state.language = resolveLanguage(detected, runtime.settings)
    }
    state.preferredLanguage = state.language
  }
  pushDebug(debug, 'language', state.language)

  // ── FAQ-style intent early return (cases 8-13) ──────────────────────────────
  // Multilang regex detector for non-troubleshooting intents (discount code,
  // invoice, loyalty card buy/recharge, hours/prices, alarm code).
  // Only triggers on turn 1 OR when no active conversation context, to avoid
  // hijacking the troubleshooting flows of cases 1-7 mid-conversation.

    // ── Discount-code multi-turn flow (case 8) ───────────────────────────────────
    // If the customer is already in the discount-code flow, advance the step
    // regardless of what the message says (the flow drives the conversation).
    if (state.activeFaqFlow === 'discount-code' && state.faqStep >= 1) {
      const result = advanceDiscountCodeFlow(state, userMessage)
      const stepDecision = createSystemRouterDecision({
        route: result.escalate ? 'operator' : 'faq',
        nextOwner: 'conversation_history',
        functionName: result.escalate ? 'contactOperator' : null,
        customerFacingGoal: result.reply,
      })
      if (result.escalate) {
        state.customerNameRequested = true
        state.escalationReason = state.escalationReason || `Codice non risolto: ${state.faqCodeValue}`
        state.issueSummary = state.issueSummary || `Discount code issue: ${state.faqCodeValue} @ ${state.location}`
      }
      if (result.done) {
        state.activeFaqFlow = null
        state.faqStep = 0
      }
      pushDebug(debug, 'discountCodeFlow', { step: state.faqStep, escalate: result.escalate, done: result.done })
      const { message, safe } = await renderHistory(runtime, state, { routerDecision: stepDecision })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }

    if (state.turnCount === 1 || (!state.location && !state.machineType && !state.activeFlowId)) {
    const faqIntent = detectFaqIntent(userMessage)
    if (faqIntent) {
      const isEscalating = isEscalatingFaqIntent(faqIntent)
      const faqRouterDecision = createSystemRouterDecision({
        route: isEscalating ? 'operator' : 'faq',
        nextOwner: 'conversation_history',
        functionName: isEscalating ? 'contactOperator' : null,
        customerFacingGoal: buildFaqReply(faqIntent, state.turnCount),
      })
      if (isEscalating) {
        state.customerNameRequested = true
        state.escalationReason = state.escalationReason || `Alarm code reported: ${userMessage.trim()}`
        state.issueSummary = state.issueSummary || `Alarm/incoherence: ${userMessage.trim()}`
      }
        // Start multi-turn tracking for discount-code
        if (faqIntent === 'discount-code') {
          state.activeFaqFlow = 'discount-code'
          state.faqStep = 1
        }
      pushDebug(debug, 'faqIntent', { faqIntent, isEscalating })
      const { message, safe } = await renderHistory(runtime, state, { routerDecision: faqRouterDecision })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }
  }

  const routerDecision = applyContextualRouterFallback(
    normalizeRouterDecision(await runRouter(runtime, state, normalizedUserMessage), state),
    state,
    userMessage,
    normalizedUserMessage,
  )
  const isDoubleChargeCase =
    hasDoubleChargeConcern(userMessage) ||
    /double charge/i.test(String(routerDecision.extractedFacts?.issueSummary || state.issueSummary || '')) ||
    state.lastMissingFacts.some((fact) =>
      ['service completed or not', 'double charge step by step', 'last 4 card digits', 'payment proof'].includes(fact),
    )

  if (isDoubleChargeCase) {
    Object.assign(routerDecision, buildDoubleChargeStepDecision(routerDecision, state, userMessage))
  }

  if (hasNoFoamConcern(userMessage)) {
    routerDecision.route = 'faq'
    routerDecision.nextOwner = 'conversation_history'
    routerDecision.functionName = null
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal = 'Answer the no-foam detergent question directly without technical troubleshooting or gather.'
  }

  if (
    !state.location &&
    !state.activeFlowId &&
    routerDecision.route !== 'faq' &&
    !isDoubleChargeCase &&
    hasTroubleshootingIntent(normalizedUserMessage)
  ) {
    const routeMachineType = routerDecision.route === 'washer' || routerDecision.route === 'dryer'
      ? routerDecision.route
      : state.machineType
    const displayAlreadyProvided = Boolean(routerDecision.extractedFacts?.displayState || state.displayState)

    if (!(routeMachineType && displayAlreadyProvided)) {
      routerDecision.functionName = null
      routerDecision.missingFacts = ['location']
      routerDecision.customerFacingGoal = 'Ask only the exact address (city and street) of the lavandería autoservicio where the customer is, before continuing the technical troubleshooting.'
    }
  }

  if (!isDoubleChargeCase) {
    Object.assign(routerDecision, applyMachineSpecificMissingQuestion(routerDecision, state))
  }

  if (routerDecision.route === 'greeting') {
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal = 'Greet the customer, present yourself briefly, and ask the most useful next question.'
  }

  // If a non-troubleshooting incident was detected but we still don't have the
  // location, ask for the location FIRST (not the display state). The forced
  // escalation block below will then fire on the next turn and produce the
  // "vamos a revisar" message — without ever entering machine-flow gathering.
  if (state.turnCount === 1 && state.nonTroubleshootingIncident && !state.location) {
    routerDecision.missingFacts = ['location']
    routerDecision.customerFacingGoal =
      'Greet the customer warmly as the laundry virtual assistant. Acknowledge briefly the issue they described and ask only which lavandería autoservicio (ciudad y calle) they are at. Do NOT ask machine type, machine number, or display state.'
  }

  // Turn 1 (technical issue): greet warmly and ALWAYS ask the local first.
  // The display state is the most informative fact for routing the fix, but the
  // playbook (and Andrea's spec) requires identifying the local before
  // proceeding. If the customer already gave the display code in their first
  // message (e.g. "pone ALM DOOR"), capture it silently into extractedFacts so
  // we don't re-ask later — but still ask for the local now.
  if (state.turnCount === 1 && !state.location && (hasTroubleshootingIntent(normalizedUserMessage) || Boolean(extractDisplayState(userMessage)))) {
    const displayInMessage = extractDisplayState(userMessage)
    routerDecision.missingFacts = ['location']
    routerDecision.customerFacingGoal =
      'Greet the customer warmly as the laundry virtual assistant (use "asistente virtual de la lavandería"). Then ask only which lavandería autoservicio (ciudad y calle) the customer is at.'
    routerDecision.extractedFacts = {
      ...(routerDecision.extractedFacts || {}),
      displayState: displayInMessage || routerDecision.extractedFacts?.displayState || '',
      machineType: routerDecision.extractedFacts?.machineType || '',
    }
  }

  // Display states that escalate directly (AL001, ALN, undocumented codes
  // like ERR 52). For these, after gathering location the documented flow is
  // to escalate — no need to keep asking machineType / machineNumber, since
  // the operator does manual review regardless of the machine identity.
  const escalateDirectlyDisplayStates = new Set(['AL001', 'ALN'])
  const displayStateIsEscalateOnly =
    escalateDirectlyDisplayStates.has(state.displayState.toUpperCase()) ||
    Boolean(extractUnknownDisplayCode(state.displayState))

  // Same idea: when a non-troubleshooting incident was detected on turn 1
  // (card payment fails, datáfono wrong amount, dryer minutes not credited,
  // refund/compensation demand, cameras/AJAX), skip machine-flow gathering.
  const isNonTroubleshootingIncident = Boolean(state.nonTroubleshootingIncident)
  const skipMachineGathering = displayStateIsEscalateOnly || isNonTroubleshootingIncident

  if (
    state.turnCount > 1 &&
    state.location &&
    !state.machineType &&
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    !skipMachineGathering &&
    !state.operatorRequested &&
    !state.customerNameRequested &&
    state.pendingClosure !== 'escalated' &&
    state.pendingClosure !== 'resolved' &&
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'operator' &&
    routerDecision.route !== 'reset'
  ) {
    routerDecision.route = 'unknown'
    routerDecision.missingFacts = ['machine type']
    routerDecision.customerFacingGoal = 'Do not greet again. Ask only whether it is a washer or a dryer.'
  }

  // Andrea's playbook order: after location + machineType, ALWAYS ask the
  // machine number BEFORE the display state. The router LLM tends to skip the
  // machine-number step and jump to display, so guard it deterministically.
  if (
    state.turnCount > 1 &&
    state.location &&
    state.machineType &&
    !state.machineNumber &&
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    !skipMachineGathering &&
    !state.operatorRequested &&
    !state.customerNameRequested &&
    state.pendingClosure !== 'escalated' &&
    state.pendingClosure !== 'resolved' &&
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'operator' &&
    routerDecision.route !== 'reset'
  ) {
    routerDecision.missingFacts = ['machine number']
    routerDecision.customerFacingGoal = 'Do not greet again. Ask only the machine number.'
  }

  // Fallback for non-troubleshooting incidents where the customer is unable
  // or unwilling to give the local: after 2 turns without a location, escalate
  // anyway with a manual-review message. This covers UC22/UC24/UC29 where the
  // customer answered "Sí" / "Vale" without naming the local explicitly.
  if (
    isNonTroubleshootingIncident &&
    !state.location &&
    state.turnCount >= 2 &&
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    !state.operatorRequested &&
    !state.customerNameRequested
  ) {
    routerDecision.route = 'operator'
    routerDecision.functionName = 'contactOperator'
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal =
      `The customer described a non-troubleshooting incident (${state.nonTroubleshootingIncident}) but has not been able to identify the local after several attempts. Acknowledge calmly and tell them the case will be revisado manually. The reply MUST include the verb "revisar" or noun "revisión". Use a calm tone.`
  }

  // Same fallback for double-charge cases where the customer's narrative is
  // contradictory or they cannot identify the local (UC28). After 2+ turns
  // without a location, escalate to manual review with a "revisar" message.
  if (
    isDoubleChargeCase &&
    !state.location &&
    state.turnCount >= 2 &&
    !state.activeFlowId &&
    !state.operatorRequested &&
    !state.customerNameRequested
  ) {
    routerDecision.route = 'operator'
    routerDecision.functionName = 'contactOperator'
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal =
      'The customer reports a double charge but cannot identify the local or provides a contradictory narrative. Acknowledge calmly and tell them the case has to be revisado manually. The reply MUST include the verb "revisar" or noun "revisión".'
  }

  // Once location is known and either (a) the displayState is escalate-only,
  // or (b) a non-troubleshooting incident was detected on turn 1, force the
  // operator route. This produces a calm "vamos a revisar" message and skips
  // any further machine-flow gathering.
  // For non-troubleshooting incidents we allow turn>=1 (the customer's first
  // message may already include the local, e.g. "Estoy en Goya y..."); for
  // escalate-only displays we keep turn>2 to avoid hijacking flows
  // mid-conversation (e.g. case_door check_result).
  const turnCountThresholdMet = isNonTroubleshootingIncident
    ? state.turnCount >= 1
    : state.turnCount > 2
  if (
    turnCountThresholdMet &&
    state.location &&
    (displayStateIsEscalateOnly || isNonTroubleshootingIncident) &&
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    !state.operatorRequested &&
    !state.customerNameRequested &&
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'reset' &&
    !routerDecision.missingFacts.includes('exact display state')
  ) {
    routerDecision.route = 'operator'
    routerDecision.functionName = 'contactOperator'
    routerDecision.missingFacts = []
    const reasonLabel = displayStateIsEscalateOnly
      ? `the display code "${state.displayState}"`
      : `the customer's report (${state.nonTroubleshootingIncident})`
    routerDecision.customerFacingGoal =
      `Acknowledge ${reasonLabel} and tell the customer the case has to be reviewed manually. The reply MUST include the verb "revisar" or the noun "revisión" naturally. Do not ask machineType, machineNumber, or displayState. Use a calm, reassuring tone. End with a brief reassuring closing.`
  }

  if (
    !state.location &&
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'greeting' &&
    routerDecision.missingFacts.length > 0
  ) {
    const isTroubleshootingRoute = routerDecision.route === 'washer' || routerDecision.route === 'dryer'
    const displayFirstStillNeeded = routerDecision.missingFacts.includes('exact display state')
    if (!(isTroubleshootingRoute && displayFirstStillNeeded)) {
      routerDecision.missingFacts = ['location']
      routerDecision.customerFacingGoal = 'Greet the customer warmly as the laundry virtual assistant (start with "¡Hola! Soy el asistente virtual de la lavandería"). Then ask only the exact address (city and street) of the lavandería autoservicio where the customer is.'
    }
  } else if (
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'greeting' &&
    routerDecision.missingFacts.length > 1
  ) {
    Object.assign(routerDecision, pickSingleMissingFact(routerDecision, state))
  }

  pushDebug(debug, 'router', routerDecision)

  mergeFactsIntoState(state, routerDecision)
  state.lastMissingFacts = routerDecision.missingFacts
  state.lastResolvedIntent = routerDecision.route

  // If location answer contains a comma, split into city and street (user answered both at once)
  if (state.location && !state.locationStreet) {
    const commaIdx = state.location.indexOf(',')
    if (commaIdx > 0) {
      const streetPart = state.location.slice(commaIdx + 1).trim()
      if (streetPart) {
        state.locationStreet = streetPart
        state.location = state.location.slice(0, commaIdx).trim()
        pushDebug(debug, 'location.parsed', { city: state.location, street: state.locationStreet })
      }
    }
  }

  // Mataró-specific: if location is Mataró and we haven't yet asked for the street, ask for it now
  if (
    state.location &&
    /^matar[oó]\b/i.test(state.location.trim()) &&
    !state.locationStreetRequested &&
    !state.locationStreet
  ) {
    state.locationStreetRequested = true
    pushDebug(debug, 'mataro.street.requested', true)
    return { reply: '¿En qué calle de Mataró está la lavandería?', debug }
  }

  // Deterministic machine-type and machine-number questions in Spanish/Catalan
  // Skip when the case has already escalated to operator / closed — otherwise
  // the bot keeps asking machine details after the customer was already handed
  // over to a human operator.
  if (
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    !state.operatorRequested &&
    !state.customerNameRequested &&
    state.pendingClosure !== 'escalated' &&
    state.pendingClosure !== 'resolved'
  ) {
    if (routerDecision.missingFacts[0] === 'machine type' && (state.language === 'es' || state.language === 'ca')) {
      return { reply: '¿Es una lavadora o una secadora?', debug }
    }
    if (
      routerDecision.missingFacts[0] === 'machine number' &&
      !state.activeFlowId &&
      (state.language === 'es' || state.language === 'ca')
    ) {
      const mWord = state.machineType === 'dryer' ? 'secadora' : 'lavadora'
      return { reply: `¿Cuál es el número de la ${mWord}?`, debug }
    }
  }

  // Case 6: Double-charge special handling after state is fully merged
  if (isDoubleChargeCase && routerDecision.functionName === 'contactOperator') {
    const allDataCollected =
      state.location &&
      state.serviceCompleted === true &&
      state.doubleChargeNarrativeProvided &&
      state.last4CardDigitsProvided &&
      state.paymentProofProvided

    if (allDataCollected) {
      if (!state.customerName && !state.customerNameRequested) {
        state.customerNameRequested = true
        state.pendingClosure = 'resolved'
        state.issueSummary = state.issueSummary || 'double charge'
        return {
          reply: `Hemos recibido toda la información necesaria, vamos a revisar tu caso. ${getNameQuestion(state.language)}`,
          debug,
        }
      }
      state.pendingClosure = 'resolved'
      const { message, safe } = await renderHistory(runtime, state, {
        routerDecision: {
          ...routerDecision,
          customerFacingGoal: `Confirm warmly to ${state.customerName ? state.customerName : 'the customer'} that all required data has been received. You MUST include the word "revisar" in infinitive form (e.g. "vamos a revisar tu caso"). Let the customer know a refund form will be sent. Add a brief tip: next time contact support before re-paying. Do NOT use the words "operador" or "desactivado".`,
        },
      })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }

    if (!state.operatorRequested && !state.customerNameRequested) {
      state.customerNameRequested = true
      state.escalationReason = routerDecision.escalationReason || 'Double charge: manual review required.'
      state.issueSummary = state.issueSummary || 'double charge'
      return {
        reply: `⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ${getNameQuestion(state.language)}`,
        debug,
      }
    }
  }

  const shouldAdvanceActiveFlow = Boolean(
    state.activeFlowId &&
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'operator' &&
    routerDecision.route !== 'reset' &&
    !(routerDecision.route === 'washer' && state.machineType === 'dryer') &&
    !(routerDecision.route === 'dryer' && state.machineType === 'washer'),
  )

  if (shouldAdvanceActiveFlow) {
    const flowResult = await advanceActiveFlow(runtime, state, userMessage)
    state.lastPresentedStepId = flowResult.stepId
    state.pendingClosure = flowResult.isTerminal ? (flowResult.action === 'escalate' ? 'escalated' : 'resolved') : null
    pushDebug(debug, 'flow.advance', flowResult)

    // Deterministic washer happy-path close for Spanish — skip LLM to avoid non-determinism
    if (
      flowResult.isTerminal &&
      flowResult.action !== 'escalate' &&
      state.machineType === 'washer' &&
      state.language === 'es'
    ) {
      return { reply: '✅ Perfecto. La lavadora ha comenzado correctamente.', debug }
    }

    const { message, safe } = await renderHistory(runtime, state, { routerDecision, flowEngineResult: flowResult })
    pushDebug(debug, 'history.flow', { message, safe })
    const flowReply = sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language))
    if (flowResult.isTerminal && flowResult.action === 'escalate') {
      if (!state.customerName && !state.customerNameRequested) {
        state.customerNameRequested = true
        state.pendingClosure = null
        const nameQuestion = getNameQuestion(state.language)
        return { reply: `${flowReply}\n\n${nameQuestion}`, debug }
      }
      const escalationContext = extractEscalationContext(state, state.customerName)
      const operatorSummary = buildEscalationSummary(escalationContext)
      return { reply: `${flowReply}\n\n**👤 Human Support message**\n${operatorSummary}`, debug }
    }
    return { reply: flowReply, debug }
  }

  if (routerDecision.functionName === 'resetSession') {
    const language = state.language
    Object.assign(state, createInitialState(), { language })
    const { message } = await renderHistory(runtime, state, { routerDecision, action: 'resetSession' })
    pushDebug(debug, 'history.reset', message)
    return { reply: sanitizeCustomerReply(message), debug }
  }

  if (routerDecision.functionName === 'contactOperator' || routerDecision.route === 'operator') {
    const blockingMissingFacts = hasTroubleshootingIntent(normalizedUserMessage)
      ? getTroubleshootingBlockingMissingFacts(state, normalizedUserMessage)
      : []
    if (blockingMissingFacts.length > 0) {
      const gatedRouterDecision = pickSingleMissingFact({
        ...routerDecision,
        functionName: null,
        route: state.machineType || routerDecision.route,
        missingFacts: blockingMissingFacts,
        customerFacingGoal: 'Ask only the next missing troubleshooting detail before any escalation.',
      }, state)
      const { message, safe } = await renderHistory(runtime, state, { routerDecision: gatedRouterDecision })
      pushDebug(debug, 'history.operatorEscalationBlocked', { missingFact: gatedRouterDecision.missingFacts[0], message, safe })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }

    if (!state.customerName && !state.customerNameRequested) {
      state.customerNameRequested = true
      // Prepend a short reassurance that the case will be revisado manually
      // BEFORE asking for the name. Many use-cases (UC15/UC16/UC23/UC30/...)
      // expect the operator-handover message to include the verb "revisar".
      const reassurance = state.language === 'es' || state.language === 'ca'
        ? '⚠️ Vamos a revisar tu caso manualmente.'
        : ''
      const reply = reassurance
        ? `${reassurance} ${getNameQuestion(state.language)}`
        : getNameQuestion(state.language)
      return { reply, debug }
    }

    state.operatorRequested = true
    state.escalationReason = routerDecision.escalationReason || 'Manual review requested.'
    const { message, safe } = await renderHistory(runtime, state, { routerDecision, action: 'contactOperator' })
    state.pendingClosure = 'escalated'
    const escalationContext = extractEscalationContext(state, state.customerName)
    const operatorSummary = buildEscalationSummary(escalationContext)
    pushDebug(debug, 'history.escalation', { message, safe, operatorSummary })
    const finalReply = sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language))
    return { reply: `${finalReply}\n\n**👤 Human Support message**\n${operatorSummary}`, debug }
  }

  if (routerDecision.route === 'faq') {
    const faqSource = await chooseFaqSource(normalizedUserMessage)
    const { message, safe } = await renderHistory(runtime, state, { routerDecision, faqSource })
    pushDebug(debug, 'faq.source', faqSource)
    pushDebug(debug, 'history.faq', { message, safe })
    return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
  }

  if (routerDecision.route === 'washer' || routerDecision.route === 'dryer') {
    state.machineType = routerDecision.route
    if (routerDecision.extractedFacts.machineNumber) {
      state.machineNumber = String(routerDecision.extractedFacts.machineNumber)
    }

    const unknownDisplayCode = extractUnknownDisplayCode(state.issueSummary || normalizedUserMessage)
    if (
      isPaidButNotActivatedCase(state, state.issueSummary || normalizedUserMessage, state.machineType) &&
      state.location &&
      state.machineNumber
    ) {
      if (unknownDisplayCode) {
        state.customerNameRequested = true
        state.issueSummary = `Código desconocido ${unknownDisplayCode} tras el pago; la máquina no se ha activado.`
        state.escalationReason = `Unknown display code ${unknownDisplayCode} after payment completed.`
        return {
          reply: `⚠️ El código ${unknownDisplayCode} no está documentado. Tenemos que notificar al operador para que revise el caso.\n\n${getNameQuestion(state.language)}`,
          debug,
        }
      }
      if (!state.lastMissingFacts.includes('central change returned or not') && !state.lastMissingFacts.includes('activated after central balance review')) {
        state.lastMissingFacts = ['central change returned or not']
        return { reply: '¿La central ha devuelto el cambio?', debug }
      }
    }

    if (routerDecision.missingFacts.length > 0) {
      const singleMissingRouterDecision = pickSingleMissingFact(routerDecision, state)
      const { message, safe } = await renderHistory(runtime, state, { routerDecision: singleMissingRouterDecision })
      state.pendingClosure = null
      pushDebug(debug, 'history.missing', { askedMissingFact: singleMissingRouterDecision.missingFacts[0], message, safe })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }

    const specialistDecision = applySpecialistFallback(
      normalizeSpecialistDecision(await runSpecialist(runtime, state, normalizedUserMessage), state),
      state,
      userMessage,
    )
    pushDebug(debug, 'specialist', specialistDecision)

    if (specialistDecision.shouldEscalate || !specialistDecision.flowId) {
      const identityMissingFacts = hasTroubleshootingIntent(normalizedUserMessage) ? getTroubleshootingIdentityMissingFacts(state) : []
      if (identityMissingFacts.length > 0) {
        const gatedRouterDecision = pickSingleMissingFact({
          ...routerDecision,
          functionName: null,
          missingFacts: identityMissingFacts,
          customerFacingGoal: 'Ask only the next missing troubleshooting detail before any escalation.',
        }, state)
        const { message, safe } = await renderHistory(runtime, state, { routerDecision: gatedRouterDecision })
        pushDebug(debug, 'history.specialistEscalationBlocked', { missingFact: gatedRouterDecision.missingFacts[0], message, safe })
        return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
      }
      state.escalationReason = specialistDecision.escalationReason || 'Specialist escalation'
      const { message, safe } = await renderHistory(runtime, state, { routerDecision, specialistDecision, action: 'contactOperator' })
      state.pendingClosure = 'escalated'
      pushDebug(debug, 'history.specialistEscalation', { message, safe })
      return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
    }

    const flowResult = startFlow(runtime, state, specialistDecision.flowId)
    if (!state.activeStepId || !state.activeFlowId) {
      throw new Error('Flow could not start correctly')
    }
    state.lastPresentedStepId = flowResult.stepId
    state.pendingClosure = flowResult.isTerminal ? (flowResult.action === 'escalate' ? 'escalated' : 'resolved') : null
    pushDebug(debug, 'flow.start', flowResult)

    // Deterministic PUSH/Pr programs step for Spanish — bypasses LLM to prevent non-determinism
    if (flowResult.stepId === 'case_push' && state.machineType === 'washer' && state.language === 'es') {
      const programsReply = [
        'Presiona un botón de programa para iniciar el lavado.',
        '',
        'Programas:',
        '60º Molt calent -> ropa muy sucia, blanca o de trabajo',
        '40º Calent -> ropa normal (algodón, color)',
        '30º Temperat -> ropa delicada o sintética',
        'Frío -> prendas muy delicadas (lana, seda, etc.)',
        '',
        'Después de intentarlo, házmelo saber si funciona.',
      ].join('\n')
      return { reply: programsReply, debug }
    }

    const { message, safe } = await renderHistory(runtime, state, { routerDecision, specialistDecision, flowEngineResult: flowResult })
    pushDebug(debug, 'history.flowStart', { message, safe })
    return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
  }

  const { message: defaultMessage, safe: defaultSafe } = await renderHistory(runtime, state, { routerDecision })
  pushDebug(debug, 'history.default', { message: defaultMessage, safe: defaultSafe })
  return { reply: sanitizeCustomerReply(defaultSafe ? defaultMessage : fallbackBlockedMessage(state.language)), debug }
}

// ── Interactive REPL ──────────────────────────────────────────────────────────

async function runInteractive(runtime: Runtime): Promise<void> {
  const state = createInitialState()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  printCliBanner('Cliente-0 Interactive Demo', 'Type your message. Use /reset to restart or /exit to quit.')

  while (true) {
    let input = ''
    try {
      input = await rl.question('')
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') break
      throw error
    }
    const trimmed = input.trim()
    if (!trimmed) continue
    if (trimmed === '/exit' || trimmed === '/quit') break
    if (trimmed === '/reset') {
      const language = state.language
      Object.assign(state, createInitialState(), { language })
      const resetMessage = await renderCustomerFacingSystemMessage(runtime, state, {
        routerDecision: createSystemRouterDecision(),
        action: 'resetSession',
      })
      printCliMessage('Bot', resetMessage)
      continue
    }
    try {
      const result = await handleTurn(runtime, state, trimmed)
      printCliMessage('Bot', result.reply)
      if (DEBUG_MODE) printDebug(result.debug)
    } catch (error) {
      printCliMessage('Error', `Demo error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  rl.close()
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const runtime = await loadRuntime()

  if (process.argv.includes('--check')) {
    printCliBanner('Cliente-0 Demo Check', 'Runtime files loaded successfully.')
    printCliMessage('Info', `Loaded prompts: ${Object.keys(runtime.prompts).join(', ')}`)
    printCliMessage('Info', `Washer flows: ${Object.keys(runtime.flows.washer).join(', ')}`)
    printCliMessage('Info', `Dryer flows: ${Object.keys(runtime.flows.dryer).join(', ')}`)
    return
  }

  if (!API_KEY) {
    console.error('OPENROUTER_API_KEY missing. Export it before running the demo.')
    process.exit(1)
  }

  if (SCRIPTED_MODE) {
    await runScriptedEval(runtime, SCRIPTED_SCENARIOS, DEBUG_MODE, handleTurn)
    return
  }

  if (VERIFY_MODE) {
    await runRegressionSuite(runtime, DEBUG_MODE, handleTurn)
    return
  }

  if (USECASES_MODE) {
    await runUsecaseSuite(runtime, DEBUG_MODE, handleTurn, USECASE_NUM, USECASE_RANGE)
    return
  }

  await runInteractive(runtime)
}

function isDirectExecution(): boolean {
  const entryFile = process.argv[1]
  if (!entryFile) return false
  return import.meta.url === pathToFileURL(path.resolve(entryFile)).href
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
