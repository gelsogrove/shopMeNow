// Caso 21 — Alemanya: monedas en secadora no suman minutos
//
// Da usecases.md Caso 21 (alineato al Playbook PDF §5.2 + §8 base de
// coneixement Alemanya: "a vegades, en afegir diners a la secadora, els
// minuts no s'afegeixen"):
//
// Flow: trigger "no suma minutos" → bot chiede location → "Alemanya" →
// escalate con summary {Alemanya + secadora + monedas no sumadas}.
//
// nonTroubleshootingIncident="dryer-minutes-not-credited" (no gather display).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 21 Alemanya: trigger no-suma-minutos → location → escalate → name → summary completo',
    run: async (ctx) => {
      // T1 — trigger → bot chiede location
      const t1 = await ctx.send('He puesto más dinero en la secadora y no suma minutos')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location Alemanya → bot escala con "revis" (no confrontar)
      const t2 = await ctx.send('Alemanya')
      expectMentionsAll(t2, ['revis'])
      expectMentionsNone(t2, ['estafa', 'imposible', 'mentira'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      // Summary deve menzionare nome + Alemanya + secadora + (monedas|minutos|tiempo)
      expectMentionsAll(final, ['Andrea', 'Alemanya', 'secadora'])
      const finalLower = final.toLowerCase()
      if (!/monedas|minutos|tiempo/i.test(finalLower)) {
        throw new Error(`Caso 21 summary non menziona monedas/minutos: ${final}`)
      }
      // Garanzie negative
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },
]
