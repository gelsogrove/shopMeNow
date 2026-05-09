// 19+20 — Datáfono ha cobrado 10 € en Goya / Pineda (incoherencia importe)
//
// Da usecases.md Caso 19 (Goya) e Caso 20 (Pineda), alineato al Playbook PDF
// §6 (regle de possible frau o incoherència) + §8 (base de coneixement per
// locals: Goya import_fix_tpv 7€, Pineda 8€):
//
// REGOLA SACRA (PDF §6 + usecases): NO confrontar. El bot NUNCA dice
// "estafa", "imposible", "mentira", "no es verdad", "fraude". Sólo dice
// "necesitamos revisarlo manualmente".
//
// Stesso flow per entrambi: trigger (datáfono + 10€ + Goya/Pineda) →
// nonTroubleshootingIncident="datafono-wrong-amount" → no gather máquina
// → "¿has podido usar el servicio?" → escalate → name → summary.
//
// Scenari (un test per location, ognuno con bug regression sul name capture):
//   19 — Goya: trigger T1 con location → escalate → name capture rifiuta "No"
//   20 — Pineda: trigger T1 senza location, T2 location → escalate → name
//        capture rifiuta "Vale" come ack (non come nome)
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 4 test → 2 (combinato happy + bug regression name capture).

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Caso 19 — Goya datáfono 10€ ─────────────────────────────────────────
  {
    name: 'ES — Caso 19 Goya: datáfono 10€ → escalate sin confrontar → name capture rifiuta "No"',
    run: async (ctx) => {
      // T1 — trigger con location nel medesimo messaggio (escalation guard
      // fires immediatamente, no separate location turn).
      const t1 = await ctx.send('Estoy en Goya y el datáfono me ha cobrado 10 €')
      expectMentionsAll(t1, ['revis'])
      // PDF §6: NO confrontar — vietate parole accusatorie
      expectMentionsNone(t1, ['estafa', 'imposible', 'mentira', 'fraude', 'no es verdad'])
      // T2 — Bug regression name capture: il bot ha già escalato e chiesto
      // il nome; l'utente risponde "No" pensando di rispondere ad altra
      // domanda. Il tool capture_customer_name DEVE rifiutare yes/no/ack.
      await ctx.send('No')
      // T3 — name valido → handover summary
      const final = await ctx.send('Andrea')
      // Summary contiene Andrea + Goya + datáfono (NON "Usuario No en Goya")
      expectMentionsAll(final, ['Andrea', 'Goya', 'datáfono'])
      if (/usuario\s+no\b/i.test(final)) {
        throw new Error(`Caso 19 bug regression: bot ha catturato "No" come nome: ${final}`)
      }
    },
  },

  // ── Caso 20 — Pineda datáfono 10€ ───────────────────────────────────────
  {
    name: 'ES — Caso 20 Pineda: datáfono 10€ → escalate sin confrontar → name capture rifiuta "Vale"',
    run: async (ctx) => {
      // T1 — trigger senza location → bot chiede location (fallback)
      await ctx.send('El datáfono me ha cobrado 10€')
      // T2 — location Pineda → bot escala
      const t2 = await ctx.send('Pineda')
      expectMentionsAll(t2, ['revis'])
      expectMentionsNone(t2, ['estafa', 'imposible', 'mentira', 'fraude', 'no es verdad'])
      // T3 — Bug regression: "Vale" è un ack, NON deve essere catturato come nome
      await ctx.send('Vale')
      // T4 — name valido
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'Pineda'])
      if (/usuario\s+vale\b/i.test(final)) {
        throw new Error(`Caso 20 bug regression: bot ha catturato "Vale" come nome: ${final}`)
      }
    },
  },
]
