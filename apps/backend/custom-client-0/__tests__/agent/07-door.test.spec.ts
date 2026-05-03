// 07 — Caso 2 DOOR
//
// Da 01usecaases.md Caso 2:
//   USER: la lavadora no arranca
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Hortes
//   BOT:  ¿qué número de lavadora es?
//   USER: La 2
//   BOT:  ¿qué aparece exactamente en la pantalla?
//   USER: DOOR
//   BOT:  ese mensaje indica que la puerta no está bien cerrada,
//         ábrela y ciérrala bien y vuelve a probar.
//   USER: ahora sí funciona
//   BOT:  perfecto, ya estaría resuelto.
//
// Escalar si:
//   - el mensaje DOOR sigue apareciendo
//   - el cliente repite el paso y no arranca

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 2 DOOR risolto: cliente conferma "ahora sí funciona" → bot chiude (perfect, resuelt)',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      const reply = await ctx.send('ahora sí funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    name: 'ES — Caso 2 DOOR istruzione: bot dice di aprire e chiudere la puerta + loopback',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      const reply = await ctx.send('DOOR')
      // Istruzione + loopback "dimmi se funciona"
      expectMentionsAll(reply, ['puerta', 'cierr', 'dime', 'funciona'])
    },
  },
  {
    name: 'ES — Caso 2 DOOR escalation: cliente ripete e dice "sigue sin arrancar" → bot escala (revis, llamas)',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      const reply = await ctx.send('sigue sin arrancar')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
]
