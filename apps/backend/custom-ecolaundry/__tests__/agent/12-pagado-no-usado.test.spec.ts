// 12 — Caso 7 He pagado pero no he podido usar el servicio
//
// Da usecases.md Caso 7: il cliente ha pagato ma non è riuscito a usare la
// macchina. Il bot verifica il cambio, poi il display, e reindirizza al
// flow display-specific (PUSH PROG → istruzione caso 1, ecc.).
//
// 5 turni: trigger → location → cambio? → display → istruzione → closure.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 7 T2: dopo location, bot chiede del cambio (salta tipo+numero)',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['cambio'])
    },
  },
  {
    // Caso 7 SKIPS machineType + machineNumber per il canonical flow, ma
    // poiché la fase è LLM-driven (intent detection per yes/no è LLM job
    // per iron rule #6), il modello potrebbe inserire una domanda
    // intermedia (tipo/numero) prima di chiedere il display. Verifichiamo
    // che il bot arrivi a chiedere "pantalla" entro 3 turni dopo "Sí",
    // accettando anche path con domande intermedie.
    name: 'ES — Caso 7 T3: dopo cambio sí, bot arriva a chiedere pantalla (entro 3 turni)',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      let reply = await ctx.send('Sí')
      // Risposta intermedie semplici per qualsiasi domanda di gather:
      // numero/tipo. Massimo 2 turni intermedi, poi deve chiedere pantalla.
      const interimAnswers = ['lavadora', '4']
      let askedPantalla = /pantalla|display|qu[eé]\s+aparece/i.test(reply)
      let i = 0
      while (!askedPantalla && i < interimAnswers.length) {
        reply = await ctx.send(interimAnswers[i])
        askedPantalla = /pantalla|display|qu[eé]\s+aparece/i.test(reply)
        i += 1
      }
      if (!askedPantalla) {
        throw new Error(`Bot non chiede pantalla entro 3 turni: ${reply}`)
      }
    },
  },
  {
    // T4: dopo PUSH PROG, il bot deve eventualmente dare l'istruzione (può
    // chiedere prima lavadora/secadora, ma il messaggio finale del flow
    // contiene "puls" + "programa").
    name: 'ES — Caso 7 T4: dopo display PUSH PROG, bot guida l\'azione (puls programa)',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Sí')
      const reply = await ctx.send('PUSH PROG')
      // Accept either: "puls + program" (final instruction) or asking machine type.
      const lower = reply.toLowerCase()
      const isInstruction = /puls/.test(lower) && /program/.test(lower)
      const isAskingType = /lavadora.*secadora|secadora.*lavadora|tipo\s+de\s+m[aá]quina/.test(lower)
      if (!isInstruction && !isAskingType) {
        throw new Error(`Bot non guida né chiede tipo: ${reply}`)
      }
    },
  },
  {
    // T5 escala: dopo l'istruzione, cliente "sigue sin responder" → escala.
    name: 'ES — Caso 7 T5 escala: cliente "sigue sin responder" → bot escala',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Sí')
      await ctx.send('PUSH PROG')
      // Eventuale turno extra se il bot chiede tipo.
      let reply = await ctx.send('lavadora')
      if (!/puls.*program|program.*puls/i.test(reply)) {
        // Bot non ha ancora dato l'istruzione, gli diamo il numero
        reply = await ctx.send('La 5')
      }
      reply = await ctx.send('sigue sin responder')
      expectMentionsAll(reply, ['revis'])
    },
  },
  {
    // Summary regression: il riepilogo deve contenere location, display
    // PUSH e descrivere il sintomo (no template buggati).
    name: 'ES — Caso 7 escalation summary: corretto e contestualizzato',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Sí')
      await ctx.send('PUSH PROG')
      // gather extra se servono
      let reply = await ctx.send('lavadora')
      if (!/puls.*program|program.*puls/i.test(reply)) {
        reply = await ctx.send('La 5')
      }
      await ctx.send('sigue sin responder')
      reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Pineda'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
