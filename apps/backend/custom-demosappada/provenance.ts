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

/**
 * A negative answer to a question that asked about the party: "no", "no
 * nessuna", "niente", "nessuno". The same closed yes/no class CLAUDE.md §14
 * allows (it mirrors the composition capture in agent.ts) — a rule-out, not
 * a count, so it needs no number to be believed.
 */
export function rulesOutParty(verbatim: string): boolean {
  return /^(no|nein|non|nope|niente|nessun[oa]?)\b/i.test(verbatim.trim())
}

/**
 * True when the model sent party numbers and ALL of them are 0: the guest
 * ruled children/seniors out rather than counting anyone. Such zeros answer
 * OUR question on the turns that asked about the party, and carry no digit
 * by nature — so they are accepted there without the number/quote anchor a
 * positive count still needs (the invented "adults 1" of 2026-08-27 stays
 * refused: it was not a zero).
 */
export function isRuleOutOnly(args: { adults?: unknown; children?: unknown; seniors?: unknown }): boolean {
  const counts = [args.adults, args.children, args.seniors].filter((v) => typeof v === 'number') as number[]
  return counts.length > 0 && counts.every((v) => v === 0)
}
