// 31 — Caso 30 código no documentado en pantalla
//
// Da usecases.md Caso 30:
//   USER: En la pantalla sale ERR 52
//   BOT:  ¿en qué lavandería estás?
//   USER: L'Escala
//   BOT:  ese código no coincide con un caso documentado y necesitamos
//         revisarlo manualmente.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 30 código ERR 52 dopo location+tipo+numero: bot escala con "revis"',
    run: async (ctx) => {
      await ctx.send('En la pantalla sale ERR 52')
      await ctx.send("L'Escala")
      await ctx.send('lavadora')
      const reply = await ctx.send('5')
      expectMentionsAll(reply, ['revis', 'manual'])
    },
  },
  {
    name: 'ES — Caso 30 T1: trigger ERR 52, bot saluta + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('En la pantalla sale ERR 52')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    // Variante: ERR 47 (codice diverso) — stesso comportamento.
    name: 'ES — Caso 30 variante ERR 47: stesso comportamento di escalation',
    run: async (ctx) => {
      await ctx.send('En la pantalla aparece ERR 47')
      await ctx.send("L'Escala")
      await ctx.send('lavadora')
      const reply = await ctx.send('5')
      expectMentionsAll(reply, ['revis'])
    },
  },
  {
    // Summary regression: deve menzionare il codice ERR e descrivere come
    // codice di errore. Niente template buggati.
    name: 'ES — Caso 30 escalation summary: contiene ERR 52 + location + numero',
    run: async (ctx) => {
      await ctx.send('En la pantalla sale ERR 52')
      await ctx.send("L'Escala")
      await ctx.send('lavadora')
      await ctx.send('5')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'ERR', '52'])
      const lower = reply.toLowerCase()
      if (!/escala/.test(lower)) {
        throw new Error(`Summary non contiene location: ${reply}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
