// 26 — Caso 26 El cliente exige devolución inmediata
//
// Da usecases.md Caso 26 (alineato al Playbook PDF §10 criteris d'escalat:
// "el client reclama una compensació concreta" → escalar):
//   T1: bot risponde "vamos a revisarlo, necesito 4 dígitos + captura + resumen"
//   T2: cliente insiste → bot escala SENZA promettere devolución
//   T finale: handover summary con "devolución" e nome.
//
// REGOLA SACRA: NO prometere devolución (la decisione è dell'operador).
// Vietate parole: "te devolveré", "te devuelvo", "devolución aprobada",
// "reembolso confirmado".
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 26: exige devolución → bot chiede 4 dígitos+captura → cliente insiste → escalate (no promesa) → name → summary',
    run: async (ctx) => {
      // T1 — trigger devolución → bot chiede dati (4 dígitos, captura, resumen)
      const t1 = await ctx.send('Quiero que me devolváis el dinero ahora mismo')
      expectMentionsAll(t1, ['dig', 'tarjeta'])
      // T2 — cliente insiste → bot escala con "revis" SENZA promettere
      const t2 = await ctx.send('Quiero la devolución ya')
      expectMentionsAll(t2, ['revis'])
      expectMentionsNone(t2, ['te devolveré', 'te devuelvo', 'devolución aprobada', 'reembolso confirmado'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'devoluc'])
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
