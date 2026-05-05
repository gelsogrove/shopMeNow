// 10 — Caso 5 Error AL001
//
// Da usecases.md Caso 5: dopo aver raccolto location + tipo + numero,
// il bot emette direttamente la sequenza dei 6 passi (carga → cierra →
// paga → selecciona número → programa → avísame). Solo se il cliente
// dice che NON funziona, il bot chiede il nome ed escala ad asistencia.
//
// 5 turni: location → tipo → numero → 6-passi → conferma/non-conferma.

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
    // T4: dopo numero, il bot deve emettere direttamente i 6 passi della
    // sequenza corretta (carga → cierra → paga → número → programa →
    // avísame). NON deve escalare e NON deve chiedere "qué has hecho".
    name: 'ES — Caso 5 T4: dopo numero, bot emette i 6 passi della secuencia',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      const reply = await ctx.send('La 3')
      // Verifica menzione dei 6 passi chiave
      expectMentionsAll(reply, ['carga', 'cierra', 'paga', 'programa'])
      // Garanzia: NON deve escalare a questo step.
      const lower = reply.toLowerCase()
      if (/operador|revisi[oó]n\s+manual|c[oó]mo\s+te\s+llamas/.test(lower)) {
        throw new Error(`Caso 5 T4 non deve escalare, deve guidare i 6 passi: ${reply}`)
      }
    },
  },
  {
    // T5 happy: cliente conferma che funziona dopo i 6 passi → resolved.
    name: 'ES — Caso 5 T5 risolto: cliente "ya funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      const reply = await ctx.send('Ya funciona, gracias')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    // T5 escala: cliente dice che NON funziona dopo i 6 passi → bot escala
    // chiedendo il nome.
    name: 'ES — Caso 5 T5 escala: cliente "no funciona" → bot escala',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      const reply = await ctx.send('sigue saliendo AL001')
      const lower = reply.toLowerCase()
      // Deve indicare escalation (operador, revisión, asistencia, ...) E chiedere il nome.
      if (!/operador|revisi[oó]n|revisar|asistencia|manualmente/.test(lower)) {
        throw new Error(`Bot non escala: ${reply}`)
      }
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te|me\s+puedes\s+dar\s+tu\s+nombre/.test(lower)) {
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
