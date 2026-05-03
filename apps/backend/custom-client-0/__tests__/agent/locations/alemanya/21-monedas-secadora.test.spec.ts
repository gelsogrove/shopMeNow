// Caso 21 — Alemanya: monedas en secadora no suman minutos
//
// Da usecases.md Caso 21: il cliente in Alemanya ha aggiunto monete alla
// secadora ma i minuti non sono stati sommati. Bot escala manualmente.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 21 T1: trigger "no suma minutos", bot saluta + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('He puesto más dinero en la secadora y no suma minutos')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 21 Alemanya T2: dopo location → bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('He puesto más dinero en la secadora y no suma minutos')
      const reply = await ctx.send('Alemanya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira'])
    },
  },
  {
    // Summary regression: il riepilogo deve menzionare Alemanya, secadora,
    // monedas/minutos. NO template buggati.
    name: 'ES — Caso 21 escalation summary: contiene Alemanya + secadora + monedas',
    run: async (ctx) => {
      await ctx.send('He puesto más dinero en la secadora y no suma minutos')
      await ctx.send('Alemanya')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Alemanya', 'secadora'])
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
