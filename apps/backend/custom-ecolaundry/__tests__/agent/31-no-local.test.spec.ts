// 31 — Caso 31 El cliente no indica local
//
// Da usecases.md Caso 31 (alineato al PDF Playbook §4 "primer identifica el
// local" + §11 "primer identifica el local" come regola obligatoria):
//
// REGOLA: il bot NON diagnostica fino a quando location non è chiara.
// Se cliente dice "no lo sé" / "ni idea" → re-ask con énfasis. Se dà nome
// noto (Goya, Pineda, ...) → procede al gather successivo. Se dà nome
// sconosciuto → guardInsistLocation lista lavanderías. Se cliente si rifiuta
// dopo 2-3 tentativi → escalate.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-10): un test per percorso, asserzioni
// step-by-step inline. 4 test → 1.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 31: trigger senza location → "no lo sé" → bot insiste → "Goya" → flow procede',
    run: async (ctx) => {
      // T1 — trigger senza location → bot saluta + chiede location
      await ctx.send('La secadora no funciona')
      // T2 — cliente "no lo sé" → bot insiste (con énfasis su lavandería)
      const t2 = await ctx.send('No lo sé')
      expectMentionsAll(t2, ['lavanderia'])
      // T3 — cliente dà location nota → bot procede al numero
      const t3 = await ctx.send('Vale, estoy en Goya')
      expectMentionsAll(t3, ['numero'])
      // T4 — numero → bot chiede pantalla (gather standard continua)
      const t4 = await ctx.send('La 3')
      expectMentionsAll(t4, ['pantalla'])
    },
  },
]
