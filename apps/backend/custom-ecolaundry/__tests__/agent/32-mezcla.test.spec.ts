// 32 — Caso 32 El cliente mezcla incidencia de máquina y pago
//
// Da usecases.md Caso 32 (alineato al PDF Playbook §11 "una pregunta cada
// vegada" + §4 canonical question order):
//
// REGOLA architettura: il bot NON si confonde con narrativa mista del
// cliente. Procede sempre con canonical question order (location → tipo
// → numero → pantalla, una pregunta per turno). Se il cliente anticipa un
// fact (es. "lavadora 3"), `autoExtractFacts` lo cattura PRIMA dei guard,
// e il guard branchato chiede solo quello che manca (no re-ask awkward).
//
// Pinned by unit tests:
//   __tests__/unit/force-machine-type.test.ts  (T2 ask SOLO il tipo)
//   __tests__/unit/extract-facts.test.ts       (combined "lavadora 3")
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-10): un test per percorso, asserzioni
// step-by-step inline. 5 test → 2.

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Path completo: combined answer "lavadora 3" → display ───────────────
  {
    name: 'ES — Caso 32: trigger mezcla → location → "lavadora 3" combined → display PUSH PROG → istruzione',
    run: async (ctx) => {
      // T1 — trigger narrativa mista → bot chiede SOLO location (no confusione)
      const t1 = await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location → bot chiede SOLO il tipo (Step 2 canonical, NO numero)
      const t2 = await ctx.send('Pineda')
      const t2Lower = t2.toLowerCase()
      if (!/lavadora/.test(t2Lower) || !/secadora/.test(t2Lower)) {
        throw new Error(`Caso 32 T2: bot deve chiedere il tipo: ${t2}`)
      }
      if (/n[uú]mero/.test(t2Lower)) {
        throw new Error(`Caso 32 T2: deve chiedere SOLO il tipo, NON il numero: ${t2}`)
      }
      // T3 — risposta combinata "lavadora 3" → autoExtractFacts cattura
      // tipo+numero in un turno, bot avanza a pantalla SENZA re-ask numero
      const t3 = await ctx.send('lavadora 3')
      const t3Lower = t3.toLowerCase()
      if (!/pantalla/.test(t3Lower)) {
        throw new Error(`Caso 32 T3: bot non chiede pantalla dopo combined answer: ${t3}`)
      }
      // T4 — display PUSH PROG → bot dà istruzione canonica Caso 1
      const t4 = await ctx.send('PUSH PROG')
      const t4Lower = t4.toLowerCase()
      if (!/puls|program|revis/.test(t4Lower)) {
        throw new Error(`Caso 32 T4: bot non guida né escala dopo display: ${t4}`)
      }
      // State coherent: tutti i facts capturati, nessun re-ask awkward
      expectStateHas(ctx.session, {
        location: 'Pineda',
        machineType: 'washer',
        machineNumber: '3',
        displayState: 'PUSH',
      })
    },
  },

  // ── Edge T3b: solo numero "3" → guard chiede tipo (no re-ask numero) ────
  {
    name: 'ES — Caso 32 edge: risposta solo "3" → guard chiede SOLO il tipo (no re-ask numero)',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      await ctx.send('Pineda')
      // Cliente risponde solo "3" (numero anticipato senza tipo)
      const reply = await ctx.send('3')
      const lower = reply.toLowerCase()
      // Bot deve chiedere il tipo (lavadora/secadora), NON ri-chiedere il numero
      if (!/lavadora|secadora/.test(lower)) {
        throw new Error(`Caso 32 edge: bot non chiede il tipo dopo numero anticipato: ${reply}`)
      }
      // State checks: location e machineNumber capturati, machineType ancora unset
      const state = ctx.session.ar.state as unknown as Record<string, unknown>
      if (state.location !== 'Pineda') {
        throw new Error(`location attesa "Pineda", ottenuto ${JSON.stringify(state.location)}`)
      }
      if (state.machineNumber !== '3') {
        throw new Error(`machineNumber atteso "3", ottenuto ${JSON.stringify(state.machineNumber)}`)
      }
      if (state.machineType !== null && state.machineType !== '') {
        throw new Error(`machineType deve essere unset, ottenuto ${JSON.stringify(state.machineType)}`)
      }
    },
  },
]
