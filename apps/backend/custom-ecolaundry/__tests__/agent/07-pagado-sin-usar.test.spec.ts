// 12 — Caso 7 He pagado pero no he podido usar el servicio
//
// Da usecases.md Caso 7 (aggiornato con Scenario 7.1 e 7.2):
// Il cliente ha pagato ma non è riuscito a usare la macchina.
// Nuovo flow: location → tipo → numero → cambio? → display → istruzione → closure.
//
// Il bot ora raccoglie machineType e machineNumber PRIMA di chiedere il cambio.
// Il cliente può rispondere alla domanda cambio direttamente con il codice
// display (es. "PUSH PROG"), che il LLM riconosce e reindirizza al flow display.
//
// Scenario 7.1 — Happy Path: "PUSH PROG" come risposta a cambio → istruzione → "Ahora sí" → resolved.
// Scenario 7.2 — Escalación: "PUSH PROG" → istruzione → "no arranca" → re-ask codice → escalate → "desactivado".

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  {
    // T2 AGGIORNATO: ora dopo location il bot chiede il tipo macchina (NON il cambio).
    // RULE: guardPaidNotUsedAskChange spara solo dopo aver anche tipo+numero.
    name: 'ES — Caso 7 T2: dopo location, bot chiede tipo macchina (lavadora/secadora)',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      const reply = await ctx.send('Pineda')
      const lower = reply.toLowerCase()
      if (!/lavadora|secadora/.test(lower)) {
        throw new Error(`Caso 7 T2: bot deve chiedere tipo macchina, ha risposto: ${reply}`)
      }
    },
  },
  {
    // T3 AGGIORNATO: dopo tipo+numero, il bot chiede il cambio.
    // Accettiamo anche domande intermedie (machineNumber se non già dato).
    name: 'ES — Caso 7 T3: dopo tipo+numero, bot chiede cambio',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      let reply = await ctx.send('5')
      // Il bot dovrebbe chiedere il cambio. Potrebbe prima confermare il numero.
      const askedCambio = /cambio/.test(reply.toLowerCase())
      if (!askedCambio) {
        // Un turno extra se necessario
        reply = await ctx.send('sí')
        if (!/cambio/.test(reply.toLowerCase())) {
          throw new Error(`Caso 7 T3: bot non chiede cambio entro 2 turni dopo numero: ${reply}`)
        }
      }
    },
  },
  {
    // T4: dopo "PUSH PROG" come risposta alla domanda cambio, il bot deve
    // riconoscere il codice display e dare l'istruzione "puls programa".
    name: 'ES — Caso 7 T4: "PUSH PROG" come risposta a cambio → bot guida (puls programa)',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      const reply = await ctx.send('PUSH PROG')
      const lower = reply.toLowerCase()
      const isInstruction = /puls/.test(lower) && /program/.test(lower)
      const isAskingMore = /pantalla|display|qu[eé]\s+aparece/.test(lower)
      if (!isInstruction && !isAskingMore) {
        throw new Error(`Caso 7 T4: bot non guida né chiede display: ${reply}`)
      }
    },
  },
  {
    // T5 escala: dopo l'istruzione, "sigue sin responder" → escala.
    name: 'ES — Caso 7 T5 escala: "sigue sin responder" → bot escala',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      let reply = await ctx.send('PUSH PROG')
      // Il bot potrebbe chiedere display prima di dare l'istruzione
      if (!/puls.*program|program.*puls/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      reply = await ctx.send('sigue sin responder')
      // Phase B: bot may re-ask display before escalating. If so, re-confirm.
      if (/pantalla|c[oó]digo|aparece|escrib/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      expectEscalation(reply)
    },
  },
  {
    // Summary regression: deve contenere location, display PUSH, no template buggati.
    name: 'ES — Caso 7 escalation summary: corretto e contestualizzato',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      let reply = await ctx.send('PUSH PROG')
      if (!/puls.*program|program.*puls/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      reply = await ctx.send('sigue sin responder')
      // Phase B: bot may re-ask display before escalating. If so, re-confirm.
      if (/pantalla|c[oó]digo|aparece|escrib/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      // Bot now asks for the name → reply with name → handover summary.
      reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Pineda'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },

  // ── Scenario 7.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 7.1 — Happy Path completo:
    // trigger → Pineda → Lavadora → 5 → cambio? → "PUSH PROG" → istruzione → "Ahora sí" → resolved.
    // RULE: il bot raccoglie tipo+numero prima di chiedere cambio;
    // il cliente risponde con codice display anziché sì/no;
    // il bot riconosce PUSH PROG e dà l'istruzione.
    name: 'ES — Scenario 7.1: happy path completo — PUSH PROG a cambio → istruzione → resolved',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      // Il bot chiede il cambio; il cliente risponde con il codice display
      let reply = await ctx.send('PUSH PROG')
      const lower = reply.toLowerCase()
      // Il bot deve aver dato l'istruzione PUSH PROG oppure chiedere ancora display
      const isInstruction = /puls/.test(lower) && /program/.test(lower)
      const isAskingDisplay = /pantalla|display|qu[eé]\s+aparece/.test(lower)
      if (!isInstruction && !isAskingDisplay) {
        throw new Error(`Scenario 7.1: bot non guida né chiede display dopo "PUSH PROG": ${reply}`)
      }
      // Se il bot chiede ancora il display, ri-invia PUSH PROG
      if (isAskingDisplay) {
        reply = await ctx.send('PUSH PROG')
        if (!/puls.*program|program.*puls/i.test(reply)) {
          throw new Error(`Scenario 7.1: bot non dà istruzione dopo secondo PUSH PROG: ${reply}`)
        }
      }
      // Cliente conferma che funziona
      const finalReply = await ctx.send('Ahora sí')
      const finalLower = finalReply.toLowerCase()
      if (!/perfecto|perfect/.test(finalLower)) {
        throw new Error(`Scenario 7.1: bot non chiude con "perfecto": ${finalReply}`)
      }
    },
  },

  // ── Scenario 7.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 7.2 — Escalación: macchina non risponde dopo istruzione.
    // RULE: "no arranca" → bot re-chiede codice → "se ha bloqueado" →
    // bot escala chiedendo il nome → "Luis" → "desactivado".
    name: 'ES — Scenario 7.2: "no arranca" → re-ask codice → escalate + nome',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      let reply = await ctx.send('PUSH PROG')
      // Assicura che il bot abbia dato l'istruzione
      if (!/puls.*program|program.*puls/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      // Cliente dice che non parte
      reply = await ctx.send('no arranca')
      const lower = reply.toLowerCase()
      // Il bot deve chiedere il codice esatto O escalare direttamente
      const asksCode = /c[oó]digo|pantalla|aparece/.test(lower)
      const escalatesDirect = /operador|revisi[oó]n|asistencia/.test(lower)
      if (!asksCode && !escalatesDirect) {
        throw new Error(`Scenario 7.2: bot non chiede codice né escala dopo "no arranca": ${reply}`)
      }
    },
  },
  {
    // SCENARIO 7.2 — Summary operatore corretto.
    // Il riepilogo deve contenere il nome, la location, il numero macchina
    // e il display (PUSH / PUSH PROG).
    name: 'ES — Scenario 7.2: summary operatore contiene Luis, Pineda, 5, PUSH',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      let reply = await ctx.send('PUSH PROG')
      if (!/puls.*program|program.*puls/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      reply = await ctx.send('no arranca')
      // Gestisce re-ask del codice
      if (/c[oó]digo|pantalla|aparece/.test(reply.toLowerCase())) {
        reply = await ctx.send('se ha bloqueado')
      }
      // Ora il bot dovrebbe escalare e chiedere il nome
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(reply.toLowerCase())) {
        // Potrebbe aver già incluso la richiesta nome nella risposta precedente
        reply = await ctx.send('se ha bloqueado')
      }
      const summary = await ctx.send('Luis')
      expectMentionsAll(summary, ['Luis', 'Pineda', '5'])
      if (!/PUSH|push/i.test(summary)) {
        throw new Error(`Scenario 7.2: summary non menziona display PUSH: ${summary}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(summary)) {
        throw new Error(`Bug "número número" in summary: ${summary}`)
      }
    },
  },
  {
    // SCENARIO 7.2 — Conferma finale contiene "desactivado".
    name: 'ES — Scenario 7.2: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      let reply = await ctx.send('PUSH PROG')
      if (!/puls.*program|program.*puls/i.test(reply)) {
        reply = await ctx.send('PUSH PROG')
      }
      reply = await ctx.send('no arranca')
      if (/c[oó]digo|pantalla|aparece/.test(reply.toLowerCase())) {
        reply = await ctx.send('se ha bloqueado')
      }
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(reply.toLowerCase())) {
        reply = await ctx.send('se ha bloqueado')
      }
      const finalReply = await ctx.send('Luis')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 7.2: conferma finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 7.2: conferma finale non menziona "operador": ${finalReply}`)
      }
    },
  },
]
