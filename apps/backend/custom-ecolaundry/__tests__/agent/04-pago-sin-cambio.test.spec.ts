// 04 — Caso 4 He pagado y no se ha activado, sin cambio
//
// Da usecases.md Caso 4: il cliente ha pagato ma la macchina non si è
// attivata e la centralina non ha restituito il resto. Il bot guida la
// verifica del numero macchina.
// 6 turni: location → tipo → numero → cambio → istruzione → closure.
//
// NOTA: questo caso ha un flow specifico (NO display, ma "¿cambio?") che
// si attiva grazie al pattern "He pagado.*no se (ha) activad".

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 4 T2: dopo trigger, bot chiede location',
    run: async (ctx) => {
      const reply = await ctx.send('He pagado y no se ha activado')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 4 T3: dopo location, bot chiede tipo macchina',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['lavadora'])
    },
  },
  {
    name: 'ES — Caso 4 T4: dopo tipo, bot chiede numero macchina',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      const reply = await ctx.send('Lavadora')
      expectMentionsAll(reply, ['numero'])
    },
  },
  {
    // Caratteristica unica del Caso 4: dopo il numero il bot chiede del
    // cambio (NON del display come negli altri casi).
    name: 'ES — Caso 4 T5: dopo numero, bot chiede del cambio (NO display)',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      const reply = await ctx.send('La 4')
      expectMentionsAll(reply, ['central', 'cambio'])
      // Garanzia: il bot non deve chiedere display per questo caso.
      if (/qu[eé]\s+aparece\s+(?:exactamente\s+)?en\s+la\s+pantalla/i.test(reply)) {
        throw new Error(`Caso 4 non deve chiedere display: ${reply}`)
      }
    },
  },
  {
    // Cliente dice "No" (no ha devuelto cambio) → bot dà l'istruzione
    // "marca bien el numero de la maquina" e attende conferma.
    name: 'ES — Caso 4 T6: cliente "No" al cambio → bot dà istruzione marca número',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      const reply = await ctx.send('No')
      expectMentionsAll(reply, ['numero', 'central'])
    },
  },
  {
    // Closure positiva: il cliente conferma che si è attivata.
    name: 'ES — Caso 4 T7 risolto: cliente "se ha puesto en marcha" → bot chiude',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      await ctx.send('No')
      const reply = await ctx.send('Sí, ahora ya se ha puesto en marcha')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    // Closure negativa: il cliente dice che la macchina sigue sin activar
    // → bot deve avviare l'escalation. Per architettura M3 (2-turn
    // protocol enforced by escalate_to_operator validator), il bot al
    // turno N CHIEDE il nome — la parola "operador" appare solo al turno
    // N+1 quando capture_customer_name + escalate_to_operator sono stati
    // chiamati. Verifichiamo entrambi i turni.
    name: 'ES — Caso 4 T7 escala: cliente "sigue sin activar" → bot chiede nome (M3) → escala con handover',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      await ctx.send('No')
      // Turn N: bot must ask the name (M3 protocol — no escalation yet).
      const askName = await ctx.send('sigue sin activar')
      const lowerAsk = askName.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lowerAsk)) {
        throw new Error(`Bot non chiede nome al turn N: ${askName}`)
      }
      // Turn N+1: customer gives name → bot escala con frase canonica.
      // La canonical phrase è "Vamos a revisar tu caso manualmente, <name>"
      // + il "Human Support message" handover. Verifichiamo il marker
      // strutturale (Human Support) e la presenza del nome.
      const escalation = await ctx.send('Andrea')
      const lowerEsc = escalation.toLowerCase()
      const escalated =
        /vamos\s+a\s+revisar|revisar\s+tu\s+caso\s+manualmente|human\s+support/i.test(escalation)
      if (!escalated) {
        throw new Error(`Bot non ha escalato al turn N+1: ${escalation}`)
      }
      expectMentionsAll(escalation, ['Andrea'])
      // Sanity: il summary handover deve menzionare Goya e la macchina 4.
      expectMentionsAll(escalation, ['goya', '4'])
      void lowerEsc
    },
  },
  {
    // Summary regression: deve contenere location, machineNumber e
    // descrivere il sintomo del Caso 4 (no display generico, no
    // "número número desconocido", no frase nonsense).
    name: 'ES — Caso 4 escalation summary: corretto e contestualizzato al Caso 4',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      await ctx.send('No')
      await ctx.send('sigue sin activar')
      const reply = await ctx.send('Andrea')
      expectMentionsAll(reply, ['Andrea', 'Goya', '4', 'pagado', 'activad'])
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense presente: ${reply}`)
      }
    },
  },
]
