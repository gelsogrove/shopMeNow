// 31 — Caso 30 código no documentado en pantalla
//
// Da 01usecaases.md Caso 30:
//   USER: En la pantalla sale ERR 52
//   BOT:  ¿en qué lavandería estás?
//   USER: L'Escala
//   BOT:  ese código no coincide con un caso documentado y necesitamos
//         revisarlo manualmente.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 30 código ERR 52 dopo location+tipo+numero: bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('En la pantalla sale ERR 52')
      await ctx.send("L'Escala")
      await ctx.send('lavadora')
      const reply = await ctx.send('5')
      // Doc Caso 30: "Ese código no coincide con un caso documentado y
      // necesitamos revisarlo manualmente."
      expectMentionsAll(reply, ['revis', 'manual'])
    },
  },
]
