// Demo store for tintorería (dry-cleaning) orders — READ-ONLY lookup.
//
// The bot only TRACKS orders; it never creates them (the counter issues them).
// Primary lookup is BY PHONE: on WhatsApp (and the website demo form) we already
// know the customer's number, so "when can I pick up my trousers?" needs no code.
// An order NUMBER is an OPTIONAL fallback, used only when someone else picks up
// on the customer's behalf (they have the receipt number, not the phone).
//
// This is the in-code fake the REPL/batch + website demo read when no real
// handler is injected. In production the host injects a CheckOrderStatusHandler
// (see agent.ts) that queries the real backend/POS; this file is NOT used there.
//
// Why a tool and not the prompt: order status is DYNAMIC per-order data, so it
// cannot live in the cached prompt (iron rule #3). The catalog/prices DO live in
// the prompt (prompts/tintoria.md + per-sede tables in prompts/locations/*.md).
//
// Dates are computed relative to a caller-supplied `now` so a "ready" order is
// always recently past and an "in_progress" order always near future, whenever
// the demo runs. This file never calls `new Date()` itself.

export type OrderStatus = 'ready' | 'in_progress'

export interface OrderInfo {
  orderNumber: string
  status: OrderStatus
  /** ISO YYYY-MM-DD. ready → when finished; in_progress → estimated pickup date. */
  readyDate: string
  /** Canonical sede name where the garment is/will be ready for pickup. */
  location: string
  /** Short item description, source language = Spanish (the LLM translates). */
  items: string
}

export interface CheckOrderStatusResult {
  found: boolean
  orders: OrderInfo[]
}

interface SeedOrder {
  orderNumber: string
  status: OrderStatus
  items: string
  location: string
  /** Days relative to lookup-time `now` (negative = ready in past, positive = future pickup). */
  dayOffset: number
}

// Orders addressable BY NUMBER (third-party pickup with the receipt).
const ORDERS_BY_NUMBER: Record<string, SeedOrder> = {
  '1234': { orderNumber: '1234', status: 'ready', items: '1 abrigo de lana', location: 'Eixample', dayOffset: -1 },
  '1235': { orderNumber: '1235', status: 'ready', items: '1 traje (chaqueta + pantalón)', location: 'Gràcia', dayOffset: -2 },
  '2001': { orderNumber: '2001', status: 'in_progress', items: '1 vestido de novia', location: 'Sant Cugat', dayOffset: 3 },
  '2002': { orderNumber: '2002', status: 'in_progress', items: '2 cortinas', location: 'Terrassa', dayOffset: 2 },
}

// Canned orders returned for ANY phone in the demo, so "¿cuándo recojo el
// pantalón?" always finds something on the website demo (the visitor's real
// number won't match a seeded one). Located at the sede the customer is in when
// known (passed by the caller), else a default. Production replaces this with a
// real per-phone query via the injected handler.
const DEMO_ORDERS_BY_PHONE: SeedOrder[] = [
  { orderNumber: 'A-3007', status: 'in_progress', items: '1 pantalón', location: 'Eixample', dayOffset: 2 },
  { orderNumber: 'A-2990', status: 'ready', items: '1 camisa', location: 'Eixample', dayOffset: -1 },
]

function isoFromOffset(now: Date, dayOffset: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toInfo(seed: SeedOrder, now: Date, locationOverride?: string): OrderInfo {
  return {
    orderNumber: seed.orderNumber,
    status: seed.status,
    readyDate: isoFromOffset(now, seed.dayOffset),
    location: locationOverride || seed.location,
    items: seed.items,
  }
}

/**
 * Look up a single tintorería order by its NUMBER (third-party pickup). Normalizes
 * the number (trims, strips "#"/"ORD-"/"DW-" prefix and inner spaces) so it can be
 * written loosely. Unknown → { found:false, orders:[] }.
 */
export function lookupDemoOrderByNumber(orderNumber: string, now: Date): CheckOrderStatusResult {
  const key = (orderNumber ?? '')
    .toString()
    .trim()
    .replace(/^#/, '')
    .replace(/^(ord|dw)[-\s]?/i, '')
    .replace(/\s+/g, '')
  const seed = ORDERS_BY_NUMBER[key]
  if (!seed) return { found: false, orders: [] }
  return { found: true, orders: [toInfo(seed, now)] }
}

/**
 * Look up the customer's open tintorería orders BY PHONE (the normal path). In
 * the demo this returns a canned set regardless of the phone, so the demo always
 * has something to show. `location` (the sede the customer is currently in, if
 * known) is used so the pickup sede matches the conversation.
 */
export function lookupDemoOrdersByPhone(now: Date, location?: string): CheckOrderStatusResult {
  return { found: true, orders: DEMO_ORDERS_BY_PHONE.map((o) => toInfo(o, now, location)) }
}
