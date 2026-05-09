// Caso 6 — Doble cobro.
//
// Two scenarios:
//   6.1 — customer USED the service after the second charge → gather
//         tipo + número de máquina, then narrative + card digits +
//         receipt → escalate with a "doble cobro pero servicio
//         completado" summary so the operator can refund without
//         re-investigating the machine.
//   6.4 — customer DID NOT use the service (charged twice but never
//         washed/dryed) → escalate immediately, WITHOUT asking
//         tipo/número (would feel like burocracia mientras el cliente
//         está enfadado). The summary tells the operator the machine
//         info is missing — they'll collect it on the phone if needed.
//
// Gather order (NEW, Andrea 2026-05-09):
//   1. location          (forceLocation, fires from T1)
//   2. ¿podido lavar?    (this cassette, asked right after location)
//      └── No  → escalate (Scenario 6.4) — STOP here.
//      └── Yes → continue:
//   3. tipo              (this cassette, asks "lavadora o secadora?")
//   4. número            (this cassette, asks "qué número?")
//   5. relato            (asks "explícame paso a paso...")
//   6. 4 dígitos         (asks "últimos 4 dígitos de la tarjeta")
//   7. captura + nombre  (asks captura del pago + nombre, then closes
//                          with the refund-form message — no live
//                          operator handover, just a refund pipeline.)
//
// Why "¿podido?" comes before tipo+número:
//   The customer who was charged twice and DIDN'T get to wash is doubly
//   frustrated. Asking machine details upfront felt like burocracia.
//   By branching early on "¿podido?", the No path escalates fast, and
//   the Yes path (where the operator needs the machine context for the
//   refund cross-check) gathers tipo+número only when actually useful.
//
// All gather steps inherit the 3-strikes retry+escalate ladder from
// CLAUDE.md regla #10:
//   counter == 0 → canonical i18n ask key
//   counter == 1 → guidance reask (i18n *Retry key)
//   counter >= 2 → escalate(operator) + requireCustomerName, reset counter

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'
import { nextRetryLadderStep } from './retry-ladder.js'

/** Caso 6 step 2 — after location is captured, ask "¿has podido lavar/secar?".
 *
 *  Iron rule #10 (NEW order): we ask this BEFORE gathering tipo+número
 *  because the No branch shouldn't waste turns collecting machine info
 *  that the operator can ask on the phone anyway. */
export const guardDoubleChargeAskUsed: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-used' ||
    !ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'double-charge-ask-narrative'
  return { reply: t('doubleChargeAskUsed', lang(ar)), reason: 'double-charge-ask-used' }
}

/** Caso 6 step 3 — branch on the customer's yes/no answer to "¿has podido?":
 *    - "no" / "nada" / "no he podido" → Scenario 6.4: escalate immediately.
 *      No tipo/número/relato/dígitos. The summary builder produces a
 *      "no service used" brief; the missing machine info is documented.
 *    - any other reply (treat as yes) → Scenario 6.1: continue gathering.
 *      Skip directly to narrative if tipo+número already volunteered
 *      (e.g. "sí, lavadora 5"); else ask the missing facts in order. */
export const guardDoubleChargeAskNarrative: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-narrative' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  // 6-language no-detection. Conservative: a bare "no" or "nada" or
  // "no he podido" suffices. Long phrasings ("la verdad es que no me
  // dejaron usar la máquina porque...") still go through the LLM.
  const isNo =
    /^(no|nope|nada|niente|non|n[ãa]o)(?:[\s,.!?]|$)/i.test(reply) ||
    /^no\s+(?:he|hab[ií]a|hemos)\s+(?:podido|usado|lavado|secado)/i.test(reply) ||
    /^(no\s+lo\s+he\s+usado|no\s+lo\s+pude\s+usar|no\s+he\s+lavado|no\s+he\s+secado)/i.test(reply)

  if (isNo) {
    // Scenario 6.4 — charged twice without using the service. Escalate
    // straight away; no machine info collected.
    ar.state.issueSummary = `double charge — used service: no — customer reply: ${userMessage.trim()}`
    ar.state.pendingFlow = ''
    escalate(ar, 'Doble cobro sin uso del servicio')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'double-charge-not-used-escalate',
    }
  }

  // Scenario 6.1 — service used. Continue with tipo/número gather, then
  // narrative. The customer's literal yes is preserved for the summary.
  ar.state.issueSummary = `double charge — used service: yes — customer reply: ${userMessage.trim()}`
  // Skip ahead if facts already volunteered ("sí, lavadora 5").
  if (ar.state.machineType && ar.state.machineNumber) {
    ar.state.pendingFlow = 'double-charge-ask-card-digits'
    return { reply: t('doubleChargeAskNarrative', lang(ar)), reason: 'double-charge-emit-narrative' }
  }
  if (!ar.state.machineType) {
    ar.state.pendingFlow = 'double-charge-ask-type'
    return { reply: t('machineType', lang(ar)), reason: 'double-charge-emit-type-ask' }
  }
  // machineType set, machineNumber missing → ask number directly.
  ar.state.pendingFlow = 'double-charge-ask-number'
  const numKey = ar.state.machineType === 'dryer' ? 'machineNumberDryer' : 'machineNumberWasher'
  return { reply: t(numKey, lang(ar)), reason: 'double-charge-emit-number-ask' }
}

/** Caso 6 step 4 (YES branch only) — gather machineType with 3-strikes
 *  retry. autoExtractFacts captures the type from the user's reply each
 *  turn, so when this guard fires after a successful capture, we advance
 *  to the number ask. */
export const guardDoubleChargeAskType: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-type' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }

  if (ar.state.machineType) {
    // Type captured (autoExtractFacts) — advance.
    ar.state.machineTypeAskAttempts = 0
    if (ar.state.machineNumber) {
      // Number also volunteered ("lavadora número 5") — skip to narrative.
      ar.state.pendingFlow = 'double-charge-ask-card-digits'
      return {
        reply: t('doubleChargeAskNarrative', lang(ar)),
        reason: 'double-charge-emit-narrative',
      }
    }
    ar.state.pendingFlow = 'double-charge-ask-number'
    const numKey = ar.state.machineType === 'dryer' ? 'machineNumberDryer' : 'machineNumberWasher'
    return { reply: t(numKey, lang(ar)), reason: 'double-charge-emit-number-ask' }
  }

  const step = nextRetryLadderStep(
    ar.state.machineTypeAskAttempts || 0,
    (n) => { ar.state.machineTypeAskAttempts = n },
  )
  if (step === 'escalate') {
    ar.state.pendingFlow = ''
    escalate(ar, 'Double charge — could not gather machine type after 2 attempts')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'double-charge-type-unrecognized-escalate',
    }
  }
  if (step === 'first-ask') {
    return { reply: t('machineType', lang(ar)), reason: 'double-charge-ask-type' }
  }
  return {
    reply: t('machineTypeRetry', lang(ar)),
    reason: 'double-charge-type-unrecognized-reask',
  }
}

/** Caso 6 step 5 (YES branch only) — gather machineNumber with 3-strikes
 *  retry. Same shape as guardDoubleChargeAskType. */
export const guardDoubleChargeAskNumber: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-number' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }

  if (ar.state.machineNumber) {
    // Number captured — advance to narrative.
    ar.state.machineNumberAskAttempts = 0
    ar.state.pendingFlow = 'double-charge-ask-card-digits'
    return {
      reply: t('doubleChargeAskNarrative', lang(ar)),
      reason: 'double-charge-emit-narrative',
    }
  }

  const step = nextRetryLadderStep(
    ar.state.machineNumberAskAttempts || 0,
    (n) => { ar.state.machineNumberAskAttempts = n },
  )
  if (step === 'escalate') {
    ar.state.pendingFlow = ''
    escalate(ar, 'Double charge — could not gather machine number after 2 attempts')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'double-charge-number-unrecognized-escalate',
    }
  }
  if (step === 'first-ask') {
    const numKey = ar.state.machineType === 'dryer' ? 'machineNumberDryer' : 'machineNumberWasher'
    return { reply: t(numKey, lang(ar)), reason: 'double-charge-ask-number' }
  }
  return {
    reply: t('machineNumberRetry', lang(ar)),
    reason: 'double-charge-number-unrecognized-reask',
  }
}

/** Caso 6 step 6 — after relato, ask the last 4 card digits. The customer's
 *  previous turn was the narrative; we capture it in issueSummary then
 *  emit the digits ask. */
export const guardDoubleChargeAskCardDigits: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-card-digits' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (ar.state.issueSummary?.startsWith('double charge')) {
    ar.state.issueSummary = `${ar.state.issueSummary} — narrative: ${userMessage.trim()}`
  }
  ar.state.pendingFlow = 'double-charge-ask-receipt'
  return { reply: t('doubleChargeAskCardDigits', lang(ar)), reason: 'double-charge-ask-card-digits' }
}

/** Caso 6 step 7 — consume the customer's reply to the 4-digits ask.
 *
 *  Validation: the customer must give exactly 4 numeric digits (e.g.
 *  "4821"). Surrounding narrative is OK ("los últimos son 4821"), but
 *  the 4-digit chunk must be unambiguous (no longer/shorter sequence).
 *
 *    valid (4 digits, e.g. "4821")    → proceed to receipt+closure ask
 *    invalid (3, 5+, no digits, etc.) → re-ask with cardDigitsRetry
 *    invalid 2nd time                  → escalate to a human operator
 *
 *  Iron rule #10: validation prevents the LLM from inheriting bad data
 *  in the operator handover summary ("últimos 4 dígitos: 482156" would
 *  be useless to the operator). */
export const guardDoubleChargeAskReceipt: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-receipt' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }

  // Look for an unambiguous 4-digit chunk: exactly 4 consecutive digits,
  // not part of a longer digit run. Multiple matches → ambiguous → invalid.
  const matches = userMessage.match(/(?<!\d)\d{4}(?!\d)/g) || []
  const isValid = matches.length === 1
  if (!isValid) {
    ar.state.cardDigitsAskAttempts = (ar.state.cardDigitsAskAttempts || 0) + 1
    if (ar.state.cardDigitsAskAttempts >= 2) {
      // 2 invalid attempts → escalate. Operator will collect the digits
      // manually if needed.
      ar.state.cardDigitsAskAttempts = 0
      ar.state.pendingFlow = ''
      if (!ar.state.issueSummary?.startsWith('double charge')) {
        ar.state.issueSummary = 'double charge — invalid card digits after 2 attempts'
      }
      escalate(ar, 'Double charge — invalid card digits after 2 attempts')
      requireCustomerName(ar)
      return {
        reply: t('reaffirmEscalate', lang(ar)),
        reason: 'double-charge-card-digits-escalate',
      }
    }
    // 1st invalid → re-ask politely. Keep pendingFlow so this guard fires
    // again on the next turn.
    return {
      reply: t('cardDigitsRetry', lang(ar)),
      reason: 'double-charge-card-digits-retry',
    }
  }

  // Valid 4 digits — proceed to receipt + closure.
  ar.state.cardDigitsAskAttempts = 0
  ar.state.pendingFlow = ''
  if (!ar.state.issueSummary?.startsWith('double charge')) {
    ar.state.issueSummary = 'double charge'
  }
  escalate(ar, 'Double charge incident — review with refund form')
  requireCustomerName(ar)
  const captura = t('doubleChargeAskReceipt', lang(ar))
  const closure = t('doubleChargeClosure', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${captura}\n\n${closure} ${nameAsk}`, reason: 'double-charge-ask-receipt' }
}
