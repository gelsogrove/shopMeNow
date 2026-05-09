// 14.1 — "Pedir datos de pago"
//
// Da reglas.md "Respuestas modelo reutilizables → Pedir datos de pago":
//   "Para revisarlo bien, necesito los últimos 4 dígitos de la tarjeta y
//    una captura del pago."
//
// Si manifesta dentro Caso 6 (doble cobro): dopo location → ¿podido? →
// tipo → numero → relato, il bot deve chiedere 4 dígitos e captura.
//
// Gather order aggiornato (Andrea 2026-05-09 — Caso 6 reorder):
//   location → ¿podido? → (Sí) → tipo → numero → relato → 4 dígitos → captura.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Doble cobro completo: dopo relato bot chiede 4 dígitos + captura',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      await ctx.send('5')
      const reply = await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      // Bot deve menzionare i 4 dígitos OPPURE la captura
      expectMentionsAll(reply, ['4', 'tarjeta'])
    },
  },
]
