// 28 — Caso 28 relato contradictorio en doble cobro
//
// Da usecases.md Caso 28:
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
  {
    // Summary regression: deve menzionare "relato contradictorio" o "confuso",
    // NON template machine-related buggati.
    name: 'ES — Caso 28 escalation summary: contiene "contradictorio" o "confuso"',
    run: async (ctx) => {
      await ctx.send('Me cobró dos veces, aunque creo que también pagué en efectivo, pero no sé si llegó a arrancar')
      await ctx.send('No lo sé bien')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea'])
      const lower = reply.toLowerCase()
      if (!/contradictorio|confuso|cobr/.test(lower)) {
        throw new Error(`Summary non menziona contradictorio/cobro: ${reply}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
