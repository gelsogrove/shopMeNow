// 01.1 — Only Spanish
//
// Tenant locked a una sola lingua (settings.enabledLanguages = ["es"]).
// Anche se il customer scrive in italiano, inglese, portoghese, francese,
// catalano, il bot DEVE rispondere in spagnolo.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'IT input → reply ES (welcome ES)',
    run: async (ctx) => {
      const reply = await ctx.send('Ciao, non mi funziona la lavatrice')
      expectMentionsAll(reply, ['hola', 'lavanderia', 'donde'])
    },
  },
  {
    name: 'EN input → reply ES',
    run: async (ctx) => {
      const reply = await ctx.send('Hi, my washer is not working')
      expectMentionsAll(reply, ['hola', 'lavanderia', 'donde'])
    },
  },
  {
    name: 'FR input → reply ES',
    run: async (ctx) => {
      const reply = await ctx.send('Bonjour, le lave-linge ne marche pas')
      expectMentionsAll(reply, ['hola', 'lavanderia', 'donde'])
    },
  },
]
