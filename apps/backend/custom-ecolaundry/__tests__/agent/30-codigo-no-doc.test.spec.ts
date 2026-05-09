// 30 — Caso 30 Código no documentado en pantalla
//
// Da usecases.md Caso 30 (alineato al Playbook PDF §5.4 regla "el display
// mostra un codi no documentat" → escalar):
//
// Trigger: codice display sconosciuto (ERR 52, STOP, FILTRO, ecc.) o testo
// non riconosciuto. Bot tenta fuzzy match per typos piccoli; se non
// riconoscibile → re-ask amabile, poi escalate a operator.
//
// REGOLA SACRA (riga 1996 usecases): summary contiene "el código exacto
// que el cliente ha escrito (sin reinterpretarlo ni normalizarlo)".
// Bug architetturale risolto 2026-05-10: extractDisplayLabel ora cattura
// "ERR 52" al completo (prima troncava a "ERR" perché la greedy extension
// non accettava parole inizianti con cifre).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-10): un test per percorso, asserzioni
// step-by-step inline. 4 test → 1.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 30: ERR 52 → gather → escalate → name → summary contiene "ERR 52" exacto',
    run: async (ctx) => {
      // T1 — trigger ERR 52 → bot saluta + chiede location
      const t1 = await ctx.send('En la pantalla sale ERR 52')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location → bot chiede tipo
      await ctx.send("L'Escala")
      // T3 — tipo → bot chiede numero
      await ctx.send('lavadora')
      // T4 — numero → bot escala con "revis" + "manual" (codice no documentato)
      const t4 = await ctx.send('5')
      expectMentionsAll(t4, ['revis', 'manual'])
      // T finale — name → handover summary con codice ESATTO "ERR 52"
      // (rule from usecases riga 1996: sin reinterpretarlo ni normalizarlo)
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'ERR', '52'])
      const finalLower = final.toLowerCase()
      if (!/escala/.test(finalLower)) {
        throw new Error(`Caso 30 summary non contiene location: ${final}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
    },
  },
]
