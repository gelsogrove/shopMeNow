// 05 — Caso 5 Error AL001
//
// Da usecases.md Caso 5: dopo aver raccolto location + tipo + numero,
// il bot emette direttamente la sequenza dei 6 passi (carga → cierra →
// paga → selecciona número → programa → avísame). Solo se il cliente
// dice che NON funziona, il bot chiede il nome ed escala ad asistencia.
//
// Scenario 5.1 — Happy Path: "ya funciona" → resolved.
// Scenario 5.2 — Escalación sin entender: "no entiendo" → escalate → name → desactivado.
// Scenario 5.3 — Error persiste: "sigue saliendo" → re-ask code → "AL001" → escalate → name → desactivado + summary.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. Eliminato il pattern "1 test = 1 turno".

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 5.1 — Happy Path completo ───────────────────────────────────
  {
    name: 'ES — Scenario 5.1: happy path completo → 6 pasos secuencia → "ya funciona" → resolved',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('Me sale AL001')
      // T2 — location → bot chiede tipo
      const t2 = await ctx.send("L'Escala")
      expectMentionsAll(t2, ['lavadora', 'secadora'])
      // T3 — tipo → bot chiede numero
      const t3 = await ctx.send('Lavadora')
      if (!/n[uú]mero/i.test(t3)) {
        throw new Error(`Caso 5 T3: bot non chiede numero: ${t3}`)
      }
      // T4 — numero → bot emette i 6 passi della secuencia
      const t4 = await ctx.send('3')
      const t4Lower = t4.toLowerCase()
      // I 6 passi devono essere riconoscibili: carga, cerrar puerta, central pago,
      // numero, programa, avisar
      if (!/carg/.test(t4Lower) || !/cierr|cerrad/.test(t4Lower) || !/central|pago/.test(t4Lower)) {
        throw new Error(`Caso 5 T4: secuencia 6 pasos incompleta: ${t4}`)
      }
      if (!/programa/.test(t4Lower) || !/avisa|d[íi]me|funciona/.test(t4Lower)) {
        throw new Error(`Caso 5 T4: secuencia 6 pasos manca programa/avísame: ${t4}`)
      }
      // T5 — cliente conferma → resolved
      const t5 = await ctx.send('Sí, ya funciona')
      const t5Lower = t5.toLowerCase()
      if (!/perfect/.test(t5Lower)) {
        throw new Error(`Scenario 5.1: bot deve dire "perfecto": ${t5}`)
      }
      if (!/comenzad|correctament|resuelt|ya\s+estar[ií]a/.test(t5Lower)) {
        throw new Error(`Scenario 5.1: deve confermare avvio: ${t5}`)
      }
    },
  },

  // ── Scenario 5.2 — Cliente non capisce → escalate ────────────────────────
  {
    // Cliente non capisce le istruzioni e chiede esplicitamente un operatore.
    // Il LLM è non-deterministic: a volte re-asks display invece di escalate
    // diretto. Insistiamo con secondo turno se necessario (questo simula la
    // realtà: cliente che chiede operatore dopo prima risposta del bot).
    name: 'ES — Scenario 5.2: cliente non capisce + chiede operador → escalate → name → desactivado',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      // Cliente esprime esplicitamente di non riuscire e di voler operatore
      let r = await ctx.send('No entiendo nada, necesito que un operador me ayude')
      let rLower = r.toLowerCase()
      const escalatesNow = /c[oó]mo\s+te\s+llamas|tu\s+nombre|operador|revis|manualmente/.test(rLower)
      if (!escalatesNow) {
        // Bot ha re-askato altro (es. display) — il cliente insiste
        r = await ctx.send('No entiendo, quiero hablar con un operador humano por favor')
        rLower = r.toLowerCase()
        if (!/c[oó]mo\s+te\s+llamas|tu\s+nombre|operador|revis|manualmente/.test(rLower)) {
          throw new Error(`Scenario 5.2: bot non escala dopo 2 richieste operador: ${r}`)
        }
      }
      // Capture name → final reply
      const final = await ctx.send('Marco')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 5.2 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 5.2 final: NON menziona "operador": ${final}`)
      }
    },
  },

  // ── Scenario 5.3 — Errore persiste → re-ask → escalate + summary ──────
  {
    name: 'ES — Scenario 5.3: "sigue saliendo" → re-ask → "AL001" → escalate → name → desactivado + summary',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      // Cliente segue le istruzioni ma errore persiste
      let reply = await ctx.send('sigue saliendo AL001')
      const reaskLower = reply.toLowerCase()
      const isReAsk = /pantalla|c[oó]digo|aparece|escrib/.test(reaskLower)
      const isDirectEscalate = /operador|revis|c[oó]mo\s+te\s+llamas/.test(reaskLower)
      if (!isReAsk && !isDirectEscalate) {
        throw new Error(`Scenario 5.3: bot né re-ask né escalate dopo "sigue saliendo": ${reply}`)
      }
      // Se Phase B re-ask: cliente conferma AL001 → escalate
      if (isReAsk) {
        reply = await ctx.send('AL001')
        const escalateLower = reply.toLowerCase()
        if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
          throw new Error(`Scenario 5.3: bot deve chiedere il nome: ${reply}`)
        }
      }
      // Capture name → final reply
      const final = await ctx.send('Carlos')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 5.3 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 5.3 final: NON menziona "operador": ${final}`)
      }
      // Summary operatore: Carlos + L'Escala + 3 + AL001
      expectMentionsAll(final, ['Carlos', "L'Escala", '3', 'AL001'])
    },
  },

  // ── Scenario 5.4 — F47: AL001 + customer mentions payment → pivot Caso 4 ─
  // Real chat (Andrea, 2026-05-12): customer in AL001 flow said "He pagado y
  // apretado el numero…" → bot drifted because no deterministic pivot. Fix:
  // `detectPaymentMention` + `pivotToNoChangeAsk` + agent-extract.ts branch.
  // Once pivoted, Caso 4.2 guards take over: "Sí" to "¿cambio devuelto?" →
  // immediate escalation.
  {
    name: 'ES — Scenario 5.4 (F47): AL001 + "He pagado" → pivot Caso 4 → "Sí" cambio → escalate',
    run: async (ctx) => {
      await ctx.send('AL001')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('3')
      // Customer reveals payment → pivot should arm Caso 4 deterministically.
      const cambioAsk = await ctx.send('He pagado y apretado el numero de la lavadora')
      const cambioLower = cambioAsk.toLowerCase()
      // The bot must ask about "cambio" (Caso 4 entry), NOT improvise display reask.
      if (!/cambio|central\s+te\s+ha\s+devuelto/.test(cambioLower)) {
        throw new Error(`Scenario 5.4: bot must ask about cambio devuelto, got: ${cambioAsk}`)
      }
      if (/pantalla|aparece|escrib.*c[oó]digo/.test(cambioLower)) {
        throw new Error(`Scenario 5.4: bot must NOT bounce display reask after the pivot, got: ${cambioAsk}`)
      }
      // "Sí" cambio devuelto → Caso 4.2 escalates immediately.
      const escalateReply = await ctx.send('Sí')
      const escalateLower = escalateReply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 5.4: bot must ask the name on "Sí" cambio (Caso 4.2): ${escalateReply}`)
      }
      // Final closure.
      const final = await ctx.send('Andrea')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 5.4 final: must contain "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 5.4 final: must mention "operador": ${final}`)
      }
    },
  },
]
