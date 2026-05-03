// 19 — Caso 15 código 001
//
// Da docs/usecases.md Caso 15:
//   USER: En la pantalla sale 001.
//   BOT:  Gracias. ¿En qué lavandería estás?
//   USER: Pineda.
//   BOT:  De acuerdo. Ese mensaje puede aparecer cuando el programa se ha
//         seleccionado antes del pago y el estado no se ha reiniciado
//         correctamente.
//   USER: ¿Qué hago?
//   BOT:  Vamos a revisarlo manualmente para ayudarte de la mejor manera
//         posible.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 15 001 T1: bot chiede location (NON chiede tipo/numero/display)',
    run: async (ctx) => {
      const reply = await ctx.send('En la pantalla sale 001.')
      expectMentionsAll(reply, ['lavanderia'])
      expectMentionsNone(reply, ['lavadora o secadora', 'numero de la'])
    },
  },
  {
    name: 'ES — Caso 15 001 T2 location: bot dà spiegazione educativa (NON chiede tipo)',
    run: async (ctx) => {
      await ctx.send('En la pantalla sale 001.')
      const reply = await ctx.send('Pineda')
      // Doc Caso 15: "Ese mensaje puede aparecer cuando el programa se ha
      // seleccionado antes del pago y el estado no se ha reiniciado correctamente."
      expectMentionsAll(reply, ['programa', 'pago', 'seleccionado'])
      expectMentionsNone(reply, ['lavadora o secadora', 'numero'])
    },
  },
  {
    name: 'ES — Caso 15 001 T3: cliente chiede "qué hago" → bot escala manualmente',
    run: async (ctx) => {
      await ctx.send('En la pantalla sale 001.')
      await ctx.send('Pineda')
      const reply = await ctx.send('¿Qué hago?')
      expectMentionsAll(reply, ['revis', 'manual'])
    },
  },
]
