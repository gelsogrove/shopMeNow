// Agent E2E test — Caso 35: FAQ how to use the laundromat.
//
// F69 (Andrea 2026-05-21): operator (Olga) requested that customers asking
// "how do I use the laundromat" receive the canonical step-by-step instructions
// directly, without being asked for location.
//
// Scenarios:
//   35.1 — Cold start ES: "¿Cómo se usa?" → instructions (no location ask)
//   35.2 — Cold start multi-lang: IT + EN trigger → instructions
//   35.3 — Mid-flow pivot: customer mid-DOOR troubleshoot asks how-to-use →
//           instructions, then DOOR flow resumes

import { runAgentTests } from './run.js'

runAgentTests('Caso 35 — FAQ how to use the laundromat', [
  {
    name: 'Scenario 35.1: cold start ES — instructions delivered, no location ask',
    run: async (ctx) => {
      const t1 = await ctx.send('¿Cómo se usa la lavandería? Es mi primera vez.')
      // Must contain numbered steps and NOT ask for location or machine type
      if (!/1[.)]/i.test(t1)) throw new Error(`T1: reply must contain numbered step 1, got: ${t1}`)
      if (/lavander[ií]a|pueblo|local/i.test(t1)) throw new Error(`T1: must NOT ask for location, got: ${t1}`)
      if (/lavadora|secadora/i.test(t1)) throw new Error(`T1: must NOT ask machine type, got: ${t1}`)
    },
  },
  {
    name: 'Scenario 35.2: multi-lang — IT and EN triggers get instructions',
    run: async (ctx) => {
      const it = await ctx.send('come si usa la lavatrice? è la prima volta')
      if (!/1[.)]/i.test(it)) throw new Error(`IT: reply must contain numbered step 1, got: ${it}`)

      ctx.reset()

      const en = await ctx.send('first time here, what do I do?')
      if (!/1[.)]/i.test(en)) throw new Error(`EN: reply must contain numbered step 1, got: ${en}`)
    },
  },
  {
    name: 'Scenario 35.3: mid-DOOR pivot — instructions, then flow can resume',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona, sale DOOR')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      // Mid-flow pivot to how-to-use
      const pivot = await ctx.send('espera, ¿cómo se usa exactamente?')
      if (!/1[.)]/i.test(pivot)) throw new Error(`Pivot: reply must contain numbered step, got: ${pivot}`)
      if (/lavadora|secadora|n[uú]mero|pantalla/i.test(pivot)) throw new Error(`Pivot: must not ask gather facts, got: ${pivot}`)
    },
  },
])
