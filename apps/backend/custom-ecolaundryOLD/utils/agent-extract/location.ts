// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Iron rule #4 alignment: mutates state.location, state.pendingFlow,
// state.locationClarificationCount, state.locationAckPending,
// state.locationStreet. None of these are in rule #4's protected set
// (pendingClosure / operatorRequested / pendingEscalation /
// customerNameRequested / escalationReason). Moved verbatim from source.
//
// Step 5 of autoExtractFacts. Three sub-steps:
//   1. FAQ location switch override (Caso 12, F61, F64).
//   2. Cold-start location capture (explicit + standalone + inline scan).
//   3. F79 landmark-based fallback.
//   4. Mataró street capture (when bot asked locationStreetRequested).

import type { AgentRuntime } from '../../models/index.js'
import { extractExplicitLocation, isLikelyStandaloneLocationInput } from '../intent.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy } from '../message-parsing.js'
import { resolveLocationByLandmarks } from '../locations.js'

export function extractLocation(ar: AgentRuntime, trimmed: string): void {
  const state = ar.state

  // 5.1 — Location switch in FAQ context.
  if (
    state.location &&
    (state.lastResolvedIntent === 'faq' ||
      state.previousBranch === 'faq' ||
      state.pendingFlow === 'faq-prices-await-dryer-confirm' ||
      state.pendingFlow === 'faq-prices-await-washer-confirm' ||
      state.pendingFlow === 'faq-prices-await-location' ||
      state.pendingFlow === 'faq-hours-await-location')
  ) {
    const explicitSwitch = extractExplicitLocation(trimmed)
    if (explicitSwitch) {
      const resolved =
        resolveKnownLocation(explicitSwitch) || resolveKnownLocationFuzzy(explicitSwitch)
      if (resolved && resolved !== state.location) {
        state.location = resolved
        if (
          state.pendingFlow === 'faq-prices-await-dryer-confirm' ||
          state.pendingFlow === 'faq-prices-await-washer-confirm'
        ) {
          state.pendingFlow = ''
        }
        if (!state.pendingFlow && state.lastFaqKey === 'pricing') {
          state.pendingFlow = 'faq-prices-await-location'
        } else if (!state.pendingFlow && state.lastFaqKey === 'openingHours') {
          state.pendingFlow = 'faq-hours-await-location'
        }
      }
    }
  }

  // 5.2 — Cold-start location capture (explicit + standalone + inline scan).
  if (!state.location) {
    const explicit = extractExplicitLocation(trimmed)
    const candidate = explicit || (isLikelyStandaloneLocationInput(state, trimmed) ? trimmed : null)
    if (candidate) {
      const known = resolveKnownLocation(candidate) || resolveKnownLocationFuzzy(candidate)
      if (known) {
        state.location = known
      } else {
        state.locationClarificationCount = (state.locationClarificationCount || 0) + 1
      }
    } else {
      const inlineKnown = resolveKnownLocation(trimmed)
      if (inlineKnown) {
        state.location = inlineKnown
      }
    }

    // 5.3 — F79 landmark fallback. Fires only when previous resolvers
    // didn't capture anything AND the landmark unambiguously identifies
    // a single location.
    if (!state.location) {
      const landmarkMatch = resolveLocationByLandmarks(trimmed, ar.runtime.locations)
      if (landmarkMatch.canonical) {
        state.location = landmarkMatch.canonical
        // L5 polish signal: one-shot turn-local flag consumed by
        // applyGuardOutcome — prepends an acknowledgment ("Entendido, estás
        // en Goya …") for landmark-deduced locations only.
        state.locationAckPending = landmarkMatch.canonical
      }
    }
  }

  // 5.4 — Mataró street capture (only laundry with multiple streets).
  if (state.location && /^matar[oó]$/i.test(state.location.trim()) && !state.locationStreet && state.locationStreetRequested) {
    const street = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim()
    if (street && !/^matar[oó]$/i.test(street)) {
      state.locationStreet = street
    }
  }
}
