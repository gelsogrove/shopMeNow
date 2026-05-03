// 12 — Caso 7 He pagado pero no he podido usar el servicio
//
// Da 01usecaases.md Caso 7:
//   USER: He pagado y no he podido usar la máquina
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Pineda
//   BOT:  ¿la central te ha devuelto el cambio?       ← salta tipo+numero!
//   USER: Sí
//   BOT:  ¿qué aparece exactamente en la pantalla?
//   USER: PUSH PROG
//   BOT:  pulsa el programa y dime si la máquina responde.
//   USER: Ahora sí
//   BOT:  perfecto, ya estaría resuelto.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 7 dopo location: bot chiede del cambio (salta tipo+numero)',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      const reply = await ctx.send('Pineda')
      // La doc dice: dopo location → "¿la central te ha devuelto el cambio?"
      expectMentionsAll(reply, ['cambio'])
    },
  },
  {
    name: 'ES — Caso 7 dopo cambio sí: bot chiede pantalla',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      const reply = await ctx.send('Sí')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
]
