// 30 — Caso 18 codice solo numerico (incoherencia → escala sin confrontar)
//
// Da usecases.md Caso 18:
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
  {
    // Quando il cliente risponde "SI" alla domanda "¿hay letras?", il bot non
    // deve scattare unknown-location ma rilanciare per il codice corretto
    // (transizione a Caso 8 step ask-code).
    name: 'ES — Caso 18 cliente "SI" alle lettere: bot rilancia chiedendo codice esatto',
    run: async (ctx) => {
      await ctx.send('Tengo un código: 23432023')
      const reply = await ctx.send('SI')
      expectMentionsAll(reply, ['codigo', 'letras'])
      expectMentionsNone(reply, ['no reconozco', 'lavanderias son'])
    },
  },
  {
    // BUG REGRESSION: il summary del Caso 18 deve descrivere "código solo
    // numérico que no encaja con el formato esperado", NON il template del
    // Caso 8 ("código de descuento ... importe pendiente"). Prima del fix
    // venivano confusi perché usavano lo stesso campo discountCode.
    name: 'ES — Caso 18 escalation summary: contiene "solo numérico" (no template Caso 8)',
    run: async (ctx) => {
      await ctx.send('Tengo un código: 23432023')
      await ctx.send('No')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', '23432023'])
      const lower = reply.toLowerCase()
      // Deve contenere il template Caso 18.
      if (!/solo\s+num[eé]rico|no\s+encaja|formato\s+esperado/.test(lower)) {
        throw new Error(`Summary Caso 18 errato (manca pattern Caso 18): ${reply}`)
      }
      // NON deve contenere il template Caso 8 (importe pendiente / la máquina no arrancó).
      if (/importe\s+pendiente|m[aá]quina\s+no\s+arranc[oó]/i.test(reply)) {
        throw new Error(`Summary Caso 18 sta usando template Caso 8: ${reply}`)
      }
    },
  },
]
