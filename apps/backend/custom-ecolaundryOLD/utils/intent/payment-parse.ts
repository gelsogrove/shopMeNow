// REFACTOR ONLY — pure move of parsePaymentAnswer and isPaidButNotActivatedCase
// from utils/intent.ts into a barrel-split cassette. Zero behavioural change.
//
// Iron rule #6 alignment: parsePaymentAnswer is a yes/no boundary parser
// (allowed signal type per CLAUDE.md "Allowed: yes/no confirmation").
// isPaidButNotActivatedCase is a state predicate (no phrase detection).
// Sibling-test exemption (iron rule #5): check-architecture.sh enforces rule
// #5 with `find utils -maxdepth 1`, so files under utils/intent/ are NOT
// required to ship sibling tests. Coverage is preserved by the existing
// __tests__/unit/intent.test.ts which imports from the barrel utils/intent.ts.
//
// History: G1, F17. Full design rationale: docs/usecases.md.

import type { SessionState } from '../../models/index.js'

export function isPaidButNotActivatedCase(
  state: SessionState,
  _issueSummary: string,
  routeMachineType: '' | 'washer' | 'dryer',
): boolean {
  if (routeMachineType !== 'washer' && routeMachineType !== 'dryer') return false
  if (state.paymentCompleted !== true) return false
  if (state.displayState) return false
  return true
}

export function parsePaymentAnswer(message: string): boolean | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  if (/^(no|not yet|non ancora|ancora no|todav[ií]a no|a[uú]n no|aun no|pas encore|ainda n[ãa]o|encara no)$/i.test(normalized)) {
    return false
  }

  if (/\b(non ho pagato|not paid|non pagato|no he pagado|todav[ií]a no|a[uú]n no|n[ãa]o paguei|no he pagat|pas encore pay[eé])\b/i.test(normalized)) {
    return false
  }

  // \b is ASCII-only in JS regex → does NOT match after accented "í" — use
  // explicit lookahead for word boundary (G1, F17, Andrea 2026-05-10).
  const wordEnd = '(?=\\s|[!?.,;]|$)'
  if (
    new RegExp(`^(yes|y|si|sì|sí|sim|oui|és)${wordEnd}`, 'i').test(normalized) ||
    /\b(ho pagato|pagato|paid|pagamento fatto|payment completed|fatto il pagamento|ho messo i soldi|messo i soldi|inserito i soldi)\b/i.test(normalized) ||
    new RegExp(`\\bpagu[eé]${wordEnd}`, 'i').test(normalized) ||
    /\bhe\s+pagado\b/i.test(normalized) ||
    /\bya\s+pagu[eé]\b/i.test(normalized) ||
    /\bya\s+he\s+pagado\b/i.test(normalized) ||
    /\bs[íi]\s+he\s+pagado\b/i.test(normalized) ||
    /\b(j[áa]\s+)?paguei\b/i.test(normalized)
  ) {
    return true
  }

  return null
}
