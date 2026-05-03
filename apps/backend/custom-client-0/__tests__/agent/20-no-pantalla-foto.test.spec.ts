// 20 — Caso 17 il cliente non sa qué pone en pantalla
//
// Da usecases.md Caso 17: il cliente non riesce a leggere il display.
// PRODUCT DECISION (Andrea): photo upload non è supportato → il bot escala
// direttamente dopo aver raccolto location + tipo. Senza display state non
// possiamo dare istruzioni recoverable.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 17 T1: dopo trigger "no sé qué pone", bot saluta e chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('La máquina no va, pero no sé qué pone')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 17 T2: dopo location, bot chiede tipo macchina',
    run: async (ctx) => {
      await ctx.send('La máquina no va, pero no sé qué pone')
      const reply = await ctx.send('Hortes')
      expectMentionsAll(reply, ['lavadora', 'secadora'])
    },
  },
  {
    name: 'ES — Caso 17 T3: dopo tipo, bot escala direttamente (no feature foto)',
    run: async (ctx) => {
      await ctx.send('La máquina no va, pero no sé qué pone')
      await ctx.send('Hortes')
      const reply = await ctx.send('Lavadora')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
  {
    // Variante: il cliente menziona display vuoto/blanco direttamente.
    // Anche in questo caso senza display recoverable il bot escala.
    name: 'ES — Caso 17 variante "no veo bien la pantalla": flow simile, escala',
    run: async (ctx) => {
      await ctx.send('No veo bien la pantalla')
      await ctx.send('Hortes')
      const reply = await ctx.send('Lavadora')
      const lower = reply.toLowerCase()
      // Bot deve escalare o chiedere foto, NON fingere di guidare.
      if (!/revis|operador|t[ée]cnic|llamas|foto/.test(lower)) {
        throw new Error(`Bot non escala su "no veo": ${reply}`)
      }
    },
  },
  {
    // Summary regression: il riepilogo deve indicare che manca info di
    // display. Niente template buggati ("número número desconocido", frase
    // nonsense generica).
    name: 'ES — Caso 17 escalation summary: indica mancanza info pantalla',
    run: async (ctx) => {
      await ctx.send('La máquina no va, pero no sé qué pone')
      await ctx.send('Hortes')
      await ctx.send('Lavadora')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Hortes'])
      const lower = reply.toLowerCase()
      // Il summary deve menzionare la mancanza di display o la revisione manual.
      if (!/sin\s+informaci[oó]n|revisi[oó]n\s+manual|pantalla/.test(lower)) {
        throw new Error(`Summary non menziona mancanza display: ${reply}`)
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
