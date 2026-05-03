// Welcome message helpers.
//   - renderWelcomeForTurn: builds the configured welcome string in the
//     customer's language.
//   - stripWelcomeParagraphs: defensive filter on turn-2+ replies, removes
//     stray greetings produced by the LLM ("¡Hola! Soy Eco...") so the bot
//     doesn't re-introduce itself.

import type { AgentRuntime } from './agent-types.js'

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
