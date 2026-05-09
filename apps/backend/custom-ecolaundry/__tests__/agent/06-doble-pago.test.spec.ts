// 06 — Caso 6 Doble cobro
//
// Da usecases.md Caso 6: il cliente è stato addebitato 2 volte. Gather
// order canonico (Andrea 2026-05-09 — Caso 6 reorder):
//   1. location              (forceLocation, da T1)
//   2. ¿podido lavar/secar?  (guardDoubleChargeAskUsed, dopo location)
//   3a. yes branch → tipo → número → relato → 4 dígitos → captura → name (6.1)
//   3b. no  branch → escalation immediata (6.4)
//
// UX rationale: a customer who got charged twice without being able to
// wash is doubly frustrated. Asking machine details before knowing if
// they got the service felt like burocracia. The "no" path skips
// tipo/número (operator collects them on the phone if needed).
//
// Scenari coperti:
//   6.1 — Happy Path (Sí): full path → handover summary "habiendo podido"
//   6.2 — Cliente arrabbiato: rage + operador → escalate immediato
//          (boundary signal handled by guardAngryCustomerExplicit, NEW)
//   6.3 — Relato contradittorio: "no sé exactamente" → escalation
//   6.4 — NO branch: cliente non ha potuto usare → escalate sin tipo/numero
//   6.5A — Validación 4 dígitos: 5 cifre → re-ask → 4 cifre → continua
//   6.5B — 2 risposte invalide → escalate
//   Bug A — typo "habieis cobrado" → flusso parte (regression test)
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. Eliminato il pattern "1 test = 1 turno" che rifaceva
// la stessa conversazione 20 volte.

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 6.1 — Happy Path completo (Sí branch end-to-end) ────────────
  {
    name: 'ES — Scenario 6.1: happy path completo → Sí → tipo → número → 4 dígitos → handover',
    run: async (ctx) => {
      // T1 — trigger → bot chiede LOCATION (NO improvisation, NO podido-ask first)
      const t1 = await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      const t1Lower = t1.toLowerCase()
      if (!/lavander[ií]a|d[oó]nde\s+est[aá]s/.test(t1Lower)) {
        throw new Error(`Caso 6 T1: bot deve chiedere location: ${t1}`)
      }
      if (/podido\s+(?:lavar|secar)/.test(t1Lower)) {
        throw new Error(`Caso 6 T1: bot non deve saltare a "podido" prima della location: ${t1}`)
      }
      // T2 — location → bot chiede "¿podido lavar/secar?" (NO tipo/numero)
      const t2 = await ctx.send('Goya')
      const t2Lower = t2.toLowerCase()
      if (!/podido\s+(?:lavar|secar)/.test(t2Lower)) {
        throw new Error(`Caso 6 T2 (new order): bot deve chiedere "¿podido lavar/secar?": ${t2}`)
      }
      if (/lavadora\s+o\s+(?:una\s+)?secadora/i.test(t2Lower)) {
        throw new Error(`Caso 6 T2: bot NON deve chiedere tipo prima di "¿podido?": ${t2}`)
      }
      // T3 — Sí branch → bot chiede TIPO macchina
      const t3 = await ctx.send('Sí, he lavado')
      if (!/lavadora|secadora/i.test(t3)) {
        throw new Error(`Caso 6 T3 (Sí): bot deve chiedere tipo: ${t3}`)
      }
      // T4 — tipo → bot chiede NUMERO
      const t4 = await ctx.send('lavadora')
      if (!/n[uú]mero/i.test(t4)) {
        throw new Error(`Caso 6 T4: bot deve chiedere numero: ${t4}`)
      }
      // T5 — numero → bot chiede paso a paso + datáfono hint
      const t5 = await ctx.send('5')
      expectMentionsAll(t5, ['paso', 'explica'])
      const t5Lower = t5.toLowerCase()
      if (!/dat[aá]fono|tarjeta.*veces|veces.*tarjeta/.test(t5Lower)) {
        throw new Error(`Caso 6 T5: reply must include datáfono / multi-card hint: ${t5}`)
      }
      // T6 — relato → bot chiede 4 dígitos tarjeta
      const t6 = await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      expectMentionsAll(t6, ['4', 'dig', 'tarjeta'])
      // T7 — 4 dígitos → bot chiede captura + nome
      const t7 = await ctx.send('4821')
      expectMentionsAll(t7, ['captura', 'devoluc'])
      const t7Lower = t7.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(t7Lower)) {
        throw new Error(`Caso 6 T7: bot non chiede il nome: ${t7}`)
      }
      // T8 — name → final REFUND-FORM closure (NOT operator handover).
      // usecases.md §6.1 riga 627: "El mensaje final NO menciona 'operador'
      // ni 'desactivado': no es una escalación a un humano en vivo, es un
      // trámite de devolución."
      const final = await ctx.send('Andrea')
      // Final must include the customer's name (LLM uses it in the closing).
      expectMentionsAll(final, ['Andrea'])
      const finalLower = final.toLowerCase()
      // Closure must mention formulario/devolución/reembolso/revisar.
      if (!/formular|devoluci|reembolso|revisar/.test(finalLower)) {
        throw new Error(`Scenario 6.1: chiusura deve menzionare formulario/revisione: ${final}`)
      }
      // Negative assertions: refund path, no handover artefacts.
      if (/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 6.1: finale NON deve contenere "desactivado" (è refund, non handover): ${final}`)
      }
      if (/operador/.test(finalLower)) {
        throw new Error(`Scenario 6.1: finale NON deve menzionare "operador" (è refund, non handover): ${final}`)
      }
      if (/human\s+support/i.test(final)) {
        throw new Error(`Scenario 6.1: finale NON deve contenere "Human Support message": ${final}`)
      }
      // Garanzie negative: niente template buggato.
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },

  // ── Scenario 6.2 — Cliente arrabbiato + chiede operador → escalate immediato
  {
    // Boundary signal: rage + explicit operator request → guardAngryCustomerExplicit
    // fires BEFORE forceLocation, so the bot escalates without asking
    // location. NEW guard 2026-05-09 — see angry-customer.ts unit test.
    name: 'ES — Scenario 6.2: "muy enfadado + quiero operador" → escalate immediato + name + desactivado',
    run: async (ctx) => {
      // T1 — rage marker + explicit operator request → asks name (escalation)
      const t1 = await ctx.send('Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo')
      const t1Lower = t1.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(t1Lower)) {
        throw new Error(`Scenario 6.2 T1: bot deve escalare e chiedere nome: ${t1}`)
      }
      // Bot must NOT ask location when rage+operator is explicit. Match the
      // *question* pattern, not the literal word "lavandería" (which appears
      // in the welcome string "asistente virtual de la lavandería").
      if (/¿\s*(?:en\s+qu[eé]|d[oó]nde\s+est[aá]s|cu[aá]l\s+lavander[ií]a)/i.test(t1)) {
        throw new Error(`Scenario 6.2 T1: bot non deve chiedere location dopo rage+operator: ${t1}`)
      }
      // T2 — name → final handover with desactivado
      const final = await ctx.send('María')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 6.2 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 6.2 final: NON menziona "operador": ${final}`)
      }
    },
  },

  // ── Scenario 6.3 — Relato contradittorio (post Sí branch) → escalation ───
  {
    name: 'ES — Scenario 6.3: relato contradittorio → escalate → name → desactivado',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he podido lavar')
      await ctx.send('lavadora')
      await ctx.send('5')
      // Relato vago + tres-o-cuatro veces → bot escala (contradictory narrative)
      const escalate = await ctx.send('No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra')
      const escalateLower = escalate.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 6.3: bot deve chiedere il nome (escalation): ${escalate}`)
      }
      // usecases.md riga 688: "El bot no sigue pidiendo dígitos de tarjeta
      // ni captura: el operador necesita revisarlo manualmente."
      if (/4\s*d[ií]gitos|captura\s+del\s+pago/.test(escalateLower)) {
        throw new Error(`Scenario 6.3: bot NON deve chiedere 4 dígitos / captura dopo escalation: ${escalate}`)
      }
      // Final reply
      const final = await ctx.send('Carlos')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 6.3 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 6.3 final: NON menziona "operador": ${final}`)
      }
    },
  },

  // ── Scenario 6.4 — NO branch (escalation senza tipo/numero) ──────────────
  {
    // NEW (Andrea 2026-05-09): on "no, no he podido" the bot escalates
    // IMMEDIATELY after location, without asking tipo or número. The
    // customer is doubly frustrated and the operator collects machine
    // info on the phone.
    name: 'ES — Scenario 6.4: "no he podido" → escalate sin tipo/numero → summary "no ha podido usar"',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      // Cliente non ha potuto usare → bot escala (chiede nome), NO tipo ask.
      const escalate = await ctx.send('no, no he podido')
      const escalateLower = escalate.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 6.4: "no" deve attivare escalation immediata: ${escalate}`)
      }
      if (/lavadora\s+o\s+(?:una\s+)?secadora/i.test(escalateLower)) {
        throw new Error(`Scenario 6.4: bot NON deve chiedere tipo dopo "no": ${escalate}`)
      }
      expectEscalation(escalate)
      // Final summary: nome + location + marker, NO machineLabel.
      const final = await ctx.send('Carlos')
      expectMentionsAll(final, ['Carlos', 'Goya', 'doble cobro'])
      const finalLower = final.toLowerCase()
      if (!/no\s+ha\s+podido\s+usar\s+el\s+servicio|servicio no prestado|no\s+pude\s+usar/i.test(finalLower)) {
        throw new Error(`Scenario 6.4 summary deve segnalare "no service used": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 6.4 final: NON menziona "operador": ${final}`)
      }
    },
  },

  // ── Scenario 6.5A — Validación 4 dígitos: 5 cifre → re-ask → 4 cifre OK ──
  {
    name: 'ES — Scenario 6.5A: 5 dígitos (inválido) → re-ask → 4 dígitos válidos → flujo continúa',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      // 5 cifre (invalido) → bot deve chiedere di riscrivere
      const retry = await ctx.send('48215')
      const retryLower = retry.toLowerCase()
      if (!/exactamente|4 d[ií]gitos|d[ií]gitos\s+de\s+la\s+tarjeta/.test(retryLower)) {
        throw new Error(`Scenario 6.5A: bot deve chiedere di riscrivere i 4 dígitos: ${retry}`)
      }
      // 4 cifre valide → flusso continua con captura
      const ok = await ctx.send('4821')
      const okLower = ok.toLowerCase()
      if (!/captura|devoluci/.test(okLower)) {
        throw new Error(`Scenario 6.5A: dopo 4 cifras válidas il bot deve chiedere captura: ${ok}`)
      }
    },
  },

  // ── Scenario 6.5B — 2 risposte invalide consecutive → escalation ─────────
  {
    name: 'ES — Scenario 6.5B: 2 risposte invalide consecutive → escalate → name → desactivado',
    run: async (ctx) => {
      await ctx.send('Me habéis cobrado dos veces con la tarjeta')
      await ctx.send('Goya')
      await ctx.send('Sí, he lavado')
      await ctx.send('lavadora')
      await ctx.send('5')
      await ctx.send('He pagado, no iba y volví a pasar la tarjeta')
      // 1° invalido (3 cifre)
      await ctx.send('482')
      // 2° invalido (no cifre) → escala
      const escalate = await ctx.send('no me acuerdo')
      const escalateLower = escalate.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 6.5B: dopo 2 fail il bot deve chiedere il nome: ${escalate}`)
      }
      // Final reply
      const final = await ctx.send('Andrea')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 6.5B final: deve contenere "desactivado": ${final}`)
      }
    },
  },

  // ── Bug A regression — typo "habieis" must trigger the flow ──────────────
  {
    // Andrea 2026-05-09: real chat showed the bot ignored "me habieis cobrado
    // dos veces con la tarjeda" because the original regex required the
    // canonical verb "habéis" (no extra `i`). The detector now drops the
    // verb-prefix requirement.
    name: 'ES — Bug A regression: typo "habieis cobrado" → bot avvia il flusso (chiede location)',
    run: async (ctx) => {
      const reply = await ctx.send('me habieis cobrado dos veces con la tarjeda')
      const lower = reply.toLowerCase()
      if (!/lavander[ií]a|d[oó]nde\s+est[aá]s/.test(lower)) {
        throw new Error(`Bug A regression: typo deve far partire il flusso (location ask): ${reply}`)
      }
    },
  },
]
