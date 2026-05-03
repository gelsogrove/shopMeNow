// 33 — Caso 32 cliente mezcla incidencia de máquina y pago
//
// Da 01usecaases.md Caso 32:
//   USER: He pagado, no arrancaba, volví a pagar y ahora no sé si el
//         problema es la máquina o el cobro
//   BOT:  vamos a ordenarlo paso a paso. ¿en qué lavandería estás?
//   USER: Pineda
//   BOT:  primero necesito saber si has podido usar finalmente la máquina
//   USER: No
//   BOT:  vamos a revisar primero qué aparece exactamente en la pantalla.
//
// Regola: bot ordina la conversación paso a paso, non si fa confondere.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 32 cliente mezcla: bot dice "paso a paso" e chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      expectMentionsAll(reply, ['paso', 'lavanderia'])
    },
  },
]
