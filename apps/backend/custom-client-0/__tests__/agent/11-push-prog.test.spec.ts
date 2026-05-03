// 11 — Caso 1 PUSH PROG
//
// Da usecases.md Caso 1: il bot guida il cliente a selezionare il programa
// dopo aver visto "PUSH PROG" sulla pantalla.
//
// NOTA: come da reglas/prompt, il bot NON chiede mai "¿Has pagado?" come
// domanda standalone. Lo stato del display (PUSH PROG / SEL / DOOR) implica
// che il pago è già stato fatto.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 1 T2: dopo location, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — Caso 1 T3: dopo numero, bot chiede display (no pago)',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      const reply = await ctx.send('La 5')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
  {
    name: 'ES — Caso 1 T4: PUSH PROG istruzione: bot dice "pulsa programa" + loopback',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      const reply = await ctx.send('PUSH PROG')
      expectMentionsAll(reply, ['program', 'puls', 'dime'])
    },
  },
  {
    name: 'ES — Caso 1 T5 risolto: cliente conferma "ahora funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      const reply = await ctx.send('Sí, ahora funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    name: 'ES — Caso 1 T5 escala: cliente pulsa pero no responde → bot escala',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      const reply = await ctx.send('He pulsado pero no responde')
      expectMentionsAll(reply, ['revis'])
    },
  },
  {
    // BUG REGRESSION: il riepilogo Human Support per il Caso 1 deve contenere
    // location, machineNumber e descrivere correttamente il sintomo PUSH PROG.
    // Prima del fix conteneva "número número desconocido" + "seleccionó el
    // programa pero problema técnico" (frase nonsense).
    name: 'ES — Caso 1 escalation summary: corretto e contestualizzato a PUSH PROG',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      await ctx.send('He pulsado pero no responde')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Goya', '5', 'PUSH'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
