// 16 — Datafono 10€ a Goya/Pineda → escala senza accusare
//
// Da reglas.md "Reglas para incoherencias o posible fraude":
//   - Casos típicos: en Goya o Pineda el cliente dice que el datáfono ha
//     cobrado 10€ (mientras que el TPV cobra 7 o 8 €).
//   - Acción: NO confrontar, recoger datos mínimos, escalar.
//   - El bot NUNCA debe decir "estafa", "no es verdad", "es imposible".
//   - Debe decir "necesitamos revisarlo manualmente".

import { type TestCase, expectMentionsAll, expectMentionsNone } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Datafono 10€ Goya: bot escala con "revisar" senza accusare',
    run: async (ctx) => {
      // The customer mentions both the incident and the location in T1, so the
      // escalation guard fires immediately on T1 (no need for a separate
      // location turn). Per doc reglas.md "Reglas para incoherencias".
      const reply = await ctx.send('El datáfono me ha cobrado 10€ en Goya')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira', 'no es verdad'])
    },
  },
  {
    name: 'ES — Datafono 10€ Pineda: bot escala con "revisar" senza accusare',
    run: async (ctx) => {
      await ctx.send('El datáfono me ha cobrado 10€')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['revis'])
      expectMentionsNone(reply, ['estafa', 'imposible', 'mentira', 'no es verdad'])
    },
  },
  {
    // BUG REGRESSION: prima del fix, quando il bot chiedeva "¿Cómo te
    // llamas?" e l'utente rispondeva "No" (ad altro contesto), l'LLM
    // catturava "No" come nome cliente. Il summary diventava "Usuario No
    // en Goya...". Ora il tool capture_customer_name rifiuta yes/no e
    // acknowledgments come nomi.
    name: 'ES — Datafono Goya: "No" come risposta non viene catturato come nome',
    run: async (ctx) => {
      await ctx.send('Estoy en Goya y el datáfono me ha cobrado 10 €')
      // T2: il bot ha già escalato e chiesto il nome; l'utente risponde
      // "No" pensando di rispondere a un'altra domanda.
      await ctx.send('No')
      const reply = await ctx.send('Andrea')
      // Il summary deve contenere "Andrea" come nome, NON "No".
      expectMentionsAll(reply, ['Andrea', 'Goya', 'datáfono'])
      if (/usuario\s+no\b/i.test(reply)) {
        throw new Error(`Bot ha catturato "No" come nome: ${reply}`)
      }
    },
  },
  {
    // BUG REGRESSION: stesso bug per Pineda.
    name: 'ES — Datafono Pineda: "Vale" come ack non viene catturato come nome',
    run: async (ctx) => {
      await ctx.send('En Pineda me ha cobrado 10 €')
      await ctx.send('Vale')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Pineda'])
      if (/usuario\s+vale\b/i.test(reply)) {
        throw new Error(`Bot ha catturato "Vale" come nome: ${reply}`)
      }
    },
  },
]
