// 17 — Caso 13 + Caso 16 (ALN — alarma generica)
//
// ALN è un codice generico di allarme. La doc lo categorizza in:
//   - Caso 13 (escalado por código de alarma o incoherencia, paraguas)
//   - Caso 16 (la máquina muestra ALM/ALN o similar, specifico)
// Entrambi convergono al medesimo flow: gather location → tipo → numero,
// poi escalate con messaggio canonico "necesitamos revisarlo manualmente".
// Da reglas.md "Datos mínimos en incidencias de máquina": local + tipo +
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
