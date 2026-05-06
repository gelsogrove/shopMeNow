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
]
