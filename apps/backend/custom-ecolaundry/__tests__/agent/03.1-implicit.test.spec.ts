// 03.1 — Implicit facts
//
// Quando il customer fornisce un fatto implicito nel primo messaggio,
// il bot NON deve chiederlo di nuovo:
//
//   "He pagado pero la lavadora no empieza"
//     → machineType=washer (implicito da "lavadora")
//     → paymentCompleted=true (implicito da "He pagado")
//
//   T1 user: "He pagado pero la lavadora no empieza"
//      bot:  ask location (welcome + ¿dónde?)
//   T2 user: "Pineda"
//      bot:  ask number (NON deve chiedere tipo né pagado, sono già noti)

import { type TestCase, expectMentionsAll, expectMentionsNone, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — fatti impliciti T1: "He pagado pero la lavadora no empieza" → state ha machineType=washer + paymentCompleted=true',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      expectStateHas(ctx.session, {
        machineType: 'washer',
        paymentCompleted: true,
      })
    },
  },
  {
    name: 'ES — T2 dopo location: bot chiede numero (NON tipo, NON pagado)',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['numero', 'lavadora'])
      expectMentionsNone(reply, ['secadora', 'pagado'])
    },
  },
]
