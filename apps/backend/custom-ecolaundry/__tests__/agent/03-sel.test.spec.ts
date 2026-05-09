// 03 — Caso 3 SEL
//
// Da usecases.md Caso 3: la macchina mostra SEL, il bot guida il cliente
// a comprobar che ha pulsato bien el numero della macchina alla central de pago.
//
// Scenario 3.1 — Happy Path: SEL → istruzione → "Ahora sí funciona" → resolved.
// Scenario 3.2 — Escalación: "Aun no arranca" → re-ask → "SEL" → escalate → name → desactivado + summary.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. Eliminato il pattern "1 test = 1 turno" che rifaceva
// la stessa conversazione 10 volte.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 3.1 — Happy Path completo ───────────────────────────────────
  {
    name: 'ES — Scenario 3.1: happy path completo → SEL istruzione → "Ahora sí funciona" → resolved',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('He pagado pero la lavadora no empieza')
      // T2 — location → bot chiede numero
      const t2 = await ctx.send('Pineda')
      if (!/n[uú]mero/i.test(t2)) {
        throw new Error(`Caso 3 T2: bot non chiede numero: ${t2}`)
      }
      // T3 — numero → bot chiede pantalla
      const t3 = await ctx.send('La 3')
      if (!/pantalla|aparece/i.test(t3)) {
        throw new Error(`Caso 3 T3: bot non chiede pantalla: ${t3}`)
      }
      // T4 — SEL → bot dà istruzione (numero + maquina)
      const t4 = await ctx.send('SEL')
      expectMentionsAll(t4, ['numero', 'maquina'])
      // T5 — cliente conferma → resolved
      const t5 = await ctx.send('Ahora sí funciona')
      const t5Lower = t5.toLowerCase()
      if (!/perfect/.test(t5Lower)) {
        throw new Error(`Scenario 3.1: bot deve dire "perfecto": ${t5}`)
      }
      if (!/comenzad|correctament|resuelt|ya\s+estar[ií]a/.test(t5Lower)) {
        throw new Error(`Scenario 3.1: deve confermare avvio: ${t5}`)
      }
    },
  },

  // ── Scenario 3.2 — Escalation: SEL persiste dopo retry ──────────────────
  {
    name: 'ES — Scenario 3.2: "Aun no arranca" → re-ask → "SEL" → escalate → name → desactivado + summary',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      // Macchina non parte → bot re-chiede codice (Phase B) o escalate diretto.
      let reply = await ctx.send('Aun no arranca')
      const reaskLower = reply.toLowerCase()
      const isReAsk = /pantalla|c[oó]digo|aparece|escrib/.test(reaskLower)
      const isDirectEscalate = /operador|revis|c[oó]mo\s+te\s+llamas/.test(reaskLower)
      if (!isReAsk && !isDirectEscalate) {
        throw new Error(`Scenario 3.2: bot né re-ask né escalate dopo "Aun no arranca": ${reply}`)
      }
      // Se Phase B re-ask: cliente conferma SEL → escalate
      if (isReAsk) {
        reply = await ctx.send('SEL')
        const escalateLower = reply.toLowerCase()
        if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
          throw new Error(`Scenario 3.2: bot deve chiedere il nome (escalation): ${reply}`)
        }
      }
      // Capture name → final reply
      const final = await ctx.send('Luis')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 3.2 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 3.2 final: NON menziona "operador": ${final}`)
      }
      // Summary handover
      expectMentionsAll(final, ['Luis', 'Pineda', '3', 'SEL'])
      // Garanzie negative
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },
]
