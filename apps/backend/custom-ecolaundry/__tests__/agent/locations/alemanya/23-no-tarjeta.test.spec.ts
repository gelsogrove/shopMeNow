// Caso 23 — Alemanya: no se puede pagar con tarjeta
//
// Da usecases.md Caso 23: cliente in Alemanya non riesce a pagare con
// tarjeta. Bot escala manualmente.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 23 T1: trigger "no puedo pagar con tarjeta", bot chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('No puedo pagar con tarjeta')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 23 Alemanya T2: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con tarjeta')
      const reply = await ctx.send('Alemanya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible'])
    },
  },
  {
    name: 'ES — Caso 23 escalation summary: contiene Alemanya + tarjeta',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con tarjeta')
      await ctx.send('Alemanya')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Alemanya', 'tarjeta'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
