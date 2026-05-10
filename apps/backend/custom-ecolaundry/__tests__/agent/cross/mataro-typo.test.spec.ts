// CROSS — Mataró typo regression (F14, Andrea, 2026-05-10)
//
// Customer typed "Mtaró" (typo of "Mataró"). Bug: agent-extract.ts:219 was
// using resolveKnownLocation (exact) without fuzzy fallback → state.location
// stayed empty → guardUnknownLocation showed the canonical list which does
// NOT include "Mataró" (the pueblo is not a canonical because it's
// ambiguous). Customer was confused: "Mataró is not in the list?".
//
// Fix: agent-extract.ts now uses resolveKnownLocationFuzzy as fallback.
// "Mtaró" → "Mataró" (fuzzy distance 1) → guardMataroStreet fires next turn,
// asking the customer which street (Goya / Alemanya).

import { type TestCase, expectMentionsAll } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Mataró typo: "Mtaró" → fuzzy resolve → bot asks Goya/Alemanya street (no unknown-list)',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('La lavadora no funciona')
      // T2 — typo "Mtaró" must fuzzy-resolve to "Mataró", then trigger
      // guardMataroStreet which asks for the street (Goya/Alemanya).
      const reply = await ctx.send('Mtaró')
      const lower = reply.toLowerCase()
      // Bot must NOT say "no reconozco esa ubicación" — fuzzy must catch it.
      if (/no reconozco/.test(lower)) {
        throw new Error(`F14 regression: "Mtaró" must fuzzy-resolve to Mataró: ${reply}`)
      }
      // Bot must ask street disambiguation (Goya/Alemanya are the 2 streets in Mataró).
      expectMentionsAll(reply, ['Goya', 'Alemanya'])
    },
  },
]
