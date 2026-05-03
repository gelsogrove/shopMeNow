// 06 — Escalar
//
// Da 01usecaases.md Caso 1:
//   "Escalar si: el cliente pulsa el programa y la máquina no responde"
//
// Flusso:
//   T1 La lavadora no funciona       → ask location
//   T2 Goya                          → ask numero
//   T3 La 5                          → ask pagado
//   T4 Sí                            → ask display
//   T5 PUSH PROG                     → istruzione "pulsa programa" + loopback
//   T6 No, sigue igual / no responde → ESCALAR (revisar/operador) + ask nome

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 1 PUSH PROG: cliente pulsa pero la máquina no responde → bot escala (revis, llamas)',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('Sí')
      await ctx.send('PUSH PROG')
      const reply = await ctx.send('No, sigue igual')
      // Escalation deve contenere "revis" (revisar / revisión) + chiedere il nome
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
]
