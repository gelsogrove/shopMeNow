// 09 — Caso 9 cliente pide factura (NEW multi-step flow).
//
// Da docs/usecases.md Caso 9:
//   El bot recoge interactivamente: lavandería, lavadora/secadora,
//   razón social, dirección, CIF/NIF, fecha de uso, email, nombre.
//   Tras el último paso devuelve el ringraziamento personalizado y
//   adjunta el resumen al operador.
//
// La email è obbligatoria e validata: input non valido → re-ask.
// Date relative (oggi/ieri/hoy/ayer/...) vengono normalizzate a ISO.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 9: bot raccoglie i dati passo passo e finalizza con nome + email',
    run: async (ctx) => {
      // T1: trigger del flusso. Il bot deve premettere il welcome configurato
      // in settings.json prima della prima domanda (caso 9 è un flusso
      // conversazionale, non una risposta canned, quindi il welcome va mostrato).
      const r1 = await ctx.send('Quiero una factura')
      expectMentionsAll(r1, ['asistente virtual', 'lavander'])
      expectMentionsNone(r1, ['olga@alberwaz.net'])
      // T2: lavandería
      const r2 = await ctx.send('Goya')
      expectMentionsAll(r2, ['lavadora'])
      // T3: tipo macchina
      const r3 = await ctx.send('lavadora')
      expectMentionsAll(r3, ['raz'])
      // T4: razón social
      const r4 = await ctx.send('ACME SL')
      expectMentionsAll(r4, ['direcci'])
      // T5: dirección
      const r5 = await ctx.send('Calle Mayor 1, Madrid')
      expectMentionsAll(r5, ['cif'])
      // T6: CIF
      const r6 = await ctx.send('B12345678')
      expectMentionsAll(r6, ['fecha', 'd'])
      // T7: fecha
      const r7 = await ctx.send('hoy')
      expectMentionsAll(r7, ['correo'])
      // T8: email NON valida → retry
      const r8 = await ctx.send('non-una-email')
      expectMentionsAll(r8, ['no parece v', 'lid'])
      // T9: email valida
      const r9 = await ctx.send('cliente@example.com')
      expectMentionsAll(r9, ['nombre'])
      // T10: nome → final reply + handoff
      const r10 = await ctx.send('Andrea')
      expectMentionsAll(r10, ['Andrea', 'cliente@example.com', 'human support'])
    },
  },
  {
    // Quando location e tipo macchina sono già nello state da turni
    // precedenti, il flusso parte direttamente da razón social.
    name: 'ES — Caso 9: skip lavandería/macchina se già note da turni precedenti',
    run: async (ctx) => {
      // Pre-popola state con un turno operativo che lascia location e machineType.
      await ctx.send('Estoy en Goya con la lavadora 5 y aparece PUSH PROG')
      // Ora chiedo factura: il bot dovrebbe saltare lavandería e macchina.
      const r = await ctx.send('Necesito una factura')
      expectMentionsAll(r, ['raz'])
      expectMentionsNone(r, ['lavander', 'lavadora o secadora'])
    },
  },
]
