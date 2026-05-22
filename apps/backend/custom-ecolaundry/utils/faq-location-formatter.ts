// Pure formatters for Caso 12.1/12.2 — Horarios y precios por location.
// Iron rule #7: data from json/locations.json, never invented.
// Missing data → null, caller falls back to a generic i18n message.
//
// Programs formatters (Caso 12.4 / F81) live in faq-programs-formatter.ts
// (split for iron rule #3: file ≤ 150 lines).
//
// Re-exports from faq-programs-formatter.ts for backward compatibility:
export {
  formatWasherPrograms,
  formatDryerPrograms,
  buildPushProgList,
  type ProgramTranslateFn,
} from './faq-programs-formatter.js'

// Re-exports from faq-payment-formatter.ts (F87) for backward compatibility:
// readPayment + PaymentInfo + PaymentMethod are consumed by sibling tests
// and any future caller that needs to inspect payment metadata.
export {
  readPayment,
  formatPaymentSignals,
  type PaymentInfo,
  type PaymentMethod,
} from './faq-payment-formatter.js'

// F87 — internal imports for the price formatters below.
import type { ProgramTranslateFn } from './faq-programs-formatter.js'
import { readPayment as readPaymentInternal, formatPaymentSignals as formatPaymentSignalsInternal } from './faq-payment-formatter.js'
import type { Runtime } from '../models/runtime.js'

type Machine = {
  number: string
  weightKg?: number | null
  fidelity?: string | null
  cash?: string | null
}
type MachinesPayload = {
  washers?: Machine[]
  dryers?: Machine[]
}

// Resolve state.location (canonical key, displayName, or pueblo) → locations.json key.
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

function readMachines(runtime: Runtime, locationKey: string): MachinesPayload | null {
  const key = resolveLocationKey(runtime, locationKey)
  if (!key) return null
  const loc = runtime.locations.locations[key]
  if (!loc?.metadata) return null
  const machines = (loc.metadata as { machines?: MachinesPayload }).machines
  return machines ?? null
}

function readDisplayName(runtime: Runtime, locationKey: string): string {
  const key = resolveLocationKey(runtime, locationKey)
  if (!key) return locationKey
  const loc = runtime.locations.locations[key]
  return loc?.displayName || loc?.pueblo || locationKey
}

function readHours(runtime: Runtime, locationKey: string): string | null {
  const key = resolveLocationKey(runtime, locationKey)
  if (!key) return null
  const loc = runtime.locations.locations[key]
  const metadata = loc?.metadata as { hours?: string } | undefined
  return metadata?.hours || null
}

// ── Hours formatter (Caso 12.1) ──────────────────────────────────────────────
export function formatHours(locationKey: string, runtime: Runtime): string | null {
  const hours = readHours(runtime, locationKey)
  if (!hours) return null
  const displayName = readDisplayName(runtime, locationKey)
  const parts = hours.split('-')
  if (parts.length !== 2) return `En ${displayName}, el horario es de ${hours}, todos los días.`
  const [open, close] = parts
  return `En ${displayName}, el horario es de ${open} a ${close}, todos los días.`
}

// ── Washer prices formatter (Caso 12.2) — usecases.md §12.2 ──────────────────
export function formatWasherPrices(
  locationKey: string,
  runtime: Runtime,
  translateFn?: ProgramTranslateFn,  // F87 — optional for backwards compat
): string | null {
  const machines = readMachines(runtime, locationKey)
  if (!machines?.washers || machines.washers.length === 0) return null
  const displayName = readDisplayName(runtime, locationKey)
  const groups = groupBySpecs(machines.washers)
  const lines = groups.map((g) => formatGroupLine(g, 'Lavadoras'))
  const base = `En ${displayName}, los precios de lavadora son:\n\n${lines.join('\n')}`
  // F87 — append boundary payment signals when payment data + translateFn present.
  if (translateFn) {
    const payment = readPaymentInternal(runtime, locationKey)
    if (payment) return base + formatPaymentSignalsInternal(payment, translateFn)
  }
  return base
}

// ── Dryer prices formatter (Caso 12.2) ───────────────────────────────────────
export function formatDryerPrices(
  locationKey: string,
  runtime: Runtime,
  translateFn?: ProgramTranslateFn,  // F87
): string | null {
  const machines = readMachines(runtime, locationKey)
  if (!machines?.dryers || machines.dryers.length === 0) return null
  const displayName = readDisplayName(runtime, locationKey)
  const groups = groupBySpecs(machines.dryers)
  const lines = groups.map((g) => formatGroupLine(g, 'Secadoras'))
  const base = `En ${displayName}, los precios de secadora son:\n\n${lines.join('\n')}`
  // F87 — append boundary payment signals when payment data + translateFn present.
  if (translateFn) {
    const payment = readPaymentInternal(runtime, locationKey)
    if (payment) return base + formatPaymentSignalsInternal(payment, translateFn)
  }
  return base
}

// F54 (Andrea 2026-05-14): collapse machines with identical specs into one
// line under a plural label (Lavadoras / Secadoras). Single-machine groups
// keep their canonical number (L1, S5). Preserves first-appearance order.
type Group = { sample: Machine; count: number }

function specsKey(m: Machine): string {
  return `${m.weightKg ?? ''}|${m.fidelity ?? ''}|${m.cash ?? ''}`
}

function groupBySpecs(machines: Machine[]): Group[] {
  const order: string[] = []
  const map = new Map<string, Group>()
  for (const m of machines) {
    const k = specsKey(m)
    const existing = map.get(k)
    if (existing) existing.count += 1
    else {
      map.set(k, { sample: m, count: 1 })
      order.push(k)
    }
  }
  return order.map((k) => map.get(k)!)
}

function formatGroupLine(g: Group, pluralLabel: string): string {
  const label = g.count === 1 ? g.sample.number : pluralLabel
  const m = g.sample
  const weightLabel = m.weightKg ? ` ${m.weightKg}kg` : ''
  const fidelity = m.fidelity || ''
  const cash = m.cash || ''
  if (fidelity && cash && fidelity === cash) return `- **${label}**${weightLabel}: ${fidelity}`
  if (fidelity && cash) return `- **${label}**${weightLabel}: ${fidelity} (fidelidad) / ${cash} (efectivo)`
  const price = fidelity || cash
  if (price) return `- **${label}**${weightLabel}: ${price}`
  return `- **${label}**${weightLabel}`
}

