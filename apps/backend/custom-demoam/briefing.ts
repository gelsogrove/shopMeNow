import { BRIEFING_MAX_EXCHANGES, BRIEFING_MAX_PROMPT_CHARS, BRIEFING_MAX_CUSTOMER_CHARS } from './bounds.js'

/**
 * The customer's own words, verbatim, for the operator briefing — picked by
 * CODE from the conversation history, never narrated by the model.
 *
 * Andrea 2026-08-17, seen live: the briefing's Summary was the model's free
 * text (escalate_to_operator's `summary` argument), and for a customer asking
 * how to change the BLADES it contained a fully invented nine-step guide to
 * replacing the WHEELS — wrong procedure, wrong part, straight into the
 * operator's hands. Verbatim quotes cannot invent, by construction (same
 * move as the greeting: where a source exists, the model does not narrate).
 *
 * Own module so the unit tests can lock it without importing agent.ts, whose
 * import.meta usage does not survive the jest CJS transform.
 */
export interface VerbatimExchange {
  /** The bot line the customer was answering — verbatim from history (itself code-composed upstream). */
  prompt?: string
  customer: string
}

/**
 * Bare answers are noise: a briefing reading «yes» «yes» «yes» tells the
 * operator nothing (Andrea 2026-08-17, "riassunto non è chiaro"). Each
 * customer line is therefore paired with the bot line it was answering —
 * still 100% verbatim, still zero generation: pairing is code, and the bot
 * lines are themselves code-composed by the time they reach history.
 * Internal hop entries (assistant lines carrying tool_calls, tool results)
 * are never customer-visible and are skipped.
 */
export function conversationVerbatim(
  history: ReadonlyArray<{ role: string; content: string | null; tool_calls?: unknown }>,
  maxExchanges = BRIEFING_MAX_EXCHANGES,
  maxPromptChars = BRIEFING_MAX_PROMPT_CHARS,
  maxCustomerChars = BRIEFING_MAX_CUSTOMER_CHARS,
): VerbatimExchange[] {
  const collapse = (text: string): string => text.trim().replace(/\s+/g, ' ')
  const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}…` : text)

  const out: VerbatimExchange[] = []
  let lastBotLine: string | null = null
  for (const m of history) {
    if (m.role === 'assistant' && !m.tool_calls && m.content?.trim()) {
      lastBotLine = m.content
    } else if (m.role === 'user' && m.content?.trim()) {
      out.push({
        ...(lastBotLine ? { prompt: clip(collapse(lastBotLine), maxPromptChars) } : {}),
        customer: clip(collapse(m.content), maxCustomerChars),
      })
      lastBotLine = null
    }
  }
  return out.slice(-maxExchanges)
}
