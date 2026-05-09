// 08 — Caso 8 cliente con código de descuento (NEW flow per cliente comment).
//
// Da docs/usecases.md Caso 8:
//   Format: 3 letras + DDMMYY + importe (ej. SAU2904266).
//   Steps: ask code → validate → ask name → pueblo → machine number →
//   "¿cargada y puerta cerrada?" → final reply + escalation.
//
// Format invalid → 1° intento: retry. 2° invalido consecutivo → escalation
// con motivo "formato no reconocido" (Bug #13 fix Andrea-2026-05-09: prima
// escalava già al 1° invalido, ora segue il retry+escalate ladder).
//
// Scenario 8.1 — Happy Path: bot saluta + chiede solo il codice (no machine/display/escalation).
// Scenario 8.2 — Variante: stesso trigger, stessa risposta canned.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 8 T1: bot chiede codice (con welcome al T1)',
    run: async (ctx) => {
      const reply = await ctx.send('Tengo un código y no sé cómo usarlo.')
      // Welcome configurato in settings.json deve apparire al T1.
      expectMentionsAll(reply, ['asistente virtual', 'codigo'])
    },
  },
  {
    name: 'ES — Caso 8 happy path: codice valido → raccoglie nome/pueblo/maquina/puerta → escalation',
    run: async (ctx) => {
      // T1: trigger
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      // T2: codice formato valido (SAU + 290426 + 6)
      const r2 = await ctx.send('SAU2904266')
      expectMentionsAll(r2, ['nombre'])
      // T3: nome → pueblo
      const r3 = await ctx.send('Andrea')
      expectMentionsAll(r3, ['pueblo'])
      // T4: pueblo → numero macchina
      const r4 = await ctx.send('Goya')
      expectMentionsAll(r4, ['numero', 'maquina'])
      // T5: numero macchina → puerta
      const r5 = await ctx.send('5')
      expectMentionsAll(r5, ['puerta'])
      // T6: puerta sí → final + escalation summary
      const r6 = await ctx.send('Sí')
      // Messaggio cortese al cliente
      expectMentionsAll(r6, ['minuto', 'comprobaciones'])
      // Resumen all'operatore con dati parseados
      expectMentionsAll(r6, ['Andrea', 'Goya', 'SAU2904266', 'SAU', '2026-04-29', 'human support'])
      // Garanzie negative: niente flussi vecchi
      expectMentionsNone(r6, ['te falta', 'introduce en la central', 'incidencia resuelta'])
    },
  },
  {
    // Bug #13 fix (Andrea-2026-05-09): format invalid → RETRY first, escalate
    // only on second consecutive invalid attempt. Mirror del retry+escalate
    // ladder già in uso su display/machineNumber/cardDigits.
    // approved-by-andrea: replaces "escalation diretta" assertion with the
    // new ladder behavior.
    name: 'ES — Caso 8 codice invalido (1° intento): retry, no escalation',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      const reply = await ctx.send('AB12345')
      // 1° intento invalido → bot deve chiedere di riscriverlo, NON escalare.
      const lower = reply.toLowerCase()
      if (!/no\s+encaja|formato|comprobarlo|escrib[ií]rmelo\s+de\s+nuevo|escr[íi]belo\s+de\s+nuevo/.test(lower)) {
        throw new Error(`Caso 8 invalido (1° intento): bot deve chiedere retry: ${reply}`)
      }
      // NON deve chiedere il nome (escalate non avvenuto).
      if (/te\s+llamas|tu\s+nombre|c[oó]mo\s+te\s+llamas/.test(lower)) {
        throw new Error(`Caso 8 invalido (1° intento): NON deve chiedere nome ancora: ${reply}`)
      }
      expectMentionsNone(reply, ['pueblo', 'numero de maquina'])
    },
  },
  {
    // Bug #13 (continuazione): 2° intento invalido consecutivo → escalate.
    name: 'ES — Caso 8 codice invalido (2° intento consecutivo): escalation',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('AB12345') // 1° invalido → retry
      const reply = await ctx.send('XYZ123') // 2° invalido → escalate
      expectMentionsAll(reply, ['formato', 'manualmente'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot deve chiedere il nome dopo 2° invalido: ${reply}`)
      }
    },
  },
  {
    // Skip pueblo se location già nota dal contesto.
    name: 'ES — Caso 8: skip pueblo se location già nota',
    run: async (ctx) => {
      // Pre-popola state.location via troubleshooting.
      await ctx.send('Estoy en Goya con la lavadora 5 y aparece PUSH PROG')
      // Ora chiedo aiuto per il codice.
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('SAU2904266')
      const reply = await ctx.send('Andrea')
      // Salta pueblo (già noto Goya), salta machine-number (già noto 5),
      // arriva direttamente alla domanda della porta.
      expectMentionsAll(reply, ['puerta'])
      expectMentionsNone(reply, ['pueblo', 'numero'])
    },
  },

  // ── Scenario 8.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 8.1 — Happy Path: bot riconosce il codice e chiede SOLO il codice.
    // RULE: risposta saluta come "asistente virtual de Ecolaundry" + menziona "código" +
    // NON chiede lavadora/secadora né pantalla né escalation nell'unica risposta canned.
    name: 'ES — Scenario 8.1: trigger "tengo un código" → saludo + pide solo código',
    run: async (ctx) => {
      const reply = await ctx.send('Tengo un código y no sé cómo usarlo.')
      const lower = reply.toLowerCase()
      expectMentionsAll(reply, ['asistente virtual', 'codigo'])
      // NON deve chiedere tipo macchina né display né escalare
      if (/lavadora|secadora/.test(lower)) {
        throw new Error(`Scenario 8.1: NON deve chiedere lavadora/secadora: ${reply}`)
      }
      if (/pantalla|aparece/.test(lower)) {
        throw new Error(`Scenario 8.1: NON deve chiedere la pantalla: ${reply}`)
      }
      if (/operador|desactivado/.test(lower)) {
        throw new Error(`Scenario 8.1: NON deve escalare: ${reply}`)
      }
    },
  },

  // ── Scenario 8.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 8.2 — Variante: frase diversa, stessa risposta canned.
    // RULE: qualsiasi variante di "tengo un código/cupón" produce la stessa
    // risposta con saluto + richiesta codice, mai domande su lavadora/secadora.
    name: 'ES — Scenario 8.2: variante "tengo un código de descuento" → stessa risposta canned',
    run: async (ctx) => {
      const reply = await ctx.send('Tengo un código de descuento, ¿cómo lo uso?')
      const lower = reply.toLowerCase()
      expectMentionsAll(reply, ['asistente virtual', 'codigo'])
      if (/lavadora|secadora/.test(lower)) {
        throw new Error(`Scenario 8.2: NON deve chiedere lavadora/secadora: ${reply}`)
      }
    },
  },

  // ── Bug D regression (Andrea, 2026-05-09) ───────────────────────────────
  {
    // Real production chat: customer typed "teng un codigo y no se como
    // utilizarlo" (typo "teng" missing 'o', variant "utilizarlo" instead of
    // "usarlo", no accents). The original regex required exactly "tengo" +
    // narrow phrasing list and silently failed → bot drifted into the
    // generic machine-troubleshooting flow asking for laundry/type/number/
    // display. The fix moves detection to detectDiscountCodeIntent which is
    // permissive on common verb-prefix typos and covers more phrasings.
    name: 'ES — Bug D: typo "teng un codigo y no se como utilizarlo" → discount flow (NO machine flow)',
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
