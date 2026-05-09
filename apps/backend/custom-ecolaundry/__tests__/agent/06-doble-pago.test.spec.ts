// 14 — Caso 6 Doble cobro
//
// Da usecases.md Caso 6: il cliente è stato addebitato 2 volte. Due
// scenari principali:
//   6.1 — Happy Path: ha potuto usare il servizio → tipo + número +
//          relato + 4 dígitos + captura → escalation con summary
//          "habiendo podido usar el servicio".
//   6.4 — NON ha potuto usare il servizio → escalation immediata, NO
//          tipo/número, summary con "PERO NO ha podido usar el servicio".
//
// Gather order canonico (NEW, Andrea 2026-05-09 — Caso 6 reorder):
//   1. location              (forceLocation, da T1)
//   2. ¿podido lavar/secar?  (guardDoubleChargeAskUsed, subito dopo location)
//   3a. yes branch → tipo → número → relato → 4 dígitos → captura → name (6.1)
//   3b. no  branch → escalation immediata (6.4)
//
// Why this order: a customer who got charged twice without being able to
// wash is doubly frustrated. Asking machine details before knowing if they
// got the service felt like burocracia. The "no" path now skips tipo/número
// (operator collects them on the phone if needed).
//
// Scenario 6.2 — Cliente arrabbiato → escalation immediata.
// Scenario 6.3 — Relato contradittorio → escalation.
// Scenario 6.5 — Validazione 4 dígitos.

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Gather order T1-T2 (deterministic, pre-branch) ─────────────────────────
  {
    name: 'ES — Caso 6 T1: trigger "cobrado dos veces" → bot welcome + chiede LOCATION',
    run: async (ctx) => {
      const reply = await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      // Iron rule #10: a T1 il bot deve chiedere location, NON improvvisare.
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
    // NEW order (Andrea 2026-05-09): subito dopo location il bot chiede
    // "¿has podido lavar/secar?", NON tipo/numero. Il tipo/numero arrivano
    // solo nel ramo Sí.
    name: 'ES — Caso 6 T2: dopo location, bot chiede "¿podido lavar/secar?" (NO tipo/numero)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      const reply = await ctx.send('Goya')
      const lower = reply.toLowerCase()
      if (!/podido\s+(?:lavar|secar)/.test(lower)) {
        throw new Error(`T2 (new order): bot deve chiedere "¿podido lavar/secar?": ${reply}`)
      }
      // Must NOT pre-emptively ask for tipo/numero before knowing if the
      // customer used the service.
      if (/lavadora\s+o\s+(?:una\s+)?secadora/i.test(lower)) {
        throw new Error(`T2 (new order): bot NON deve chiedere tipo prima di "¿podido?": ${reply}`)
      }
    },
  },

  // ── Branch SÍ (Scenario 6.1) — tipo → numero → relato → digits ────────────
  {
    name: 'ES — Caso 6 T3 (Sí): bot chiede TIPO macchina',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      const reply = await ctx.send('Sí, he podido lavar')
      const lower = reply.toLowerCase()
      if (!/lavadora|secadora/.test(lower)) {
        throw new Error(`T3 (Sí branch): bot deve chiedere tipo macchina: ${reply}`)
      }
    },
  },
  {
    name: 'ES — Caso 6 T4 (Sí): dopo tipo, bot chiede NUMERO macchina',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      const reply = await ctx.send('lavadora')
      const lower = reply.toLowerCase()
      if (!/n[uú]mero/.test(lower)) {
        throw new Error(`T4: bot deve chiedere numero: ${reply}`)
      }
    },
  },
  {
    name: 'ES — Caso 6 T5 (Sí): dopo numero, bot chiede paso a paso + datáfono hint',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      const reply = await ctx.send('5')
      expectMentionsAll(reply, ['paso', 'explica'])
      const lower = reply.toLowerCase()
      if (!/dat[aá]fono|tarjeta.*veces|veces.*tarjeta/.test(lower)) {
        throw new Error(`T5: reply must include datáfono / multi-card hint: ${reply}`)
      }
    },
  },
  {
    name: 'ES — Caso 6 T6 (Sí): dopo relato, bot chiede 4 dígitos tarjeta',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      await ctx.send('5')
      const reply = await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      expectMentionsAll(reply, ['4', 'dig', 'tarjeta'])
    },
  },
  {
    name: 'ES — Caso 6 T7 (Sí): dopo 4 digits, bot chiede captura + nome',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      const reply = await ctx.send('4821')
      expectMentionsAll(reply, ['captura', 'devoluc'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede il nome: ${reply}`)
      }
    },
  },

  // ── Scenario 6.1 — Happy Path full (Sí branch end-to-end) ────────────────
  {
    name: 'ES — Scenario 6.1: full Sí path → handover summary "habiendo podido usar"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
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
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
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

  // ── Scenario 6.3 — Relato contradittorio (post Sí branch) ────────────────
  {
    name: 'ES — Scenario 6.3: "no sé exactamente" → escalation',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      await ctx.send('5')
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
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      await ctx.send('5')
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

  // ── Scenario 6.4 — NO branch (escalation immediata, NO tipo/numero) ──────
  {
    // NEW (Andrea 2026-05-09): on "no" the bot escalates IMMEDIATELY after
    // location, without asking tipo or número. The customer is doubly
    // frustrated and the operator collects machine info on the phone.
    name: 'ES — Scenario 6.4: cliente "no" subito dopo location → escalation senza chiedere tipo/numero',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      const reply = await ctx.send('no, no he podido')
      const lower = reply.toLowerCase()
      // Bot must enter escalation flow (asks for name) — no tipo/numero ask,
      // no narrative gather, no 4-digits ask.
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.4: "no" must trigger immediate escalation (asks name): ${reply}`)
      }
      if (/lavadora\s+o\s+(?:una\s+)?secadora/i.test(lower)) {
        throw new Error(`Scenario 6.4 (new order): bot NON deve chiedere tipo dopo "no": ${reply}`)
      }
      expectEscalation(reply)
    },
  },
  {
    name: 'ES — Scenario 6.4: handover summary contiene "no ha podido usar el servicio" (no machineLabel)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('no, no he podido')
      const summary = await ctx.send('Carlos')
      // Operator brief must mention name + location + 6.4 marker. The
      // machine label is intentionally absent — operator collects it on
      // the phone if needed.
      expectMentionsAll(summary, ['Carlos', 'Goya', 'doble cobro'])
      const lower = summary.toLowerCase()
      if (!/no\s+ha\s+podido\s+usar\s+el\s+servicio|servicio no prestado|no\s+pude\s+usar/i.test(lower)) {
        throw new Error(`Scenario 6.4 summary must flag "no service used": ${summary}`)
      }
    },
  },
  {
    name: 'ES — Scenario 6.4: conferma finale contiene "operador" (handover)',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('no, no he podido')
      const finalReply = await ctx.send('Carlos')
      const lower = finalReply.toLowerCase()
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 6.4: finale non menziona "operador": ${finalReply}`)
      }
    },
  },

  // ── Scenario 6.5 — Validación de los 4 dígitos (Sí branch only) ──────────
  {
    // Cliente da 5 cifras → re-ask → da 4 cifras válidas → flujo continúa.
    // Note: i 4 dígitos arrivano nel Sí branch, dopo tipo+numero+relato.
    name: 'ES — Scenario 6.5A: 5 dígitos (inválido) → re-ask → 4 dígitos válidos → flujo continúa',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      // Cifre invalide (5 cifre)
      const retry = await ctx.send('48215')
      const lower = retry.toLowerCase()
      if (!/exactamente|4 d[ií]gitos|d[ií]gitos\s+de\s+la\s+tarjeta/.test(lower)) {
        throw new Error(`Scenario 6.5A: bot deve chiedere di riscrivere i 4 dígitos: ${retry}`)
      }
      // Cifre valide (4 cifre) → flusso continua con captura/devolución
      const ok = await ctx.send('4821')
      const okLower = ok.toLowerCase()
      if (!/captura|devoluci/.test(okLower)) {
        throw new Error(`Scenario 6.5A: dopo 4 cifras válidas il bot deve chiedere captura: ${ok}`)
      }
    },
  },
  {
    // 2 risposte invalide consecutive → escalation immediata.
    name: 'ES — Scenario 6.5B: 2 risposte invalide consecutive → escalation',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      // 1° invalido (3 cifre)
      await ctx.send('482')
      // 2° invalido (no cifre)
      const escalate = await ctx.send('no me acuerdo')
      const lower = escalate.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 6.5B: dopo 2 fail il bot deve chiedere il nome: ${escalate}`)
      }
    },
  },
  {
    name: 'ES — Scenario 6.5B: conferma finale tras escalation contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      await ctx.send('482') // 1° invalido
      await ctx.send('no me acuerdo') // 2° invalido → escala
      const finalReply = await ctx.send('Andrea')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 6.5B finale: deve contenere "desactivado": ${finalReply}`)
      }
    },
  },

  // ── Bug A regression: typo "habieis" must trigger the flow ──────────────
  {
    // Andrea 2026-05-09: real chat showed the bot ignored "me habieis cobrado
    // dos veces con la tarjeda" because the original regex required the
    // canonical verb "habéis" (no extra `i`). The detector now drops the
    // verb-prefix requirement.
    name: 'ES — Bug A: typo "habieis cobrado" → bot avvia il flusso doble cobro',
    run: async (ctx) => {
      const reply = await ctx.send('me habieis cobrado dos veces con la tarjeda')
      const lower = reply.toLowerCase()
      if (!/lavander[ií]a|d[oó]nde\s+est[aá]s/.test(lower)) {
        throw new Error(`Bug A regression: typo deve far partire il flusso (location ask): ${reply}`)
      }
    },
  },
]
