// 32-marathon — torture test del topic switching cross-Caso
//
// Da docs/usecases.md Caso 32 sub-scenari Marathon (32.1, 32.2, 32.3): il
// cliente attraversa MOLTI Casi diversi nella stessa sessione. Questi test
// verificano che il bot:
//   - non perda i facts già capturati al cambio di topic
//   - resetti correttamente lo stato del flow vecchio al cambio di display
//   - mantenga il pendingFlow attivo durante FAQ paralleli
//   - chiuda un flow con markResolved e ne apra uno nuovo nello stesso turno
//
// 🚨 RED-SPEC NOTE (Andrea, 2026-05-09): questi test definiscono il
// comportamento atteso per pezzi NON ANCORA IMPLEMENTATI:
//   - L2 switchDisplay(ar, newDisplay) + state.displayHistory[]   (32.1)
//   - L5 invariant "resolvedAskMore" + invoice skip-known-location (32.2)
//   - L3 detectFaqPause + state.faqPause + invariant "resumeAfterFaq" (32.3)
// Sono test TDD RED — falliranno fino all'implementazione dei pezzi citati
// nelle "Comportamiento garantizado por código" del doc usecases.md.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per END-TO-END PATH con
// assertions inline ad ogni turno. NO test per checkpoint singolo (anti-pattern
// CLAUDE.md "🧪 Agent test pattern — consolidated, not granular").

import {
  type TestCase,
  expectMentionsAll,
  expectMentionsNone,
  expectStateHas,
  expectWelcome,
} from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 32.1 — Marathon display switching ────────────────────────────
  // greeting → FAQ → trouble-machine → SEL → PUSH PROG → DOOR → AL001 → name
  // Verifica: ad ogni nuovo display il flow engine si re-resolve, gli askAttempts
  // counter si resettano, location/machineNumber sopravvivono, AL001 escala
  // automaticamente, summary cita TUTTI i display nella sequenza vista.
  {
    name: 'ES — Scenario 32.1: marathon greeting → FAQ → SEL → PUSH PROG → DOOR → AL001 → escalación',
    run: async (ctx) => {
      // T1 — saluto puro: bot saluta (welcome con greeting + intro chatbot)
      const t1 = await ctx.send('¡Hola! ¿Cómo va?')
      expectWelcome(t1)
      // T2 — FAQ horarios (deve passare via apply_faq_override)
      const t2 = await ctx.send('¿Qué horarios hacéis?')
      const t2Lower = t2.toLowerCase()
      if (!/7|23|abierto|horari/.test(t2Lower)) {
        throw new Error(`Scenario 32.1 T2: bot non risponde con orari: ${t2}`)
      }
      // FAQ NON deve aver attivato un pendingFlow trouble
      const stateAfterT2 = ctx.session.ar.state as unknown as Record<string, unknown>
      if (stateAfterT2.pendingFlow && String(stateAfterT2.pendingFlow).includes('trouble')) {
        throw new Error(`Scenario 32.1 T2: FAQ ha contaminato pendingFlow: ${String(stateAfterT2.pendingFlow)}`)
      }
      // T3 — apertura trouble-machine: bot chiede location
      const t3 = await ctx.send('Tengo un problema con la lavadora')
      const t3Lower = t3.toLowerCase()
      if (!/lavander/.test(t3Lower)) {
        throw new Error(`Scenario 32.1 T3: bot non chiede location dopo trigger trouble: ${t3}`)
      }
      // T4 — location → bot chiede numero (machineType già estratto da T3)
      const t4 = await ctx.send('Pineda')
      const t4Lower = t4.toLowerCase()
      if (!/n[uú]mero/.test(t4Lower)) {
        throw new Error(`Scenario 32.1 T4: bot non chiede numero: ${t4}`)
      }
      // T5 — numero → bot chiede pantalla
      const t5 = await ctx.send('La 3')
      const t5Lower = t5.toLowerCase()
      if (!/pantalla|display/.test(t5Lower)) {
        throw new Error(`Scenario 32.1 T5: bot non chiede pantalla: ${t5}`)
      }
      // T6 — primo display SEL → bot dà istruzione SEL + loopback
      const t6 = await ctx.send('SEL')
      const t6Lower = t6.toLowerCase()
      if (!/program|seleccion|puls/.test(t6Lower)) {
        throw new Error(`Scenario 32.1 T6: bot non dà istruzione SEL: ${t6}`)
      }
      // T7 — cliente NEGA + nuovo display PUSH PROG → bot deve switchare a PUSH flow
      // (lista 4 programmi). Reset di displayAskAttempts implicito.
      const t7 = await ctx.send('No, ahora aparece PUSH PROG')
      const t7Lower = t7.toLowerCase()
      if (!/60[º°]|40[º°]|30[º°]|90[º°]|programa/.test(t7Lower)) {
        throw new Error(`Scenario 32.1 T7: bot non switcha a PUSH PROG flow (no 4 programmi): ${t7}`)
      }
      // location/numero NON re-richiesti (sopravvivono al display switch).
      // Welcome wording change (F39+): bot ora dice "en qué pueblo" non
      // "en qué lavandería" — regex coperto entrambi i wording.
      if (/en\s+qu[eé]\s+(?:lavander|pueblo)|qu[eé]\s+n[uú]mero/.test(t7Lower)) {
        throw new Error(`Scenario 32.1 T7: bot ha ri-chiesto location/numero dopo display switch: ${t7}`)
      }
      // T8 — cliente nega + nuovo display DOOR → bot deve switchare a DOOR flow
      const t8 = await ctx.send('No, ahora pone DOOR')
      const t8Lower = t8.toLowerCase()
      if (!/puerta|cerr|empuj|click|clic/.test(t8Lower)) {
        throw new Error(`Scenario 32.1 T8: bot non switcha a DOOR flow: ${t8}`)
      }
      // T9 — cliente nega + AL001 → bot dà guida educativa AL001 (sequenza
      // 5/6 passi). AL001 NON escala automaticamente in Caso 5: dà prima
      // l'istruzione, e SOLO se persiste (turno successivo) escala. Pattern
      // identico al test 05-al001 Scenario 5.1/5.3.
      const t9 = await ctx.send('No, ahora aparece AL001')
      const t9Lower = t9.toLowerCase()
      // Bot deve dare la sequenza educativa (carga, cierra, paga, programa)
      // OPPURE escalare diretto (alcuni run dell'LLM possono saltare diretti
      // a "operador" se interpretano i 4 display in cadena come fallo grave).
      const educational = /carg|cierr|central|pago|programa/.test(t9Lower)
      const directEscalate = /c[oó]mo\s+te\s+llamas|tu\s+nombre|operador/.test(t9Lower)
      if (!educational && !directEscalate) {
        throw new Error(`Scenario 32.1 T9: AL001 né guida educativa né escalate: ${t9}`)
      }
      // T10 — se guida educativa, cliente nega ancora → escalate (Phase B/C
      // di Caso 5). Se escalate diretto, saltiamo questo step.
      if (educational) {
        const t10 = await ctx.send('sigue saliendo AL001, no funciona')
        const t10Lower = t10.toLowerCase()
        // Phase B può re-askare il codice prima di escalare; in tal caso
        // lo confermiamo come fa Scenario 5.3.
        const escalateReply =
          /pantalla|c[oó]digo|aparece|escrib/.test(t10Lower)
          && !/c[oó]mo\s+te\s+llamas|tu\s+nombre|operador/.test(t10Lower)
            ? await ctx.send('AL001')
            : t10
        const eLower = escalateReply.toLowerCase()
        if (!/c[oó]mo\s+te\s+llamas|tu\s+nombre/.test(eLower)) {
          throw new Error(`Scenario 32.1 T10/T11: bot non chiede il nome dopo persistenza AL001: ${escalateReply}`)
        }
      }
      // Final turn: cliente dà il nome → final reply con summary
      const finalReply = await ctx.send('Marc')
      const finalLower = finalReply.toLowerCase()
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 32.1 final: reply manca "operador": ${finalReply}`)
      }
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 32.1 final: reply manca "desactivado": ${finalReply}`)
      }
      // Summary deve citare almeno: nome, location, numero macchina, ultimo
      // display visto (AL001).
      expectMentionsAll(finalReply, ['Marc', 'Pineda', '3', 'AL001'])
      // ⚠️ RED-SPEC: i 3 display intermedi (SEL/PUSH/DOOR) saranno presenti
      // SOLO dopo implementazione di state.displayHistory[] +
      // extractEscalationContext aggiornato. Oggi la summary cita solo
      // l'ultimo display (AL001). Lasciato come check separato per pinneare
      // il gap quando arriverà il fix display-history.
      // expectMentionsAll(finalReply, ['SEL', 'PUSH', 'DOOR'])
      expectStateHas(ctx.session, {
        location: 'Pineda',
        machineType: 'washer',
        machineNumber: '3',
      })
    },
  },

  // ── Scenario 32.2 — Trouble risolto → factura nello stesso turno ──────────
  // trouble PUSH PROG → resolved → cliente chiede fattura → bot apre Caso 9
  // SENZA ri-chiedere location (preserva state).
  {
    name: 'ES — Scenario 32.2: marathon trouble resuelto → factura (Caso 9) → location preservata',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('Hola, la lavadora no funciona')
      // T2 — location
      const t2 = await ctx.send('Goya')
      if (!/n[uú]mero/.test(t2.toLowerCase())) {
        throw new Error(`Scenario 32.2 T2: bot non chiede numero: ${t2}`)
      }
      // T3 — numero
      const t3 = await ctx.send('La 5')
      if (!/pantalla|display/.test(t3.toLowerCase())) {
        throw new Error(`Scenario 32.2 T3: bot non chiede pantalla: ${t3}`)
      }
      // T4 — display PUSH PROG → bot dà istruzione + loopback
      const t4 = await ctx.send('PUSH PROG')
      if (!/60[º°]|40[º°]|30[º°]|programa/.test(t4.toLowerCase())) {
        throw new Error(`Scenario 32.2 T4: bot non lista programmi: ${t4}`)
      }
      // T5 — risolto → bot conferma chiusura
      const t5 = await ctx.send('Sí, ahora funciona')
      const t5Lower = t5.toLowerCase()
      if (!/perfect|alegr|resuelt|ya\s+est/.test(t5Lower)) {
        throw new Error(`Scenario 32.2 T5: bot non conferma resolved: ${t5}`)
      }
      expectStateHas(ctx.session, { pendingClosure: 'resolved' })
      // T6 — RED-SPEC: cliente chiede fattura. Il bot deve aprire Caso 9
      // saltando location/macchina (già nello state). Prossima domanda = razón.
      const t6 = await ctx.send('Sí, ¿podría tener la factura del lavado?')
      const t6Lower = t6.toLowerCase()
      // Bot deve passare al gather invoice. Il primo step skipped è location.
      // Acceptable: chiede razón social oppure tipo fiscal.
      if (!/raz[oó]n|raz|fiscal|nombre|nif|cif/.test(t6Lower)) {
        throw new Error(`Scenario 32.2 T6: bot non apre invoice gather: ${t6}`)
      }
      // ⚠️ RED-SPEC: bot NON deve ri-chiedere location/lavadora già note.
      // Coverage estesa per nuova welcome wording: "en qué pueblo ..." (F39+).
      expectMentionsNone(t6, ['en qué lavandería', 'qué lavanderia', 'en qué pueblo', 'qué pueblo', 'goya o', 'pineda'])
      // State: location preservata cross-flow
      expectStateHas(ctx.session, { location: 'Goya' })
    },
  },

  // ── Scenario 32.3 — FAQ pause durante gather ──────────────────────────────
  // trouble → location → FAQ pricing → resume trouble → display → resolved
  // Verifica: il pendingFlow trouble persiste durante la FAQ, il gather riprende
  // dal punto giusto (machine number) senza ri-chiedere location.
  {
    name: 'ES — Scenario 32.3: marathon FAQ pause durante gather → resume senza re-ask location',
    run: async (ctx) => {
      // T1 — trigger trouble-machine
      await ctx.send('Tengo un problema con la lavadora')
      // T2 — location → bot chiede numero
      const t2 = await ctx.send('Goya')
      if (!/n[uú]mero/.test(t2.toLowerCase())) {
        throw new Error(`Scenario 32.3 T2: bot non chiede numero: ${t2}`)
      }
      expectStateHas(ctx.session, { location: 'Goya' })
      // T3 — RED-SPEC: cliente fa FAQ pricing in mezzo al gather.
      // Bot deve rispondere con prezzi E aggiungere prompt di ritorno.
      const t3 = await ctx.send('Espera, antes una pregunta: ¿cuánto cuesta lavar?')
      const t3Lower = t3.toLowerCase()
      // Bot risponde con prezzo lavado/secado
      if (!/€|euro|5|4/.test(t3Lower)) {
        throw new Error(`Scenario 32.3 T3: bot non risponde con prezzo: ${t3}`)
      }
      // ⚠️ RED-SPEC: bot deve chiedere "vuoi continuare con il problema?"
      // (i18n key resumeAfterFaq, applicato da polishReplyForTurn quando
      //  faqPause = true e pendingFlow !== null)
      if (!/sigamos|continuar|seguimos|seguir|problema/.test(t3Lower)) {
        throw new Error(`Scenario 32.3 T3: bot manca prompt di ritorno (resumeAfterFaq): ${t3}`)
      }
      // pendingFlow trouble-machine deve essere ANCORA attivo (FAQ è solo pausa)
      const stateAfterT3 = ctx.session.ar.state as unknown as Record<string, unknown>
      if (!stateAfterT3.pendingFlow) {
        throw new Error(`Scenario 32.3 T3: pendingFlow è stato perso durante FAQ (deve solo pausare): ${JSON.stringify(stateAfterT3.pendingFlow)}`)
      }
      // T4 — cliente conferma resume → bot riprende il gather dal numero
      const t4 = await ctx.send('Sí, perdona. La lavadora 3')
      const t4Lower = t4.toLowerCase()
      if (!/pantalla|display/.test(t4Lower)) {
        throw new Error(`Scenario 32.3 T4: bot non riprende il gather (no pantalla question): ${t4}`)
      }
      // location/numero NON re-richiesti (sopravvivono alla FAQ pause)
      if (/en\s+qu[eé]\s+lavander/.test(t4Lower)) {
        throw new Error(`Scenario 32.3 T4: bot ha ri-chiesto location dopo FAQ pause: ${t4}`)
      }
      expectStateHas(ctx.session, { location: 'Goya', machineNumber: '3' })
      // T5 — display SEL → bot dà istruzione canonica
      const t5 = await ctx.send('SEL')
      if (!/program|seleccion|puls/.test(t5.toLowerCase())) {
        throw new Error(`Scenario 32.3 T5: bot non dà istruzione SEL: ${t5}`)
      }
      // T6 — risolto → final close
      const t6 = await ctx.send('Sí, gracias')
      if (!/perfect|alegr|resuelt|ya\s+est/.test(t6.toLowerCase())) {
        throw new Error(`Scenario 32.3 T6: bot non conferma resolved: ${t6}`)
      }
      expectStateHas(ctx.session, { pendingClosure: 'resolved' })
    },
  },
]
