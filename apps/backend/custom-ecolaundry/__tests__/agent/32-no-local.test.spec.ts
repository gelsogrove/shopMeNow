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
  {
    // Variante: cliente dice "ni idea" invece di "no lo sé" → stesso
    // comportamento (insistere sulla location).
    name: 'ES — Caso 31 variante "ni idea": bot insiste sulla location',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      const reply = await ctx.send('Ni idea')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    // Variante: cliente dà location esplicita dopo l'insistenza → flow
    // procede al numero come da doc.
    name: 'ES — Caso 31 dopo location, flow procede al display normale',
    run: async (ctx) => {
      await ctx.send('La secadora no funciona')
      await ctx.send('No lo sé')
      await ctx.send('Estoy en Goya')
      const reply = await ctx.send('La 3')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
]
