// 03.2 — Dryer flow happy path coverage (regression catch for F13)
//
// Andrea, 2026-05-10: l'audit Casi 1-32 aveva ZERO test agent end-to-end
// che esercitassero `json/dryer_ed340.json` (ready_state / door_issue /
// credit_issue / payment_pending). Il bug F13 era nascosto perché tutti
// i Casi del display flow erano testati su washer.
//
// Questo test pina il pattern dryer ACTION → check_result con loopback
// inline, replicando il dialog reale della CLI demo (Andrea, 2026-05-10):
//
//   USER: no me funciona la secadora
//   USER: Goya
//   USER: 4
//   USER: SEL
//   BOT: "La secadora está lista. Por favor, selecciona el programa e
//         inicia el ciclo. Después dime si la secadora ha arrancado."
//
// Asserzioni: il prompt finale contiene
//   - "secadora está lista" (ready_state instruction)
//   - "Después dime si la secadora ha arrancado" (loopback inline post-F13)

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Dryer SEL: ready_state ACTION emette istruzione + loopback (regression F13)',
    run: async (ctx) => {
      // T1 — trigger secadora
      await ctx.send('No me funciona la secadora')
      // T2 — location
      await ctx.send('Goya')
      // T3 — numero
      await ctx.send('4')
      // T4 — display SEL → flow dryer interpret_display ROUTER → ready_state
      const reply = await ctx.send('SEL')
      // ready_state.prompt deve contenere istruzione + loopback inline (F13 fix)
      expectMentionsAll(reply, ['secadora', 'lista', 'programa'])
      const lower = reply.toLowerCase()
      // Loopback obligatorio (post F13): "Después dime si la secadora ha arrancado"
      if (!/dime\s+si.*secadora|secadora.*ha\s+arranca|arrancado/i.test(lower)) {
        throw new Error(`F13 regression: dryer ready_state DEVE contenere il loopback "dime si la secadora ha arrancado": ${reply}`)
      }
    },
  },
]
