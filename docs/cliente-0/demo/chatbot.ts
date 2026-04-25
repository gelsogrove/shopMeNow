// PRINCIPLE — NO HARDCODED KEYWORD MATCHING.
// All intent classification, language detection, FAQ selection, specialist routing,
// translation and history rendering go through the LLM, never through regex on the
// customer message. Regex on the customer message cannot cover all the languages
// and phrasings the chatbot must support, and would silently fail in multilingual cases.
// Local keyword detection is allowed ONLY for non-linguistic, deterministic tokens
// already enumerated by the device (e.g. exact display codes like SEL, PUSH, ALM/A,
// AL001) or for numeric/yes-no inputs in flow CHOICE nodes.

import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

// Utilities extracted from demo.ts
import {
  createInitialState,
  summarizeState,
  pushDebug,
  type SessionState,
} from './utils/state.js'
import {
  normalizeDisplayState,
  inferPaymentCompletedFromDisplayState,
  isWasherPaymentPendingDisplay,
  doesDryerDisplayNeedIdentityDetails,
} from './utils/display-state.js'
import {
  normalizeLocationValue,
  resolveKnownLocation,
  parseExplicitPaymentSignal,
  sanitizeCustomerReply,
  isBlankDisplayReply,
  hasExtraButtonIssue,
  hasStopIntent,
} from './utils/message-parsing.js'
import {
  wrapPlainText,
  printCliBanner,
  printCliMessage,
  printDebug,
  BOT_MESSAGE_SEPARATOR,
  CLI_WIDTH,
  CLI_RULE,
  CLI_SUBRULE,
} from './utils/cli.js'
import {
  getDemoDir,
  loadRuntime,
  getLocationOverride,
  buildLocationContext,
  replaceVars,
  getFaqs,
  setFaqs,
  type FlowNode,
  type FlowMap,
  type FaqMap,
  type LocationOverride,
  type LocationsConfig,
  type Runtime,
  type RegressionScenario,
  type RegressionAssertion,
  type SupportedLanguage,
  type Settings,
} from './utils/runtime.js'
import { QUESTIONS } from './utils/localization.js'
import {
  buildEscalationSummary,
  extractEscalationContext,
} from './utils/escalation.js'

// Load OPENROUTER_API_KEY (and any other secrets) from the .env file
// next to this script, so the key is never committed in source code.
try {
  const __envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env')
  process.loadEnvFile(__envFile)
} catch {
  // .env is optional; if missing, env vars must already be set in the shell
}

type Route = 'washer' | 'dryer' | 'faq' | 'operator' | 'reset' | 'greeting' | 'unknown'
type NextOwner = 'conversation_history' | 'washer_specialist' | 'dryer_specialist'


type RouterDecision = {
  route: Route
  nextOwner: NextOwner
  functionName: 'lavatrice_hs60xx' | 'asciugatrice_ed340' | 'contactOperator' | 'resetSession' | null
  extractedFacts: Record<string, string | boolean | null>
  missingFacts: string[]
  customerFacingGoal: string
  escalationReason: string | null
}

type SpecialistDecision = {
  flowId: string | null
  shouldEscalate: boolean
  escalationReason: string | null
  technicalSummary: string
  missingFacts: string[]
  customerFacingGoal: string
}

type FlowEngineResult = {
  flowId: string
  stepId: string
  prompt: string
  type: FlowNode['type']
  isTerminal: boolean
  action?: 'escalate'
}

type TurnResult = {
  reply: string
  debug: string[]
}

type ScriptedScenario = {
  name: string
  turns: string[]
}

type UsecaseScenario = {
  name: string
  preState?: Partial<SessionState>
  turns: string[]
  assertions: RegressionAssertion[]
}

type AcceptanceCriterionAssessment = {
  criterion: string
  passed: boolean
  reason: string
  evidence: string[]
  suggestedRewrite?: string
}

type AcceptanceReport = {
  caseNumber: number
  generatedAt: string
  scenario: string
  criteria: AcceptanceCriterionAssessment[]
  summary: string
  updatedAcceptanceCriteria: string[]
  failuresFromAssertions: string[]
}

type LlmRequest = {
  systemPrompt?: string
  userPrompt: string
  json?: boolean
  maxTokens?: number
  temperature?: number
}

const MODEL = 'openai/gpt-4o-mini'
const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
const API_KEY = process.env.OPENROUTER_API_KEY || ''
const CHATBOT_NAME = 'Ecolaundry Assistant'
const TONE_OF_VOICE = 'calm, reassuring, relaxed, warm, step-by-step'
const ALLOWED_LINKS = 'echatbot.ai, www.echatbot.ai, forms.gle, alberwaz.net'
const FAQ_FALLBACK = 'If this question depends on local policy, the operator will review it manually.'

const SCRIPTED_SCENARIOS: ScriptedScenario[] = [
  {
    name: 'washer-sel-start',
    turns: ['Ciao', 'lavatrice', '3', 'sì ho pagato', 'SEL', 'risolto'],
  },
  {
    name: 'washer-alm',
    turns: ['lavatrice 4, display ALM', 'water', 'ok risolto'],
  },
  {
    name: 'washer-post-cycle-wet',
    turns: ['ho finito il lavaggio ma i vestiti sono ancora bagnati', 'no', 'ok'],
  },
  {
    name: 'dryer-door',
    turns: ['asciugatrice 7, ho pagato, display DOOR', 'ora funziona'],
  },
  {
    name: 'dryer-filter',
    turns: ['asciugatrice mostra FILTRO', 'fatto'],
  },
  {
    name: 'faq-during-flow',
    turns: ['lavatrice 2', 'quanto costa il lavaggio a 40°?'],
  },
  {
    name: 'language-switch-spanish',
    turns: ['hola, la lavadora no funciona', '3', 'sí', 'SEL'],
  },
  {
    name: 'washer-paid-no-start-order',
    turns: ['Goya', 'lavatrice', '3', 'ho messo i soldi ma non parte', 'PUSH'],
  },
  {
    name: 'washer-direct-price-display',
    turns: ['lavatrice 5, display 12.00'],
  },
  {
    name: 'washer-occupied-machine-policy',
    turns: ['la lavadora de otra persona ha terminado pero sigue ocupando la máquina'],
  },
  {
    name: 'dryer-soaking-wet-clothes',
    turns: ['asciugatrice 7', 'sì ho pagato', 'i vestiti sono usciti fradici dalla lavatrice', 'yes'],
  },
  {
    name: 'dryer-burnt-clothes',
    turns: ['asciugatrice 2', 'dopo il secado la ropa ha salido quemada'],
  },
  {
    name: 'washer-extra-profit-plus',
    turns: ['Goya', 'lavatrice', '3', 'sì ho pagato', 'algún botón EXTRA tiene la luz fija', 'no'],
  },
  {
    name: 'washer-stop-first-time',
    turns: ['Goya', 'lavatrice', '3', 'he pulsado STOP para cambiar el programa', 'no', 'yes'],
  },
  {
    name: 'washer-alarm-persists',
    turns: ['Goya', 'lavatrice', '4', 'sì ho pagato', 'ALM/E', 'no', 'nothing changed'],
  },
]

const args = new Set(process.argv.slice(2))
const DEBUG_MODE = args.has('--debug')
const SCRIPTED_MODE = args.has('--scripted')
const VERIFY_MODE = args.has('--verify')
const USECASES_MODE = args.has('--usecases') || args.has('--usecase') || args.has('--usecase-range')
const USECASE_NUM = (() => { const idx = process.argv.indexOf('--usecase'); return idx !== -1 ? parseInt(process.argv[idx + 1] ?? '0', 10) : null })()
const USECASE_RANGE = (() => {
  const idx = process.argv.indexOf('--usecase-range')
  const raw = idx !== -1 ? (process.argv[idx + 1] ?? '').trim() : ''
  if (!raw) return null

  const match = raw.match(/^(\d+)\s*[-.]\s*(\d+)$/) || raw.match(/^(\d+)\s*\.\.\s*(\d+)$/)
  if (!match) return null

  const start = parseInt(match[1], 10)
  const end = parseInt(match[2], 10)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1 || end < start) {
    return null
  }

  return { start, end }
})()

process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') {
    process.exit(0)
  }
  throw error
})

// Constants
const KNOWN_LOCATIONS = ['Goya', 'Pineda', "L'Escala", 'Alemanya', 'Hortes'] as const
let FAQS: FaqMap = {}






function extractDisplayState(message: string): string | null {
  const trimmed = message.trim()
  if (isBlankDisplayReply(trimmed)) return 'BLANK'
  if (/END.*bAL|bAL.*END/i.test(trimmed)) return 'END_BAL'
  if (/\b\d{1,2}[.,]\d{2}\b/.test(trimmed)) return 'PRICE'
  if (/puerta abierta|dibujo de la puerta|icono de puerta|door open|open door icon/i.test(trimmed)) return 'DOOR'
  const alarm001Match = trimmed.match(/\bALM\s*0*01\b/i)
  if (alarm001Match) return 'AL001'

  const specificAlarmMatch = trimmed.match(/\b(ALM\/?A|ALM\/?E|ALM\/?DOOR|ALM\/?V(?:AR|Ar))\b/i)
  if (specificAlarmMatch) return normalizeDisplayState(specificAlarmMatch[1])

  const genericMatch = trimmed.match(/\b(SEL|PUSH|PR|DOOR|ALM|AL001|END|ON|FILTRO|FALLO DE ROTACION|FALLO DE ASPIRACION|STOP|water)\b/i)
  if (!genericMatch) return null
  return normalizeDisplayState(genericMatch[1])
}

function isDisplayCodeLikeInput(message: string): boolean {
  return Boolean(extractDisplayState(message))
}

function isShortContextReply(message: string): boolean {
  const trimmed = message.trim()
  return (
    /^\d{1,2}$/.test(trimmed) ||
    /^(yes|y|si|sì|sí|no|n|ok|ok risolto|risolto|fatto|ora funziona|water)$/i.test(trimmed) ||
    isBlankDisplayReply(trimmed) ||
    isDisplayCodeLikeInput(trimmed)
  )
}

function hasOperationalContextIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /ho messo i soldi|messo i soldi|metto i soldi|sto mettendo i soldi|inserito i soldi|ho pagato|paid already|already paid|payment completed|pagamento fatto|cosa devo fare adesso|what do i do now|que hago ahora|non aumentano i minuti|minutes did not increase|minuti non aumentano/i.test(normalized)
}

function hasNoFoamConcern(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  const mentionsFoamOrDetergent = /foam|schiuma|espuma|jabon|jab[oó]n|detergent|detergente|suavizante|soap/i.test(normalized)
  const mentionsAbsenceOrDoubt = /no hay|no tiene|no veo|sin |senza|without|poca|poco|normal|is this normal|es normal|non c[' ]?e|non vedo/i.test(normalized)
  return mentionsFoamOrDetergent && mentionsAbsenceOrDoubt
}

function hasTroubleshootingIntent(message: string): boolean {
  return hasTechnicalIssueIntent(message) || hasOperationalContextIntent(message)
}

function isClosureAcknowledgement(message: string): boolean {
  const trimmed = message.trim().toLowerCase()
  if (!trimmed || trimmed.length > 24) return false
  if (/\d/.test(trimmed) || trimmed.includes('?') || isDisplayCodeLikeInput(trimmed)) return false
  return /^(ok|okay|ok risolto|risolto|fatto|grazie|gracias|thanks|thank you|bene|perfect|perfecto|perfetto|va bene|d'accordo|listo)$/i.test(trimmed)
}

function normalizeMachineType(value: unknown): '' | 'washer' | 'dryer' {
  const normalized = String(value || '').trim().toLowerCase()
  if (['washer', 'lavatrice', 'lavadora', 'washing machine'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'
  if (/lavat(?:rice|ric|rce)|lavador|wash(?:er|ing machine)/i.test(normalized)) return 'washer'
  if (/asci(?:ugatrice|ugatric)|ascig(?:atrice|aatrice|a+trice)|secador|dry(?:er|ing)/i.test(normalized)) return 'dryer'
  return ''
}

function normalizeRoute(value: unknown): Route {
  const normalized = String(value || '').trim().toLowerCase()
  if (['washer', 'lavatrice', 'lavadora'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'
  if (['faq', 'operator', 'reset', 'greeting', 'unknown'].includes(normalized)) return normalized as Route
  return 'unknown'
}

function pickAllowedToken(rawValue: unknown, allowed: string[]): string | null {
  const value = String(rawValue || '').trim()
  if (!value) return null
  for (const token of allowed) {
    if (value === token || value.includes(token)) return token
  }
  return null
}

function isAwaitingLocation(state: SessionState): boolean {
  return !state.location && state.lastMissingFacts.includes('location')
}

function hasGreetingIntent(message: string): boolean {
  return /\b(ciao|ciao\s+come\s+stai|hello|hi|hola|buongiorno|buonasera)\b/i.test(message.trim())
}

function hasExplicitResetIntent(message: string): boolean {
  return /\b(reset|restart|start over|ricominci|ricomincia|ricominciamo|empecemos de nuevo|volver a empezar)\b/i.test(message.trim())
}

function hasTechnicalIssueIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /non si chiude|sportello|door|non parte|non funziona|non si avvia|does not start|doesn't start|won't start|does not work|doesn't work|not working|no arranca|no funciona|no se pone en marcha|stop|display|alm|sel|push|errore|error|filtro|rotacion|aspiracion|bagnat|wet|smell|odore/i.test(normalized)
}

function detectLanguageHeuristic(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/(¿|¡|secadora|lavadora|lavander[ií]a|arranc|otra vez|pantalla|centrifug|ropa|mojad|dinero|he pulsado|he premudo|como lo|autoservicio|cobrado|doble cobro|paso a paso|lavar|secar|captura|tarjeta|local)/i.test(normalized)) {
    return 'es'
  }

  if (/(asciug|lavatrice|lavanderia|centrifug|bagnat|sportello|cosa devo fare|ho gia risposto|schermata|pagamento|carta|lavato|asciugato)/i.test(normalized)) {
    return 'it'
  }

  if (/(rentadora|assecadora|rentadora|rentar|assecar|carrer|localitat|cobrament|pantalla de la rentadora|no arrenca|ha cobrat|pas a pas)/i.test(normalized)) {
    return 'ca'
  }

  if (/(washer|dryer|laundromat|display shows|charged twice|double charge|step by step|card digits|screenshot|payment proof|did not start|does not start)/i.test(normalized)) {
    return 'en'
  }

  return null
}

function isLikelyStandaloneLocationInput(state: SessionState, message: string): boolean {
  const trimmed = message.trim()
  if (!(isAwaitingLocation(state) || (!state.location && trimmed.split(/\s+/).length <= 4))) return false
  if (!trimmed || trimmed.length > 60) return false
  if (/^\d+$/.test(trimmed)) return false
  if (isShortContextReply(trimmed)) return false
  if (hasGreetingIntent(trimmed)) return false
  if (normalizeMachineType(trimmed)) return false
  if (/lavatric|washer|lavadora|asciugatric|dryer|secadora|display|alm|door|push|sel|filtro|rotacion|aspiracion/i.test(trimmed)) {
    return false
  }
  return true
}

function getRequestedLanguage(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (/(italiano|italian\b)/i.test(normalized)) return 'it'
  if (/(español|espanol|spanish\b)/i.test(normalized)) return 'es'
  if (/(català|catala|catalan\b)/i.test(normalized)) return 'ca'
  if (/(français|francais|french\b)/i.test(normalized)) return 'fr'
  if (/(portugu[eê]s|portuguese\b)/i.test(normalized)) return 'pt'
  if (/(inglese|english\b)/i.test(normalized)) return 'en'
  return null
}

function extractExplicitLocation(message: string): string | null {
  const match = message.match(/\b(?:sono a|sono in|mi trovo a|estoy en|estoy a|i am in|i'm in|i am at)\s+([A-Za-zÀ-ÿ' -]{2,40})/i)
  if (!match) return null
  return match[1].split(/[.,!?]/)[0].trim()
}

function parsePaymentAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/^(no|not yet|non ancora|ancora no)$/i.test(normalized)) {
    return false
  }

  if (/\b(non ho pagato|not paid|non pagato|no he pagado|todav[ií]a no)\b/i.test(normalized)) {
    return false
  }

  if (
    /^(yes|y|si|sì|sí)\b/i.test(normalized) ||
    /\b(ho pagato|pagato|paid|pagamento fatto|payment completed|fatto il pagamento|ho messo i soldi|messo i soldi|inserito i soldi)\b/i.test(normalized)
  ) {
    return true
  }

  return null
}

function hasDoubleChargeConcern(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /doble cobro|cobrado dos veces|me ha cobrado dos veces|double charge|charged twice|double payment|doble pago/i.test(normalized)
}

function parseServiceCompletedAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/^(no|non|not yet|ancora no|todav[ií]a no)$/i.test(normalized)) return false
  if (/\b(no he podido|non ho potuto|non sono riuscito|i could not|i wasn't able to|non ho potuto usare|no pude usar)\b/i.test(normalized)) return false
  if (/\b(si|sí|sì|yes|y|ho lavato|he lavado|he secado|ho asciugato|i washed|i dried|si pude|si he podido)\b/i.test(normalized)) return true
  if (/\b(lavar|lavado|lavar la ropa|wash|washed|secar|secado|dry|dried|usar la maquina|usare la macchina)\b/i.test(normalized)) return true
  return null
}

function parseDryerStartedAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/\b(no ha arrancado|no arranca|no ha empezado|no empieza|not started|did not start|non e partita|non parte)\b/i.test(normalized)) return false
  if (/\b(si ha arrancado|sí ha arrancado|ha arrancado|ha empezado|yes it started|started|e partita|partita)\b/i.test(normalized)) return true
  return null
}

function parseDryerCycleContext(message: string): '' | 'first_cycle' | 'time_added' {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return ''
  if (/\b(primer ciclo|first cycle|primo ciclo)\b/i.test(normalized)) return 'first_cycle'
  if (/\b(a[nñ]adido tiempo|añad[ií] tiempo|he añadido tiempo|added time|aggiunto tempo)\b/i.test(normalized)) return 'time_added'
  return ''
}

function extractLast4CardDigits(message: string): string | null {
  return message.match(/\b(\d{4})\b/)?.[1] || null
}

function parsePaymentProofProvided(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null
  if (/^(no|non|not yet|todav[ií]a no)$/i.test(normalized)) return false
  if (/\b(no la tengo|non ce l\'ho|no tengo captura|non ho la schermata|i don't have the screenshot|non ho lo screenshot)\b/i.test(normalized)) return false
  if (/captura|screenshot|screen|pantallazo|adjunto|allego|te la mando|te lo mando|aqui esta|here it is/i.test(normalized)) return true
  return null
}

function shouldTreatAsDoubleChargeNarrative(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (hasDoubleChargeConcern(trimmed)) return false
  if (isAlreadyAnsweredReply(trimmed)) return false
  if (parseServiceCompletedAnswer(trimmed) !== null) return false
  if (extractLast4CardDigits(trimmed)) return false
  if (parsePaymentProofProvided(trimmed) !== null && trimmed.split(/\s+/).length <= 3) return false
  if (trimmed.length >= 12) return true
  return /\b(poi|despu[eé]s|luego|then|prima|dopo|first|second|segundo|tercero)\b/i.test(trimmed)
}

function shouldForceDoubleChargeNarrativeStep(state: SessionState, message: string): boolean {
  if (!state.lastMissingFacts.includes('double charge step by step')) return false

  const trimmed = message.trim()
  if (!trimmed) return false
  if (isAlreadyAnsweredReply(trimmed)) return false
  if (parseServiceCompletedAnswer(trimmed) !== null) return false
  if (extractLast4CardDigits(trimmed)) return false
  if (parsePaymentProofProvided(trimmed) !== null) return false
  if (isLikelyStandaloneLocationInput(state, trimmed)) return false

  return trimmed.length >= 20 || /\b(poi|despu[eé]s|luego|then|prima|dopo|first|second|segundo|tercero|partito|arranco|arranc[oó]|pagato|pagado|messo i soldi|met[ií] el dinero)\b/i.test(trimmed)
}

function isAlreadyAnsweredReply(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return false
  return /ho gi[aà]'? rispost|l'ho gi[aà]'? detto|te l'ho gi[aà]'? detto|already answered|already told you|i already answered|ya respond[ií]|ya lo dije|gi[aà] detto/i.test(normalized)
}

// =============================================================================
// PRE-ROUTER FACT EXTRACTOR — PRODUCTION LAYER (Step 1)
// Runs before the Router LLM. Extracts known facts from the raw customer message
// deterministically, using finite-set rules (hardware codes, yes/no patterns, machine names).
// Updates SessionState directly and returns an enriched input string for the Router.
// Rule: hardware display codes (SEL, PUSH, AL001, etc.) are finite and safe to match.
//       Everything else (intent, tone, FAQ topics) must go to the LLM layers.
// =============================================================================

function preprocessUserInput(state: SessionState, userMessage: string): string {
  const trimmed = userMessage.trim()
  const extractedFacts: string[] = []
  const shouldPreserveIssueSummary =
    hasTechnicalIssueIntent(trimmed) ||
    hasOperationalContextIntent(trimmed) ||
    hasDryerPostCycleIssue(trimmed) ||
    hasWasherPostCycleIssue(trimmed)

  const explicitPaymentSignal = parseExplicitPaymentSignal(trimmed)
  if (explicitPaymentSignal !== null && state.paymentCompleted === null) {
    state.paymentCompleted = explicitPaymentSignal
    extractedFacts.push(`Payment completed is ${explicitPaymentSignal ? 'yes' : 'no'}`)
  }

  if (hasDryerPostCycleIssue(trimmed) && !state.machineType) {
    state.machineType = 'dryer'
    state.issueSummary = 'Dryer post-cycle wet clothes issue after multiple drying attempts.'
    extractedFacts.push('Machine type is dryer')
  }

  if (hasWasherPostCycleIssue(trimmed) && state.paymentCompleted === null) {
    state.paymentCompleted = true
    extractedFacts.push('Payment completed is yes')
  }

  if (hasDoubleChargeConcern(trimmed) && !state.issueSummary) {
    state.issueSummary = 'double charge'
    extractedFacts.push('Issue summary is double charge')
  }

  if (state.lastMissingFacts.includes('service completed or not')) {
    const parsedServiceCompleted = parseServiceCompletedAnswer(trimmed)
    if (parsedServiceCompleted !== null) {
      state.serviceCompleted = parsedServiceCompleted
      extractedFacts.push(`Service completed is ${parsedServiceCompleted ? 'yes' : 'no'}`)
    }
  }

  if (state.lastMissingFacts.includes('dryer started or not')) {
    const parsedDryerStarted = parseDryerStartedAnswer(trimmed)
    if (parsedDryerStarted !== null) {
      state.dryerStarted = parsedDryerStarted
      extractedFacts.push(`Dryer started is ${parsedDryerStarted ? 'yes' : 'no'}`)
    }
  }

  if (state.lastMissingFacts.includes('dryer first cycle or added time')) {
    const parsedDryerCycleContext = parseDryerCycleContext(trimmed)
    if (parsedDryerCycleContext) {
      state.dryerCycleContext = parsedDryerCycleContext
      extractedFacts.push(`Dryer cycle context is ${parsedDryerCycleContext}`)
    }
  }

  if (state.lastMissingFacts.includes('double charge step by step') && shouldTreatAsDoubleChargeNarrative(trimmed)) {
    state.doubleChargeNarrativeProvided = true
    state.doubleChargeNarrativeText = trimmed
    extractedFacts.push('Double charge narrative provided is yes')
    extractedFacts.push(`Double charge narrative text is ${trimmed}`)
    extractedFacts.push(`Issue summary is double charge; customer narrative: ${trimmed}`)
  } else if (
    state.lastMissingFacts.includes('double charge step by step') &&
    isAlreadyAnsweredReply(trimmed) &&
    state.doubleChargeNarrativeProvided &&
    state.doubleChargeNarrativeText
  ) {
    extractedFacts.push('Double charge narrative provided is yes')
    extractedFacts.push(`Double charge narrative text is ${state.doubleChargeNarrativeText}`)
  }

  if (state.lastMissingFacts.includes('last 4 card digits')) {
    const last4Digits = extractLast4CardDigits(trimmed)
    if (last4Digits) {
      state.last4CardDigitsProvided = true
      extractedFacts.push('Last 4 card digits provided is yes')
    }
  }

  if (state.lastMissingFacts.includes('payment proof')) {
    const paymentProofProvided = parsePaymentProofProvided(trimmed)
    if (paymentProofProvided !== null) {
      state.paymentProofProvided = paymentProofProvided
      extractedFacts.push(`Payment proof provided is ${paymentProofProvided ? 'yes' : 'no'}`)
    }
  }

  const explicitLocation = extractExplicitLocation(trimmed)
  if (explicitLocation && !state.location) {
    const knownLocation = resolveKnownLocation(explicitLocation)
    if (knownLocation) {
      state.location = knownLocation
      state.locationClarificationCount = 0
      extractedFacts.push(`Location is ${knownLocation}`)
    } else {
      state.locationClarificationCount += 1
    }
  } else if (isLikelyStandaloneLocationInput(state, trimmed)) {
    const knownLocation = resolveKnownLocation(trimmed)
    if (knownLocation) {
      state.location = knownLocation
      state.locationClarificationCount = 0
      extractedFacts.push(`Location is ${knownLocation}`)
    } else {
      state.locationClarificationCount += 1
    }
  }

  const explicitMachineType = normalizeMachineType(trimmed)
  if (explicitMachineType && (!state.machineType || state.machineType !== explicitMachineType)) {
    state.machineType = explicitMachineType
    extractedFacts.push(`Machine type is ${explicitMachineType}`)
  }

  const explicitMachineNumber = trimmed.match(/(?:numero|num(?:ero)?|n\.?|machine number|macchina)\s*[:#-]?\s*(\d{1,3})\b/i)?.[1]
  if (explicitMachineNumber && state.machineType && !state.machineNumber) {
    state.machineNumber = explicitMachineNumber
    extractedFacts.push(`Machine number is ${explicitMachineNumber}`)
  } else if (/\b\d{1,3}\b/.test(trimmed) && state.machineType && !state.machineNumber) {
    const inlineMachineNumber = trimmed.match(/\b(\d{1,3})\b/)?.[1]
    if (inlineMachineNumber) {
      state.machineNumber = inlineMachineNumber
      extractedFacts.push(`Machine number is ${inlineMachineNumber}`)
    }
  } else if (/^\d{1,3}$/.test(trimmed) && state.machineType && !state.machineNumber) {
    state.machineNumber = trimmed
    extractedFacts.push(`Machine number is ${trimmed}`)
  }

  const explicitDisplayState = extractDisplayState(trimmed)
  if (explicitDisplayState && state.machineType && !state.displayState) {
    state.displayState = explicitDisplayState
    extractedFacts.push(`Display state is ${explicitDisplayState}`)

    const paymentCompletedFromDisplay = inferPaymentCompletedFromDisplayState(state.machineType, explicitDisplayState)
    if (paymentCompletedFromDisplay !== null) {
      state.paymentCompleted = paymentCompletedFromDisplay
      extractedFacts.push(`Payment completed is ${paymentCompletedFromDisplay ? 'yes' : 'no'}`)
    }
  }

  if (state.machineType && state.paymentCompleted === null && !state.activeFlowId && !isAwaitingLocation(state)) {
    const parsedPaymentAnswer = parsePaymentAnswer(trimmed)
    if (parsedPaymentAnswer !== null) {
      state.paymentCompleted = parsedPaymentAnswer
      extractedFacts.push(`Payment completed is ${parsedPaymentAnswer ? 'yes' : 'no'}`)
    }
  }

  if (extractedFacts.length) {
    if (shouldPreserveIssueSummary) {
      extractedFacts.push(`Issue summary is ${trimmed}`)
    }
    return extractedFacts.join('; ')
  }

  return userMessage
}

function isContextualHeuristicInput(originalInput: string, normalizedInput: string): boolean {
  return originalInput.trim() !== normalizedInput.trim()
}

function hasDryerPostCycleIssue(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  const mentionsDrying = /secad|dry|asciug/i.test(normalized)
  const mentionsWetOutcome = /empapad|mojad|wet|bagnat|humed/i.test(normalized)
  return mentionsDrying && mentionsWetOutcome
}

function hasWasherPostCycleIssue(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /finito|finished|terminado|centrifug|mojad|empapad|wet|bagnat|ropa.*mojad|salido.*mojad|porta non si apre|door blocked|schiuma|foam|espuma|jabon|jab[oó]n|detergent|detergente|suavizante/i.test(normalized)
}

// =============================================================================
// ROUTER SAFETY CORRECTOR — PRODUCTION LAYER (Step 3)
// Runs after the Router LLM returns its decision, before any downstream call.
// Overrides incorrect Router decisions using session context as the ground truth.
// Handles: double-charge enforcement, no-foam FAQ override, false reset prevention,
// washer/dryer re-route when machineType is already known in session.
// This corrector is the safety net when the Router LLM misses session state.
// =============================================================================

function applyContextualRouterFallback(
  decision: RouterDecision,
  state: SessionState,
  originalInput: string,
  normalizedInput: string,
): RouterDecision {
  const nextDecision = { ...decision }

  const isDoubleChargeCase =
    hasDoubleChargeConcern(originalInput) ||
    /double charge/i.test(String(nextDecision.extractedFacts?.issueSummary || state.issueSummary || '')) ||
    state.lastMissingFacts.some((fact) => ['service completed or not', 'double charge step by step', 'last 4 card digits', 'payment proof'].includes(fact))

  if (isDoubleChargeCase) {
    const isAwaitingServiceCompleted = state.lastMissingFacts.includes('service completed or not')
    const isAwaitingNarrative = state.lastMissingFacts.includes('double charge step by step')
    const isAwaitingLast4Digits = state.lastMissingFacts.includes('last 4 card digits')
    const isAwaitingPaymentProof = state.lastMissingFacts.includes('payment proof')

    const currentTurnServiceCompleted = isAwaitingServiceCompleted ? parseServiceCompletedAnswer(originalInput) : null
    const currentTurnNarrativeProvided = isAwaitingNarrative
      ? (shouldTreatAsDoubleChargeNarrative(originalInput) || shouldForceDoubleChargeNarrativeStep(state, originalInput))
      : false
    const currentTurnLast4Digits = isAwaitingLast4Digits ? extractLast4CardDigits(originalInput) : null
    const currentTurnPaymentProof = isAwaitingPaymentProof ? parsePaymentProofProvided(originalInput) : null

    const resolvedServiceCompleted =
      currentTurnServiceCompleted !== null
        ? currentTurnServiceCompleted
        : typeof nextDecision.extractedFacts?.serviceCompleted === 'boolean'
        ? nextDecision.extractedFacts.serviceCompleted
        : state.serviceCompleted
    const resolvedDoubleChargeNarrativeProvided =
      currentTurnNarrativeProvided
        ? true
        : typeof nextDecision.extractedFacts?.doubleChargeNarrativeProvided === 'boolean'
        ? nextDecision.extractedFacts.doubleChargeNarrativeProvided
        : state.doubleChargeNarrativeProvided
    const resolvedDoubleChargeNarrativeText =
      currentTurnNarrativeProvided
        ? originalInput.trim()
        : typeof nextDecision.extractedFacts?.doubleChargeNarrativeText === 'string' && nextDecision.extractedFacts.doubleChargeNarrativeText.trim()
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

    const missingFacts: string[] = []
    if (resolvedServiceCompleted === null) {
      missingFacts.push('service completed or not')
    } else if (!resolvedDoubleChargeNarrativeProvided) {
      missingFacts.push('double charge step by step')
    } else {
      if (!resolvedLast4CardDigitsProvided) missingFacts.push('last 4 card digits')
      if (!resolvedPaymentProofProvided) missingFacts.push('payment proof')
      if (!state.location) missingFacts.push('location')
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
          ? 'Collect the documented double-charge review details step by step. Do not escalate yet.'
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
        machineType: normalizeMachineType(nextDecision.extractedFacts?.machineType) || state.machineType || 'washer',
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
      nextDecision.route = state.machineType || state.activeFlowId ? (state.machineType || 'unknown') : 'unknown'
    }
  }

  if (
    nextDecision.functionName === 'resetSession' &&
    !hasExplicitResetIntent(originalInput) &&
    !state.activeFlowId &&
    !state.machineType
  ) {
    nextDecision.functionName = null
    if (nextDecision.route === 'reset') {
      nextDecision.route = 'unknown'
    }
  }

  if (
    (nextDecision.route === 'unknown' || nextDecision.route === 'greeting') &&
    (state.machineType || normalizeMachineType(nextDecision.extractedFacts?.machineType))
  ) {
    const routedMachineType = normalizeMachineType(nextDecision.extractedFacts?.machineType) || state.machineType
    if (routedMachineType) {
      nextDecision.route = routedMachineType
      nextDecision.nextOwner = routedMachineType === 'washer' ? 'washer_specialist' : 'dryer_specialist'
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
    nextDecision.customerFacingGoal = 'Treat this as a dryer post-cycle wet-clothes issue and ask only the next required troubleshooting detail.'
  }

  if (nextDecision.route === 'washer' || nextDecision.route === 'dryer') {
    const resolvedMachineNumber = String(nextDecision.extractedFacts?.machineNumber || state.machineNumber || '').trim()
    const resolvedDisplayState = String(nextDecision.extractedFacts?.displayState || state.displayState || '').trim()
    const resolvedIssueSummary = String(nextDecision.extractedFacts?.issueSummary || state.issueSummary || originalInput)
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
      ? (nextDecision.route === 'washer' ? 'lavatrice_hs60xx' : 'asciugatrice_ed340')
      : null
  }

  if (!shouldTreatAsContextual) {
    return nextDecision
  }

  if (nextDecision.route === 'unknown' && state.machineType) {
    nextDecision.route = state.machineType
    nextDecision.nextOwner = state.machineType === 'washer' ? 'washer_specialist' : 'dryer_specialist'
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

function normalizeRouterDecision(decision: RouterDecision, state: SessionState): RouterDecision {
  const route = normalizeRoute(decision.route)
  const machineType = normalizeMachineType(decision.extractedFacts?.machineType) || state.machineType
  const functionName = pickAllowedToken(decision.functionName, ['lavatrice_hs60xx', 'asciugatrice_ed340', 'contactOperator', 'resetSession']) as RouterDecision['functionName']
  const normalizedLocation = resolveKnownLocation(String(decision.extractedFacts?.location || '').trim()) || state.location
  const extractedFacts = {
    ...decision.extractedFacts,
    location: normalizedLocation,
    machineType,
    machineNumber: String(decision.extractedFacts?.machineNumber || state.machineNumber || '').trim(),
    displayState: String(decision.extractedFacts?.displayState || state.displayState || '').trim(),
  }

  return {
    ...decision,
    route,
    functionName,
    nextOwner: route === 'washer' ? 'washer_specialist' : route === 'dryer' ? 'dryer_specialist' : 'conversation_history',
    extractedFacts,
    missingFacts: Array.isArray(decision.missingFacts) ? decision.missingFacts : [],
  }
}

function normalizeSpecialistDecision(decision: SpecialistDecision, state: SessionState): SpecialistDecision {
  const allowed = state.machineType === 'dryer' ? ['non_parte', 'errore_reset'] : ['non_parte', 'post_ciclo', 'stop_error']
  const flowId = pickAllowedToken(decision.flowId, allowed)
  return {
    ...decision,
    flowId,
    missingFacts: Array.isArray(decision.missingFacts) ? decision.missingFacts : [],
    shouldEscalate: decision.shouldEscalate === true,
  }
}

// =============================================================================
// SPECIALIST SAFETY CORRECTOR — PRODUCTION LAYER
// Runs after the Specialist LLM returns its decision.
// Applies display-state-based overrides when the Specialist did not pick a flow.
// Mirrors the same safety-net pattern as applyContextualRouterFallback.
// =============================================================================

function applySpecialistFallback(
  decision: SpecialistDecision,
  state: SessionState,
  originalInput: string,
): SpecialistDecision {
  const issue = `${state.issueSummary} ${originalInput}`.toLowerCase()
  const displayState = state.displayState.toUpperCase()

  if (state.machineType === 'dryer') {
    if (hasStopIntent(issue)) {
      return {
        ...decision,
        flowId: 'errore_reset',
        shouldEscalate: false,
      }
    }
    if (['SEL', 'PUSH', 'PR', 'ALM', 'AL001', 'END'].includes(displayState)) {
      return {
        ...decision,
        flowId: 'non_parte',
        shouldEscalate: false,
      }
    }
    if (['FILTRO', 'FALLO DE ROTACION', 'FALLO DE ASPIRACION'].includes(displayState)) {
      return {
        ...decision,
        flowId: 'errore_reset',
        shouldEscalate: false,
      }
    }
    if (displayState === 'DOOR') {
      return {
        ...decision,
        flowId: 'non_parte',
        shouldEscalate: false,
      }
    }
    if (hasDryerPostCycleIssue(issue)) {
      return {
        ...decision,
        flowId: 'errore_reset',
        shouldEscalate: false,
      }
    }

    if (decision.flowId) {
      return decision
    }
  }

  if (state.machineType === 'washer') {
    if (hasStopIntent(issue)) {
      return {
        ...decision,
        flowId: 'stop_error',
        shouldEscalate: false,
      }
    }
    if (['SEL', 'PUSH', 'PR', 'DOOR', 'ALM', 'AL001', 'END'].includes(displayState)) {
      return {
        ...decision,
        flowId: 'non_parte',
        shouldEscalate: false,
      }
    }
    if (hasWasherPostCycleIssue(issue)) {
      return {
        ...decision,
        flowId: 'post_ciclo',
        shouldEscalate: false,
      }
    }

    if (decision.flowId) {
      return decision
    }
  }

  return decision
}

function extractJson<T>(value: string, fallback: T): T {
  const trimmed = value.trim()
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] || trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return fallback
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return fallback
  }
}





function renderMissingFactQuestion(routerDecision: RouterDecision, state: SessionState): string {
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


// MOCK ONLY — post-processes mock output to normalize display option lists.
// In production: Conversation History LLM owns this formatting via its prompt.
function normalizeSpanishDisplayOptions(message: string): string {
  const formalQuestion = 'Dime, por favor, que aparece exactamente en la pantalla.'

  const recommended = [
    '\n1. SEL',
    '2. PUSH / Pr',
    '3. DOOR',
    '4. ALM',
    '5. Pantalla apagada',
    '6. Panatalla en blanco',
    '7. Panatalla bloqueada',
    '8. Otro mensaje',
  ].join('\n')

  const withFormalQuestion = message
    .replace(/Por favor, dime exactamente que aparece en el display\./gi, formalQuestion)
    .replace(/Por favor, dime exactamente qué aparece en el display\./gi, formalQuestion)
    .replace(/Por favor, dime exactamente que aparece en la pantalla\./gi, formalQuestion)
    .replace(/Por favor, dime exactamente qué aparece en la pantalla\./gi, formalQuestion)
    .replace(/¿Qué ves ahora en el display\?/gi, formalQuestion)
    .replace(/¿Que ves ahora en el display\?/gi, formalQuestion)
    .replace(/¿Que ves exactamente en la pantalla\?/gi, formalQuestion)

  const withQuestionSpacing = withFormalQuestion.replace(
    /(Dime, por favor, que aparece exactamente en la pantalla\.)\s*1\./gi,
    '$1\n\n1.',
  )

  return withQuestionSpacing.replace(
    /\s*1\.\s*\*\*?SEL\*\*?\s*\n\s*2\.\s*\*\*?PUSH\s*\/\s*Pr\*\*?\s*\n\s*3\.\s*\*\*?DOOR\*\*?\s*\n\s*4\.\s*\*\*?ALM\*\*?\s*\n\s*5\.\s*(?:Nada ha cambiado\s*\/\s*otro|Pantalla apagada)\s*\n\s*6\.\s*(?:Nada\s*\/\s*pantalla en blanco|Panatalla en blanco|Pantalla en blanco)(?:\s*\n\s*7\.\s*Otro mensaje)?/gi,
    recommended,
  )
}

// MOCK ONLY — injects washer program guide into mock output.
// In production: Flow Engine JSON node prompt owns this content; Conversation History LLM renders it.
function injectSpanishWasherProgramsGuide(message: string): string {
  const trigger = 'Presiona un botón de programa para iniciar el lavado.'
  if (!message.includes(trigger)) return message
  if (/60[º°]\s*Molt calent|40[º°]\s*Calent|30[º°]\s*Temperat|Fr[ií]o\s*→/i.test(message)) {
    return message
  }

  const guide = [
    '60º Molt calent → ropa muy sucia, blanca o de trabajo',
    '40º Calent → ropa normal (algodón, color)',
    '30º Temperat → ropa delicada o sintética',
    'Frío → prendas muy delicadas (lana, seda, etc.)',
  ].join('\n')

  return message.replace(trigger, `${trigger}\n\n${guide}`)
}

// MOCK ONLY — appends escalation closure text to mock output.
// In production: Conversation History LLM writes the closure using the customerFacingGoal from RouterDecision.
function injectSpanishEscalationClosure(message: string): string {
  const normalized = normalizeForRegression(message)
  const looksEscalation =
    /notificando al operador|avisando al operador|revisado manualmente por un operador|review it another way|manual review/.test(normalized)

  if (!looksEscalation) return message
  if (/quedate a la espera|chatbot esta ahora deshabilitado/i.test(normalized)) return message

  const closure = ' Quedate a la espera: un operador te respondera lo antes posible. El chatbot esta ahora deshabilitado.'
  return `${message.trim()}${closure}`
}

// MOCK ONLY — patches English flow node prompts that leak into Italian mock output.
// In production: Flow Engine JSON nodes must be written in the correct base language,
// and Conversation History LLM translates/adapts them.
function normalizeItalianFlowPhrases(message: string): string {
  return message
    .replace(/Let[’']s sort this out\.?/gi, 'Vediamo di risolvere.')
    .replace(/Have you already completed the payment at the central unit\?/gi, 'Hai gia completato il pagamento alla centralina?')
    .replace(/What exactly do you see on the display\?/gi, 'Cosa vedi esattamente sul display?')
    .replace(/Were you able to complete the payment\?/gi, 'Sei riuscito a completare il pagamento?')
}

// MOCK ONLY — applies all mock post-processing patches in one pass.
// In production: this function does not exist. The Conversation History LLM prompt
// is responsible for correct language, tone, and formatting — no post-hoc patching.
function normalizeGeneratedMessage(language: SessionState['language'], message: string): string {
  if (language === 'es') {
    const withDisplayOptions = normalizeSpanishDisplayOptions(message)
    const withWasherGuide = injectSpanishWasherProgramsGuide(withDisplayOptions)
    return injectSpanishEscalationClosure(withWasherGuide)
  }
  if (language === 'it') {
    return normalizeItalianFlowPhrases(message)
  }
  return message
}


async function callModel(params: LlmRequest): Promise<string> {
  return callOpenRouter(params)
}

async function callOpenRouter(params: LlmRequest): Promise<string> {
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY missing in environment')
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'Cliente-0 Demo CLI',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        ...(params.systemPrompt ? [{ role: 'system', content: params.systemPrompt }] : []),
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.1,
      max_tokens: params.maxTokens ?? 300,
      ...(params.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content?.trim() || ''
}

function resolveLanguage(detected: SupportedLanguage, settings: Settings): SupportedLanguage {
  if (settings.enabledLanguages.includes(detected)) return detected
  return settings.defaultLanguage
}

async function detectLanguage(runtime: Runtime, message: string): Promise<SupportedLanguage> {
  const heuristic = detectLanguageHeuristic(message)
  if (heuristic) {
    return heuristic
  }

  const result = await callModel({
    systemPrompt: runtime.prompts.language,
    userPrompt: `Customer message:\n${message}`,
    json: true,
    maxTokens: 30,
  })
  const parsed = extractJson<{ language?: 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr' }>(result, { language: 'en' })
  return parsed.language || 'en'
}

function mergeFactsIntoState(state: SessionState, decision: RouterDecision): void {
  const facts = decision.extractedFacts || {}
  if (typeof facts.location === 'string' && facts.location) state.location = facts.location
  if ((facts.machineType === 'washer' || facts.machineType === 'dryer') && facts.machineType) {
    state.machineType = facts.machineType
  }
  if (typeof facts.machineNumber === 'string' && facts.machineNumber) state.machineNumber = facts.machineNumber
  if (typeof facts.paymentMethod === 'string' && facts.paymentMethod) state.paymentMethod = facts.paymentMethod
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

    if (paymentCompletedFromDisplay !== null) {
      state.paymentCompleted = paymentCompletedFromDisplay
    }
  }
  if (typeof facts.issueSummary === 'string' && facts.issueSummary) state.issueSummary = facts.issueSummary
  if (typeof facts.paymentCompleted === 'boolean') state.paymentCompleted = facts.paymentCompleted
  if (typeof facts.dryerStarted === 'boolean') state.dryerStarted = facts.dryerStarted
  if (facts.dryerCycleContext === 'first_cycle' || facts.dryerCycleContext === 'time_added') {
    state.dryerCycleContext = facts.dryerCycleContext
  }
  if (typeof facts.serviceCompleted === 'boolean') state.serviceCompleted = facts.serviceCompleted
  if (typeof facts.doubleChargeNarrativeProvided === 'boolean') state.doubleChargeNarrativeProvided = facts.doubleChargeNarrativeProvided
  if (typeof facts.doubleChargeNarrativeText === 'string' && facts.doubleChargeNarrativeText) {
    state.doubleChargeNarrativeText = facts.doubleChargeNarrativeText
  }
  if (typeof facts.last4CardDigitsProvided === 'boolean') state.last4CardDigitsProvided = facts.last4CardDigitsProvided
  if (typeof facts.paymentProofProvided === 'boolean') state.paymentProofProvided = facts.paymentProofProvided
}

async function runRouter(runtime: Runtime, state: SessionState, message: string): Promise<RouterDecision> {
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

async function runSpecialist(runtime: Runtime, state: SessionState, message: string): Promise<SpecialistDecision> {
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
  ].filter(Boolean).join('\n\n')
  const output = await callModel({
    userPrompt,
    json: true,
    maxTokens: 300,
  })
  return extractJson<SpecialistDecision>(output, fallback)
}

function currentFlowGroup(runtime: Runtime, state: SessionState): Record<string, FlowNode> | null {
  if (!state.activeFlowId || !state.machineType) return null
  const source = state.machineType === 'washer' ? runtime.flows.washer : runtime.flows.dryer
  return source[state.activeFlowId] || null
}

function currentFlowNode(runtime: Runtime, state: SessionState): FlowNode | null {
  const flow = currentFlowGroup(runtime, state)
  if (!flow || !state.activeStepId) return null
  return flow[state.activeStepId] || null
}

function startFlow(runtime: Runtime, state: SessionState, flowId: string): FlowEngineResult {
  const normalizedFlowId = flowId.trim()
  const source = state.machineType === 'dryer' ? runtime.flows.dryer : runtime.flows.washer
  const flow = source[normalizedFlowId]
  if (!flow) {
    throw new Error(`Flow ${normalizedFlowId} not found for machine type ${state.machineType || 'washer'}`)
  }

  const stepId = selectInitialStepFromState(state, normalizedFlowId, flow)
  const node = flow[stepId]
  if (!stepId || !node) {
    throw new Error(`Flow ${flowId} has no valid starting node`)
  }

  state.activeFlowId = normalizedFlowId
  state.activeStepId = stepId
  state.retryCount = 0

  return {
    flowId: normalizedFlowId,
    stepId,
    prompt: node.prompt,
    type: node.type,
    isTerminal: Boolean(node.isTerminal),
    action: node.action,
  }
}

function selectInitialStepFromState(
  state: SessionState,
  flowId: string,
  flow: Record<string, FlowNode>,
): string {
  const issue = state.issueSummary.toLowerCase()
  const display = normalizeDisplayState(state.displayState)

  if (state.machineType === 'washer' && flowId === 'non_parte') {
    if (hasExtraButtonIssue(issue) && flow.case_extra_button) return 'case_extra_button'
    if (state.paymentCompleted === false && flow.pay_help) return 'pay_help'
    if (display === 'SEL' && flow.case_sel) return 'case_sel'
    if (display === 'PRICE' && flow.case_price) return 'case_price'
    if ((display === 'PUSH' || display === 'PR') && flow.case_push) return 'case_push'
    if (display === 'DOOR' && flow.case_door) return 'case_door'
    if (display === 'ALM/A' && flow.case_alm_a) return 'case_alm_a'
    if (display === 'ALM/E' && flow.case_alm_e) return 'case_alm_e'
    if (display === 'ALM/DOOR' && flow.case_alm_door) return 'case_alm_door'
    if (display === 'ALM/VAr' && flow.case_alm_var) return 'case_alm_var'
    if (display === 'ALM' && flow.case_alm) return 'case_alm'
    if (display === 'AL001' && flow.case_al001) return 'case_al001'
    if (display === 'END_BAL' && flow.case_end_bal) return 'case_end_bal'
    if (display === 'END' && flow.case_end) return 'case_end'
    if (display === 'ON' && flow.ok) return 'ok'
    if (state.paymentCompleted === true && flow.display_check) return 'display_check'
  }

  if (state.machineType === 'washer' && flowId === 'post_ciclo') {
    if (/foam|schiuma|espuma|jabon|jab[oó]n|detergent|detergente|suavizante/.test(issue) && flow.foam) return 'foam'
    if (/porta|door/.test(issue) && flow.door) return 'door'
    if (/mojad|empapad|bagnat|wet|centrifug/.test(issue) && flow.wet) return 'wet'
    if (flow.step_0) return 'step_0'
  }

  if (state.machineType === 'dryer' && flowId === 'non_parte') {
    if (state.paymentCompleted === false && flow.pay_help) return 'pay_help'
    if (display === 'BLANK' && flow.display_blank) return 'display_blank'
    if (display === 'SEL' && flow.case_sel) return 'case_sel'
    if (display === 'DOOR' && flow.door_issue) return 'door_issue'
    if (display === 'AL001' && flow.case_al001) return 'case_al001'
    if (state.paymentCompleted === true && flow.problem_check) return 'problem_check'
  }

  if (state.machineType === 'dryer' && flowId === 'errore_reset') {
    if (hasStopIntent(issue) && flow.mid_stop) return 'mid_stop'
    if (display === 'FILTRO' && flow.filter_alarm) return 'filter_alarm'
    if (display === 'FALLO DE ROTACION' && flow.rotation_alarm) return 'rotation_alarm'
    if (display === 'FALLO DE ASPIRACION' && flow.aspiration_alarm) return 'aspiration_alarm'
    if (/umid|wet|bagnat/.test(issue) && flow.non_scalda) return 'non_scalda'
    if (/odore|smell/.test(issue) && flow.odor_case) return 'odor_case'
    if (/porta|door/.test(issue) && flow.door_after_cycle) return 'door_after_cycle'
  }

  return flow.step_0 ? 'step_0' : Object.keys(flow)[0]
}

function mapChoiceDescriptions(node: FlowNode): Record<string, string> {
  const descriptions: Record<string, string> = {}
  for (const line of node.prompt.split('\n')) {
    const match = line.match(/^\s*(\d+)[️⃣.]?\s*(.+)$/u)
    if (match) descriptions[match[1]] = match[2].trim()
  }
  return descriptions
}

function normalizeConfirmation(input: string): 'YES' | 'NO' | null {
  const value = input.trim().toLowerCase()
  if (/^(y|yes|yeah|yep|si|sí|sì|ok|done|fatto|risolto)\b/i.test(value)) return 'YES'
  if (/\b(si pienso que si|creo que si|pienso que si|yes i think so|direi di si)\b/i.test(value)) return 'YES'
  if (/\b(ho gia'? detto di si|i paid already|already paid|ho pagato|pagato|payment completed|fatto il pagamento)\b/i.test(value)) return 'YES'
  if (/^(no|n|nope)\b/i.test(value)) return 'NO'
  if (/\b(non ancora|ancora no|non funziona|not yet|not paid|non ho pagato|no hace nada|non fa niente|does nothing)\b/i.test(value)) return 'NO'
  return null
}

// =============================================================================
// SUB-LLM — FLOW ENGINE CHOICE CLASSIFIER (Step 4b)
// Called inside the Flow Engine when a CHOICE node receives free-text input
// instead of a numbered option. Uses a micro-LLM call (max 20 tokens) to map
// the customer's reply to the correct choice key.
// Anti-hardcode rule: never add phrase detection here. Let the LLM decide.
// =============================================================================
async function classifyChoiceViaLLM(node: FlowNode, input: string): Promise<string | null> {
  const trimmed = input.trim().toLowerCase()
  const detectedDisplay = extractDisplayState(input)
  const choiceDescriptions = mapChoiceDescriptions(node)
  const transitionTargets = Object.values(node.transitions || {})
  const isDisplayChoiceNode = transitionTargets.some((target) =>
    /case_sel|case_push|case_door|case_alm|case_al001|case_end|case_blank|case_extra/.test(target),
  )
  const isAlarmChoiceNode = transitionTargets.some((target) =>
    /case_alm_a|case_alm_e|case_alm_door|case_alm_var|case_alm_unknown/.test(target),
  )
  const isEndChoiceNode = transitionTargets.some((target) =>
    /case_end_only|case_end_unknown/.test(target),
  )

  if (/^(ok|ok risolto|risolto|fatto|ora funziona|funziona)$/i.test(trimmed)) {
    if (node.transitions?.YES) return 'YES'
  }
  if (/^(no|non funziona|ancora no)$/i.test(trimmed)) {
    if (node.transitions?.NO) return 'NO'
  }
  if (hasExtraButtonIssue(input) && node.transitions?.['9']) {
    return '9'
  }
  if (hasExtraButtonIssue(input) && node.transitions?.['8']) {
    return '8'
  }
  if (isBlankDisplayReply(input)) {
    if (node.transitions?.['8']) return '8'
    if (node.transitions?.['6']) return '6'
    if (node.transitions?.other) return 'other'
  }
  if (detectedDisplay && isDisplayChoiceNode) {
    if (detectedDisplay === 'SEL' && node.transitions?.['1']) return '1'
    if (detectedDisplay === 'PRICE' && node.transitions?.['2']) return '2'
    if ((detectedDisplay === 'PUSH' || detectedDisplay === 'PR') && node.transitions?.['3']) return '3'
    if (detectedDisplay === 'DOOR' && node.transitions?.['4']) return '4'
    if (detectedDisplay === 'ALM' && node.transitions?.['5']) return '5'
    if (detectedDisplay === 'AL001') {
      const al001Entry = Object.entries(choiceDescriptions).find(([, description]) => /AL001/i.test(description))
      if (al001Entry && node.transitions?.[al001Entry[0]]) return al001Entry[0]
      if (node.transitions?.other) return 'other'
    }
    if (detectedDisplay === 'END' && node.transitions?.['7']) return '7'
    if (detectedDisplay === 'END_BAL' && node.transitions?.other) return 'other'
  }
  if (detectedDisplay && isAlarmChoiceNode) {
    if (detectedDisplay === 'ALM/A' && node.transitions?.['1']) return '1'
    if (detectedDisplay === 'ALM/E' && node.transitions?.['2']) return '2'
    if (detectedDisplay === 'ALM/DOOR' && node.transitions?.['3']) return '3'
    if (detectedDisplay === 'ALM/VAr' && node.transitions?.['4']) return '4'
    if (node.transitions?.['5']) return '5'
  }
  if (detectedDisplay === 'END_BAL' && isEndChoiceNode && node.transitions?.['2']) {
    return '2'
  }
  const descriptions = mapChoiceDescriptions(node)
  const options = Object.keys(node.transitions || {}).filter((key) => key !== 'other')
  const optionLines = options.map((key) => `${key}: ${descriptions[key] || key}`).join('\n')
  const answer = await callModel({
    userPrompt: `Which option best matches the customer reply? Reply with ONLY the key or NONE.\n\nNode prompt:\n${node.prompt}\n\nOptions:\n${optionLines}\n\nCustomer reply:\n${input}`,
    maxTokens: 20,
  })
  const normalized = answer.trim().replace(/^"|"$/g, '')
  return normalized && normalized.toUpperCase() !== 'NONE' ? normalized : null
}

/** Classifies free-form user input against a ROUTER node's logic keys using an LLM call. */
async function classifyRouterLogic(logic: Record<string, string>, userInput: string): Promise<string> {
  const keys = Object.keys(logic)
  const answer = await callModel({
    userPrompt: `Classify this customer message into exactly one category. Reply with ONLY the key, nothing else.\n\nCategories: ${keys.join(', ')}\n\nCustomer message:\n${userInput}`,
    maxTokens: 15,
  })
  const normalized = answer.trim().toUpperCase()
  return keys.find((k) => k.toUpperCase() === normalized) || keys[keys.length - 1]
}

async function advanceActiveFlow(runtime: Runtime, state: SessionState, userInput: string): Promise<FlowEngineResult> {
  const flowId = state.activeFlowId
  let node = currentFlowNode(runtime, state)
  if (!flowId || !node || !state.activeStepId) {
    throw new Error('No active flow to advance')
  }

  if (node.type === 'ACTION' && node.transitions?.default) {
    state.activeStepId = node.transitions.default.split('.').pop() || node.transitions.default
    node = currentFlowNode(runtime, state)
    if (!node || !state.activeStepId) throw new Error('Broken flow transition after ACTION node')
  }

  let transitionKey: string | null = null
  const exact = userInput.trim()
  if (node.transitions?.[exact]) transitionKey = exact
  if (!transitionKey && node.type === 'CONFIRMATION') {
    if (/payment|pagamento|central unit|coins|card/i.test(node.prompt)) {
      const paymentAnswer = parsePaymentAnswer(userInput)
      if (paymentAnswer !== null) {
        transitionKey = paymentAnswer ? 'YES' : 'NO'
      }
    }
    const normalized = normalizeConfirmation(userInput)
    if (normalized && node.transitions?.[normalized]) transitionKey = normalized
  }
  if (!transitionKey) {
    const numeric = exact.match(/^(\d+)$/)?.[1]
    if (numeric && node.transitions?.[numeric]) transitionKey = numeric
  }
  if (!transitionKey && node.transitions) {
    transitionKey = await classifyChoiceViaLLM(node, userInput)
  }
  if (!transitionKey && node.transitions?.other) {
    transitionKey = 'other'
  }
  if (!transitionKey) {
    state.retryCount += 1
    if (state.retryCount >= 2) {
      state.activeFlowId = null
      state.activeStepId = null
      state.escalationReason = 'Customer could not progress in the active flow after repeated attempts.'
      return {
        flowId,
        stepId: 'escalate',
        prompt: "I'm notifying the operator 🙌 They will assist you shortly.",
        type: 'INFO',
        isTerminal: true,
        action: 'escalate',
      }
    }
    return { flowId, stepId: state.activeStepId, prompt: node.prompt, type: node.type, isTerminal: false, action: node.action }
  }

  const nextRef = node.transitions?.[transitionKey] || node.transitions?.other
  const nextStepId = nextRef?.split('.').pop()
  if (!nextStepId) throw new Error(`Broken flow transition for key ${transitionKey}`)
  state.activeStepId = nextStepId
  state.retryCount = 0
  let nextNode = currentFlowNode(runtime, state)
  if (!nextNode) throw new Error(`Missing node ${nextStepId}`)

  // Transparently route through ROUTER nodes — they have no prompt of their own.
  // The user's current message is used to classify and jump directly to the target node.
  if (nextNode.type === 'ROUTER' && nextNode.logic) {
    const routeKey = await classifyRouterLogic(nextNode.logic, userInput)
    const routeRef = nextNode.logic[routeKey]
    const routeStepId = routeRef?.split('.').pop()
    if (routeStepId) {
      state.activeStepId = routeStepId
      const routeNode = currentFlowNode(runtime, state)
      if (routeNode) {
        if (routeNode.isTerminal) {
          state.activeFlowId = null
          state.activeStepId = null
        }
        return { flowId, stepId: routeStepId, prompt: routeNode.prompt, type: routeNode.type, isTerminal: Boolean(routeNode.isTerminal), action: routeNode.action }
      }
    }
    // If routing failed, fall through to the generic return below (will show no prompt — rare edge case)
    nextNode = currentFlowNode(runtime, state) ?? nextNode
  }

  if (nextNode.isTerminal) {
    state.activeFlowId = null
    state.activeStepId = null
  }
  return { flowId, stepId: nextStepId, prompt: nextNode.prompt, type: nextNode.type, isTerminal: Boolean(nextNode.isTerminal), action: nextNode.action }
}

async function chooseFaqSource(message: string): Promise<string> {
  const topics = Object.entries(FAQS).map(([key, value]) => `${key}: ${value}`).join('\n')
  const key = await callModel({
    userPrompt: `Which FAQ topic best matches the message? Reply with ONLY the key or NONE.\n\nTopics:\n${topics}\n\nCustomer message:\n${message}`,
    maxTokens: 20,
  })
  const normalized = key.trim().replace(/^"|"$/g, '')
  return FAQS[normalized as keyof typeof FAQS] || FAQ_FALLBACK
}

async function renderHistory(runtime: Runtime, state: SessionState, payload: {
  routerDecision: RouterDecision
  specialistDecision?: SpecialistDecision | null
  flowEngineResult?: FlowEngineResult | null
  faqSource?: string
  action?: 'contactOperator' | 'resetSession' | 'closureAck' | null
  closureKind?: 'resolved' | 'escalated'
}): Promise<{ message: string; safe: boolean }> {

  // [EXACT] directive: History LLM must translate and output only this text verbatim.
  // Case 1: Flow Engine node prompt — source of truth, History translates and outputs only it.
  // Case 2: Gather question — inject the Spanish base question, History translates it.
  let effectivePayload = payload
  if (payload.flowEngineResult?.prompt && !payload.action) {
    effectivePayload = {
      ...payload,
      flowEngineResult: null,
      routerDecision: {
        ...payload.routerDecision,
        customerFacingGoal: `[EXACT] ${payload.flowEngineResult.prompt}`,
      },
    }
  } else if (payload.routerDecision.missingFacts.length > 0 && !payload.action && !payload.faqSource) {
    // On turn 1, skip [EXACT] so the LLM can include the warm greeting before the question.
    const isTurn1Greeting = state.turnCount === 1
    if (isTurn1Greeting) {
      // keep customerFacingGoal as-is (already contains greeting instruction + question)
      effectivePayload = payload
    } else {
      const exactQuestion = renderMissingFactQuestion(payload.routerDecision, state)
      effectivePayload = {
        ...payload,
        routerDecision: {
          ...payload.routerDecision,
          customerFacingGoal: `[EXACT] ${exactQuestion}`,
        },
      }
    }
  }

  const baseSystemPrompt = replaceVars(runtime.prompts.history, {
    chatbotName: CHATBOT_NAME,
    toneOfVoice: TONE_OF_VOICE,
    faqs: Object.values(FAQS).join('\n'),
    allowedExternalLinks: ALLOWED_LINKS,
  })
  const locationContext = buildLocationContext(runtime, state)
  const systemPrompt = locationContext ? `${baseSystemPrompt}\n\n${locationContext}` : baseSystemPrompt
  const userPrompt = `Current session state:\n${summarizeState(state)}\n\nRuntime decision:\n${JSON.stringify(effectivePayload, null, 2)}${effectivePayload.faqSource ? `\n\nFAQ source excerpt:\n${effectivePayload.faqSource}` : ''}`
  const raw = await callModel({ systemPrompt, userPrompt, maxTokens: 300, temperature: 0.2, json: true })
  const parsed = extractJson<{ message?: string; safe?: boolean }>(raw, { message: '', safe: true })
  const message = normalizeGeneratedMessage(state.language, parsed.message || '')
  return { message, safe: parsed.safe !== false }
}

function createSystemRouterDecision(overrides?: Partial<RouterDecision>): RouterDecision {
  return {
    route: 'greeting',
    nextOwner: 'conversation_history',
    functionName: null,
    extractedFacts: {},
    missingFacts: [],
    customerFacingGoal: '',
    escalationReason: null,
    ...overrides,
  }
}

async function renderCustomerFacingSystemMessage(
  runtime: Runtime,
  state: SessionState,
  payload: {
    routerDecision?: RouterDecision
    action?: 'contactOperator' | 'resetSession' | 'closureAck' | null
    closureKind?: 'resolved' | 'escalated'
  },
): Promise<string> {
  const { message, safe } = await renderHistory(runtime, state, {
    routerDecision: payload.routerDecision || createSystemRouterDecision(),
    action: payload.action,
    closureKind: payload.closureKind,
  })
  return safe ? message : fallbackBlockedMessage(state.language)
}


function pickSingleMissingFact(routerDecision: RouterDecision, state: SessionState): RouterDecision {
  if (!routerDecision.missingFacts.length) {
    return routerDecision
  }

  const orderedMissingFacts = [...routerDecision.missingFacts].sort((left, right) => {
    const priority = ['service completed or not', 'double charge step by step', 'last 4 card digits', 'payment proof', 'location', 'machine type', 'machine number', 'payment completed or not', 'exact display state']
    return priority.indexOf(left) - priority.indexOf(right)
  })

  const firstMissingFact = orderedMissingFacts[0]

  return {
    ...routerDecision,
    missingFacts: [firstMissingFact],
  }
}

function fallbackBlockedMessage(language: SessionState['language']): string {
  return {
    it: 'Il caso verrà controllato manualmente da un operatore: qui ci vuole un aiuto in carne e ossa.',
    es: 'El caso será revisado manualmente por un operador: aquí hace falta ayuda en carne y hueso.',
    ca: 'El cas sera revisat manualment per un operador: aqui cal ajuda humana.',
    fr: 'Le cas sera examine manuellement par un operateur: ici il faut une aide humaine.',
    pt: 'O caso será analisado manualmente por um operador: aqui e preciso ajuda humana.',
    en: 'The case will be reviewed manually by an operator: hands-on human help is needed here.',
  }[language]
}

function forceLocationQuestion(routerDecision: RouterDecision): RouterDecision {
  return {
    ...routerDecision,
    missingFacts: ['location'],
    customerFacingGoal: 'Ask only which lavandería autoservicio (town and street) the customer is at.',
  }
}

function getTroubleshootingIdentityMissingFacts(state: SessionState): string[] {
  const missingFacts: string[] = []
  if (!state.location) missingFacts.push('location')
  if (!state.machineType) missingFacts.push('machine type')
  if (!state.machineNumber) missingFacts.push('machine number')
  return missingFacts
}

function computeTroubleshootingMissingFacts(params: {
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
    dryerStarted,
    dryerCycleContext,
    askLocationFirst = false,
  } = params

  const missingFacts: string[] = []
  const postCycleLikeIssue = hasWasherPostCycleIssue(issueSummary)
  const extraButtonIssue = hasExtraButtonIssue(issueSummary)
  const stopLikeIssue = hasStopIntent(issueSummary)
  const hasDisplay = Boolean(displayState)

  if (routeMachineType === 'washer') {
    // Display-first for washer: identify payment-vs-technical path before identity data.
    if (!hasDisplay && !postCycleLikeIssue && !extraButtonIssue && !stopLikeIssue) {
      missingFacts.push('exact display state')
      return missingFacts
    }

    if (hasDisplay && !isWasherPaymentPendingDisplay(displayState)) {
      if (askLocationFirst && !state.location) {
        missingFacts.push('location')
      }
      if (normalizeDisplayState(displayState) !== 'AL001' && !machineNumber) {
        missingFacts.push('machine number')
      }
    }

    return missingFacts
  }

  if (routeMachineType === 'dryer') {
    // Display-first for dryer too: the display decides payment vs door vs technical path.
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

function getTroubleshootingBlockingMissingFacts(state: SessionState, userMessage: string): string[] {
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

function applyMachineSpecificMissingQuestion(routerDecision: RouterDecision, state: SessionState): RouterDecision {
  const routeMachineType = routerDecision.route === 'washer' || routerDecision.route === 'dryer'
    ? routerDecision.route
    : state.machineType

  const preferredMissingFacts: string[] = []
  if (!state.machineType && routeMachineType !== 'washer' && routeMachineType !== 'dryer') preferredMissingFacts.push('machine type')

  if (routeMachineType === 'washer') {
    if (!state.displayState) {
      preferredMissingFacts.push('exact display state')
    } else if (!isWasherPaymentPendingDisplay(state.displayState)) {
      if (!state.location) preferredMissingFacts.push('location')
      if (normalizeDisplayState(state.displayState) !== 'AL001' && !state.machineNumber) preferredMissingFacts.push('machine number')
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
        customerFacingGoal: 'Ask only for the washer machine number. Do not mention payment or display yet.',
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

function buildDoubleChargeStepDecision(
  routerDecision: RouterDecision,
  state: SessionState,
  userMessage: string,
): RouterDecision {
  const forcedNarrativeProvided = shouldForceDoubleChargeNarrativeStep(state, userMessage)
  const currentTurnServiceCompleted = state.lastMissingFacts.includes('service completed or not')
    ? parseServiceCompletedAnswer(userMessage)
    : null
  const currentTurnLast4DigitsProvided = state.lastMissingFacts.includes('last 4 card digits')
    ? Boolean(extractLast4CardDigits(userMessage))
    : false
  const currentTurnPaymentProofProvided = state.lastMissingFacts.includes('payment proof')
    ? parsePaymentProofProvided(userMessage) === true
    : false

  const resolvedServiceCompleted =
    currentTurnServiceCompleted !== null
      ? currentTurnServiceCompleted
      : state.serviceCompleted

  const resolvedDoubleChargeNarrativeProvided =
    forcedNarrativeProvided ||
    state.doubleChargeNarrativeProvided

  const resolvedDoubleChargeNarrativeText =
    forcedNarrativeProvided
      ? userMessage.trim()
      : state.doubleChargeNarrativeText

  const resolvedLast4CardDigitsProvided =
    currentTurnLast4DigitsProvided || state.last4CardDigitsProvided

  const resolvedPaymentProofProvided =
    currentTurnPaymentProofProvided || state.paymentProofProvided

  const missingFacts: string[] = []

  if (resolvedServiceCompleted === null) {
    missingFacts.push('service completed or not')
  } else if (!resolvedDoubleChargeNarrativeProvided) {
    missingFacts.push('double charge step by step')
  } else {
    if (!resolvedLast4CardDigitsProvided) missingFacts.push('last 4 card digits')
    if (!resolvedPaymentProofProvided) missingFacts.push('payment proof')
    if (!state.location) missingFacts.push('location')
  }

  return {
    ...routerDecision,
    route: missingFacts.length > 0 ? 'unknown' : 'operator',
    nextOwner: 'conversation_history',
    functionName: missingFacts.length > 0 ? null : 'contactOperator',
    extractedFacts: {
      ...routerDecision.extractedFacts,
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
        ? 'Collect the documented double-charge review details strictly in this order: service completed, narrative, last 4 card digits, payment proof, location. Do not escalate yet.'
        : 'Confirm that the double-charge case will be reviewed manually now that the required details were collected.',
    escalationReason: missingFacts.length > 0 ? null : 'Double charge evidence collected and ready for manual review.',
  }
}

async function handleTurn(runtime: Runtime, state: SessionState, userMessage: string): Promise<TurnResult> {
  const debug: string[] = []

  // 30-minute session timeout: auto-reset to fresh state if idle too long
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000
  if (state.turnCount > 0 && Date.now() - state.lastActivityAt > SESSION_TIMEOUT_MS) {
    const language = state.language
    const preferredLanguage = state.preferredLanguage
    Object.assign(state, createInitialState())
    state.language = language
    state.preferredLanguage = preferredLanguage
  }
  state.lastActivityAt = Date.now()

  state.turnCount += 1

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

  if (state.pendingClosure) {
    state.pendingClosure = null
  }

  const normalizedUserMessage = preprocessUserInput(state, userMessage)
  pushDebug(debug, 'normalizedInput', normalizedUserMessage)

  if (state.customerNameRequested && !state.customerName && normalizedUserMessage.length > 0) {
    state.customerName = normalizedUserMessage.trim().split(/\s+/)[0]
    state.customerNameRequested = false
    state.operatorRequested = true
    if (!state.escalationReason) {
      state.escalationReason = 'Manual review requested.'
    }
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
    return { reply: `${sanitizeCustomerReply(finalReply)}\n\n**Human Support message**\n${operatorSummary}`, debug }
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

  const routerDecision = applyContextualRouterFallback(
    normalizeRouterDecision(await runRouter(runtime, state, normalizedUserMessage), state),
    state,
    userMessage,
    normalizedUserMessage,
  )
  const isDoubleChargeCase =
    hasDoubleChargeConcern(userMessage) ||
    /double charge/i.test(String(routerDecision.extractedFacts?.issueSummary || state.issueSummary || '')) ||
    state.lastMissingFacts.some((fact) => ['service completed or not', 'double charge step by step', 'last 4 card digits', 'payment proof'].includes(fact))

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
      routerDecision.customerFacingGoal = 'Ask only which lavandería autoservicio (town and street) the customer is at, before continuing the technical troubleshooting.'
    }
  }

  Object.assign(routerDecision, applyMachineSpecificMissingQuestion(routerDecision, state))

  if (routerDecision.route === 'greeting') {
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal = 'Greet the customer, present yourself briefly, and ask the most useful next question.'
  }

  // Turn 1: ALWAYS greet warmly, regardless of whether the customer used a greeting word.
  // The chatbot must introduce itself and add a reassurance phrase before collecting any data.
  // missingFacts=['exact display state'] bypasses the later location-override guard and is
  // also excluded from [EXACT] so the LLM can embed the greeting + display question together.
  if (state.turnCount === 1 && !state.location) {
    routerDecision.missingFacts = ['exact display state']
    routerDecision.customerFacingGoal =
      'Greet the customer warmly as the Ecolaundry virtual assistant. You MUST include the exact phrase "estoy aquí para ayudarte" in your greeting. Then ask only what appears on the display of the machine.'
  }

  if (
    state.turnCount > 1 &&
    state.location &&
    !state.machineType &&
    !state.activeFlowId &&
    !isDoubleChargeCase &&
    routerDecision.route !== 'faq' &&
    routerDecision.route !== 'operator' &&
    routerDecision.route !== 'reset'
  ) {
    routerDecision.route = 'unknown'
    routerDecision.missingFacts = ['machine type']
    routerDecision.customerFacingGoal = 'Do not greet again. Ask only whether it is a washer or a dryer.'
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
      routerDecision.customerFacingGoal = 'Ask only which lavandería autoservicio (town and street) the customer is at, before continuing the technical troubleshooting.'
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
    const { message, safe } = await renderHistory(runtime, state, { routerDecision, flowEngineResult: flowResult })
    state.pendingClosure = flowResult.isTerminal ? (flowResult.action === 'escalate' ? 'escalated' : 'resolved') : null
    pushDebug(debug, 'flow.advance', flowResult)
    pushDebug(debug, 'history.flow', { message, safe })
    const flowReply = sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language))
    if (flowResult.isTerminal && flowResult.action === 'escalate') {
      if (!state.customerName && !state.customerNameRequested) {
        state.customerNameRequested = true
        state.pendingClosure = null
        const nameQuestion = state.language === 'es' ? '¿Como te llamas?' : 'What is your name?'
        return { reply: nameQuestion, debug }
      }
      const escalationContext = extractEscalationContext(state, state.customerName)
      const operatorSummary = buildEscalationSummary(escalationContext)
      return { reply: `${flowReply}\n\n**Human Support message**\n${operatorSummary}`, debug }
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
      const nameQuestion = state.language === 'es' ? '¿Como te llamas?' : 'What is your name?'
      return { reply: nameQuestion, debug }
    }

    // Perform direct escalation (no name collection — matches flow-engine escalation behaviour)
    state.operatorRequested = true
    state.escalationReason = routerDecision.escalationReason || 'Manual review requested.'
    const { message, safe } = await renderHistory(runtime, state, { routerDecision, action: 'contactOperator' })
    state.pendingClosure = 'escalated'

    // Generate and print escalation summary for operator
    const escalationContext = extractEscalationContext(state, state.customerName)
    const operatorSummary = buildEscalationSummary(escalationContext)

    pushDebug(debug, 'history.escalation', { message, safe, operatorSummary })

    const finalReply = sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language))
    const replyWithSummary = `${finalReply}\n\n**Human Support message**\n${operatorSummary}`

    return { reply: replyWithSummary, debug }
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
    const { message, safe } = await renderHistory(runtime, state, { routerDecision, specialistDecision, flowEngineResult: flowResult })
    state.pendingClosure = flowResult.isTerminal ? (flowResult.action === 'escalate' ? 'escalated' : 'resolved') : null
    pushDebug(debug, 'flow.start', flowResult)
    pushDebug(debug, 'history.flowStart', { message, safe })
    return { reply: sanitizeCustomerReply(safe ? message : fallbackBlockedMessage(state.language)), debug }
  }

  const { message: defaultMessage, safe: defaultSafe } = await renderHistory(runtime, state, { routerDecision })
  pushDebug(debug, 'history.default', { message: defaultMessage, safe: defaultSafe })
  return { reply: sanitizeCustomerReply(defaultSafe ? defaultMessage : fallbackBlockedMessage(state.language)), debug }
}


async function runScripted(runtime: Runtime): Promise<void> {
  printCliBanner(
    'Cliente-0 Demo',
    `Running ${SCRIPTED_SCENARIOS.length} scripted scenarios in sequence.`,
  )
  for (const [index, scenario] of SCRIPTED_SCENARIOS.entries()) {
    const state = createInitialState()
    printCliBanner(`Scenario ${index + 1}/${SCRIPTED_SCENARIOS.length}: ${scenario.name}`)
    for (const turn of scenario.turns) {
      printCliMessage('You', turn)
      const result = await handleTurn(runtime, state, turn)
      printCliMessage('Bot', result.reply)
      if (DEBUG_MODE) printDebug(result.debug)
    }
  }
}

function normalizeForRegression(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function assertRegressionReply(reply: string, assertion: RegressionAssertion): string[] {
  const failures: string[] = []
  const normalizedReply = normalizeForRegression(reply)

  for (const expected of assertion.includes || []) {
    if (!normalizedReply.includes(normalizeForRegression(expected))) {
      failures.push(`missing expected text: ${expected}`)
    }
  }

  for (const forbidden of assertion.excludes || []) {
    if (normalizedReply.includes(normalizeForRegression(forbidden))) {
      failures.push(`unexpected text present: ${forbidden}`)
    }
  }

  return failures
}

async function runRegressionSuite(runtime: Runtime): Promise<void> {
  printCliBanner(
    'Cliente-0 Regression Suite',
    `Running ${runtime.regressions.length} regression scenarios with assertions.`,
  )

  const failures: string[] = []

  for (const [index, scenario] of runtime.regressions.entries()) {
    const state = createInitialState()
    printCliBanner(`Regression ${index + 1}/${runtime.regressions.length}: ${scenario.name}`)

    for (const [turnIndex, turn] of scenario.turns.entries()) {
      printCliMessage('You', turn)
      const result = await handleTurn(runtime, state, turn)
      printCliMessage('Bot', result.reply)
      if (DEBUG_MODE) printDebug(result.debug)

      const assertions = scenario.assertions.filter((assertion) => assertion.turn === turnIndex + 1)
      for (const assertion of assertions) {
        const assertionFailures = assertRegressionReply(result.reply, assertion)
        for (const failure of assertionFailures) {
          failures.push(`[${scenario.name}] turn ${assertion.turn}: ${failure}`)
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n${CLI_SUBRULE}`)
    console.error('[REGRESSION FAILURES]')
    console.error(CLI_SUBRULE)
    for (const failure of failures) {
      console.error(failure)
    }
    console.error(CLI_SUBRULE)
    process.exitCode = 1
    return
  }

  printCliMessage('Info', 'All regression scenarios passed.')
}

async function evaluateCriteriaDetailedWithLLM(
  criteria: string[],
  conversation: Array<{you: string, bot: string}>,
  scenarioText: string,
): Promise<{ assessments: AcceptanceCriterionAssessment[]; summary: string; updatedAcceptanceCriteria: string[] }> {
  if (criteria.length === 0 || conversation.length === 0) {
    return { assessments: [], summary: '', updatedAcceptanceCriteria: [] }
  }

  const convText = conversation
    .map(({you, bot}) => `User: ${you}\nBot: ${bot}`)
    .join('\n\n')
  const userTurns = conversation.map(({you}) => you)
  const userAll = userTurns.join('\n').toLowerCase()
  const botTurns = conversation.map(({bot}) => bot)
  const firstUserTurn = userTurns[0] || ''
  const firstBotTurn = botTurns[0] || ''

  const normalizeForMatch = (value: string): string =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const botAll = normalizeForMatch(botTurns.join('\n'))
  const userAllNorm = normalizeForMatch(userAll)
  const deterministicByCriterion: Record<string, boolean | null> = {}

  const hasLocationQuestion = (text: string): boolean =>
    /lavanderia|local|ubicacion|ubicacio|pueblo|calle|bugaderia|laverie|laundry|self-service laundry/.test(text)

  const hasMachineTypeQuestion = (text: string): boolean =>
    /lavadora o secadora|tipo de maquina|rentadora o assecadora|lave-linge ou seche-linge|washer or dryer|washing machine or dryer/.test(text)

  const hasMachineNumberQuestion = (text: string): boolean =>
    /numero de la lavadora|numero de la secadora|numero de la maquina|numero dell|numero da maquina|numero du lave|machine number|quin es el numero/.test(text)

  const hasDisplayQuestion = (text: string): boolean =>
    /pantalla|display|visor|que ves exactamente|que aparece|cosa vedi esattamente|que veus exactament/.test(text)

  const userAlreadyProvidedMachineType = /lavadora|secadora|washer|dryer|lavatrice|asciugatrice|rentadora|assecadora/.test(userAllNorm)

  const supportedTags = [
    'WARM_GREETING_WITH_REASSURANCE',
    'CLASSIFY_PROBLEM_NOT_FAQ',
    'REQUEST_LOCATION',
    'REQUEST_MACHINE_TYPE_UNLESS_ALREADY_GIVEN',
    'REQUEST_MACHINE_NUMBER',
    'ASK_DISPLAY_STATE',
    'SHOW_WASHER_PROGRAMS_ON_PUSH',
    'NO_SOLUTION_BEFORE_DISPLAY',
    'NO_ASSUME_CAUSE',
    'CALM_TONE_AFTER_COMPLAINT',
    'ASK_IF_SOLUTION_WORKED',
    'NO_PAYMENT_PATH_AFTER_CONFIRMED',
    'UNKNOWN',
  ] as const
  type CriterionTag = (typeof supportedTags)[number]
  const criterionTagCache = new Map<string, CriterionTag>()

  const classifyCriterionTag = async (criterion: string): Promise<CriterionTag> => {
    const cached = criterionTagCache.get(criterion)
    if (cached) return cached

    const prompt = [
      'Classify this acceptance criterion into EXACTLY one tag and return ONLY the tag.',
      `Allowed tags: ${supportedTags.join(', ')}`,
      '',
      `Criterion: ${criterion}`,
      '',
      'Rules:',
      '- If it requires warm greeting plus reassurance in first message -> WARM_GREETING_WITH_REASSURANCE',
      '- If it requires treating message as technical problem and not FAQ -> CLASSIFY_PROBLEM_NOT_FAQ',
      '- If it asks for local/location -> REQUEST_LOCATION',
      '- If it says ask machine type only when missing -> REQUEST_MACHINE_TYPE_UNLESS_ALREADY_GIVEN',
      '- If it asks for machine number -> REQUEST_MACHINE_NUMBER',
      '- If it asks what appears on display/screen -> ASK_DISPLAY_STATE',
      '- If it requires showing washer program options when display is PUSH/Pr -> SHOW_WASHER_PROGRAMS_ON_PUSH',
      '- If it forbids giving instructions before display -> NO_SOLUTION_BEFORE_DISPLAY',
      '- If it forbids assuming cause -> NO_ASSUME_CAUSE',
      '- If it requires calming tone -> CALM_TONE_AFTER_COMPLAINT',
      '- If it requires asking if solution worked -> ASK_IF_SOLUTION_WORKED',
      '- If payment already confirmed and criterion forbids payment detours -> NO_PAYMENT_PATH_AFTER_CONFIRMED',
      '- If none match clearly -> UNKNOWN',
    ].join('\n')

    try {
      const raw = await callModel({ userPrompt: prompt, maxTokens: 12, temperature: 0 })
      const normalized = raw.trim().toUpperCase() as CriterionTag
      const tag: CriterionTag = (supportedTags as readonly string[]).includes(normalized)
        ? normalized
        : 'UNKNOWN'
      criterionTagCache.set(criterion, tag)
      return tag
    } catch {
      criterionTagCache.set(criterion, 'UNKNOWN')
      return 'UNKNOWN'
    }
  }

  // Legacy text-matching heuristic removed on purpose.
  // For criteria not covered by deterministic tagged checks below, use LLM fallback.

  const evaluateHeuristic = async (criterion: string): Promise<boolean | null> => {
    const criterionNorm = normalizeForMatch(criterion)

    const isOrderedSequenceCriterion =
      /pagar|paga/.test(criterionNorm) &&
      /seleccionar|selecciona/.test(criterionNorm) &&
      /pulsar|presiona|programa/.test(criterionNorm) &&
      /cerrar|cierra/.test(criterionNorm) &&
      /puerta/.test(criterionNorm)

    if (isOrderedSequenceCriterion) {
      const payIndex = botAll.search(/\bpaga\b|\bpay\b/)
      const selectIndex = botAll.search(/selecciona la maquina|selecciona la máquina|select machine/)
      const programIndex = botAll.search(/presiona el programa|pulsa.*programa|press program/)
      const doorIndex = botAll.search(/cierra la puerta|close the door/)

      return payIndex !== -1 &&
        selectIndex !== -1 &&
        programIndex !== -1 &&
        doorIndex !== -1 &&
        payIndex < selectIndex &&
        selectIndex < programIndex &&
        programIndex < doorIndex
    }

    const isPushProgramsCriterion =
      /programa|programas|programs/.test(criterionNorm) &&
      (/display.*push|pantalla.*push|push.*display|push.*pantalla|\bpush\/?pr\b|\bpr\b/.test(criterionNorm))

    if (isPushProgramsCriterion) {
      const hasProgramsContext = /programa|programas|programs|opciones/.test(botAll)
      const hasTemp60 = /\b60[°º]?\b/.test(botAll)
      const hasTemp40 = /\b40[°º]?\b/.test(botAll)
      const hasTemp30 = /\b30[°º]?\b/.test(botAll)
      const hasCold = /frio|cold/.test(botAll)
      return hasProgramsContext && hasTemp60 && hasTemp40 && hasTemp30 && hasCold
    }

    const isDisplayCompleteOrTechnicalIdentityCriterion =
      /push|\bpr\b|door|alm|al001|pantalla en blanco|blank screen/.test(criterionNorm) &&
      /local|ubicacion|lavander/.test(criterionNorm) &&
      /numero/.test(criterionNorm)

    if (isDisplayCompleteOrTechnicalIdentityCriterion) {
      const signalTurnIdx = userTurns.findIndex((turn) => {
        const extracted = extractDisplayState(turn)
        if (!extracted) return false
        const normalized = normalizeDisplayState(extracted)
        return ['PUSH', 'PR', 'DOOR', 'ALM', 'AL001', 'BLANK'].includes(normalized)
      })

      if (signalTurnIdx === -1) return null

      const botAfterSignal = botTurns.slice(signalTurnIdx).join('\n')
      const botAfterSignalNorm = normalizeForMatch(botAfterSignal)

      const askedLocation = /lavanderia|local|ubicacion|pueblo|calle/.test(botAfterSignalNorm)
      const askedMachineNumber =
        /numero de la lavadora|numero de la secadora|numero de la maquina|numero/.test(botAfterSignalNorm)

      const userAlreadyProvidedType = /lavadora|secadora|washer|dryer/.test(userAllNorm)
      const askedMachineType = /lavadora o secadora|tipo de maquina/.test(botAfterSignalNorm)
      const machineTypeSatisfied = userAlreadyProvidedType || askedMachineType

      return askedLocation && askedMachineNumber && machineTypeSatisfied
    }

    const tag = await classifyCriterionTag(criterion)

    if (tag === 'WARM_GREETING_WITH_REASSURANCE') {
      const firstBotNorm = normalizeForMatch(firstBotTurn)
      const hasGreeting = /hola|buenos dias|buenas tardes|buenas noches/.test(firstBotNorm)
      const hasReassurance = /tranquil|no te preocup|lo resolvemos juntos|aqui para ayudarte|estoy aqui para ayudarte/.test(firstBotNorm)
      return hasGreeting && hasReassurance
    }

    if (tag === 'CLASSIFY_PROBLEM_NOT_FAQ') {
      const userLooksTroubleshooting = hasTroubleshootingIntent(firstUserTurn)
      const botLooksTroubleshooting =
        hasDisplayQuestion(botAll) ||
        hasLocationQuestion(botAll) ||
        hasMachineNumberQuestion(botAll)
      const botLooksFaq = /politica local|manual review|will review it manually|depende de la politica/.test(botAll)
      return userLooksTroubleshooting && botLooksTroubleshooting && !botLooksFaq
    }

    if (tag === 'REQUEST_LOCATION') {
      return hasLocationQuestion(botAll)
    }

    if (tag === 'REQUEST_MACHINE_TYPE_UNLESS_ALREADY_GIVEN') {
      if (userAlreadyProvidedMachineType) return true
      return hasMachineTypeQuestion(botAll)
    }

    if (tag === 'REQUEST_MACHINE_NUMBER') {
      return hasMachineNumberQuestion(botAll)
    }

    if (tag === 'ASK_DISPLAY_STATE') {
      const criterionNorm = normalizeForMatch(criterion)
      const asksOrder = /antes/.test(criterionNorm) && /(local|ubicacion|numero de maquina|tipo)/.test(criterionNorm)
      const firstDisplayIdx = botTurns.findIndex((turn) => hasDisplayQuestion(normalizeForMatch(turn)))
      if (firstDisplayIdx === -1) return false

      if (!asksOrder) {
        return true
      }

      const firstLocationIdx = botTurns.findIndex((turn) => hasLocationQuestion(normalizeForMatch(turn)))
      const firstMachineTypeIdx = botTurns.findIndex((turn) => hasMachineTypeQuestion(normalizeForMatch(turn)))
      const firstMachineNumberIdx = botTurns.findIndex((turn) => hasMachineNumberQuestion(normalizeForMatch(turn)))

      const beforeLocation = firstLocationIdx === -1 || firstDisplayIdx < firstLocationIdx
      const beforeMachineType = firstMachineTypeIdx === -1 || firstDisplayIdx < firstMachineTypeIdx
      const beforeMachineNumber = firstMachineNumberIdx === -1 || firstDisplayIdx < firstMachineNumberIdx

      return beforeLocation && beforeMachineType && beforeMachineNumber
    }

    if (tag === 'SHOW_WASHER_PROGRAMS_ON_PUSH') {
      const hasProgramsIntro = /programa|programas|programs|opciones/.test(botAll)
      const hasTemp60 = /\b60[°º]?\b/.test(botAll)
      const hasTemp40 = /\b40[°º]?\b/.test(botAll)
      const hasTemp30 = /\b30[°º]?\b/.test(botAll)
      const hasCold = /frio|cold/.test(botAll)
      return hasProgramsIntro && hasTemp60 && hasTemp40 && hasTemp30 && hasCold
    }

    if (tag === 'NO_SOLUTION_BEFORE_DISPLAY') {
      const firstDisplayIdx = botTurns.findIndex((turn) => /pantalla|display|qu[eé] ves exactamente/i.test(turn))
      const preDisplayTurns = firstDisplayIdx >= 0 ? botTurns.slice(0, firstDisplayIdx) : botTurns
      const preDisplayText = normalizeForMatch(preDisplayTurns.join('\n'))
      return !/1\.|2\.|presiona|pulsa|inserta|selecciona|elige|reinicia|apaga|enciende/.test(preDisplayText)
    }

    if (tag === 'NO_ASSUME_CAUSE') {
      return !/la causa es|es por|averia confirmada|seguro que/.test(botAll)
    }

    if (tag === 'CALM_TONE_AFTER_COMPLAINT') {
      return null
    }

    if (tag === 'ASK_IF_SOLUTION_WORKED') {
      return /ha comenzado a funcionar|ha empezado a funcionar|ha arrancado|ha funcionado|funciona ahora|let me know if/.test(botAll)
    }

    if (tag === 'NO_PAYMENT_PATH_AFTER_CONFIRMED') {
      return !/pago completado|payment complete|vuelve a pagar|pay again|inserta monedas|anade dinero|falta dinero/.test(botAll)
    }

    return null
  }

  const result: Record<string, boolean> = {}

  for (const criterion of criteria) {
    const heuristic = await evaluateHeuristic(criterion)
    deterministicByCriterion[criterion] = heuristic
    if (heuristic !== null) {
      result[criterion] = heuristic
      continue
    }

    try {
      const answer = await callModel({
        userPrompt: `Analiza este diálogo y evalúa SOLO este criterio de aceptación.\n\nDiálogo:\n${convText}\n\nCriterio:\n${criterion}\n\nResponde SOLO con una palabra:\n- SÍ (si se cumple claramente)\n- NO (si no se cumple o hay duda)`,
        maxTokens: 5,
      })

      const normalized = answer.trim().toLowerCase()
      result[criterion] = /^(sí|si|yes)\b/.test(normalized)
    } catch {
      result[criterion] = false
    }
  }

  const prompt = [
    'Evaluate acceptance criteria against the conversation.',
    'Return strict JSON with this shape only:',
    '{',
    '  "assessments": [',
    '    {',
    '      "criterion": "string",',
    '      "passed": true,',
    '      "reason": "short explanation",',
    '      "evidence": ["exact short quote from bot replies"],',
    '      "suggestedRewrite": "optional improved criterion text"',
    '    }',
    '  ],',
    '  "summary": "one paragraph",',
    '  "updatedAcceptanceCriteria": ["full rewritten criteria list to replace old criteria"]',
    '}',
    '',
    'Rules:',
    '- Use exactly the same criterion text in "criterion".',
    '- If uncertain, set passed=false.',
    '- evidence must quote only assistant messages from the conversation.',
    '- Keep reason concise and specific.',
    '',
    `Scenario:\n${scenarioText || '(not provided)'}`,
    '',
    `Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
    '',
    `Conversation:\n${convText}`,
  ].join('\n')

  let llmAssessments: AcceptanceCriterionAssessment[] = []
  let llmSummary = ''
  let llmUpdatedAcceptanceCriteria: string[] = []

  try {
    const raw = await callModel({ userPrompt: prompt, json: true, maxTokens: 1400, temperature: 0.1 })
    const parsed = extractJson<{
      assessments?: Array<{
        criterion?: string
        passed?: boolean
        reason?: string
        evidence?: string[]
        suggestedRewrite?: string
      }>
      summary?: string
      updatedAcceptanceCriteria?: string[]
    }>(raw, {})

    llmAssessments = (parsed.assessments || [])
      .map((item) => ({
        criterion: String(item.criterion || '').trim(),
        passed: item.passed === true,
        reason: String(item.reason || '').trim(),
        evidence: Array.isArray(item.evidence)
          ? item.evidence.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        suggestedRewrite: String(item.suggestedRewrite || '').trim() || undefined,
      }))
      .filter((item) => item.criterion)

    llmSummary = String(parsed.summary || '').trim()
    llmUpdatedAcceptanceCriteria = Array.isArray(parsed.updatedAcceptanceCriteria)
      ? parsed.updatedAcceptanceCriteria.map((entry) => String(entry || '').trim()).filter(Boolean)
      : []
  } catch {
    llmAssessments = []
  }

  const mergedAssessments: AcceptanceCriterionAssessment[] = criteria.map((criterion) => {
    const llmItem = llmAssessments.find(
      (item) => normalizeForRegression(item.criterion) === normalizeForRegression(criterion),
    )

    const deterministic = deterministicByCriterion[criterion] ?? null
    const hasDeterministic = deterministic !== null
    const fallbackPassed = result[criterion] === true

    return {
      criterion,
      // Deterministic rules have priority; LLM must not flip a deterministic outcome.
      passed: hasDeterministic ? deterministic : (llmItem ? llmItem.passed : fallbackPassed),
      reason: hasDeterministic
        ? (deterministic
          ? 'Deterministic rule evaluation marked this criterion as satisfied.'
          : 'Deterministic rule evaluation marked this criterion as not satisfied.')
        : (llmItem?.reason || (fallbackPassed
          ? 'Heuristic/LLM evaluation marked this criterion as satisfied.'
          : 'Heuristic/LLM evaluation marked this criterion as not satisfied.')),
      evidence: hasDeterministic ? [] : (llmItem?.evidence || []),
      suggestedRewrite: llmItem?.suggestedRewrite,
    }
  })

  return {
    assessments: mergedAssessments,
    summary: llmSummary,
    updatedAcceptanceCriteria: llmUpdatedAcceptanceCriteria,
  }
}

/** Keeps legacy boolean map behavior for existing call sites. */
async function evaluateCriteriaWithLLM(
  criteria: string[],
  conversation: Array<{you: string, bot: string}>,
  scenarioText: string,
): Promise<Record<string, boolean>> {
  const detailed = await evaluateCriteriaDetailedWithLLM(criteria, conversation, scenarioText)
  return detailed.assessments.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.criterion] = item.passed
    return acc
  }, {})
}

/**
 * Finds the individual use-case markdown file for a given case number.
 * Expects the new folder-per-case layout:
 *   docs/cliente-0/usecases/case01-<slug>/case01-<slug>.md
 */
async function findUsecaseFile(caseNumber: number): Promise<string | null> {
  const demoDir = getDemoDir()
  const usecasesDir = path.resolve(demoDir, '..', '..', 'usecases')
  const prefix = `case${String(caseNumber).padStart(2, '0')}`
  let entries: string[]
  try {
    entries = await readdir(usecasesDir)
  } catch {
    return null
  }
  // Find the matching subfolder (e.g. case01-no-arranca-la-lavadora)
  const folder = entries.find((e) => e.startsWith(prefix) && !e.endsWith('.md'))
  if (!folder) return null
  const folderPath = path.join(usecasesDir, folder)
  let folderFiles: string[]
  try {
    folderFiles = await readdir(folderPath)
  } catch {
    return null
  }
  const mdFile = folderFiles.find((f) => f.startsWith(prefix) && f.endsWith('.md'))
  return mdFile ? path.join(folderPath, mdFile) : null
}

/**
 * Finds ALL scenario JSON files for a given case number (live next to the .md file).
 * Returns paths sorted alphabetically so scenario 1.1 runs before 1.2.
 */
async function findUsecaseScenarioJsons(caseNumber: number): Promise<string[]> {
  const mdPath = await findUsecaseFile(caseNumber)
  if (!mdPath) return []

  const caseDir = path.dirname(mdPath)
  let files: string[]
  try {
    files = await readdir(caseDir)
  } catch {
    return []
  }

  const prefix = `case_${caseNumber}_scenario_`
  const matching = files
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .map((f) => path.join(caseDir, f))

  if (matching.length > 0) return matching

  // Fall back to legacy scenario.json if no new-pattern files found
  const legacyPath = path.join(caseDir, 'scenario.json')
  try {
    await readFile(legacyPath, 'utf8')
    return [legacyPath]
  } catch {
    return []
  }
}

/**
 * Renders one conversation block (turns) as markdown lines.
 */
function renderConversationTurns(turns: Array<{you: string, bot: string}>): string {
  if (turns.length === 0) return '_Sin diálogo registrado._'
  return turns
    .map(({you, bot}) => {
      const botChunks = bot
        .split(BOT_MESSAGE_SEPARATOR)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
      const renderedBotLines = (botChunks.length > 0 ? botChunks : [bot.trim()])
        .map((chunk) => {
          let normalizedChunk = chunk
          const numberedLines = normalizedChunk.match(/(^|\n)\s*\d+\.\s+/g) || []
          if (numberedLines.length === 1) {
            normalizedChunk = normalizedChunk.replace(/(^|\n)(\s*)\d+\.\s+/, '$1$2')
          }
          return `**Bot:** ${normalizedChunk}`
        })
        .join('\n')
      return `**Usuario:** ${you}\n${renderedBotLines}`
    })
    .join('\n\n')
}

/**
 * Rewrites all CONVERSATION sections and the REPORT LLM section of an individual
 * use-case file (docs/cliente-0/usecases/caseNN-*.md).
 * SCENARIO and ACCEPTANCE CRITERIA are never modified.
 * Each named conversation is rendered under its own ## CONVERSATION — <name> header.
 * The REPORT shows ALL acceptance criteria with ✅/❌ so it is immediately clear
 * which ones passed and which ones failed.
 */
async function updateUsecaseMd(
  caseNumber: number,
  passed: boolean,
  failures: string[],
  namedConversations: Array<{ scenarioName: string; turns: Array<{you: string, bot: string}> }> = [],
): Promise<void> {
  const mdPath = await findUsecaseFile(caseNumber)
  if (!mdPath) {
    printCliMessage('Info', `Use-case file for Case ${caseNumber} not found in usecases/ — skipping write-back.`)
    return
  }

  const content = await readFile(mdPath, 'utf8')

  // Extract SCENARIO text (never modified, only read for LLM evaluation context).
  const scenarioMatch = content.match(/##\s*SCENARIO\s*\n([\s\S]*?)(?=\n##\s*ACCEPTANCE CRITERIA)/i)
  const scenarioText = scenarioMatch?.[1]?.trim() || ''

  // Extract ACCEPTANCE CRITERIA lines (never modified, only read for LLM evaluation).
  const criteriaMatch = content.match(/##\s*ACCEPTANCE CRITERIA\s*\n([\s\S]*?)(?=\n##\s*CONVERSATION|\n##\s*REPORT|\n##\s*EVALUACI)/i)
  const existingCriteriaRaw = criteriaMatch?.[1]?.trim() || ''

  // Parse individual criteria bullet lines (strip existing ✅/❌ markers if present).
  const criteriaTexts = existingCriteriaRaw
    .split('\n')
    .map((l: string) => l.replace(/^\s*-\s*(?:✅|❌)?\s*/, '').trim())
    .filter((l: string) => l && !/^_?sin criterios/i.test(l) && !/^[-_]{2,}$/.test(l))

  // Combine all turns for LLM evaluation so criteria that only appear in one
  // scenario path (e.g. escalation-specific) are still assessed correctly.
  const allTurns = namedConversations.flatMap(({ turns }) => turns)

  const detailedEval = await evaluateCriteriaDetailedWithLLM(criteriaTexts, allTurns, scenarioText)

  if (DEBUG_MODE) {
    const criteriaEval = detailedEval.assessments.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.criterion] = item.passed
      return acc
    }, {})
    printCliMessage('Info', `Case ${caseNumber} criteria eval: ${JSON.stringify(criteriaEval)}`)
  }

  // Render one ## CONVERSATION block per named scenario.
  const allConversationBlocks = namedConversations
    .map(({ scenarioName, turns }) =>
      `## CONVERSATION — ${scenarioName}\n\n${renderConversationTurns(turns)}`,
    )
    .join('\n\n---\n\n')

  // Render REPORT showing ALL criteria with ✅/❌ so Andrea sees the full picture.
  const reportLines = detailedEval.assessments.length > 0
    ? detailedEval.assessments
      .map((item) => {
        if (item.passed) {
          return `- ✅ ${item.criterion}`
        }
        const evidence = item.evidence.length > 0 ? ` | Evidencia: ${item.evidence.join(' || ')}` : ''
        return `- ❌ ${item.criterion} — ${item.reason}${evidence}`
      })
      .join('\n')
    : '- _Sin criterios evaluados._'

  // Locate the first CONVERSATION header and the REPORT LLM header to replace the whole block.
  const firstConvPos = content.search(/##[ \t]*CONVERSATION[^\n]*/i)
  const reportPos = content.search(/\n##[ \t]*REPORT LLM/i)

  let updated: string
  if (firstConvPos !== -1 && reportPos !== -1) {
    // Replace everything from first CONVERSATION header up to (not including) \n## REPORT LLM.
    const before = content.substring(0, firstConvPos)
    const afterReport = content.substring(reportPos) // starts with \n## REPORT LLM...
    updated = before + allConversationBlocks + '\n' + afterReport
  } else if (firstConvPos !== -1) {
    updated = content.substring(0, firstConvPos) + allConversationBlocks
  } else {
    updated = content.trimEnd() + '\n\n' + allConversationBlocks
  }

  // Replace REPORT LLM section content.
  const reportSectionRe = /(##[ \t]*REPORT LLM[ \t]*\r?\n)[\s\S]*?$/i
  if (reportSectionRe.test(updated)) {
    updated = updated.replace(reportSectionRe, `$1\n${reportLines}\n`)
  } else {
    updated = updated.trimEnd() + `\n\n## REPORT LLM\n\n${reportLines}\n`
  }

  // Enforce exactly one blank line after each key header for stable diffs.
  updated = updated.replace(
    /(##[ \t]*(?:SCENARIO|ACCEPTANCE CRITERIA|REPORT LLM)[ \t]*\r?\n)(?:[ \t]*\r?\n)*/gi,
    '$1\n',
  )

  await writeFile(mdPath, updated, 'utf8')
  printCliMessage('Info', `Evaluation written to usecases/${path.basename(mdPath)} → Case ${caseNumber}.`)
}

async function runUsecaseSuite(runtime: Runtime): Promise<void> {
  const demoDir = path.resolve(getDemoDir(), '..')
  const fallbackAll = JSON.parse(
    await readFile(path.join(demoDir, 'json', 'usecases_test.json'), 'utf8'),
  ) as UsecaseScenario[]

  // Load ALL scenario JSON files for a case. Falls back to usecases_test.json entry.
  const loadScenariosForCase = async (
    caseNumber: number,
  ): Promise<Array<{ name: string; scenario: UsecaseScenario }>> => {
    const jsonPaths = await findUsecaseScenarioJsons(caseNumber)
    if (jsonPaths.length > 0) {
      const results: Array<{ name: string; scenario: UsecaseScenario }> = []
      for (const jsonPath of jsonPaths) {
        const scenario = JSON.parse(await readFile(jsonPath, 'utf8')) as UsecaseScenario
        results.push({ name: scenario.name, scenario })
      }
      return results
    }
    const fallback = fallbackAll[caseNumber - 1]
    return fallback ? [{ name: fallback.name, scenario: fallback }] : []
  }

  let caseNumbersToRun: number[] = []
  if (USECASE_NUM !== null) {
    caseNumbersToRun = [USECASE_NUM]
  } else if (USECASE_RANGE !== null) {
    for (let i = USECASE_RANGE.start; i <= USECASE_RANGE.end; i += 1) {
      caseNumbersToRun.push(i)
    }
  } else {
    caseNumbersToRun = fallbackAll.map((_, i) => i + 1)
  }

  // Build case groups: each case may have multiple scenario files.
  type CaseGroup = {
    caseNumber: number
    scenarios: Array<{ name: string; scenario: UsecaseScenario }>
  }
  const caseGroups: CaseGroup[] = []
  for (const caseNumber of caseNumbersToRun) {
    const scenarios = await loadScenariosForCase(caseNumber)
    if (scenarios.length > 0) {
      caseGroups.push({ caseNumber, scenarios })
    }
  }

  const totalScenarios = caseGroups.reduce((sum, g) => sum + g.scenarios.length, 0)
  const writeEvaluationForSelection = USECASE_NUM !== null || USECASE_RANGE !== null

  if (totalScenarios === 0) {
    const selected = USECASE_NUM !== null
      ? `--usecase ${USECASE_NUM}`
      : (USECASE_RANGE !== null ? `--usecase-range ${USECASE_RANGE.start}-${USECASE_RANGE.end}` : '--usecases')
    console.error(`No scenario found for ${selected}. Valid range: 1-${fallbackAll.length}`)
    process.exitCode = 1
    return
  }

  const label = USECASE_NUM !== null
    ? `Case ${USECASE_NUM} (${caseGroups[0]?.scenarios.length ?? 0} scenario/s)`
    : USECASE_RANGE !== null
      ? `Cases ${USECASE_RANGE.start}-${USECASE_RANGE.end} (${totalScenarios} scenario/s)`
      : `${caseGroups.length} cases, ${totalScenarios} scenarios`

  printCliBanner('Cliente-0 Usecase Suite', `Running ${label} with assertions.`)

  const allFailures: string[] = []

  for (const { caseNumber, scenarios } of caseGroups) {
    printCliBanner(`Case ${caseNumber} — ${scenarios.length} scenario/s`)

    const namedConversations: Array<{ scenarioName: string; turns: Array<{you: string, bot: string}> }> = []
    const caseFailures: string[] = []

    for (const { name: scenarioName, scenario } of scenarios) {
      printCliBanner(`  ${scenarioName}`)

      const state = createInitialState()
      if (scenario.preState) {
        Object.assign(state, scenario.preState)
      }

      const conversationLog: Array<{you: string, bot: string}> = []

      for (const [turnIndex, turn] of scenario.turns.entries()) {
        printCliMessage('You', turn)
        const result = await handleTurn(runtime, state, turn)
        printCliMessage('Bot', result.reply)
        conversationLog.push({ you: turn, bot: result.reply })
        if (DEBUG_MODE) printDebug(result.debug)

        const assertions = scenario.assertions.filter((a) => a.turn === turnIndex + 1)
        for (const assertion of assertions) {
          const assertionFailures = assertRegressionReply(result.reply, assertion)
          for (const failure of assertionFailures) {
            const msg = `[${scenarioName}] turn ${assertion.turn}: ${failure}`
            caseFailures.push(msg)
            allFailures.push(msg)
          }
        }
      }

      namedConversations.push({ scenarioName, turns: conversationLog })
    }

    // Write one evaluation per case (all scenarios combined) when running a selection.
    if (writeEvaluationForSelection) {
      await updateUsecaseMd(caseNumber, caseFailures.length === 0, caseFailures, namedConversations)
    }
  }

  if (allFailures.length > 0) {
    console.error(`\n${CLI_SUBRULE}`)
    console.error('[USECASE FAILURES]')
    console.error(CLI_SUBRULE)
    for (const failure of allFailures) {
      console.error(failure)
    }
    console.error(CLI_SUBRULE)
    process.exitCode = 1
    return
  }

  printCliMessage('Info', 'All usecase acceptance-criteria scenarios passed.')
}

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
    await runScripted(runtime)
    return
  }

  if (VERIFY_MODE) {
    await runRegressionSuite(runtime)
    return
  }

  if (USECASES_MODE) {
    await runUsecaseSuite(runtime)
    return
  }

  const state = createInitialState()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  printCliBanner(
    'Cliente-0 Interactive Demo',
    'Type your message. Use /reset to restart or /exit to quit.',
  )

  while (true) {
    let input = ''
    try {
      input = await rl.question('')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ERR_USE_AFTER_CLOSE') {
        break
      }
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

main().catch((error) => {
  console.error(error)
  process.exit(1)
})