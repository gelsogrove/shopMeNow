// Caso 34 — FAQ detergente/jabón.
//
// Fires at ANY turn when the customer asks about soap, detergent or softener.
// This covers both T1 (cold start: "No veo jabón") and T2+ (mid-flow pivot:
// customer in DOOR troubleshooting suddenly asks "¿hay jabón?").
//
// Architecture note: no pendingFlow needed — the answer is self-contained
// (single-turn FAQ, no gather step required). The guard simply reads the
// `detergents` FAQ key from json/faqs.json, marks lastResolvedIntent='faq',
// and exits.
//
// Iron rule #6 (tracked exemption): detectDetergentFaqIntent in
// utils/intent.ts is a regex-based topic classifier, the same pattern
// as detectHoursIntent / detectPriceIntent (Caso 12). See CLAUDE.md
// § "Tracked exemption — FAQ topic guards".
//
// F67 (Andrea 2026-05-21): real chat — "No veo jabón" → router classified
// trouble-machine → asked for display. Root cause: router had no examples
// for jabón/detergent so LLM read "no veo" as a machine problem. Fix is
// dual: (1) router-prompt.ts examples added; (2) this deterministic guard
// intercepts at T2+ when the router never fires again.

import { getFaqs } from '../runtime.js'
import type { Guard } from '../../models/index.js'
import { detectDetergentFaqIntent } from '../intent.js'

export const guardFaqDetergents: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectDetergentFaqIntent(userMessage)) return null

  const answer = getFaqs()['detergents']
  if (!answer) return null

  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = null
  return { reply: answer, reason: 'faq-detergents' }
}
