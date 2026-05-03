// Caso 23 — Alemanya: no se puede pagar con tarjeta
//
// Da 01usecaases.md Caso 23:
//   USER: No puedo pagar con tarjeta
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Alemanya
//   BOT:  vamos a revisarlo manualmente porque puede requerir soporte técnico.
//
// Escalar: siempre.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 23 Alemanya tarjeta no funciona: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con tarjeta')
      const reply = await ctx.send('Alemanya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible'])
    },
  },
]
