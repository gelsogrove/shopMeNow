// Caso 24 — Hortes: no se puede pagar con tarjeta
//
// Da usecases.md Caso 24: cliente in Hortes non riesce a pagare con
// tarjeta. Bot escala manualmente.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 24 T1: trigger "tarjeta no funciona", bot chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('La tarjeta no funciona para pagar')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 24 Hortes T2: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('La tarjeta no funciona para pagar')
      const reply = await ctx.send('Hortes')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible'])
    },
  },
  {
    name: 'ES — Caso 24 escalation summary: contiene Hortes + tarjeta',
    run: async (ctx) => {
      await ctx.send('La tarjeta no funciona para pagar')
      await ctx.send('Hortes')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Hortes', 'tarjeta'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
