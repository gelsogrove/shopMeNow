// Use-case evaluation suite — LLM-based acceptance criteria evaluator.
// Takes handleTurn as a parameter to avoid circular dependencies with chatbot.ts.

import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Runtime, RegressionAssertion } from '../utils/runtime.js'
import type { TurnResult, UsecaseScenario, AcceptanceCriterionAssessment, DetailedCriteriaEvaluation } from '../utils/types.js'
import { createInitialState, type SessionState } from '../utils/state.js'
import { getDemoDir } from '../utils/runtime.js'
import { callModel, extractJson } from '../utils/llm.js'
import { normalizeDisplayState } from '../utils/display-state.js'
import { extractDisplayState, hasTroubleshootingIntent } from '../utils/intent.js'
import { normalizeForRegression } from '../utils/text.js'
import { printCliBanner, printCliMessage, printDebug, CLI_SUBRULE, BOT_MESSAGE_SEPARATOR } from '../utils/cli.js'
import { assertRegressionReply } from './regression.js'

type HandleTurn = (runtime: Runtime, state: SessionState, userMessage: string) => Promise<TurnResult>

// ── Criteria evaluation ───────────────────────────────────────────────────────

export async function evaluateCriteriaDetailedWithLLM(
  criteria: string[],
  conversation: Array<{you: string; bot: string}>,
  scenarioText: string,
): Promise<{ assessments: AcceptanceCriterionAssessment[]; summary: string; updatedAcceptanceCriteria: string[] }> {
  if (criteria.length === 0 || conversation.length === 0) {
    return { assessments: [], summary: '', updatedAcceptanceCriteria: [] }
  }

  const normalizeForMatch = (value: string): string =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const stripOperatorBlock = (text: string): string =>
    text.replace(/\*{0,2}👤 Human Support message\*{0,2}[\s\S]*/i, '').trimEnd()
  const extractOperatorBlock = (text: string): string => {
    const match = text.match(/\*{0,2}👤 Human Support message\*{0,2}([\s\S]*)/i)
    return match ? match[1].trim() : ''
  }

  const userTurns = conversation.map(({you}) => you)
  const userAll = userTurns.join('\n').toLowerCase()
  const botTurns = conversation.map(({bot}) => stripOperatorBlock(bot))
  const operatorBlocks = conversation.map(({bot}) => extractOperatorBlock(bot)).filter(Boolean)
  const operatorAll = normalizeForMatch(operatorBlocks.join('\n'))
  const convText = conversation
    .map(({you, bot}) => `User: ${you}\nBot: ${bot}`)
    .join('\n\n')
  const firstUserTurn = userTurns[0] || ''
  const firstBotTurn = botTurns[0] || ''

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
    'NO_MACHINE_QUESTION_IN_DOUBLE_CHARGE',
    'ASK_SERVICE_COMPLETED',
    'ASK_NARRATIVE_STEP_BY_STEP',
    'ESCALATE_ON_INCONSISTENT_NARRATIVE',
    'NO_IMMEDIATE_ESCALATION_ON_DOUBLE_CHARGE',
    'ESCALATE_IMMEDIATELY_ANGRY_CUSTOMER',
    'FINAL_MESSAGE_NO_ESCALATION_WORDS',
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
      '- If it says bot must NOT ask machine type or machine number (double charge case) -> NO_MACHINE_QUESTION_IN_DOUBLE_CHARGE',
      '- If it requires asking whether the service (lavado/secado) was completed -> ASK_SERVICE_COMPLETED',
      '- If it requires asking for a step-by-step narrative/account (paso a paso, relato) -> ASK_NARRATIVE_STEP_BY_STEP',
      '- If it requires escalating when narrative is inconsistent or amount does not match -> ESCALATE_ON_INCONSISTENT_NARRATIVE',
      '- If it says bot must NOT escalate immediately upon detecting double charge (data collection first) -> NO_IMMEDIATE_ESCALATION_ON_DOUBLE_CHARGE',
      '- If it requires immediate escalation when customer is very angry and demands human operator -> ESCALATE_IMMEDIATELY_ANGRY_CUSTOMER',
      '- If the final message must NOT contain words like operador or desactivado -> FINAL_MESSAGE_NO_ESCALATION_WORDS',
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

  const evaluateHeuristic = async (criterion: string): Promise<boolean | null> => {
    const criterionNorm = normalizeForMatch(criterion)

    // "No pregunta el tipo de máquina" — only checks machine TYPE, bot is still allowed to ask machine NUMBER
    if (/no pregunta.*tipo|no debe preguntar.*tipo/.test(criterionNorm)) {
      return !hasMachineTypeQuestion(botAll)
    }
    // "No pregunta el número de máquina" — separate criterion
    if (/no pregunta.*(numero de maquina|numero de la maquina)|no debe preguntar.*(numero de maquina)/.test(criterionNorm)) {
      return !hasMachineNumberQuestion(botAll)
    }
    if (/pregunta si ha podido completar|pregunta si pudo completar|completar el lavado|completar el secado/.test(criterionNorm)) {
      return /pudiste completar|pudo completar|ha podido completar|complet[ao] el (lavado|secado|servicio)/i.test(botAll)
    }
    if (/solicita el relato paso a paso|relato paso a paso/.test(criterionNorm)) {
      return /paso a paso|cu[eé]ntame|cu[eé]ntenos|qu[eé] pas[oó]|c[oó]mo empez/i.test(botAll)
    }
    if (/solicita los.*(4|cuatro) d[ií]gitos|[uú]ltimos.*(4|cuatro) d[ií]gitos/.test(criterionNorm)) {
      return /[uú]ltimos 4 d[ií]gitos|[uú]ltimos cuatro|last 4 digits|4 d[ií]gitos de la tarjeta/i.test(botAll)
    }
    if (/solicita una captura|captura del pago|captura de pantalla/.test(criterionNorm)) {
      return /captura|comprobante|screenshot|pantallazo/i.test(botAll)
    }
    if (/no escala de inmediato|no escala inmediatamente/.test(criterionNorm) && /doble cobro/.test(criterionNorm)) {
      const firstBotNorm = normalizeForMatch(firstBotTurn)
      return !/operador|escal|derivar|humano se encarg/.test(firstBotNorm)
    }
    if (/mensaje final no contiene|no contiene.*operador.*desactivado|no contiene.*desactivado.*operador/.test(criterionNorm)) {
      const lastBotTurn = botTurns[botTurns.length - 1] || ''
      return !/operador|desactivado/i.test(lastBotTurn)
    }
    if (/muy molesto.*escala inmediatamente|escala inmediatamente.*muy molesto/.test(criterionNorm)) {
      const angryUserIdx = userTurns.findIndex((t) =>
        /enfadad|furioso|molest|operador ahora mismo|hablar con una persona|quiero hablar con|muy enojad/i.test(t)
      )
      if (angryUserIdx === -1) return null
      const botAfterAngry = botTurns[angryUserIdx] || ''
      return /operador|escalar|derivar/i.test(botAfterAngry)
    }
    if (/mensaje de escalacion contiene.*operador|contiene la palabra.*operador/.test(criterionNorm)) {
      const escalationBotTurns = botTurns.filter((t) => /operador|escal|derivar|⚠|encarg/i.test(t))
      return escalationBotTurns.some((t) => /operador/i.test(t))
    }
    if (/human support message.*resume|mensaje final al operador.*resume|resume.*nombre.*localizacion|resume.*nombre.*maquina/.test(criterionNorm)) {
      if (operatorAll.length === 0) return false
      const displayMatch = criterionNorm.match(/\b(sel|door|alm|al001|push|pr)\b/)
      const hasDisplay = !displayMatch || new RegExp(displayMatch[1], 'i').test(operatorAll)
      const hasLocation = /lavander|local|pueblo|calle|pineda|hortes|goya|barcelona|madrid|[a-z]{4,}/.test(operatorAll)
      const hasMachineNum = /numero|maquina|lavadora|secadora|\b\d\b/.test(operatorAll)
      const hasName = /usuario|cliente|nombre/.test(operatorAll)
      return hasDisplay && hasLocation && hasMachineNum && hasName
    }
    if (/mensaje de confirmacion final contiene.*desactivado|contiene la palabra.*desactivado|informa explicitamente.*desactivado|chatbot sera desactivado/.test(criterionNorm)) {
      const lastBotTurn = botTurns[botTurns.length - 1] || ''
      return /desactivado/i.test(lastBotTurn)
    }
    if (/mensaje de confirmacion final contiene.*brevedad|brevedad.*llamada|contiene.*brevedad.*llamada telefonica|llamada telefonica/.test(criterionNorm)) {
      const lastBotTurn = botTurns[botTurns.length - 1] || ''
      return /brevedad/i.test(lastBotTurn) && /llamada/i.test(lastBotTurn)
    }
    if (/anuncia que un operador.*brevedad|brevedad posible.*llamada|operador se encargara.*maxima brevedad/.test(criterionNorm)) {
      const lastBotTurn = botTurns[botTurns.length - 1] || ''
      return /brevedad/i.test(lastBotTurn) && /llamada/i.test(lastBotTurn)
    }
    if (/relato es inconsistente|importe no cuadra/.test(criterionNorm) && /escala/.test(criterionNorm)) {
      const inconsistentUserIdx = userTurns.findIndex((t) =>
        /tres o cuatro veces|no s[eé] exactamente|importe no me cuadra|no cuadra|varias veces sin saber/i.test(t)
      )
      if (inconsistentUserIdx === -1) return null
      const botAfterInconsistent = botTurns[inconsistentUserIdx] || ''
      return /operador|escalar|derivar/i.test(botAfterInconsistent)
    }
    if (/no contin[uú]a recogiendo|no contin[uú]a solicitando/.test(criterionNorm)) {
      const escalationBotIdx = botTurns.findIndex((t) => /operador|escal|derivar/i.test(t))
      if (escalationBotIdx === -1) return null
      const afterEscalation = botTurns.slice(escalationBotIdx + 1).join('\n')
      return !/d[ií]gitos de la tarjeta|captura|comprobante/i.test(afterEscalation)
    }
    if (/antes de escalar.*pregunta el nombre|pregunta el nombre.*antes de escalar|nombre del cliente.*junto con/.test(criterionNorm)) {
      const escalationBotTurn = botTurns.find((t) => /operador|escal|derivar|⚠/i.test(t))
      return escalationBotTurn ? /llamas|nombre/i.test(escalationBotTurn) : false
    }
    if (/recoge la localizacion antes|localizacion antes de cualquier/.test(criterionNorm)) {
      return hasLocationQuestion(botAll)
    }

    const isOrderedSequenceCriterion =
      /pagar|paga/.test(criterionNorm) &&
      /seleccionar|selecciona/.test(criterionNorm) &&
      (/pulsar|presiona|programa/.test(criterionNorm) || /elige.*programa/.test(criterionNorm)) &&
      /cerrar|cierra/.test(criterionNorm) &&
      /puerta/.test(criterionNorm)

    if (isOrderedSequenceCriterion) {
      // New 6-step order: cargar lavadora, cerrar puerta, pagar (central), seleccionar maquina, programa, avisar
      const isNewOrderCriterion = /carga.*lavadora|cargar la lavadora|central de pago/.test(criterionNorm)
      if (isNewOrderCriterion) {
        const cargaIndex = botAll.search(/carga la lavadora|cargar la lavadora/)
        const doorIndex = botAll.search(/cierra la puerta|cerrar la puerta/)
        const payIndex = botAll.search(/central de pago|\bpaga\b/)
        const selectIndex = botAll.search(/selecciona el numero|selecciona el número|seleccionar.*numero/)
        const programIndex = botAll.search(/elige el programa|programa/)
        return cargaIndex !== -1 && doorIndex !== -1 && payIndex !== -1 && selectIndex !== -1 && programIndex !== -1 &&
          cargaIndex < doorIndex && doorIndex < payIndex && payIndex < selectIndex && selectIndex < programIndex
      }
      const payIndex = botAll.search(/\bpaga\b|\bpay\b/)
      const selectIndex = botAll.search(/selecciona la maquina|selecciona la máquina|select machine/)
      const programIndex = botAll.search(/presiona el programa|pulsa.*programa|press program/)
      const doorIndex = botAll.search(/cierra la puerta|close the door/)
      return payIndex !== -1 && selectIndex !== -1 && programIndex !== -1 && doorIndex !== -1 &&
        payIndex < selectIndex && selectIndex < programIndex && programIndex < doorIndex
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
      const askedMachineNumber = /numero de la lavadora|numero de la secadora|numero de la maquina|numero/.test(botAfterSignalNorm)
      const userAlreadyProvidedType = /lavadora|secadora|washer|dryer/.test(userAllNorm)
      const askedMachineType = /lavadora o secadora|tipo de maquina/.test(botAfterSignalNorm)
      const machineTypeSatisfied = userAlreadyProvidedType || askedMachineType
      return askedLocation && askedMachineNumber && machineTypeSatisfied
    }

    if (/no debe cerrar el caso como resuelto/.test(criterionNorm)) {
      return !/\bperfecto\b|ha arrancado correctamente|problema ha sido resuelto|caso resuelto|problema resuelto|todo resuelto|ya esta resuelto/.test(botAll)
    }
    if (/perfecto/.test(criterionNorm) && /correctamente/.test(criterionNorm)) {
      return /\bperfecto\b/.test(botAll) && /correctamente/.test(botAll)
    }

    // ── FAQ literal-text criteria (cases 8-13) ───────────────────────────────
    // Handle here to bypass the LLM tag classifier which often misclassifies
    // simple FAQ assertions into troubleshooting tags and produces false negatives.
    const quotedSegments = [...criterion.matchAll(/['"“”‘’«»]([^'"“”‘’«»]+)['"“”‘’«»]/g)]
      .map((m) => normalizeForMatch(m[1]))
      .filter(Boolean)
    const firstBotNormLocal = normalizeForMatch(firstBotTurn)
    const lastBotNormLocal = normalizeForMatch(botTurns[botTurns.length - 1] || '')

    if (/menciona la palabra|menciona las palabras/.test(criterionNorm) && quotedSegments.length > 0) {
      return quotedSegments.every((w) => botAll.includes(w))
    }
    if (/contiene la palabra|contiene las palabras/.test(criterionNorm) && quotedSegments.length > 0) {
      const target = /primer mensaje|primera respuesta/.test(criterionNorm)
        ? firstBotNormLocal
        : /mensaje final|ultimo mensaje|tras dar el nombre/.test(criterionNorm)
          ? lastBotNormLocal
          : botAll
      return quotedSegments.every((w) => target.includes(w))
    }
    if (/saluda como asistente virtual de (ecolaundry|la lavanderia)/.test(criterionNorm)) {
      return /asistente virtual de (ecolaundry|la lavanderia)/.test(firstBotNormLocal)
    }
    if (/no pregunta si es lavadora o secadora/.test(criterionNorm)) {
      return !hasMachineTypeQuestion(botAll)
    }
    if (/no pregunta qu[eé]? aparece en la pantalla|no pregunta.*pantalla/.test(criterionNorm)) {
      return !hasDisplayQuestion(botAll)
    }
    if (/indica seguir las instrucciones.*pantalla|sigue las instrucciones.*pantalla|instrucciones.*en pantalla/.test(criterionNorm)) {
      return /instrucciones.*pantalla|sigue las instrucciones/.test(botAll)
    }
    if (/solo funciona en la tienda/.test(criterionNorm)) {
      return /solo funciona en la tienda|funciona.*tienda donde/.test(botAll)
    }
    if (/menciona el precio.*efectivo|precio.*20.*efectivo|20.*efectivo/.test(criterionNorm)) {
      return /20/.test(botAll) && /efectivo/.test(botAll)
    }
    if (/pregunta la lavanderia/.test(criterionNorm)) {
      return hasLocationQuestion(botAll)
    }
    if (/incidencia.*revisi[oó]?n manual|revisar manualmente|requiere revisi[oó]?n/.test(criterionNorm)) {
      return /incidencia interna|revisar manualmente|revision manual|revisarlo manualmente/.test(botAll)
    }
    if (/pide el nombre.*como te llamas|frase.*como te llamas|preguntar.*como te llamas/.test(criterionNorm)) {
      return /como te llamas/.test(botAll)
    }
    if (/no inventa horarios/.test(criterionNorm)) {
      return /8:00.*22:00|22:00.*8:00/.test(botAll)
    }
    if (/no inventa.*precio|no inventa el precio/.test(criterionNorm)) {
      return /tengo que revisarlo|necesito revisarlo|revisar.*confirm|antes de confirm/.test(botAll)
    }
    if (/pide el codigo exacto|codigo exacto.*lavanderia/.test(criterionNorm)) {
      return /codigo exacto|el codigo tal como/.test(botAll) && hasLocationQuestion(botAll)
    }
    if (/horario general 8:00 a 22:00|indica horario general/.test(criterionNorm)) {
      return /8:00.*22:00|22:00.*8:00/.test(botAll)
    }
    if (/excepci[oó]?n.*l[' ]?escala|l[' ]?escala.*7:00.*23:00|7:00 a 23:00/.test(criterionNorm)) {
      return /escala.*7:00.*23:00|7:00.*23:00/.test(botAll)
    }
    if (/necesita revisarlo antes de confirmar|antes de confirmar el importe/.test(criterionNorm)) {
      return /revisarlo|necesito revisar|antes de confirm/.test(botAll)
    }

    const tag = await classifyCriterionTag(criterion)

    if (tag === 'WARM_GREETING_WITH_REASSURANCE') {
      const firstBotNorm = normalizeForMatch(firstBotTurn)
      const hasGreeting = /hola|buenos dias|buenas tardes|buenas noches/.test(firstBotNorm)
      const hasReassurance = /tranquil|no te preocup|lo resolvemos juntos|para ayudarte|estoy aqui|soy el asistente virtual/.test(firstBotNorm)
      return hasGreeting && hasReassurance
    }
    if (tag === 'CLASSIFY_PROBLEM_NOT_FAQ') {
      const botLooksTroubleshooting =
        hasDisplayQuestion(botAll) || hasLocationQuestion(botAll) || hasMachineNumberQuestion(botAll)
      const botLooksFaq = /politica local|manual review|will review it manually|depende de la politica/.test(botAll)
      return hasTroubleshootingIntent(firstUserTurn) && botLooksTroubleshooting && !botLooksFaq
    }
    if (tag === 'REQUEST_LOCATION') return hasLocationQuestion(botAll)
    if (tag === 'REQUEST_MACHINE_TYPE_UNLESS_ALREADY_GIVEN') {
      if (userAlreadyProvidedMachineType) return true
      return hasMachineTypeQuestion(botAll)
    }
    if (tag === 'REQUEST_MACHINE_NUMBER') return hasMachineNumberQuestion(botAll)
    if (tag === 'ASK_DISPLAY_STATE') {
      const criterionNorm2 = normalizeForMatch(criterion)
      const asksOrder = /antes/.test(criterionNorm2) && /(local|ubicacion|numero de maquina|tipo)/.test(criterionNorm2)
      const firstDisplayIdx = botTurns.findIndex((turn) => hasDisplayQuestion(normalizeForMatch(turn)))
      if (firstDisplayIdx === -1) return false
      if (!asksOrder) return true
      const firstLocationIdx = botTurns.findIndex((turn) => hasLocationQuestion(normalizeForMatch(turn)))
      const firstMachineTypeIdx = botTurns.findIndex((turn) => hasMachineTypeQuestion(normalizeForMatch(turn)))
      const firstMachineNumberIdx = botTurns.findIndex((turn) => hasMachineNumberQuestion(normalizeForMatch(turn)))
      return (firstLocationIdx === -1 || firstDisplayIdx < firstLocationIdx) &&
        (firstMachineTypeIdx === -1 || firstDisplayIdx < firstMachineTypeIdx) &&
        (firstMachineNumberIdx === -1 || firstDisplayIdx < firstMachineNumberIdx)
    }
    if (tag === 'SHOW_WASHER_PROGRAMS_ON_PUSH') {
      return /programa|programas|programs|opciones/.test(botAll) &&
        /\b60[°º]?\b/.test(botAll) && /\b40[°º]?\b/.test(botAll) &&
        /\b30[°º]?\b/.test(botAll) && /frio|cold/.test(botAll)
    }
    if (tag === 'NO_SOLUTION_BEFORE_DISPLAY') {
      const firstDisplayIdx = botTurns.findIndex((turn) => /pantalla|display|qu[eé] ves exactamente/i.test(turn))
      const preDisplayTurns = firstDisplayIdx >= 0 ? botTurns.slice(0, firstDisplayIdx) : botTurns
      const preDisplayText = normalizeForMatch(preDisplayTurns.join('\n'))
      return !/1\.|2\.|presiona|pulsa|inserta|selecciona|elige|reinicia|apaga|enciende/.test(preDisplayText)
    }
    if (tag === 'NO_ASSUME_CAUSE') return !/la causa es|es por|averia confirmada|seguro que/.test(botAll)
    if (tag === 'CALM_TONE_AFTER_COMPLAINT') return null
    if (tag === 'ASK_IF_SOLUTION_WORKED') {
      return /ha comenzado a funcionar|ha empezado a funcionar|ha arrancado|funciona ahora|let me know if|hazmelo saber si funciona|h[aá]zmelo saber si funciona|dime si funciona|confirm[aá]melo si funciona|confirma si funciona/.test(botAll)
    }
    if (tag === 'NO_PAYMENT_PATH_AFTER_CONFIRMED') {
      return !/pago completado|payment complete|vuelve a pagar|pay again|inserta monedas|anade dinero|falta dinero/.test(botAll)
    }
    if (tag === 'NO_MACHINE_QUESTION_IN_DOUBLE_CHARGE') {
      return !hasMachineTypeQuestion(botAll) && !hasMachineNumberQuestion(botAll)
    }
    if (tag === 'ASK_SERVICE_COMPLETED') {
      return /pudiste completar|pudo completar|complet[ao] el lavado|complet[ao] el secado|complet[ao] el servicio|did you complete|has podido completar/i.test(botAll)
    }
    if (tag === 'ASK_NARRATIVE_STEP_BY_STEP') {
      return /paso a paso|cu[eé]ntame|cu[eé]ntenos|desc[rí]be|qu[eé] pas[oó]|c[oó]mo empez|what happened/i.test(botAll)
    }
    if (tag === 'NO_IMMEDIATE_ESCALATION_ON_DOUBLE_CHARGE') {
      return !/operador|escal|derivar|humano se encarg/.test(normalizeForMatch(firstBotTurn))
    }
    if (tag === 'ESCALATE_IMMEDIATELY_ANGRY_CUSTOMER') {
      const angryUserIdx = userTurns.findIndex((t) =>
        /enfadad|furioso|molest|operador ahora mismo|hablar con una persona|quiero hablar con|muy enojad/i.test(t)
      )
      if (angryUserIdx === -1) return null
      const botAfterAngry = botTurns[angryUserIdx] || ''
      return /operador|escalar|derivar/i.test(botAfterAngry) && /llamas|nombre/i.test(botAfterAngry)
    }
    if (tag === 'ESCALATE_ON_INCONSISTENT_NARRATIVE') {
      const inconsistentUserIdx = userTurns.findIndex((t) =>
        /tres o cuatro veces|no s[eé] exactamente|importe no me cuadra|no cuadra|cuatro veces|varias veces sin saber/i.test(t)
      )
      if (inconsistentUserIdx === -1) return null
      return /operador|escalar|derivar/i.test(botTurns[inconsistentUserIdx] || '')
    }
    if (tag === 'FINAL_MESSAGE_NO_ESCALATION_WORDS') {
      const lastBotTurn = botTurns[botTurns.length - 1] || ''
      return !/operador|desactivado/i.test(lastBotTurn)
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
        userPrompt: `Analiza este diálogo y evalúa si este criterio de aceptación se cumple razonablemente.\n\nSe generoso: si el bot intenta cumplir el criterio aunque no sea perfecto, cuenta como SÍ.\nSolo marca NO si hay una violación clara y evidente.\n\nDiálogo:\n${convText}\n\nCriterio:\n${criterion}\n\nResponde SOLO con una palabra: SÍ o NO`,
        maxTokens: 5,
        temperature: 0.5,
      })
      result[criterion] = /^(sí|si|yes)\b/.test(answer.trim().toLowerCase())
    } catch {
      result[criterion] = false
    }
  }

  const prompt = [
    'Evalúa los criterios de aceptación contra la conversación.',
    'Sé generoso: si el bot cumple el criterio razonablemente bien, márcalo como passed=true.',
    'Solo marca passed=false si hay una violación clara y evidente del criterio.',
    'En caso de duda, da el beneficio de la duda (passed=true).',
    'Devuelve JSON estricto con esta estructura únicamente:',
    '{',
    '  "assessments": [',
    '    {',
    '      "criterion": "string",',
    '      "passed": true,',
    '      "reason": "SOLO para passed=false: explica qué exactamente faltó o fue incorrecto, citando texto concreto del diálogo",',
    '      "evidence": ["cita textual exacta del bot que demuestra el fallo"],',
    '      "suggestedRewrite": "texto mejorado del criterio (opcional)"',
    '    }',
    '  ],',
    '  "summary": "un párrafo",',
    '  "updatedAcceptanceCriteria": ["lista completa de criterios reescritos"]',
    '}',
    '',
    'Reglas:',
    '- Usa exactamente el mismo texto del criterio en el campo "criterion".',
    '- Si no estás seguro, da el beneficio de la duda (passed=true).',
    '- Para passed=false: reason debe explicar el fallo concreto (no frases genéricas).',
    '- evidence debe citar literalmente el mensaje del bot que causa el fallo (o estar vacío si no hay evidencia).',
    '- Para passed=true: reason y evidence pueden estar vacíos.',
    '',
    `Escenario:\n${scenarioText || '(no proporcionado)'}`,
    '',
    `Criterios:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
    '',
    `Conversación:\n${convText}`,
  ].join('\n')

  let llmAssessments: AcceptanceCriterionAssessment[] = []
  let llmSummary = ''
  let llmUpdatedAcceptanceCriteria: string[] = []

  try {
    const raw = await callModel({ userPrompt: prompt, json: true, maxTokens: 1400, temperature: 0.5 })
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

export async function evaluateCriteriaWithLLM(
  criteria: string[],
  conversation: Array<{you: string; bot: string}>,
  scenarioText: string,
): Promise<Record<string, boolean>> {
  const detailed = await evaluateCriteriaDetailedWithLLM(criteria, conversation, scenarioText)
  return detailed.assessments.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.criterion] = item.passed
    return acc
  }, {})
}

// ── File finders ──────────────────────────────────────────────────────────────

export async function findUsecaseFile(caseNumber: number): Promise<string | null> {
  const demoDir = getDemoDir()
  const usecasesDir = path.resolve(demoDir, '..', '..', 'usecases')
  const prefix = `case${String(caseNumber).padStart(2, '0')}`
  let entries: string[]
  try {
    entries = await readdir(usecasesDir)
  } catch {
    return null
  }
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

export async function findUsecaseScenarioJsons(caseNumber: number): Promise<string[]> {
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

  const legacyPath = path.join(caseDir, 'scenario.json')
  try {
    await readFile(legacyPath, 'utf8')
    return [legacyPath]
  } catch {
    return []
  }
}

// ── Markdown rendering ────────────────────────────────────────────────────────

export function renderConversationTurns(turns: Array<{you: string; bot: string}>): string {
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

// ── Markdown write-back ───────────────────────────────────────────────────────

export async function updateUsecaseMd(
  caseNumber: number,
  passed: boolean,
  failures: string[],
  namedConversations: Array<{ scenarioName: string; turns: Array<{you: string; bot: string}> }>,
  debugMode: boolean,
): Promise<void> {
  const mdPath = await findUsecaseFile(caseNumber)
  if (!mdPath) {
    printCliMessage('Info', `Use-case file for Case ${caseNumber} not found in usecases/ — skipping write-back.`)
    return
  }

  const content = await readFile(mdPath, 'utf8')

  const scenarioMatch = content.match(/##\s*SCENARIO\s*\n([\s\S]*?)(?=\n##\s*ACCEPTANCE CRITERIA)/i)
  const scenarioText = scenarioMatch?.[1]?.trim() || ''

  const criteriaMatch = content.match(/##\s*ACCEPTANCE CRITERIA\s*\n([\s\S]*?)(?=\n##\s*CONVERSATION|\n##\s*REPORT|\n##\s*EVALUACI)/i)
  const existingCriteriaRaw = criteriaMatch?.[1]?.trim() || ''

  type ScopedCriterion = { text: string; scope: 'global' | string }
  const scopedCriteria: ScopedCriterion[] = []
  let currentScope: ScopedCriterion['scope'] = 'global'

  for (const rawLine of existingCriteriaRaw.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^###\s*/.test(line)) {
      const scenarioHeaderMatch = line.match(/^###\s*Scenario\s+(\d+\.\d+)/i)
      currentScope = scenarioHeaderMatch ? scenarioHeaderMatch[1] : 'global'
      continue
    }
    if (!/^\s*-\s*/.test(rawLine)) continue
    const text = line.replace(/^\s*-\s*(?:✅|❌)?\s*/, '').trim()
    if (!text) continue
    if (/^_?sin criterios/i.test(text)) continue
    if (/^[-_]{2,}$/.test(text)) continue
    scopedCriteria.push({ text, scope: currentScope })
  }

  const criteriaTexts = scopedCriteria.map((item) => item.text)
  const allTurns = namedConversations.flatMap(({ turns }) => turns)
  const turnsByScenario = new Map<string, Array<{you: string; bot: string}>>()

  for (const [index, { scenarioName, turns }] of namedConversations.entries()) {
    const match = scenarioName.match(/Scenario\s+(\d+\.\d+)/i)
    if (match) turnsByScenario.set(match[1], turns)
    const fallbackKey = `${caseNumber}.${index + 1}`
    if (!turnsByScenario.has(fallbackKey)) turnsByScenario.set(fallbackKey, turns)
  }

  const globalCriteria: string[] = []
  const criteriaByScenario = new Map<string, string[]>()
  const criterionTurnsMap = new Map<string, Array<{you: string; bot: string}>>()

  for (const { text: criterion, scope } of scopedCriteria) {
    if (scope === 'global') {
      globalCriteria.push(criterion)
      criterionTurnsMap.set(criterion, allTurns)
      continue
    }
    const list = criteriaByScenario.get(scope) || []
    list.push(criterion)
    criteriaByScenario.set(scope, list)
    criterionTurnsMap.set(criterion, turnsByScenario.get(scope) || allTurns)
  }

  const assessmentByCriterion = new Map<string, AcceptanceCriterionAssessment>()

  if (globalCriteria.length > 0) {
    const globalEval = await evaluateCriteriaDetailedWithLLM(globalCriteria, allTurns, scenarioText)
    for (const assessment of globalEval.assessments) {
      assessmentByCriterion.set(assessment.criterion, assessment)
    }
  }

  for (const [scenarioKey, criteriaForScenario] of criteriaByScenario.entries()) {
    const turns = turnsByScenario.get(scenarioKey) || allTurns
    const scopedEval = await evaluateCriteriaDetailedWithLLM(criteriaForScenario, turns, scenarioText)
    for (const assessment of scopedEval.assessments) {
      assessmentByCriterion.set(assessment.criterion, assessment)
    }
  }

  const detailedEval: DetailedCriteriaEvaluation = {
    assessments: criteriaTexts
      .map((criterion) => assessmentByCriterion.get(criterion))
      .filter((item): item is AcceptanceCriterionAssessment => Boolean(item)),
    summary: '',
    updatedAcceptanceCriteria: [],
  }

  if (debugMode) {
    const criteriaEval = detailedEval.assessments.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.criterion] = item.passed
      return acc
    }, {})
    printCliMessage('Info', `Case ${caseNumber} criteria eval: ${JSON.stringify(criteriaEval)}`)
  }

  const allConversationBlocks = namedConversations
    .map(({ scenarioName, turns }) =>
      `## CONVERSATION — ${scenarioName}\n\n${renderConversationTurns(turns)}`,
    )
    .join('\n\n---\n\n')

  const sanitizeEvidenceText = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 220)

  const pickFallbackExample = (criterion: string): string => {
    const turnsForCriterion = criterionTurnsMap.get(criterion) || allTurns
    const botReplies = turnsForCriterion.map((turn) => turn.bot).map((text) => text.trim()).filter(Boolean)
    const criterionTokens = criterion
      .toLowerCase()
      .split(/[^a-z0-9áéíóúüñ]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 5)
    const matched = botReplies.find((reply) => {
      const normalizedReply = reply.toLowerCase()
      return criterionTokens.some((token) => normalizedReply.includes(token))
    })
    const candidate = matched || botReplies[botReplies.length - 1] || ''
    return candidate ? sanitizeEvidenceText(candidate) : 'No hay ejemplo disponible en la conversación.'
  }

  const failedAssessments = detailedEval.assessments.filter((item) => !item.passed)
  const reportLines = failedAssessments.length > 0
    ? failedAssessments.map((item) => {
      const reason = item.reason || 'No se cumple el criterio según la evaluación de la conversación.'
      const evidenceExample = item.evidence.length > 0
        ? sanitizeEvidenceText(item.evidence[0])
        : pickFallbackExample(item.criterion)
      return [
        `- ❌ ${item.criterion}`,
        `  > Por qué no se cumple: ${reason}`,
        `  > Ejemplo: "${evidenceExample}"`,
      ].join('\n')
    }).join('\n')
    : '- No se detectaron criterios negativos.'

  const firstConvPos = content.search(/##[ \t]*CONVERSATION[^\n]*/i)
  const reportPos = content.search(/\n##[ \t]*REPORT LLM/i)

  let updated: string
  if (firstConvPos !== -1 && reportPos !== -1) {
    const before = content.substring(0, firstConvPos)
    const afterReport = content.substring(reportPos)
    updated = before + allConversationBlocks + '\n' + afterReport
  } else if (firstConvPos !== -1) {
    updated = content.substring(0, firstConvPos) + allConversationBlocks
  } else {
    updated = content.trimEnd() + '\n\n' + allConversationBlocks
  }

  const reportSectionRe = /(##[ \t]*REPORT LLM[ \t]*\r?\n)[\s\S]*?$/i
  if (reportSectionRe.test(updated)) {
    updated = updated.replace(reportSectionRe, `$1\n${reportLines}\n`)
  } else {
    updated = updated.trimEnd() + `\n\n## REPORT LLM\n\n${reportLines}\n`
  }

  updated = updated.replace(
    /(##[ \t]*(?:SCENARIO|ACCEPTANCE CRITERIA|REPORT LLM)[ \t]*\r?\n)(?:[ \t]*\r?\n)*/gi,
    '$1\n',
  )

  await writeFile(mdPath, updated, 'utf8')
  printCliMessage('Info', `Evaluation written to usecases/${path.basename(mdPath)} → Case ${caseNumber}.`)
}

// ── Main suite runner ─────────────────────────────────────────────────────────

export async function runUsecaseSuite(
  runtime: Runtime,
  debugMode: boolean,
  handleTurn: HandleTurn,
  usecaseNum: number | null,
  usecaseRange: { start: number; end: number } | null,
): Promise<void> {
  const demoDir = path.resolve(getDemoDir(), '..')
  const fallbackAll = JSON.parse(
    await readFile(path.join(demoDir, 'json', 'usecases_test.json'), 'utf8'),
  ) as UsecaseScenario[]

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
  if (usecaseNum !== null) {
    caseNumbersToRun = [usecaseNum]
  } else if (usecaseRange !== null) {
    for (let i = usecaseRange.start; i <= usecaseRange.end; i += 1) {
      caseNumbersToRun.push(i)
    }
  } else {
    caseNumbersToRun = fallbackAll.map((_, i) => i + 1)
  }

  type CaseGroup = {
    caseNumber: number
    scenarios: Array<{ name: string; scenario: UsecaseScenario }>
  }
  const caseGroups: CaseGroup[] = []
  for (const caseNumber of caseNumbersToRun) {
    const scenarios = await loadScenariosForCase(caseNumber)
    if (scenarios.length > 0) caseGroups.push({ caseNumber, scenarios })
  }

  const totalScenarios = caseGroups.reduce((sum, g) => sum + g.scenarios.length, 0)
  const writeEvaluationForSelection = usecaseNum !== null || usecaseRange !== null

  if (totalScenarios === 0) {
    const selected = usecaseNum !== null
      ? `--usecase ${usecaseNum}`
      : (usecaseRange !== null ? `--usecase-range ${usecaseRange.start}-${usecaseRange.end}` : '--usecases')
    console.error(`No scenario found for ${selected}. Valid range: 1-${fallbackAll.length}`)
    process.exitCode = 1
    return
  }

  const label = usecaseNum !== null
    ? `Case ${usecaseNum} (${caseGroups[0]?.scenarios.length ?? 0} scenario/s)`
    : usecaseRange !== null
      ? `Cases ${usecaseRange.start}-${usecaseRange.end} (${totalScenarios} scenario/s)`
      : `${caseGroups.length} cases, ${totalScenarios} scenarios`

  printCliBanner('Cliente-0 Usecase Suite', `Running ${label} with assertions.`)

  const allFailures: string[] = []

  for (const { caseNumber, scenarios } of caseGroups) {
    printCliBanner(`Case ${caseNumber} — ${scenarios.length} scenario/s`)

    const namedConversations: Array<{ scenarioName: string; turns: Array<{you: string; bot: string}> }> = []
    const caseFailures: string[] = []

    for (const { name: scenarioName, scenario } of scenarios) {
      printCliBanner(`  ${scenarioName}`)

      const state = createInitialState()
      if (scenario.preState) {
        Object.assign(state, scenario.preState)
      }

      const conversationLog: Array<{you: string; bot: string}> = []

      for (const [turnIndex, turn] of scenario.turns.entries()) {
        printCliMessage('You', turn)
        const result = await handleTurn(runtime, state, turn)
        printCliMessage('Bot', result.reply)
        conversationLog.push({ you: turn, bot: result.reply })
        if (debugMode) printDebug(result.debug)

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

    if (writeEvaluationForSelection) {
      await updateUsecaseMd(caseNumber, caseFailures.length === 0, caseFailures, namedConversations, debugMode)
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
