// 28 — Caso 28 Relato contradictorio en un doble cobro
//
// Da usecases.md Caso 28 (alineato al Playbook PDF §6 "regle de possible
// frau o incoherència": "el relat del procés és molt contradictori" →
// escalar a revisió humana, no confrontar):
//
// Trigger: pattern "cobró dos veces / aunque también pagué + creo / no sé"
// (detector guardContradictoryNarrative).
// Set nonTroubleshootingIncident="contradictory-narrative".
//
// REGOLA: bot NO intenta clarificar (no interroga sull'incoerenza) — la
// chiarificazione la fa l'operador. Bot escala e basta.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 2 test → 1.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 28: relato contradictorio → "no lo sé bien" → escalate → name → summary "contradictorio/confuso"',
    run: async (ctx) => {
      // T1 — trigger contradictorio (cobró dos veces + creo + también pagué efectivo + no sé)
      await ctx.send('Me cobró dos veces, aunque creo que también pagué en efectivo, pero no sé si llegó a arrancar')
      // T2 — cliente conferma incertezza → bot escala con "revis"
      const t2 = await ctx.send('No lo sé bien')
      expectMentionsAll(t2, ['revis'])
      // T finale — name → handover summary con marker contradictorio/confuso/cobro
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea'])
      const finalLower = final.toLowerCase()
      if (!/contradictorio|confuso|cobr/.test(finalLower)) {
        throw new Error(`Caso 28 summary non menziona contradictorio/cobro: ${final}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },
]
