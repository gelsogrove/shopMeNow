// Caso 34 — FAQ detergente/jabón.
//
// F67 (Andrea 2026-05-21): "No veo jabón" was classified trouble-machine →
// bot asked for display. Root cause: router had no examples for jabón.
// Fix: router-prompt.ts examples + deterministic guardFaqDetergents for T2+.
//
// Test strategy: one end-to-end path per key scenario. No 1-turn-per-test
// fragmentation (anti-pattern documented in CLAUDE.md → "Agent test pattern").
//
// Scenario 34.1 — Cold start: T1 "no veo jabón" → FAQ answer directly.
// Scenario 34.2 — Mid-flow pivot: customer in DOOR troubleshoot asks "¿hay jabón?"
//                 → FAQ answer → original flow resumes on next relevant turn.
// Scenario 34.3 — Multi-language: IT/EN/PT/CA/FR inputs trigger the same FAQ.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 34.1 — Cold start ──────────────────────────────────────────────
  {
    name: 'ES — Scenario 34.1: "No veo jabón" → FAQ detergents answer (NOT display ask)',
    run: async (ctx) => {
      // F67 regression: this MUST NOT ask "¿qué aparece en pantalla?"
      const t1 = await ctx.send('No veo jabón')
      // The answer must mention automatic dispensing.
      if (!/autom[aá]tic|dosific|incluido|no\s+hace\s+falta/i.test(t1)) {
        throw new Error(`34.1: bot must answer about automatic detergent, got: ${t1}`)
      }
      // Must NOT ask for display or machine type.
      expectMentionsNone(t1.toLowerCase(), ['pantalla', 'lavadora o secadora', 'qué aparece'])
    },
  },
  {
    name: 'ES — Scenario 34.1b: "¿hay detergente en las máquinas?" → FAQ answer',
    run: async (ctx) => {
      const t1 = await ctx.send('¿hay detergente en las máquinas?')
      if (!/autom[aá]tic|dosific|incluido|no\s+hace\s+falta/i.test(t1)) {
        throw new Error(`34.1b: expected detergent FAQ answer, got: ${t1}`)
      }
    },
  },
  {
    name: 'ES — Scenario 34.1c: "¿traigo jabón?" → FAQ answer',
    run: async (ctx) => {
      const t1 = await ctx.send('¿traigo jabón?')
      if (!/autom[aá]tic|dosific|incluido|no\s+hace\s+falta/i.test(t1)) {
        throw new Error(`34.1c: expected detergent FAQ answer, got: ${t1}`)
      }
    },
  },

  // ── Scenario 34.2 — Mid-flow pivot ──────────────────────────────────────────
  {
    name: 'ES — Scenario 34.2: mid-DOOR-flow pivot "¿hay jabón?" → FAQ → flow context preserved',
    run: async (ctx) => {
      // Start a trouble flow (DOOR) so the bot has active gather state.
      await ctx.send('La lavadora no funciona, sale DOOR')
      await ctx.send('Pineda')
      await ctx.send('lavadora')
      await ctx.send('5')
      // Now pivot mid-flow to jabón FAQ.
      const faqReply = await ctx.send('¿hay jabón en la máquina?')
      // Must answer the FAQ, not continue asking about the display.
      if (!/autom[aá]tic|dosific|incluido|no\s+hace\s+falta/i.test(faqReply)) {
        throw new Error(`34.2: FAQ pivot must answer detergents, got: ${faqReply}`)
      }
      // Must NOT ask "¿qué aparece en pantalla?" for the jabón question itself.
      if (/qué aparece|pantalla.*jabón|jabón.*pantalla/i.test(faqReply)) {
        throw new Error(`34.2: bot must not mix display-ask with jabón FAQ answer, got: ${faqReply}`)
      }
    },
  },

  // ── Scenario 34.3 — Multi-language ──────────────────────────────────────────
  {
    name: 'IT — Scenario 34.3: "non vedo il sapone" → FAQ answer',
    run: async (ctx) => {
      const t1 = await ctx.send('non vedo il sapone')
      if (!/autom[aá]tic|dosific|automaticamente|automatico|incluso/i.test(t1)) {
        throw new Error(`34.3 IT: expected detergent FAQ answer, got: ${t1}`)
      }
    },
  },
  {
    name: 'EN — Scenario 34.3: "do I need to bring soap?" → FAQ answer',
    run: async (ctx) => {
      const t1 = await ctx.send('do I need to bring soap?')
      if (!/autom[aá]tic|dosific|included|automatically/i.test(t1)) {
        throw new Error(`34.3 EN: expected detergent FAQ answer, got: ${t1}`)
      }
    },
  },
  {
    name: 'FR — Scenario 34.3: "y a-t-il du savon?" → FAQ answer',
    run: async (ctx) => {
      const t1 = await ctx.send('y a-t-il du savon?')
      if (!/autom[aá]tic|dosific|inclus|automatiquement/i.test(t1)) {
        throw new Error(`34.3 FR: expected detergent FAQ answer, got: ${t1}`)
      }
    },
  },
]
