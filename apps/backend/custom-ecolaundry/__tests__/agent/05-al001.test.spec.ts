// 10 — Caso 5 Error AL001
//
// Da usecases.md Caso 5: dopo aver raccolto location + tipo + numero,
// il bot emette direttamente la sequenza dei 6 passi (carga → cierra →
// paga → selecciona número → programa → avísame). Solo se il cliente
// dice che NON funziona, il bot chiede il nome ed escala ad asistencia.
//
// Scenario 5.1 — Happy Path: "ya funciona" → resolved con "perfecto" + "comenzado".
// Scenario 5.2 — Escalación sin entender: "no entiendo" → re-ask code → escalate → name → "desactivado".
// Scenario 5.3 — Error persiste: "sigue saliendo" → re-ask code → "AL001" → escalate → name → "desactivado".

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 5 T2: dopo "Me sale AL001" + location, bot chiede tipo',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      const reply = await ctx.send("L'Escala")
      expectMentionsAll(reply, ['lavadora', 'secadora'])
    },
  },
  {
    name: 'ES — Caso 5 T3: dopo tipo, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      const reply = await ctx.send('Lavadora')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    // T4: dopo numero, il bot deve emettere direttamente i 6 passi della
    // sequenza corretta (carga → cierra → paga → número → programa →
    // avísame). NON deve escalare e NON deve chiedere "qué has hecho".
    name: 'ES — Caso 5 T4: dopo numero, bot emette i 6 passi della secuencia',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      const reply = await ctx.send('La 3')
      // Verifica menzione dei 6 passi chiave
      expectMentionsAll(reply, ['carga', 'cierra', 'paga', 'programa'])
      // Garanzia: NON deve escalare a questo step.
      const lower = reply.toLowerCase()
      if (/operador|revisi[oó]n\s+manual|c[oó]mo\s+te\s+llamas/.test(lower)) {
        throw new Error(`Caso 5 T4 non deve escalare, deve guidare i 6 passi: ${reply}`)
      }
    },
  },
  {
    // SCENARIO (regression dal playground): l'utente risponde "Lavadora" alla
    // domanda sul numero macchina invece di un numero. Il bot deve richiedere
    // il numero (NON deve escalare) e, una volta ricevuto il numero, deve
    // emettere i 6 passi della secuencia.
    // RULE: la ripetizione di "lavadora" come risposta sbagliata alla domanda
    // sul numero non deve far saltare il flusso Caso 5 verso l'escalation.
    name: 'ES — Caso 5 T4 con "Lavadora" ripetuta: bot richiede numero, poi 6 passi',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      // Risposta sbagliata: ripete "Lavadora" invece di dire il numero.
      const askAgain = await ctx.send('Lavadora')
      const askAgainLower = askAgain.toLowerCase()
      if (!/n[uú]mero/.test(askAgainLower)) {
        throw new Error(`Bot deve richiedere il numero macchina, non escalare: ${askAgain}`)
      }
      if (/manualmente|operador|revisi[oó]n|asistencia/.test(askAgainLower)) {
        throw new Error(`Bot non deve escalare quando l'utente ripete "Lavadora": ${askAgain}`)
      }
      // Ora il numero arriva: il bot deve emettere i 6 passi.
      const reply = await ctx.send('5')
      expectMentionsAll(reply, ['carga', 'cierra', 'paga', 'programa'])
      const lower = reply.toLowerCase()
      if (/manualmente|operador|revisi[oó]n\s+manual|c[oó]mo\s+te\s+llamas|me\s+puedes\s+dar\s+tu\s+nombre/.test(lower)) {
        throw new Error(`Caso 5 T5 non deve escalare dopo il numero: deve guidare i 6 passi: ${reply}`)
      }
    },
  },
  {
    // T5 happy: cliente conferma che funziona dopo i 6 passi → resolved.
    name: 'ES — Caso 5 T5 risolto: cliente "ya funciona" → bot chiude',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      const reply = await ctx.send('Ya funciona, gracias')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    // T5 escala (codice incluso nel messaggio): "sigue saliendo AL001" contiene
    // già il codice → il bot escalare direttamente (senza re-ask).
    name: 'ES — Caso 5 T5 escala con codice: "sigue saliendo AL001" → bot escala direttamente',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      const reply = await ctx.send('sigue saliendo AL001')
      const lower = reply.toLowerCase()
      // Deve indicare escalation (operador, revisión, asistencia, ...) E chiedere il nome.
      if (!/operador|revisi[oó]n|revisar|asistencia|manualmente/.test(lower)) {
        throw new Error(`Bot non escala: ${reply}`)
      }
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te|me\s+puedes\s+dar\s+tu\s+nombre/.test(lower)) {
        throw new Error(`Bot non chiede nome: ${reply}`)
      }
    },
  },
  {
    // Summary regression: deve menzionare AL001, location, machineNumber e
    // il motivo (sequenza corretta non ha risolto). Niente template buggati.
    name: 'ES — Caso 5 escalation summary: corretto e contestualizzato a AL001',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('La 3')
      await ctx.send('sigue saliendo AL001')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'AL001', '3'])
      const lower = reply.toLowerCase()
      if (!/escala/.test(lower)) {
        throw new Error(`Summary non contiene la location: ${reply}`)
      }
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },

  // ── Scenario 5.1 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 5.1 — Happy Path completo (Acceptance Criteria: "perfecto" + "comenzado"/"correctamente").
    // RULE: dopo le istruzioni AL001, se il cliente dice "ya funciona",
    // il bot chiude con un messaggio positivo che menziona l'avvio corretto.
    name: 'ES — Scenario 5.1: happy path completo → resolved con "comenzado"/"correctamente"',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      const reply = await ctx.send('Sí, ya funciona')
      const lower = reply.toLowerCase()
      if (!/perfecto|perfect/.test(lower)) {
        throw new Error(`Scenario 5.1: bot deve dire "perfecto": ${reply}`)
      }
      if (!/comenzad|correctament|resuelt/.test(lower)) {
        throw new Error(`Scenario 5.1: bot deve confermare avvio ("comenzado"/"correctamente"/"resuelto"): ${reply}`)
      }
    },
  },

  // ── Scenario 5.2 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 5.2 — Cliente non capisce le istruzioni.
    // RULE: "No entiendo cómo hacerlo" → il bot deve eventualmente escalare
    // (chiedendo il nome). "operador" deve comparire nella risposta che include
    // il nome-ask o nella conferma finale.
    name: 'ES — Scenario 5.2: "No entiendo" → escalation con nome',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      // Fase 1: cliente dice che non capisce. Il bot può fare re-ask del codice
      // OPPURE escalare direttamente.
      let reply = await ctx.send('No entiendo cómo hacerlo')
      const lower1 = reply.toLowerCase()
      const escalatesDirectly = /operador|revisi[oó]n|asistencia|manualmente/.test(lower1)
      const asksCode = /c[oó]digo|pantalla|aparece/.test(lower1)
      if (escalatesDirectly) {
        // Escalation diretta: il bot deve anche chiedere il nome
        if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower1)) {
          throw new Error(`Scenario 5.2: escalation diretta ma senza richiesta nome: ${reply}`)
        }
      } else if (asksCode) {
        // Re-ask del codice: il bot poi escalerà dopo il codice
        reply = await ctx.send('AL001')
        const lower2 = reply.toLowerCase()
        if (!/operador|revisi[oó]n|asistencia|manualmente/.test(lower2)) {
          throw new Error(`Scenario 5.2: dopo codice bot non escala: ${reply}`)
        }
        if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower2)) {
          throw new Error(`Scenario 5.2: escalation senza richiesta nome: ${reply}`)
        }
      } else {
        throw new Error(`Scenario 5.2: bot non escala né chiede codice dopo "No entiendo": ${reply}`)
      }
    },
  },
  {
    // SCENARIO 5.2 — Conferma finale contiene "desactivado".
    // RULE: dopo il nome, il bot dice che il chatbot sarà disattivato.
    name: 'ES — Scenario 5.2: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      let reply = await ctx.send('No entiendo cómo hacerlo')
      // Gestisce sia escalation diretta sia re-ask
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(reply.toLowerCase())) {
        reply = await ctx.send('AL001')
      }
      // Ora il bot ha chiesto il nome → invia il nome
      const finalReply = await ctx.send('María')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 5.2: conferma finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 5.2: conferma finale non menziona "operador": ${finalReply}`)
      }
    },
  },

  // ── Scenario 5.3 ─────────────────────────────────────────────────────────
  {
    // SCENARIO 5.3 — Errore persiste: il bot re-chiede il codice prima di escalare.
    // RULE (Acceptance Criteria 5.3): "sigue saliendo" (senza codice nel messaggio)
    // → il bot deve chiedere il codice esatto → poi escalare dopo "AL001".
    name: 'ES — Scenario 5.3: "sigue saliendo" → bot re-chiede codice',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      const reply = await ctx.send('Lo he hecho bien pero sigue saliendo')
      const lower = reply.toLowerCase()
      // Il bot deve chiedere il codice esatto (non escalare direttamente).
      if (!/c[oó]digo|pantalla|aparece/.test(lower)) {
        throw new Error(`Scenario 5.3: bot deve ri-chiedere il codice, non escalare subito: ${reply}`)
      }
    },
  },
  {
    // SCENARIO 5.3 — Dopo il re-ask, "AL001" → escalation + nome.
    name: 'ES — Scenario 5.3: dopo re-ask, "AL001" → escalate + chiede nome',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      await ctx.send('Lo he hecho bien pero sigue saliendo')
      const reply = await ctx.send('AL001')
      const lower = reply.toLowerCase()
      if (!/operador|revisi[oó]n|asistencia|manualmente/.test(lower)) {
        throw new Error(`Scenario 5.3: dopo conferma codice bot non escala: ${reply}`)
      }
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Scenario 5.3: escalation senza richiesta nome: ${reply}`)
      }
    },
  },
  {
    // SCENARIO 5.3 — Conferma finale contiene "desactivado".
    name: 'ES — Scenario 5.3: conferma finale contiene "desactivado"',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      await ctx.send('Lo he hecho bien pero sigue saliendo')
      await ctx.send('AL001')
      const finalReply = await ctx.send('Carlos')
      const lower = finalReply.toLowerCase()
      if (!/desactivado/.test(lower)) {
        throw new Error(`Scenario 5.3: conferma finale non contiene "desactivado": ${finalReply}`)
      }
      if (!/operador/.test(lower)) {
        throw new Error(`Scenario 5.3: conferma finale non menziona "operador": ${finalReply}`)
      }
    },
  },
  {
    // SCENARIO 5.3 — Summary operatore corretto (nome + location + numero + AL001).
    name: 'ES — Scenario 5.3: summary operatore contiene Carlos, L\'Escala, 3, AL001',
    run: async (ctx) => {
      await ctx.send('Me sale AL001')
      await ctx.send("L'Escala")
      await ctx.send('Lavadora')
      await ctx.send('3')
      await ctx.send('Lo he hecho bien pero sigue saliendo')
      await ctx.send('AL001')
      const finalReply = await ctx.send('Carlos')
      expectMentionsAll(finalReply, ['Carlos', 'AL001', '3'])
      if (/n[uú]mero\s+n[uú]mero/i.test(finalReply)) {
        throw new Error(`Bug "número número" in summary: ${finalReply}`)
      }
    },
  },
]
