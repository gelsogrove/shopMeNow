// F112 — Post-processor L5 invariant: session-language enforcement.
//
// When the LLM agent loop or rephrase layer produces a reply whose detected
// language differs from the session-locked language, this post-processor
// invokes a dedicated translation LLM call to re-render the reply in the
// correct language. Architectural placement: AFTER all other polish (rephrase,
// strip-welcome, output-invariants) so we re-translate the FINAL string.
//
// Iron rule compliance:
//   #1 — Backstop in CODE, not a prompt directive. The agent.txt prompt
//        already says "reply in {{language}}"; this is the deterministic
//        guarantee for the cases where the LLM disregards it.
//   #4 — No state mutation. Pure transformation of the reply string.
//   #8 — Multi-language by design (6 supported languages, name map below).
//
// Cost: one extra LLM call PER DRIFTED REPLY only. Replies in the correct
// language are passed through verbatim (heuristic check first, no LLM call).

import { detectLanguageHeuristic } from './intent.js'
import { callModel } from './llm.js'
import { logger } from './logger.js'
import type { AgentRuntime, SupportedLanguage } from '../models/index.js'

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  es: 'Spanish',
  it: 'Italian',
  en: 'English',
  ca: 'Catalan',
  pt: 'Portuguese',
  fr: 'French',
}

export async function enforceSessionLanguage(
  ar: AgentRuntime,
  reply: string,
): Promise<string> {
  if (!reply || !reply.trim()) return reply
  const target = (ar.state.preferredLanguage as SupportedLanguage)
    ?? (ar.state.language as SupportedLanguage)
    ?? 'es'
  const detected = detectLanguageHeuristic(reply)
  // No drift detected → pass through. The heuristic returns null for very
  // short replies (e.g. "OK"), which we accept as language-neutral.
  if (!detected || detected === target) return reply

  const targetName = LANGUAGE_NAMES[target] ?? 'Spanish'
  try {
    const translated = await callModel({
      systemPrompt: `You are a strict translator. Re-render the user's message in ${targetName} (${target}). Preserve EVERY structural element: markdown bullets, bold, numbered lists, emojis, URLs, error codes (DOOR, PUSH PROG, AL001, SEL, ALM, etc.), display tokens, currency symbols, dates, phone numbers, machine identifiers (L1/L2/L3), location names. Translate only natural-language words. Do not add or remove information. Output ONLY the translated string, no quotes, no prefix, no commentary.`,
      userPrompt: reply,
      temperature: 0,
      maxTokens: 600,
      caller: 'rephrase',
    })
    const cleaned = translated.trim()
    if (!cleaned) return reply
    return cleaned
  } catch (err) {
    logger.warn('enforceSessionLanguage failed; returning original reply', {
      target,
      detected,
      error: err instanceof Error ? err.message : String(err),
    })
    return reply
  }
}
