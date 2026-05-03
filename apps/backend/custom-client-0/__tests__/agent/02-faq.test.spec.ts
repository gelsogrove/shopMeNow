// 02 — FAQ orari
//
// Customer chiede gli orari. Bot risponde in spagnolo con gli orari corretti:
// 8:00 a 22:00 in generale, L'Escala 7:00 a 23:00.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — "hola que orario teneis?" → reply contains 8:00, 22:00, escala, 7:00, 23:00',
    run: async (ctx) => {
      const reply = await ctx.send('hola que orario teneis?')
      expectMentionsAll(reply, ['8:00', '22:00', 'escala', '7:00', '23:00'])
    },
  },
]
