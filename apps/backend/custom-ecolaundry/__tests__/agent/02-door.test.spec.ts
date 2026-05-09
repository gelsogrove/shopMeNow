// 07 — Caso 2 DOOR
//
// Da usecases.md Caso 2: la macchina mostra DOOR, il bot guida il cliente
// a chiudere correttamente la porta.
//
// Scenario 2.1 — Happy Path: DOOR → istruzione → "Sí" → resolved.
// Scenario 2.2 — Escalación: "NO" → re-ask codice → "DOOR" → case_door_persist → nome → "desactivado".

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 2 DOOR risolto: cliente conferma "ahora sí funciona" → bot chiude (perfect, resuelt)',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      const reply = await ctx.send('ahora sí funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    name: 'ES — Caso 2 DOOR istruzione: bot dice di aprire e chiudere la puerta + loopback',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      const reply = await ctx.send('DOOR')
      // Istruzione (puerta + cerrar) + loopback (dimmi se la macchina parte).
      // Accettiamo sinonimi spagnoli per "works/has started" — `funciona` o
      // `arrancad`/`arranc` (Andrea-2026-05-09 audit: il bot reale usa "ha
      // arrancado" che semanticamente equivale a "funciona").
      expectMentionsAll(reply, ['puerta', 'cierr', 'dime'])
      const lower = reply.toLowerCase()
      if (!/funciona|arrancad|arranc/i.test(lower)) {
        throw new Error(
          `loopback question must mention "funciona" OR "arrancad/arranc", got: ${reply}`,
        )
      }
    },
  },
  {
    name: 'ES — Caso 2 DOOR escalation: cliente ripete e dice "sigue sin arrancar" → bot escala',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      let reply = await ctx.send('sigue sin arrancar')
      // Phase B: bot may re-ask display before escalating. If so, re-confirm.
      if (/pantalla|c[oó]digo|aparece|escrib/i.test(reply)) {
        reply = await ctx.send('DOOR')
      }
      // Concept-level: escalation reached.
      expectEscalation(reply)
    },
  },

  // ── Scenario 2.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 2.1 — Happy Path completo:
    // trigger → Hortes → La 2 → DOOR → istruzione → "Sí" → resolved.
    // RULE: il bot chiude con "perfecto" + "correctamente"/"comenzado".
    name: 'ES — Scenario 2.1: happy path completo → resolved con "perfecto" + "correctamente"',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')  // bot dà istruzione + chiede se ha funzionato
      const finalReply = await ctx.send('Sí')
      const lower = finalReply.toLowerCase()
      if (!/perfecto|perfect/.test(lower)) {
        throw new Error(`Scenario 2.1: bot deve dire "perfecto": ${finalReply}`)
      }
      if (!/comenzad|correctament|resuelt/.test(lower)) {
        throw new Error(`Scenario 2.1: deve confermare avvio ("comenzado"/"correctamente"/"resuelto"): ${finalReply}`)
      }
    },
  },

  // ── Scenario 2.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 2.2 — Escalación: DOOR persiste dopo aver ripetuto il passo.
    // RULE: "NO" → bot re-chiede codice esatto (followup_display) →
    // "DOOR" → case_door_persist → ESCALATION (chiede nome).
    // Il display token "puerta"/"DOOR" + "operador" appaiono nel handover
    // summary FINALE, non nel reply intermedio (che è il template generico
    // reaffirmEscalate + customerNameAsk). Vedi test "summary operatore".
    name: 'ES — Scenario 2.2: "NO" → re-ask codice → "DOOR" → escalate',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')  // bot dà istruzione
      // Porta non si chiude → check_result NO → followup_display (re-ask codice)
      const reaskReply = await ctx.send('NO')
      const reaskLower = reaskReply.toLowerCase()
      if (!/pantalla|c[oó]digo|aparece|escrib/.test(reaskLower)) {
        throw new Error(`Scenario 2.2: bot deve ri-chiedere il codice esatto: ${reaskReply}`)
      }
      // Cliente ri-invia DOOR → escalation: bot deve chiedere il nome.
      // (Il display token + "operador" appaiono nel summary handover finale.)
      const escalateReply = await ctx.send('DOOR')
      const escalateLower = escalateReply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 2.2: bot deve chiedere il nome (escalation): ${escalateReply}`)
      }
    },
  },
  {
    // SCENARIO 2.2 — Conferma finale contiene "desactivado".
    name: 'ES — Scenario 2.2: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      let reply = await ctx.send('NO')
      // Se ha già escalato direttamente (senza re-ask), salta il re-ask
      if (/pantalla|c[oó]digo|aparece|escrib/.test(reply.toLowerCase())) {
        reply = await ctx.send('DOOR')
      }
      const finalReply = await ctx.send('Carlos')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 2.2: finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 2.2: finale non menziona "operador": ${finalReply}`)
      }
    },
  },
  {
    // SCENARIO 2.2 — Summary operatore corretto.
    // Il riepilogo deve contenere nome, location, numero macchina e DOOR.
    name: 'ES — Scenario 2.2: summary operatore contiene Carlos, Hortes, 2, DOOR',
    run: async (ctx) => {
      await ctx.send('La lavadora no arranca')
      await ctx.send('Hortes')
      await ctx.send('La 2')
      await ctx.send('DOOR')
      let reply = await ctx.send('NO')
      if (/pantalla|c[oó]digo|aparece|escrib/.test(reply.toLowerCase())) {
        reply = await ctx.send('DOOR')
      }
      const summary = await ctx.send('Carlos')
      expectMentionsAll(summary, ['Carlos', 'Hortes', '2', 'DOOR'])
    },
  },
]
