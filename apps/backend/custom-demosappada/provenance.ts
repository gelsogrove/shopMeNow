// Provenance of a fact the MODEL extracted: the guest's own words, quoted
// back by the model and verified by code to exist in the message.
//
// The code reads no meaning (CLAUDE.md §14) — the model does the reading
// ("io e mio marito" → two adults, no children), the code only checks that
// the quote it points to was actually typed. An invented fact has no words
// to survive on; a real one always does. Same contract as `dateSaidAs` in
// agent.ts, lifted here so the party numbers can use it and it can be
// tested in isolation (iron rule 5).

/** Words of ≥4 letters, lowercased, punctuation stripped. */
const tokensOf = (t: string): string[] =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)

/**
 * True when at least one longer word of `quote` shares a 4-char prefix with a
 * word the guest actually typed. Prefix, not exact: the guest wrote "marit"
 * (typo), the model quoted the normalized "marito", and an exact match would
 * reject a real answer (the lesson of dateSaidAs, 2026-08-25).
 */
export function quoteAnchoredIn(quote: string | undefined, message: string): boolean {
  if (!quote?.trim()) return false
  const msgTokens = tokensOf(message)
  return tokensOf(quote).some((q) => msgTokens.some((m) => m.slice(0, 4) === q.slice(0, 4)))
}
