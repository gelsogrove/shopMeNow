// Cross-test: cliente entra in flow tecnico, fa una FAQ a metà, poi torna.
// Verifica che la FAQ venga risposta SENZA perdere gli sticky facts.

import { type TestCase, expectMentionsAll, expectStateHas } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — flow tecnico interrotto da FAQ horarios: bot risponde + facts intatti',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('5')
      const reply = await ctx.send('Por cierto, ¿qué horario tenéis?')
      expectMentionsAll(reply, ['8:00', '22:00'])
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineNumber: '5',
      })
    },
  },
  {
    name: 'ES — flow tecnico interrotto da FAQ tarjeta: bot risponde location-aware',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      const reply = await ctx.send('¿Cómo consigo la tarjeta de fidelización?')
      // In Goya l'override location-aware deve essere applicato (segundo botón…)
      expectMentionsAll(reply, ['segundo', 'boton', 'derecha'])
    },
  },
]
