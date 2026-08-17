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
export function customerVerbatim(
  history: ReadonlyArray<{ role: string; content: string | null }>,
  maxMessages = 5,
  maxChars = 300,
): string[] {
  return history
    .filter((m) => m.role === 'user' && !!m.content?.trim())
    .slice(-maxMessages)
    .map((m) => {
      const text = (m.content ?? '').trim().replace(/\s+/g, ' ')
      return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
    })
}
