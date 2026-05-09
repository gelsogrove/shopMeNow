// 17 — Caso 17 El cliente no sabe qué aparece en pantalla
//
// Da usecases.md Caso 17 (PDF Playbook §5.4 regola "si el client no sap
// llegir el display, demanar-li una foto o escalar"):
//
// PRODUCT DECISION (Andrea): photo upload NO supportato hoy → bot escala
// directamente después de gather minimo (location + tipo). Sin display
// state non possiamo dare istruzioni recoverable. Cuando se habilite el
// upload, este caso pasará por un paso intermedio.
//
// Scenari:
//   17.1 — "no sé qué pone": gather location + tipo → escalate → name → summary
//   17.2 — Variante "no veo bien la pantalla": stesso flow di escalate
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 5 test → 2.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 17.1 — "no sé qué pone" → gather minimo → escalate ─────────
  {
    name: 'ES — Scenario 17.1: "no sé qué pone" → location → tipo → escalate → name → summary',
    run: async (ctx) => {
      // T1 — trigger "no sé qué pone" → bot saluta + chiede location
      const t1 = await ctx.send('La máquina no va, pero no sé qué pone')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location → bot chiede tipo macchina
      const t2 = await ctx.send('Hortes')
      expectMentionsAll(t2, ['lavadora', 'secadora'])
      // T3 — tipo → bot escala direttamente (no foto, no display gather)
      const t3 = await ctx.send('Lavadora')
      expectMentionsAll(t3, ['revis', 'llamas'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'Hortes'])
      const finalLower = final.toLowerCase()
      // Summary deve menzionare la mancanza di display o la revisione manual
      if (!/sin\s+informaci[oó]n|revisi[oó]n\s+manual|pantalla/.test(finalLower)) {
        throw new Error(`Caso 17 summary non menziona mancanza display: ${final}`)
      }
      // Garanzie negative
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },

  // ── Scenario 17.2 — Variante "no veo bien la pantalla" ──────────────────
  {
    name: 'ES — Scenario 17.2: "no veo bien la pantalla" → flow simile, escala',
    run: async (ctx) => {
      await ctx.send('No veo bien la pantalla')
      await ctx.send('Hortes')
      const reply = await ctx.send('Lavadora')
      const lower = reply.toLowerCase()
      // Bot deve escalare o chiedere foto (no foto today → escalate),
      // NON fingere di guidare senza display.
      if (!/revis|operador|t[ée]cnic|llamas|foto/.test(lower)) {
        throw new Error(`Caso 17 variante: bot non escala su "no veo": ${reply}`)
      }
    },
  },
]
