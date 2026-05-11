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
      // Bot welcome: "Hola, soy el asistente virtual de la lavandería. ¿En qué pueblo se encuentra la lavandería que deseas usar?"
      expectMentionsAll(reply, ['hola', 'soy', "asistente", 'lavanderia'])
    },
  },
]
