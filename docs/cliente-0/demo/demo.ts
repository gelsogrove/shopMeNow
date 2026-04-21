import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

type Route = 'washer' | 'dryer' | 'faq' | 'operator' | 'reset' | 'greeting' | 'unknown'
type NextOwner = 'conversation_history' | 'washer_specialist' | 'dryer_specialist'

type FlowNode = {
  type: 'ACTION' | 'CONFIRMATION' | 'CHOICE' | 'INFO'
  prompt: string
  transitions?: Record<string, string>
  isTerminal?: boolean
  action?: 'escalate'
}

type FlowMap = Record<string, Record<string, FlowNode>>

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

type SessionState = {
  language: 'it' | 'es' | 'en' | 'pt'
  preferredLanguage: 'it' | 'es' | 'en' | 'pt' | null
  location: string
  machineType: '' | 'washer' | 'dryer'
  machineNumber: string
  paymentCompleted: boolean | null
  paymentMethod: string
  displayState: string
  issueSummary: string
  activeFlowId: string | null
  activeStepId: string | null
  retryCount: number
  lastResolvedIntent: Route | null
  escalationReason: string | null
  operatorRequested: boolean
  turnCount: number
  lastPresentedStepId: string | null
  lastMissingFacts: string[]
  pendingClosure: 'resolved' | 'escalated' | null
}

type Runtime = {
  prompts: Record<string, string>
  flows: {
    washer: FlowMap
    dryer: FlowMap
  }
}

type TurnResult = {
  reply: string
  debug: string[]
}

type ScriptedScenario = {
  name: string
  turns: string[]
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
const API_KEY = process.env.OPENROUTER_API_KEY || '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'
const CHATBOT_NAME = 'Ecolaundry Assistant'
const TONE_OF_VOICE = 'calm, reassuring, relaxed, warm, step-by-step'
const COMPANY_NAME = 'Ecolaundry'
const ALLOWED_LINKS = 'echatbot.ai, www.echatbot.ai, forms.gle, alberwaz.net'
const FAQ_FALLBACK = 'If this question depends on local policy, the operator will review it manually.'
const FAQS = {
  washDryTime: 'En Ecolaundry puedes tener toda tu ropa limpia y seca en aproximadamente 1 hora. El ciclo de lavado dura entre 30 y 45 minutos, y el secado otros 30-45 minutos según el tamaño de la carga.',
  openingHours: 'Abierto los 365 días del año, incluidos festivos. Horario: de 8:00h a 22:00h. Último ciclo de lavado: 21:00h. No necesitas reservar, simplemente ven cuando quieras.',
  washerCapacity: 'Nuestras lavadoras tienen capacidad de hasta 20 kg. Son ideales para lavar sábanas, edredones, toallas y colchas, prendas que no caben en una lavadora doméstica.',
  detergents: 'No, no hace falta traer nada. Las máquinas Ecolaundry dosifican automáticamente detergente y suavizante ecológicos certificados, elaborados con ingredientes 100% naturales. Solo tienes que traer la ropa.',
  paymentMethods: 'Puedes pagar de tres formas: tarjeta bancaria contactless, efectivo con monedas y App Ecolaundry. Usando la App además consigues promociones y saldo de regalo por cada recarga.',
  pricing: 'Tarifas: lavado 8 kg €4,50, 12 kg €6,00, 20 kg €8,50. Secado: 8 kg €3,50, 20 kg €6,00. Puedes pagar con tarjeta, monedas o App Ecolaundry. Con la App consigues saldo de regalo en cada recarga.',
  appDownload: 'La App es completamente gratuita. Búscala como Ecolaundry en App Store y Google Play. Con la App puedes pagar, ver el tiempo restante de tu ciclo y recibir una notificación cuando termine.',
  colorTemperature: 'Para ropa de color usa agua fría o tibia, entre 20 y 30°C. El agua caliente abre las fibras y hace que el tinte se escape. También te recomendamos dar la vuelta a las prendas antes de meterlas al tambor para proteger los colores.',
  greaseStains: 'Absorbe primero el exceso con papel de cocina sin frotar. Luego usa este programa en nuestras lavadoras: tejidos resistentes, como algodón, a 60°C; sintéticos o delicados, a 40°C. Nuestras máquinas aplican el detergente automáticamente para disolver la grasa.',
  mixedColors: 'Agrupa la ropa en tres grupos: oscuros, claros y brillantes. Nunca mezcles negros con blancos ni con colores vivos: el negro puede soltar tinte.',
  machineHygiene: 'Sí. Las máquinas se limpian y desinfectan regularmente. Cada ciclo industrial garantiza la higiene del tambor. Usamos higienizantes ecológicos seguros para toda la familia, incluyendo bebés y personas con piel sensible.',
  ecoProducts: 'Sí. Usamos jabones y suavizantes 100% ecológicos, certificados y elaborados con ingredientes naturales. Nuestras máquinas también consumen menos agua y energía que las lavadoras domésticas, cuidando tu ropa y el planeta.',
  doubleCharge: 'Para verificar el doble cobro necesitamos: nombre del local, si completaste el servicio o no, últimos 4 dígitos de la tarjeta y captura de pantalla del pago. Si completaste el servicio: te enviaremos el formulario de reembolso https://forms.gle/XFGPAd9581AhC9eu7. Si no lo completaste: la próxima vez, antes de volver a pagar, contáctanos y te ayudamos de inmediato. Escalamos si el importe no cuadra, el relato es confuso o el cliente está muy molesto.',
  paidButNotStarting: 'Si pagaste pero la máquina no arranca, necesitamos saber el local, si es lavadora o secadora, y qué indica el display. PUSH PROG: pulsa el programa deseado. DOOR: abre y cierra bien la puerta. 001: posible error de secuencia, lo revisamos juntos. Si la central no dio el cambio: verifica el saldo en la central y pulsa el botón correcto. Escalamos si ha seguido todos los pasos y sigue sin funcionar.',
  errorAl001: 'El error AL001 aparece cuando el proceso no se ha realizado en el orden correcto. Te ayudamos a completarlo paso a paso. Escalamos si el cliente no puede seguir las instrucciones o el error persiste.',
  compensationCode: 'Para usar el código necesitamos el código exacto, el nombre del local y el importe. Si falta un pequeño importe, introduce las monedas que faltan en la central. Se l\'importo è superiore al codice, escalamos para generar un código nuevo. Escalamos si el código es incoherente, le faltan letras o hace falta un código nuevo.',
  refundRequest: 'Para tramitar un reembolso necesitamos los últimos 4 dígitos de la tarjeta, captura de pantalla del pago y descripción de lo ocurrido. Formulario de reembolso: https://forms.gle/XFGPAd9581AhC9eu7. Email de soporte: service@alberwaz.net. Escalamos si la solicitud es urgente o la incidencia es compleja.',
  invoiceRequest: 'Escribe a olga@alberwaz.net. Indica razón social, email, nombre de la lavandería, CIF o NIF, dirección, fecha, detalle de las máquinas utilizadas y observaciones.',
  loyaltyCard: 'La tarjeta de fidelidad se compra por 20€ en efectivo y solo funciona en el local donde se adquirió. En Goya y Pineda: pulsa el segundo botón de la fila derecha de la central. Para recargar: introduce la tarjeta y sigue las instrucciones de la central. Nota: L\'Escala no tiene tarjeta de fidelidad.',
  locationDifferences: 'Horario general: 8:00–22:00 todos los días. L\'Escala: 7:00–23:00 y no tiene tarjeta de fidelidad. Precios: consultar la base de datos del local; si no estás seguro, escalar. Goya: el cliente debe limpiar el filtro de la secadora, central con botones, tarjeta unitaria 7€, da cambio en monedas. Pineda: central con botones, tarjeta unitaria 8€, da cambio en monedas. Alemanya y Pineda: a veces añadir dinero a la secadora no añade minutos, entonces se escala. Alemanya y Hortes: a veces no se puede pagar con tarjeta, posible reinicio AJAX. Todas las máquinas son Girbau. Jabón y suavizante incluidos. No añadir productos propios. Lavado medio: aproximadamente 28 minutos. Secado 15 minutos: aproximadamente 20 kg de ropa mixta; el algodón 100% necesita más tiempo.',
}

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
]

const args = new Set(process.argv.slice(2))
const DEBUG_MODE = args.has('--debug')
const SCRIPTED_MODE = args.has('--scripted')
const MOCK_MODE = args.has('--mock')

process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') {
    process.exit(0)
  }
  throw error
})

function createInitialState(): SessionState {
  return {
    language: 'en',
    preferredLanguage: null,
    location: '',
    machineType: '',
    machineNumber: '',
    paymentCompleted: null,
    paymentMethod: '',
    displayState: '',
    issueSummary: '',
    activeFlowId: null,
    activeStepId: null,
    retryCount: 0,
    lastResolvedIntent: null,
    escalationReason: null,
    operatorRequested: false,
    turnCount: 0,
    lastPresentedStepId: null,
    lastMissingFacts: [],
    pendingClosure: null,
  }
}

function getDemoDir(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

async function loadRuntime(): Promise<Runtime> {
  const demoDir = getDemoDir()
  const flowDir = path.resolve(demoDir, '../flows/json')
  const promptNames = ['router', 'history', 'security', 'translation', 'washer', 'dryer', 'language']
  const promptEntries = await Promise.all(
    promptNames.map(async (name) => [name, await readFile(path.join(demoDir, `prompt_${name}.txt`), 'utf8')] as const),
  )
  const washer = JSON.parse(await readFile(path.join(flowDir, 'lavatrice_hs60xx.json'), 'utf8')) as FlowMap
  const dryer = JSON.parse(await readFile(path.join(flowDir, 'asciugatrice_ed340.json'), 'utf8')) as FlowMap
  return { prompts: Object.fromEntries(promptEntries), flows: { washer, dryer } }
}

function replaceVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  )
}

function summarizeState(state: SessionState): string {
  return JSON.stringify(state, null, 2)
}

function pushDebug(debug: string[], label: string, value: unknown): void {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  debug.push(`${label}: ${rendered}`)
}

const CLI_WIDTH = 78
const CLI_RULE = '='.repeat(CLI_WIDTH)
const CLI_SUBRULE = '-'.repeat(CLI_WIDTH)

function wrapPlainText(text: string, width = CLI_WIDTH - 4): string[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const wrapped: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      wrapped.push('')
      continue
    }

    const words = line.split(/\s+/)
    let current = ''

    for (const word of words) {
      if (!current) {
        current = word
        continue
      }

      const candidate = `${current} ${word}`
      if (candidate.length <= width) {
        current = candidate
      } else {
        wrapped.push(current)
        current = word
      }
    }

    if (current) wrapped.push(current)
  }

  return wrapped.length ? wrapped : ['']
}

function printCliBanner(title: string, subtitle?: string): void {
  console.log(`\n${CLI_RULE}`)
  console.log(title)
  if (subtitle) {
    console.log(CLI_SUBRULE)
    console.log(subtitle)
  }
  console.log(CLI_RULE)
}

function printCliMessage(label: 'You' | 'Bot' | 'Info' | 'Error', message: string): void {
  const header = `[${label.toUpperCase()}]`
  const lines = wrapPlainText(message)

  console.log(`\n${header}`)
  for (const line of lines) {
    console.log(line ? `  ${line}` : '')
  }
}

function normalizeDisplayState(displayState: string): string {
  const normalized = displayState.trim().toUpperCase().replace(/\s+/g, ' ')
  if (/^ALM\s*0*01$/.test(normalized.replace(/ /g, '')) || normalized === 'AL001') {
    return 'AL001'
  }
  return normalized
}

function extractDisplayState(message: string): string | null {
  const trimmed = message.trim()
  const alarm001Match = trimmed.match(/\bALM\s*0*01\b/i)
  if (alarm001Match) return 'AL001'

  const genericMatch = trimmed.match(/\b(SEL|PUSH|PR|DOOR|ALM|AL001|END|FILTRO|FALLO DE ROTACION|FALLO DE ASPIRACION|STOP|water)\b/i)
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
    isDisplayCodeLikeInput(trimmed)
  )
}

function hasOperationalContextIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /ho messo i soldi|messo i soldi|metto i soldi|sto mettendo i soldi|inserito i soldi|ho pagato|paid already|already paid|payment completed|pagamento fatto|cosa devo fare adesso|what do i do now|que hago ahora|non aumentano i minuti|minutes did not increase|minuti non aumentano/i.test(normalized)
}

function hasTroubleshootingIntent(message: string): boolean {
  return hasTechnicalIssueIntent(message) || hasOperationalContextIntent(message)
}

function isStartOrPaymentIssue(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /non parte|does not start|no arranca|no funciona|non funziona|he introducido el dinero|introdujiste el dinero|ho messo i soldi|inserito i soldi|ho pagato|paid/i.test(normalized)
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

function hasTechnicalIssueIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return /non si chiude|sportello|door|non parte|does not start|no arranca|display|alm|sel|push|errore|error|filtro|rotacion|aspiracion|bagnat|wet|smell|odore/i.test(normalized)
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
  if (/(portugu[eê]s|portuguese\b)/i.test(normalized)) return 'pt'
  if (/(inglese|english\b)/i.test(normalized)) return 'en'
  return null
}

function parsePaymentAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/\b(no|non ho pagato|not paid|non pagato|ancora no)\b/i.test(normalized)) {
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

function preprocessUserInput(state: SessionState, userMessage: string): string {
  const trimmed = userMessage.trim()
  if (isLikelyStandaloneLocationInput(state, trimmed)) {
    state.location = trimmed
    return `Location is ${trimmed}`
  }
  const explicitMachineType = normalizeMachineType(trimmed)
  if (explicitMachineType && (!state.machineType || state.machineType !== explicitMachineType)) {
    state.machineType = explicitMachineType
    return `Machine type is ${explicitMachineType}`
  }
  const explicitMachineNumber = trimmed.match(/(?:numero|num(?:ero)?|n\.?|machine number|macchina)\s*[:#-]?\s*(\d{1,3})\b/i)?.[1]
  if (explicitMachineNumber && state.machineType && !state.machineNumber) {
    state.machineNumber = explicitMachineNumber
    return `Machine number is ${explicitMachineNumber}`
  }
  if (/^\d{1,3}$/.test(trimmed) && state.machineType && !state.machineNumber) {
    state.machineNumber = trimmed
    return `Machine number is ${trimmed}`
  }
  const explicitDisplayState = extractDisplayState(trimmed)
  if (explicitDisplayState && state.machineType && !state.displayState) {
    state.displayState = explicitDisplayState
    return `Display state is ${explicitDisplayState}`
  }
  if (state.machineType && state.paymentCompleted === null && !state.activeFlowId && !isAwaitingLocation(state)) {
    const parsedPaymentAnswer = parsePaymentAnswer(trimmed)
    if (parsedPaymentAnswer !== null) {
      state.paymentCompleted = parsedPaymentAnswer
      return `Payment completed is ${parsedPaymentAnswer ? 'yes' : 'no'}`
    }
  }
  return userMessage
}

function isContextualHeuristicInput(originalInput: string, normalizedInput: string): boolean {
  return originalInput.trim() !== normalizedInput.trim()
}

function applyContextualRouterFallback(
  decision: RouterDecision,
  state: SessionState,
  originalInput: string,
  normalizedInput: string,
): RouterDecision {
  const nextDecision = { ...decision }
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
    (nextDecision.route === 'unknown' || nextDecision.route === 'greeting') &&
    (state.machineType || normalizeMachineType(nextDecision.extractedFacts?.machineType))
  ) {
    const routedMachineType = normalizeMachineType(nextDecision.extractedFacts?.machineType) || state.machineType
    if (routedMachineType) {
      nextDecision.route = routedMachineType
      nextDecision.nextOwner = routedMachineType === 'washer' ? 'washer_specialist' : 'dryer_specialist'
    }
  }

  if (nextDecision.route === 'washer' || nextDecision.route === 'dryer') {
    const resolvedMachineNumber = String(nextDecision.extractedFacts?.machineNumber || state.machineNumber || '').trim()
    const resolvedDisplayState = String(nextDecision.extractedFacts?.displayState || state.displayState || '').trim()
    const postCycleLikeIssue = /finito|finished|terminado|bagnat|wet|porta non si apre|door blocked|schiuma|foam/i.test(
      String(nextDecision.extractedFacts?.issueSummary || state.issueSummary || originalInput),
    )
    const canProceedWithoutMachineNumber = Boolean(resolvedDisplayState) || postCycleLikeIssue

    nextDecision.extractedFacts = {
      ...nextDecision.extractedFacts,
      machineType: nextDecision.route,
      machineNumber: resolvedMachineNumber,
      displayState: resolvedDisplayState,
      paymentCompleted:
        typeof nextDecision.extractedFacts?.paymentCompleted === 'boolean'
          ? nextDecision.extractedFacts.paymentCompleted
          : state.paymentCompleted,
    }

    const recomputedMissingFacts: string[] = []
    const shouldAskLocationFirst =
      !state.location &&
      hasTroubleshootingIntent(String(nextDecision.extractedFacts?.issueSummary || state.issueSummary || originalInput)) &&
      !resolvedMachineNumber &&
      !resolvedDisplayState

    if (shouldAskLocationFirst) {
      recomputedMissingFacts.push('location')
    }
    if (!resolvedMachineNumber && !canProceedWithoutMachineNumber) {
      recomputedMissingFacts.push('machine number')
    }
    if (
      nextDecision.extractedFacts.paymentCompleted === null &&
      !resolvedDisplayState &&
      !postCycleLikeIssue
    ) {
      recomputedMissingFacts.push('payment completed or not')
    }
    if (!resolvedDisplayState && !postCycleLikeIssue) {
      recomputedMissingFacts.push('exact display state')
    }

    nextDecision.missingFacts = recomputedMissingFacts
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
    return true
  })

  return nextDecision
}

function normalizeRouterDecision(decision: RouterDecision, state: SessionState): RouterDecision {
  const route = normalizeRoute(decision.route)
  const machineType = normalizeMachineType(decision.extractedFacts?.machineType) || state.machineType
  const functionName = pickAllowedToken(decision.functionName, ['lavatrice_hs60xx', 'asciugatrice_ed340', 'contactOperator', 'resetSession']) as RouterDecision['functionName']
  const extractedFacts = {
    ...decision.extractedFacts,
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

function applySpecialistFallback(
  decision: SpecialistDecision,
  state: SessionState,
  originalInput: string,
): SpecialistDecision {
  const issue = `${state.issueSummary} ${originalInput}`.toLowerCase()
  const displayState = state.displayState.toUpperCase()

  if (state.machineType === 'dryer') {
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

    if (decision.flowId) {
      return decision
    }
  }

  if (state.machineType === 'washer') {
    if (['SEL', 'PUSH', 'PR', 'DOOR', 'ALM', 'AL001', 'END'].includes(displayState)) {
      return {
        ...decision,
        flowId: 'non_parte',
        shouldEscalate: false,
      }
    }
    if (/finito|bagnat|wet|porta non si apre|foam|schiuma/.test(issue)) {
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

function detectLanguageMock(message: string): 'it' | 'es' | 'en' | 'pt' {
  const normalized = message.toLowerCase()
  if (normalized.includes('hola') || normalized.includes('lavadora') || normalized.includes('secadora') || normalized.includes('sí') || normalized.includes('gracias')) return 'es'
  if (normalized.includes('ola') || normalized.includes('máquina') || normalized.includes('obrigado')) return 'pt'
  if (normalized.includes('hello') || normalized.includes('dryer') || normalized.includes('washer') || normalized.includes('thanks') || normalized.includes('paid')) return 'en'
  return 'it'
}

function routerMock(message: string, state: SessionState): RouterDecision {
  const lower = message.toLowerCase()
  const machineNumber = message.match(/\b(\d{1,2})\b/)?.[1] || ''
  const displayState = extractDisplayState(message)
  const route: Route =
    /quanto|prezzo|price|orari|hours|schiuma|foam|programma|program/i.test(message)
      ? 'faq'
      : /lavatrice|lavadora|washer/i.test(message)
      ? 'washer'
      : /asciugatrice|secadora|dryer/i.test(message)
        ? 'dryer'
        : /lavaggio|washing|schiuma|foam|centrif|bagnat|wet clothes|porta non si apre/i.test(message)
          ? 'washer'
          : /asciuga|drying|filtro|rotacion|aspiracion|odore|smell/i.test(message)
            ? 'dryer'
        : /operatore|operator|humano|human/i.test(message)
          ? 'operator'
          : /reset|restart|ricomincia|ricominciare/i.test(message)
            ? 'reset'
            : /ciao|hola|hello|buongiorno/i.test(message)
                ? 'greeting'
                : (state.machineType || '') as Route || 'unknown'

  const extractedFacts: RouterDecision['extractedFacts'] = {
    location: state.location,
    machineType: route === 'washer' || route === 'dryer' ? route : state.machineType,
    machineNumber: machineNumber || state.machineNumber,
    issueSummary: message,
    serviceCompleted: /finito|finished|terminado/i.test(message) ? true : null,
    paymentMethod: /card|carta|tarjeta/i.test(message) ? 'card' : /coins|monete|monedas/i.test(message) ? 'coins' : state.paymentMethod,
    paymentCompleted:
      lower.includes('ho pagato') ||
      lower.includes('paid') ||
      lower.includes('pagado') ||
      lower.includes('sì ho pagato') ||
      lower.includes('si ho pagato') ||
      lower === 'sí' ||
      lower === 'si' ||
      lower === 'sì' ||
      lower === 'yes'
        ? true
        : lower.includes('non ho pagato') || lower === 'no'
          ? false
          : state.paymentCompleted,
    displayState: displayState || state.displayState,
    alarmCode: (displayState || '').startsWith('AL') ? displayState || '' : '',
    changeReturned: null,
    extraTimeAdded: null,
    last4CardDigitsProvided: null,
    paymentProofProvided: null,
  }

  const missingFacts: string[] = []
  const targetMachine = extractedFacts.machineType as string
  const hasDisplayState = Boolean(extractedFacts.displayState)
  const postCycleLikeIssue = /finito|finished|terminado|bagnat|wet|porta non si apre|door blocked|schiuma|foam/i.test(message)
  const canProceedWithoutMachineNumber = hasDisplayState || postCycleLikeIssue
  if ((route === 'washer' || route === 'dryer' || state.machineType) && !targetMachine) missingFacts.push('machine type')
  if ((route === 'washer' || route === 'dryer' || state.machineType) && !extractedFacts.machineNumber && !canProceedWithoutMachineNumber) {
    missingFacts.push('machine number')
  }
  if ((route === 'washer' || route === 'dryer' || state.machineType) && extractedFacts.paymentCompleted === null && !hasDisplayState && !postCycleLikeIssue) {
    missingFacts.push('payment completed or not')
  }
  if ((route === 'washer' || route === 'dryer' || state.machineType) && !extractedFacts.displayState && !postCycleLikeIssue) {
    missingFacts.push('exact display state')
  }

  return {
    route,
    nextOwner: route === 'washer' ? 'washer_specialist' : route === 'dryer' ? 'dryer_specialist' : 'conversation_history',
    functionName:
      route === 'washer' && Boolean(extractedFacts.machineNumber) ? 'lavatrice_hs60xx'
      : route === 'dryer' && Boolean(extractedFacts.machineNumber) ? 'asciugatrice_ed340'
      : route === 'operator' ? 'contactOperator'
      : route === 'reset' ? 'resetSession'
      : null,
    extractedFacts,
    missingFacts,
    customerFacingGoal:
      route === 'faq' ? 'Answer the FAQ shortly.'
      : route === 'greeting' ? 'Greet and ask the most useful missing question.'
      : missingFacts.length > 0 ? 'Ask the most useful missing question.'
      : 'Continue the technical path.',
    escalationReason: route === 'operator' ? 'Customer asked for human support.' : null,
  }
}

function specialistMock(message: string, state: SessionState): SpecialistDecision {
  const lower = message.toLowerCase()
  if (state.machineType === 'washer') {
    if (/stop/i.test(message)) {
      return {
        flowId: 'stop_error',
        shouldEscalate: false,
        escalationReason: null,
        technicalSummary: 'Washer STOP case detected.',
        missingFacts: [],
        customerFacingGoal: 'Continue the STOP path.',
      }
    }
    if (/finito|bagnat|porta|foam|schiuma|end/i.test(lower)) {
      return {
        flowId: 'post_ciclo',
        shouldEscalate: false,
        escalationReason: null,
        technicalSummary: 'Washer post-cycle issue detected.',
        missingFacts: [],
        customerFacingGoal: 'Continue the post-cycle path.',
      }
    }
    return {
      flowId: 'non_parte',
      shouldEscalate: false,
      escalationReason: null,
      technicalSummary: 'Washer start/payment/display issue detected.',
      missingFacts: [],
      customerFacingGoal: 'Continue the washer startup path.',
    }
  }

  if (/filtro|rotacion|aspiracion|umid|wet|porta bloccata|door blocked|odore|smell|stop/i.test(lower)) {
    return {
      flowId: 'errore_reset',
      shouldEscalate: false,
      escalationReason: null,
      technicalSummary: 'Dryer reset/error path detected.',
      missingFacts: [],
      customerFacingGoal: 'Continue the dryer reset path.',
    }
  }

  return {
    flowId: 'non_parte',
    shouldEscalate: false,
    escalationReason: null,
    technicalSummary: 'Dryer start/payment/display issue detected.',
    missingFacts: [],
    customerFacingGoal: 'Continue the dryer startup path.',
  }
}

function chooseFaqSourceMock(message: string): string {
  const matchedSource = chooseFaqSourceHeuristic(message)
  return matchedSource || FAQ_FALLBACK
}

function chooseFaqSourceHeuristic(message: string): string | null {
  const lower = message.toLowerCase()
  if (/^location is\s+/i.test(message.trim())) return null
  if (/cu[aá]nto.*tarda|lavado.*secado|wash.*dry|tempo.*lavaggio.*asciugatura/i.test(lower)) return FAQS.washDryTime
  if (/horario|orari|hours|abierto|apertura/i.test(lower)) return FAQS.openingHours
  if (/capacidad|kg|lavadoras.*capacidad/i.test(lower)) return FAQS.washerCapacity
  if (/detergente|suavizante|detergent|ammorbidente/i.test(lower)) return FAQS.detergents
  if (/c[oó]mo.*pagar|pago|tarjeta|monedas|app ecolaundry|contactless/i.test(lower)) return FAQS.paymentMethods
  if (/cu[aá]nto cuesta|prezzo|precio|tarifa|costa lavar|costa secar/i.test(lower)) return FAQS.pricing
  if (/descarg|app|app store|google play/i.test(lower)) return FAQS.appDownload
  if (/camicia.*macchi?(?:at|ant)|ropa.*manchada|prenda.*macchi?(?:at|ant)a|stain(ed)? garment/i.test(lower)) return FAQS.greaseStains
  if (/ropa de color|temperatura|colori|colore|20-30|30°/i.test(lower)) return FAQS.colorTemperature
  if (/aceite|grasa|oil|grease|macchia/i.test(lower)) return FAQS.greaseStains
  if (/mezclar ropa|mezclar colores|distintos colores|colori diversi/i.test(lower)) return FAQS.mixedColors
  if (/limpias|higienizadas|higiene|desinfectadas/i.test(lower)) return FAQS.machineHygiene
  if (/ecol[oó]gic|ecologic|productos ecol[oó]gicos|jabones ecol[oó]gicos/i.test(lower)) return FAQS.ecoProducts
  if (/doble cobro|cobrado dos veces|charged twice|doble pago/i.test(lower)) return FAQS.doubleCharge
  if (/pagu[eé].*no arranca|ho pagato.*non parte|paid.*does not start/i.test(lower)) return FAQS.paidButNotStarting
  if (/al001|001/i.test(lower)) return FAQS.errorAl001
  if (/c[oó]digo de compensaci[oó]n|codigo de compensacion|codice compensazione/i.test(lower)) return FAQS.compensationCode
  if (/reembolso|refund|rimborso/i.test(lower)) return FAQS.refundRequest
  if (/factura|invoice|fattura/i.test(lower)) return FAQS.invoiceRequest
  if (/tarjeta de fidelidad|fidelity card|carta fedelt[aà]/i.test(lower)) return FAQS.loyaltyCard
  if (/(diferencias entre los locales|orari(?:o)?|horario|hours|prezzo|precio|tarjeta de fidelidad|fidelity card|goya|pineda|alemanya|hortes|l'escala)/i.test(lower) && /(local|lavander|horario|hours|prezzo|precio|tarjeta|card|differen)/i.test(lower)) return FAQS.locationDifferences
  return null
}

function renderHistoryMock(state: SessionState, payload: {
  routerDecision: RouterDecision
  specialistDecision?: SpecialistDecision | null
  flowEngineResult?: FlowEngineResult | null
  faqSource?: string
  action?: 'contactOperator' | 'resetSession' | 'closureAck' | null
  closureKind?: 'resolved' | 'escalated'
}): string {
  if (payload.action === 'resetSession') {
    return 'Let us restart. Which location are you in and which machine do you need help with?'
  }
  if (payload.action === 'closureAck') {
    return payload.closureKind === 'escalated'
      ? 'Understood. The operator will review it shortly.'
      : 'Perfect. If you need anything else, I am here.'
  }
  if (payload.action === 'contactOperator') {
    return 'I am notifying the operator. They will review your case shortly.'
  }
  if (payload.faqSource) {
    return payload.faqSource
  }
  if (payload.flowEngineResult?.prompt) {
    return payload.flowEngineResult.prompt
  }
  if (payload.routerDecision.missingFacts.length > 0) {
    const firstMissing = payload.routerDecision.missingFacts[0]
    const questionMap: Record<string, string> = {
      location: 'Which location are you in?',
      'machine type': 'Is it a washing machine or a dryer?',
      'machine number': 'What is the machine number?',
      'payment completed or not': 'Have you already completed the payment?',
      'exact display state': 'What exactly do you see on the display?',
    }
    return questionMap[firstMissing] || 'What is the missing detail?' 
  }
  if (payload.routerDecision.route === 'greeting') {
    return 'Hi, I can help. Which location are you in and which machine do you need help with?'
  }
  return 'Tell me the next useful detail and I will help you step by step.'
}

function translateMock(language: SessionState['language'], message: string): string {
  if (language === 'es') {
    return message
      .replace('Hi, I can help. Which location are you in and which machine do you need help with?', 'Hola, puedo ayudarte. ¿En qué local estás y con qué máquina necesitas ayuda?')
      .replace('What is the machine number?', '¿Cuál es el número de la máquina?')
      .replace('Have you already completed the payment?', '¿Ya has completado el pago?')
      .replace('What exactly do you see on the display?', '¿Qué ves exactamente en la pantalla?')
      .replace('Has the machine started?', '¿La máquina ha arrancado?')
      .replace('Has the dryer started now?', '¿La secadora ha arrancado ahora?')
      .replace('Did that solve the problem?', '¿Eso resolvió el problema?')
      .replace('Did the display alternate between END and bAL?', '¿La pantalla alternaba entre END y bAL?')
      .replace('I am notifying the operator. They will review your case shortly.', 'Estoy avisando al operador. Revisará tu caso en breve.')
      .replace('No problem 👍', 'No hay problema 👍')
      .replace('Tell me the next useful detail and I will help you step by step.', 'Dime el siguiente detalle útil y te ayudaré paso a paso.')
      .replace('SEL means the machine is ready 👍', 'SEL significa que la máquina está lista 👍')
      .replace('👉 Select your machine number and press a program button', '👉 Selecciona el número de la máquina y pulsa un botón de programa')
      .replace('The washer may have been overloaded ⚖️', 'La lavadora puede haber estado sobrecargada ⚖️')
      .replace('👉 Split the clothes into two loads', '👉 Divide la ropa en dos cargas')
      .replace('👉 Run another cycle', '👉 Ejecuta otro ciclo')
      .replace('👉 The operator can review possible compensation if needed', '👉 El operador puede revisar una posible compensación si es necesario')
      .replace('It looks like a door issue 🚪', 'Parece un problema de puerta 🚪')
      .replace('👉 Check that no clothes are stuck in the seal', '👉 Comprueba que no haya ropa atrapada en la junta')
      .replace('👉 Close the door firmly until you hear a click', '👉 Cierra la puerta firmemente hasta oír un clic')
      .replace('The dryer shows a filter or filter-door warning ⚠️', 'La secadora muestra una alerta de filtro o puerta del filtro ⚠️')
      .replace('👉 Remove and clean the lint filter', '👉 Retira y limpia el filtro de pelusa')
      .replace('👉 Clean the filter sensor area', '👉 Limpia la zona del sensor del filtro')
      .replace('👉 Insert the filter back', '👉 Vuelve a colocar el filtro')
      .replace('👉 Press STOP and try again', '👉 Pulsa STOP y vuelve a intentarlo')
  }
  if (language === 'it') {
    return message
      .replace('Hi, I can help. Which location are you in and which machine do you need help with?', 'Ciao, posso aiutarti. In quale lavanderia sei e con quale macchina hai bisogno di aiuto?')
      .replace('What is the machine number?', 'Qual è il numero della macchina?')
      .replace('Have you already completed the payment?', 'Hai già completato il pagamento?')
      .replace('What exactly do you see on the display?', 'Cosa vedi esattamente nel display?')
      .replace('Has the machine started?', 'La macchina è partita?')
      .replace('Has the dryer started now?', 'L\'asciugatrice è partita adesso?')
      .replace('Did that solve the problem?', 'Questo ha risolto il problema?')
      .replace('Did the display alternate between END and bAL?', 'Il display alternava tra END e bAL?')
      .replace('I am notifying the operator. They will review your case shortly.', 'Sto avvisando l\'operatore. Controllerà il tuo caso a breve.')
      .replace('Tell me the next useful detail and I will help you step by step.', 'Dimmi il prossimo dettaglio utile e ti aiuterò passo dopo passo.')
      .replace('SEL means the machine is ready 👍', 'SEL significa che la macchina è pronta 👍')
      .replace('👉 Select your machine number and press a program button', '👉 Seleziona il numero macchina e premi un tasto programma')
      .replace('The washer may have been overloaded ⚖️', 'La lavatrice potrebbe essere stata sovraccaricata ⚖️')
      .replace('👉 Split the clothes into two loads', '👉 Dividi i vestiti in due carichi')
      .replace('👉 Run another cycle', '👉 Avvia un altro ciclo')
      .replace('👉 The operator can review possible compensation if needed', '👉 L\'operatore può valutare un eventuale indennizzo se necessario')
      .replace('It looks like a door issue 🚪', 'Sembra un problema della porta 🚪')
      .replace('👉 Check that no clothes are stuck in the seal', '👉 Controlla che non ci siano vestiti incastrati nella guarnizione')
      .replace('👉 Close the door firmly until you hear a click', '👉 Chiudi bene la porta finché senti un clic')
      .replace('The dryer shows a filter or filter-door warning ⚠️', 'L\'asciugatrice mostra un avviso filtro o sportello filtro ⚠️')
      .replace('👉 Remove and clean the lint filter', '👉 Rimuovi e pulisci il filtro della lanugine')
      .replace('👉 Clean the filter sensor area', '👉 Pulisci l\'area del sensore del filtro')
      .replace('👉 Insert the filter back', '👉 Reinserisci il filtro')
      .replace('👉 Press STOP and try again', '👉 Premi STOP e riprova')
  }
  return message
}

async function callModel(params: LlmRequest): Promise<string> {
  if (MOCK_MODE) {
    return params.userPrompt
  }
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

async function detectLanguage(runtime: Runtime, message: string): Promise<'it' | 'es' | 'en' | 'pt'> {
  if (MOCK_MODE) {
    return detectLanguageMock(message)
  }
  const result = await callModel({
    systemPrompt: runtime.prompts.language,
    userPrompt: `Customer message:\n${message}`,
    json: true,
    maxTokens: 30,
  })
  const parsed = extractJson<{ language?: 'it' | 'es' | 'en' | 'pt' }>(result, { language: 'en' })
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
  if (typeof facts.displayState === 'string' && facts.displayState) state.displayState = facts.displayState
  if (typeof facts.issueSummary === 'string' && facts.issueSummary) state.issueSummary = facts.issueSummary
  if (typeof facts.paymentCompleted === 'boolean') state.paymentCompleted = facts.paymentCompleted
}

async function runRouter(runtime: Runtime, state: SessionState, message: string): Promise<RouterDecision> {
  if (MOCK_MODE) {
    return routerMock(message, state)
  }
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
  if (MOCK_MODE) {
    return specialistMock(message, state)
  }
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
  const output = await callModel({
    userPrompt: `${prompt}\n\nSession state:\n${summarizeState(state)}\n\nCustomer message:\n${message}`,
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
    if (state.paymentCompleted === false && flow.pay_help) return 'pay_help'
    if (display === 'SEL' && flow.case_sel) return 'case_sel'
    if ((display === 'PUSH' || display === 'PR') && flow.case_push) return 'case_push'
    if (display === 'DOOR' && flow.case_door) return 'case_door'
    if (display === 'ALM' && flow.case_alm) return 'case_alm'
    if (display === 'AL001' && flow.case_al001) return 'case_al001'
    if (display === 'END' && flow.case_end) return 'case_end'
    if (state.paymentCompleted === true && flow.display_check) return 'display_check'
  }

  if (state.machineType === 'washer' && flowId === 'post_ciclo') {
    if (/foam|schiuma/.test(issue) && flow.foam) return 'foam'
    if (/porta|door/.test(issue) && flow.door) return 'door'
    if (/bagnat|wet/.test(issue) && flow.wet) return 'wet'
    if (flow.step_0) return 'step_0'
  }

  if (state.machineType === 'dryer' && flowId === 'non_parte') {
    if (state.paymentCompleted === false && flow.pay_help) return 'pay_help'
    if (display === 'SEL' && flow.case_sel) return 'case_sel'
    if (display === 'DOOR' && flow.door_issue) return 'door_issue'
    if (display === 'AL001' && flow.case_al001) return 'case_al001'
    if (state.paymentCompleted === true && flow.problem_check) return 'problem_check'
  }

  if (state.machineType === 'dryer' && flowId === 'errore_reset') {
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
  if (/\b(ho gia'? detto di si|i paid already|already paid|ho pagato|pagato|payment completed|fatto il pagamento)\b/i.test(value)) return 'YES'
  if (/^(no|n|nope)\b/i.test(value)) return 'NO'
  if (/\b(non ancora|ancora no|non funziona|not yet|not paid|non ho pagato)\b/i.test(value)) return 'NO'
  return null
}

async function classifyChoiceViaLLM(node: FlowNode, input: string): Promise<string | null> {
  const trimmed = input.trim().toLowerCase()
  if (/^(ok|ok risolto|risolto|fatto|ora funziona|funziona)$/i.test(trimmed)) {
    if (node.transitions?.YES) return 'YES'
  }
  if (/^(no|non funziona|ancora no)$/i.test(trimmed)) {
    if (node.transitions?.NO) return 'NO'
  }
  if (trimmed === 'water' && node.prompt.includes('ALM/A')) {
    return '1'
  }
  if (/minut/i.test(trimmed) && /non aument|did not increase|no aument/i.test(trimmed)) {
    if (node.prompt.includes('I added money but minutes did not increase') && node.transitions?.['3']) return '3'
    if (node.prompt.includes('Minutes did not increase') && node.transitions?.['4']) return '4'
  }
  if (MOCK_MODE) {
    const normalized = normalizeConfirmation(input)
    if (normalized && node.transitions?.[normalized]) return normalized
    const numeric = input.trim().match(/^(\d+)$/)?.[1]
    if (numeric && node.transitions?.[numeric]) return numeric
    const lower = input.toLowerCase()
    const descriptions = mapChoiceDescriptions(node)
    for (const [key, description] of Object.entries(descriptions)) {
      const words = description.toLowerCase().split(/\W+/).filter(Boolean)
      if (words.some((word) => lower.includes(word))) return key
    }
    return null
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
  const nextNode = currentFlowNode(runtime, state)
  if (!nextNode) throw new Error(`Missing node ${nextStepId}`)
  if (nextNode.isTerminal) {
    state.activeFlowId = null
    state.activeStepId = null
  }
  return { flowId, stepId: nextStepId, prompt: nextNode.prompt, type: nextNode.type, isTerminal: Boolean(nextNode.isTerminal), action: nextNode.action }
}

async function chooseFaqSource(message: string): Promise<string> {
  const heuristicSource = chooseFaqSourceHeuristic(message)
  if (heuristicSource) {
    return heuristicSource
  }
  if (MOCK_MODE) {
    return chooseFaqSourceMock(message)
  }
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
}): Promise<string> {
  if (MOCK_MODE) {
    return renderHistoryMock(state, payload)
  }
  const systemPrompt = replaceVars(runtime.prompts.history, {
    chatbotName: CHATBOT_NAME,
    toneOfVoice: TONE_OF_VOICE,
    faqs: Object.values(FAQS).join('\n'),
  })
  const userPrompt = `Current session state:\n${summarizeState(state)}\n\nRuntime decision:\n${JSON.stringify(payload, null, 2)}${payload.faqSource ? `\n\nFAQ source excerpt:\n${payload.faqSource}` : ''}`
  return callModel({ systemPrompt, userPrompt, maxTokens: 220, temperature: 0.2 })
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
  const message = await renderHistory(runtime, state, {
    routerDecision: payload.routerDecision || createSystemRouterDecision(),
    action: payload.action,
    closureKind: payload.closureKind,
  })
  const translatedMessage = await translateIfNeeded(runtime, state, message)
  const security = await securityCheck(runtime, translatedMessage)
  return security.safe ? translatedMessage : fallbackBlockedMessage(state.language)
}

async function translateIfNeeded(runtime: Runtime, state: SessionState, message: string): Promise<string> {
  if (MOCK_MODE) {
    return translateMock(state.language, message)
  }
  if (state.language === 'en') return message
  const systemPrompt = replaceVars(runtime.prompts.translation, { languageUser: state.language })
  const translated = await callModel({ systemPrompt, userPrompt: message, maxTokens: 260, temperature: 0.1 })
  return translated || message
}

async function securityCheck(runtime: Runtime, message: string): Promise<{ safe: boolean; reason?: string }> {
  if (MOCK_MODE) {
    return { safe: true }
  }
  const systemPrompt = replaceVars(runtime.prompts.security, {
    companyName: COMPANY_NAME,
    allowedExternalLinks: ALLOWED_LINKS,
  })
  const result = await callModel({
    systemPrompt,
    userPrompt: `Check if this message is safe:\n\n${message}`,
    json: true,
    maxTokens: 120,
  })
  return extractJson<{ safe: boolean; reason?: string }>(result, { safe: true })
}

function pickSingleMissingFact(routerDecision: RouterDecision, state: SessionState): RouterDecision {
  if (!routerDecision.missingFacts.length) {
    return routerDecision
  }

  const orderedMissingFacts = [...routerDecision.missingFacts].sort((left, right) => {
    const priority = ['location', 'machine type', 'machine number', 'payment completed or not', 'exact display state']
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
    it: 'Il caso verrà controllato manualmente da un operatore.',
    es: 'El caso será revisado manualmente por un operador.',
    pt: 'O caso será analisado manualmente por um operador.',
    en: 'The case will be reviewed manually by an operator.',
  }[language]
}

function forceLocationQuestion(routerDecision: RouterDecision): RouterDecision {
  return {
    ...routerDecision,
    missingFacts: ['location'],
    customerFacingGoal: 'Ask only which location the customer is in.',
  }
}

function getTroubleshootingIdentityMissingFacts(state: SessionState): string[] {
  const missingFacts: string[] = []
  if (!state.location) missingFacts.push('location')
  if (!state.machineType) missingFacts.push('machine type')
  if (!state.machineNumber) missingFacts.push('machine number')
  return missingFacts
}

function getTroubleshootingBlockingMissingFacts(state: SessionState, userMessage: string): string[] {
  const missingFacts = getTroubleshootingIdentityMissingFacts(state)
  const postCycleLikeIssue = /finito|finished|terminado|bagnat|wet|porta non si apre|door blocked|schiuma|foam/i.test(
    `${state.issueSummary} ${userMessage}`,
  )

  if (!state.displayState && !postCycleLikeIssue && isStartOrPaymentIssue(userMessage)) {
    missingFacts.push('exact display state')
  }

  return missingFacts
}

async function handleTurn(runtime: Runtime, state: SessionState, userMessage: string): Promise<TurnResult> {
  const debug: string[] = []
  state.turnCount += 1

  if (state.pendingClosure && isClosureAcknowledgement(userMessage)) {
    const closureKind = state.pendingClosure
    state.pendingClosure = null
    const reply = await renderHistory(runtime, state, {
      routerDecision: createSystemRouterDecision(),
      action: 'closureAck',
      closureKind,
    })
    const translatedReply = await translateIfNeeded(runtime, state, reply)
    const security = await securityCheck(runtime, translatedReply)
    pushDebug(debug, 'closure.ack', { closureKind, reply })
    pushDebug(debug, 'translation.closureAck', translatedReply)
    pushDebug(debug, 'security.closureAck', security)
    return { reply: security.safe ? translatedReply : fallbackBlockedMessage(state.language), debug }
  }

  if (state.pendingClosure) {
    state.pendingClosure = null
  }

  const normalizedUserMessage = preprocessUserInput(state, userMessage)
  pushDebug(debug, 'normalizedInput', normalizedUserMessage)

  const requestedLanguage = getRequestedLanguage(userMessage)
  if (requestedLanguage) {
    state.preferredLanguage = requestedLanguage
    state.language = requestedLanguage
  }

  if (state.preferredLanguage) {
    state.language = state.preferredLanguage
  } else if (state.turnCount > 1 && state.language) {
    state.language = state.language || 'en'
  } else if (isShortContextReply(userMessage) && state.language) {
    state.language = state.language || 'en'
  } else {
    state.language = await detectLanguage(runtime, normalizedUserMessage)
  }
  pushDebug(debug, 'language', state.language)

  const routerDecision = applyContextualRouterFallback(
    normalizeRouterDecision(await runRouter(runtime, state, normalizedUserMessage), state),
    state,
    userMessage,
    normalizedUserMessage,
  )
  const heuristicFaqSource = !state.activeFlowId ? chooseFaqSourceHeuristic(normalizedUserMessage) : null
  if (heuristicFaqSource && (routerDecision.route === 'greeting' || routerDecision.route === 'unknown' || routerDecision.route === 'faq')) {
    routerDecision.route = 'faq'
    routerDecision.nextOwner = 'conversation_history'
    routerDecision.functionName = null
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal = 'Answer the FAQ shortly and clearly without asking diagnostic questions.'
  }

  if (!state.location && !state.activeFlowId && !heuristicFaqSource && hasTroubleshootingIntent(normalizedUserMessage)) {
    routerDecision.route = routerDecision.route === 'faq' ? 'faq' : routerDecision.route
    routerDecision.functionName = null
    routerDecision.missingFacts = ['location']
    routerDecision.customerFacingGoal = 'Ask only which location the customer is in before continuing the technical troubleshooting.'
  }
  pushDebug(debug, 'router', routerDecision)

  if (routerDecision.route === 'greeting') {
    routerDecision.missingFacts = []
    routerDecision.customerFacingGoal = 'Greet the customer, present yourself briefly, and ask the most useful next question.'
  }

  if (state.turnCount === 1 && hasGreetingIntent(userMessage) && !state.location && routerDecision.route === 'greeting') {
    routerDecision.missingFacts = ['location']
    routerDecision.customerFacingGoal = 'Greet the customer, briefly present yourself, and ask only which location they are in.'
  }

  if (
    state.turnCount > 1 &&
    state.location &&
    !state.machineType &&
    (routerDecision.route === 'greeting' || routerDecision.route === 'unknown')
  ) {
    routerDecision.route = 'unknown'
    routerDecision.missingFacts = ['machine type']
    routerDecision.customerFacingGoal = 'Do not greet again. Ask only whether it is a washer or a dryer.'
  }

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
    const flowResult = await advanceActiveFlow(runtime, state, normalizedUserMessage)
    state.lastPresentedStepId = flowResult.stepId
    const flowMessage = await renderHistory(runtime, state, { routerDecision, flowEngineResult: flowResult })
    const translatedFlow = await translateIfNeeded(runtime, state, flowMessage)
    const security = await securityCheck(runtime, translatedFlow)
    state.pendingClosure = flowResult.isTerminal ? (flowResult.action === 'escalate' ? 'escalated' : 'resolved') : null
    pushDebug(debug, 'flow.advance', flowResult)
    pushDebug(debug, 'history.flow', flowMessage)
    pushDebug(debug, 'translation.flow', translatedFlow)
    pushDebug(debug, 'security.flow', security)
    return { reply: security.safe ? translatedFlow : fallbackBlockedMessage(state.language), debug }
  }

  if (routerDecision.functionName === 'resetSession') {
    const language = state.language
    Object.assign(state, createInitialState(), { language })
    const resetMessage = await renderHistory(runtime, state, { routerDecision, action: 'resetSession' })
    const translatedReset = await translateIfNeeded(runtime, state, resetMessage)
    pushDebug(debug, 'history.reset', resetMessage)
    pushDebug(debug, 'translation.reset', translatedReset)
    return { reply: translatedReset, debug }
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
      const missingMessage = await renderHistory(runtime, state, { routerDecision: gatedRouterDecision })
      const translatedMissing = await translateIfNeeded(runtime, state, missingMessage)
      const security = await securityCheck(runtime, translatedMissing)
      pushDebug(debug, 'history.operatorEscalationBlocked', { missingFact: gatedRouterDecision.missingFacts[0], missingMessage })
      pushDebug(debug, 'translation.operatorEscalationBlocked', translatedMissing)
      pushDebug(debug, 'security.operatorEscalationBlocked', security)
      return { reply: security.safe ? translatedMissing : fallbackBlockedMessage(state.language), debug }
    }
    state.operatorRequested = true
    state.escalationReason = routerDecision.escalationReason || 'Manual review requested.'
    const escalationMessage = await renderHistory(runtime, state, { routerDecision, action: 'contactOperator' })
    const translatedEscalation = await translateIfNeeded(runtime, state, escalationMessage)
    const security = await securityCheck(runtime, translatedEscalation)
    state.pendingClosure = 'escalated'
    pushDebug(debug, 'history.escalation', escalationMessage)
    pushDebug(debug, 'translation.escalation', translatedEscalation)
    pushDebug(debug, 'security.escalation', security)
    return { reply: security.safe ? translatedEscalation : fallbackBlockedMessage(state.language), debug }
  }

  if (routerDecision.route === 'faq') {
    const faqSource = await chooseFaqSource(normalizedUserMessage)
    const faqMessage = await renderHistory(runtime, state, { routerDecision, faqSource })
    const translatedFaq = await translateIfNeeded(runtime, state, faqMessage)
    const security = await securityCheck(runtime, translatedFaq)
    pushDebug(debug, 'faq.source', faqSource)
    pushDebug(debug, 'history.faq', faqMessage)
    pushDebug(debug, 'translation.faq', translatedFaq)
    pushDebug(debug, 'security.faq', security)
    return { reply: security.safe ? translatedFaq : fallbackBlockedMessage(state.language), debug }
  }

  if (routerDecision.route === 'washer' || routerDecision.route === 'dryer') {
    state.machineType = routerDecision.route
    if (routerDecision.extractedFacts.machineNumber) {
      state.machineNumber = String(routerDecision.extractedFacts.machineNumber)
    }
    if (routerDecision.missingFacts.length > 0) {
      const singleMissingRouterDecision = pickSingleMissingFact(routerDecision, state)
      const missingMessage = await renderHistory(runtime, state, { routerDecision: singleMissingRouterDecision })
      const translatedMissing = await translateIfNeeded(runtime, state, missingMessage)
      const security = await securityCheck(runtime, translatedMissing)
      state.pendingClosure = null
      pushDebug(debug, 'history.missing', { askedMissingFact: singleMissingRouterDecision.missingFacts[0], missingMessage })
      pushDebug(debug, 'translation.missing', translatedMissing)
      pushDebug(debug, 'security.missing', security)
      return { reply: security.safe ? translatedMissing : fallbackBlockedMessage(state.language), debug }
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
        const missingMessage = await renderHistory(runtime, state, { routerDecision: gatedRouterDecision })
        const translatedMissing = await translateIfNeeded(runtime, state, missingMessage)
        const security = await securityCheck(runtime, translatedMissing)
        pushDebug(debug, 'history.specialistEscalationBlocked', { missingFact: gatedRouterDecision.missingFacts[0], missingMessage })
        pushDebug(debug, 'translation.specialistEscalationBlocked', translatedMissing)
        pushDebug(debug, 'security.specialistEscalationBlocked', security)
        return { reply: security.safe ? translatedMissing : fallbackBlockedMessage(state.language), debug }
      }
      state.escalationReason = specialistDecision.escalationReason || 'Specialist escalation'
      const escalationMessage = await renderHistory(runtime, state, {
        routerDecision,
        specialistDecision,
        action: 'contactOperator',
      })
      const translatedEscalation = await translateIfNeeded(runtime, state, escalationMessage)
      const security = await securityCheck(runtime, translatedEscalation)
      state.pendingClosure = 'escalated'
      pushDebug(debug, 'history.specialistEscalation', escalationMessage)
      pushDebug(debug, 'translation.specialistEscalation', translatedEscalation)
      pushDebug(debug, 'security.specialistEscalation', security)
      return { reply: security.safe ? translatedEscalation : fallbackBlockedMessage(state.language), debug }
    }

    const flowResult = startFlow(runtime, state, specialistDecision.flowId)
    if (!state.activeStepId || !state.activeFlowId) {
      throw new Error('Flow could not start correctly')
    }
    state.lastPresentedStepId = flowResult.stepId
    const openingFlowMessage = await renderHistory(runtime, state, { routerDecision, specialistDecision, flowEngineResult: flowResult })
    const translatedFlow = await translateIfNeeded(runtime, state, openingFlowMessage)
    const security = await securityCheck(runtime, translatedFlow)
    state.pendingClosure = flowResult.isTerminal ? (flowResult.action === 'escalate' ? 'escalated' : 'resolved') : null
    pushDebug(debug, 'flow.start', flowResult)
    pushDebug(debug, 'history.flowStart', openingFlowMessage)
    pushDebug(debug, 'translation.flowStart', translatedFlow)
    pushDebug(debug, 'security.flowStart', security)
    return { reply: security.safe ? translatedFlow : fallbackBlockedMessage(state.language), debug }
  }

  const defaultMessage = await renderHistory(runtime, state, { routerDecision })
  const translatedDefault = await translateIfNeeded(runtime, state, defaultMessage)
  const security = await securityCheck(runtime, translatedDefault)
  pushDebug(debug, 'history.default', defaultMessage)
  pushDebug(debug, 'translation.default', translatedDefault)
  pushDebug(debug, 'security.default', security)
  return { reply: security.safe ? translatedDefault : fallbackBlockedMessage(state.language), debug }
}

function printDebug(debug: string[]): void {
  if (!debug.length) return
  console.log(`\n${CLI_SUBRULE}`)
  console.log('[DEBUG]')
  console.log(CLI_SUBRULE)
  for (const line of debug) {
    console.log(line)
  }
  console.log(CLI_SUBRULE)
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

async function main(): Promise<void> {
  const runtime = await loadRuntime()
  if (process.argv.includes('--check')) {
    printCliBanner('Cliente-0 Demo Check', 'Runtime files loaded successfully.')
    printCliMessage('Info', `Loaded prompts: ${Object.keys(runtime.prompts).join(', ')}`)
    printCliMessage('Info', `Washer flows: ${Object.keys(runtime.flows.washer).join(', ')}`)
    printCliMessage('Info', `Dryer flows: ${Object.keys(runtime.flows.dryer).join(', ')}`)
    return
  }

  if (MOCK_MODE) {
    console.error('The demo must run as a real chatbot. --mock is disabled. Export OPENROUTER_API_KEY and run the real chain.')
    process.exit(1)
  }

  if (!API_KEY && !MOCK_MODE) {
    console.error('OPENROUTER_API_KEY missing. Export it before running the demo.')
    process.exit(1)
  }

  if (SCRIPTED_MODE) {
    await runScripted(runtime)
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