// Caso 35 — FAQ how to use the laundromat.
//
// Fires at ANY turn when the customer asks how to use the machines / laundromat.
// Covers T1 (cold start: "¿Cómo se usa la lavandería?") and T2+ (mid-flow
// pivot: customer mid-troubleshoot asks "pero, ¿cómo se usa exactamente?").
//
// Architecture note: no pendingFlow needed — the answer is self-contained
// (single-turn FAQ, no gather step required). Same pattern as guardFaqDetergents
// (Caso 34): reads the FAQ key, marks lastResolvedIntent='faq', exits.
// The faqPause mechanic (F28) handles mid-flow pivots automatically via the
// polishReplyForTurn invariant in agent.ts — no state changes needed here.
//
// Iron rule #6 (tracked exemption): detectHowToUseIntent is a regex-based
// topic classifier, same pattern as detectDetergentFaqIntent / detectHoursIntent.
// See CLAUDE.md § "Tracked exemption — FAQ topic guards".
//
// F69 (Andrea 2026-05-21): new case from Olga — operator requested that
// customers asking "how do I use the laundromat" receive the canonical
// 7-step instructions directly, without asking for location (instructions
// are identical across all laundromats). Per-location override supported
// via locations.json:faqOverrides.howToUse (same mechanism as other FAQs).

import { getFaqs } from '../runtime.js'
import type { Guard } from '../../models/index.js'
import { detectHowToUseIntent } from '../intent.js'

export const guardFaqHowToUse: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectHowToUseIntent(userMessage)) return null

  const answer = getFaqs()['howToUse']
  if (!answer) return null

  ar.state.lastResolvedIntent = 'faq'
  ar.state.lastFaqKey = null
  return { reply: answer, reason: 'faq-how-to-use' }
}
