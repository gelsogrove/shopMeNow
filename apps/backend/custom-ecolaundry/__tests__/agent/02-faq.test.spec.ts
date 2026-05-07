// 02 — FAQ orari
//
// Customer chiede gli orari. Bot risponde in spagnolo con gli orari della
// lavandería. Senza una location specifica, il bot dà la risposta FAQ
// generica (8:00–22:00). Per L'Escala, l'override aggiunge il 7:00–23:00.
//
// Test rilassato: senza location, accettiamo solo l'orario generico
// (8:00 + 22:00). Il Caso L'Escala-specifico va testato in un test
// separato dopo aver settato la location.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — "hola que orario teneis?" → bot risponde con gli orari generici (8:00, 22:00)',
    run: async (ctx) => {
      const reply = await ctx.send('hola que orario teneis?')
      expectMentionsAll(reply, ['8:00', '22:00'])
    },
  },
]
