// 08 — Caso 8 cliente con codice + importe pendiente
//
// Da docs/usecases.md Caso 8:
//   USER: Tengo un código y no sé cómo usarlo.
//   BOT:  Te ayudo. Dime el código exacto tal como lo ves, incluyendo
//         letras si las hay.
//   USER: AB12345.
//   BOT:  Gracias. ¿En qué lavandería lo quieres usar?
//   USER: Goya.
//   BOT:  Perfecto. ¿Te falta una pequeña parte para completar el importe
//         o el código cubre un importe mayor?
//   USER: Me falta un poco.
//   BOT:  De acuerdo. Introduce en la central el importe que falta y no
//         toques nada más. Después ponte delante de la máquina y dime si
//         ya puedes continuar.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 8 T1: bot chiede codice esatto incluyendo letras',
    run: async (ctx) => {
      const reply = await ctx.send('Tengo un código y no sé cómo usarlo.')
      expectMentionsAll(reply, ['codigo', 'letras'])
    },
  },
  {
    name: 'ES — Caso 8 T2: dopo codice alfanumerico, bot chiede location',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      const reply = await ctx.send('AB12345')
      expectMentionsAll(reply, ['lavanderia'])
    },
  },
  {
    name: 'ES — Caso 8 T3: dopo location, bot chiede se manca importe o copre di più',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('AB12345')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['falta', 'importe'])
    },
  },
  {
    name: 'ES — Caso 8 T4: dopo "me falta un poco", bot dà istruzione central + máquina',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('AB12345')
      await ctx.send('Goya')
      const reply = await ctx.send('Me falta un poco')
      expectMentionsAll(reply, ['central', 'importe', 'maquina'])
    },
  },
  {
    // BUG REGRESSION: prima del fix, dopo l'istruzione il flow chiudeva
    // (pendingFlow = '') e il "si" cadeva nella pipeline troubleshooting,
    // chiedendo "¿lavadora o secadora?" → loop infinito su displayState.
    // Il bot DEVE chiudere con "incidencia resuelta" e NON chiedere mai
    // tipo macchina / numero / pantalla.
    name: 'ES — Caso 8 T5 SI: dopo "si" il bot chiude con "incidencia resuelta"',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('AB12345')
      await ctx.send('Goya')
      await ctx.send('Me falta un poco')
      const reply = await ctx.send('si')
      expectMentionsAll(reply, ['resuelta'])
      // Garanzia: NON deve chiedere lavadora/secadora/pantalla.
      const lower = reply.toLowerCase()
      if (/lavadora|secadora|pantalla|qu[eé]\s+aparece/.test(lower)) {
        throw new Error(`Caso 8 T5 SI doveva chiudere ma è caduto nel troubleshooting: ${reply}`)
      }
    },
  },
  {
    // Path negativo: cliente dice che non funziona dopo aver inserito i soldi
    // → escalation a operatore con richiesta del nome del cliente.
    name: 'ES — Caso 8 T5 NO: dopo "no funciona" il bot escala chiedendo il nome',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('AB12345')
      await ctx.send('Goya')
      await ctx.send('Me falta un poco')
      const reply = await ctx.send('no funciona')
      expectMentionsAll(reply, ['operador'])
      // Deve anche chiedere il nome (qualunque variante: "te llamas", "tu nombre", ...)
      const lower = reply.toLowerCase()
      if (!/te\s+llamas|tu\s+nombre|nombre.*por\s+favor|c[oó]mo\s+te/.test(lower)) {
        throw new Error(`Bot non chiede il nome del cliente: ${reply}`)
      }
    },
  },
  {
    // BUG REGRESSION: il riepilogo Human Support per il Caso 8 deve
    // contenere il codice del cliente, la lavandería e il motivo specifico
    // (no genericamente "problema técnico"). Prima del fix, il summary
    // diceva "lavadora número número desconocido" + "seleccionó el programa
    // pero problema técnico" + nessuna menzione del codice.
    name: 'ES — Caso 8 escalation summary: contiene código + location + motivo specifico',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('A636363')
      await ctx.send('Goya')
      await ctx.send('Me falta un poco')
      await ctx.send('no funciona')
      const reply = await ctx.send('Andrea')
      // Il summary deve contenere: nome, location, codice, motivo Caso 8
      expectMentionsAll(reply, ['Andrea', 'Goya', 'A636363', 'codigo de descuento'])
      // Garanzie negative: NIENTE template buggato
      if (/n[uú]mero\s+n[uú]mero/i.test(reply)) {
        throw new Error(`Bug "número número" presente: ${reply}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(reply)) {
        throw new Error(`Frase nonsense "seleccionó el programa pero problema técnico" presente: ${reply}`)
      }
    },
  },
  {
    // BUG REGRESSION: typo nella lavandería ("Giya" invece di "Goya").
    // Prima del fix, il bot escalava direttamente al primo typo. Ora deve
    // riconoscere il fuzzy match (distanza 1) e procedere come se l'utente
    // avesse scritto "Goya".
    name: 'ES — Caso 8 typo location: "Giya" → fuzzy match a Goya, prosegue il flow',
    run: async (ctx) => {
      await ctx.send('Tengo un código y no sé cómo usarlo.')
      await ctx.send('AB12345')
      const reply = await ctx.send('Giya')
      expectMentionsAll(reply, ['falta', 'importe'])
      // NON deve escalare al typo.
      const lower = reply.toLowerCase()
      if (/operador|revisar.*manualmente|nombre.*por\s+favor/.test(lower)) {
        throw new Error(`Typo "Giya" non deve escalare immediatamente: ${reply}`)
      }
    },
  },
]
