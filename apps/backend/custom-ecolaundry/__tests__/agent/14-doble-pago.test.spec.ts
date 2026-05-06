// 14 — Caso 6 doble cobro con servicio usato
//
// Da usecases.md Caso 6: il cliente ha pagato 2 volte ma è riuscito a
// usare il servizio. Il bot raccoglie i dati minimi (location, conferma
// uso, relato, ultimi 4 cifre, captura) per la revisione e devolución.
//
// Flow attuale: captura + closure + ask nome sono concentrati in un solo
// turno (più compatto del doc, ma valido).

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 6 T2: dopo location, bot chiede "podido lavar/secar" (NON pagado)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['lavar', 'secar'])
    },
  },
  {
    name: 'ES — Caso 6 T3: dopo "sí podido lavar", bot chiede paso a paso',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      const reply = await ctx.send('Sí, he lavado')
      expectMentionsAll(reply, ['paso', 'explica'])
    },
  },
  {
    name: 'ES — Caso 6 T4: dopo relato, bot chiede 4 dígitos tarjeta',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      const reply = await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      expectMentionsAll(reply, ['4', 'dig', 'tarjeta'])
    },
  },
  {
    // T5 (compatto): dopo i 4 digits, il bot chiede captura del pago
    // + dà la closure (formulario devolución) + chiede il nome.
    name: 'ES — Caso 6 T5: dopo 4 digits, bot chiede captura + closure + nome',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      const reply = await ctx.send('4821')
      expectMentionsAll(reply, ['captura', 'devoluc'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede il nome: ${reply}`)
      }
    },
  },
  {
    // T6: cliente dà il nome → escalation con summary doble cobro che
    // include il relato del cliente.
    name: 'ES — Caso 6 escalation summary: contiene location + relato cliente',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      await ctx.send('4821')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Goya', 'doble cobro'])
      // Garanzie negative: niente template buggato.
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
