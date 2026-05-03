// 24 — Caso 25 cliente enfadado
//
// Da 01usecaases.md Caso 25:
//   USER: ¡Esto siempre falla! ¡Quiero una solución ya!
//   BOT:  entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo
//         antes posible. ¿En qué lavandería estás?

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 25 cliente enfadado T1: bot risponde con calma (entiendo) + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('¡Esto siempre falla! ¡Quiero una solución ya!')
      // Doc Caso 25: "Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo
      // lo antes posible. ¿En qué lavandería estás?"
      expectMentionsAll(reply, ['entiend', 'lavanderia'])
      expectMentionsNone(reply, ['no es posible', 'tienes que esperar', 'estafa'])
    },
  },
]
