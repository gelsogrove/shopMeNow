// 12 — Caso 12 Horarios y precios
//
// Da docs/usecases.md Caso 12:
//   A) Horario general: 8:00 a 22:00 cada día del año
//   B) Excepción L'Escala: 7:00 a 23:00
//   C) Precio no confirmado: "Tengo que revisarlo antes de confirmarte ese
//      importe."

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 12A horarios general: bot dà 8:00-22:00',
    run: async (ctx) => {
      const reply = await ctx.send('¿Cuál es el horario?')
      expectMentionsAll(reply, ['8:00', '22:00'])
    },
  },
  {
    name: "ES — Caso 12B horarios L'Escala: bot dà eccezione 7:00-23:00",
    run: async (ctx) => {
      // Prima settiamo location L'Escala
      await ctx.send('Estoy en L\'Escala')
      const reply = await ctx.send('¿Cuál es el horario?')
      expectMentionsAll(reply, ['7:00', '23:00'])
    },
  },
  {
    name: 'ES — Caso 12C precio: bot NON inventa, dice che deve revisar',
    run: async (ctx) => {
      const reply = await ctx.send('¿Cuánto cuesta esta máquina?')
      // Doc canonica: "Tengo que revisarlo antes de confirmarte ese importe."
      expectMentionsAll(reply, ['revis', 'importe'])
      // Bot NON deve inventare prezzi specifici
      expectMentionsNone(reply, ['€4', '€6', '€8', '4,50', '6,00', '8,50'])
    },
  },
  {
    // BUG REGRESSION: dopo "¿Cuál es el horario?" (FAQ resolved), il cliente
    // chiede "¿Y en L'Escala?" come follow-up. Il bot deve rispondere con
    // l'eccezione 7:00-23:00, NON cadere in gather machine ("¿lavadora o
    // secadora?"). La guard caso12-horarios deve riconoscere il follow-up
    // pattern "Y en <location>".
    name: "ES — Caso 12 follow-up: dopo orario general, \"¿Y en L'Escala?\" → eccezione 7-23",
    run: async (ctx) => {
      await ctx.send('¿Cuál es el horario?')
      const reply = await ctx.send("¿Y en L'Escala?")
      expectMentionsAll(reply, ['7:00', '23:00'])
      const lower = reply.toLowerCase()
      if (/lavadora.*secadora|secadora.*lavadora|qu[eé]\s+aparece\s+en\s+la\s+pantalla/i.test(lower)) {
        throw new Error(`Caso 12 follow-up cade in gather machine: ${reply}`)
      }
    },
  },

  // BUG REGRESSION (Andrea, 2026-05-08):
  //   Customer typed "Ciao" (saluto puro) → "che orari avete?" (IT question).
  //   The bot wrongly classified the second turn as a failed location reply
  //   ("No reconozco esa ubicación. Nuestras lavanderías son: …") instead of
  //   answering the FAQ. Two-part fix:
  //     1. utils/intent.ts:isLikelyStandaloneLocationInput now excludes
  //        messages that contain "?" or start with an interrogative
  //        pronoun in any of the 6 supported languages.
  //     2. utils/guards/hours-and-pricing.ts:HORARIOS_TOPIC extended to
  //        match IT/EN/CA/PT/FR (active tenant is ES but customers may
  //        type in any of the 6 supported languages — rule #8 "Spanish
  //        first" applies to OUTPUT, not input recognition).
  //   This test pins the post-fix behaviour.
  {
    name: 'ES tenant — IT input "che orari avete?" after greeting → bot answers hours',
    run: async (ctx) => {
      await ctx.send('Ciao')
      const reply = await ctx.send('che orari avete?')
      expectMentionsAll(reply, ['8:00', '22:00'])
      // Must NOT fall through to the unknown-location fallback.
      const lower = reply.toLowerCase()
      if (/no reconozco|nuestras lavander[ií]as son/i.test(lower)) {
        throw new Error(`Bot wrongly asked for location instead of answering hours: ${reply}`)
      }
    },
  },
  {
    // Same regression but for English, French, Portuguese, Catalan — pin
    // the multilingual FAQ-topic recognition while ES output policy is in
    // effect. Each is a separate scenario so a single language regression
    // is reported independently.
    name: 'ES tenant — EN input "what time do you open?" → bot answers hours',
    run: async (ctx) => {
      const reply = await ctx.send('what time do you open?')
      expectMentionsAll(reply, ['8:00', '22:00'])
    },
  },
  {
    name: 'ES tenant — FR input "quels sont vos horaires?" → bot answers hours',
    run: async (ctx) => {
      const reply = await ctx.send('quels sont vos horaires?')
      expectMentionsAll(reply, ['8:00', '22:00'])
    },
  },
  {
    name: 'ES tenant — PT input "que horas abrem?" → bot answers hours',
    run: async (ctx) => {
      const reply = await ctx.send('que horas abrem?')
      expectMentionsAll(reply, ['8:00', '22:00'])
    },
  },
]
