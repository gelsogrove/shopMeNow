// 08 — Caso 8 cliente con código de descuento (NEW flow per cliente comment).
//
// Da docs/usecases.md Caso 8:
//   Format: 3 letras + DDMMYY + importe (ej. SAU2904266).
//   Steps: ask code → validate → ask name → pueblo → machine number →
//   "¿cargada y puerta cerrada?" → final reply + escalation.
//
// Format invalid → escalation immediata con motivo "formato no reconocido".

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
    // Format invalid → escalation immediata, no raccolta dati.
    name: 'ES — Caso 8 codice invalido: format check fallisce → escalation diretta',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      const reply = await ctx.send('AB12345')
      // Bot deve escalare con messaggio "formato no reconocido" e chiedere nome.
      expectMentionsAll(reply, ['formato', 'manualmente'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|nombre.*por\s+favor|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot deve chiedere il nome dopo escalation: ${reply}`)
      }
      // NON deve continuare con domande del nuovo flusso.
      expectMentionsNone(reply, ['pueblo', 'numero de maquina'])
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
]
