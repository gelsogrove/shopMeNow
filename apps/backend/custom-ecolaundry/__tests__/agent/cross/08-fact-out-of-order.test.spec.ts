// 08 — Fact out-of-order regression
//
// REGRESSION: a real session reported by Andrea showed the bot drifting
// when the customer reported the display BEFORE the location. The bot
// asked machine type, started the AL001 flow without location, then
// improvised a DOOR-style instruction, and finally interpreted "no
// funciona" as a location attempt. Root cause: the gather-guard
// pipeline had a hole — every guard skipped because their preconditions
// cancelled each other out (see `utils/guards/location-resolution.ts:guardForceLocation`
// and CLAUDE.md → "guard preconditions must not cancel").
//
// These tests pin the post-fix behaviour: regardless of which fact the
// customer volunteers first, the bot must ALWAYS ask for the location
// before any flow can take over.
//
// They are intentionally LIGHT-WEIGHT (3-turn dialogues) so they run
// fast in the agent suite. Each test asserts: T2 reply asks for the
// location, even though the customer has volunteered display / type /
// number on T1.

import { type TestCase, expectAsksForLocation } from './../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'PATTERN A — display first ("me sale AL001") → bot asks LOCATION on T2',
    run: async (ctx) => {
      // Welcome on T1 already asks location, but customer ignores it.
      await ctx.send('hola, qué tal')
      // Customer volunteers a display token. The bot MUST keep asking
      // location, not jump to "lavadora o secadora".
      const reply = await ctx.send('me sale AL001')
      expectAsksForLocation(reply)
    },
  },
  {
    name: 'PATTERN B — type first ("la lavadora no funciona") → bot asks LOCATION',
    run: async (ctx) => {
      await ctx.send('hola')
      const reply = await ctx.send('una lavadora')
      expectAsksForLocation(reply)
    },
  },
  {
    name: 'PATTERN D — all facts in one go, no location → bot asks LOCATION',
    run: async (ctx) => {
      await ctx.send('hola')
      // Customer dumps type+number+display in one message. autoExtractFacts
      // populates the three; location stays empty. forceLocation must fire.
      const reply = await ctx.send('lavadora 5 PUSH PROG')
      expectAsksForLocation(reply)
    },
  },
  {
    name: 'CONTROL — location given → bot proceeds (no re-ask of location)',
    run: async (ctx) => {
      const r1 = await ctx.send('la lavadora no funciona')
      expectAsksForLocation(r1)
      // Customer gives a known location → bot moves to next step.
      const r2 = await ctx.send('Goya')
      const lower = r2.toLowerCase()
      const asksAgain = /lavander[ií]a|d[oó]nde\s+est[aá]s/.test(lower)
      if (asksAgain) {
        throw new Error(`bot must NOT re-ask location after Goya, got: ${r2}`)
      }
    },
  },
]
