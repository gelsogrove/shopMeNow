import { FlowCategoryLookupOutcome } from './flow-retrieval.types'
import { isPlausibleSerialNumber, normalizeSerialNumber } from './flow-retrieval.service'

// serialNumber -> FlowCategory matcher. Real format confirmed by the client
// (analisi.md §13 blocker resolved): 19 chars, prefix HKX (2025 models) or
// HKA (2026 models), e.g. HKX3EB100JD25070076. Matching is by prefix,
// declared per FlowCategory in lookupRules.prefix (e.g. "HKX3EB100" for a
// specific 2025 model, or just "HKX" if the workspace only distinguishes by
// year) — exact match against FlowCategory.slug remains a fallback for
// categories not yet configured with a prefix rule.
export interface FlowCategoryLookupCandidate {
  id: string
  slug: string
  lookupRules: Record<string, unknown>
}

export function matchSerialNumberToCategory(
  serialNumber: string | undefined | null,
  candidates: FlowCategoryLookupCandidate[],
): FlowCategoryLookupOutcome {
  if (!isPlausibleSerialNumber(serialNumber)) {
    return { status: 'serial_absent' }
  }

  const normalized = normalizeSerialNumber(serialNumber!)

  for (const candidate of candidates) {
    const prefix = typeof candidate.lookupRules.prefix === 'string' ? candidate.lookupRules.prefix.toUpperCase() : null
    if (prefix && normalized.startsWith(prefix)) {
      return { status: 'resolved', flowCategoryId: candidate.id }
    }
    if (normalized === candidate.slug.toUpperCase()) {
      return { status: 'resolved', flowCategoryId: candidate.id }
    }
  }

  return { status: 'not_found' }
}
