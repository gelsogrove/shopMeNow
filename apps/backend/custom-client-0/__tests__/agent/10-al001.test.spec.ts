// 10 — Caso 5 Error AL001
//
// Da usecases.md Caso 5: il bot esplora la causa (sequenza errata),
// guida al cliente con la sequenza corretta (prima pago → poi programa)
// e verifica il display dopo il retry.
//
// 6 turni: location → tipo → numero → relato → guida + verify display → closure.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 5 T2: dopo "Me sale AL001" + location, bot chiede tipo',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      const reply = await ctx.send("L'Escala")
      expectMentionsAll(reply, ['lavadora', 'secadora'])
    },
  },
  {
    name: 'ES — Caso 5 T3: dopo tipo, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      const reply = await ctx.send('Lavadora')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — Caso 5 T4: dopo numero, bot chiede "qué has hecho justo antes"',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      const reply = await ctx.send('La 3')
      expectMentionsAll(reply, ['orden', 'antes'])
    },
  },
  {
    // T5: dopo il racconto del cliente, il bot deve guidare con la sequenza
    // corretta (prima pago → poi programa) e chiedere di verificare il display
    // dopo il retry. NON deve escalare subito.
    name: 'ES — Caso 5 T5: dopo racconto, bot guida sequenza + chiede pantalla',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      const reply = await ctx.send('Creo que toqué el programa antes de acabar el pago')
      expectMentionsAll(reply, ['pago', 'programa', 'pantalla'])
      // Garanzia: NON deve escalare a questo step.
      const lower = reply.toLowerCase()
      if (/operador|revisi[oó]n\s+manual|c[oó]mo\s+te\s+llamas/.test(lower)) {
        throw new Error(`Caso 5 T5 non deve escalare, deve guidare: ${reply}`)
      }
    },
  },
  {
    // T6 happy: cliente conferma che funziona dopo il retry → resolved.
    name: 'ES — Caso 5 T6 risolto: cliente "ya funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      await ctx.send('Creo que toqué el programa antes de acabar el pago')
      const reply = await ctx.send('Ya funciona, gracias')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    // T6 escala: AL001 persiste → bot escala chiedendo il nome.
    name: 'ES — Caso 5 T6 escala: AL001 persiste → bot escala',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      await ctx.send('Creo que toqué el programa antes de acabar el pago')
      const reply = await ctx.send('sigue saliendo AL001')
      expectMentionsAll(reply, ['operador'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede nome: ${reply}`)
      }
    },
  },
  {
    // Summary regression: deve menzionare AL001, location, machineNumber e
    // il motivo (sequenza corretta non ha risolto). Niente template buggati.
    name: 'ES — Caso 5 escalation summary: corretto e contestualizzato a AL001',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      await ctx.send('Creo que toqué el programa antes de acabar el pago')
      await ctx.send('sigue saliendo AL001')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'AL001', '3'])
      const lower = reply.toLowerCase()
      if (!/escala/.test(lower)) {
        throw new Error(`Summary non contiene la location: ${reply}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
