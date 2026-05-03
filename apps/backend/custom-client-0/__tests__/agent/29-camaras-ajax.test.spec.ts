// 29 — Caso 29 cliente menciona cámaras / AJAX / soporte técnico
//
// Da 01usecaases.md Caso 29:
//   USER: Mirad las cámaras porque yo he pagado
//   BOT:  vamos a revisar tu caso manualmente.
//
// Regola: NON prometere comprobación diretta, escalar.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 29 cliente menciona cámaras: bot escala con "revis" SENZA prometere',
    run: async (ctx) => {
      const reply = await ctx.send('Mirad las cámaras porque yo he pagado')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['miraré las cámaras', 'compruebo las cámaras', 'voy a mirar'])
    },
  },
]
