// Standalone unit test for TARJETA_TOPIC regex (Caso 10 trigger detection).
//
// SCENARIO:
//   Customer asks about the loyalty card with various phrasings. The
//   TARJETA_TOPIC regex must match the canonical patterns AND the
//   permissive verb-adjective variants Andrea reported (F44).
//
// F44 — Andrea 2026-05-11: bot ignored "quiero comprar una nueva tarjeta"
// because the previous regex required "tarjeta" immediately after
// "quiero" + article. The new regex allows an optional action verb
// (comprar/tener/conseguir/sacar/adquirir) AND an optional adjective
// (nueva/otra/mi) between the intent verb and "tarjeta".
//
// Run with:
//   node --import tsx __tests__/unit/loyalty-card-buy.test.ts

import { TARJETA_TOPIC, detectBuyLocationInMessage } from '../../utils/guards/loyalty-card-buy.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── Canonical patterns (pre-F44 — must still match) ──────────────────────
  {
    name: 'canonical: "tarjeta de fidelización" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta de fidelización')) {
        throw new Error('canonical "tarjeta de fidelización" must match')
      }
    },
  },
  {
    name: 'canonical: "tarjeta de descuento" → match (F25)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta de descuento')) {
        throw new Error('"tarjeta de descuento" must match (F25)')
      }
    },
  },
  {
    name: 'canonical: "loyalty card" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('I want a loyalty card')) {
        throw new Error('"loyalty card" must match')
      }
    },
  },
  {
    name: 'canonical: "cómo consigo la tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('¿cómo consigo la tarjeta?')) {
        throw new Error('"cómo consigo la tarjeta" must match')
      }
    },
  },
  {
    name: 'canonical: "quiero la tarjeta" → match (F25)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta')) {
        throw new Error('"quiero la tarjeta" must match')
      }
    },
  },

  // ── F44 — verb + adjective between intent and "tarjeta" ─────────────────
  {
    name: 'F44: "quiero comprar una nueva tarjeta" → match (real customer chat)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero comprar una nueva tarjeta')) {
        throw new Error('F44: "quiero comprar una nueva tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "quiero comprar una tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero comprar una tarjeta')) {
        throw new Error('F44: "quiero comprar una tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "necesito una nueva tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('necesito una nueva tarjeta')) {
        throw new Error('F44: "necesito una nueva tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "necesito sacar la tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('necesito sacar la tarjeta')) {
        throw new Error('F44: "necesito sacar la tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "me gustaría tener una tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('me gustaría tener una tarjeta')) {
        throw new Error('F44: "me gustaría tener una tarjeta" must match')
      }
    },
  },
  {
    name: 'F44: "quisiera conseguir otra tarjeta" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('quisiera conseguir otra tarjeta')) {
        throw new Error('F44: "quisiera conseguir otra tarjeta" must match')
      }
    },
  },

  // ── F93 — IT colloquial vocabulary "tessera" + "fidelizzazione" ─────────
  // Andrea CLI 2026-05-23: real customer typed "come funziona la tessera di
  // fidelizzazione?" — bot drifted to howToUse FAQ. IT colloquial uses
  // "tessera" (not "carta") and "fidelizzazione" (not "fedeltà"). The detector
  // is used both by guardLoyaltyCardBuy directly AND by the F93 L4 safety gate
  // in guardFaqHowToUse, so coverage must be tight.
  {
    name: 'F93: "tessera di fidelizzazione" → match (IT real-bug Andrea 2026-05-23)',
    run: () => {
      if (!TARJETA_TOPIC.test('come funziona la tessera di fidelizzazione?')) {
        throw new Error('F93: IT "tessera di fidelizzazione" must match')
      }
    },
  },
  {
    name: 'F93: "tessera fidelizzazione" (without "di") → match',
    run: () => {
      if (!TARJETA_TOPIC.test('voglio info sulla tessera fidelizzazione')) {
        throw new Error('F93: IT "tessera fidelizzazione" (no preposition) must match')
      }
    },
  },
  {
    name: 'F93: "tessera di fedeltà" → match (alternate IT colloquial)',
    run: () => {
      if (!TARJETA_TOPIC.test('come prendo la tessera di fedeltà?')) {
        throw new Error('F93: IT "tessera di fedeltà" must match')
      }
    },
  },
  {
    name: 'F93: "tessera fedeltà" (without "di") → match',
    run: () => {
      if (!TARJETA_TOPIC.test('info tessera fedeltà')) {
        throw new Error('F93: IT "tessera fedeltà" (no preposition) must match')
      }
    },
  },
  {
    name: 'F93: legacy "carta fedeltà" → still matches (no regression)',
    run: () => {
      if (!TARJETA_TOPIC.test('come funziona la carta fedeltà?')) {
        throw new Error('F93: legacy IT "carta fedeltà" must still match (no regression)')
      }
    },
  },

  // ── F98 — cross-location possession/use patterns ─────────────────────────
  // Caso 10.2 trigger: customer already has a card from another location.
  // "tengo/ho/tinc/j'ai + tarjeta/tessera/targeta/carte" must match.
  {
    name: 'F98-ES: "Tengo la tarjeta de Pineda, ¿la puedo usar aquí?" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('Tengo la tarjeta de Pineda, ¿la puedo usar aquí?')) {
        throw new Error('F98-ES: possession pattern must match')
      }
    },
  },
  {
    name: 'F98-IT: "Ho comprato la tessera a Pineda, funziona anche qui?" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('Ho comprato la tessera a Pineda, funziona anche qui?')) {
        throw new Error('F98-IT: Italian possession pattern must match')
      }
    },
  },
  {
    name: 'F98-IT: "Ho la tessera di Pineda, vale qui?" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('Ho la tessera di Pineda, vale qui?')) {
        throw new Error('F98-IT: bare "ho la tessera" must match')
      }
    },
  },
  {
    name: 'F98-CA: "Tinc la targeta de Pineda, funciona aquí?" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('Tinc la targeta de Pineda, funciona aquí?')) {
        throw new Error('F98-CA: Catalan "tinc la targeta" must match')
      }
    },
  },
  {
    name: 'F98-EN: "I have a loyalty card from Hortes" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('I have a loyalty card from Hortes')) {
        throw new Error('F98-EN: "I have a loyalty card" must match')
      }
    },
  },
  {
    name: 'F98-PT: "Comprei o cartão em Hortes" → match',
    run: () => {
      if (!TARJETA_TOPIC.test('Comprei o cartão em Hortes')) {
        throw new Error('F98-PT: "comprei o cartão" must match')
      }
    },
  },
  {
    name: 'F98-FR: "j\'ai ma carte de fidélité de Pineda" → match',
    run: () => {
      if (!TARJETA_TOPIC.test("j'ai ma carte de fidélité de Pineda")) {
        throw new Error("F98-FR: \"j'ai ma carte\" must match")
      }
    },
  },
  {
    name: 'F98-negative: "tengo un problema con la lavadora" → no match',
    run: () => {
      if (TARJETA_TOPIC.test('tengo un problema con la lavadora')) {
        throw new Error('F98: "tengo un problema" without card word must NOT match')
      }
    },
  },

  // ── Negative cases — must NOT over-match ────────────────────────────────
  {
    name: 'negative: "no funciona la lavadora" → no match',
    run: () => {
      if (TARJETA_TOPIC.test('no funciona la lavadora')) {
        throw new Error('machine fault must NOT match tarjeta topic')
      }
    },
  },
  {
    name: 'negative: empty string → no match',
    run: () => {
      if (TARJETA_TOPIC.test('')) {
        throw new Error('empty string must NOT match')
      }
    },
  },
  {
    name: 'F93 negative: "tessera elettorale" → no match (not loyalty)',
    run: () => {
      // "tessera" is a common IT word for "card/badge"; the regex must
      // require the loyalty qualifier (fidelizzazione/fedeltà) — bare
      // "tessera" or other contexts must NOT trigger loyalty flow.
      if (TARJETA_TOPIC.test('ho perso la tessera elettorale')) {
        throw new Error('F93: bare "tessera" without loyalty qualifier must NOT match')
      }
    },
  },

  // ── Caso 36 — Cross-location loyalty card warning ─────────────────────
  // When the customer is at location X and mentions buying the card at
  // location Y, the guard must detect the foreign buy-location and return
  // the cross-location warning instead of the generic base reply.
  // Iron rule #8: detection covers 6 languages.
  {
    name: 'Caso36-ES: "compré la tarjeta en Pineda" → detects Pineda as buy-location',
    run: () => {
      const result = detectBuyLocationInMessage('compré la tarjeta en Pineda')
      if (result !== 'Pineda') {
        throw new Error(`Expected 'Pineda', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36-ES: "la compré en Goya" → detects Goya as buy-location',
    run: () => {
      const result = detectBuyLocationInMessage('la compré en Goya')
      if (result !== 'Goya') {
        throw new Error(`Expected 'Goya', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36-IT: "ho comprato la tessera a Pineda" → detects Pineda',
    run: () => {
      const result = detectBuyLocationInMessage('ho comprato la tessera a Pineda')
      if (result !== 'Pineda') {
        throw new Error(`Expected 'Pineda', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36-CA: "vaig comprar la targeta a Alemanya" → detects Alemanya',
    run: () => {
      const result = detectBuyLocationInMessage('vaig comprar la targeta a Alemanya')
      if (result !== 'Alemanya') {
        throw new Error(`Expected 'Alemanya', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36-EN: "I bought it at Goya" → detects Goya',
    run: () => {
      const result = detectBuyLocationInMessage('I bought it at Goya')
      if (result !== 'Goya') {
        throw new Error(`Expected 'Goya', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36-PT: "comprei o cartão em Hortes" → detects Hortes',
    run: () => {
      const result = detectBuyLocationInMessage('comprei o cartão em Hortes')
      if (result !== 'Hortes') {
        throw new Error(`Expected 'Hortes', got '${result}'`)
      }
    },
  },
  {
    name: "Caso36-FR: \"je l'ai achetée à Pineda\" → detects Pineda",
    run: () => {
      const result = detectBuyLocationInMessage("je l'ai achetée à Pineda")
      if (result !== 'Pineda') {
        throw new Error(`Expected 'Pineda', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36: no location mention → returns null',
    run: () => {
      const result = detectBuyLocationInMessage('quiero saber si funciona aquí')
      if (result !== null) {
        throw new Error(`Expected null, got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36: message mentions current location only → returns null (no foreign location)',
    run: () => {
      // With currentLocation='Mataró', the detector skips Mataró and finds
      // no other location → null. The guard correctly emits no cross-location warning.
      const result = detectBuyLocationInMessage('Estoy en Mataró', 'Mataró')
      if (result !== null) {
        throw new Error(`Expected null (same location filtered out), got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36: message mentions both current and foreign location → returns foreign',
    run: () => {
      // Real customer input: "Estoy en Goya. Compré la tarjeta en Pineda."
      // Both locations appear in the text — the function must return the
      // FOREIGN one (Pineda), not the current one (Goya).
      const result = detectBuyLocationInMessage(
        'Estoy en Goya. Compré la tarjeta en Pineda.',
        'Goya',
      )
      if (result !== 'Pineda') {
        throw new Error(`Expected 'Pineda' (foreign), got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36-IT: message mentions both locations → returns foreign',
    run: () => {
      const result = detectBuyLocationInMessage(
        'Sono a Goya ma ho comprato la tessera a Pineda',
        'Goya',
      )
      if (result !== 'Pineda') {
        throw new Error(`Expected 'Pineda', got '${result}'`)
      }
    },
  },
  {
    name: 'Caso36: no currentLocation provided → falls back to first match',
    run: () => {
      // When called without currentLocation (e.g. location not yet known),
      // the function returns the first location found — backward-compatible.
      const result = detectBuyLocationInMessage('la compré en Goya')
      if (result !== 'Goya') {
        throw new Error(`Expected 'Goya', got '${result}'`)
      }
    },
  },
]

async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
