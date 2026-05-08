// 09 — Caso 9 cliente pide factura (NEW multi-step flow).
//
// Da docs/usecases.md Caso 9:
//   El bot recoge interactivamente: lavandería, lavadora/secadora,
//   razón social, dirección, CIF/NIF, fecha de uso, email, nombre.
//   Tras el último paso devuelve el ringraziamento personalizado y
//   adjunta el resumen al operador.
//
// Sub-scenari (allineamento con Casi 1, 4, 5, 7):
//   9.1 — Happy Path: 8 steps + email valido al primo tentativo + summary
//   9.2 — Email inválido → re-ask hasta válido (validación rigorosa)
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

  // ── Scenario 9.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 9.1 — Happy Path completo: 8 step in ordine + email valido
    // al primo tentativo + final reply con name/email/fecha + handover.
    // Acceptance Criteria (da usecases.md Scenario 9.1):
    //   - bot chiede in ordine: lavandería → tipo → razón → dirección → CIF → fecha → email → nombre
    //   - email valido al primo tentativo (NO retry)
    //   - reply finale contiene name + email + fecha
    //   - handover summary contiene tutti i campi billing
    name: 'ES — Scenario 9.1: happy path completo, email valido al primo tentativo',
    run: async (ctx) => {
      const r1 = await ctx.send('Quiero una factura')
      expectMentionsAll(r1, ['lavander'])
      const r2 = await ctx.send('Goya')
      expectMentionsAll(r2, ['lavadora'])
      const r3 = await ctx.send('lavadora')
      expectMentionsAll(r3, ['raz'])
      const r4 = await ctx.send('ACME SL')
      expectMentionsAll(r4, ['direcci'])
      const r5 = await ctx.send('Calle Mayor 1, Madrid')
      expectMentionsAll(r5, ['cif'])
      const r6 = await ctx.send('B12345678')
      expectMentionsAll(r6, ['fecha'])
      const r7 = await ctx.send('ayer')
      expectMentionsAll(r7, ['correo'])
      // Scenario 9.1 differenza chiave da 9.2: email valido al primo turno → no retry
      const r8 = await ctx.send('ana@example.com')
      // Bot deve passare al "nombre" SENZA chiedere di nuovo l'email.
      expectMentionsAll(r8, ['nombre'])
      const r8Lower = r8.toLowerCase()
      if (/no parece v[áa]lido|correo no parece|escribírmelo de nuevo/.test(r8Lower)) {
        throw new Error(`Scenario 9.1: email valido erroneamente respinto: ${r8}`)
      }
      // Final reply: nome + email + handover summary
      const r9 = await ctx.send('Andrea')
      expectMentionsAll(r9, ['Andrea', 'ana@example.com'])
      // Handover summary deve contenere i campi billing
      expectMentionsAll(r9, ['ACME SL', 'B12345678', 'Calle Mayor 1'])
    },
  },

  // ── Scenario 9.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 9.2 — Email inválido → re-ask: il bot non avanza al "nombre"
    // finché non riceve un email con formato algo@dominio.tld. La validazione
    // viene applicata fino a quando il formato è corretto.
    // Acceptance Criteria (da usecases.md Scenario 9.2):
    //   - email mal formado → reply contiene "no parece válido" o equivalente
    //   - bot vuelve a pedir el correo, NON avanza al step "nombre"
    //   - email válido al secondo intento → continua al nombre + final
    name: 'ES — Scenario 9.2: email inválido al primo tentativo → re-ask → email valido al secondo',
    run: async (ctx) => {
      // Stessi 7 step di 9.1.
      await ctx.send('Quiero una factura')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('ACME SL')
      await ctx.send('Calle Mayor 1, Madrid')
      await ctx.send('B12345678')
      await ctx.send('ayer')
      // T email NON valida → bot deve respingere e ri-chiedere.
      const reAsk = await ctx.send('ana')  // missing @ + domain
      const reAskLower = reAsk.toLowerCase()
      if (!/no parece v[áa]lido|escribírmelo|correo|email/.test(reAskLower)) {
        throw new Error(`Scenario 9.2: bot non re-ask email invalido: ${reAsk}`)
      }
      // Bot NON deve aver avanzato al step "nombre".
      if (/nombre|name|c[oó]mo te llamas/i.test(reAskLower)) {
        throw new Error(`Scenario 9.2: bot avanzato a "nombre" con email invalido: ${reAsk}`)
      }
      // T email valida al secondo intento → ora bot chiede il nome.
      const r = await ctx.send('ana@example.com')
      expectMentionsAll(r, ['nombre'])
      // Final reply contiene nome + email valido (NON il primo invalido).
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'ana@example.com'])
    },
  },
]
