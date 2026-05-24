// Generic FAQ closure: after a non-troubleshooting FAQ, customer
// acknowledges with a short "gracias / entendido". Close politely.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { releaseBranchOnFaqClosure } from '../state-transitions.js'

export const guardFaqClosure: Guard = (ar, userMessage) => {
  if (
    ar.state.lastResolvedIntent !== 'faq' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase().replace(/[.,!?¿¡]/g, '').trim()
  // F95 (Andrea 2026-05-23): require the message to BE the acknowledgement, not
  // start with one. Old regex matched "ok ma quanto costa" and swallowed the
  // follow-up pricing question. Allow only the bare acknowledgement, optionally
  // followed by a polite tail like "gracias" / "thanks" (still no real intent).
  // F-Caso11 (Andrea 2026-05-23): added Catalan forms — "d'acord" (CA equivalent
  // of ES "de acuerdo"/"ok") and "entès" (CA equivalent of ES "entendido").
  // Without these, a CA customer saying "d'acord" after a FAQ reply was
  // interpreted as an unknown location ask → list of laundries response.
  // Iron rule #8: every detector covers all enabled languages (ES/CA/EN).
  // Also added "merci" as standalone (was only allowed in polite tail).
  // F97 — added bare affirmatives: "si"/"sí" (ES/IT/CA), "yes" (EN),
  // "sim" (PT), "oui" (FR). After a deterministic loyalty-card reply
  // (F94+F95+F96 rephrase bypass: no follow-up question appended), a bare
  // "si" means "understood" — NOT a machine-flow confirmation. Safe because
  // guard is gated on lastResolvedIntent === 'faq'.
  const isAcknowledgment = /^(gracias|grazie|thanks|thank\s+you|merci|perfecto|perfect|perfetto|entendido|entendut|ent[èe]s|capito|got\s+it|ok|okay|vale|claro|de\s+acuerdo|d'?\s*accordo|d'?\s*acord|adelante|s[ií]|yes|sim|oui)(?:\s+(?:gracias|gr[àa]cies|grazie|thanks|merci|obrigado))?$/i.test(lower)
  if (!isAcknowledgment) return null
  ar.state.lastResolvedIntent = null
  // F63: release sticky branch so T+1 re-routes via dispatchTurnOne.
  releaseBranchOnFaqClosure(ar)
  return { reply: t('faqClosure', lang(ar)), reason: 'faq-closure' }
}
