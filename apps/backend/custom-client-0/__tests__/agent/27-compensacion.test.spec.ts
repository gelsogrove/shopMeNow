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
]
