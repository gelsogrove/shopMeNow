// Caso 21 — Alemanya: monedas en secadora no suman minutos
//
// Da 01usecaases.md Caso 21:
//   USER: He puesto más dinero en la secadora y no suma minutos
//   BOT:  ¿estás en la lavandería Alemanya?
//   USER: Sí
//   BOT:  esa incidencia necesita revisión.
//
// Escalar: siempre.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 21 Alemanya monedas no suman: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('He puesto más dinero en la secadora y no suma minutos')
      const reply = await ctx.send('Alemanya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira'])
    },
  },
]
