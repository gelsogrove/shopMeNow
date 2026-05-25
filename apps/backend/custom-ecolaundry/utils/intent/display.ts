// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3 (>150 lines). Zero behavioural change. Iron rule #5 not
// applicable (depth-2 file). Coverage in __tests__/unit/intent.test.ts.
//
// Every regex in this file is moved verbatim from HEAD's utils/intent.ts.
// The patterns are kept inline (rather than redirected to patterns.ts) to
// guarantee byte-for-byte identical matching with the original file. Tests
// for extractDisplayState, extractDisplayLabel and isDisplayCodeLikeInput
// pin every branch — see intent.test.ts.

import { normalizeDisplayState } from '../display-state.js'
import { isBlankDisplayReply } from '../message-parsing.js'
import { levenshtein } from './_shared.js'

export function extractDisplayState(message: string): string | null {
  const trimmed = message.trim()
  if (isBlankDisplayReply(trimmed)) return 'BLANK'
  if (/END.*bAL|bAL.*END/i.test(trimmed)) return 'END_BAL'
  if (/\b\d{1,2}[.,]\d{2}\b/.test(trimmed)) return 'PRICE'
  if (/puerta abierta|dibujo de la puerta|icono de puerta|door open|open door icon/i.test(trimmed)) return 'DOOR'
  const alarm001Match = trimmed.match(/\b(?:AL\s*|ALM\s*|ALARMA?\s+)0*01\b/i)
  if (alarm001Match) return 'AL001'
  if (/(?:^|\D)0*01(?:\D|$)/.test(trimmed) && !/\b\d{4,}\b/.test(trimmed)) return 'C001'

  const specificAlarmMatch = trimmed.match(/\b(ALM\/?A|ALM\/?E|ALM[\/ ]?DOOR|ALM\/?V(?:AR|Ar))\b/i)
  if (specificAlarmMatch) return normalizeDisplayState(specificAlarmMatch[1])

  const alnMatch = trimmed.match(/\bALN(?:\s*[AN])?\b/i)
  if (alnMatch) return normalizeDisplayState(alnMatch[0])

  const errMatch = trimmed.match(/\b(ERR(?:OR)?[\s\-]?\d{1,3})\b/i)
  if (errMatch) return errMatch[1].toUpperCase().replace(/\s+/g, ' ')

  const genericMatch = trimmed.match(/\b(SEL|PUSH|PR|DOOR|ALM|AL001|END|ON|FILTRO|FALLO DE ROTACION|FALLO DE ASPIRACION|STOP|water)\b/i)
  if (genericMatch) return normalizeDisplayState(genericMatch[1])

  if (/\b120\b/.test(trimmed)) return '120'

  const fuzzy = fuzzyDisplayMatch(trimmed)
  if (fuzzy) return fuzzy

  return null
}

export function extractDisplayLabel(message: string, canonical: string): string {
  if (!canonical) return ''
  const stem = canonical.match(/^[A-Z0-9]+/i)?.[0] || canonical
  const re = new RegExp(`\\b${stem}\\b`, 'i')
  const match = message.match(re)
  if (!match || match.index === undefined) return canonical.toUpperCase()
  let end = match.index + match[0].length
  const tail = message.slice(end).match(/^(?:\s+[A-Z0-9][A-Z0-9]{1,})+/)
  if (tail) end += tail[0].length
  return message
    .slice(match.index, end)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const FUZZY_TARGETS: ReadonlyArray<{ token: string; canonical: string }> = [
  { token: 'PUSH PROG', canonical: 'PUSH' },
  { token: 'PUSH', canonical: 'PUSH' },
  { token: 'SEL', canonical: 'SEL' },
  { token: 'DOOR', canonical: 'DOOR' },
  { token: 'ALM DOOR', canonical: 'ALM/DOOR' },
  { token: 'ALMDOOR', canonical: 'ALM/DOOR' },
  { token: 'AL001', canonical: 'AL001' },
  { token: 'ALARM 001', canonical: 'AL001' },
  { token: 'ALARMA 001', canonical: 'AL001' },
  { token: 'ALN', canonical: 'ALN' },
  { token: 'ALM', canonical: 'ALM' },
]

function fuzzyDisplayMatch(input: string): string | null {
  const norm = input
    .toUpperCase()
    .replace(/[/.\-_,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (norm.length < 3) return null
  if (norm.length > 12) return null
  if (!/^[A-Z0-9 ]+$/.test(norm)) return null

  let best: { token: string; canonical: string; dist: number } | null = null
  for (const { token, canonical } of FUZZY_TARGETS) {
    const dist = levenshtein(norm, token)
    const maxDist = token.length <= 4 ? 1 : 2
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { token, canonical, dist }
    }
  }
  return best ? best.canonical : null
}

export function isDisplayCodeLikeInput(message: string): boolean {
  return Boolean(extractDisplayState(message))
}
