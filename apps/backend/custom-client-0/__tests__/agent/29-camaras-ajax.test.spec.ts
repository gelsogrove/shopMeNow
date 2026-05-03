// 29 — Caso 29 cliente menciona cámaras / AJAX / soporte técnico
//
// Da usecases.md Caso 29:
//   USER: Mirad las cámaras porque yo he pagado
//   BOT:  vamos a revisar tu caso manualmente.
//
// Regola: NON prometere comprobación diretta, escalar.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 29 cliente menciona cámaras: bot escala con "revis" SENZA prometere',
    run: async (ctx) => {
      const reply = await ctx.send('Mirad las cámaras porque yo he pagado')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['miraré las cámaras', 'compruebo las cámaras', 'voy a mirar'])
    },
  },
  {
    // BUG REGRESSION: prima del fix, il bot chiedeva location e si bloccava
    // con "Vale" non interpretato come location. Ora escala direttamente
    // chiedendo il nome.
    name: 'ES — Caso 29 T1: bot chiede subito il nome (escalation diretta)',
    run: async (ctx) => {
      const reply = await ctx.send('Mirad las cámaras porque yo he pagado')
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede nome: ${reply}`)
      }
    },
  },
  {
    // Summary regression: deve menzionare cámaras / AJAX. Niente template buggati.
    name: 'ES — Caso 29 escalation summary: contiene "cámaras" o "AJAX"',
    run: async (ctx) => {
      await ctx.send('Mirad las cámaras porque yo he pagado')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea'])
      const lower = reply.toLowerCase()
      if (!/c[aá]maras|ajax/.test(lower)) {
        throw new Error(`Summary non menziona cámaras/ajax: ${reply}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
    },
  },
]
