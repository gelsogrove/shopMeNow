// Welcome message helpers.
//   - renderWelcomeForTurn: builds the configured welcome string in the
//     customer's language.
//   - stripWelcomeParagraphs: defensive filter on turn-2+ replies, removes
//     stray greetings produced by the LLM ("¡Hola! Soy Eco...") so the bot
//     doesn't re-introduce itself.
//   - shouldShowWelcome: decides whether to prepend the welcome to a
//     guard-produced reply on turn 1, based on the guard's `reason`.

import type { AgentRuntime } from '../models/index.js'

// Guard reasons whose canned reply already addresses a specific incident.
// On those, prepending a generic welcome ("Hola, soy Eco...") feels robotic
// — the bot should jump straight to the operational answer instead.
// For purely conversational openers (gather questions, generic re-asks)
// we still prepend the welcome.
const GUARD_REASONS_NO_WELCOME = new Set<string>([
  'caso9-factura',
  'caso10-tarjeta-base',
  'caso10-tarjeta-override',
  'caso10-tarjeta-override-direct',
  'caso11-recarga',
  'caso12-horarios',
  'caso12-precio',
  'caso25-empathic',
  'caso26-ask-refund-data',
  'caso27-review',
  'caso28-contradictory',
  'escalate-non-troubleshooting',
  'caso21-24-location-mismatch',
  'caso17-direct-escalate',
  'numeric-code-ask-letters',
  'numeric-code-no-letters',
  'numeric-code-yes-letters',
  'caso8-ask-code',
  'caso8-await-location',
  'caso8-ask-amount',
  'caso8-instruction',
  'caso8-resolved',
  'caso8-escalate',
  'caso8-confirm-location',
  'caso8-escalate-location',
  'force-payment',
  'caso4-ask-cambio',
  'caso4-instruction',
  'caso4-resolved',
  'caso4-escalate',
  'caso4-escalate-cambio-yes',
  // Display-flow guard reasons (data-driven via json/display-flows.json).
  // Phase A reasons match the flow id; Phase B append `-resolved` or
  // `-escalate`. Keep this list in sync with json/display-flows.json.
  'caso5-al001',
  'caso5-al001-resolved',
  'caso5-al001-escalate',
  'caso14-alm-door',
  'caso14-alm-door-escalate',
  'caso15-001-explained',
  'caso15-001-explained-escalate',
  'faq-closure',
  'caso25-escalate',
])

export function shouldShowWelcome(reason: string | undefined): boolean {
  if (!reason) return true
  return !GUARD_REASONS_NO_WELCOME.has(reason)
}

export function stripWelcomeParagraphs(reply: string): string {
  const paragraphs = reply.split(/\n{2,}/)
  const cleaned = paragraphs.filter((p) => {
    const n = p.toLowerCase()
    const isGreeting = /^(¡?hola[!,.\s]|ciao[!,.\s]|hi[!,.\s]|hello[!,.\s]|olá[!,.\s]|ola[!,.\s]|bonjour[!,.\s])/i.test(p.trim())
    const isIntro = /\b(soy eco|sono eco|i'?m eco|i am eco|sou eco|je suis eco)\b/i.test(n)
    const isAssistantPhrase = /\b(asistente virtual|assistente virtuale|virtual assistant|assistent virtual|assistente virtual|assistant virtuel)\s+de?\s+ecolaundry\b/i.test(n)
    return !(isGreeting || isIntro || isAssistantPhrase)
  })
  return (cleaned.length > 0 ? cleaned.join('\n\n') : reply).trim()
}

export function renderWelcomeForTurn(ar: AgentRuntime): string | null {
  const settings = ar.runtime.settings
  if (!settings.welcomeMessage) return null
  const lang = (ar.state.language || settings.defaultLanguage) as keyof NonNullable<typeof settings.welcomeMessage>
  const tpl = settings.welcomeMessage[lang] || settings.welcomeMessage[settings.defaultLanguage]
  if (!tpl) return null
  return tpl.replaceAll('{{chatbotName}}', settings.chatbotName || 'Eco')
}
