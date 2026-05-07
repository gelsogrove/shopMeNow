// 33 — Caso 32 cliente mezcla incidencia de máquina y pago
//
// Da usecases.md Caso 32: il cliente mescola problema tecnico e cobro
// e spesso anticipa risposte (numeri, "lavadora") prima che il bot le
// chieda esplicitamente. Il bot deve:
//   - T1: salutare e chiedere la location senza farsi confondere
//   - T2: dopo la location, chiedere TIPO + NUMERO insieme (combined ask)
//         così se il cliente risponde "lavadora 3" o "3" o "lavadora",
//         autoExtract recupera quello che dà e il guard sequenziale chiude
//         il gap senza ri-domandare la stessa cosa.
//   - T3: con tipo+numero estratti, procedere al display
//
// Regola architettura pinneata:
//   guardForceMachineType (utils/guards/location.ts) ramifica:
//   - tipo+numero entrambi missing → key i18n "machineTypeAndNumber"
//   - solo tipo missing (numero già in stato) → key i18n "machineType"
//   La rama unitaria è in __tests__/unit/force-machine-type.test.ts.
//   Questo file ne verifica il comportamento end-to-end con LLM.

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    // T1: il bot saluta e chiede location senza farsi confondere dalla
    // narrativa mista del cliente.
    name: 'ES — Caso 32 T1: bot chiede location dopo narrativa mista',
    run: async (ctx) => {
      const reply = await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    // T2: dopo location, il bot chiede TIPO + NUMERO COMBINATI in un solo
    // turno. Pinned dalla i18n key "machineTypeAndNumber" che contiene
    // entrambi "lavadora/secadora" e "número".
    name: 'ES — Caso 32 T2: dopo location, bot chiede tipo + numero combinati',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      const reply = await ctx.send('Pineda')
      // Combined ask: il bot DEVE menzionare sia il tipo che il numero
      // nello stesso turno (no awkward re-ask quando il cliente anticipa
      // il numero).
      expectMentionsAll(reply, ['lavadora', 'secadora', 'numero'])
      expectStateHas(ctx.session, { location: 'Pineda', machineType: null, machineNumber: null })
    },
  },
  {
    // T3a: cliente risponde COMBINATO ("lavadora 3") → autoExtract recupera
    // tipo + numero in un turno solo → bot avanza al display senza riaskare.
    name: 'ES — Caso 32 T3a: risposta combinata "lavadora 3" → bot chiede display',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      await ctx.send('Pineda')
      const reply = await ctx.send('lavadora 3')
      // Una volta tipo+numero estratti, il prossimo step è il display.
      // Loose check: contiene "pantalla" (la domanda di display).
      const lower = reply.toLowerCase()
      if (!/pantalla/.test(lower)) {
        throw new Error(`Bot non chiede il display dopo combined answer: ${reply}`)
      }
      expectStateHas(ctx.session, {
        location: 'Pineda',
        machineType: 'washer',
        machineNumber: '3',
      })
    },
  },
  {
    // T3b: cliente risponde solo col NUMERO ("3") → autoExtract setta
    // machineNumber, il guard branchato chiede SOLO il tipo nel turno dopo
    // (no ri-domanda dello stesso). NESSUNA re-ask awkward.
    name: 'ES — Caso 32 T3b: risposta solo "3" → guard chiede solo il tipo (no re-ask combinato)',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      await ctx.send('Pineda')
      const reply = await ctx.send('3')
      const lower = reply.toLowerCase()
      // Bot deve menzionare il tipo (lavadora/secadora) ma NON deve
      // chiedere di nuovo il numero, perché "3" è già stato estratto.
      if (!/lavadora|secadora/.test(lower)) {
        throw new Error(`Bot non chiede il tipo dopo numero anticipato: ${reply}`)
      }
      expectStateHas(ctx.session, {
        location: 'Pineda',
        machineType: null,
        machineNumber: '3',
      })
    },
  },
  {
    // Path completo: location → combined ask → combined answer → display
    // PUSH PROG → istruzione canonica caso 1.
    name: 'ES — Caso 32 path completo: location + combined + display PUSH PROG → istruzione',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      await ctx.send('Pineda')
      await ctx.send('lavadora 3')
      const reply = await ctx.send('PUSH PROG')
      const lower = reply.toLowerCase()
      // Una volta arrivati al display, il bot deve dare un'istruzione recoverable.
      if (!/puls|program|revis/.test(lower)) {
        throw new Error(`Bot non guida né escala dopo display: ${reply}`)
      }
      expectStateHas(ctx.session, {
        location: 'Pineda',
        machineType: 'washer',
        machineNumber: '3',
        displayState: 'PUSH',
      })
    },
  },
]
