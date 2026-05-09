// 18 — Caso 18 El cliente da un código solo numérico y dice que no hay letras
//
// Da usecases.md Caso 18 (alineado al Playbook PDF §6 "regle de possible
// frau o incoherència" + §5.6 Caso 8 "preguntar si hi ha lletres davant"):
//
// Step 1: trigger codice solo numerico (^\d{3,}$) → bot chiede "¿hay letras?"
// Step 2 "No" → escalate immediato (incoherence) — summary specifico
//   "código solo numérico... no encaja con formato esperado".
// Step 2 "Sí" → reset al flow Caso 8 (re-ask código completo con letras).
//
// REGOLA CRITICA (PDF §6 + usecases): NO confrontar. Vietate parole come
// "estafa", "imposible", "mentira", "fraude", "no es verdad".
//
// Scenari:
//   18.1 — Path "No" (incoherence): codice numerico → "No" letras → escalate
//          → name → summary "solo numérico" (NO template Caso 8)
//   18.2 — Path "Sí" (rilancio): codice numerico → "Sí" letras → re-ask código
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 5 test → 2.

import { type TestCase, expectMentionsAll, expectMentionsNone, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 18.1 — Path "No" (incoherence escalation) ──────────────────
  {
    name: 'ES — Scenario 18.1: codice numerico → "No" → escalate sin confrontar → name → summary "solo numérico"',
    run: async (ctx) => {
      // T1 — trigger codice solo numerico → bot chiede letras
      const t1 = await ctx.send('Tengo un código: 23432023')
      expectMentionsAll(t1, ['letra'])
      // T2 — "No" letras → bot escala SENZA confrontar
      const t2 = await ctx.send('No')
      expectMentionsAll(t2, ['revis'])
      // PDF §6: NO confrontar — vietate parole accusatorie
      expectMentionsNone(t2, ['estafa', 'imposible', 'mentira', 'fraude', 'no es verdad'])
      // State check: code value salvato, escalation triggered
      expectStateHas(ctx.session, {
        faqCodeValue: '23432023',
        operatorRequested: true,
      })
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', '23432023'])
      const finalLower = final.toLowerCase()
      // Summary deve contenere template Caso 18 ("solo numérico" / "no encaja")
      if (!/solo\s+num[eé]rico|no\s+encaja|formato\s+esperado/.test(finalLower)) {
        throw new Error(`Caso 18 summary errato (manca pattern Caso 18): ${final}`)
      }
      // NON deve contenere template Caso 8 (importe pendiente / no arrancó)
      if (/importe\s+pendiente|m[aá]quina\s+no\s+arranc[oó]/i.test(final)) {
        throw new Error(`Caso 18 summary sta usando template Caso 8: ${final}`)
      }
    },
  },

  // ── Scenario 18.2 — Path "Sí" (rilancio a Caso 8) ───────────────────────
  {
    // Quando il cliente risponde "SI" alla domanda "¿hay letras?", il bot
    // NON deve scattare unknown-location ma rilanciare per il codice corretto
    // (transizione a Caso 8 step ask-code).
    name: 'ES — Scenario 18.2: codice numerico → "SI" letras → bot rilancia chiedendo codice exacto',
    run: async (ctx) => {
      await ctx.send('Tengo un código: 23432023')
      const reply = await ctx.send('SI')
      expectMentionsAll(reply, ['codigo', 'letras'])
      expectMentionsNone(reply, ['no reconozco', 'lavanderias son'])
    },
  },

  // ── Scenario 18.3 — Path "AS" (implicit yes via uppercase letters typed) ─
  {
    // Bug regression (Andrea, 2026-05-10 real chat): customer typed the
    // letters directly ("AS") instead of saying "sí" → before the fix the
    // guard returned null and the LLM improvised by asking lavandería,
    // skipping the re-ask of the full code. The fix detects pure-uppercase
    // short tokens (^[A-Z]{1,5}$) as implicit yesLetters and re-asks the
    // full code (faqCodeValue reset, pendingFlow='discount-code-await').
    name: 'ES — Scenario 18.3: codice numerico → "AS" (uppercase letras) → bot rilancia chiedendo codice exacto',
    run: async (ctx) => {
      await ctx.send('Tengo un código: 64646')
      const reply = await ctx.send('AS')
      // Bot deve ri-chiedere il codice completo, NON saltare a lavandería
      expectMentionsAll(reply, ['codigo', 'letras'])
      expectMentionsNone(reply, ['lavander', 'lavadora o secadora'])
    },
  },
]
