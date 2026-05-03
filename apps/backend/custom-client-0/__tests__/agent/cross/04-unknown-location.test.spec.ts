// Cross-test: cliente nomina una città/zona che NON è una nostra lavandería
// (es. "Girona" — è una provincia, le nostre lavanderías sono 6 ben definite).
// Bot deve insistere elencando le lavanderías disponibili invece di accettare
// silenziosamente.
//
// Da reglas.md: solo 6 lavanderie reali (Goya, Pineda, L'Escala, Alemanya,
// Hortes, Mataró).

import { type TestCase, expectMentionsAll, expectStateHas } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — unknown location "Girona": bot insiste elencando le lavanderías reali',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      const reply = await ctx.send('Girona')
      // Bot riconosce che Girona non è una lavandería e elenca le 6 reali
      expectMentionsAll(reply, ['goya', 'pineda', 'mataro'])
      expectStateHas(ctx.session, { location: '' })
    },
  },
  {
    name: 'ES — dopo unknown location, cliente dà location valida: bot procede',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Girona')
      const reply = await ctx.send('Goya')
      // T1 already extracted machineType=washer from "lavadora no funciona", so
      // after location is set the bot moves directly to asking the machine number.
      expectMentionsAll(reply, ['numero'])
      expectStateHas(ctx.session, { location: 'Goya' })
    },
  },
]
