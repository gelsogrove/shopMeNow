// 09 — Caso 9 cliente pide factura
//
// Da docs/usecases.md Caso 9:
//   USER: Quiero una factura.
//   BOT:  Para obtenerla, debes enviar un correo a olga@alberwaz.net con
//         esta información: razón social, email, lavandería utilizada,
//         CIF/NIF, dirección, fecha de uso, máquinas utilizadas y
//         observaciones.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 9 factura: bot dà email + lista campi richiesti',
    run: async (ctx) => {
      const reply = await ctx.send('Quiero una factura.')
      expectMentionsAll(reply, [
        'olga@alberwaz.net',
        'razon social',
        'cif',
        'direccion',
        'fecha',
      ])
    },
  },
  {
    name: 'ES — Caso 9 factura asked differently: same canonical reply',
    run: async (ctx) => {
      const reply = await ctx.send('Necesito la factura del lavado de hoy')
      expectMentionsAll(reply, ['olga@alberwaz.net', 'razon social'])
    },
  },
  {
    // BUG REGRESSION: prima del fix, "Perfecto" dopo l'istruzione factura
    // veniva interpretato come location candidate e triggerava il fallback
    // "No reconozco esa ubicación". Il bot deve invece chiudere educatamente
    // (ringraziamento) o offrire ulteriore aiuto.
    name: 'ES — Caso 9 T2: dopo "Perfecto" il bot non confonde con location',
    run: async (ctx) => {
      await ctx.send('Quiero una factura')
      const reply = await ctx.send('Perfecto')
      const lower = reply.toLowerCase()
      // NON deve dire "no reconozco esa ubicación" né chiedere lavandería.
      if (/no\s+reconozco\s+esa\s+ubicaci[oó]n|en\s+cu[aá]l\s+de\s+ellas\s+est[aá]s|\bdonde\s+est[aá]\s+la\s+lavander[ií]a\b/i.test(lower)) {
        throw new Error(`Bot scambia "Perfecto" per location: ${reply}`)
      }
    },
  },
]
