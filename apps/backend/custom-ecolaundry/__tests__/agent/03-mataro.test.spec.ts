// 03 — Mataró ha bisogno della via
//
// Regola: Mataró è l'unica location con più vie.
// - Customer dice "Mataró" → bot chiede la calle (in spagnolo).
// - Customer dice "Goya" (o qualunque altra location non-Mataró) → bot
//   NON chiede la calle, prosegue con la prossima domanda canonica.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    // Mataró ha 2 lavanderías → bot deve elencarle (Goya + Alemanya)
    // perché il customer scelga. Accettiamo "calle" letterale OPPURE
    // l'abbreviazione "C/" che la canonica usa effettivamente.
    name: 'ES — customer dice "Mataró" al turn 2 → bot disambigua tra Goya e Alemanya',
    run: async (ctx) => {
      await ctx.send('hola no me funciona la lavadora')
      const reply = await ctx.send('Mataró')
      expectMentionsAll(reply, ['mataro', 'goya', 'alemanya'])
    },
  },
  {
    name: 'ES — customer dice "Goya" al turn 2 → bot NON chiede la calle, va su numero',
    run: async (ctx) => {
      await ctx.send('hola no me funciona la lavadora')
      const reply = await ctx.send('Goya')
      expectMentionsNone(reply, ['calle'])
      expectMentionsAll(reply, ['numero'])
    },
  },
]
