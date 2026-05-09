// 25 — Caso 25 El cliente está muy enfadado
//
// Da usecases.md Caso 25 (alineato al Playbook PDF §10 criteris d'escalat:
// "el client està molt enfadat" → escalar):
//   T1: bot apre con empathic ("entiendo tu malestar, quiero ayudarte")
//        + chiede location.
//   Tras gather mínimo (location+tipo+numero) → escalate automático
//   con summary "cliente muy enfadado".
//
// Differenza con Scenario 6.2 (rage + explicit operator request):
// Caso 6.2 = boundary signal "muy enfadado + quiero operador" → escalate
// immediato. Caso 25 = trigger di sole esclamazioni angry → empathic
// gather + escalate dopo gather minimo.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 25: empathic T1 → gather → escalate automático → name → summary',
    run: async (ctx) => {
      // T1 — trigger angry → bot empathic + chiede location
      const t1 = await ctx.send('¡Esto siempre falla! ¡Quiero una solución ya!')
      expectMentionsAll(t1, ['entiend', 'lavanderia'])
      expectMentionsNone(t1, ['no es posible', 'tienes que esperar', 'estafa'])
      // T2 — location → gather continua
      await ctx.send('Goya')
      // T3 — tipo → gather continua
      await ctx.send('Lavadora')
      // T4 — numero → bot escala automáticamente (cliente angry, no dopo display)
      const t4 = await ctx.send('La 5')
      expectMentionsAll(t4, ['operador'])
      const t4Lower = t4.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(t4Lower)) {
        throw new Error(`Caso 25: bot deve chiedere il nome: ${t4}`)
      }
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'Goya'])
      // Garanzie negative
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
