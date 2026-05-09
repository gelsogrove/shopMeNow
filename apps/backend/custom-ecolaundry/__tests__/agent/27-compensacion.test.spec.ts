// 27 — Caso 27 El cliente pide una compensación concreta
//
// Da usecases.md Caso 27 (alineato al Playbook PDF §10 criteris d'escalat:
// "el client reclama una compensació concreta" → escalar):
//   T1: trigger "secadora gratis" / "código nuevo" / "compensación" → bot
//        risponde "vamos a revisar tu caso" SENZA prometere.
//   T2: cliente insiste "confirma ya" → bot mantiene linea + chiede nome.
//   T finale: handover summary con "compensación".
//
// REGOLA SACRA: NO prometere compensaciones (decisione operador).
// Vietate: "secadora gratis", "lavadora gratis", "te la doy", "aprobada",
// "gratuit*".
//
// Differenza con Caso 26 (devolución): Caso 27 cliente chiede qualcosa di
// CONCRETO (macchina gratis, codice nuovo), Caso 26 chiede solo soldi indietro.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 27: trigger compensación → bot revisar (no promesa) → cliente insiste → escalate → name → summary',
    run: async (ctx) => {
      // T1 — trigger compensación → bot escala con "revis" SENZA prometere
      const t1 = await ctx.send('Quiero una secadora gratis por las molestias')
      expectMentionsAll(t1, ['revis'])
      expectMentionsNone(t1, ['secadora gratis', 'lavadora gratis', 'te la doy', 'aprobada', 'gratuit'])
      // T2 — cliente insiste → bot mantiene linea + chiede nome
      const t2 = await ctx.send('Pero quiero que me lo confirmes ya')
      expectMentionsAll(t2, ['revis'])
      const t2Lower = t2.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(t2Lower)) {
        throw new Error(`Caso 27: bot deve chiedere il nome dopo insistenza: ${t2}`)
      }
      // T finale — name → handover summary con "compensación"
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'compensaci'])
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
