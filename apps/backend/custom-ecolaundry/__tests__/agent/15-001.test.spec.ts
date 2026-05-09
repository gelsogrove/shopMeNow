// 15 — Caso 15 La máquina muestra 001
//
// Da usecases.md Caso 15 (alineado al Playbook PDF §5.4 "001"):
//   "001" puro (senza AL/ALM) → canonical token C001 → flow display
//   "code-001-explained" (json/display-flows.json):
//     - Spiegazione educativa: "puede aparecer cuando el programa se ha
//       seleccionado antes del pago y el estado no se ha reiniciado..."
//     - Sempre escalate (alwaysEscalateOnNextTurn=true)
//     - Diferencia con Caso 5 (AL001): NO recovery — sempre escala.
//   Solo location prima di escalare (no número, no display di nuovo).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 15 001: happy path completo → location → spiegazione educativa → "¿qué hago?" → escalate',
    run: async (ctx) => {
      // T1 — trigger 001 → bot chiede location (NO tipo/numero/display)
      const t1 = await ctx.send('En la pantalla sale 001.')
      expectMentionsAll(t1, ['lavanderia'])
      expectMentionsNone(t1, ['lavadora o secadora', 'numero de la'])
      // T2 — location → bot dà spiegazione educativa (NO chiede tipo)
      const t2 = await ctx.send('Pineda')
      expectMentionsAll(t2, ['programa', 'pago', 'seleccionado'])
      expectMentionsNone(t2, ['lavadora o secadora', 'numero'])
      // T3 — cliente chiede "¿qué hago?" → bot escala manualmente
      const t3 = await ctx.send('¿Qué hago?')
      expectMentionsAll(t3, ['revis', 'manual'])
    },
  },
]
