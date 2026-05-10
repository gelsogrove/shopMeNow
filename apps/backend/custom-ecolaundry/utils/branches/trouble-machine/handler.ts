// Trouble-machine branch handler.
//
// Status: thin wrapper (Andrea, 2026-05-08). The branch is ROUTED here at T1
// by utils/router.ts (LLM classification) but the actual gather → flow →
// resolution work is still done by the legacy guard pipeline + LLM loop.
// This is the intended phase-C waypoint: the routing benefit (T1 picks
// the right branch in any of 6 supported languages) ships now; the full
// migration of force-gather + display-flow + post-instruction-failure
// guards into a self-contained branch state machine happens in a later
// session.
//
// Why "delegate-to-legacy" instead of just keeping the legacy pipeline?
//   - state.activeBranch sticks to "trouble-machine" after T1, so T2+
//     turns skip the router entirely (cost / latency saving).
//   - Eventual migration is incremental: when the gather state machine
//     is ported here, this handler stops returning "delegate-to-legacy"
//     and produces the reply directly.
//
// The router may capture a `displayHint` (e.g. "PUSH PROG") and a
// `locationHint` from the customer's first message. We seed those into
// state when present so the legacy autoExtract has a head start.

import { resolveKnownLocation } from '../../message-parsing/locations.js'
import { extractDisplayState } from '../../intent.js'
import type { BranchHandler } from '../types.js'

export const troubleMachineHandler: BranchHandler = async ({ ar, routerDetails }) => {
  // Seed sticky state with hints captured by the router. Skip if the field
  // is already set (autoExtract or a previous turn beat us to it).
  const hintLocation = routerDetails.locationHint
  if (hintLocation && !ar.state.location) {
    const known = resolveKnownLocation(hintLocation)
    if (known) ar.state.location = known
  }

  const hintDisplay = routerDetails.displayHint
  if (hintDisplay && !ar.state.displayState) {
    const normalised = extractDisplayState(hintDisplay)
    if (normalised) ar.state.displayState = normalised
  }

  // F31 (Andrea 2026-05-10) — sub-case routing. The router LLM has classified
  // the message into one of the documented Casi at the same time as the
  // branch decision. Use that signal to set state.pendingFlow semantically,
  // bypassing the fragile regex L3 detectors in autoExtractFacts that have
  // produced F16/F24/F29 over the day.
  //
  // Only seed when no pendingFlow is already set (don't override a previous
  // turn's flow) and only on T1 (turnCount === 0 because the bot has not
  // yet emitted T1 reply). The legacy guard pipeline picks up the flag and
  // dispatches to the right guard (guardPaymentNoChange / guardAskPhoto /
  // guardNumericCodeAskLetters).
  if (!ar.state.pendingFlow) {
    const subCase = routerDetails.subCase
    switch (subCase) {
      case 'paid-not-activated':
        ar.state.pendingFlow = 'no-change-ask'
        break
      case 'display-unreadable':
        ar.state.pendingFlow = 'photo-await-decision'
        ar.state.displayUnreadable = true
        break
      case 'numeric-code':
        // The actual code value will be captured by the inline regex in
        // autoExtractFacts (detectNumericCodeIntent). The flag here only
        // signals to the legacy pipeline that a numeric-code flow is intended.
        // If detectNumericCodeIntent already fired, that path has already
        // populated faqCodeValue → no-op. If not, the bot will ask for the
        // code through guardDiscountCodeAsk which is the right fallback.
        break
      // 'paid-not-used', 'display-driven', 'none' → fall through to legacy
      // gather pipeline; no pendingFlow seeding needed.
      default:
        break
    }
  }

  return {
    reply: '',
    handoff: 'delegate-to-legacy',
  }
}
