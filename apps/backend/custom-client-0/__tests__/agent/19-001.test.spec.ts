// 19 — Caso 15 código 001
//
// Da 01usecaases.md Caso 15: 001 → escala siempre dopo location.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 15 001 dopo location+tipo+numero: bot escala con "revisar"',
    run: async (ctx) => {
      await ctx.send('En la pantalla sale 001')
      await ctx.send('Pineda')
      await ctx.send('lavadora')
      const reply = await ctx.send('3')
      // Doc Caso 15: "Vamos a revisarlo manualmente para ayudarte de la mejor
      // manera posible." — escala sin pedir nombre.
      expectMentionsAll(reply, ['revis', 'manual'])
    },
  },
]
