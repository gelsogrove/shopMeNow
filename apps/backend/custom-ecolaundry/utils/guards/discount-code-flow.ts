// Discount code — Tengo un código de descuento (LLM detects, deterministic gather).
//
// Format expected for a valid discount code: `^<prefix>(\d{2})(\d{2})(\d{2})(\d+)$`
//   - prefix:        uppercase letters from settings.json (e.g. SAU)
//   - 6 digits date: DDMMYY                              (e.g. 290426 → 2026-04-29)
//   - 1+ digits:     amount                              (e.g. 6)
// Example with prefix "SAU": SAU2904266
//
// F46 — the prefix is no longer hardcoded `[A-Z]{3}` here. It comes from
// `runtime.settings.discountCodePrefix` (single source of truth, Iron rule #7).
// Parsing/format checks delegate to utils/discount-code-format.ts (pure L3).
//
// Steps:
//   1. ask-code        bot asks "dime el código exacto"
//   2. await-code      user types code → validate format
//                        - valid   → ask-name
//                        - invalid → escalate (formato no reconocido)
//   3. await-name      user types name → ask-pueblo (skip if location known)
//   4. await-pueblo    user types pueblo → ask-machine-number (skip if known)
//   5. await-machine   user types number → ask-puerta
//   6. await-puerta    user confirms door closed → final closure + escalation

import { t } from '../localization.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy } from '../message-parsing.js'
import type { AgentRuntime, Guard } from '../../models/index.js'
import { lang, pivotIfTroubleSwitch } from './helpers.js'
import { buildEscalationSummary, extractEscalationContext } from '../escalation.js'
import { validateCustomerName } from '../customer-name.js'
import { parseDiscountCode } from '../discount-code-format.js'
import { captureCustomerName, closeAsEscalated, escalate, requireCustomerName } from '../state-transitions.js'
import { nextRetryLadderStep } from './retry-ladder.js'

function discountCodePrefix(ar: AgentRuntime): string {
  return ar.runtime.settings.discountCodePrefix
}

/** Caso 8 step 1 — bot asks the customer for the exact code. */
export const guardDiscountCodeAsk: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'discount-code-ask' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'discount-code-await'
  return { reply: t('discountCodeAsk', lang(ar)), reason: 'discount-code-ask' }
}

/** Caso 8 step 2 — customer typed the code: validate format, branch.
 *
 *  3-strikes ladder on format invalid (Andrea, 2026-05-09 regression):
 *  customer types something that doesn't match `^[A-Z]{3}\d{6}\d+$`:
 *    - 1st invalid (counter == 0) → re-ask politely with format hint
 *      (`discountCodeFormatRetry`). Keep `pendingFlow=discount-code-await`
 *      so the next turn reaches this guard again.
 *    - 2nd invalid in a row (counter >= 1) → escalate to operator with
 *      the existing `discountCodeFormatInvalid` + name capture.
 *    - Successful parse → counter resets to 0, flow advances.
 *
 *  REGRESSION: previously the guard escalated immediately on the first
 *  invalid input (real chat: customer typed "xxjdse7" → escalate with no
 *  chance to retype). The retry+escalate ladder mirrors the rule already
 *  in place for display / machineNumber / 4-digits ask.
 */
export const guardDiscountCodeAwait: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'discount-code-await' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const raw = userMessage.trim().replace(/[.,!?¿¡]/g, '').trim()
  if (raw) ar.state.faqCodeValue = raw

  // Numeric-only codes go to the existing "did the code have letters?" flow
  // (Caso 18 — handled by display.ts guards).
  if (/^\d{3,}$/.test(raw)) {
    ar.state.pendingFlow = 'numeric-code-ask-letters'
    return null
  }

  const parsed = parseDiscountCode(raw, discountCodePrefix(ar))
  if (!parsed) {
    // Format invalid: retry once before escalating.
    const attempts = ar.state.discountCodeAskAttempts || 0
    if (attempts >= 1) {
      // 2nd invalid in a row → escalate.
      ar.state.discountCodeAskAttempts = 0
      ar.state.pendingFlow = ''
      escalate(ar, 'Discount code — código con formato no reconocido after 2 attempts')
      requireCustomerName(ar)
      const escalateText = t('discountCodeFormatInvalid', lang(ar))
      const nameAsk = t('customerNameAsk', lang(ar))
      return { reply: `${escalateText} ${nameAsk}`, reason: 'discount-code-escalate' }
    }
    // 1st invalid → re-ask politely. Keep pendingFlow.
    ar.state.discountCodeAskAttempts = attempts + 1
    return {
      reply: t('discountCodeFormatRetry', lang(ar)),
      reason: 'discount-code-format-retry',
    }
  }

  // Valid format → reset retry counter, advance.
  ar.state.discountCodeAskAttempts = 0
  ar.state.discountCodeData.letters = parsed.letters
  ar.state.discountCodeData.fechaIso = parsed.fechaIso
  ar.state.discountCodeData.importe = parsed.importe
  ar.state.pendingFlow = 'discount-code-await-name'
  return { reply: t('discountCodeAskName', lang(ar)), reason: 'discount-code-ask-name' }
}

/** Caso 8 step 3 — capture customer name, then ask pueblo (or skip).
 *  Rejects confirmation words ("si"/"vale"/"gracias"), numeric-only tokens
 *  and 1-char strings via the shared `validateCustomerName` helper, then
 *  re-asks the name on a fresh turn instead of poisoning the state.
 *
 *  Iron rule #10 corollary — 3-strikes ladder via the shared
 *  `awaitNameAskAttempts` counter. After 2 invalid attempts the bot
 *  escalates to a live operator who can collect the name by phone. */
export const guardDiscountCodeAwaitName: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'discount-code-await-name') return null
  if (pivotIfTroubleSwitch(ar, userMessage)) return null  // F86
  const validation = validateCustomerName(userMessage, {
    discountCodePrefix: discountCodePrefix(ar),
  })
  if (!validation.valid) {
    const step = nextRetryLadderStep(
      ar.state.awaitNameAskAttempts,
      (n) => { ar.state.awaitNameAskAttempts = n },
    )
    if (step === 'escalate') {
      ar.state.pendingFlow = ''
      escalate(ar, 'Discount code — could not capture customer name after 2 attempts')
      requireCustomerName(ar)
      return {
        reply: t('reaffirmEscalate', lang(ar)),
        reason: 'discount-code-await-name-escalate',
      }
    }
    return { reply: t('customerNameAsk', lang(ar)), reason: 'discount-code-await-name-reask' }
  }
  // Valid name — captureCustomerName resets awaitNameAskAttempts atomically.
  captureCustomerName(ar, validation.name)
  if (ar.state.location) {
    if (ar.state.machineNumber) {
      ar.state.pendingFlow = 'discount-code-await-door'
      return { reply: t('discountCodeAskDoor', lang(ar)), reason: 'discount-code-ask-door' }
    }
    ar.state.pendingFlow = 'discount-code-await-machine'
    return { reply: t('discountCodeAskMachineNumber', lang(ar)), reason: 'discount-code-ask-machine' }
  }
  ar.state.pendingFlow = 'discount-code-await-location'
  return { reply: t('discountCodeAskLocation', lang(ar)), reason: 'discount-code-ask-location' }
}

/** Caso 8 step 4 — capture pueblo.
 *
 *  Retry ladder (Iron rule #10 corollary) — same pattern as discountCodeAwait:
 *    - 0 invalid attempts → re-ask with explicit list hint (discountCodeLocationReask)
 *    - ≥1 invalid in a row → escalate to operator
 *  Counter: ar.state.discountCodeLocationAskAttempts. Reset to 0 on success.
 *
 *  BUG fixed (2026-05-24): previously `|| raw` stored any unrecognised text
 *  (e.g. "boh non lo so") as ar.state.location. Downstream guards only check
 *  truthiness, so garbage propagated silently to the operator escalation summary.
 */
export const guardDiscountCodeAwaitLocation: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'discount-code-await-location') return null
  if (pivotIfTroubleSwitch(ar, userMessage)) return null  // F86
  const raw = userMessage.trim()
  const matched = resolveKnownLocation(raw) || resolveKnownLocationFuzzy(raw)
  if (!matched) {
    // Unrecognised location — retry once, then escalate.
    const attempts = ar.state.discountCodeLocationAskAttempts || 0
    if (attempts >= 1) {
      ar.state.discountCodeLocationAskAttempts = 0
      ar.state.pendingFlow = ''
      escalate(ar, 'Discount code — no se pudo identificar la lavandería after 2 attempts')
      requireCustomerName(ar)
      const escalateText = t('reaffirmEscalate', lang(ar))
      return { reply: escalateText, reason: 'discount-code-location-escalate' }
    }
    ar.state.discountCodeLocationAskAttempts = attempts + 1
    return { reply: t('discountCodeLocationReask', lang(ar)), reason: 'discount-code-location-reask' }
  }
  // Valid location — reset counter and advance.
  ar.state.discountCodeLocationAskAttempts = 0
  ar.state.location = matched
  if (ar.state.machineNumber) {
    ar.state.pendingFlow = 'discount-code-await-door'
    return { reply: t('discountCodeAskDoor', lang(ar)), reason: 'discount-code-ask-door' }
  }
  ar.state.pendingFlow = 'discount-code-await-machine'
  return { reply: t('discountCodeAskMachineNumber', lang(ar)), reason: 'discount-code-ask-machine' }
}

/** Caso 8 step 5 — capture machine number. */
export const guardDiscountCodeAwaitMachine: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'discount-code-await-machine') return null
  if (pivotIfTroubleSwitch(ar, userMessage)) return null  // F86
  ar.state.machineNumber = userMessage.trim()
  ar.state.pendingFlow = 'discount-code-await-door'
  return { reply: t('discountCodeAskDoor', lang(ar)), reason: 'discount-code-ask-door' }
}

/** Caso 8 step 6 — door confirmation, then escalate to internal operator. */
export const guardDiscountCodeAwaitDoor: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'discount-code-await-door') return null
  if (pivotIfTroubleSwitch(ar, userMessage)) return null  // F86
  const reply = userMessage.trim().toLowerCase()
  // Permissive yes/no — store both yes and no, escalate either way (operator decides).
  ar.state.discountCodeData.doorClosed = !/^(no|nope|non|nada|nein|nao|n[aã]o)\b/i.test(reply)
  ar.state.pendingFlow = ''
  escalate(ar, 'Discount code — código válido, derivado al operador para activación remota')
  // Caso 8 captures the name in step `discount-code-await-name` via captureCustomerName,
  // so customerNameRequested is already false here. Just close as escalated.
  closeAsEscalated(ar)

  const closing = t('discountCodeFinalEscalate', lang(ar))
  const ctx = extractEscalationContext(ar.state, ar.state.customerName)
  const summary = buildEscalationSummary(ctx)
  ar.pendingEscalation = null
  return { reply: `${closing}\n\n**👤 Human Support message**\n${summary}`, reason: 'discount-code-final' }
}
