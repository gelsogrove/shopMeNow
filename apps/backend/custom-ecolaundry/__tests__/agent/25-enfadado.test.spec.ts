// 24 — Caso 25 cliente enfadado
//
// Da usecases.md Caso 25:
//   USER: ¡Esto siempre falla! ¡Quiero una solución ya!
//   BOT:  entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo
//         antes posible. ¿En qué lavandería estás?

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 25 cliente enfadado T1: bot risponde con calma (entiendo) + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('¡Esto siempre falla! ¡Quiero una solución ya!')
      expectMentionsAll(reply, ['entiend', 'lavanderia'])
      expectMentionsNone(reply, ['no es posible', 'tienes que esperar', 'estafa'])
    },
  },
  {
    // BUG REGRESSION: dopo gather completo (location + tipo + numero), il
    // bot deve escalare automaticamente per il cliente enfadado, NON
    // continuare a chiedere display all'infinito.
    name: 'ES — Caso 25 dopo gather completo: bot escala automaticamente',
    run: async (ctx) => {
      await ctx.send('¡Esto siempre falla! ¡Quiero una solución ya!')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      const reply = await ctx.send('La 5')
      expectMentionsAll(reply, ['operador'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede nome: ${reply}`)
      }
    },
  },
  {
    // Summary regression: contiene location + tipo + numero. Niente template
    // buggati.
    name: 'ES — Caso 25 escalation summary: contiene location + tipo + numero',
    run: async (ctx) => {
      await ctx.send('¡Esto siempre falla! ¡Quiero una solución ya!')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 5')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Goya'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
