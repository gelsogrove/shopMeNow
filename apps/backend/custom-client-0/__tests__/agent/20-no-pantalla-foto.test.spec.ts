// 20 — Caso 17 il cliente non sa qué pone en pantalla
//
// Da 01usecaases.md Caso 17:
//   USER: La máquina no va, pero no sé qué pone
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Hortes
//   BOT:  ¿es una lavadora o una secadora?
//   USER: Lavadora
//   BOT:  si puedes, envíame una foto. Si no, lo pasamos a revisión.
//   USER: No puedo hacer la foto
//   BOT:  vamos a revisarlo manualmente.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 17 dopo location+tipo: bot chiede foto della pantalla',
    run: async (ctx) => {
      await ctx.send('La máquina no va, pero no sé qué pone')
      await ctx.send('Hortes')
      const reply = await ctx.send('Lavadora')
      expectMentionsAll(reply, ['foto'])
    },
  },
  {
    name: 'ES — Caso 17 cliente "no puedo hacer foto": bot escala',
    run: async (ctx) => {
      await ctx.send('La máquina no va, pero no sé qué pone')
      await ctx.send('Hortes')
      await ctx.send('Lavadora')
      const reply = await ctx.send('No puedo hacer la foto')
      expectMentionsAll(reply, ['revis'])
    },
  },
]
