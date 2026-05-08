// 08 — Caso 3 SEL
//
// Da usecases.md Caso 3: la macchina mostra SEL, il bot guida il cliente
// a comprobar che ha pulsato bien el numero della macchina o el programa.
// 5 turni: location → numero → display → istruzione → closure.
//
// Scenario 3.1 — Happy Path: SEL → istruzione → "Ahora sí funciona" → resolved.
// Scenario 3.2 — Escalación: "Aun no arranca" → re-ask codice → "SEL" → escalate → nome → "desactivado".

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 3 T2: dopo location, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    name: 'ES — Caso 3 T3: dopo numero, bot chiede display',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      const reply = await ctx.send('La 3')
      expectMentionsAll(reply, ['pantalla'])
    },
  },
  {
    name: 'ES — Caso 3 T4 SEL istruzione: "pendiente de selección" + chiede di premere il numero',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      const reply = await ctx.send('SEL')
      expectMentionsAll(reply, ['numero', 'maquina'])
    },
  },
  {
    name: 'ES — Caso 3 T5 risolto: cliente conferma "ahora sí funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      const reply = await ctx.send('ya lo he hecho y ahora sí funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    name: 'ES — Caso 3 T5 escala: cliente ripete e dice "sigue igual" → bot escala',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      let reply = await ctx.send('ya lo he hecho pero sigue igual')
      // Phase B: bot may re-ask display before escalating. If so, re-confirm.
      if (/pantalla|c[oó]digo|aparece|escrib/i.test(reply)) {
        reply = await ctx.send('SEL')
      }
      expectEscalation(reply)
    },
  },
  {
    // BUG REGRESSION: il riepilogo Human Support per il Caso 3 deve contenere
    // location, machineNumber e descrivere correttamente il sintomo SEL.
    // Verifica che il summary sia contestualizzato (no "número número
    // desconocido", no frase nonsense generica).
    name: 'ES — Caso 3 escalation summary: corretto e contestualizzato a SEL',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      let reply = await ctx.send('ya lo he repetido pero sigue sin responder')
      // Phase B: bot may re-ask display before escalating. If so, re-confirm.
      if (/pantalla|c[oó]digo|aparece|escrib/i.test(reply)) {
        reply = await ctx.send('SEL')
      }
      // Now bot has escalated and is asking for the name. Provide it →
      // handover summary contains all context.
      const summary = await ctx.send('Andrea')
      expectMentionsAll(summary, ['Andrea', 'Pineda', '3', 'SEL'])
      if (/n[uú]mero\s+n[uú]mero/i.test(summary)) {
        throw new Error(`Bug "número número" presente: ${summary}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(summary)) {
        throw new Error(`Frase nonsense presente: ${summary}`)
      }
    },
  },

  // ── Scenario 3.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 3.1 — Happy Path completo:
    // trigger → Pineda → La 3 → SEL → istruzione → "Ahora sí funciona" → resolved.
    // RULE: dopo l'istruzione SEL, il cliente conferma che funziona;
    // il bot chiude con "perfecto" + "comenzado"/"correctamente".
    name: 'ES — Scenario 3.1: happy path completo → resolved con "comenzado"/"correctamente"',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')  // bot dà istruzione + chiede se ha funzionato
      const finalReply = await ctx.send('Ahora sí funciona')
      const lower = finalReply.toLowerCase()
      if (!/perfecto|perfect/.test(lower)) {
        throw new Error(`Scenario 3.1: bot deve dire "perfecto": ${finalReply}`)
      }
      if (!/comenzad|correctament|resuelt/.test(lower)) {
        throw new Error(`Scenario 3.1: deve confermare avvio ("comenzado"/"correctamente"/"resuelto"): ${finalReply}`)
      }
    },
  },

  // ── Scenario 3.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 3.2 — Escalación: macchina non risponde dopo istruzione SEL.
    // RULE: "Aun no arranca" → bot re-chiede codice esatto (followup_display) →
    // "SEL" → bot escala menzionando "SEL" + "operador" → chiede nome →
    // nome → reply finale contiene "desactivado".
    name: 'ES — Scenario 3.2: "Aun no arranca" → re-ask codice → "SEL" → escalate',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')  // bot dà istruzione
      // Macchina non parte → check_result NO → followup_display (re-ask codice)
      const reaskReply = await ctx.send('Aun no arranca')
      const reaskLower = reaskReply.toLowerCase()
      if (!/pantalla|c[oó]digo|aparece|escrib/.test(reaskLower)) {
        throw new Error(`Scenario 3.2: bot deve ri-chiedere il codice esatto: ${reaskReply}`)
      }
      // Cliente ri-invia SEL → escalation: bot deve chiedere il nome.
      // (Il display token "SEL" + "operador" appaiono nel summary handover finale.)
      const escalateReply = await ctx.send('SEL')
      const escalateLower = escalateReply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 3.2: bot deve chiedere il nome (escalation): ${escalateReply}`)
      }
    },
  },
  {
    // SCENARIO 3.2 — Conferma finale contiene "desactivado".
    name: 'ES — Scenario 3.2: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      let reply = await ctx.send('Aun no arranca')
      // Se ha già escalato direttamente (senza re-ask), salta
      if (/pantalla|c[oó]digo|aparece|escrib/.test(reply.toLowerCase())) {
        reply = await ctx.send('SEL')
      }
      const finalReply = await ctx.send('Luis')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 3.2: finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 3.2: finale non menziona "operador": ${finalReply}`)
      }
    },
  },
  {
    // SCENARIO 3.2 — Summary operatore corretto.
    // Il riepilogo deve contenere nome, location, numero macchina e SEL.
    name: 'ES — Scenario 3.2: summary operatore contiene Luis, Pineda, 3, SEL',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      let reply = await ctx.send('Aun no arranca')
      if (/pantalla|c[oó]digo|aparece|escrib/.test(reply.toLowerCase())) {
        reply = await ctx.send('SEL')
      }
      const summary = await ctx.send('Luis')
      expectMentionsAll(summary, ['Luis', 'Pineda', '3', 'SEL'])
      if (/n[uú]mero\s+n[uú]mero/i.test(summary)) {
        throw new Error(`Bug "número número" in summary: ${summary}`)
      }
    },
  },
]
