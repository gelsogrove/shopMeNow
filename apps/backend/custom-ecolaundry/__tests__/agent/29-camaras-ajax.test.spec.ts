// 29 — Caso 29 El cliente menciona cámaras o revisión técnica
//
// Da usecases.md Caso 29 (alineato al Playbook PDF §10 criteris d'escalat:
// "hi ha incidències amb càmeres o AJAX" → escalar):
//
// Trigger: cámaras / AJAX / soporte técnico → escalation INMEDIATA, no
// gather (no necesita máquina/display). Bot chiede direttamente nome.
// Set nonTroubleshootingIncident="cameras-or-ajax".
//
// REGOLA: bot NO dice "vamos a mirarlo" (non può vedere cámaras) — solo
// "lo revisamos manualmente". Vietate: "miraré las cámaras",
// "compruebo las cámaras", "voy a mirar".
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 29: trigger cámaras → escalate inmediato (no promesa) → name → summary "cámaras/ajax"',
    run: async (ctx) => {
      // T1 — trigger cámaras → bot escala inmediato (no gather), chiede nome
      const t1 = await ctx.send('Mirad las cámaras porque yo he pagado')
      expectMentionsAll(t1, ['revis'])
      expectMentionsNone(t1, ['miraré las cámaras', 'compruebo las cámaras', 'voy a mirar'])
      const t1Lower = t1.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(t1Lower)) {
        throw new Error(`Caso 29: bot deve chiedere nome inmediato: ${t1}`)
      }
      // T finale — name → handover summary con marker cámaras/ajax
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea'])
      const finalLower = final.toLowerCase()
      if (!/c[aá]maras|ajax/.test(finalLower)) {
        throw new Error(`Caso 29 summary non menziona cámaras/ajax: ${final}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
