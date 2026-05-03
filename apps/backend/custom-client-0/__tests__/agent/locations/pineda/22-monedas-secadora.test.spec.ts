// Caso 22 — Pineda: monedas en secadora no suman minutos
//
// Da 01usecaases.md Caso 22:
//   USER: He añadido tiempo a la secadora y no lo ha sumado
//   BOT:  ¿estás en Pineda?
//   USER: Sí
//   BOT:  vamos a revisarlo manualmente.
//
// Escalar: siempre.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 22 Pineda monedas no suman: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible'])
    },
  },
]
