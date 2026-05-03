// 03 — Mataró ha bisogno della via
//
// Regola: Mataró è l'unica location con più vie.
// - Customer dice "Mataró" → bot chiede la calle (in spagnolo).
// - Customer dice "Girona" (o qualunque altra location non-Mataró) → bot
//   NON chiede la calle, prosegue con la prossima domanda canonica.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — customer dice "Mataró" al turn 2 → bot chiede la calle (parole: calle, mataro)',
    run: async (ctx) => {
      await ctx.send('hola no me funciona la lavadora')
      const reply = await ctx.send('Mataró')
      expectMentionsAll(reply, ['calle', 'mataro'])
    },
  },
  {
    name: 'ES — customer dice "Girona" al turn 2 → bot NON chiede la calle, va su numero',
    run: async (ctx) => {
      await ctx.send('hola no me funciona la lavadora')
      const reply = await ctx.send('Girona')
      expectMentionsNone(reply, ['calle'])
      expectMentionsAll(reply, ['numero'])
    },
  },
]
