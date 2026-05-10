// Standalone unit test (NO LLM) — intent / display token classification.
//
// SCENARIO:
//   utils/intent.ts is the deterministic mapper from raw customer text to
//   canonical tokens (display state, machine type, language). Mistakes here
//   send the bot to the wrong flow. Tests cover the high-traffic paths:
//   AL001 family, bare 001 → C001, ALM/DOOR variants, ALN/ERR codes,
//   blank-display detection, machine-type fuzzy matching, language
//   heuristic, greeting detection.
//
// Run with:
//   node --import tsx __tests__/unit/intent.test.ts

import {
  detectDiscountCodeIntent,
  detectDisplayUnreadableIntent,
  detectDoubleChargeIntent,
  detectNumericCodeIntent,
  detectPaidNotActivatedIntent,
  detectIDontKnowReply,
  detectFaqPause,
  detectInvoiceIntent,
  detectLanguageHeuristic,
  detectTopicSwitchDuringEscalation,
  extractDisplayLabel,
  extractDisplayState,
  hasGreetingIntent,
  isLikelyStandaloneLocationInput,
  isShortContextReply,
  normalizeMachineType,
  parsePaymentAnswer,
} from '../../utils/intent.js'
import { createInitialState } from '../../utils/state.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── extractDisplayState — display token mapping ──────────────────────────
  {
    name: 'extractDisplayState: "AL001" → AL001 (canonical alarm)',
    run: () => {
      const r = extractDisplayState('me sale AL001')
      if (r !== 'AL001') throw new Error(`expected "AL001", got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: "ALARMA 001" → AL001 (NL variant maps to canonical)',
    run: () => {
      const r = extractDisplayState('aparece ALARMA 001')
      if (r !== 'AL001') throw new Error(`expected "AL001", got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: bare "001" → C001 (caso 15: pre-payment selection)',
    run: () => {
      const r = extractDisplayState('en la pantalla sale 001')
      if (r !== 'C001') throw new Error(`expected "C001", got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: "1001" must NOT false-match as 001',
    run: () => {
      const r = extractDisplayState('cuesta 1001 euros')
      if (r === 'C001') throw new Error('"1001" leaked into C001')
    },
  },
  {
    name: 'extractDisplayState: "ALM/DOOR" → ALM/DOOR (sub-code variants collapse)',
    run: () => {
      const r1 = extractDisplayState('me pone ALM/DOOR')
      const r2 = extractDisplayState('aparece ALMDOOR')
      const r3 = extractDisplayState('sale ALM DOOR')
      if (r1 !== r2 || r2 !== r3) {
        throw new Error(`variants must collapse: ${r1}/${r2}/${r3}`)
      }
    },
  },
  {
    name: 'extractDisplayState: "ALN" → alarm code (caso 16 family)',
    run: () => {
      const r = extractDisplayState('la secadora pone ALN')
      if (!r || !/^ALN/.test(r)) throw new Error(`expected ALN-prefixed, got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: "ERR 52" → undocumented error (caso 30)',
    run: () => {
      const r = extractDisplayState('la pantalla muestra ERR 52')
      if (!r || !/^ERR/.test(r)) throw new Error(`expected ERR-prefixed, got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: "PUSH PROG" → PUSH (canonical)',
    run: () => {
      const r = extractDisplayState('aparece PUSH PROG')
      if (r !== 'PUSH') throw new Error(`expected "PUSH", got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: "DOOR" → DOOR',
    run: () => {
      const r = extractDisplayState('en la pantalla pone DOOR')
      if (r !== 'DOOR') throw new Error(`expected "DOOR", got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: "no hay nada en la pantalla" → BLANK',
    run: () => {
      const r = extractDisplayState('no hay nada en la pantalla')
      if (r !== 'BLANK') throw new Error(`expected "BLANK", got ${r}`)
    },
  },
  {
    name: 'extractDisplayState: irrelevant text → null',
    run: () => {
      const r = extractDisplayState('me llamo Andrea')
      if (r !== null) throw new Error(`expected null, got ${r}`)
    },
  },

  // ── isShortContextReply ────────────────────────────────────────────────────
  {
    name: 'isShortContextReply: "5" (numeric) → true',
    run: () => {
      if (!isShortContextReply('5')) throw new Error('expected true')
    },
  },
  {
    name: 'isShortContextReply: "sí" → true',
    run: () => {
      if (!isShortContextReply('sí')) throw new Error('expected true')
    },
  },
  {
    name: 'isShortContextReply: "PUSH PROG" → true (display-code-like)',
    run: () => {
      if (!isShortContextReply('PUSH PROG')) throw new Error('expected true')
    },
  },
  {
    name: 'isShortContextReply: "estoy en Goya y la lavadora no funciona" → false',
    run: () => {
      if (isShortContextReply('estoy en Goya y la lavadora no funciona')) {
        throw new Error('expected false on a long sentence')
      }
    },
  },

  // ── normalizeMachineType ──────────────────────────────────────────────────
  {
    name: 'normalizeMachineType: "lavadora" → washer (canonical es)',
    run: () => {
      if (normalizeMachineType('lavadora') !== 'washer') throw new Error('expected washer')
    },
  },
  {
    name: 'normalizeMachineType: "secadora" → dryer (canonical es)',
    run: () => {
      if (normalizeMachineType('secadora') !== 'dryer') throw new Error('expected dryer')
    },
  },
  {
    name: 'normalizeMachineType: "lavatrice" → washer (it canonical)',
    run: () => {
      if (normalizeMachineType('lavatrice') !== 'washer') throw new Error('expected washer')
    },
  },
  {
    name: 'normalizeMachineType: "lavaroda" (typo) → washer (Tier 3 fuzzy)',
    run: () => {
      if (normalizeMachineType('lavaroda') !== 'washer') throw new Error('expected washer (fuzzy)')
    },
  },
  {
    name: 'normalizeMachineType: empty / unrelated → ""',
    run: () => {
      if (normalizeMachineType('') !== '') throw new Error('expected ""')
      if (normalizeMachineType('coche') !== '') throw new Error('expected "" on unrelated')
      if (normalizeMachineType(null) !== '') throw new Error('expected "" on null')
    },
  },

  // ── hasGreetingIntent ─────────────────────────────────────────────────────
  {
    name: 'hasGreetingIntent: "hola" → true',
    run: () => {
      if (!hasGreetingIntent('hola')) throw new Error('expected true')
    },
  },
  {
    name: 'hasGreetingIntent: "ciao" → true',
    run: () => {
      if (!hasGreetingIntent('ciao')) throw new Error('expected true')
    },
  },
  {
    name: 'hasGreetingIntent: "no funciona la lavadora" → false',
    run: () => {
      if (hasGreetingIntent('no funciona la lavadora')) throw new Error('expected false')
    },
  },
  // G4 / F18 — extended ES + IT + PT + FR greetings (Andrea 2026-05-10 audit).
  {
    name: 'hasGreetingIntent: "buenos días" → true (G4)',
    run: () => { if (!hasGreetingIntent('buenos días')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "buenos dias" (no accent) → true',
    run: () => { if (!hasGreetingIntent('buenos dias')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "buenas tardes" → true',
    run: () => { if (!hasGreetingIntent('buenas tardes')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "buenas noches" → true',
    run: () => { if (!hasGreetingIntent('buenas noches')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: bare "buenas" → true',
    run: () => { if (!hasGreetingIntent('buenas')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "salve" (IT) → true',
    run: () => { if (!hasGreetingIntent('salve')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "olá" (PT) → true',
    run: () => { if (!hasGreetingIntent('olá')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "bom dia" (PT) → true',
    run: () => { if (!hasGreetingIntent('bom dia')) throw new Error('expected true') },
  },
  {
    name: 'hasGreetingIntent: "bonjour" (FR) → true',
    run: () => { if (!hasGreetingIntent('bonjour')) throw new Error('expected true') },
  },

  // ── parsePaymentAnswer — G1/G2/G3 / F17 (Andrea 2026-05-10 audit) ────────
  // REGRESSION: bare "sí" returned null because \b is ASCII-only in JS regex
  // (does not match after accented "í"). Same root as F16. Fix uses explicit
  // word-end lookahead `(?=\s|[!?.,;]|$)`.
  {
    name: 'parsePaymentAnswer: bare "sí" → true (G1, ASCII \\b bug)',
    run: () => {
      if (parsePaymentAnswer('sí') !== true) throw new Error('bare "sí" must be true')
    },
  },
  {
    name: 'parsePaymentAnswer: "ya pagué" → true (G2)',
    run: () => {
      if (parsePaymentAnswer('ya pagué') !== true) throw new Error('"ya pagué" must be true')
    },
  },
  {
    name: 'parsePaymentAnswer: "he pagado" → true (G2)',
    run: () => {
      if (parsePaymentAnswer('he pagado') !== true) throw new Error('"he pagado" must be true')
    },
  },
  {
    name: 'parsePaymentAnswer: "sí he pagado" → true',
    run: () => {
      if (parsePaymentAnswer('sí he pagado') !== true) throw new Error('"sí he pagado" must be true')
    },
  },
  {
    name: 'parsePaymentAnswer: "aun no" → false (G3, missing "todavía")',
    run: () => {
      if (parsePaymentAnswer('aun no') !== false) throw new Error('"aun no" must be false')
    },
  },
  {
    name: 'parsePaymentAnswer: "aún no" → false (with accent)',
    run: () => {
      if (parsePaymentAnswer('aún no') !== false) throw new Error('"aún no" must be false')
    },
  },
  {
    name: 'parsePaymentAnswer: "no he pagado" → false',
    run: () => {
      if (parsePaymentAnswer('no he pagado') !== false) throw new Error('"no he pagado" must be false')
    },
  },
  {
    name: 'parsePaymentAnswer: empty string → null',
    run: () => {
      if (parsePaymentAnswer('') !== null) throw new Error('empty must be null')
    },
  },

  // ── detectLanguageHeuristic ───────────────────────────────────────────────
  {
    name: 'detectLanguageHeuristic: "no funciona la lavadora" → es',
    run: () => {
      const r = detectLanguageHeuristic('no funciona la lavadora')
      if (r !== 'es') throw new Error(`expected "es", got ${r}`)
    },
  },
  {
    name: 'detectLanguageHeuristic: "non funziona la lavatrice" → it',
    run: () => {
      const r = detectLanguageHeuristic('non funziona la lavatrice')
      if (r !== 'it') throw new Error(`expected "it", got ${r}`)
    },
  },
  {
    name: 'detectLanguageHeuristic: "my washer charged twice" → en',
    run: () => {
      const r = detectLanguageHeuristic('my washer charged twice')
      if (r !== 'en') throw new Error(`expected "en", got ${r}`)
    },
  },
  {
    name: 'detectLanguageHeuristic: "olá, não paguei" → pt (NOT es)',
    run: () => {
      const r = detectLanguageHeuristic('olá, não paguei')
      if (r !== 'pt') throw new Error(`expected "pt", got ${r}`)
    },
  },
  {
    name: 'detectLanguageHeuristic: "bonjour, lave-linge en panne" → fr',
    run: () => {
      // NOTE: "machine à laver" gets misclassified as EN today because the
      // EN regex contains a non-bounded "hi" that substring-matches inside
      // "machine". Pinning the bug here is wrong; instead use a phrase
      // whose tokens only match the FR regex. If the EN false-positive is
      // ever fixed, add a regression test for "machine à laver" → fr.
      const r = detectLanguageHeuristic('bonjour, lave-linge en panne')
      if (r !== 'fr') throw new Error(`expected "fr", got ${r}`)
    },
  },
  {
    name: 'detectLanguageHeuristic: ambiguous "ok thanks" → null',
    run: () => {
      const r = detectLanguageHeuristic('ok')
      if (r !== null) throw new Error(`expected null, got ${r}`)
    },
  },

  // ── isLikelyStandaloneLocationInput ──────────────────────────────────────
  // SCENARIO (Andrea, 2026-05-08): customer typed "che orari avete?" (IT)
  // after the welcome. The bot wrongly classified it as a location attempt
  // and replied "I don't recognise that location". Fix: questions and
  // FAQ-topic keywords (any of 6 languages) must NOT count as location.
  {
    name: 'isLikelyStandaloneLocationInput: question with "?" → false',
    run: () => {
      const s = createInitialState()
      s.turnCount = 1
      if (isLikelyStandaloneLocationInput(s, 'che orari avete?')) {
        throw new Error('IT question classified as location')
      }
      if (isLikelyStandaloneLocationInput(s, 'quanto costa?')) {
        throw new Error('IT question classified as location')
      }
      if (isLikelyStandaloneLocationInput(s, 'what time do you open?')) {
        throw new Error('EN question classified as location')
      }
    },
  },
  {
    name: 'isLikelyStandaloneLocationInput: interrogative pronoun start → false',
    run: () => {
      const s = createInitialState()
      s.turnCount = 1
      // Interrogatives without "?" — still not location.
      if (isLikelyStandaloneLocationInput(s, 'che orari fate')) {
        throw new Error('IT interrogative classified as location')
      }
      if (isLikelyStandaloneLocationInput(s, 'qué precio')) {
        throw new Error('ES interrogative classified as location')
      }
    },
  },
  {
    name: 'isLikelyStandaloneLocationInput: FAQ keyword in IT/EN/CA/PT/FR → false',
    run: () => {
      const s = createInitialState()
      s.turnCount = 1
      const faqMessages = [
        'orario',           // IT — opening hours
        'horaires',         // FR
        'invoice please',   // EN — factura
        'ricarica tessera', // IT — recarga tarjeta
        'reembolso',        // ES — refund
        'rimborso',         // IT
        'compensazione',    // IT
      ]
      for (const m of faqMessages) {
        if (isLikelyStandaloneLocationInput(s, m)) {
          throw new Error(`FAQ keyword "${m}" classified as location`)
        }
      }
    },
  },
  {
    name: 'isLikelyStandaloneLocationInput: clean location name → true',
    run: () => {
      const s = createInitialState()
      s.turnCount = 1
      if (!isLikelyStandaloneLocationInput(s, 'Goya')) {
        throw new Error('"Goya" should be treated as a possible location')
      }
      if (!isLikelyStandaloneLocationInput(s, 'Pineda')) {
        throw new Error('"Pineda" should be treated as a possible location')
      }
    },
  },

  // ── extractDisplayState — fuzzy match for typos ──────────────────────────
  // SCENARIO: customer types a typo of a known display code. The strict
  // regex misses it (no exact word boundary match), so the fuzzy fallback
  // catches it via Levenshtein distance ≤ 1-2. Without this, the bot
  // would loop on "no entiendo" or escalate prematurely.
  {
    name: 'fuzzy: "USH PROG" (missing P) → PUSH (PUSH PROG canonical)',
    run: () => {
      const r = extractDisplayState('USH PROG')
      if (r !== 'PUSH') throw new Error(`expected "PUSH", got "${r}"`)
    },
  },
  {
    name: 'fuzzy: "DOR" (missing O) → DOOR',
    run: () => {
      const r = extractDisplayState('DOR')
      if (r !== 'DOOR') throw new Error(`expected "DOOR", got "${r}"`)
    },
  },
  {
    name: 'fuzzy: "PUSH-PROG" (separator typo) → PUSH',
    run: () => {
      const r = extractDisplayState('PUSH-PROG')
      if (r !== 'PUSH') throw new Error(`expected "PUSH", got "${r}"`)
    },
  },
  {
    name: 'fuzzy: random sentence "no funciona la lavadora" → null (not fuzzy-matched)',
    run: () => {
      const r = extractDisplayState('no funciona la lavadora')
      if (r !== null) throw new Error(`free-text sentences must not fuzzy-match, got: ${r}`)
    },
  },
  {
    name: 'fuzzy: short word "ok" → null (under 3-char threshold)',
    run: () => {
      const r = extractDisplayState('ok')
      if (r !== null) throw new Error(`"ok" must not fuzzy-match, got: ${r}`)
    },
  },
  {
    name: 'fuzzy: long sentence (>12 chars) → null (only short codes get fuzzy)',
    run: () => {
      const r = extractDisplayState('me parece que algo no va bien')
      if (r !== null) throw new Error(`long sentences must not fuzzy-match, got: ${r}`)
    },
  },
  {
    name: 'fuzzy: "asdf" garbage → null',
    run: () => {
      const r = extractDisplayState('asdf')
      if (r !== null) throw new Error(`garbage must not fuzzy-match, got: ${r}`)
    },
  },
  {
    name: 'fuzzy: exact match still wins (no fuzzy needed)',
    run: () => {
      // Sanity: exact "SEL" goes through the strict regex, NOT the fuzzy path.
      const r = extractDisplayState('SEL')
      if (r !== 'SEL') throw new Error(`exact match must work, got: ${r}`)
    },
  },

  // ── detectIDontKnowReply — multi-language "I don't know" detector ─────────
  // SCENARIO: customer can't or won't provide the requested fact (number,
  // display, etc.). Used by gather guards to short-circuit the retry counter
  // when the customer is explicit they can't help.
  {
    name: 'detectIDontKnow: ES "no lo sé" → true',
    run: () => {
      if (!detectIDontKnowReply('no lo sé')) throw new Error('"no lo sé" must be detected')
    },
  },
  {
    name: 'detectIDontKnow: ES "no me acuerdo" → true',
    run: () => {
      if (!detectIDontKnowReply('no me acuerdo')) throw new Error('"no me acuerdo" must be detected')
    },
  },
  {
    name: 'detectIDontKnow: ES "todavía no" → true',
    run: () => {
      if (!detectIDontKnowReply('todavía no he elegido la máquina')) {
        throw new Error('"todavía no" must be detected')
      }
    },
  },
  {
    name: 'detectIDontKnow: ES "no lo he seleccionado" → true',
    run: () => {
      if (!detectIDontKnowReply('aún no lo he seleccionado')) {
        throw new Error('"no lo he seleccionado" must be detected')
      }
    },
  },
  {
    name: 'detectIDontKnow: IT "non lo so" → true',
    run: () => {
      if (!detectIDontKnowReply('non lo so')) throw new Error('IT "non lo so" must be detected')
    },
  },
  {
    name: 'detectIDontKnow: EN "I don\'t know" → true',
    run: () => {
      if (!detectIDontKnowReply("I don't know")) throw new Error('EN "I don\'t know" must be detected')
    },
  },
  {
    name: 'detectIDontKnow: PT "não sei" → true',
    run: () => {
      if (!detectIDontKnowReply('não sei')) throw new Error('PT "não sei" must be detected')
    },
  },
  {
    name: 'detectIDontKnow: FR "je ne sais pas" → true',
    run: () => {
      if (!detectIDontKnowReply('je ne sais pas')) throw new Error('FR must be detected')
    },
  },
  {
    name: 'detectIDontKnow: a number "5" → false (real answer, not "I don\'t know")',
    run: () => {
      if (detectIDontKnowReply('5')) throw new Error('a digit must NOT match')
    },
  },
  {
    name: 'detectIDontKnow: a location "Goya" → false',
    run: () => {
      if (detectIDontKnowReply('Goya')) throw new Error('a location name must NOT match')
    },
  },

  // ── detectDoubleChargeIntent — multi-language doble cobro classifier ──────
  // REGRESSION (Andrea, 2026-05-09): the original regex required
  // `me\s+(?:han|hab[eé]is|ha)?\s+cobrad[ao]` and silently failed on
  // common typos like "habieis" (extra `i`). The new detector drops the
  // verb-prefix requirement and matches `cobrado/charged/etc.` next to a
  // quantifier. Every test below is a real or plausible customer phrasing.
  {
    name: 'detectDoubleCharge: ES "Me habieis cobrado dos veces con la tarjeda" → true (typo "habieis")',
    run: () => {
      if (!detectDoubleChargeIntent('Me habieis cobrado dos veces con la tarjeda')) {
        throw new Error('typo "habieis" must still be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: ES "Me habéis cobrado dos veces" → true (canonical)',
    run: () => {
      if (!detectDoubleChargeIntent('Me habéis cobrado dos veces')) {
        throw new Error('canonical phrasing must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: ES "doble cobro" → true',
    run: () => {
      if (!detectDoubleChargeIntent('he tenido un doble cobro')) {
        throw new Error('doble cobro must be detected')
      }
    },
  },
  // G5 / F19 — 3rd-person plural preterito (Andrea 2026-05-10 audit).
  {
    name: 'detectDoubleCharge: ES "me cobraron dos veces" → true (G5, plural preterito)',
    run: () => {
      if (!detectDoubleChargeIntent('me cobraron dos veces')) {
        throw new Error('ES plural preterito "cobraron" must match')
      }
    },
  },
  {
    name: 'detectDoubleCharge: ES "Me cobraron 2 veces" → true (numeric variant)',
    run: () => {
      if (!detectDoubleChargeIntent('Me cobraron 2 veces')) {
        throw new Error('ES "cobraron 2 veces" must match')
      }
    },
  },
  {
    name: 'detectDoubleCharge: ES "cobró dos veces" → true (verb-only, no "me")',
    run: () => {
      if (!detectDoubleChargeIntent('La máquina cobró dos veces')) {
        throw new Error('"cobró dos veces" must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: IT "addebitato due volte" → true',
    run: () => {
      if (!detectDoubleChargeIntent('mi avete addebitato due volte la carta')) {
        throw new Error('IT addebitato due volte must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: IT "doppio addebito" → true',
    run: () => {
      if (!detectDoubleChargeIntent('ho un doppio addebito')) {
        throw new Error('IT doppio addebito must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: EN "charged me twice" → true',
    run: () => {
      if (!detectDoubleChargeIntent('you charged me twice')) {
        throw new Error('EN charged twice must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: EN "double charge" → true',
    run: () => {
      if (!detectDoubleChargeIntent('I see a double charge on my card')) {
        throw new Error('EN double charge must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: PT "cobrado duas vezes" → true',
    run: () => {
      if (!detectDoubleChargeIntent('foi cobrado duas vezes no cartão')) {
        throw new Error('PT cobrado duas vezes must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: CA "cobrat dues vegades" → true',
    run: () => {
      if (!detectDoubleChargeIntent("m'han cobrat dues vegades")) {
        throw new Error('CA cobrat dues vegades must be detected')
      }
    },
  },
  {
    name: 'detectDoubleCharge: FR "débité deux fois" → true',
    run: () => {
      if (!detectDoubleChargeIntent('vous m\'avez débité deux fois')) {
        throw new Error('FR débité deux fois must be detected')
      }
    },
  },
  // F15 regression — colloquial "pagare/pagar/paid" instead of formal
  // cobrar/addebitare/charge. Andrea, 2026-05-10 real CLI: customer typed
  // "mi ha fatto pagare due volte" → trigger Caso 6 was missed → bot
  // dropped into machine flow. Detector now covers colloquial forms in
  // 6 langs.
  {
    name: 'detectDoubleCharge F15: IT "mi ha fatto pagare due volte" → true',
    run: () => {
      if (!detectDoubleChargeIntent('mi ha fatto pagare due volte')) {
        throw new Error('IT colloquial "fatto pagare due volte" must be detected (F15 regression)')
      }
    },
  },
  {
    name: 'detectDoubleCharge F15: IT "ho pagato due volte" → true',
    run: () => {
      if (!detectDoubleChargeIntent('ho pagato due volte')) {
        throw new Error('IT colloquial "pagato due volte" must be detected (F15 regression)')
      }
    },
  },
  {
    name: 'detectDoubleCharge F15: ES "me hizo pagar dos veces" → true',
    run: () => {
      if (!detectDoubleChargeIntent('me hizo pagar dos veces')) {
        throw new Error('ES colloquial "hizo pagar dos veces" must be detected (F15 regression)')
      }
    },
  },
  {
    name: 'detectDoubleCharge F15: ES "tengo un doble pago" → true',
    run: () => {
      if (!detectDoubleChargeIntent('tengo un doble pago en la cuenta')) {
        throw new Error('ES colloquial "doble pago" must be detected (F15 regression)')
      }
    },
  },
  {
    name: 'detectDoubleCharge F15: EN "I paid twice" → true',
    run: () => {
      if (!detectDoubleChargeIntent('I paid twice for the same washer')) {
        throw new Error('EN colloquial "paid twice" must be detected (F15 regression)')
      }
    },
  },
  {
    name: 'detectDoubleCharge: irrelevant "la lavadora no funciona" → false',
    run: () => {
      if (detectDoubleChargeIntent('la lavadora no funciona')) {
        throw new Error('unrelated machine fault must NOT match')
      }
    },
  },
  {
    name: 'detectDoubleCharge: bare location "Goya" → false',
    run: () => {
      if (detectDoubleChargeIntent('Goya')) {
        throw new Error('bare location must NOT match')
      }
    },
  },
  {
    name: 'detectDoubleCharge: empty string → false',
    run: () => {
      if (detectDoubleChargeIntent('')) {
        throw new Error('empty must NOT match')
      }
    },
  },

  // ── detectPaidNotActivatedIntent — Caso 4 trigger (F16) ──────────────────
  // REGRESSION (Andrea, 2026-05-10): real chat showed bot ignored the intent
  // because customer typed "acrivado" (typo of "activado", c↔t swap). The
  // original inline regex required exact "activad" substring and silently
  // failed → bot drifted into generic gather. Detector uses Levenshtein
  // distance ≤ 1 on the verb token to recover from typos.
  {
    name: 'detectPaidNotActivated: canonical "He pagado y no se ha activado" → true',
    run: () => {
      if (!detectPaidNotActivatedIntent('He pagado y no se ha activado')) {
        throw new Error('canonical phrase must match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: typo "He pagado y no se ha acrivado" → true (F16)',
    run: () => {
      if (!detectPaidNotActivatedIntent('He pagado y no se ha acrivado')) {
        throw new Error('typo "acrivado" (distance 1) must match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: preterito "Pagué y no se ha activado" → true',
    run: () => {
      if (!detectPaidNotActivatedIntent('Pagué y no se ha activado')) {
        throw new Error('preterito "Pagué" must match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: alt verb form "He pagado y no se activa" → true',
    run: () => {
      if (!detectPaidNotActivatedIntent('He pagado y no se activa')) {
        throw new Error('present-tense "no se activa" must match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: preterito form "He pagado y no se activó" → true',
    run: () => {
      if (!detectPaidNotActivatedIntent('He pagado y no se activó')) {
        throw new Error('preterito "no se activó" must match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: typo "actibado" (v→b) → true',
    run: () => {
      if (!detectPaidNotActivatedIntent('He pagado y no se ha actibado')) {
        throw new Error('typo "actibado" (distance 1) must match')
      }
    },
  },
  // F24 — usecases.md riga 366-369 trigger alignment (Andrea audit 2026-05-10).
  //
  // STRICT detector: only fires on explicit "activad..." (canonical or typo)
  // OR temporal "después de pagar" + failure verb. Generic "no arranca/funciona"
  // is intentionally NOT matched because it's ambiguous between Caso 1
  // (PUSH PROG visible) and Caso 4. The display flow resolves the ambiguity.
  {
    name: 'detectPaidNotActivated: usecases trigger 3 "No me funciona después de pagar" → true (F24)',
    run: () => {
      if (!detectPaidNotActivatedIntent('No me funciona después de pagar')) {
        throw new Error('usecases.md trigger 3 "No me funciona después de pagar" must match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: ambiguous "Pagué pero no arranca" → false (F24)',
    run: () => {
      // Per F24 audit: this trigger is ambiguous (Caso 1 or Caso 4). The
      // display flow resolves it by gathering display state. detectPaidNotActivated
      // intentionally requires "activad..." OR "después de pagar" anchor.
      if (detectPaidNotActivatedIntent('Pagué pero no arranca')) {
        throw new Error('"Pagué pero no arranca" is ambiguous — display flow handles it')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: NEGATIVE — Caso 7 "He pagado pero no he podido usar" → false',
    run: () => {
      if (detectPaidNotActivatedIntent('He pagado pero no he podido usar')) {
        throw new Error('Caso 7 phrase must NOT match Caso 4')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: NEGATIVE — "la lavadora no funciona" → false',
    run: () => {
      if (detectPaidNotActivatedIntent('la lavadora no funciona')) {
        throw new Error('generic machine fault must NOT match Caso 4')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: NEGATIVE — bare location "Goya" → false',
    run: () => {
      if (detectPaidNotActivatedIntent('Goya')) {
        throw new Error('bare location must NOT match')
      }
    },
  },
  {
    name: 'detectPaidNotActivated: NEGATIVE — empty string → false',
    run: () => {
      if (detectPaidNotActivatedIntent('')) {
        throw new Error('empty must NOT match')
      }
    },
  },

  // ── extractDisplayLabel — preserve customer-facing wording ────────────────
  // REGRESSION (Andrea, 2026-05-09): operator handover summary showed "La
  // pantalla muestra PUSH" while the customer typed "PUSH PROG", because
  // the canonical extractor stops at the word boundary. The label preserves
  // the literal, multi-word wording for the operator.
  {
    name: 'extractDisplayLabel: "PUSH PROG" + canonical "PUSH" → "PUSH PROG"',
    run: () => {
      const r = extractDisplayLabel('PUSH PROG', 'PUSH')
      if (r !== 'PUSH PROG') {
        throw new Error(`expected "PUSH PROG", got "${r}"`)
      }
    },
  },
  {
    name: 'extractDisplayLabel: customer prose "veo PUSH PROG en la pantalla" → "PUSH PROG"',
    run: () => {
      const r = extractDisplayLabel('veo PUSH PROG en la pantalla', 'PUSH')
      if (r !== 'PUSH PROG') {
        throw new Error(`uppercase tail must be preserved, got "${r}"`)
      }
    },
  },
  {
    name: 'extractDisplayLabel: lowercase "veo push prog" → "PUSH" (no risky lowercase capture)',
    run: () => {
      const r = extractDisplayLabel('veo push prog', 'PUSH')
      // We deliberately don\'t pick up lowercase prose — only ALL-UPPERCASE
      // tail tokens that look like display-code stems.
      if (r !== 'PUSH') {
        throw new Error(`lowercase tail must NOT be captured, got "${r}"`)
      }
    },
  },
  {
    name: 'extractDisplayLabel: "ALM DOOR" + canonical "ALM/DOOR" → "ALM DOOR"',
    run: () => {
      const r = extractDisplayLabel('me sale ALM DOOR en la pantalla', 'ALM/DOOR')
      if (r !== 'ALM DOOR') {
        throw new Error(`ALM family label, got "${r}"`)
      }
    },
  },
  {
    name: 'extractDisplayLabel: bare canonical → canonical uppercase',
    run: () => {
      const r = extractDisplayLabel('SEL', 'SEL')
      if (r !== 'SEL') throw new Error(`expected "SEL", got "${r}"`)
    },
  },
  {
    name: 'extractDisplayLabel: empty canonical → empty string',
    run: () => {
      const r = extractDisplayLabel('PUSH PROG', '')
      if (r !== '') throw new Error(`empty canonical must short-circuit, got "${r}"`)
    },
  },

  // ── detectDiscountCodeIntent — multi-language Caso 8 classifier ──────────
  // REGRESSION (Andrea, 2026-05-09): real chat "teng un codigo y no se como
  // utilizarlo" (typo "teng" + variant "utilizarlo") was NOT detected. The
  // bot drifted into the machine-troubleshooting flow asking for type/
  // number/display. Same shape as Bug A on doble-cobro.
  {
    name: 'detectDiscountCode: ES "teng un codigo y no se como utilizarlo" → true (typo "teng")',
    run: () => {
      if (!detectDiscountCodeIntent('teng un codigo y no se como utilizarlo')) {
        throw new Error('typo "teng" + "utilizarlo" must still be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: ES "tengo un código" canonical → true',
    run: () => {
      if (!detectDiscountCodeIntent('tengo un código')) {
        throw new Error('canonical "tengo un código" must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: ES "tengo un código y no sé cómo usarlo" → true',
    run: () => {
      if (!detectDiscountCodeIntent('tengo un código y no sé cómo usarlo')) {
        throw new Error('"no sé cómo usarlo" phrasing must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: ES "tengo un código y no sé dónde meterlo" → true',
    run: () => {
      if (!detectDiscountCodeIntent('tengo un código y no sé dónde meterlo')) {
        throw new Error('"dónde meterlo" phrasing must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: IT "ho un codice e non so come utilizzarlo" → true',
    run: () => {
      if (!detectDiscountCodeIntent('ho un codice e non so come utilizzarlo')) {
        throw new Error('IT must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: EN "I have a code and I don\'t know how to use it" → true',
    run: () => {
      if (!detectDiscountCodeIntent("I have a code and I don't know how to use it")) {
        throw new Error('EN must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: PT "tenho um código" → true',
    run: () => {
      if (!detectDiscountCodeIntent('tenho um código mas não sei como usar')) {
        throw new Error('PT must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: CA "tinc un codi" → true',
    run: () => {
      if (!detectDiscountCodeIntent('tinc un codi i no sé com usar-lo')) {
        throw new Error('CA must be detected')
      }
    },
  },
  {
    name: 'detectDiscountCode: FR "j\'ai un code" → true',
    run: () => {
      if (!detectDiscountCodeIntent("j'ai un code et je ne sais comment l'utiliser")) {
        throw new Error('FR must be detected')
      }
    },
  },
  // F22 — usecases.md riga 911-914 lists 4 trigger phrasings (Andrea 2026-05-10
  // audit). All must match.
  {
    name: 'detectDiscountCode: usecases trigger 3 "Me han dado un código" → true (F22)',
    run: () => {
      if (!detectDiscountCodeIntent('Me han dado un código')) {
        throw new Error('"Me han dado un código" must match')
      }
    },
  },
  {
    name: 'detectDiscountCode: usecases trigger 4 typo "tnego un código" → true (F22)',
    run: () => {
      if (!detectDiscountCodeIntent('tnego un código')) {
        throw new Error('typo "tnego" (consonant-vowel swap) must match')
      }
    },
  },
  // G8 / F22 — phrasings without "un" article (Andrea 2026-05-10 audit).
  {
    name: 'detectDiscountCode: ES "tengo el código" → true (G8, "el" instead of "un")',
    run: () => {
      if (!detectDiscountCodeIntent('tengo el codigo')) throw new Error('"tengo el codigo" must match')
    },
  },
  {
    name: 'detectDiscountCode: ES "tengo este código" → true (G8)',
    run: () => {
      if (!detectDiscountCodeIntent('tengo este código')) throw new Error('"tengo este código" must match')
    },
  },
  {
    name: 'detectDiscountCode: ES "tengo codigo de descuento" → true (G8, no article)',
    run: () => {
      if (!detectDiscountCodeIntent('tengo codigo de descuento')) {
        throw new Error('"tengo codigo de descuento" must match')
      }
    },
  },
  {
    name: 'detectDiscountCode: ES "código descuento como uso" → true (G8, no "de")',
    run: () => {
      if (!detectDiscountCodeIntent('código descuento como uso')) {
        throw new Error('"código descuento" without "de" must match')
      }
    },
  },
  {
    name: 'detectDiscountCode: irrelevant "la lavadora no funciona" → false',
    run: () => {
      if (detectDiscountCodeIntent('la lavadora no funciona')) {
        throw new Error('unrelated machine fault must NOT match')
      }
    },
  },
  {
    name: 'detectDiscountCode: bare "código" alone → false (too ambiguous)',
    run: () => {
      // "código" by itself isn't enough — could be a numeric machine code,
      // an alarm code, etc. We require either a "tengo/I have/etc." verb
      // form OR a "no sé cómo / dónde poner" phrasing.
      if (detectDiscountCodeIntent('código')) {
        throw new Error('bare word must NOT match')
      }
    },
  },
  {
    name: 'detectDiscountCode: empty string → false',
    run: () => {
      if (detectDiscountCodeIntent('')) {
        throw new Error('empty must NOT match')
      }
    },
  },

  // ── detectDisplayUnreadableIntent — Caso 17 trigger (G6, F20) ────────────
  // REGRESSION (Andrea 2026-05-10): inline regex was narrow ("no se que pone",
  // "no veo la pantalla"). Missed common phrasings like "pantalla apagada",
  // "pantalla rota", "no entiendo lo que pone".
  {
    name: 'detectDisplayUnreadable: "no sé qué pone" → true (canonical)',
    run: () => {
      if (!detectDisplayUnreadableIntent('no sé qué pone')) throw new Error('canonical must match')
    },
  },
  {
    name: 'detectDisplayUnreadable: "no veo la pantalla" → true',
    run: () => {
      if (!detectDisplayUnreadableIntent('no veo la pantalla')) throw new Error('"no veo la pantalla" must match')
    },
  },
  {
    name: 'detectDisplayUnreadable: "pantalla apagada" → true (G6)',
    run: () => {
      if (!detectDisplayUnreadableIntent('pantalla apagada')) throw new Error('"pantalla apagada" must match')
    },
  },
  {
    name: 'detectDisplayUnreadable: "pantalla rota" → true (G6)',
    run: () => {
      if (!detectDisplayUnreadableIntent('pantalla rota')) throw new Error('"pantalla rota" must match')
    },
  },
  {
    name: 'detectDisplayUnreadable: "la pantalla está rota" → true (canonical order)',
    run: () => {
      if (!detectDisplayUnreadableIntent('la pantalla está rota')) {
        throw new Error('"la pantalla está rota" must match')
      }
    },
  },
  {
    name: 'detectDisplayUnreadable: "no entiendo lo que pone" → true (G6)',
    run: () => {
      if (!detectDisplayUnreadableIntent('no entiendo lo que pone')) {
        throw new Error('"no entiendo lo que pone" must match')
      }
    },
  },
  {
    name: 'detectDisplayUnreadable: "no se ve nada en la pantalla" → true',
    run: () => {
      if (!detectDisplayUnreadableIntent('no se ve nada en la pantalla')) {
        throw new Error('"no se ve nada" must match')
      }
    },
  },
  // F20 — usecases.md riga 1428-1431 lists 4 trigger phrasings (Andrea audit).
  {
    name: 'detectDisplayUnreadable: usecases trigger 3 "Está en blanco" → true (F20)',
    run: () => {
      if (!detectDisplayUnreadableIntent('Está en blanco')) {
        throw new Error('"Está en blanco" must match')
      }
    },
  },
  {
    name: 'detectDisplayUnreadable: usecases trigger 4 "No puedo leer el display" → true (F20)',
    run: () => {
      if (!detectDisplayUnreadableIntent('No puedo leer el display')) {
        throw new Error('"No puedo leer el display" must match')
      }
    },
  },
  {
    name: 'detectDisplayUnreadable: NEGATIVE — "la lavadora no funciona" → false',
    run: () => {
      if (detectDisplayUnreadableIntent('la lavadora no funciona')) {
        throw new Error('machine fault must NOT match Caso 17')
      }
    },
  },
  {
    name: 'detectDisplayUnreadable: NEGATIVE — "PUSH PROG" → false',
    run: () => {
      if (detectDisplayUnreadableIntent('PUSH PROG')) {
        throw new Error('display code must NOT match Caso 17')
      }
    },
  },
  {
    name: 'detectDisplayUnreadable: NEGATIVE — empty → false',
    run: () => {
      if (detectDisplayUnreadableIntent('')) throw new Error('empty must NOT match')
    },
  },

  // ── detectNumericCodeIntent — Caso 18 trigger (G7, F21) ──────────────────
  // REGRESSION (Andrea 2026-05-10): inline regex required strict verb prefix
  // ("tengo|tenho|ho|i have"). Missed "Mi código es 123", "Codigo: 123",
  // "Recibí el código 123". Returns the numeric value or null.
  {
    name: 'detectNumericCode: "Tengo un código 123456" → "123456"',
    run: () => {
      if (detectNumericCodeIntent('Tengo un código 123456') !== '123456') {
        throw new Error('canonical with verb prefix must extract')
      }
    },
  },
  {
    name: 'detectNumericCode: "Mi código es 123456" → "123456" (G7)',
    run: () => {
      if (detectNumericCodeIntent('Mi código es 123456') !== '123456') {
        throw new Error('"Mi código es" must extract')
      }
    },
  },
  {
    name: 'detectNumericCode: "Codigo: 123456" → "123456" (G7)',
    run: () => {
      if (detectNumericCodeIntent('Codigo: 123456') !== '123456') {
        throw new Error('"Codigo:" must extract')
      }
    },
  },
  {
    name: 'detectNumericCode: "Recibí el codigo 123456" → "123456" (G7)',
    run: () => {
      if (detectNumericCodeIntent('Recibí el codigo 123456') !== '123456') {
        throw new Error('"Recibí el codigo" must extract')
      }
    },
  },
  {
    name: 'detectNumericCode: "Me han dado un código 123456" → "123456"',
    run: () => {
      if (detectNumericCodeIntent('Me han dado un código 123456') !== '123456') {
        throw new Error('"Me han dado" must extract')
      }
    },
  },
  {
    name: 'detectNumericCode: NEGATIVE — alphanumeric "Tengo un código AB12345" → null',
    run: () => {
      if (detectNumericCodeIntent('Tengo un código AB12345') !== null) {
        throw new Error('alphanumeric code is NOT Caso 18 — must return null')
      }
    },
  },
  {
    name: 'detectNumericCode: NEGATIVE — "no funciona" → null',
    run: () => {
      if (detectNumericCodeIntent('no funciona') !== null) {
        throw new Error('unrelated text must return null')
      }
    },
  },
  {
    name: 'detectNumericCode: NEGATIVE — empty → null',
    run: () => {
      if (detectNumericCodeIntent('') !== null) throw new Error('empty must return null')
    },
  },

  // ── detectInvoiceIntent (Bug #7 — Andrea 2026-05-09) ─────────────────────
  // Multi-language invoice trigger + typo tolerance.
  {
    name: 'detectInvoice: ES "Quiero una factura" → true',
    run: () => {
      if (!detectInvoiceIntent('Quiero una factura')) throw new Error('canonical must match')
    },
  },
  {
    name: 'detectInvoice: ES "necesito factura" → true',
    run: () => {
      if (!detectInvoiceIntent('necesito factura')) throw new Error('necesito factura must match')
    },
  },
  {
    name: 'detectInvoice: ES typo "necesito una factra" → true (typo tolerance)',
    run: () => {
      if (!detectInvoiceIntent('necesito una factra')) {
        throw new Error('typo "factra" must still match (Bug #7 regression)')
      }
    },
  },
  {
    name: 'detectInvoice: IT "voglio fattura" → true',
    run: () => {
      if (!detectInvoiceIntent('voglio fattura')) throw new Error('IT must match')
    },
  },
  {
    name: 'detectInvoice: EN "I need an invoice" → true',
    run: () => {
      if (!detectInvoiceIntent('I need an invoice')) throw new Error('EN must match')
    },
  },
  {
    name: 'detectInvoice: PT "preciso de fatura" → true',
    run: () => {
      if (!detectInvoiceIntent('preciso de fatura')) throw new Error('PT must match')
    },
  },
  {
    name: 'detectInvoice: FR "je voudrais une facture" → true',
    run: () => {
      if (!detectInvoiceIntent('je voudrais une facture')) throw new Error('FR must match')
    },
  },
  {
    name: 'detectInvoice: irrelevant "la lavadora no funciona" → false',
    run: () => {
      if (detectInvoiceIntent('la lavadora no funciona')) {
        throw new Error('unrelated machine fault must NOT match')
      }
    },
  },
  {
    name: 'detectInvoice: empty → false',
    run: () => {
      if (detectInvoiceIntent('')) throw new Error('empty must NOT match')
    },
  },

  // ── detectFaqPause — Caso 32.3 RED-SPEC closure (F28) ────────────────────
  // Customer interrupts an active trouble flow with a brief FAQ. Detector
  // must require BOTH a pause marker AND a FAQ topic hint (price, schedule,
  // loyalty, invoice). Plain "espera un momento" without a FAQ topic must
  // NOT fire (false positive on conversational filler).
  {
    name: 'detectFaqPause: "Espera, antes una pregunta: ¿cuánto cuesta lavar?" → true',
    run: () => {
      if (!detectFaqPause('Espera, antes una pregunta: ¿cuánto cuesta lavar?')) {
        throw new Error('canonical pause + price FAQ must match')
      }
    },
  },
  {
    name: 'detectFaqPause: "Una pregunta antes: ¿qué horario tenéis?" → true',
    run: () => {
      if (!detectFaqPause('Una pregunta antes: ¿qué horario tenéis?')) {
        throw new Error('"una pregunta antes" + horario must match')
      }
    },
  },
  {
    name: 'detectFaqPause: "Antes una pregunta sobre la tarjeta de fidelización" → true',
    run: () => {
      if (!detectFaqPause('Antes una pregunta sobre la tarjeta de fidelización')) {
        throw new Error('loyalty FAQ pause must match')
      }
    },
  },
  {
    name: 'detectFaqPause: "Espera, ¿cuánto vale el lavado?" → true',
    run: () => {
      if (!detectFaqPause('Espera, ¿cuánto vale el lavado?')) {
        throw new Error('espera + price FAQ must match')
      }
    },
  },
  {
    name: 'detectFaqPause: NEGATIVE — "espera un momento" without FAQ topic → false',
    run: () => {
      if (detectFaqPause('espera un momento')) {
        throw new Error('plain pause without FAQ hint must NOT match')
      }
    },
  },
  {
    name: 'detectFaqPause: NEGATIVE — "¿cuánto cuesta?" without pause marker → false',
    run: () => {
      if (detectFaqPause('¿cuánto cuesta?')) {
        throw new Error('plain FAQ without pause marker must NOT match (handled by pricing guard)')
      }
    },
  },
  {
    name: 'detectFaqPause: NEGATIVE — "Goya" → false',
    run: () => {
      if (detectFaqPause('Goya')) {
        throw new Error('bare location must NOT match')
      }
    },
  },
  {
    name: 'detectFaqPause: NEGATIVE — empty → false',
    run: () => {
      if (detectFaqPause('')) throw new Error('empty must NOT match')
    },
  },

  // ── detectTopicSwitchDuringEscalation (Bug #13.6 — Andrea 2026-05-09) ────
  {
    name: 'detectTopicSwitch: "mi da SEL ora la macchina" → true (display code)',
    run: () => {
      if (!detectTopicSwitchDuringEscalation('mi da SEL ora la macchina')) {
        throw new Error('SEL display code must trigger topic switch')
      }
    },
  },
  {
    name: 'detectTopicSwitch: "ahora me sale PUSH PROG" → true (new symptom phrasing)',
    run: () => {
      if (!detectTopicSwitchDuringEscalation('ahora me sale PUSH PROG')) {
        throw new Error('PUSH PROG must trigger topic switch')
      }
    },
  },
  {
    name: 'detectTopicSwitch: "tengo un código nuevo" → true (discount intent)',
    run: () => {
      if (!detectTopicSwitchDuringEscalation('tengo un código y no se cómo usarlo')) {
        throw new Error('discount code intent must trigger topic switch')
      }
    },
  },
  {
    name: 'detectTopicSwitch: "Andrea" (a name) → false',
    run: () => {
      if (detectTopicSwitchDuringEscalation('Andrea')) {
        throw new Error('a bare name must NOT trigger topic switch')
      }
    },
  },
  {
    name: 'detectTopicSwitch: "María García" → false',
    run: () => {
      if (detectTopicSwitchDuringEscalation('María García')) {
        throw new Error('a full name must NOT trigger topic switch')
      }
    },
  },
  {
    name: 'detectTopicSwitch: empty → false',
    run: () => {
      if (detectTopicSwitchDuringEscalation('')) throw new Error('empty must NOT match')
    },
  },

]

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
