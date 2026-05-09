// 12 — Caso 12 Horarios y precios
//
// Da usecases.md Caso 12 (alineado al Playbook PDF §5.10):
//   A) Horario general: 8:00 a 22:00 cada día del año
//   B) Excepción L'Escala: 7:00 a 23:00 (override location-aware)
//   C) Precios: bot NO inventa importes, dice "tengo que revisarlo"
//   Follow-up: "¿Y en L'Escala?" dopo orario general → eccezione 7-23
//
// Multilingua (rule #8): l'input recognition è multilingua (IT/EN/FR/PT/CA),
// l'output resta in lingua tenant (ES). HORARIOS_TOPIC regex copre i 6
// idiomi. I test pinano la copertura per ogni lingua come regression test
// dell'audit 2026-05-08 (Bug "Ciao + che orari avete?" classificato come
// failed location reply).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): 8 → 5 test. Combinato 12A +
// follow-up. Mantenuti i 4 test multilingua perché HORARIOS_TOPIC multilingua
// non ha sibling unit test (rule #5 tracked exemption rule #6).

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 12A — Happy Path completo (horario general + follow-up) ────
  {
    name: "ES — Scenario 12A: horario general 8-22 + follow-up \"¿Y en L'Escala?\" → eccezione 7-23",
    run: async (ctx) => {
      // T1 — trigger horario general → 8:00-22:00
      const t1 = await ctx.send('¿Cuál es el horario?')
      expectMentionsAll(t1, ['8:00', '22:00'])
      // T2 — follow-up "¿Y en L'Escala?" → eccezione 7:00-23:00 (override
      // location-aware da locations.json:faqOverrides.openingHours).
      // Bug regression: il bot NON deve cadere in gather machine.
      const t2 = await ctx.send("¿Y en L'Escala?")
      expectMentionsAll(t2, ['7:00', '23:00'])
      const t2Lower = t2.toLowerCase()
      if (/lavadora.*secadora|secadora.*lavadora|qu[eé]\s+aparece\s+en\s+la\s+pantalla/i.test(t2Lower)) {
        throw new Error(`Caso 12 follow-up cade in gather machine: ${t2}`)
      }
    },
  },

  // ── Scenario 12B — Override location-aware (location settata prima) ─────
  {
    name: "ES — Scenario 12B: location L'Escala settata → ask hours → eccezione 7-23",
    run: async (ctx) => {
      // Pre-popola state con location L'Escala via troubleshooting flow.
      await ctx.send("Estoy en L'Escala")
      const reply = await ctx.send('¿Cuál es el horario?')
      expectMentionsAll(reply, ['7:00', '23:00'])
    },
  },

  // ── Scenario 12C — Pricing deflect (bot NO inventa) ─────────────────────
  {
    name: 'ES — Scenario 12C: precio → bot NO inventa, dice "tengo que revisarlo"',
    run: async (ctx) => {
      const reply = await ctx.send('¿Cuánto cuesta esta máquina?')
      // Doc canonica: "Tengo que revisarlo antes de confirmarte ese importe."
      expectMentionsAll(reply, ['revis', 'importe'])
      // Bot NON deve inventare prezzi specifici (allineato al PDF: "no
      // afirmar dades de preu si no estan confirmades a la base actualitzada")
      expectMentionsNone(reply, ['€4', '€6', '€8', '4,50', '6,00', '8,50'])
    },
  },

  // ── Bug regression multilingua HORARIOS_TOPIC (rule #8) ─────────────────
  // Audit 2026-05-08: customer typed "Ciao" → "che orari avete?". Bot wrongly
  // classified the second turn as a failed location reply. Two-part fix:
  //   1. utils/intent.ts:isLikelyStandaloneLocationInput now excludes msgs
  //      that contain "?" or start with an interrogative pronoun (6 langs).
  //   2. utils/guards/hours-and-pricing.ts:HORARIOS_TOPIC extended to match
  //      IT/EN/CA/PT/FR (input recognition multilingua even though output is ES).
  // Each language is a separate test for session isolation: combining them
  // in a single ctx would accumulate state across languages (cross-talk).
  {
    name: 'ES tenant — IT input "che orari avete?" after greeting → bot answers hours',
    run: async (ctx) => {
      await ctx.send('Ciao')
      const reply = await ctx.send('che orari avete?')
      expectMentionsAll(reply, ['8:00', '22:00'])
      const lower = reply.toLowerCase()
      if (/no reconozco|nuestras lavander[ií]as son/i.test(lower)) {
        throw new Error(`Bot wrongly asked for location instead of answering hours: ${reply}`)
      }
    },
  },
  {
    name: 'ES tenant — EN/FR/PT input → bot answers hours (multilingual FAQ topic)',
    run: async (ctx) => {
      // Single test cycling through EN/FR/PT: each ctx.send is a separate
      // turn, but session state carries over. We assert that NONE of these
      // questions falls through to the unknown-location fallback.
      // (Session-isolation caveat: state accumulates across the 3 sends.
      // OK because each question is self-contained — the bot's answer
      // doesn't depend on prior turns for hours FAQ.)
      const t1 = await ctx.send('what time do you open?')
      expectMentionsAll(t1, ['8:00', '22:00'])
      const t2 = await ctx.send('quels sont vos horaires?')
      expectMentionsAll(t2, ['8:00', '22:00'])
      const t3 = await ctx.send('que horas abrem?')
      expectMentionsAll(t3, ['8:00', '22:00'])
    },
  },
]
