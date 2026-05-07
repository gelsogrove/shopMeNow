// 04 — Flujo general
//
// Da reglas.md:
//   1. identificar el local
//   2. identificar el tipo de incidencia (lavadora o secadora)
//   3. recoger el dato mínimo crítico (numero macchina, display)
//   4. dar una instrucción simple
//   5. comprobar si ha funcionado (loopback)
//   6. si no funciona o el caso es ambiguo, escalar
//
// Test: customer parte da "no funciona la máquina" (senza dire tipo).
// Bot deve seguire l'ordine: location → tipo → numero → display → istruzione + loopback.

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — paso 1 identificar el local: T1 → bot chiede dove (lavanderia, donde)',
    run: async (ctx) => {
      const reply = await ctx.send('hola, no funciona la máquina')
      expectMentionsAll(reply, ['lavanderia', 'donde'])
    },
  },
  {
    // T2: dopo la location, il bot chiede TIPO + NUMERO combinati in un
    // solo turno (i18n key `machineTypeAndNumber`). Questo è il
    // comportamento canonico introdotto col fix di Caso 32: evita il
    // pattern "chiedo solo tipo → cliente anticipa numero → ri-chiedo
    // tipo senza ack del numero". Pinned anche unit-side da
    // __tests__/unit/force-machine-type.test.ts (case A).
    name: 'ES — paso 2 identificar tipo+numero: T2 location data → bot chiede tipo + numero combinati',
    run: async (ctx) => {
      await ctx.send('hola, no funciona la máquina')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['lavadora', 'secadora', 'numero'])
    },
  },
  {
    // T3: il cliente risponde solo col tipo ("lavadora") → autoExtract
    // setta machineType, il guard branchato chiede SOLO il numero (key
    // i18n `machineNumberWasher`). Niente ri-domanda del tipo.
    name: 'ES — paso 3 dato crítico (numero): T3 solo tipo data → bot chiede solo numero',
    run: async (ctx) => {
      await ctx.send('hola, no funciona la máquina')
      await ctx.send('Goya')
      const reply = await ctx.send('lavadora')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — paso 3b dato crítico (display): T4 numero dato → bot chiede pantalla',
    run: async (ctx) => {
      await ctx.send('hola, no funciona la máquina')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      const reply = await ctx.send('sí')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
  {
    name: 'ES — paso 4+5 instrucción + loopback: SEL → bot da istruzione e chiede se funziona',
    run: async (ctx) => {
      await ctx.send('hola, no funciona la máquina')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('sí')
      const reply = await ctx.send('SEL')
      // Istruzione case_sel + loopback "dimmi se funciona"
      expectMentionsAll(reply, ['numero', 'dime', 'funciona'])
    },
  },
  {
    name: 'ES — paso 6 escalar: ERROR (codice non doc) → bot escala con revisar',
    run: async (ctx) => {
      await ctx.send('hola, no funciona la máquina')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('sí')
      const reply = await ctx.send('ERROR')
      expectMentionsAll(reply, ['revis'])
      expectStateHas(ctx.session, { displayState: 'ERROR' })
    },
  },
]
