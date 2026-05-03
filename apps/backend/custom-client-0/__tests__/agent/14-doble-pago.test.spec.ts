// 14 — Caso 6 doble cobro con servicio usado
//
// Da 01usecaases.md Caso 6:
//   USER: Me habéis cobrado dos veces con la tarjeta
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Goya
//   BOT:  ¿has podido lavar o secar la ropa?  ← NON pagado, ma "podido usar"
//   USER: Sí
//   BOT:  explícame paso a paso qué has hecho
//   USER: relato
//   BOT:  necesito los últimos 4 dígitos de la tarjeta
//   USER: 4821
//   BOT:  ahora necesito una captura del pago
//   USER: vale
//   BOT:  gracias, podremos revisarlo y enviarte el formulario de devolución;
//         la próxima vez, antes de volver a pagar, contacta con nosotros.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 6 dopo location: bot chiede "podido lavar/secar" (NON pagado)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['lavar', 'secar'])
    },
  },
  {
    name: 'ES — Caso 6 dopo "sí podido lavar": bot chiede paso a paso',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      const reply = await ctx.send('Sí, he lavado')
      expectMentionsAll(reply, ['paso', 'explica'])
    },
  },
  {
    name: 'ES — Caso 6 dopo relato: bot chiede 4 dígitos tarjeta',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      const reply = await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      expectMentionsAll(reply, ['4', 'dig', 'tarjeta'])
    },
  },
]
