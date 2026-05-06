// 11 — Caso 11 cliente recarga tarjeta de fidelización
//
// Da docs/usecases.md Caso 11:
//   USER: ¿Cómo recargo la tarjeta?
//   BOT:  Introduce la tarjeta y sigue las instrucciones de la central.
//   USER: Vale.
//   BOT:  Perfecto. Si al hacerlo aparece algún mensaje extraño, dímelo y
//         lo revisamos.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 11 recargar tarjeta: bot dà istruzione SENZA chiedere display/numero/macchina',
    run: async (ctx) => {
      const reply = await ctx.send('¿Cómo recargo la tarjeta?')
      // Doc Caso 11: "Introduce la tarjeta y sigue las instrucciones de la central."
      expectMentionsAll(reply, ['introduce', 'tarjeta', 'instruccion', 'central'])
      // Bot NON deve chiedere location/tipo/numero/display (NON è incidenza macchina)
      expectMentionsNone(reply, ['lavadora o secadora', 'pantalla', 'numero de la lavadora', 'numero de la secadora'])
    },
  },
  {
    name: 'ES — Caso 11 variante "recargar la tarjeta": stesso comportamento',
    run: async (ctx) => {
      const reply = await ctx.send('Quiero recargar la tarjeta de fidelización')
      expectMentionsAll(reply, ['introduce', 'tarjeta', 'central'])
      expectMentionsNone(reply, ['lavadora o secadora', 'pantalla'])
    },
  },
]
