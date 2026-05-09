// Caso 24 — Hortes: no se puede pagar con tarjeta
//
// Da usecases.md Caso 24 (alineato al Playbook PDF §8 base de coneixement
// Hortes: "a vegades no es pot pagar amb targeta"). Gemello del Caso 23
// (Alemanya): stesso flow.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 24 Hortes: trigger no-tarjeta → location → escalate → name → summary completo',
    run: async (ctx) => {
      // T1 — trigger → bot chiede location
      const t1 = await ctx.send('La tarjeta no funciona para pagar')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location Hortes → bot escala con "revis" (no confrontar)
      const t2 = await ctx.send('Hortes')
      expectMentionsAll(t2, ['revis'])
      expectMentionsNone(t2, ['estafa', 'imposible'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'Hortes', 'tarjeta'])
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
