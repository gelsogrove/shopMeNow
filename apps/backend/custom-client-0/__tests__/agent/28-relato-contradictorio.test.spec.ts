// 28 — Caso 28 relato contradictorio en doble cobro
//
// Da 01usecaases.md Caso 28:
//   USER: Me cobró dos veces, aunque creo que también pagué en efectivo,
//         pero no sé si llegó a arrancar
//   BOT:  ¿has podido finalmente usar el servicio?
//   USER: No lo sé bien
//   BOT:  vamos a revisar el caso manualmente.
//
// Regola: relato confuso → escalar senza discutir.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 28 relato contradittorio: dopo "no lo sé bien" → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('Me cobró dos veces, aunque creo que también pagué en efectivo, pero no sé si llegó a arrancar')
      const reply = await ctx.send('No lo sé bien')
      expectMentionsAll(reply, ['revis'])
    },
  },
]
