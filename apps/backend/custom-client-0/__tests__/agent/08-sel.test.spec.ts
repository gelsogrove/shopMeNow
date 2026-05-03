// 08 — Caso 3 SEL
//
// Da 01usecaases.md Caso 3:
//   USER: He pagado pero la lavadora no empieza
//   BOT:  saluto + ¿en qué lavandería estás?
//   USER: Pineda
//   BOT:  ¿qué número de lavadora es?
//   USER: La 3
//   BOT:  ¿qué aparece exactamente en la pantalla? (salta pagado, già implicito da T1)
//   USER: SEL
//   BOT:  ese mensaje indica que la máquina está pendiente de selección;
//         comprueba que has pulsado bien el número de la máquina.
//   USER: ya lo he hecho y ahora sí funciona
//   BOT:  perfecto, incidencia resuelta
//
// Escalar si: el cliente ya ha repetido la selección y la máquina sigue sin responder.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 3 SEL istruzione: bot dice "pendiente de selección" + chiede di premere bene il numero',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      const reply = await ctx.send('SEL')
      // Istruzione SEL: "pendiente de selección" o "comprueba número"
      expectMentionsAll(reply, ['numero', 'maquina'])
    },
  },
  {
    name: 'ES — Caso 3 SEL risolto: cliente conferma "ahora sí funciona" → bot chiude (perfect, resuelt)',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      const reply = await ctx.send('ya lo he hecho y ahora sí funciona')
      expectMentionsAll(reply, ['perfect', 'resuelt'])
    },
  },
  {
    name: 'ES — Caso 3 SEL escalation: cliente ripete e dice "sigue igual" → bot escala (revis, llamas)',
    run: async (ctx) => {
      await ctx.send('He pagado pero la lavadora no empieza')
      await ctx.send('Pineda')
      await ctx.send('La 3')
      await ctx.send('SEL')
      const reply = await ctx.send('ya lo he hecho pero sigue igual')
      expectMentionsAll(reply, ['revis', 'llamas'])
    },
  },
]
