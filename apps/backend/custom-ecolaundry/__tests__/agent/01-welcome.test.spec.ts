// 01 — Welcome (ES)
//
// Customer scrive in spagnolo. Il bot risponde con saluto + presentazione +
// domanda canonica della location, tutto in spagnolo.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — "hola, no me funciona la lavadora" → reply contains hola/soy/lavanderia/donde',
    run: async (ctx) => {
      const reply = await ctx.send('hola, no me funciona la lavadora')
      // "donde" removed: bot asks "¿En qué lavandería estás ahora mismo?" (no literal "donde")
      expectMentionsAll(reply, ['hola', 'soy', "asistente", 'lavanderia'])
    },
  },
]
