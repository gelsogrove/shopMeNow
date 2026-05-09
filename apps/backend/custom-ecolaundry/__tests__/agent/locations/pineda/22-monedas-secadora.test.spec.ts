// Caso 22 — Pineda: monedas en secadora no suman minutos
//
// Da usecases.md Caso 22 (alineato al Playbook PDF §5.2 + §8 base de
// coneixement Pineda: "a vegades, en afegir diners a la secadora, els
// minuts no s'afegeixen"). Gemello del Caso 21 (Alemanya): stesso flow.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 22 Pineda: trigger no-suma-minutos → location → escalate → name → summary completo',
    run: async (ctx) => {
      // T1 — trigger → bot chiede location
      const t1 = await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location Pineda → bot escala con "revis" (no confrontar)
      const t2 = await ctx.send('Pineda')
      expectMentionsAll(t2, ['revis'])
      expectMentionsNone(t2, ['estafa', 'imposible'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'Pineda', 'secadora'])
      const finalLower = final.toLowerCase()
      if (!/monedas|minutos|tiempo/i.test(finalLower)) {
        throw new Error(`Caso 22 summary non menziona monedas/minutos: ${final}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
