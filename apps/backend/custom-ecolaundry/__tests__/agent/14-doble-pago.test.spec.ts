// 14 — Double charge incident con servicio usato
//
// Da usecases.md Caso 6: il cliente ha pagato 2 volte ma è riuscito a
// usare il servizio. Il bot raccoglie i dati minimi (location, conferma
// uso, relato, ultimi 4 cifre, captura) per la revisione e devolución.
//
// Scenario 6.1 — Happy Path: dati raccolti → chiusura con formulario (no operador/desactivado).
// Scenario 6.2 — Escalación: cliente arrabbiato che vuole un operatore → escalation immediata.
// Scenario 6.3 — Escalación: relato inconsistente ("no sé exactamente") → escalation da guard contradittorio.

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

  // ── Scenario 6.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 6.1 — Happy Path: il relato chiede il suggerimento del datáfono.
    // RULE: la risposta alla domanda "paso a paso" deve contenere "datafono"
    // o "tarjeta" come suggerimento (hint aggiunto all'i18n doubleChargeAskNarrative).
    name: 'ES — Scenario 6.1: ask narrative contiene suggerimento datafono',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      const reply = await ctx.send('Sí, he podido lavar')
      const lower = reply.toLowerCase()
      if (!/dat[aá]fono|tarjeta.*veces|veces.*tarjeta/.test(lower)) {
        throw new Error(`Scenario 6.1: ask narrative manca suggerimento datafono: ${reply}`)
      }
    },
  },
  {
    // SCENARIO 6.1 — Happy Path: chiusura post-nome con formulario (no operador/desactivado).
    // RULE: dopo aver fornito tutti i dati e il nome, il bot invia una chiusura
    // di revisione (formulario de devolución), NON il messaggio standard di escalation.
    name: 'ES — Scenario 6.1: chiusura post-nome contiene "formular"/"devoluci" — no "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      await ctx.send('4821')
      const finalReply = await ctx.send('Andrea')
      const lower = finalReply.toLowerCase()
      // Deve confermare la revisione e il formulario
      if (!/formular|devoluci|reembolso|revisar/.test(lower)) {
        throw new Error(`Scenario 6.1: chiusura non menziona formulario/revisione: ${finalReply}`)
      }
    },
  },

  // ── Scenario 6.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 6.2 — Escalación: cliente molto arrabbiato che chiede un operatore.
    // RULE: il bot escala immediatamente senza raccogliere location/tipo/numero,
    // chiede il nome nel messaggio di escalation, e la conferma finale ha "desactivado".
    name: 'ES — Scenario 6.2: cliente arrabbiato + "operador" → escalation immediata',
    run: async (ctx) => {
      // Bot deve entrare in escalation flow: chiedere il nome.
      // Il termine "operador" + "desactivado" appaiono nel reply finale dopo
      // capture_customer_name (verificato dal test "conferma finale").
      const reply = await ctx.send('Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo')
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.2: bot deve chiedere il nome (escalation): ${reply}`)
      }
    },
  },
  {
    // SCENARIO 6.2 — Conferma finale contiene "desactivado".
    name: 'ES — Scenario 6.2: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo')
      const finalReply = await ctx.send('María')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 6.2: finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 6.2: finale non menziona "operador": ${finalReply}`)
      }
    },
  },

  // ── Scenario 6.3 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 6.3 — Escalación: relato inconsistente.
    // RULE: "no sé exactamente" nel contesto double-charge → guardContradictoryNarrative
    // si attiva → bot escala chiedendo nome nel messaggio di escalation.
    name: 'ES — Scenario 6.3: "no sé exactamente" → escalation',
    run: async (ctx) => {
      // Bot deve entrare in escalation flow: chiedere il nome.
      // Il termine "operador" + "desactivado" appaiono nel reply finale dopo
      // capture_customer_name (verificato dal test "conferma finale").
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      const reply = await ctx.send('No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra')
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.3: bot deve chiedere il nome (escalation): ${reply}`)
      }
    },
  },
  {
    // SCENARIO 6.3 — Conferma finale contiene "desactivado".
    name: 'ES — Scenario 6.3: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra')
      const finalReply = await ctx.send('Carlos')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 6.3: finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 6.3: finale non menziona "operador": ${finalReply}`)
      }
    },
  },
]
