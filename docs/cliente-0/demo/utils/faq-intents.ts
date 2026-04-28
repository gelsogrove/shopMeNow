// FAQ-style intent detection and handlers (cases 8-13).
// One responsibility per intent: detector + prompt file + handler.
//
// Languages supported: es, it, ca, en.
//
// IMPORTANT: detection runs BEFORE the troubleshooting flow in handleTurn.
// Each detector returns a boolean. The router (detectFaqIntent) returns the
// matching intent name or null. Order matters because some patterns overlap
// (alarm-code must NOT match AL001 — that is a known display state for case 5).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = resolve(__dirname, '..', 'prompts', 'intents-faq')

export type FaqIntent =
  | 'discount-code'
  | 'invoice'
  | 'buy-loyalty-card'
  | 'recharge-loyalty-card'
  | 'hours-prices'
  | 'alarm-code'

// ── Detectors (multilang regex: es | it | ca | en) ────────────────────────────

export function hasDiscountCodeIntent(message: string): boolean {
  const m = message.trim().toLowerCase()
  return /\b(tengo un c[oó]digo|ho un codice|tinc un codi|i have a code|tengo un cupon|ho un cupone)\b/.test(m)
}

export function hasInvoiceRequestIntent(message: string): boolean {
  const m = message.trim().toLowerCase()
  return /\b(quiero una factura|necesito (una )?factura|d[aá]me (una )?factura|voglio (una )?fattura|mi serve (una )?fattura|vull (una )?factura|necessito (una )?factura|i (want|need) an invoice|invoice please)\b/.test(m)
}

export function hasBuyLoyaltyCardIntent(message: string): boolean {
  const m = message.trim().toLowerCase()
  return /\b(c[oó]mo (consigo|compro|adquiero) la tarjeta|comprar la tarjeta de fidelizaci[oó]n|come (acquisto|compro|prendo) la tessera fedelt[aà]|com (compro|aconsegueixo) la targeta de fidelitzaci[oó]|how (do i|can i) (get|buy) the loyalty card|loyalty card)\b/.test(m)
}

export function hasRechargeLoyaltyCardIntent(message: string): boolean {
  const m = message.trim().toLowerCase()
  return /\b(c[oó]mo recargo la tarjeta|recargar la tarjeta|come ricarico la tessera|ricaricare la tessera|com recarrego la targeta|recarregar la targeta|how (do i|can i) (recharge|top up) the card|recharge the card)\b/.test(m)
}

export function hasHoursOrPricesIntent(message: string): boolean {
  const m = message.trim().toLowerCase()
  // hours
  if (/\b(cu[aá]l es el horario|qu[eé] horario|horario de apertura|orario di apertura|che orario|quin (és )?l['']horari|horari d['']obertura|what (are )?the hours|opening hours)\b/.test(m)) return true
  // prices (generic question, no specific machine)
  if (/\b(cu[aá]nto cuesta|qu[eé] precio|cu[aá]l es el precio|quanto costa|qual è il prezzo|quant costa|quin (és )?el preu|how much (does it cost|is it)|what['']?s the price)\b/.test(m)) return true
  return false
}

export function hasAlarmCodeIntent(message: string): boolean {
  const m = message.trim().toUpperCase()
  // Exclude known display states already handled elsewhere (AL001 → case 5).
  if (/\bAL\s*001\b/.test(m) || /\bALM\s*0*01\b/.test(m)) return false
  // Match generic alarm codes that the bot does NOT have a documented flow for:
  // - ALN, ALN001, ALN-anything
  // - 001 standalone
  // - ALM with anything other than 001
  if (/\bALN\b/.test(m)) return true
  if (/\bALM\b/.test(m) && !/\bALM\s*0*01\b/.test(m)) return true
  if (/^\s*0*01\s*$/.test(m)) return true
  if (/\b(c[oó]digo de alarma|alarm code|codice di allarme|codi d['']alarma)\b/.test(message.toLowerCase())) return true
  return false
}

// ── Router: pick first matching intent (priority order) ───────────────────────

export function detectFaqIntent(message: string): FaqIntent | null {
  // Priority: most specific first. Alarm-code last because of the AL001 overlap.
  if (hasInvoiceRequestIntent(message)) return 'invoice'
  if (hasBuyLoyaltyCardIntent(message)) return 'buy-loyalty-card'
  if (hasRechargeLoyaltyCardIntent(message)) return 'recharge-loyalty-card'
  if (hasDiscountCodeIntent(message)) return 'discount-code'
  if (hasHoursOrPricesIntent(message)) return 'hours-prices'
  if (hasAlarmCodeIntent(message)) return 'alarm-code'
  return null
}

// ── Prompt loader (cached) ────────────────────────────────────────────────────

const promptCache = new Map<FaqIntent, string>()

export function loadFaqPrompt(intent: FaqIntent): string {
  const cached = promptCache.get(intent)
  if (cached) return cached
  const text = readFileSync(resolve(PROMPTS_DIR, `${intent}.txt`), 'utf8').trim()
  promptCache.set(intent, text)
  return text
}

// ── Handler: returns the [EXACT]-tagged customerFacingGoal text ───────────────
//
// On turn 1 (start of conversation) we prepend the standard Ecolaundry warm
// greeting so the FAQ flows match the same opening style as the troubleshooting
// flows (cases 1-7). On later turns we skip the greeting (e.g. follow-up).

const GREETING_ES = '¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte.'

export function buildFaqReply(intent: FaqIntent, turnCount: number): string {
  const body = loadFaqPrompt(intent)
  const isFirstTurn = turnCount === 1
  // Alarm-code is escalation: the alarm prompt itself is the warm-but-direct
  // handoff message and must not be mixed with a generic greeting.
  if (intent === 'alarm-code') return `[EXACT] ${body}`
  return isFirstTurn ? `[EXACT] ${GREETING_ES} ${body}` : `[EXACT] ${body}`
}

// ── Whether this intent should escalate (mark customerNameRequested) ──────────

export function isEscalatingFaqIntent(intent: FaqIntent): boolean {
  return intent === 'alarm-code'
}
