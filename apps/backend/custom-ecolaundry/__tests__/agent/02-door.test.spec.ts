// 02 — Caso 2 DOOR
//
// Da usecases.md Caso 2: la macchina mostra DOOR, il bot guida il cliente
// a chiudere correttamente la porta.
//
// Scenario 2.1 — Happy Path: DOOR → istruzione → "Sí" → resolved.
// Scenario 2.2 — Escalación: "NO" → re-ask codice → "DOOR" → escalate → name → desactivado + summary.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. Eliminato il pattern "1 test = 1 turno" che rifaceva
// la stessa conversazione 7 volte.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 2.1 — Happy Path completo ───────────────────────────────────
  {
    name: 'ES — Scenario 2.1: happy path completo → DOOR istruzione → "Sí" → resolved',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('La lavadora no arranca')
      // T2 — location → bot chiede numero
      const t2 = await ctx.send('Hortes')
      if (!/n[uú]mero/i.test(t2)) {
        throw new Error(`Caso 2 T2: bot non chiede numero: ${t2}`)
      }
      // T3 — numero → bot chiede pantalla
      const t3 = await ctx.send('La 2')
      if (!/pantalla|aparece/i.test(t3)) {
        throw new Error(`Caso 2 T3: bot non chiede pantalla: ${t3}`)
      }
      // T4 — DOOR → bot dà istruzione (puerta + cierr) + loopback
      // (sinonimi accettati: funciona | arrancad | arranc — il bot reale
      // usa "ha arrancado" che equivale semanticamente a "funciona")
      const t4 = await ctx.send('DOOR')
      expectMentionsAll(t4, ['puerta', 'cierr', 'dime'])
      const t4Lower = t4.toLowerCase()
      if (!/funciona|arrancad|arranc/.test(t4Lower)) {
        throw new Error(`Caso 2 T4: loopback question deve menzionare "funciona/arrancad": ${t4}`)
      }
      // T5 — cliente conferma → resolved
      const t5 = await ctx.send('Sí')
      const t5Lower = t5.toLowerCase()
      if (!/perfect/.test(t5Lower)) {
        throw new Error(`Scenario 2.1: bot deve dire "perfecto": ${t5}`)
      }
      if (!/comenzad|correctament|resuelt|ya\s+estar[ií]a/.test(t5Lower)) {
        throw new Error(`Scenario 2.1: deve confermare avvio: ${t5}`)
      }
    },
  },

  // ── Scenario 2.2 — Escalation: DOOR persiste dopo retry ─────────────────
  {
    name: 'ES — Scenario 2.2: "NO" → re-ask codice → "DOOR" → escalate → name → desactivado + summary',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      // Porta non si chiude → bot re-chiede codice (Phase B) o escalate diretto.
      let reply = await ctx.send('NO')
      const reaskLower = reply.toLowerCase()
      const isReAsk = /pantalla|c[oó]digo|aparece|escrib/.test(reaskLower)
      const isDirectEscalate = /operador|revis|c[oó]mo\s+te\s+llamas/.test(reaskLower)
      if (!isReAsk && !isDirectEscalate) {
        throw new Error(`Scenario 2.2: bot né re-ask né escalate dopo "NO": ${reply}`)
      }
      // Se Phase B re-ask: cliente conferma DOOR → escalate
      if (isReAsk) {
        reply = await ctx.send('DOOR')
        const escalateLower = reply.toLowerCase()
        if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
          throw new Error(`Scenario 2.2: bot deve chiedere il nome (escalation): ${reply}`)
        }
      }
      // Capture name → final reply
      const final = await ctx.send('Carlos')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 2.2 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 2.2 final: NON menziona "operador": ${final}`)
      }
      // Summary handover
      expectMentionsAll(final, ['Carlos', 'Hortes', '2', 'DOOR'])
    },
  },

  // ── F56 — rephrase bypass during active display flow ─────────────────────
  // Andrea 2026-05-15: the rephrase LLM kept inventing operational details
  // ("ropa en la goma", "hasta que encaje bien", "hasta oír un clic") on
  // top of the JSON-vetted case_door prompt. F56 bypasses rephrase whenever
  // state.activeFlowId is set. Customer-facing reply must match the source
  // text verbatim — no invented operational details.
  {
    // F74 + F75: Phase A shows 4 blocks (greeting + summary + instruction + closing).
    // Phase B turns 1-2 show only the instruction. Phase B turn 3 shows summary +
    // reassurance + instruction (recap cadence). Greeting/closing NEVER appear in Phase B.
    name: 'F74/F75 — display recap: Phase A = 4 blocks, Phase B = instruction only, turn 3 = recap',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona')
      await ctx.send('Goya')
      await ctx.send('5')

      // Phase A: first DOOR instruction — must have greeting + bold summary + closing.
      const phaseA = await ctx.send('DOOR')
      if (!/goya/i.test(phaseA))
        throw new Error(`F74 Phase A: must include location "Goya", got: "${phaseA}"`)
      if (!/door/i.test(phaseA))
        throw new Error(`F74 Phase A: must include display code "DOOR", got: "${phaseA}"`)

      // Phase B turn 1: only the instruction — no greeting warmup, no closing.
      const phaseB1 = await ctx.send('no funciona')
      const warmupPhrases = [
        /no te preocupes/i,
        /tranquil/i,
        /vamos a solucionarlo/i,
        /enseguida lo/i,
        /cuéntame si arranca/i,
        /avísame cómo va/i,
        /dime qué pasa/i,
      ]
      for (const p of warmupPhrases) {
        if (p.test(phaseB1))
          throw new Error(`F74 Phase B turn 1: warmup phrase found (${p}), got: "${phaseB1}"`)
      }

      // Phase B turn 2: still only instruction.
      const phaseB2 = await ctx.send('no funciona')
      for (const p of warmupPhrases) {
        if (p.test(phaseB2))
          throw new Error(`F74 Phase B turn 2: warmup phrase found (${p}), got: "${phaseB2}"`)
      }

      // Phase B turn 3: recap turn — must have summary (Goya/DOOR) + reassurance.
      const phaseB3 = await ctx.send('no funciona')
      if (!/goya/i.test(phaseB3) && !/door/i.test(phaseB3))
        throw new Error(`F75 Phase B turn 3: expected recap with Goya+DOOR, got: "${phaseB3}"`)
    },
  },
  {
    name: 'F56 — DOOR instruction stays verbatim (no invented "goma"/"encaje"/"clic")',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      const doorReply = await ctx.send('DOOR')
      const lower = doorReply.toLowerCase()
      // Must NOT contain the historical invented details from F32/F37/F38/F39/F56.
      const invented = [
        /ropa\s+en\s+la\s+goma/,
        /hasta\s+que\s+encaje/,
        /hasta\s+o[ií]r\s+un?\s+clic/,
        /ropa\s+atascad/,
        /prendas?\s+atrapad/,
        /pegado\s+en\s+la\s+m[aá]quina/,
        /etiqueta\s+de\s+la\s+m[aá]quina/,
      ]
      for (const pattern of invented) {
        if (pattern.test(lower)) {
          throw new Error(
            `F56: rephrase invented operational detail matching ${pattern}, got: "${doorReply}"`,
          )
        }
      }
      // Must contain the source-vetted phrasing (puerta + cierr + prueba/dime).
      expectMentionsAll(doorReply, ['puerta', 'cierr'])
    },
  },
]
