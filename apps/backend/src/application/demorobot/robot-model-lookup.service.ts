import { ModelLookupOutcome } from './flow-retrieval.types'
import { isPlausibleSerialNumber } from './flow-retrieval.service'

// Pluggable serialNumber -> RobotModel matcher. The REAL matching strategy
// is an explicit open item (analisi.md §13, proposal.md Non-goals) — this
// is a placeholder implementation (exact match against RobotModel.slug, or
// a simple prefix rule declared in RobotModel.lookupRules) that will be
// replaced once real serial-number data is available from the demoRobot
// client. Swapping the strategy later is a data/config change here, not a
// rewrite of the retrieval callers.
export interface RobotModelLookupCandidate {
  id: string
  slug: string
  lookupRules: Record<string, unknown>
}

export function matchSerialNumberToModel(
  serialNumber: string | undefined | null,
  candidates: RobotModelLookupCandidate[],
): ModelLookupOutcome {
  if (!isPlausibleSerialNumber(serialNumber)) {
    return { status: 'serial_absent' }
  }

  const normalized = serialNumber!.trim().toUpperCase()

  for (const candidate of candidates) {
    const prefix = typeof candidate.lookupRules.prefix === 'string' ? candidate.lookupRules.prefix.toUpperCase() : null
    if (prefix && normalized.startsWith(prefix)) {
      return { status: 'resolved', robotModelId: candidate.id }
    }
    if (normalized === candidate.slug.toUpperCase()) {
      return { status: 'resolved', robotModelId: candidate.id }
    }
  }

  return { status: 'not_found' }
}
