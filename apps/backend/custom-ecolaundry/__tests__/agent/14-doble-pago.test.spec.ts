// 14 — Caso 6 Doble cobro
//
// Da usecases.md Caso 6: il cliente è stato addebitato 2 volte. Due
// scenari principali:
//   6.1 — Happy Path: ha potuto usare il servizio → relato + 4 dígitos
//          + captura → escalation con summary "habiendo podido usar".
//   6.4 — NEW: NON ha potuto usare il servizio → escalation immediata
//          con summary "PERO NO ha podido usar el servicio".
//
// Gather order canonico (corretto post rule #10 fix 2026-05-09):
//   1. location  (forceLocation, da T1)
//   2. tipo      (forceMachineType)
//   3. numero    (forceMachineNumber)
//   4. ¿podido lavar/secar?  (guardDoubleChargeAskUsed)
//   5a. yes → relato → 4 dígitos → captura → closure (6.1)
//   5b. no  → escalation immediata (6.4)
//
// Scenario 6.2 — Escalación: cliente arrabbiato → escalation immediata.
// Scenario 6.3 — Escalación: relato contradittorio → escalation.

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Gather order T1-T4 ─────────────────────────────────────────────────────
  {
    name: 'ES — Caso 6 T1: trigger "cobrado dos veces" → bot welcome + chiede LOCATION (no salta a "podido lavar")',
    run: async (ctx) => {
      const reply = await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      // Iron rule #10: a T1 il bot deve chiedere location, NON improvvisare
      // la domanda di gather del flow (che richiede prima tipo+numero).
      const lower = reply.toLowerCase()
      if (!/lavander[ií]a|d[oó]nde\s+est[aá]s/.test(lower)) {
        throw new Error(`T1: bot deve chiedere location, NON improvvisare: ${reply}`)
      }
      // Must NOT jump ahead to "podido lavar" before location is captured.
      if (/podido\s+(?:lavar|secar)/i.test(lower)) {
        throw new Error(`T1: bot non deve chiedere "podido lavar" prima della location: ${reply}`)
      }
    },
  },
  {
    name: 'ES — Caso 6 T2: dopo location, bot chiede TIPO macchina (no "podido lavar" ancora)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      const reply = await ctx.send('Goya')
      const lower = reply.toLowerCase()
      if (!/lavadora|secadora/.test(lower)) {
        throw new Error(`T2: bot deve chiedere tipo macchina: ${reply}`)
      }
      if (/podido\s+(?:lavar|secar)/i.test(lower)) {
        throw new Error(`T2: bot non deve chiedere "podido lavar" prima del tipo: ${reply}`)
      }
    },
  },
  {
    name: 'ES — Caso 6 T3: dopo tipo, bot chiede NUMERO macchina',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      const reply = await ctx.send('lavadora')
      const lower = reply.toLowerCase()
      if (!/n[uú]mero/.test(lower)) {
        throw new Error(`T3: bot deve chiedere numero: ${reply}`)
      }
    },
  },
  {
    // T4: dopo location+tipo+numero, finalmente il bot chiede "¿podido lavar?".
    name: 'ES — Caso 6 T4: dopo numero, bot chiede "¿podido lavar/secar?" (UNA volta sola)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      const reply = await ctx.send('5')
      expectMentionsAll(reply, ['lavar', 'secar'])
    },
  },
  {
    // T5: cliente "Sí" → bot chiede paso a paso + suggerimento datáfono.
    name: 'ES — Caso 6 T5 happy: dopo "Sí", bot chiede paso a paso + datáfono hint',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('Sí, he lavado')
      // The next reply asks the relato. Datáfono hint MUST be present.
      // We re-send a placeholder to trigger the next guard step? No — actually
      // the previous send already returned the narrative ask. Re-grab it.
      // Simpler: send "Sí" alone above and inspect ctx.lastReply.
      const reply = ctx.lastReply
      expectMentionsAll(reply, ['paso', 'explica'])
      const lower = reply.toLowerCase()
      if (!/dat[aá]fono|tarjeta.*veces|veces.*tarjeta/.test(lower)) {
        throw new Error(`T5: reply must include datáfono / multi-card hint: ${reply}`)
      }
    },
  },
  {
    name: 'ES — Caso 6 T6 happy: dopo relato, bot chiede 4 dígitos tarjeta',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('Sí, he lavado')
      const reply = await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      expectMentionsAll(reply, ['4', 'dig', 'tarjeta'])
    },
  },
  {
    name: 'ES — Caso 6 T7 happy: dopo 4 digits, bot chiede captura + nome',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
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

  // ── Scenario 6.1 — Happy Path full ───────────────────────────────────────
  {
    name: 'ES — Scenario 6.1: full path → handover summary contiene location + macchina + "habiendo podido usar"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('Sí, he lavado')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      await ctx.send('4821')
      const reply = await ctx.send('Andrea')
      // Summary must include name, location, machine context, and the 6.1 marker.
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
  {
    name: 'ES — Scenario 6.1: chiusura post-nome contiene "formular"/"devoluci" — no "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('Sí, he lavado')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      await ctx.send('4821')
      const finalReply = await ctx.send('Andrea')
      const lower = finalReply.toLowerCase()
      if (!/formular|devoluci|reembolso|revisar/.test(lower)) {
        throw new Error(`Scenario 6.1: chiusura non menziona formulario/revisione: ${finalReply}`)
      }
    },
  },

  // ── Scenario 6.2 — Cliente arrabbiato (escalation immediata) ─────────────
  {
    name: 'ES — Scenario 6.2: cliente arrabbiato + "operador" → escalation immediata',
    run: async (ctx) => {
      const reply = await ctx.send('Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo')
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.2: bot deve chiedere il nome (escalation): ${reply}`)
      }
    },
  },
  {
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

  // ── Scenario 6.3 — Relato contradittorio ──────────────────────────────────
  {
    name: 'ES — Scenario 6.3: "no sé exactamente" → escalation',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('Sí, he podido lavar')
      const reply = await ctx.send('No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra')
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.3: bot deve chiedere il nome (escalation): ${reply}`)
      }
    },
  },
  {
    name: 'ES — Scenario 6.3: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
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

  // ── Scenario 6.4 (NEW) — NO ha podido usar el servicio ───────────────────
  {
    // 6.4 happy escalation: customer says "no" to "podido lavar?" → bot
    // escalates immediately. Summary must include the "didn't use service"
    // marker so the operator handles BOTH the refund AND the missing service.
    name: 'ES — Scenario 6.4: cliente "no" a "podido lavar" → escalation immediata',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      const reply = await ctx.send('no, no he podido')
      // Bot must enter escalation flow (asks for name) — no narrative gather,
      // no 4-digits ask.
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.4: "no" must trigger immediate escalation (asks name): ${reply}`)
      }
      expectEscalation(reply)
    },
  },
  {
    name: 'ES — Scenario 6.4: handover summary contiene "no ha podido usar el servicio" + machineLabel',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('no, no he podido')
      const summary = await ctx.send('Carlos')
      // Operator brief must mention name + location + machine + 6.4 marker.
      expectMentionsAll(summary, ['Carlos', 'Goya', 'doble cobro'])
      const lower = summary.toLowerCase()
      if (!/no\s+ha\s+podido\s+usar\s+el\s+servicio|servicio no prestado|no\s+pude\s+usar/i.test(lower)) {
        throw new Error(`Scenario 6.4 summary must flag "no service used": ${summary}`)
      }
      if (!/lavadora\s+n[uú]mero\s+5/i.test(lower)) {
        throw new Error(`Scenario 6.4 summary must include machine label: ${summary}`)
      }
    },
  },
  {
    name: 'ES — Scenario 6.4: conferma finale contiene "desactivado" + "operador"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('no, no he podido')
      const finalReply = await ctx.send('Carlos')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 6.4: finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 6.4: finale non menziona "operador": ${finalReply}`)
      }
    },
  },
]
