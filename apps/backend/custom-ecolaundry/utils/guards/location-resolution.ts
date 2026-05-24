// Location resolution guards: detect Mataró street, escalate unknown locations,
// insist when the customer says "I don't know", and the architectural
// catch-all `guardForceLocation` that prevents the "fact-out-of-order" hole
// (see CLAUDE.md → architectural rule: guard preconditions must not cancel
// each other out).

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { isMataro, lang } from './helpers.js'
import { listAllLandmarks, listLaundromatsForReply } from '../locations.js'
import { TARJETA_TOPIC } from './loyalty-card-buy.js'

// Escalations that skip location: operator handles via customer-account
// history, not laundromat (refund / compensation demands, cameras / AJAX).
const INCIDENTS_NO_LOCATION_REQUIRED: ReadonlySet<string> = new Set([
  'cameras-or-ajax',
  'refund-demand',
  'compensation-demand',
])

// F82 — "I don't know which Mataró laundromat" — 6 languages.
const MATARO_DONT_KNOW_RE =
  /^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea|non\s+lo\s+s[eo]|non\s+s[eo]|non\s+ricordo|non\s+mi\s+ricordo|i\s+don'?t\s+know|no\s+idea|not\s+sure|no\s+ho\s+s[eé]|no\s+ho\s+idea|no\s+sap|je\s+(?:ne\s+)?sais\s+pas|j'?en\s+sais\s+pas|pas\s+s[uû]r|não\s+sei|não\s+me\s+lembro|não\s+tenho\s+ideia)(?:\s|$|[.,!?])/i

/** G2.5 — Mataró street: as soon as the customer names Mataró as location,
 *  ask the street BEFORE asking machine type/number/display.
 *
 *  F82: when the customer already received the Goya/Alemanya question
 *  (`locationStreetRequested`) and replies "non lo so / no lo sé / …",
 *  show the Goya-specific landmarks (Mercadona, Biblioteca) so the
 *  customer can self-identify which laundromat they are in. */
export const guardMataroStreet: Guard = (ar, userMessage) => {
  if (
    !isMataro(ar) ||
    ar.state.locationStreet ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }

  // F82: already asked → customer says "non lo so" → show Goya landmarks
  if (ar.state.locationStreetRequested && MATARO_DONT_KNOW_RE.test(userMessage.trim())) {
    const goyaMeta = ar.runtime.locations?.locations?.Goya?.metadata as
      | { landmarks?: string[] }
      | undefined
    const landmarks = goyaMeta?.landmarks ?? []
    if (landmarks.length > 0) {
      return {
        reply: tt('mataroStreetInsist', lang(ar), { landmarks: landmarks.join(', ') }),
        reason: 'mataro-street-insist',
      }
    }
    // No landmarks data → fall through to re-ask
  }

  // F100 — preserve loyalty card topic across the Mataró street disambiguation
  // turn. When the customer's T1 message contains a loyalty card intent (e.g.
  // "posso usare una tessera comprata in un'altra lavanderia?"), guardMataroStreet
  // wins the pipeline and asks for the street sub-location. Without this line,
  // the loyalty context is lost: at T2 ("Goya"), no guard fires because neither
  // TARJETA_TOPIC.test("Goya") nor state.faqTopic matches. Setting faqTopic here
  // arms guardLoyaltyCardBuy's askedTarjeta branch so it fires at T2 once the
  // sub-location is known — same pattern as pendingFlow preservation across
  // multi-step gather turns.
  if (TARJETA_TOPIC.test(userMessage)) {
    ar.state.faqTopic = 'buy-loyalty-card'
  }

  ar.state.locationStreetRequested = true
  return {
    reply: t('mataroStreet', lang(ar)),
    reason: 'mataro-street',
  }
}

/** Customer mentioned a location that is not in our laundromat list — list
 *  the valid options. Fires only after at least one clarification round and
 *  no other deterministic flow is active. */
export const guardUnknownLocation: Guard = (ar) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    !ar.state.locationClarificationCount ||
    ar.state.turnCount < 2 ||
    ar.state.pendingFlow ||
    ar.state.nonTroubleshootingIncident ||
    // F106 (2026-05-24): display-flows with requires:[] (e.g. countdown-display)
    // do not need location. autoExtractFacts may increment locationClarificationCount
    // when the customer's reply (e.g. "ya terminó") looks like a failed standalone
    // location attempt, but if an active no-location flow is running, the customer
    // is answering the flow — not providing a location. Skip this guard so
    // guardDisplayFlowFollowUp (later in the pipeline) can handle the reply.
    // Same pattern as guardForceLocation F104 Phase B bypass.
    ar.runtime.displayFlows.flows.some(
      (f) =>
        f.requires.length === 0 &&
        f.id === ar.state.activeFlowId,
    )
  ) {
    return null
  }
  return {
    reply: tt('unknownLocationList', lang(ar), { list: listLaundromatsForReply() }),
    reason: 'unknown-location',
  }
}

// Catch-all gather guard for location (Iron rule #10). When location is
// empty and the customer has had a chance to provide it (turnCount ≥ 2),
// the bot ALWAYS asks for the location before any other flow can take over.
// Escape hatches: escalations that genuinely don't need a location
// (INCIDENTS_NO_LOCATION_REQUIRED) and the explicit "no lo sé" branch
// (handled by guardInsistLocation). Pipeline placement: BEFORE every other
// gather / display-flow / escalation guard. See guards/index.ts:GUARD_PIPELINE.
// REGRESSION 2026-05-09: customer T1 "me han cobrado dos veces" set
// pendingFlow=double-charge-ask-used, no guard fired (location empty +
// turnCount<2), LLM improvised an out-of-order "¿has podido lavar?".
export const guardForceLocation: Guard = (ar) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    // Mataró: handled by guardMataroStreet which fires earlier in the pipeline
    // (only when location IS Mataró). If location is empty, we still want the
    // generic location ask here — the customer can name Mataró in the reply
    // and Mataró street ask will fire on the next turn.
    ar.state.pendingFlow === 'invoice-ask-location' ||
    // Don't gate non-troubleshooting incidents that escalate without location
    // (cameras / refund / compensation — the operator handles them via
    // customer-account history, not laundromat).
    INCIDENTS_NO_LOCATION_REQUIRED.has(ar.state.nonTroubleshootingIncident || '') ||
    // F104: display-flows with requires:[] (e.g. countdown-display) do not need
    // location. Two cases:
    //   Phase A (T1): displayState matches a no-location flow → let guardDisplayFlowStart fire.
    //   Phase B (T2): activeFlowId is already a no-location flow → let guardDisplayFlowFollowUp fire.
    ar.runtime.displayFlows.flows.some(
      (f) =>
        f.requires.length === 0 &&
        (f.id === ar.state.activeFlowId ||
          f.displayMatches.some(
            (m) =>
              m.toUpperCase().replace(/\s+/g, '') ===
              (ar.state.displayState ?? '').toUpperCase().replace(/\s+/g, ''),
          )),
    )
  ) {
    return null
  }
  // Fires from T1 so the LLM never improvises a gather question while
  // location is still empty. Welcome paragraph is prepended automatically
  // by applyGuardOutcome → shouldShowWelcome('force-location').
  return {
    reply: t('location', lang(ar)),
    reason: 'force-location',
  }
}

/** Customer says "no lo sé / no me acuerdo / ni idea" — insist that we need
 *  the location before we can help.
 *
 *  F79: when the tenant has landmarks configured in json/locations.json,
 *  append the landmark enumeration so the customer can identify the
 *  laundromat by a nearby reference point ("Mercadona, Carrefour, …"). The
 *  list is generated dynamically from runtime.locations — adding a new
 *  landmark is a JSON edit, no code change. When no landmarks are
 *  configured the guard keeps the legacy single-sentence behaviour. */
export const guardInsistLocation: Guard = (ar, userMessage) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  const dontKnow = /^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea|non\s+lo\s+s[eo]|non\s+s[eo]|non\s+ricordo|non\s+mi\s+ricordo|i\s+don'?t\s+know|no\s+idea|not\s+sure|no\s+sé|no\s+ho\s+idea|no\s+sap|no\s+ho\s+s[eé]|je\s+(?:ne\s+)?sais\s+pas|j'?en\s+sais\s+pas|pas\s+s[uû]r|não\s+sei|não\s+me\s+lembro|não\s+tenho\s+ideia)(?:\s|$|[.,!?])/i.test(reply)
  if (!dontKnow) return null

  const followUp = t('insistLocationFollowUp', lang(ar))
  const landmarks = listAllLandmarks(ar.runtime.locations)
  if (landmarks.length === 0) {
    return { reply: followUp, reason: 'insist-location-followup' }
  }
  const enumeration = tt('landmarkEnumerationAsk', lang(ar), {
    landmarks: landmarks.join(', '),
  })
  return {
    reply: `${followUp}\n\n${enumeration}`,
    reason: 'insist-location-followup',
  }
}
