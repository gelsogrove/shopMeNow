// Caso 12.2 — FAQ precios (location-driven, machine-aware).
// Four-phase flow: T1 detect+ask-location → T2 location reply → T3 confirm
// (dryer-confirm after washer-default OR washer-confirm after dryer-only).
// F58: type-specific branches also arm the opposite-type follow-up flag.
// F62: confirm guards emit faqClosure on decline (no LLM pipeline hole).
// Iron rule #6: detectPriceIntent / detectMachineTypeMention are FAQ topic
// classifiers (tracked exemption).

import { t, type TranslationKey } from '../localization.js'
import type { AgentRuntime, Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { detectPriceIntent, detectMachineTypeMention } from '../intent.js'
import { releaseBranchOnFaqClosure } from '../state-transitions.js'
import { formatWasherPrices, formatDryerPrices } from '../faq-location-formatter.js'
import type { ProgramTranslateFn } from '../faq-programs-formatter.js'
import type { SupportedLanguage } from '../../models/index.js'
import { AFFIRMATIVE_RE, NEGATIVE_RE } from '../patterns.js'

function isAffirmative(msg: string): boolean {
  return AFFIRMATIVE_RE.test(msg.trim().toLowerCase())
}

function isNegative(msg: string): boolean {
  return NEGATIVE_RE.test(msg.trim().toLowerCase())
}

// F88 — detect incomprehensible / truncated messages that should trigger
// a repeat-question instead of being treated as a "decline".
// A message is incomprehensible (in the context of a yes/no confirm question)
// when it is short AND not a recognisable yes/no/machine-type token.
// Threshold: ≤ 8 chars after trim covers typical truncated messages like:
//   "how muc" (7) — truncated "how much", "wo" (2) — typo, "hm" (2), etc.
// Messages longer than 8 chars that are not affirmative/machine are treated
// as a decline (existing F62 behaviour: "gracias, eso es todo" → faqClosure).
function isIncomprehensible(msg: string): boolean {
  const trimmed = msg.trim()
  if (trimmed.length === 0) return true
  // Short messages that are not a clear yes/no/machine-type → incomprehensible.
  // "lavadora" (8 chars) is a valid machine mention → NOT incomprehensible.
  if (
    trimmed.length <= 8 &&
    !isAffirmative(trimmed) &&
    !isNegative(trimmed) &&
    !detectMachineTypeMention(trimmed)
  )
    return true
  return false
}

// F87 — build a translateFn closure over the current tenant lang, to pass
// to formatWasherPrices/formatDryerPrices so they append paymentCardOnly /
// paymentTpvExact boundary signals. Same shape as ProgramTranslateFn from
// faq-programs-formatter (key → localised string).
function buildTranslateFn(ar: AgentRuntime): ProgramTranslateFn {
  const lng = lang(ar)
  return (key: string) => t(key as TranslationKey, lng)
}

export const guardFaqPrices: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  if (!detectPriceIntent(userMessage)) return null

  // F52: persist machine type from T1 to T2 (verb-aware detector).
  const mentionedAtT1 = detectMachineTypeMention(userMessage)
  if (mentionedAtT1) {
    ar.state.faqPricesType = mentionedAtT1
  }

  if (!ar.state.location) {
    ar.state.pendingFlow = 'faq-prices-await-location'
    return { reply: t('pricesAsk', lang(ar)), reason: 'faq-prices-ask-location' }
  }

  return renderPrices(ar, userMessage)
}

export const guardFaqPricesAwaitLocation: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'faq-prices-await-location') return null
  if (!ar.state.location) return null

  ar.state.pendingFlow = ''
  return renderPrices(ar, userMessage)
}

export const guardFaqPricesAwaitDryerConfirm: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'faq-prices-await-dryer-confirm') return null
  if (!ar.state.location) return null

  const mentionsDryer = detectMachineTypeMention(userMessage) === 'dryer'

  // F88: incomprehensible / truncated message → repeat the question
  // instead of treating it as a decline. Avoids "how muc" → faqClosure.
  if (isIncomprehensible(userMessage)) {
    return { reply: t('faqConfirmRepeatDryer', lang(ar)), reason: 'faq-prices-dryer-repeat' }
  }

  if (!isAffirmative(userMessage) && !mentionsDryer) {
    // F62: decline → polite closure (iron rule #10 catch-all).
    // F63: also release the sticky activeBranch so T+1 re-routes through
    // dispatchTurnOne instead of re-entering faqHandler with empty routerDetails.
    ar.state.pendingFlow = ''
    ar.state.lastResolvedIntent = null
    ar.state.lastFaqKey = null
    releaseBranchOnFaqClosure(ar)
    return { reply: t('faqClosure', lang(ar)), reason: 'faq-prices-dryer-decline' }
  }

  ar.state.pendingFlow = ''
  // F87 — translateFn enables paymentCardOnly + paymentTpvExact appending.
  const formatted = formatDryerPrices(ar.state.location, ar.runtime, buildTranslateFn(ar), ar.state.language as SupportedLanguage)
  return {
    reply: formatted || t('priceWarning', lang(ar)),
    reason: 'faq-prices-dryer-confirm',
  }
}

// F58 (Andrea 2026-05-15): mirror of dryer-confirm for the dryer-first path.
export const guardFaqPricesAwaitWasherConfirm: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'faq-prices-await-washer-confirm') return null
  if (!ar.state.location) return null

  const mentionsWasher = detectMachineTypeMention(userMessage) === 'washer'

  // F88: incomprehensible / truncated message → repeat the question.
  if (isIncomprehensible(userMessage)) {
    return { reply: t('faqConfirmRepeatWasher', lang(ar)), reason: 'faq-prices-washer-repeat' }
  }

  if (!isAffirmative(userMessage) && !mentionsWasher) {
    // F62+F63: mirror of dryer-confirm — polite closure + branch release.
    ar.state.pendingFlow = ''
    ar.state.lastResolvedIntent = null
    ar.state.lastFaqKey = null
    releaseBranchOnFaqClosure(ar)
    return { reply: t('faqClosure', lang(ar)), reason: 'faq-prices-washer-decline' }
  }

  ar.state.pendingFlow = ''
  // F87 — translateFn enables paymentCardOnly + paymentTpvExact appending.
  const formatted = formatWasherPrices(ar.state.location, ar.runtime, buildTranslateFn(ar), ar.state.language as SupportedLanguage)
  return {
    reply: formatted || t('priceWarning', lang(ar)),
    reason: 'faq-prices-washer-confirm',
  }
}

// Internal renderer — chooses washer / dryer / both (F58). Falls back to warning when locations.json has no data.
function renderPrices(
  ar: Parameters<Guard>[0],
  userMessage: string,
): ReturnType<Guard> {
  const mentioned = detectMachineTypeMention(userMessage) || ar.state.faqPricesType
  const lng = lang(ar)
  // F87 — translateFn passed to formatWasherPrices/formatDryerPrices so the
  // boundary signals (paymentCardOnly / paymentTpvExact) get appended.
  const translateFn: ProgramTranslateFn = (key: string) => t(key as TranslationKey, lng)
  const loc = ar.state.location!
  ar.state.lastResolvedIntent = 'faq'
  // F61: remember we resolved a prices FAQ so the F51 location-switch block
  // in agent-extract can RE-ARM faq-prices-await-location on the next pivot
  // (e.g. "e a Pineda?") and the deterministic guard renders again —
  // without this the LLM rephrase improvises a non-canonical reply.
  ar.state.lastFaqKey = 'pricing'
  ar.state.faqPricesType = null

  // F58: type-specific branches also offer the OTHER type as follow-up.
  if (mentioned === 'washer') {
    const formatted = formatWasherPrices(loc, ar.runtime, translateFn, ar.state.language as SupportedLanguage)
    if (formatted) {
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      return {
        reply: `${formatted}\n\n${t('pricesDryerHint', lng)}`,
        reason: 'faq-prices-washer',
      }
    }
    return { reply: t('priceWarning', lng), reason: 'faq-prices-washer' }
  }
  if (mentioned === 'dryer') {
    const formatted = formatDryerPrices(loc, ar.runtime, translateFn, ar.state.language as SupportedLanguage)
    if (formatted) {
      ar.state.pendingFlow = 'faq-prices-await-washer-confirm'
      return {
        reply: `${formatted}\n\n${t('pricesWasherHint', lng)}`,
        reason: 'faq-prices-dryer',
      }
    }
    return { reply: t('priceWarning', lng), reason: 'faq-prices-dryer' }
  }

  // F53: no specific type → render washers + dryer hint.
  const washers = formatWasherPrices(loc, ar.runtime, translateFn, ar.state.language as SupportedLanguage)
  if (washers) {
    ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
    return {
      reply: `${washers}\n\n${t('pricesDryerHint', lng)}`,
      reason: 'faq-prices-washers-default',
    }
  }
  return { reply: t('priceWarning', lng), reason: 'faq-prices-fallback' }
}
