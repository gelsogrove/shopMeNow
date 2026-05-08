// 06 — Escalar
//
// Da usecases.md Caso 1:
//   "Escalar si: el cliente pulsa el programa y la máquina no responde"
//
// Flusso (con Phase B/C re-ask):
//   T1 La lavadora no funciona       → ask location
//   T2 Goya                          → ask numero
//   T3 La 5                          → ask pagado
//   T4 Sí                            → ask display
//   T5 PUSH PROG                     → istruzione "pulsa programa" + loopback
//   T6 No, sigue igual               → Phase B: re-ask display (or escalate direct)
//   T7 PUSH PROG                     → Phase C: ESCALATE + ask nome

import { type TestCase, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 1 PUSH PROG: cliente pulsa pero la máquina no responde → bot escala',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('Sí')
      await ctx.send('PUSH PROG')
      let reply = await ctx.send('No, sigue igual')
      // Phase B: bot may re-ask display before escalating. If so, re-confirm.
      if (/pantalla|c[oó]digo|aparece|escrib/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      // Concept-level: escalation reached (revisar/operador/asistencia/manual review).
      expectEscalation(reply)
    },
  },
]
