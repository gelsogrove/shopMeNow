// 16 — Datafono 10€ a Goya/Pineda → escala senza accusare
//
// Da 02reglas.md "Reglas para incoherencias o posible fraude":
//   - Casos típicos: en Goya o Pineda el cliente dice que el datáfono ha
//     cobrado 10€ (mientras que el TPV cobra 7 o 8 €).
//   - Acción: NO confrontar, recoger datos mínimos, escalar.
//   - El bot NUNCA debe decir "estafa", "no es verdad", "es imposible".
//   - Debe decir "necesitamos revisarlo manualmente".

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Datafono 10€ Goya: bot escala con "revisar" senza accusare',
    run: async (ctx) => {
      // The customer mentions both the incident and the location in T1, so the
      // escalation guard fires immediately on T1 (no need for a separate
      // location turn). Per doc 02reglas.md "Reglas para incoherencias".
      const reply = await ctx.send('El datáfono me ha cobrado 10€ en Goya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira', 'no es verdad'])
    },
  },
  {
    name: 'ES — Datafono 10€ Pineda: bot escala con "revisar" senza accusare',
    run: async (ctx) => {
      await ctx.send('El datáfono me ha cobrado 10€')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira', 'no es verdad'])
    },
  },
]
