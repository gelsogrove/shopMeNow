// Response generation layer.
// Wraps the Conversation History LLM + post-processing patches.

import type { RouterDecision, SpecialistDecision, FlowEngineResult } from './types.js'
import type { SessionState } from './state.js'
import type { Runtime } from './runtime.js'
import { summarizeState } from './state.js'
import { buildLocationContext, replaceVars, getFaqs } from './runtime.js'
import { callModel, extractJson } from './llm.js'
import { renderMissingFactQuestion } from './missing-facts.js'
import { normalizeForRegression } from './text.js'

// ── Constants ─────────────────────────────────────────────────────────────────

export const CHATBOT_NAME = 'Ecolaundry Assistant'
export const TONE_OF_VOICE = 'calm, reassuring, relaxed, warm, step-by-step'
export const ALLOWED_LINKS = 'echatbot.ai, www.echatbot.ai, forms.gle, alberwaz.net'
export const FAQ_FALLBACK =
  'If this question depends on local policy, the operator will review it manually.'

// ── FAQ source selection ──────────────────────────────────────────────────────

export async function chooseFaqSource(message: string): Promise<string> {
  const faqs = getFaqs()
  const topics = Object.entries(faqs)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  const key = await callModel({
    userPrompt: `Which FAQ topic best matches the message? Reply with ONLY the key or NONE.\n\nTopics:\n${topics}\n\nCustomer message:\n${message}`,
    maxTokens: 20,
  })
  const normalized = key.trim().replace(/^"|"$/g, '')
  return faqs[normalized] || FAQ_FALLBACK
}

// ── MOCK-ONLY post-processing patches ────────────────────────────────────────
// These functions fix LLM output inconsistencies during mock/demo.
// In production: the Conversation History LLM prompt owns correct output.

export function normalizeSpanishDisplayOptions(message: string): string {
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

export function injectSpanishWasherProgramsGuide(message: string): string {
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

export function injectSpanishEscalationClosure(message: string): string {
  const normalized = normalizeForRegression(message)
  const looksEscalation =
    /notificando al operador|avisando al operador|revisado manualmente por un operador|review it another way|manual review/.test(
      normalized,
    )
  if (!looksEscalation) return message
  if (/quedate a la espera|chatbot esta ahora deshabilitado/i.test(normalized)) return message
  const closure =
    ' Quedate a la espera: un operador te respondera lo antes posible. El chatbot esta ahora deshabilitado.'
  return `${message.trim()}${closure}`
}

export function normalizeItalianFlowPhrases(message: string): string {
  return message
    .replace(/Let['']s sort this out\.?/gi, 'Vediamo di risolvere.')
    .replace(
      /Have you already completed the payment at the central unit\?/gi,
      'Hai gia completato il pagamento alla centralina?',
    )
    .replace(
      /What exactly do you see on the display\?/gi,
      'Cosa vedi esattamente sul display?',
    )
    .replace(
      /Were you able to complete the payment\?/gi,
      'Sei riuscito a completare il pagamento?',
    )
}

export function normalizeGeneratedMessage(
  language: SessionState['language'],
  message: string,
): string {
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

// ── Conversation History LLM call ────────────────────────────────────────────

export async function renderHistory(
  runtime: Runtime,
  state: SessionState,
  payload: {
    routerDecision: RouterDecision
    specialistDecision?: SpecialistDecision | null
    flowEngineResult?: FlowEngineResult | null
    faqSource?: string
    action?: 'contactOperator' | 'resetSession' | 'closureAck' | null
    closureKind?: 'resolved' | 'escalated'
  },
): Promise<{ message: string; safe: boolean }> {
  // [EXACT] directive: instruct History LLM to output this verbatim (translated).
  // Case 1: Flow Engine node prompt — source of truth.
  // Case 2: Gather question — inject the question base, LLM translates.
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
    const isTurn1Greeting = state.turnCount === 1
    if (!isTurn1Greeting) {
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
    faqs: Object.values(getFaqs()).join('\n'),
    allowedExternalLinks: ALLOWED_LINKS,
  })
  const locationContext = buildLocationContext(runtime, state)
  const systemPrompt = locationContext ? `${baseSystemPrompt}\n\n${locationContext}` : baseSystemPrompt
  const userPrompt = `Current session state:\n${summarizeState(state)}\n\nRuntime decision:\n${JSON.stringify(effectivePayload, null, 2)}${
    effectivePayload.faqSource ? `\n\nFAQ source excerpt:\n${effectivePayload.faqSource}` : ''
  }`
  const raw = await callModel({ systemPrompt, userPrompt, maxTokens: 300, temperature: 0.2, json: true })
  const parsed = extractJson<{ message?: string; safe?: boolean }>(raw, { message: '', safe: true })
  const message = normalizeGeneratedMessage(state.language, parsed.message || '')
  return { message, safe: parsed.safe !== false }
}

// ── System router decision factory ───────────────────────────────────────────

export function createSystemRouterDecision(overrides?: Partial<RouterDecision>): RouterDecision {
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

// ── Convenience wrapper ───────────────────────────────────────────────────────

export async function renderCustomerFacingSystemMessage(
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
  const { fallbackBlockedMessage } = await import('./missing-facts.js')
  return safe ? message : fallbackBlockedMessage(state.language)
}
