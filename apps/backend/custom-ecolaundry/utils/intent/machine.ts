// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Zero behavioural change. Body is moved verbatim from
// utils/intent.ts (detectMachineTypeMention + normalizeMachineType plus the
// private vocab arrays and fuzzy matcher). The new file location does not
// change any rule status; tests (intent.test.ts, machine-type-fuzzy.test.ts)
// verify zero diff.

import { WASHER_NOUNS_RE, WASHER_VERBS_RE, DRYER_NOUNS_RE, DRYER_VERBS_RE } from '../patterns.js'
import { levenshtein } from './_shared.js'

// Canonical vocabulary for the fuzzy matcher (≥6 chars so the distance
// threshold doesn't accidentally swallow short unrelated words).
const WASHER_VOCAB = ['lavadora', 'lavatrice', 'washer', 'rentadora', 'lavelinge', 'laundry']
const DRYER_VOCAB = ['secadora', 'asciugatrice', 'dryer', 'assecadora', 'sechelinge']

function fuzzyMatchesVocab(token: string, vocab: string[], maxDist: number): boolean {
  if (token.length < 6) return false
  for (const word of vocab) {
    if (Math.abs(word.length - token.length) > maxDist) continue
    if (levenshtein(token, word) <= maxDist) return true
  }
  return false
}

export function detectMachineTypeMention(message: string): 'washer' | 'dryer' | null {
  const trimmed = message.toLowerCase()
  if (!trimmed) return null
  // Dryer first (more specific): nouns + verb stems across 6 languages.
  if (DRYER_NOUNS_RE.test(trimmed) || DRYER_VERBS_RE.test(trimmed)) {
    return 'dryer'
  }
  if (WASHER_NOUNS_RE.test(trimmed) || WASHER_VERBS_RE.test(trimmed)) {
    return 'washer'
  }
  return null
}

export function normalizeMachineType(value: unknown): '' | 'washer' | 'dryer' {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  const stripped = normalized.replace(/[^a-zàèéìòùáéíóúüñç]/gi, '')

  // Tier 1 — exact match on canonical vocab.
  if (['washer', 'lavatrice', 'lavadora', 'washing machine'].includes(normalized)) return 'washer'
  if (['dryer', 'asciugatrice', 'secadora'].includes(normalized)) return 'dryer'

  // Tier 2 — root regex (compound utterances + minor inflections).
  if (/lavat(?:rice|ric|rce)|lavador|wash(?:er|ing machine)/i.test(normalized)) return 'washer'
  if (/asci(?:ugatrice|ugatric)|ascig(?:atrice|aatrice|a+trice)|secador|dry(?:er|ing)/i.test(normalized)) return 'dryer'

  // Tier 3 — fuzzy match (Levenshtein ≤ 2) for typos. Length-filter keeps
  // unrelated short words out of scope.
  const tokens = normalized.split(/[^a-zàèéìòùáéíóúüñç]+/i).filter(Boolean)
  for (const token of tokens) {
    if (fuzzyMatchesVocab(token, WASHER_VOCAB, 2)) return 'washer'
    if (fuzzyMatchesVocab(token, DRYER_VOCAB, 2)) return 'dryer'
  }
  // Try the stripped form too (removes hyphens for "lave-linge").
  if (fuzzyMatchesVocab(stripped, WASHER_VOCAB, 2)) return 'washer'
  if (fuzzyMatchesVocab(stripped, DRYER_VOCAB, 2)) return 'dryer'

  return ''
}
