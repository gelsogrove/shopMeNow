// 33 — Caso 32 cliente mezcla incidencia de máquina y pago
//
// Da usecases.md Caso 32: il cliente mescola problema tecnico e cobro.
// Il bot ordina la conversazione step by step partendo dalla location e
// procede al troubleshooting normale (in base a quello che dice il cliente).

import { type TestCase, expectMentionsAll } from './_helpers.js'

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
    // T2: dopo location, il bot procede al gather (tipo macchina) come per
    // un troubleshooting normale.
    name: 'ES — Caso 32 T2: dopo location, bot procede al gather macchina',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      const reply = await ctx.send('Pineda')
      const lower = reply.toLowerCase()
      // Il bot deve continuare con domande gather (tipo, numero, display)
      // o chiedere se ha potuto usare la macchina.
      if (!/lavadora|secadora|qu[eé]\s+aparece|podido\s+usar|n[uú]mero/.test(lower)) {
        throw new Error(`Bot non procede al gather: ${reply}`)
      }
    },
  },
  {
    // Path completo: gather + display PUSH PROG → istruzione caso 1.
    name: 'ES — Caso 32 path completo: location + tipo + display PUSH PROG → istruzione',
    run: async (ctx) => {
      await ctx.send('He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro')
      await ctx.send('Pineda')
      // Saltiamo eventuali domande intermedie del bot.
      let reply = ''
      const turns = ['lavadora', 'La 3', 'PUSH PROG']
      for (const t of turns) reply = await ctx.send(t)
      const lower = reply.toLowerCase()
      // Una volta arrivati al display, il bot deve dare un'istruzione recoverable.
      if (!/puls|program|revis/.test(lower)) {
        throw new Error(`Bot non guida né escala dopo display: ${reply}`)
      }
    },
  },
]
