// 27 — Caso 27 cliente exige compensación concreta (lavadora gratis, etc.)
//
// Da usecases.md Caso 27:
//   USER: Quiero una secadora gratis por las molestias
//   BOT:  vamos a revisar tu caso para ayudarte con la solución más adecuada.
//   USER: Pero quiero que me lo confirmes ya
//   BOT:  no puedo confirmarlo directamente. Vamos a pasarlo a revisión.
//
// Regola: NON prometere compensaciones, escalar.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 27 cliente esige secadora gratis: bot escala con "revis" SENZA prometere',
    run: async (ctx) => {
      const reply = await ctx.send('Quiero una secadora gratis por las molestias')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['secadora gratis', 'lavadora gratis', 'te la doy', 'aprobada', 'gratuit'])
    },
  },
  {
    // T2: dopo che il cliente insiste, il bot deve escalare con richiesta nome.
    name: 'ES — Caso 27 T2: dopo "confirma ya", bot escala chiedendo nome',
    run: async (ctx) => {
      await ctx.send('Quiero una secadora gratis por las molestias')
      const reply = await ctx.send('Pero quiero que me lo confirmes ya')
      expectMentionsAll(reply, ['revis'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede nome: ${reply}`)
      }
    },
  },
  {
    // Summary regression.
    name: 'ES — Caso 27 escalation summary: contiene "compensación" + nome',
    run: async (ctx) => {
      await ctx.send('Quiero una secadora gratis por las molestias')
      await ctx.send('Pero quiero que me lo confirmes ya')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'compensaci'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
