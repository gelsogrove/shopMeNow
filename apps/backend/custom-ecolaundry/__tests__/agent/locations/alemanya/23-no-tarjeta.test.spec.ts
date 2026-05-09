// Caso 23 — Alemanya: no se puede pagar con tarjeta
//
// Da usecases.md Caso 23 (alineato al Playbook PDF §8 base de coneixement
// Alemanya: "a vegades no es pot pagar amb targeta"):
//
// Flow: trigger "no puedo pagar con tarjeta" → bot chiede location →
// "Alemanya" → escalate con summary {Alemanya + tarjeta}.
// nonTroubleshootingIncident="card-payment" (no gather máquina).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 23 Alemanya: trigger no-tarjeta → location → escalate → name → summary completo',
    run: async (ctx) => {
      // T1 — trigger → bot chiede location
      const t1 = await ctx.send('No puedo pagar con tarjeta')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location Alemanya → bot escala con "revis" (no confrontar)
      const t2 = await ctx.send('Alemanya')
      expectMentionsAll(t2, ['revis'])
      expectMentionsNone(t2, ['estafa', 'imposible'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'Alemanya', 'tarjeta'])
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
