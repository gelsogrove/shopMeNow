// 01 — Caso 1 PUSH PROG
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
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso (happy /
// escalate). I checkpoint puntuali (T2 chiede numero, T3 chiede pantalla, …)
// sono asseriti DENTRO i test completi.

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 1.1 — Happy Path completo ───────────────────────────────────
  {
    name: 'ES — Scenario 1.1: happy path completo → gather → PUSH PROG → "ahora funciona" → resolved',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('La lavadora no funciona')
      // T2 — location → bot chiede numero (no step "¿has pagado?")
      const t2 = await ctx.send('Goya')
      const t2Lower = t2.toLowerCase()
      if (!/n[uú]mero/.test(t2Lower)) {
        throw new Error(`Scenario 1.1 T2: bot non chiede numero: ${t2}`)
      }
      if (/has\s+pagado|has\s+podido\s+pagar/.test(t2Lower)) {
        throw new Error(`Scenario 1.1 T2: bot NON deve chiedere "has pagado": ${t2}`)
      }
      // T3 — numero → bot chiede pantalla
      const t3 = await ctx.send('La 5')
      const t3Lower = t3.toLowerCase()
      if (!/pantalla|display/.test(t3Lower)) {
        throw new Error(`Scenario 1.1 T3: bot non chiede pantalla: ${t3}`)
      }
      // T4 — PUSH PROG → bot lista i 4 programmi + loopback
      const t4 = await ctx.send('PUSH PROG')
      const t4Lower = t4.toLowerCase()
      if (!/60[º°]|40[º°]|30[º°]|fr[ií]o|programa/.test(t4Lower)) {
        throw new Error(`Scenario 1.1 T4: bot non lista i 4 programmi: ${t4}`)
      }
      if (!/dime|d[ií]me|av[ií]same|ha\s+arrancado|funciona/.test(t4Lower)) {
        throw new Error(`Scenario 1.1 T4: bot manca loopback question: ${t4}`)
      }
      // T5 — cliente conferma → resolved
      const t5 = await ctx.send('Sí, ahora funciona')
      const t5Lower = t5.toLowerCase()
      if (!/perfect/.test(t5Lower)) {
        throw new Error(`Scenario 1.1 T5: bot deve dire "perfecto": ${t5}`)
      }
      if (!/comenzad|correctament|resuelt|ya\s+estar[ií]a/.test(t5Lower)) {
        throw new Error(`Scenario 1.1 T5: bot deve confermare chiusura: ${t5}`)
      }
      expectStateHas(ctx.session, { pendingClosure: 'resolved' })
    },
  },

  // ── Scenario 1.2 — Escalation post-instruction failure ──────────────────
  {
    name: 'ES — Scenario 1.2: cliente pulsa ma no responde → Phase B re-ask → escalate con summary',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('La 5')
      await ctx.send('PUSH PROG')
      // Cliente fallisce → bot deve chiedere conferma display (Phase B) o escalare.
      const reAsk = await ctx.send('he pulsado pero no responde')
      const reAskLower = reAsk.toLowerCase()
      const isReAsk = /c[oó]digo\s+exacto|qu[eé]\s+aparece|cu[eé]ntame|pantalla/.test(reAskLower)
      const isDirectEscalate = /operador|revis|c[oó]mo\s+te\s+llamas/.test(reAskLower)
      if (!isReAsk && !isDirectEscalate) {
        throw new Error(`Scenario 1.2: bot né re-ask né escala dopo "no responde": ${reAsk}`)
      }
      // Cliente conferma display → escalate (Phase C)
      const escalateReply = await ctx.send('PUSH PROG')
      const escalateLower = escalateReply.toLowerCase()
      if (!/c[oó]mo\s+te\s+llamas|tu\s+nombre/.test(escalateLower)) {
        throw new Error(`Scenario 1.2 escalate: bot non chiede il nome: ${escalateReply}`)
      }
      // Capture name → final reply
      const finalReply = await ctx.send('Andrea')
      const finalLower = finalReply.toLowerCase()
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 1.2 final: reply NON contiene "operador": ${finalReply}`)
      }
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 1.2 final: reply NON contiene "desactivado": ${finalReply}`)
      }
      expectMentionsAll(finalReply, ['Andrea', 'Goya', '5', 'PUSH'])
    },
  },
]
