// 08 — Caso 3 SEL
//
// Da usecases.md Caso 3: la macchina mostra SEL, il bot guida il cliente
// a comprobar che ha pulsato bien el numero della macchina o el programa.
// 5 turni: location → numero → display → istruzione → closure.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 3 T2: dopo location, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — Caso 3 T3: dopo numero, bot chiede display',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      const reply = await ctx.send('La 3')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
  {
    name: 'ES — Caso 3 T4 SEL istruzione: "pendiente de selección" + chiede di premere il numero',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      const reply = await ctx.send('SEL')
      expectMentionsAll(reply, ['numero', 'maquina'])
    },
  },
  {
    name: 'ES — Caso 3 T5 risolto: cliente conferma "ahora sí funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      const reply = await ctx.send('ya lo he hecho y ahora sí funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    name: 'ES — Caso 3 T5 escala: cliente ripete e dice "sigue igual" → bot escala',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      const reply = await ctx.send('ya lo he hecho pero sigue igual')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
  {
    // BUG REGRESSION: il riepilogo Human Support per il Caso 3 deve contenere
    // location, machineNumber e descrivere correttamente il sintomo SEL.
    // Verifica che il summary sia contestualizzato (no "número número
    // desconocido", no frase nonsense generica).
    name: 'ES — Caso 3 escalation summary: corretto e contestualizzato a SEL',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      await ctx.send('ya lo he repetido pero sigue sin responder')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Pineda', '3', 'SEL'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
