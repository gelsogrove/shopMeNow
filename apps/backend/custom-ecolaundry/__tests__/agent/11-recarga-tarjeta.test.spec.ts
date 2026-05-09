// 11 — Caso 11 Cómo recargar la tarjeta de fidelización
//
// Da usecases.md Caso 11 (allineato al Playbook PDF §5.9 "Per recarregar"):
//   - Resposta canónica: "Introduce la tarjeta y sigue las instrucciones de
//     la central."
//   - NO pregunta location né máquina: la operación de recarga es estándar
//     en todas las centrales (differenza chiave con Caso 10).
//   - Cierre proattivo: invita al cliente a reportare se aparece un mensaje
//     extraño durante la recarga (sin escalar todavía).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 2 test → 1 (eliminato il duplicato variante trigger).

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 11: happy path completo → istruzione canonica → "Vale" → cierre proactivo',
    run: async (ctx) => {
      // T1 — trigger → bot dà istruzione canonica (introduce+tarjeta+instrucciones+central)
      const t1 = await ctx.send('¿Cómo recargo la tarjeta?')
      expectMentionsAll(t1, ['introduce', 'tarjeta', 'instruccion', 'central'])
      // Garanzie negative: NON è incidenza macchina, no gather location/tipo/numero/display
      expectMentionsNone(t1, ['lavadora o secadora', 'pantalla', 'numero de la lavadora', 'numero de la secadora'])
      // T2 — cliente conferma → bot dà cierre proattivo
      const t2 = await ctx.send('Vale')
      const t2Lower = t2.toLowerCase()
      // Il cierre menziona "perfecto" + invito a segnalare se appare mensaje extraño
      if (!/perfect/.test(t2Lower)) {
        throw new Error(`Caso 11 T2: bot deve dire "perfecto": ${t2}`)
      }
      if (!/mensaje\s+extra|d[ií]melo|revisamos/.test(t2Lower)) {
        throw new Error(`Caso 11 T2: bot deve invitare al report di mensaje extraño: ${t2}`)
      }
      // Garanzie negative T2: no machine gather neanche dopo conferma
      if (/lavadora.*secadora|secadora.*lavadora|qu[eé]\s+aparece\s+en\s+la\s+pantalla|n[uú]mero\s+de\s+(?:la\s+)?(?:lavadora|secadora)/i.test(t2Lower)) {
        throw new Error(`Caso 11 T2: bot NON deve gather machine dopo "Vale": ${t2}`)
      }
    },
  },
]
