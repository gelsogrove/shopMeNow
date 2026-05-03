// 15 — Caso 10 tarjeta de fidelización + override Goya
//
// Da 01usecaases.md Caso 10:
//   USER: ¿cómo consigo la tarjeta de fidelización?
//   BOT:  se compra con 20€ en efectivo, sólo funciona en la tienda
//         donde se ha comprado.
//   USER: Estoy en Goya
//   BOT:  en Goya, central de botones, segundo botón de la fila derecha
//         (override location-aware da locations.json)

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 10 T1: bot spiega 20€ en efectivo + sólo en la tienda',
    run: async (ctx) => {
      const reply = await ctx.send('¿cómo consigo la tarjeta de fidelización?')
      expectMentionsAll(reply, ['20', 'efectivo'])
    },
  },
  {
    name: 'ES — Caso 10 T2 location Goya: override location-aware con "segundo botón fila derecha"',
    run: async (ctx) => {
      await ctx.send('¿cómo consigo la tarjeta de fidelización?')
      const reply = await ctx.send('Estoy en Goya')
      expectMentionsAll(reply, ['segundo', 'boton', 'derecha'])
    },
  },
]
