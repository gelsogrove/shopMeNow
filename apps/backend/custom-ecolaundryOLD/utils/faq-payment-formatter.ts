// Pure formatter for Caso 12.2 boundary payment signals (F87).
// Iron rule #7: data from json/locations.json:metadata.payment, never hardcoded.
// Missing data → caller skips appending signals; reply renders as before.
//
// Split from faq-location-formatter.ts (iron rule #3: file ≤ 150 lines,
// one responsibility = price formatters there, payment signals here).
//
// Consumers: formatWasherPrices / formatDryerPrices (faq-location-formatter.ts)
// pass an optional translateFn to read i18n keys (paymentCardOnly,
// paymentTpvExact) and append the boundary signals to the price reply.

import type { Runtime } from '../models/runtime.js'
import type { ProgramTranslateFn } from './faq-programs-formatter.js'

// ── Payment types ────────────────────────────────────────────────────────────
// PaymentMethod is a closed set: every value MUST match the CSV columns
// (coins = monedas, bills = billetes, fidelity = tarjeta de fidelidad,
// card = tarjeta de crédito).
export type PaymentMethod = 'coins' | 'bills' | 'fidelity' | 'card'

export type PaymentInfo = {
  methods: PaymentMethod[]
  tpvExact: number | null
}

// ── Location key resolver (local copy — identical to faq-location-formatter.ts) ─
// Resolves state.location (canonical key, displayName, or pueblo) → locations.json key.
function resolveLocationKey(runtime: Runtime, locationKey: string): string | null {
  const entries = runtime.locations?.locations
  if (!entries) return null
  if (entries[locationKey]) return locationKey
  const needle = locationKey.toLowerCase().replace(/[\s'']/g, '')
  for (const [key, loc] of Object.entries(entries)) {
    const candidates = [key, loc.displayName, loc.pueblo].filter(Boolean) as string[]
    if (candidates.some((c) => c.toLowerCase().replace(/[\s'']/g, '') === needle)) {
      return key
    }
  }
  return null
}

// ── readPayment ──────────────────────────────────────────────────────────────
// Returns null when:
//   - the location key does not resolve to any locations.json entry, OR
//   - the location exists but has no metadata.payment field.
// Caller is responsible for fallback behaviour (no append, no crash).
export function readPayment(runtime: Runtime, locationKey: string): PaymentInfo | null {
  const key = resolveLocationKey(runtime, locationKey)
  if (!key) return null
  const loc = runtime.locations.locations[key]
  if (!loc?.metadata) return null
  const payment = (loc.metadata as { payment?: PaymentInfo }).payment
  return payment ?? null
}

// ── formatPaymentSignals ─────────────────────────────────────────────────────
// Build the boundary-payment lines appended to washer/dryer price replies.
// Order matters (gravity decreasing):
//   1. paymentCardOnly  — show-stopper: customer with coins/bills wasted the trip
//   2. paymentTpvExact  — money-loss:   customer pays more than the exact amount
// Returns '' (empty) when no signal applies, otherwise '\n\n<signals>'.
export function formatPaymentSignals(
  payment: PaymentInfo,
  translateFn: ProgramTranslateFn,
): string {
  const lines: string[] = []
  if (payment.methods.length === 1 && payment.methods[0] === 'card') {
    lines.push(translateFn('paymentCardOnly'))
  }
  if (payment.tpvExact !== null && payment.tpvExact !== undefined) {
    lines.push(
      translateFn('paymentTpvExact').replace('{amount}', String(payment.tpvExact)),
    )
  }
  return lines.length > 0 ? `\n\n${lines.join('\n\n')}` : ''
}
