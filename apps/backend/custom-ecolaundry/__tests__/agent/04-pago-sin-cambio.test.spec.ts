// 04 — Caso 4 He pagado y no se ha activado, sin cambio
//
// Da usecases.md Caso 4: il cliente ha pagato ma la macchina non si è
// attivata e la centralina non ha restituito il resto. Il bot guida la
// verifica del numero macchina.
// 6 turni: location → tipo → numero → cambio → istruzione → closure.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso (happy /
// escalate / escalate dopo retry). I checkpoint puntuali (T2 chiede
// location, T3 chiede tipo, …) sono asseriti DENTRO i test completi via
// `expectStepInTranscript`. Eliminato il pattern "1 test = 1 turno" che
// rifaceva la stessa conversazione 10 volte (~80% riduzione costi $).

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 4.1 — Happy Path completo (gather + resolved) ─────────────
  {
    name: 'ES — Scenario 4.1: happy path completo → gather → "No" cambio → arranca → resolved',
    run: async (ctx) => {
      // T1 — trigger
      const t1 = await ctx.send('He pagado y no se ha activado')
      expectMentionsAll(t1, ['lavanderia']) // T2 checkpoint: bot chiede location
      // T2 — location
      const t2 = await ctx.send('Goya')
      expectMentionsAll(t2, ['lavadora']) // T3 checkpoint: bot chiede tipo
      // T3 — tipo
      const t3 = await ctx.send('Lavadora')
      expectMentionsAll(t3, ['numero']) // T4 checkpoint: bot chiede numero
      // T4 — numero
      const t4 = await ctx.send('La 4')
      const t4Lower = t4.toLowerCase()
      // T5 checkpoint: bot chiede del cambio (NO display, regola Caso 4)
      if (!/cambio/.test(t4Lower)) {
        throw new Error(`Caso 4 T5: bot deve chiedere del cambio: ${t4}`)
      }
      if (/pantalla|aparece/.test(t4Lower)) {
        throw new Error(`Caso 4 T5: bot NON deve chiedere pantalla: ${t4}`)
      }
      // T5 — "No" al cambio → istruzione
      const t5 = await ctx.send('No')
      const t5Lower = t5.toLowerCase()
      // Istruzione canonica: "número" + "central"
      if (!/n[uú]mero/.test(t5Lower) || !/central/.test(t5Lower)) {
        throw new Error(`Scenario 4.1: bot non dà istruzione "número/central": ${t5}`)
      }
      // T6 — cliente conferma → resolved
      const t6 = await ctx.send('Sí, ahora ya se ha puesto en marcha')
      const t6Lower = t6.toLowerCase()
      if (!/perfect/.test(t6Lower)) {
        throw new Error(`Scenario 4.1: reply non contiene "perfecto": ${t6}`)
      }
      if (!/resuelt|ya\s+estar[ií]a/.test(t6Lower)) {
        throw new Error(`Scenario 4.1: reply non contiene "resuelt"/"ya estaría": ${t6}`)
      }
      // State pin: closure a "resolved".
      expectStateHas(ctx.session, { pendingClosure: 'resolved' })
    },
  },

  // ── Scenario 4.2 — Escalation: cambio devuelto ma máquina no arranca ──
  {
    // Cambio devuelto = central ha cobrato + dato cambio → no errore di
    // selezione, è un guasto vero. Bot escala con "operador" + "desactivado".
    name: 'ES — Scenario 4.2: "Sí" al cambio + máquina no arranca → escalate con "operador" + "desactivado"',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      const r = await ctx.send('Sí, pero la máquina no arranca')
      const rLower = r.toLowerCase()
      const asksName = /c[oó]mo\s+te\s+llamas|tu\s+nombre|me\s+puedes\s+(?:decir|dar)\s+tu\s+nombre/.test(rLower)
      const escalates = /revis|operador|asistencia|manualmente/.test(rLower)
      if (!asksName && !escalates) {
        throw new Error(`Scenario 4.2: bot non escala né chiede nome dopo "Sí + no arranca": ${r}`)
      }
      const final = await ctx.send('Andrea')
      const finalLower = final.toLowerCase()
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 4.2 final: reply NON contiene "operador": ${final}`)
      }
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 4.2 final: reply NON contiene "desactivado": ${final}`)
      }
      expectMentionsAll(final, ['Andrea', 'Goya', '4'])
    },
  },

  // ── Scenario 4.3 — Escalation tras "No" + retry fallito ────────────────
  {
    // Variante: customer dice "No" al cambio → bot dà istruzione → customer
    // dice "sigue sin activar" → bot escala (guardNoChangeAfterRetry).
    // Summary handover deve dire "ha pagado pero la lavadora no se ha
    // activado tras corregir el número en la central" (Caso 4 specifico).
    name: 'ES — Scenario 4.3: "No" cambio → retry fallito → escalate con summary contestualizzato',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      await ctx.send('No')
      const r = await ctx.send('sigue sin activar')
      const rLower = r.toLowerCase()
      if (!/c[oó]mo\s+te\s+llamas|tu\s+nombre/.test(rLower)) {
        throw new Error(`Scenario 4.3: bot deve chiedere il nome dopo retry fallito: ${r}`)
      }
      const final = await ctx.send('Andrea')
      // Summary deve contenere: name, location, machine, pagado, activad
      // (Caso 4 specific template, NOT default machine-incident fallback).
      expectMentionsAll(final, ['Andrea', 'Goya', '4', 'pagado', 'activad'])
      // Garanzie negative.
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },

  // ── Scenario 4.4 — F39 pin: bare "Sí" cambio → escalate diretto ────────
  {
    // F39 regression (Andrea 2026-05-11): bot ricevette "si" (bare yes) come
    // risposta a "¿la central te ha devuelto el cambio?" e improvvisò chiedendo
    // la pantalla invece di escalare. Il guardNoChangeYesButBroken richiedeva
    // due markers nello stesso messaggio (yes + still-broken explicit).
    // Fix: il still-broken è implicito dal trigger originale; bare "Sí" basta.
    name: 'F39 — bare "Sí" al cambio → escalate (still-broken implicit from trigger)',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      // Bare "Sí" — niente "pero no arranca". F39 deve escalare lo stesso.
      const r = await ctx.send('Sí')
      const rLower = r.toLowerCase()
      const asksName = /c[oó]mo\s+te\s+llamas|tu\s+nombre/.test(rLower)
      const escalates = /revis|operador|manualmente/.test(rLower)
      if (!asksName && !escalates) {
        throw new Error(`F39 regression: bare "Sí" deve escalare, non drift a display: ${r}`)
      }
      // Negative: bot NON deve chiedere "¿qué aparece en la pantalla?" né
      // gather di display (caduta nel pipeline machine-incident default).
      if (/qu[eé]\s+aparece\s+en\s+la\s+pantalla|c[oó]digo.*pantalla/i.test(rLower)) {
        throw new Error(`F39 regression: bot drift a display gather invece di escalate: ${r}`)
      }
    },
  },
]
