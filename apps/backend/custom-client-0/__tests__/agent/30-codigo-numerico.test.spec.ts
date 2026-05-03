// 30 — Caso 18 codice solo numerico (incoherencia → escala sin confrontar)
//
// Da 01usecaases.md Caso 18:
//   USER: Tengo un código: 23432023
//   BOT:  Gracias. ¿Ves alguna letra delante de los números?
//   USER: No
//   BOT:  De acuerdo. Hay una información que necesitamos revisar manualmente
//         antes de continuar.
//
// Regola: NON confrontare ("estafa", "imposible", "mentira" sono vietati).

import { type TestCase, expectMentionsAll, expectMentionsNone, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 18 T1: cliente dà codice numerico → bot chiede se ci sono lettere davanti',
    run: async (ctx) => {
      const reply = await ctx.send('Tengo un código: 23432023')
      expectMentionsAll(reply, ['letra'])
    },
  },
  {
    name: 'ES — Caso 18 T2 cliente "No" (no hay letras): bot escala SENZA confrontare',
    run: async (ctx) => {
      await ctx.send('Tengo un código: 23432023')
      const reply = await ctx.send('No')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira', 'fraude', 'no es verdad'])
    },
  },
  {
    name: 'ES — Caso 18 state: code value salvato, escalation triggered',
    run: async (ctx) => {
      await ctx.send('Tengo un código: 23432023')
      await ctx.send('No')
      expectStateHas(ctx.session, {
        faqCodeValue: '23432023',
        operatorRequested: true,
      })
    },
  },
]
