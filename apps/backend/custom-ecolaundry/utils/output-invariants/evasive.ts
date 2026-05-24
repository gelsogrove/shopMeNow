// Output invariant — strip evasive responses ("no tengo la información",
// "I don't have that info", and equivalents in 6 languages).
//
// Bug surface: the LLM falls back to a no-knowledge phrase instead of
// using FAQ overrides or escalating. The customer ends up with a dead
// end. Strip the evasive sentence; if the reply becomes empty, fall
// back to the original to avoid sending an empty message.

import { logger } from '../logger.js'

const EVASIVE_PATTERNS: RegExp[] = [
  // Spanish
  /no\s+tengo\s+(?:esa\s+)?(?:la\s+)?informaci[oó]n[^.!?\n]*[.!?]?/gi,
  /no\s+lo\s+s[eé](?!\s+bien)[^.!?\n]*[.!?]?/gi,
  /no\s+puedo\s+(?:darte|proporcionarte|ofrecerte)\s+esa\s+informaci[oó]n[^.!?\n]*[.!?]?/gi,
  // Italian
  /non\s+ho\s+(?:quest[ao]|l[ae])\s+informazion[ei][^.!?\n]*[.!?]?/gi,
  /non\s+lo\s+so(?!\s+bene)[^.!?\n]*[.!?]?/gi,
  // English
  /i\s+don'?t\s+have\s+(?:that|this)\s+inform(?:ation)?[^.!?\n]*[.!?]?/gi,
  /i\s+don'?t\s+know(?!\s+(?:if|whether))[^.!?\n]*[.!?]?/gi,
  // Catalan
  /no\s+tinc\s+(?:aquesta\s+)?informaci[oó][^.!?\n]*[.!?]?/gi,
  // Portuguese
  /n[ãa]o\s+tenho\s+(?:essa\s+)?(?:a\s+)?informa[çc][ãa]o[^.!?\n]*[.!?]?/gi,
  /n[ãa]o\s+sei(?!\s+bem)[^.!?\n]*[.!?]?/gi,
  // French
  /je\s+n'?ai\s+pas\s+(?:cette|l[ea])\s+informations?[^.!?\n]*[.!?]?/gi,
]

export function stripEvasivePhrases(reply: string): string {
  let result = reply
  let strippedEvasive = false
  for (const pattern of EVASIVE_PATTERNS) {
    const next = result.replace(pattern, '')
    if (next !== result) strippedEvasive = true
    result = next
  }
  // Collapse multiple SPACES / TABS (but not newlines) into one space.
  // Paragraph breaks (`\n\n`) are intentional — they let the bot present
  // a closing question on its own line and keep replies readable. The
  // older `\s{2,}` form swallowed `\n\n` too, which silently destroyed
  // every multi-paragraph reply (e.g. PUSH PROG instruction → loopback).
  result = result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*[.,!?]\s*/, '')
    .trim()
  // Only warn when a real evasive pattern matched. Whitespace
  // normalisation alone must not trigger the alert — past false
  // positives misled debugging during live CLI tests (2026-05-23).
  if (strippedEvasive) {
    logger.warn('output-invariant: stripped evasive phrase from reply', {
      original: reply.slice(0, 200),
      result: result.slice(0, 200),
    })
  }
  return result || reply
}
