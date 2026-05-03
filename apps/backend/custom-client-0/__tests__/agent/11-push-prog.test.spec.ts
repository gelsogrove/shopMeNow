// 11 — Caso 1 PUSH PROG
//
// Da 01usecaases.md Caso 1:
//   USER: La lavadora no funciona
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Goya
//   BOT:  ¿qué número de lavadora es?
//   USER: La 5
//   BOT:  ¿qué aparece exactamente en la pantalla?
//   USER: PUSH PROG
//   BOT:  ese mensaje indica que falta seleccionar el programa.
//         pulsa ahora el programa que quieras usar y dime si la lavadora
//         empieza a funcionar.
//   USER: Sí, ahora funciona
//   BOT:  perfecto, incidencia resuelta.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 1 PUSH PROG istruzione: bot dice "pulsa programa" + loopback',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      const reply = await ctx.send('PUSH PROG')
      // Istruzione case_push: "pulsa programa" + loopback ("dime si arranca/funciona")
      expectMentionsAll(reply, ['program', 'puls', 'dime'])
    },
  },
  {
    name: 'ES — Caso 1 PUSH PROG risolto: cliente conferma "ahora funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      const reply = await ctx.send('Sí, ahora funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
]
