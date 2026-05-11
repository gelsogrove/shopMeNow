// 09 — Caso 9 cliente pide factura
//
// Da usecases.md Caso 9: il bot raccoglie interattivamente 9 dati di
// fatturazione (lavandería → tipo → razón social → dirección → CIF/NIF
// → fecha → email → notas → nombre) e passa il caso all'operatore con il
// summary. F35 (Andrea 2026-05-10): step "notas" aggiunto + disclaimer
// privacy + bypass rephrase LLM (PII non esce verso third-party LLM).
//
// Validazione email rigorosa: input non valido → re-ask, NON avanza al
// nombre finché non riceve un email con formato algo@dominio.tld.
// Date relative (hoy/ayer/...) normalizzate a ISO.
//
// Scenari:
//   9.1 — Happy Path: 9 step + email valido al primo tentativo + notas + privacy + summary
//   9.2 — Email retry: email invalido al primo tentativo → re-ask → email valido
//   Edge — Skip lavandería/tipo se già noti dal contesto sticky
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 4 test → 3 (eliminato il duplicato happy+retry inline).

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 9.1 — Happy Path completo (email valido al primo tentativo) ─
  {
    name: 'ES — Scenario 9.1: happy path completo → 8 step + email valido al primo tentativo → summary',
    run: async (ctx) => {
      // T1 — trigger → bot saluta + chiede lavandería (NO email statica olga@alberwaz.net)
      const t1 = await ctx.send('Quiero una factura')
      expectMentionsAll(t1, ['asistente virtual', 'lavander'])
      // PDF dice "manda email a olga@alberwaz.net" — il nostro flow è
      // conversazionale, NON deve menzionare l'email statica.
      // Vedi usecases.md "Desviación documentada respecto al Playbook PDF".
      expectMentionsNone(t1, ['olga@alberwaz.net'])
      // T2 — lavandería → bot chiede tipo macchina
      const t2 = await ctx.send('Goya')
      expectMentionsAll(t2, ['lavadora'])
      // T3 — tipo → bot chiede razón social
      const t3 = await ctx.send('lavadora')
      expectMentionsAll(t3, ['raz'])
      // T4 — razón social → bot chiede dirección
      const t4 = await ctx.send('ACME SL')
      expectMentionsAll(t4, ['direcci'])
      // T5 — dirección → bot chiede CIF/NIF
      const t5 = await ctx.send('Calle Mayor 1, Madrid')
      expectMentionsAll(t5, ['cif'])
      // T6 — CIF → bot chiede fecha
      const t6 = await ctx.send('B12345678')
      expectMentionsAll(t6, ['fecha'])
      // T7 — fecha (relativa "ayer") → bot chiede email
      const t7 = await ctx.send('ayer')
      expectMentionsAll(t7, ['correo'])
      // T8 — email valido al PRIMO tentativo → bot avanza al step "notas" (F35)
      const t8 = await ctx.send('ana@example.com')
      const t8Lower = t8.toLowerCase()
      if (/no parece v[áa]lido|correo no parece|escribírmelo de nuevo/.test(t8Lower)) {
        throw new Error(`Scenario 9.1: email valido erroneamente respinto: ${t8}`)
      }
      // F35 — bot deve chiedere notas/observaciones prima del nome
      if (!/nota|observaci/i.test(t8Lower)) {
        throw new Error(`Scenario 9.1 (F35): bot deve chiedere "notas" dopo email: ${t8}`)
      }
      // T9 — notas (cliente dice "no" → vuoto) → bot chiede nombre
      const t9 = await ctx.send('no')
      expectMentionsAll(t9, ['nombre'])
      // T10 — nome → final reply + handover summary + disclaimer privacy
      const final = await ctx.send('Andrea')
      // Reply al cliente: nome + email
      expectMentionsAll(final, ['Andrea', 'ana@example.com'])
      // F35 — disclaimer privacy DEVE essere presente (datos no compartidos)
      const finalLower = final.toLowerCase()
      if (!/no se comparten con terceros|no comparte/i.test(finalLower)) {
        throw new Error(`Scenario 9.1 (F35): final reply must include privacy disclaimer: ${final}`)
      }
      // Handover summary: tutti i campi billing
      expectMentionsAll(final, ['ACME SL', 'B12345678', 'Calle Mayor 1', 'human support'])
    },
  },

  // ── Scenario 9.2 — Email retry (rule #10 corollary: validation ladder) ──
  {
    name: 'ES — Scenario 9.2: email invalido al primo tentativo → re-ask → email valido al secondo',
    run: async (ctx) => {
      // Stessi 7 step di 9.1.
      await ctx.send('Quiero una factura')
      await ctx.send('Goya')
      await ctx.send('lavadora')
      await ctx.send('ACME SL')
      await ctx.send('Calle Mayor 1, Madrid')
      await ctx.send('B12345678')
      await ctx.send('ayer')
      // Email invalido (manca @ + domain) → bot deve respingere e ri-chiedere
      const reAsk = await ctx.send('ana')
      const reAskLower = reAsk.toLowerCase()
      if (!/no parece v[áa]lido|escribírmelo|correo|email/.test(reAskLower)) {
        throw new Error(`Scenario 9.2: bot non re-ask email invalido: ${reAsk}`)
      }
      // Bot NON deve aver avanzato al step "nombre"
      if (/nombre|name|c[oó]mo te llamas/i.test(reAskLower)) {
        throw new Error(`Scenario 9.2: bot avanzato a "nombre" con email invalido: ${reAsk}`)
      }
      // Email valido al secondo tentativo → bot chiede notas (F35), poi nome
      const ok = await ctx.send('ana@example.com')
      if (!/nota|observaci/i.test(ok.toLowerCase())) {
        throw new Error(`Scenario 9.2 (F35): bot deve chiedere "notas" dopo email valido: ${ok}`)
      }
      const askName = await ctx.send('ninguna')
      expectMentionsAll(askName, ['nombre'])
      // Final reply contiene nome + email valido (NON il primo invalido)
      const final = await ctx.send('Andrea')
      expectMentionsAll(final, ['Andrea', 'ana@example.com'])
    },
  },

  // ── Edge — Skip lavandería/tipo se già noti dal contesto sticky ─────────
  {
    // Quando location e tipo macchina sono già nello state da turni
    // precedenti, il flusso parte direttamente da razón social.
    name: 'ES — Caso 9 edge: skip lavandería + tipo se già noti da turni precedenti',
    run: async (ctx) => {
      // Pre-popola state con turno operativo che lascia location e machineType.
      await ctx.send('Estoy en Goya con la lavadora 5 y aparece PUSH PROG')
      // Ora chiede factura: il bot dovrebbe saltare lavandería e tipo.
      const reply = await ctx.send('Necesito una factura')
      expectMentionsAll(reply, ['raz'])
      expectMentionsNone(reply, ['lavander', 'lavadora o secadora'])
    },
  },
]
