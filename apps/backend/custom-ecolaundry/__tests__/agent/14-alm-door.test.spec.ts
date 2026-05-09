// 18 — Caso 14 ALM DOOR
//
// Da usecases.md Caso 14: ALM DOOR.
// Bot prima dà istruzione "abre con cuidado, revisa prendas atrapadas, ciérrala".
// Loopback: "dime si el mensaje ha desaparecido".
// Se NO desaparecido → escala con "vamos a pasar tu caso a revisión".

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 14 ALM DOOR istruzione: bot dice "abre puerta, revisa prendas atrapadas"',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      const reply = await ctx.send('La 6')
      expectMentionsAll(reply, ['puerta', 'prend', 'cierr'])
    },
  },
  {
    name: 'ES — Caso 14 ALM DOOR escalation: cliente dice "no desaparece" → bot escala',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      await ctx.send('La 6')
      await ctx.send('Ya lo he hecho')
      const reply = await ctx.send('No, no desaparece')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
  {
    // T1: dopo il trigger ALM DOOR, il bot saluta e chiede location (NON
    // escala subito, NON salta a "qué número").
    name: 'ES — Caso 14 T1: bot saluta + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('La lavadora no funciona y pone ALM DOOR')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    // Path felice: dopo il retry, cliente dice "sí ha desaparecido" → bot
    // chiude resolved.
    name: 'ES — Caso 14 happy path: "sí ha desaparecido" → bot chiude',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      await ctx.send('La 6')
      await ctx.send('Ya lo he hecho')
      const reply = await ctx.send('Sí, ha desaparecido')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    // Summary regression: il riepilogo deve menzionare ALM DOOR e descrivere
    // il sintomo (no template buggati).
    name: 'ES — Caso 14 escalation summary: corretto e contestualizzato a ALM DOOR',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      await ctx.send('La 6')
      await ctx.send('Ya lo he hecho')
      await ctx.send('No, no desaparece')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Goya', '6'])
      const lower = reply.toLowerCase()
      if (!/alm.*door|door.*alm|puerta/.test(lower)) {
        throw new Error(`Summary non contiene ALM DOOR né puerta: ${reply}`)
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
