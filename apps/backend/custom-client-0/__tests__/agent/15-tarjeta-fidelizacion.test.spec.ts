// 15 — Caso 10 tarjeta de fidelización + override Goya
//
// Da usecases.md Caso 10:
//   USER: ¿cómo consigo la tarjeta de fidelización?
//   BOT:  se compra con 20€ en efectivo, sólo funciona en la tienda
//         donde se ha comprado.
//   USER: Estoy en Goya
//   BOT:  en Goya, central de botones, segundo botón de la fila derecha
//         (override location-aware da locations.json)

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 10 T1: bot spiega 20€ en efectivo + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('¿cómo consigo la tarjeta de fidelización?')
      // Doc Caso 10: T1 frase canonica con 20€/efectivo + chiede location
      expectMentionsAll(reply, ['20', 'efectivo', 'lavanderia'])
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
  {
    // BUG REGRESSION: dopo "Entendido" (acknowledgment del cliente), il bot
    // NON deve passare al gather machine ("¿lavadora o secadora?"). Il flow
    // FAQ è chiuso → bot saluta educatamente.
    name: 'ES — Caso 10 T3 closure: dopo "Entendido" il bot chiude (non gather macchina)',
    run: async (ctx) => {
      await ctx.send('¿cómo consigo la tarjeta de fidelización?')
      await ctx.send('Estoy en Goya')
      const reply = await ctx.send('Entendido')
      const lower = reply.toLowerCase()
      // Bot deve chiudere educatamente, non chiedere lavadora/secadora.
      if (/lavadora.*secadora|secadora.*lavadora|qu[eé]\s+aparece\s+en\s+la\s+pantalla|n[uú]mero\s+de\s+(?:la\s+)?(?:lavadora|secadora)/i.test(lower)) {
        throw new Error(`Caso 10 T3 deve chiudere, non gather machine: ${reply}`)
      }
    },
  },
]
