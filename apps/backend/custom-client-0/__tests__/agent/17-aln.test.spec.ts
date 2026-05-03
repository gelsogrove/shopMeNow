// 17 — Caso 13 ALN (alarma)
//
// Da 01usecaases.md Caso 13: cliente dice "He pagado y ahora sale ALN".
// Il bot deve raccogliere i dati minimi (local + tipo + numero) e poi
// escalare con frase canonica "necesitamos revisarlo manualmente".
// Da 02reglas.md "Datos mínimos en incidencias de máquina": local + tipo +
// numero + display sono obbligatori.

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 13 ALN T1: bot saluta + chiede location (NON escala subito)',
    run: async (ctx) => {
      const reply = await ctx.send('He pagado y ahora sale ALN')
      expectMentionsAll(reply, ['hola', 'lavanderia', 'donde'])
    },
  },
  {
    name: 'ES — Caso 13 ALN T2 location: bot chiede tipo (NON escala ancora)',
    run: async (ctx) => {
      await ctx.send('He pagado y ahora sale ALN')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['lavadora', 'secadora'])
    },
  },
  {
    name: 'ES — Caso 13 ALN T3 tipo: bot chiede numero (NON escala ancora)',
    run: async (ctx) => {
      await ctx.send('He pagado y ahora sale ALN')
      await ctx.send('Goya')
      const reply = await ctx.send('lavadora')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — Caso 13 ALN T4 numero: bot escala con "revisar" e chiede nome',
    run: async (ctx) => {
      await ctx.send('He pagado y ahora sale ALN')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      const reply = await ctx.send('5')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
  {
    name: 'ES — Caso 13 ALN handover: state ha location/tipo/numero/display popolati',
    run: async (ctx) => {
      await ctx.send('He pagado y ahora sale ALN')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('Andrea')
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '5',
        displayState: 'ALN',
        customerName: 'Andrea',
      })
    },
  },
]
