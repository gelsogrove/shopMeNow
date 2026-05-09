// CROSS — Context switch: FAQ in mezzo a un flow di troubleshooting
//
// NOTE (Andrea, 2026-05-10): questo test NON copre Caso 26 di usecases.md
// (devolución inmediata) — è una funzionalità trasversale (sticky facts
// preservation durante FAQ interruption). Spostato in cross/ per chiarezza.
//
// Il customer è dentro un flow tecnico (location → tipo → numero → display)
// e all'improvviso fa una domanda FAQ ("a che ora aprite?"). Il bot deve:
//   1. Rispondere alla FAQ
//   2. NON perdere gli sticky facts già raccolti
//   3. (Idealmente) tornare al flow dove era

import { type TestCase, expectMentionsAll, expectStateHas } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — context switch: dopo Goya+5 fa FAQ "qué horarios" → bot risponde con orari',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('5')
      const reply = await ctx.send('Por cierto, ¿qué horario tenéis?')
      // FAQ orari deve essere risposta
      expectMentionsAll(reply, ['8:00', '22:00'])
    },
  },
  {
    name: 'ES — sticky facts dopo FAQ: location/machineType/machineNumber non si perdono',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('5')
      await ctx.send('Por cierto, ¿qué horario tenéis?')
      // Lo state mantiene i fatti
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '5',
      })
    },
  },
]
