// Cross-test: Double charge incident a Mataró — verifica che la calle venga
// chiesta PRIMA del flow caso6 e che il summary handover contenga la calle
// + narrativa, senza il template hardcoded di macchina.

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    // La street deve essere chiesta PRIMA del flow caso6: il bot deve
    // disambiguare le 2 lavanderías di Mataró (Goya + Alemanya) e NON
    // procedere con "¿has podido lavar?".
    name: 'ES — Caso 6 + Mataró: bot disambigua tra Goya/Alemanya PRIMA di entrare nel flow',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      const reply = await ctx.send('Mataró')
      expectMentionsAll(reply, ['mataro', 'goya', 'alemanya'])
      expectMentionsNone(reply, ['has podido', 'lavar', 'secar'])
    },
  },
  {
    name: 'ES — Caso 6 + Mataró: dopo calle, bot procede al flow doble cobro',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Mataró')
      const reply = await ctx.send('Calle Sant Pere')
      expectMentionsAll(reply, ['podido', 'lavar'])
    },
  },
  {
    name: 'ES — Caso 6 + Mataró: summary handover contiene calle e doble cobro (no machine template)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Mataró')
      await ctx.send('Calle Sant Pere')
      await ctx.send('si')
      await ctx.send('He pagado, no iba y volví a pagar')
      await ctx.send('4444')
      const reply = await ctx.send('Andrea')
      // Summary deve contenere "Mataró", la calle, e "doble cobro"
      expectMentionsAll(reply, ['mataro', 'sant pere', 'doble cobro'])
      // NON deve contenere il template machine ("número desconocido", "sin información de pantalla")
      expectMentionsNone(reply, ['número desconocido', 'sin información de pantalla', 'seleccionó el programa'])
    },
  },
]
