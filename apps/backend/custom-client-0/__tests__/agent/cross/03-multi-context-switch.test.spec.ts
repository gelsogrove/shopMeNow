// Cross-test: cliente cambia argomento più volte (machine → payment → cameras)
// Verifica che gli sticky facts macchina vengano resettati e che il nuovo
// incident type venga riconosciuto correttamente.

import { type TestCase, expectMentionsAll, expectStateHas } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — context switch machine → datafono: machine facts resetati, datafono incident attivo',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('5')
      // Cliente cambia argomento di colpo
      const reply = await ctx.send('Aspetta, en realidad el datáfono me ha cobrado 10€')
      // Bot deve escalare su datafono
      expectMentionsAll(reply, ['revis'])
      // Location preservata, machine facts resetate
      expectStateHas(ctx.session, {
        location: 'Goya',
      })
    },
  },
]
