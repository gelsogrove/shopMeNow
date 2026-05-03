// Caso 24 — Hortes: no se puede pagar con tarjeta
//
// Da 01usecaases.md Caso 24:
//   USER: La tarjeta no funciona para pagar
//   BOT:  ¿estás en Hortes?
//   USER: Sí
//   BOT:  vamos a revisar la incidencia manualmente.
//
// Escalar: siempre.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 24 Hortes tarjeta no funciona: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('La tarjeta no funciona para pagar')
      const reply = await ctx.send('Hortes')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible'])
    },
  },
]
