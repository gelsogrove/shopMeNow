// 16 — Caso 16 La máquina muestra ALM, ALN o un código de alarma similar
//
// Da usecases.md Caso 16: cliente vede ALM/ALN/ALN A/ALN N → bot raccoglie
// dati minimi (location + tipo + numero) e escala.
//
// Differenza con Caso 13: Caso 13 è più generico (qualsiasi alarm code o
// incoherenza); Caso 16 è specifico per la famiglia ALM/ALN su secadora.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 16 ALN T1: bot saluta + chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('La secadora pone ALN')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    // T2: dopo location, il bot prosegue il flow ALN. Può:
    //   (a) chiedere numero secadora (gather completo prima di escalare)
    //   (b) escalare direttamente chiedendo il nome (tipo già noto da T1)
    // Entrambi sono validi: il summary handover finale contiene comunque
    // location+tipo+numero+ALN (verificato dal test "escalation summary").
    name: 'ES — Caso 16 ALN T2: dopo location, bot prosegue (numero o escalation)',
    run: async (ctx) => {
      await ctx.send('La secadora pone ALN')
      const reply = await ctx.send('Alemanya')
      const lower = reply.toLowerCase()
      const asksNumber = /n[uú]mero/.test(lower)
      const escalating = /te\s+llamas|tu\s+nombre|c[oó]mo\s+te|revis|operador/.test(lower)
      if (!asksNumber && !escalating) {
        throw new Error(`Caso 16 ALN T2: bot deve chiedere numero o escalare: ${reply}`)
      }
    },
  },
  {
    // T3: il bot ha escalato (deterministicamente o tramite LLM) e ora
    // chiede il nome (capture_customer_name). Concept-level: escalation
    // path attivo (revis/operador/llamas).
    name: 'ES — Caso 16 ALN T3: dopo numero, bot in escalation flow',
    run: async (ctx) => {
      await ctx.send('La secadora pone ALN')
      await ctx.send('Alemanya')
      const reply = await ctx.send('La 4')
      const lower = reply.toLowerCase()
      // Bot deve chiedere il nome (escalation in corso) o menzionare revisión.
      const asksName = /te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)
      const mentionsRevision = /revis|operador|asistencia|manualmente/.test(lower)
      if (!asksName && !mentionsRevision) {
        throw new Error(`Caso 16 ALN T3: bot deve essere in escalation flow: ${reply}`)
      }
    },
  },
  {
    // Variante ALM: stesso comportamento.
    name: 'ES — Caso 16 ALM (lavadora): flow di escalation simile',
    run: async (ctx) => {
      await ctx.send('La lavadora me sale ALM')
      await ctx.send('Goya')
      const reply = await ctx.send('La 5')
      expectMentionsAll(reply, ['revis'])
    },
  },
  {
    // Summary regression: il riepilogo deve menzionare ALN come código de
    // alarma, location, tipo macchina (secadora) e numero.
    name: 'ES — Caso 16 escalation summary: contiene ALN + location + tipo + numero',
    run: async (ctx) => {
      await ctx.send('La secadora pone ALN')
      await ctx.send('Alemanya')
      await ctx.send('La 4')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Alemanya', 'ALN', 'secadora', '4'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
