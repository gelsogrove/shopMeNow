// Cross-test: Opzione B per casi 21-24 location-specific.
//
// Da docs/usecases.md:
//   - Caso 21 monedas no suman: documentato SOLO a Alemanya
//   - Caso 22 monedas no suman: documentato SOLO a Pineda
//   - Caso 23 no puedo pagar tarjeta: documentato SOLO a Alemanya
//   - Caso 24 no puedo pagar tarjeta: documentato SOLO a Hortes
//
// Regola: se cliente è in una location DOC → escalation standard ("Hay una
// información que necesitamos revisar manualmente"). Se è in altra
// location → escalation con messaggio differente ("No tenemos registrado
// este tipo de incidencia en X. Vamos a revisarlo manualmente.").

import { type TestCase, expectMentionsAll, expectMentionsNone } from '../_helpers.js'

export const tests: TestCase[] = [
  // ─── Monedas no suman ────────────────────────────────────────────────────
  {
    name: 'ES — Caso 21 monedas Alemanya (DOC): escalation standard',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send('Alemanya')
      expectMentionsAll(reply, ['revis', 'manual'])
      expectMentionsNone(reply, ['no tenemos registrado'])
    },
  },
  {
    name: 'ES — Caso 22 monedas Pineda (DOC): escalation standard',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['revis', 'manual'])
      expectMentionsNone(reply, ['no tenemos registrado'])
    },
  },
  {
    name: 'ES — Mismatch monedas Goya (NON DOC): "no tenemos registrado en Goya"',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['no tenemos registrado', 'goya'])
    },
  },
  {
    name: 'ES — Mismatch monedas Hortes (NON DOC)',
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send('Hortes')
      expectMentionsAll(reply, ['no tenemos registrado', 'hortes'])
    },
  },
  {
    name: "ES — Mismatch monedas L'Escala (NON DOC)",
    run: async (ctx) => {
      await ctx.send('He añadido tiempo a la secadora y no lo ha sumado')
      const reply = await ctx.send("L'Escala")
      expectMentionsAll(reply, ['no tenemos registrado', 'escala'])
    },
  },

  // ─── No tarjeta ──────────────────────────────────────────────────────────
  {
    name: 'ES — Caso 23 no tarjeta Alemanya (DOC): escalation standard',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con la tarjeta')
      const reply = await ctx.send('Alemanya')
      expectMentionsAll(reply, ['revis', 'manual'])
      expectMentionsNone(reply, ['no tenemos registrado'])
    },
  },
  {
    name: 'ES — Caso 24 no tarjeta Hortes (DOC): escalation standard',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con la tarjeta')
      const reply = await ctx.send('Hortes')
      expectMentionsAll(reply, ['revis', 'manual'])
      expectMentionsNone(reply, ['no tenemos registrado'])
    },
  },
  {
    name: 'ES — Mismatch no tarjeta Goya (NON DOC)',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con la tarjeta')
      const reply = await ctx.send('Goya')
      expectMentionsAll(reply, ['no tenemos registrado', 'goya'])
    },
  },
  {
    name: 'ES — Mismatch no tarjeta Pineda (NON DOC)',
    run: async (ctx) => {
      await ctx.send('No puedo pagar con la tarjeta')
      const reply = await ctx.send('Pineda')
      expectMentionsAll(reply, ['no tenemos registrado', 'pineda'])
    },
  },
  {
    name: "ES — Mismatch no tarjeta L'Escala (NON DOC)",
    run: async (ctx) => {
      await ctx.send('No puedo pagar con la tarjeta')
      const reply = await ctx.send("L'Escala")
      expectMentionsAll(reply, ['no tenemos registrado', 'escala'])
    },
  },
]
