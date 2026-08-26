/**
 * INLOCO — the "is in town right now" campaign segment, derived from the stay.
 *
 * ONE authority, TWO consumers, which is why this lives in shared/ and not in
 * the chatbot module:
 *
 *   1. apps/backend/custom-demosappada/agent.ts re-derives it on EVERY turn
 *      and adds/removes the tag — but only for guests who write.
 *   2. apps/scheduler stale-inloco-cleanup job re-derives it daily for every
 *      customer still carrying the tag — covering the guest who departed and
 *      never wrote again, whose tag would otherwise survive forever and route
 *      a "dinner tonight" campaign at someone home since August.
 *
 * Duplicating the rule in the job instead would be exactly the drift the
 * module's own comments warn against: two authorities disagreeing about who
 * is in town. Change the rule HERE and both sides follow.
 */

export const TAG_IN_LOCO = 'INLOCO'

/**
 * The slice of the stay profile this derivation reads. Structural subset of
 * custom-demosappada's StayProfile, so either side can pass what it has.
 */
export interface InLocoStayDates {
  presence?: 'in_loco' | 'remote' | 'planned'
  /** ISO date (YYYY-MM-DD). */
  arrivalDate?: string
  /** ISO date (YYYY-MM-DD) — the day they leave. */
  departureDate?: string
}

/**
 * Is this guest in town right now, according to the dates they gave us?
 * Returns null when we cannot tell — an unknown stay must not remove a tag
 * someone set by hand.
 */
export function isCurrentlyInTown(profile: InLocoStayDates | null, now: Date): boolean | null {
  // What the guest SAID about where they are beats every assumption below.
  // The no-dates default of "probably in town" predates `presence`, and it
  // tagged a guest coming NEXT MONTH as INLOCO on their first message
  // (2026-08-27, live): a tonight's-dinner campaign would have reached
  // someone 500km away. A planned guest is in town only once their arrival
  // date has come.
  if (profile?.presence === 'remote') return false
  if (profile?.presence === 'planned') {
    const arrival = profile?.arrivalDate
    if (!arrival) return false
    const arrivalMs = Date.parse(`${arrival}T00:00:00`)
    if (Number.isNaN(arrivalMs) || now.getTime() < arrivalMs) return false
    // Arrived: fall through to the date logic below, which also knows when
    // the stay ends.
  }

  const departure = profile?.departureDate

  // No dates yet. Someone writing to a destination assistant is almost always
  // standing in the destination — that is what the QR code on the wall is for
  // — so they count as in town until a departure date says otherwise. Waiting
  // for the dates meant a guest who never answered that question was never
  // tagged, and never reached by a single campaign.
  if (!departure) {
    const arrival = profile?.arrivalDate
    if (!arrival) return true
    const arrivalMs = Date.parse(`${arrival}T00:00:00`)
    return Number.isNaN(arrivalMs) ? true : now.getTime() >= arrivalMs
  }

  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return null
  if (now.getTime() > departureMs) return false

  const arrival = profile?.arrivalDate
  if (arrival) {
    const arrivalMs = Date.parse(`${arrival}T00:00:00`)
    if (!Number.isNaN(arrivalMs) && now.getTime() < arrivalMs) return false
  }
  return true
}
