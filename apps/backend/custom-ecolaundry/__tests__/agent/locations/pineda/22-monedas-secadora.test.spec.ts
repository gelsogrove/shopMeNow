// Caso 22 — Pineda: monedas en secadora no suman minutos
//
// Da usecases.md Caso 22: il cliente in Pineda ha aggiunto tempo alla
// secadora ma i minuti non sono stati sommati. Bot escala manualmente.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 22 T1: trigger "no lo ha sumado", bot saluta + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 22 Pineda T2: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible'])
    },
  },
  {
    name: 'ES — Caso 22 escalation summary: contiene Pineda + secadora + monedas/minutos',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      await ctx.send('Pineda')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Pineda', 'secadora'])
      const lower = reply.toLowerCase()
      if (!/monedas|minutos|tiempo/i.test(lower)) {
        throw new Error(`Summary non menziona monedas/minutos: ${reply}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
