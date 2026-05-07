// Cross-test: estrazione massima al T1.
//
// Quando il cliente dà più fatti in un solo messaggio, il bot DEVE estrarli
// tutti e chiedere SOLO ciò che manca, invece di partire da zero col gather
// canonico.

import { type TestCase, expectMentionsAll, expectMentionsNone, expectStateHas } from '../_helpers.js'

export const tests: TestCase[] = [
  {
    // Caso 19/20: cliente dà location + datáfono inline → escalation diretta
    // SENZA chiedere di nuovo la location.
    name: 'ES — "En Pineda me ha cobrado 10€" → escalation diretta (location estratta)',
    run: async (ctx) => {
      const reply = await ctx.send('En Pineda me ha cobrado 10 €.')
      expectMentionsAll(reply, ['revis', 'manual'])
      expectMentionsNone(reply, ['donde', 'en qué lavanderia'])
      expectStateHas(ctx.session, { location: 'Pineda' })
    },
  },
  {
    // Cliente dà location + tipo macchina → bot chiede solo numero.
    // NOTE: "lavanderia" intentionally NOT in the negative list because the
    // standard greeting ("asistente virtual de la lavandería") legitimately
    // contains the word. The forbidden tokens that prove the bot is NOT
    // re-asking for things it already knows are: "donde" (location question)
    // and "lavadora o secadora" (machine-type question).
    name: 'ES — "Sto usando una lavatrice a Goya" → bot chiede solo il numero',
    run: async (ctx) => {
      const reply = await ctx.send('Sto usando una lavatrice a Goya')
      expectMentionsAll(reply, ['numero'])
      expectMentionsNone(reply, ['donde', 'lavadora o secadora'])
      expectStateHas(ctx.session, { location: 'Goya', machineType: 'washer' })
    },
  },
  {
    // Cliente dà location + tipo + numero + display → bot va dritto
    // all'istruzione del flow tecnico (case_push), nessuna domanda di gather.
    name: 'ES — "En Goya lavadora 3 PUSH PROG" → bot dà istruzione (tutti i fatti estratti)',
    run: async (ctx) => {
      const reply = await ctx.send('En Goya lavadora 3 PUSH PROG')
      expectMentionsAll(reply, ['program'])
      expectMentionsNone(reply, ['donde', 'lavanderia', 'lavadora o secadora', 'numero de la lavadora'])
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '3',
        displayState: 'PUSH',
      })
    },
  },
  {
    // Cliente dà location + tipo + numero → bot chiede solo display.
    name: 'ES — "Estoy en Goya con la lavadora 5" → bot chiede solo il display',
    run: async (ctx) => {
      const reply = await ctx.send('Estoy en Goya con la lavadora 5')
      expectMentionsAll(reply, ['pantalla'])
      expectMentionsNone(reply, ['donde', 'lavadora o secadora', 'numero'])
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '5',
      })
    },
  },
  {
    // Word order libero: "Lavadora 3 Goya" deve dare lo stesso risultato.
    name: 'ES — "Lavadora 3 Goya" → bot chiede solo display (ordine libero)',
    run: async (ctx) => {
      const reply = await ctx.send('Lavadora 3 Goya')
      expectMentionsAll(reply, ['pantalla'])
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '3',
      })
    },
  },
  {
    // Mataró inline → estratto + bot disambigua tra Goya/Alemanya
    // (regola Mataró multi-strada).
    name: 'ES — "Estoy en Mataró con la lavadora 5" → bot disambigua tra Goya/Alemanya',
    run: async (ctx) => {
      const reply = await ctx.send('Estoy en Mataró con la lavadora 5')
      expectMentionsAll(reply, ['mataro', 'goya', 'alemanya'])
      expectStateHas(ctx.session, {
        location: 'Mataró',
        machineType: 'washer',
        machineNumber: '5',
      })
    },
  },
]
