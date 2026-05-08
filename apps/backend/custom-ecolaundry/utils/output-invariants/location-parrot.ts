// Output invariant — strip location parroting ("estás en Goya",
// "the laundry is at X", and equivalents in 6 languages).
//
// Bug surface: the LLM acknowledges the location by repeating it back
// to the customer ("ah, estás en Goya"). This sounds robotic and
// duplicates information the customer already gave. The bot should
// silently store the fact and proceed.

import { logger } from '../logger.js'

const LOCATION_PARROT_PHRASES: readonly string[] = [
  // Spanish
  'est[áa]s?\\s+en',
  'te\\s+encuentras\\s+en',
  'la\\s+lavander[ií]a\\s+(?:est[áa]\\s+)?(?:en|de)',
  // Italian
  'ti\\s+trovi\\s+(?:a|in|presso)',
  'la\\s+lavanderia\\s+(?:si\\s+trova\\s+|[èe]\\s+)(?:a|in|presso)',
  // English
  'you\\s+(?:are|\'re)\\s+(?:at|in)',
  'the\\s+laundr(?:omat|y)\\s+is\\s+(?:at|in)',
  // Catalan
  'ets\\s+a',
  'la\\s+bugaderia\\s+[èe]s\\s+a',
  // Portuguese
  'est[áa]s\\s+(?:em|na)',
  'a\\s+lavandaria\\s+(?:est[áa]\\s+)?(?:em|na)',
  // French
  'tu\\s+es\\s+(?:à|au|dans)',
  'la\\s+laverie\\s+(?:est|se\\s+trouve)\\s+(?:à|au|dans)',
] as const

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripLocationParroting(reply: string, location: string | null): string {
  // Only run when we actually have a known location — otherwise the regex
  // would trip on the LLM legitimately repeating the customer's words.
  if (!location || !location.trim()) return reply

  // Build a regex that matches any of the parrot phrases followed (with
  // optional filler words like "la lavandería de") by the location name.
  // Anchored at the START of a sentence so we don't kill mid-sentence
  // mentions like "...en Goya, ¿qué número?".
  const phrases = LOCATION_PARROT_PHRASES.join('|')
  const locEscaped = escapeRegex(location)
  const filler = '(?:\\s+la\\s+lavander[ií]a(?:\\s+(?:de|en))?)?'
  const pattern = new RegExp(
    `(?:^|(?<=[.!?]\\s))[A-ZÁÉÍÓÚÑa-záéíóúñ]?(?:${phrases})${filler}\\s+(?:la\\s+lavander[ií]a\\s+(?:de\\s+)?)?${locEscaped}\\b\\s*[.!?]?\\s*`,
    'gi',
  )
  let result = reply.replace(pattern, ' ')
  result = result.replace(/\s{2,}/g, ' ').replace(/^\s*[.,!?]\s*/, '').trim()
  if (result !== reply) {
    logger.warn('output-invariant: stripped location parroting from reply', {
      location,
      original: reply.slice(0, 200),
      result: result.slice(0, 200),
    })
  }
  return result || reply
}
