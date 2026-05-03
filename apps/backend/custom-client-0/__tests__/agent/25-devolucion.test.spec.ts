// 25 — Caso 26 cliente esige devolución inmediata
//
// Da 01usecaases.md Caso 26:
//   USER: Quiero que me devolváis el dinero ahora mismo
//   BOT:  vamos a revisarlo. Para tramitarlo, necesito 4 dígitos tarjeta,
//         captura del pago y un breve resumen.
//   USER: Quiero la devolución ya
//   BOT:  vamos a pasar el caso a revisión.
//
// Regola: NON prometere devolución, escalar.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 26 esige devolución: bot escala con "revis" e NON promette',
    run: async (ctx) => {
      await ctx.send('Quiero que me devolváis el dinero ahora mismo')
      const reply = await ctx.send('Quiero la devolución ya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['te devolveré', 'te devuelvo', 'devolución aprobada', 'reembolso confirmado'])
    },
  },
]
