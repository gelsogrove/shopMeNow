// Welcome message helpers.
//   - renderWelcomeForTurn: builds the configured welcome string in the
//     customer's language.
//   - stripWelcomeParagraphs: defensive filter on turn-2+ replies, removes
//     stray greetings produced by the LLM ("¡Hola! Soy Eco...") so the bot
//     doesn't re-introduce itself.
//   - shouldShowWelcome: decides whether to prepend the welcome to a
//     guard-produced reply on turn 1, based on the guard's `reason`.

import { lang as resolveTenantLang } from './guards/helpers.js'
import type { AgentRuntime } from '../models/index.js'

// Guard reasons whose canned reply already addresses a specific incident.
// On those, prepending a generic welcome ("Hola, soy Eco...") feels robotic
// — the bot should jump straight to the operational answer instead.
// For purely conversational openers (gather questions, generic re-asks)
// we still prepend the welcome.
const GUARD_REASONS_NO_WELCOME = new Set<string>([
  'loyalty-card-buy-base',
  'loyalty-card-buy-override',
  'loyalty-card-buy-override-direct',
  'loyalty-card-recharge',
  'opening-hours',
  'pricing-deflect',
  'angry-customer-empathic',
  'angry-customer-escalate',
  'refund-ask-data',
  'refund-escalate',
  'compensation-review',
  'contradictory-narrative',
  'escalate-non-troubleshooting',
  'location-gated-mismatch',
  'photo-ask',
  'no-photo-escalate',
  'numeric-code-ask-letters',
  'numeric-code-no-letters',
  'numeric-code-yes-letters',
  'force-payment',
  'no-change-ask',
  'no-change-instruction',
  'no-change-resolved',
  'no-change-escalate',
  'no-change-escalate-cambio-yes',
  // Display-flow guard reasons (data-driven via json/display-flows.json).
  // Phase A reasons match the flow id; Phase B append `-resolved` or
  // `-escalate`. Keep this list in sync with json/display-flows.json.
  'al001-sequence-error',
  'al001-sequence-error-resolved',
  'al001-sequence-error-escalate',
  'alm-door-blocked',
  'alm-door-blocked-escalate',
  'code-001-explained',
  'code-001-explained-escalate',
  'faq-closure',
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
  // Use the tenant-resolved language, NOT raw state.language. This guarantees
  // the welcome respects settings.enabledLanguages even if state.language was
  // seeded by an external caller with a non-allowed value.
  const lang = resolveTenantLang(ar) as keyof NonNullable<typeof settings.welcomeMessage>
  const tpl = settings.welcomeMessage[lang] || settings.welcomeMessage[settings.defaultLanguage]
  if (!tpl) return null
  return tpl.replaceAll('{{chatbotName}}', settings.chatbotName || 'Eco')
}
