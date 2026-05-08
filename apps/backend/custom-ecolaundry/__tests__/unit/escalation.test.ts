// Standalone unit test (NO LLM) — utils/escalation.ts: operator-handover
// summary builder.
//
// SCENARIO:
//   buildEscalationSummary branches on:
//     1. issueSummary contains "double charge"
//     2. discountCodeData.letters present (caso 8 valid code)
//     3. discountCode numeric-only (caso 18 incoherence)
//     4. escalationReason mentions caso 5 / caso 28 / caso 25
//     5. pendingFlow starts with no-change- (caso 4)
//     6. invoiceData populated (caso 9)
//     7. nonTroubleshootingIncident set (datafono / cameras / refund / …)
//     8. fallback: machine incident with display narrative
//   Each branch must produce a one-liner that the operator can read and
//   act on. PII (customer name, phone) MUST be sanitised against markdown
//   injection.
//
// extractEscalationContext is a thin SessionState → EscalationContext
// projection. The interesting case is the dedup of location vs street.
//
// Run with:
//   node --import tsx __tests__/unit/escalation.test.ts

import {
  buildEscalationSummary,
  extractEscalationContext,
} from '../../utils/escalation.js'
import { createInitialState } from '../../utils/state.js'
import type { EscalationContext } from '../../models/index.js'

function ctx(overrides: Partial<EscalationContext> = {}): EscalationContext {
  return {
    customerName: 'Andrea',
    customerPhone: null,
    locationDisplay: 'Pineda',
    machineType: 'washer',
    machineNumber: '5',
    paymentCompleted: true,
    displayState: '',
    issueSummary: '',
    nonTroubleshootingIncident: '',
    discountCode: '',
    escalationReason: '',
    timestamp: '2026-05-08 14:00:00',
    pendingFlow: '',
    ...overrides,
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── Double charge (issueSummary detection) ─────────────────────────────────
  {
    name: 'double charge: issueSummary "double charge ..." → double-charge summary',
    run: () => {
      const s = buildEscalationSummary(ctx({ issueSummary: 'double charge — narrative: pagué dos veces' }))
      if (!/doble cobro/i.test(s)) throw new Error(`expected doble cobro, got: ${s}`)
      if (!/Andrea/.test(s)) throw new Error('customer name must appear')
      if (!/Pineda/.test(s)) throw new Error('location must appear')
    },
  },

  // ── Caso 18 — numeric-only code ───────────────────────────────────────────
  {
    name: 'numeric-only code: discountCode="23432023" + reason "código no documentado" → numeric-only summary',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          discountCode: '23432023',
          escalationReason: 'código no documentado',
        }),
      )
      if (!/23432023/.test(s)) throw new Error('code must be quoted in summary')
      if (!/solo num[eé]rico|formato esperado/i.test(s)) {
        throw new Error(`expected "solo numérico" or "formato esperado", got: ${s}`)
      }
    },
  },

  // ── Caso 8 — discount code valid format ────────────────────────────────────
  {
    name: 'discount code valid: discountCodeData populated → activation summary with all parsed fields',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          discountCode: 'SAU2904266',
          discountCodeData: {
            letters: 'SAU',
            fechaIso: '2026-04-29',
            importe: '6',
            doorClosed: true,
          },
        }),
      )
      if (!/SAU/.test(s)) throw new Error('letters must appear')
      if (!/2026-04-29/.test(s)) throw new Error('fechaIso must appear')
      if (!/puerta cerrada/i.test(s)) throw new Error('door state must appear')
    },
  },

  // ── Caso 4 — no-change after pay (via pendingFlow prefix) ──────────────────
  {
    name: 'no-change incident: pendingFlow="no-change-await-confirm" → no-change summary',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          pendingFlow: 'no-change-await-confirm',
          escalationReason: 'No-change incident — paid but not activated',
        }),
      )
      if (!/no se ha activado/i.test(s)) {
        throw new Error(`expected "no se ha activado", got: ${s}`)
      }
      if (!/lavadora número 5/.test(s)) throw new Error('machine label + number required')
    },
  },

  // ── Caso 9 — invoice request ──────────────────────────────────────────────
  {
    name: 'invoice request: invoiceData populated → invoice summary with all billing fields',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          escalationReason: 'Invoice request — invoice request, data collected',
          invoiceData: {
            razonSocial: 'ACME SL',
            direccion: 'Calle Mayor 1, Madrid',
            cif: 'B12345678',
            fecha: '2026-05-07',
            fechaIso: '2026-05-07',
            email: 'cliente@example.com',
          },
        }),
      )
      if (!/ACME SL/.test(s)) throw new Error('razon social required')
      if (!/B12345678/.test(s)) throw new Error('CIF required')
      if (!/cliente@example\.com/.test(s)) throw new Error('email required')
      if (!/Calle Mayor 1, Madrid/.test(s)) throw new Error('address required')
    },
  },

  // ── Non-troubleshooting fallback ───────────────────────────────────────────
  {
    name: 'non-troubleshooting: nonTroubleshootingIncident="cameras-or-ajax" → labelled incident',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          nonTroubleshootingIncident: 'cameras-or-ajax',
          escalationReason: 'Non-troubleshooting incident: cameras-or-ajax',
        }),
      )
      if (!/c[áa]maras|AJAX/i.test(s)) throw new Error(`expected camera/AJAX label, got: ${s}`)
    },
  },

  // ── Default machine incident with display narrative ──────────────────────
  {
    name: 'default: machine + displayState=PUSH → push narrative',
    run: () => {
      const s = buildEscalationSummary(ctx({ displayState: 'PUSH' }))
      if (!/PUSH/.test(s)) throw new Error('display token must appear')
      if (!/programa.*no responde/i.test(s)) throw new Error('PUSH narrative expected')
    },
  },
  {
    name: 'default: machine + displayState=DOOR → door narrative',
    run: () => {
      const s = buildEscalationSummary(ctx({ displayState: 'DOOR' }))
      if (!/puerta no cierra/i.test(s)) throw new Error('DOOR narrative expected')
    },
  },
  {
    name: 'default: no display → "sin información clara" fallback',
    run: () => {
      const s = buildEscalationSummary(ctx({ displayState: '' }))
      if (!/sin informaci[oó]n clara/i.test(s)) {
        throw new Error('expected fallback narrative')
      }
    },
  },

  // ── PII sanitisation (defence in depth) ──────────────────────────────────
  {
    name: 'PII: markdown delimiters in customerName are stripped',
    run: () => {
      const s = buildEscalationSummary(
        ctx({
          customerName: 'Andrea **bold** [link](http://evil.com)',
          displayState: 'PUSH',
        }),
      )
      if (/\[link\]/.test(s)) throw new Error('markdown link must be stripped')
      if (/\*\*bold\*\*/.test(s)) throw new Error('markdown bold must be stripped')
    },
  },

  // ── Missing customer name fallback ────────────────────────────────────────
  {
    name: 'missing name: customerName=null → "Usuario sin nombre"',
    run: () => {
      const s = buildEscalationSummary(ctx({ customerName: null, displayState: 'PUSH' }))
      if (!/Usuario sin nombre/.test(s)) throw new Error('expected "Usuario sin nombre"')
    },
  },

  // ── extractEscalationContext ──────────────────────────────────────────────
  {
    name: 'extractEscalationContext: dedups location when street == location',
    run: () => {
      const s = createInitialState()
      s.location = 'Alemanya'
      s.locationStreet = 'Alemanya'
      const c = extractEscalationContext(s, 'Andrea')
      if (c.locationDisplay !== 'Alemanya') {
        throw new Error(`expected dedup'd "Alemanya", got: ${c.locationDisplay}`)
      }
    },
  },
  {
    name: 'extractEscalationContext: combines location + street when distinct',
    run: () => {
      const s = createInitialState()
      s.location = 'Mataró'
      s.locationStreet = 'Calle Goya 117'
      const c = extractEscalationContext(s, 'Andrea')
      if (!/Mataró.*Calle Goya 117/.test(c.locationDisplay)) {
        throw new Error(`expected "Mataró, Calle Goya 117", got: ${c.locationDisplay}`)
      }
    },
  },
  {
    name: 'extractEscalationContext: missing location → "ubicación no identificada"',
    run: () => {
      const s = createInitialState()
      const c = extractEscalationContext(s, 'Andrea')
      if (!/ubicaci[oó]n no identificada/i.test(c.locationDisplay)) {
        throw new Error('expected fallback location label')
      }
    },
  },
  {
    name: 'extractEscalationContext: invoiceData omitted when no email collected',
    run: () => {
      const s = createInitialState()
      s.location = 'Goya'
      const c = extractEscalationContext(s, 'Andrea')
      if (c.invoiceData !== undefined) {
        throw new Error('invoiceData must be undefined when email is empty')
      }
    },
  },
  {
    name: 'extractEscalationContext: invoiceData included when email collected',
    run: () => {
      const s = createInitialState()
      s.location = 'Goya'
      s.invoiceData.email = 'cliente@example.com'
      s.invoiceData.razonSocial = 'ACME SL'
      const c = extractEscalationContext(s, 'Andrea')
      if (!c.invoiceData) throw new Error('invoiceData must be present')
      if (c.invoiceData.email !== 'cliente@example.com') throw new Error('email must propagate')
    },
  },

  // ── Customer name + phone in handover summary ─────────────────────────────
  // SCENARIO (#10): the operator handover summary MUST always carry the
  // customer's name; when WhatsApp metadata provides a phone, it MUST
  // appear next to the name in parentheses. This is the operator's only
  // contact info — it cannot drop silently.
  // NOTE on phone formatting:
  //   sanitizeForDisplay strips markdown specials (incl. "+") so the operator
  //   sees "34600123456" not "+34600123456". The digits are preserved (which
  //   is what matters for callbacks). These tests assert the digits, not the
  //   leading "+".
  {
    name: 'name+phone: both present → "Usuario Andrea (34600123456)" — digits preserved',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'Andrea',
        customerPhone: '+34600123456',
        displayState: 'PUSH',
      }))
      if (!/Usuario Andrea/.test(s)) throw new Error('summary must include name')
      if (!/34600123456/.test(s)) throw new Error('summary must include phone digits')
      if (!/Usuario Andrea\s*\(34600123456\)/.test(s)) {
        throw new Error(`expected "Usuario Andrea (34600123456)", got: ${s}`)
      }
    },
  },
  {
    name: 'name only (no phone) → "Usuario Andrea" without parentheses',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'Andrea',
        customerPhone: null,
        displayState: 'PUSH',
      }))
      if (!/Usuario Andrea/.test(s)) throw new Error('summary must include name')
      if (/Usuario Andrea\s*\(/.test(s)) {
        throw new Error(`no parentheses when phone is null, got: ${s}`)
      }
    },
  },
  {
    name: 'phone digits always present (Caso 4 no-change branch)',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'Carlos',
        customerPhone: '+34611222333',
        pendingFlow: 'no-change-await-confirm',
        escalationReason: 'No-change incident',
      }))
      if (!/Carlos/.test(s)) throw new Error('Caso 4 summary must include name')
      if (!/34611222333/.test(s)) throw new Error('Caso 4 summary must include phone digits')
    },
  },
  {
    name: 'phone digits always present (Caso 6 double charge branch)',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'María',
        customerPhone: '+34622333444',
        issueSummary: 'double charge — narrative: pagué dos veces',
      }))
      if (!/María/.test(s)) throw new Error('Caso 6 summary must include name')
      if (!/34622333444/.test(s)) throw new Error('Caso 6 summary must include phone digits')
    },
  },
  {
    name: 'phone digits always present (Caso 16 ALN branch)',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'Luis',
        customerPhone: '+34633444555',
        displayState: 'ALN',
        machineType: 'dryer',
        machineNumber: '4',
        locationDisplay: 'Alemanya',
      }))
      if (!/Luis/.test(s)) throw new Error('Caso 16 summary must include name')
      if (!/34633444555/.test(s)) throw new Error('Caso 16 summary must include phone digits')
    },
  },

  // ── Spanish-only handover summary (#11) ──────────────────────────────────
  // SCENARIO: the operator handover summary is ALWAYS in Spanish, regardless
  // of the customer's chat language. This pins the deliberate ES-first
  // exemption documented in CLAUDE.md (escalation.ts holds ~30 hardcoded
  // ES phrases). When other languages go live, this test must move to a
  // tenant-language-aware variant.
  {
    name: 'summary always in Spanish (default branch — machine incident)',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'Andrea',
        customerPhone: '+34600000000',
        displayState: 'PUSH',
      }))
      // Discriminative ES words: any of "Usuario", "en", "ha", "máquina",
      // "ubicación", "número", "lavadora", "secadora" → ES.
      const isSpanish = /\b(Usuario|en|ha|m[áa]quina|ubicaci[oó]n|n[uú]mero|lavadora|secadora)\b/.test(s)
      if (!isSpanish) {
        throw new Error(`summary must be in Spanish, got: ${s}`)
      }
    },
  },
  {
    name: 'summary always in Spanish (Caso 4 no-change)',
    run: () => {
      const s = buildEscalationSummary(ctx({
        customerName: 'Carlos',
        customerPhone: '+34611222333',
        pendingFlow: 'no-change-await-confirm',
        escalationReason: 'No-change incident',
      }))
      // ES-discriminative words specific to this branch
      if (!/(?:Usuario|cobrad|m[aá]quina|cambio)/i.test(s)) {
        throw new Error(`Caso 4 summary must contain ES vocabulary, got: ${s}`)
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
