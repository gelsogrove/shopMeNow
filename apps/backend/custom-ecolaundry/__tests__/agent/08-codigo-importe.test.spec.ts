// 08 — Caso 8 Tengo un código de descuento
//
// Da usecases.md Caso 8: il cliente ha un codice di sconto. Il bot
// valida il formato `^[A-Z]{3}\d{6}\d+$` (3 lettere + DDMMYY + importe),
// raccoglie i dati e passa il caso all'operatore per attivazione remota.
//
// Scenari:
//   8.1 — Happy Path: trigger → SAU2904266 → name → pueblo → maquina → puerta → escalation
//   8.2 — Format invalid retry+escalate: 1° invalido → retry → 2° invalido → escalate + name
//   Edge: skip pueblo se location già nota dal contesto
//   Bug D — regression typo "teng un codigo y no se como utilizarlo"
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 8 test → 4. Eliminato "Scenario 8.2 variante trigger"
// perché Bug D copre già la robustezza del detector con typo (più stringente).

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 8.1 — Happy Path completo ───────────────────────────────────
  {
    name: 'ES — Scenario 8.1: happy path completo → SAU2904266 → name → pueblo → maquina → puerta → escalation',
    run: async (ctx) => {
      // T1 — trigger → bot saluta + chiede SOLO il codice (no machine/display/escalation)
      const t1 = await ctx.send('Tengo un código y no sé cómo usarlo.')
      expectMentionsAll(t1, ['asistente virtual', 'codigo'])
      const t1Lower = t1.toLowerCase()
      // Garanzie negative T1: nessuna domanda fuori contesto.
      if (/lavadora|secadora/.test(t1Lower)) {
        throw new Error(`Caso 8 T1: NON deve chiedere lavadora/secadora: ${t1}`)
      }
      if (/pantalla|aparece/.test(t1Lower)) {
        throw new Error(`Caso 8 T1: NON deve chiedere la pantalla: ${t1}`)
      }
      if (/operador|desactivado/.test(t1Lower)) {
        throw new Error(`Caso 8 T1: NON deve escalare al T1: ${t1}`)
      }
      // T2 — codice formato valido → bot chiede nome
      const t2 = await ctx.send('SAU2904266')
      expectMentionsAll(t2, ['nombre'])
      // T3 — nome → bot chiede pueblo
      const t3 = await ctx.send('Andrea')
      expectMentionsAll(t3, ['pueblo'])
      // T4 — pueblo → bot chiede numero macchina
      const t4 = await ctx.send('Goya')
      expectMentionsAll(t4, ['numero', 'maquina'])
      // T5 — numero macchina → bot chiede puerta cerrada
      const t5 = await ctx.send('5')
      expectMentionsAll(t5, ['puerta'])
      // T6 — puerta sí → final reply + escalation summary all'operatore
      const final = await ctx.send('Sí')
      // Messaggio cortese al cliente
      expectMentionsAll(final, ['minuto', 'comprobaciones'])
      // Resumen all'operatore con dati parseados
      expectMentionsAll(final, ['Andrea', 'Goya', 'SAU2904266', 'SAU', '2026-04-29', 'human support'])
      // Garanzie negative: niente flussi vecchi.
      expectMentionsNone(final, ['te falta', 'introduce en la central', 'incidencia resuelta'])
    },
  },

  // ── Scenario 8.2 — Format invalid retry+escalate ladder ─────────────────
  {
    // Bug #13 fix (Andrea-2026-05-09): format invalid → RETRY first, escalate
    // only on second consecutive invalid attempt. Stesso retry+escalate ladder
    // di display/machineNumber/cardDigits (rule #10 corollary).
    // approved-by-andrea: replaces "escalation diretta" assertion with the new
    // ladder behavior.
    name: 'ES — Scenario 8.2: format invalid (1°) → retry → format invalid (2°) → escalate + name',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      // 1° intento invalido → bot deve chiedere retry, NON escalare
      const retry = await ctx.send('AB12345')
      const retryLower = retry.toLowerCase()
      if (!/no\s+encaja|formato|comprobarlo|escrib[ií]rmelo\s+de\s+nuevo|escr[íi]belo\s+de\s+nuevo/.test(retryLower)) {
        throw new Error(`Scenario 8.2 (1° invalido): bot deve chiedere retry: ${retry}`)
      }
      if (/te\s+llamas|tu\s+nombre|c[oó]mo\s+te\s+llamas/.test(retryLower)) {
        throw new Error(`Scenario 8.2 (1° invalido): NON deve chiedere nome ancora: ${retry}`)
      }
      expectMentionsNone(retry, ['pueblo', 'numero de maquina'])
      // 2° intento invalido consecutivo → bot escala
      const escalate = await ctx.send('XYZ123')
      expectMentionsAll(escalate, ['formato', 'manualmente'])
      const escalateLower = escalate.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(escalateLower)) {
        throw new Error(`Scenario 8.2 (2° invalido): bot deve chiedere il nome: ${escalate}`)
      }
    },
  },

  // ── Edge case: skip pueblo se location già nota dal contesto ────────────
  {
    name: 'ES — Caso 8 edge: skip pueblo + numero se location e maquina già note dal contesto',
    run: async (ctx) => {
      // Pre-popola state.location e machineNumber via troubleshooting flow.
      await ctx.send('Estoy en Goya con la lavadora 5 y aparece PUSH PROG')
      // Ora chiede aiuto per il codice — discount flow prende il sopravvento.
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('SAU2904266')
      const reply = await ctx.send('Andrea')
      // Salta pueblo (Goya già noto) e numero (5 già noto), arriva direttamente
      // alla domanda della porta.
      expectMentionsAll(reply, ['puerta'])
      expectMentionsNone(reply, ['pueblo', 'numero'])
    },
  },

  // ── Bug D regression — typo "teng un codigo" must trigger discount flow ─
  {
    // Real production chat (Andrea, 2026-05-09): customer typed "teng un codigo
    // y no se como utilizarlo" (typo "teng" missing 'o', variant "utilizarlo"
    // instead of "usarlo", no accents). The original regex required exactly
    // "tengo" and silently failed → bot drifted into the generic machine-
    // troubleshooting flow asking for laundry/type/number/display. The fix
    // (detectDiscountCodeIntent) is permissive on common verb-prefix typos.
    name: 'ES — Bug D regression: typo "teng un codigo y no se como utilizarlo" → discount flow',
    run: async (ctx) => {
      const reply = await ctx.send('teng un codigo y no se como utilizarlo')
      const lower = reply.toLowerCase()
      expectMentionsAll(reply, ['codigo'])
      // NON deve drift verso il flow macchina (lavandería/lavadora/numero/pantalla)
      if (/lavader[ií]a|lavadora\s+o\s+(?:una\s+)?secadora|n[uú]mero\s+de.*lavadora|pantalla/.test(lower)) {
        throw new Error(`Bug D: must NOT ask machine details: ${reply}`)
      }
    },
  },
]
