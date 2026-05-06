// Multilingual relative-date parser used by the Caso 9 invoice flow.
//
// Goal: turn "hoy / ayer / anteayer / oggi / ieri / today / yesterday / ..."
// into a YYYY-MM-DD ISO date so the bot can echo it back to the customer.
// If the input does not match any known relative or explicit form, returns
// '' (empty string) — the caller keeps the raw text for the operator.

type Lang = 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr'

const RELATIVE_DAY_OFFSETS: Record<string, number> = {
  // 0 = today, -1 = yesterday, -2 = day before yesterday
  // Spanish
  hoy: 0, ayer: -1, anteayer: -2, antier: -2,
  // Italian
  oggi: 0, ieri: -1, 'altro ieri': -2, "l'altro ieri": -2, lieri: -2,
  // English
  today: 0, yesterday: -1, 'day before yesterday': -2,
  // Portuguese
  hoje: 0, ontem: -1, anteontem: -2,
  // Catalan
  avui: 0, ahir: -1, 'abans d\'ahir': -2,
  // French
  aujourdhui: 0, "aujourd'hui": 0, hier: -1, avanthier: -2, 'avant-hier': -2,
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function tryRelative(input: string): string {
  const norm = input.trim().toLowerCase().replace(/[.,!?¿¡]/g, '').replace(/\s+/g, ' ')
  if (!norm) return ''
  const offset = RELATIVE_DAY_OFFSETS[norm]
  if (offset === undefined) return ''
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return toIso(d)
}

function tryIsoLike(input: string): string {
  const m = input.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return ''
  const [, y, mo, da] = m
  return `${y}-${pad(Number(mo))}-${pad(Number(da))}`
}

function tryDmy(input: string): string {
  // 5/5/2026 · 05-05-2026 · 5.5.26
  const m = input.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (!m) return ''
  const [, da, mo, yRaw] = m
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
  return `${y}-${pad(Number(mo))}-${pad(Number(da))}`
}

/**
 * Parse a free-form date string into ISO YYYY-MM-DD.
 * Returns '' when no recognised pattern matches; caller keeps raw text.
 */
export function parseRelativeDate(input: string, _lang: Lang = 'es'): string {
  if (!input) return ''
  return tryRelative(input) || tryIsoLike(input) || tryDmy(input) || ''
}
