// 10 — Caso 5 Error AL001
//
// Da 01usecaases.md Caso 5:
//   USER: Me sale AL001
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: L'Escala
//   BOT:  ¿es una lavadora o una secadora?
//   USER: Lavadora
//   BOT:  de acuerdo, ese aviso aparece cuando el proceso no se ha hecho
//         en el orden correcto. ¿qué has hecho justo antes?
//   USER: toqué el programa antes de acabar el pago
//   BOT:  perfecto, vamos a revisarlo paso a paso.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 5 AL001 T2 (location): bot chiede tipo (lavadora o secadora)',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      const reply = await ctx.send("L'Escala")
      expectMentionsAll(reply, ['lavadora', 'secadora'])
    },
  },
  {
    // Doc Caso 5: dopo lavadora il bot spiega l'origine del problema e chiede
    // "¿qué has hecho justo antes de que apareciera el mensaje?".
    name: 'ES — Caso 5 AL001: dopo location+tipo bot chiede "qué has hecho justo antes"',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      const reply = await ctx.send('Lavadora')
      expectMentionsAll(reply, ['orden', 'antes'])
    },
  },
]
