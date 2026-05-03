// 32 — Caso 31 cliente non sa indicare il local
//
// Da usecases.md Caso 31:
//   USER: La secadora no funciona
//   BOT:  ¿en qué lavandería estás?
//   USER: No lo sé
//   BOT:  para poder ayudarte, necesito saber primero en qué lavandería
//         estás exactamente.
//   USER: Vale, estoy en Goya
//   BOT:  perfecto. ¿Qué número de secadora es?
//
// Regola: bot non diagnostica fino a quando local non è chiaro.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 31 cliente "No lo sé" dopo richiesta location: bot insiste',
    run: async (ctx) => {
      await ctx.send('La secadora no funciona')
      const reply = await ctx.send('No lo sé')
      // Bot must insist on location: contains "lavanderia" + "donde" / "necesito"
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 31 dopo "Vale estoy en Goya": bot procede a numero',
    run: async (ctx) => {
      await ctx.send('La secadora no funciona')
      await ctx.send('No lo sé')
      const reply = await ctx.send('Vale, estoy en Goya')
      expectMentionsAll(reply, ['numero'])
    },
  },
]
