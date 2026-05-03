// 18 — Caso 14 ALM DOOR
//
// Da 01usecaases.md Caso 14: ALM DOOR.
// Bot prima dà istruzione "abre con cuidado, revisa prendas atrapadas, ciérrala".
// Loopback: "dime si el mensaje ha desaparecido".
// Se NO desaparecido → escala con "vamos a pasar tu caso a revisión".

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 14 ALM DOOR istruzione: bot dice "abre puerta, revisa prendas atrapadas"',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      const reply = await ctx.send('La 6')
      expectMentionsAll(reply, ['puerta', 'prend', 'cierr'])
    },
  },
  {
    name: 'ES — Caso 14 ALM DOOR escalation: cliente dice "no desaparece" → bot escala',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      await ctx.send('La 6')
      await ctx.send('Ya lo he hecho')
      const reply = await ctx.send('No, no desaparece')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
]
