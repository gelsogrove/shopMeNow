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
    // → bot escala chiedendo il nome.
    name: 'ES — Caso 4 T7 escala: cliente "sigue sin activar" → bot escala',
    run: async (ctx) => {
      await ctx.send('He pagado y no se ha activado')
      await ctx.send('Goya')
      await ctx.send('Lavadora')
      await ctx.send('La 4')
      await ctx.send('No')
      const reply = await ctx.send('sigue sin activar')
      expectMentionsAll(reply, ['operador'])
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede nome: ${reply}`)
      }
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
