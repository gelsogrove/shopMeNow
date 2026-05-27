// F106 — Standalone unit test (NO LLM) for the operator briefing summary:
//   1. The deterministic `buildEscalationSummary` produces the correct
//      language when `lang` argument is overridden (es/it/en/ca/pt/fr).
//   2. The `(single)` token is NEVER present in any output, regardless of
//      the escalation branch (was leaking via the LLM in production).
//   3. Each language switches BOTH the body strings AND the timestamp
//      prefix (formatHandoverTimestamp).
//
// Run with: node --import tsx __tests__/unit/operator-briefing-i18n.test.ts

import {
  buildEscalationSummary,
  formatHandoverTimestamp,
} from '../../utils/escalation.js'
import type { EscalationContext, SupportedLanguage } from '../../models/index.js'
import { loadTestRuntime } from './_helpers.js'

await loadTestRuntime()

function ctx(overrides: Partial<EscalationContext> = {}): EscalationContext {
  return {
    customerName: 'Andrea',
    customerPhone: null,
    locationDisplay: 'Pineda',
    machineType: 'washer',
    machineNumber: '5',
    paymentCompleted: true,
    displayState: '',
    displayLabel: '',
    issueSummary: '',
    nonTroubleshootingIncident: '',
    discountCode: '',
    escalationReason: '',
    timestamp: '2026-05-25 14:00:00',
    pendingFlow: '',
    ...overrides,
  }
}

interface Case {
  name: string
  run: () => void
}

const ALL_LANGS: SupportedLanguage[] = ['es', 'it', 'en', 'ca', 'pt', 'fr']

// Vocabulary fingerprints — at least one word that MUST appear in each
// language's machine-incident default summary. Chosen so the assertion
// is stable even if the surrounding sentence wording is tweaked.
const LANG_FINGERPRINTS: Record<SupportedLanguage, RegExp> = {
  es: /lavadora|pantalla|pago/i,
  it: /lavatrice|display|pagamento/i,
  en: /washer|display|payment/i,
  ca: /rentadora|pantalla|pagament/i,
  pt: /lavar|visor|pagamento/i,
  fr: /lave-linge|écran|paiement/i,
}

const cases: Case[] = [
  // ── (single) leak regression ──────────────────────────────────────────────
  {
    name: 'F106 — machine summary with single display: NO "(single)" token leaks',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          machineType: 'washer',
          machineNumber: '5',
          displayState: 'PUSH',
          displayLabel: 'PUSH PROG',
          displayHistory: ['PUSH PROG'],  // single display
        }),
      )
      if (s.includes('(single)')) {
        throw new Error(`leaked "(single)" token in summary: ${s}`)
      }
      if (s.includes('(missing)')) {
        throw new Error(`leaked "(missing)" token in summary: ${s}`)
      }
    },
  },
  {
    name: 'F106 — display-sequence summary (≥2 codes) DOES include the sequence, never "(single)"',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          displayState: 'AL001',
          displayLabel: 'AL001',
          displayHistory: ['SEL', 'PUSH PROG', 'DOOR', 'AL001'],
        }),
      )
      if (s.includes('(single)')) {
        throw new Error(`"(single)" must NEVER leak, even on multi-display: ${s}`)
      }
      if (!s.includes('SEL → PUSH PROG → DOOR → AL001')) {
        throw new Error(`expected full display sequence: ${s}`)
      }
    },
  },
  {
    name: 'F106 — discount-code summary: NO "(single)" / "(missing)" leak',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          discountCode: 'SAU2904266',
          discountCodeData: {
            letters: 'SAU',
            fechaIso: '2026-04-29',
            importe: '26',
            doorClosed: true,
          },
          escalationReason: 'Discount code — código válido',
        }),
      )
      if (s.includes('(single)') || s.includes('(missing)')) {
        throw new Error(`leaked internal token: ${s}`)
      }
    },
  },
  {
    name: 'F106 — invoice summary: NO "(single)" / "(missing)" leak',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          escalationReason: 'Invoice request — invoice request, data collected',
          invoiceData: {
            razonSocial: 'ACME SL',
            direccion: 'C/ Goya 12',
            cif: 'B12345678',
            fecha: '25/05/2026',
            fechaIso: '2026-05-25',
            costeTotal: '15',
            email: 'a@b.es',
            notes: '',
          },
        }),
      )
      if (s.includes('(single)') || s.includes('(missing)')) {
        throw new Error(`leaked internal token: ${s}`)
      }
    },
  },

  // ── Multilingual coverage — body ──────────────────────────────────────────
  ...ALL_LANGS.map<Case>((lang) => ({
    name: `F106 — machine summary in '${lang}' uses ${lang}-language vocabulary`,
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          machineType: 'washer',
          machineNumber: '5',
          displayState: 'PUSH',
          displayLabel: 'PUSH PROG',
          paymentCompleted: true,
        }),
        lang,
      )
      if (!LANG_FINGERPRINTS[lang].test(s)) {
        throw new Error(
          `expected ${lang}-language vocabulary matching ${LANG_FINGERPRINTS[lang]}: ${s}`,
        )
      }
      if (s.includes('(single)') || s.includes('(missing)')) {
        throw new Error(`leaked internal token in '${lang}' summary: ${s}`)
      }
    },
  })),

  // ── Multilingual coverage — timestamp prefix ──────────────────────────────
  {
    name: 'F106 — formatHandoverTimestamp("es") opens with "El"',
    run: () => {
      const s = formatHandoverTimestamp('es')
      if (!/^El\s/.test(s)) throw new Error(`ES timestamp must start with "El": ${s}`)
    },
  },
  {
    name: 'F106 — formatHandoverTimestamp("it") starts with an Italian weekday',
    run: () => {
      const s = formatHandoverTimestamp('it')
      // IT weekday names: lunedì/martedì/mercoledì/giovedì/venerdì/sabato/domenica
      if (!/(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)/i.test(s)) {
        throw new Error(`IT timestamp must include an Italian weekday: ${s}`)
      }
      if (/^El\s/.test(s)) {
        throw new Error(`IT timestamp must NOT start with Spanish "El": ${s}`)
      }
    },
  },
  {
    name: 'F106 — formatHandoverTimestamp("en") starts with "On" + English weekday',
    run: () => {
      const s = formatHandoverTimestamp('en')
      if (!/^On\s/.test(s)) throw new Error(`EN timestamp must start with "On": ${s}`)
      if (!/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(s)) {
        throw new Error(`EN timestamp must include an English weekday: ${s}`)
      }
    },
  },
  {
    name: 'F106 — formatHandoverTimestamp("fr") starts with "Le"',
    run: () => {
      const s = formatHandoverTimestamp('fr')
      if (!/^Le\s/.test(s)) throw new Error(`FR timestamp must start with "Le": ${s}`)
    },
  },

  // ── Default behaviour (no lang arg) is still 'es' for back-compat ─────────
  {
    name: "F106 — default lang argument is 'es' (back-compat with legacy tests)",
    run: () => {
      const s = buildEscalationSummary(
        ctx({ machineType: 'washer', machineNumber: '5', displayState: 'PUSH' }),
      )
      if (!/lavadora|pantalla/i.test(s)) {
        throw new Error(`default lang must produce Spanish vocabulary: ${s}`)
      }
    },
  },

  // ── Localised user labels ─────────────────────────────────────────────────
  {
    name: 'F106 — Italian anonymous user label is localised',
    run: () => {
      const s = buildEscalationSummary(
        ctx({ customerName: null, machineType: 'washer', machineNumber: '5', displayState: 'PUSH' }),
        'it',
      )
      // "Utente senza nome" in the IT catalogue
      if (!/senza\s+nome/i.test(s)) {
        throw new Error(`expected IT anonymous label "Utente senza nome": ${s}`)
      }
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
