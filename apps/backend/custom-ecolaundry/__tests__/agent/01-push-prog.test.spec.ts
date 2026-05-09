// 11 — Caso 1 PUSH PROG
//
// Da usecases.md Caso 1: il bot guida il cliente a selezionare il programa
// dopo aver visto "PUSH PROG" sulla pantalla.
//
// Sub-scenari (allineamento con Caso 5 e Caso 7):
//   1.1 — Happy Path: cliente pulsa programa, "ahora funciona" → resolved
//   1.2 — Escalación: cliente pulsa ma máquina no responde → re-ask display
//          → escalate con "operador" → name → final con "desactivado"
//
// NOTA: come da reglas/prompt, il bot NON chiede mai "¿Has pagado?" come
// domanda standalone. Lo stato del display (PUSH PROG / SEL / DOOR) implica
// che il pago è già stato fatto.

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 1 T2: dopo location, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — Caso 1 T3: dopo numero, bot chiede display (no pago)',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      const reply = await ctx.send('La 5')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
  {
    name: 'ES — Caso 1 T4: PUSH PROG istruzione: bot dice "pulsa programa" + loopback',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      const reply = await ctx.send('PUSH PROG')
      expectMentionsAll(reply, ['program', 'puls', 'dime'])
    },
  },
  {
    name: 'ES — Caso 1 T5 risolto: cliente conferma "ahora funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      const reply = await ctx.send('Sí, ahora funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    // T5 fallimento → Phase B re-ask (uniforme con caso 5.3 / 7.2): il bot
    // chiede ri-conferma del display PRIMA di escalare. Accettiamo:
    //   - Phase B re-ask: "qué aparece en la pantalla", "código exacto"
    //   - oppure escalation diretta (legacy fallback): "revis", "operador"
    name: 'ES — Caso 1 T5 fallimento: bot fa re-ask display oppure escala',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      const reply = await ctx.send('He pulsado pero no responde')
      const lower = reply.toLowerCase()
      const isReAsk = /qu[eé]\s+aparece|c[oó]digo\s+exacto|cu[eé]ntame.*pantalla|pantalla/i.test(lower)
      const isEscalate = /revis|operador|c[oó]mo\s+te\s+llamas/i.test(lower)
      if (!isReAsk && !isEscalate) {
        throw new Error(`Caso 1 T5: bot né re-ask display né escala dopo "no responde": ${reply}`)
      }
    },
  },
  {
    // BUG REGRESSION: il riepilogo Human Support per il Caso 1 deve contenere
    // location, machineNumber e descrivere correttamente il sintomo PUSH PROG.
    // Prima del fix conteneva "número número desconocido" + "seleccionó el
    // programa pero problema técnico" (frase nonsense).
    name: 'ES — Caso 1 escalation summary: corretto e contestualizzato a PUSH PROG',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      // Phase B re-ask: bot chiede ri-conferma display.
      await ctx.send('He pulsado pero no responde')
      // Phase C: cliente conferma display → escalate.
      await ctx.send('PUSH PROG')
      // Capture name → final reply con summary.
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Goya', '5', 'PUSH'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },

  // ── Scenario 1.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 1.1 — Happy Path completo: trigger → location → numero →
    // display → istruzione → "ahora funciona" → resolved.
    // Acceptance Criteria (da usecases.md Scenario 1.1):
    //   - bot raccoglie location → numero (NO step "¿has pagado?")
    //   - bot dà i 4 programmi e chiude con loopback
    //   - su "Sí, ahora funciona" → reply contiene "perfecto" + ("resuelt"|"ya estaría")
    //   - state.pendingClosure === "resolved" a fine flow
    name: 'ES — Scenario 1.1: happy path completo → resolved con "perfecto" + "resuelt"',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      // T2: location → bot chiede numero (nessun pago intermedio)
      const r2 = await ctx.send('Goya')
      const r2Lower = r2.toLowerCase()
      if (!/n[uú]mero/i.test(r2Lower)) {
        throw new Error(`Scenario 1.1 T2: bot non chiede numero: ${r2}`)
      }
      if (/has\s+pagado|has\s+podido\s+pagar|has\s+podido\s+realizar\s+el\s+pago/i.test(r2Lower)) {
        throw new Error(`Scenario 1.1 T2: bot NON deve chiedere "has pagado": ${r2}`)
      }
      // T3: numero → bot chiede display (nessun pago intermedio)
      const r3 = await ctx.send('La 5')
      const r3Lower = r3.toLowerCase()
      if (!/pantalla|display/i.test(r3Lower)) {
        throw new Error(`Scenario 1.1 T3: bot non chiede pantalla: ${r3}`)
      }
      if (/has\s+pagado|has\s+podido\s+pagar/i.test(r3Lower)) {
        throw new Error(`Scenario 1.1 T3: bot NON deve chiedere "has pagado": ${r3}`)
      }
      // T4: PUSH PROG → bot dà i 4 programmi + loopback
      const r4 = await ctx.send('PUSH PROG')
      const r4Lower = r4.toLowerCase()
      if (!/60[º°]|40[º°]|30[º°]|fr[ií]o|programa/i.test(r4Lower)) {
        throw new Error(`Scenario 1.1 T4: bot non lista i 4 programmi: ${r4}`)
      }
      if (!/dime|d[ií]me|av[ií]same|ha\s+arrancado|funciona/i.test(r4Lower)) {
        throw new Error(`Scenario 1.1 T4: bot manca loopback question: ${r4}`)
      }
      // T5: cliente conferma → bot chiude con "perfecto" + "resuelt"/"ya estaría"
      const r5 = await ctx.send('Sí, ahora funciona')
      const r5Lower = r5.toLowerCase()
      if (!/perfect/i.test(r5Lower)) {
        throw new Error(`Scenario 1.1 T5: bot deve dire "perfecto": ${r5}`)
      }
      if (!/resuelt|ya\s+estar[ií]a/i.test(r5Lower)) {
        throw new Error(`Scenario 1.1 T5: bot deve confermare chiusura ("resuelt"/"ya estaría"): ${r5}`)
      }
      // State pin: pendingClosure deve essere "resolved" a fine flow.
      expectStateHas(ctx.session, { pendingClosure: 'resolved' })
    },
  },

  // ── Scenario 1.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 1.2 — Escalación: máquina no responde tras pulsar.
    // Acceptance Criteria (da usecases.md Scenario 1.2):
    //   - post-instruction failure: cliente dice "he pulsado pero no responde"
    //   - bot chiede ri-conferma del display (Phase B re-ask)
    //   - su conferma "PUSH PROG" → escalate (Phase C) e chiede il nome
    //   - capture name → final reply contiene "operador" + "desactivado"
    //   - summary operatore: Andrea + Goya + 5 + PUSH
    name: 'ES — Scenario 1.2: post-instruction failure → re-ask → escalate → final con "operador"+"desactivado"',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      // T5 cliente fallisce → bot deve chiedere conferma display PRIMA di escalare
      // (Phase B). Accettiamo anche una escalation diretta come fallback.
      const reAsk = await ctx.send('he pulsado pero no responde')
      const reAskLower = reAsk.toLowerCase()
      const isReAsk = /c[oó]digo\s+exacto|qu[eé]\s+aparece|cu[eé]ntame|pantalla/i.test(reAskLower)
      const isDirectEscalate = /operador|revis|c[oó]mo\s+te\s+llamas/i.test(reAskLower)
      if (!isReAsk && !isDirectEscalate) {
        throw new Error(`Scenario 1.2: bot né re-ask né escala dopo "no responde": ${reAsk}`)
      }
      // Cliente conferma il display → escala (Phase C)
      const escalateReply = await ctx.send('PUSH PROG')
      const escalateLower = escalateReply.toLowerCase()
      // Phase C reply: deve chiedere il nome (eventualmente con "revis"/"manualmente").
      if (!/c[oó]mo\s+te\s+llamas|tu\s+nombre|me\s+puedes\s+(?:decir|dar)\s+tu\s+nombre/i.test(escalateLower)) {
        throw new Error(`Scenario 1.2 escalate: bot non chiede il nome: ${escalateReply}`)
      }
      // T capture name → final reply LLM-generato + summary deterministico.
      // AC sacri: "operador" + "desactivado" nel final reply (uniforme con 5.2/7.2).
      const finalReply = await ctx.send('Andrea')
      const finalLower = finalReply.toLowerCase()
      if (!/operador/i.test(finalLower)) {
        throw new Error(`Scenario 1.2 final: reply NON contiene "operador": ${finalReply}`)
      }
      if (!/desactivado/i.test(finalLower)) {
        throw new Error(`Scenario 1.2 final: reply NON contiene "desactivado": ${finalReply}`)
      }
      // Summary contiene info chiave: Andrea, Goya, 5, PUSH.
      expectMentionsAll(finalReply, ['Andrea', 'Goya', '5', 'PUSH'])
    },
  },
]
