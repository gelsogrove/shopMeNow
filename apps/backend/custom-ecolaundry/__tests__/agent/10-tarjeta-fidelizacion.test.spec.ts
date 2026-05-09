// 10 — Caso 10 Cómo comprar la tarjeta de fidelización
//
// Da usecases.md Caso 10 (alineado al Playbook PDF §5.9):
//   - Resposta canónica: 20 € en efectivo + sólo funciona en la tienda
//     donde se ha comprado.
//   - Si el cliente da la location: el bot añade la instrucción específica
//     del local (Goya/Pineda: "segundo botón de la línea de la derecha en
//     la central de botones"), leída de locations.json:faqOverrides.
//   - No se piden tipo de máquina, número, ni display: es una FAQ.
//   - Bug regression: tras "Entendido" el bot cierra educadamente, NO inicia
//     gather de máquina (lavadora/secadora).
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 3 test → 1 (eliminato il pattern "1 test = 1 turno").

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 10: happy path completo → 20€/efectivo → Goya override → Entendido → closure (no machine gather)',
    run: async (ctx) => {
      // T1 — trigger → bot risponde con frase canonica (20€ + efectivo) e chiede location
      const t1 = await ctx.send('¿cómo consigo la tarjeta de fidelización?')
      expectMentionsAll(t1, ['20', 'efectivo', 'lavanderia'])
      // T2 — location Goya → bot aggiunge override location-aware
      // (segundo botón de la línea de la derecha) da locations.json:faqOverrides
      const t2 = await ctx.send('Estoy en Goya')
      expectMentionsAll(t2, ['segundo', 'boton', 'derecha'])
      // T3 — cliente conferma → bot chiude educatamente.
      // Bug regression: NON deve iniziare gather macchina (lavadora/secadora/pantalla/numero).
      const t3 = await ctx.send('Entendido')
      const t3Lower = t3.toLowerCase()
      if (/lavadora.*secadora|secadora.*lavadora|qu[eé]\s+aparece\s+en\s+la\s+pantalla|n[uú]mero\s+de\s+(?:la\s+)?(?:lavadora|secadora)/i.test(t3Lower)) {
        throw new Error(`Caso 10 closure: bot deve chiudere, NON gather machine: ${t3}`)
      }
    },
  },
]
