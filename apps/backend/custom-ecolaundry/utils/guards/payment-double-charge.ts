// Caso 6 — Doble cobro.
//
// Two scenarios:
//   6.1 — customer USED the service after the second charge → narrative
//         + card digits + receipt → escalate with a "doble cobro pero
//         servicio completado" summary so the operator can refund
//         without re-investigating the machine.
//   6.4 — customer DID NOT use the service (charged twice but never
//         washed/dryed) → escalate immediately with a different summary
//         flagging "no service used" so the operator handles both the
//         refund AND the missing service.
//
// Gather order (canonical, all 4 facts BEFORE branching on yes/no):
//   1. location  (forceLocation, fires from T1)
//   2. tipo      (forceMachineType)
//   3. numero    (forceMachineNumber)
//   4. ¿podido lavar?  (this guard) → branch:
//      yes → relato → 4 dígitos → captura → closure (Scenario 6.1)
//      no  → escalate as Scenario 6.4
//
// Why this order matters: the operator handover summary needs the
// machine context (location + type + number) for both scenarios. Asking
// "¿podido lavar?" before knowing which machine breaks if the customer
// volunteers info out of order, and produces a useless summary like
// "Usuario X en Goya ha reportado un doble cobro. Relato: puede ser".

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

/** Caso 6 step 4 — after location + tipo + numero, ask "¿has podido
 *  lavar/secar?". Iron rule #10: gather completes BEFORE the branch
 *  question. */
export const guardDoubleChargeAskUsed: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-used' ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'double-charge-ask-narrative'
  return { reply: t('doubleChargeAskUsed', lang(ar)), reason: 'double-charge-ask-used' }
}

/** Caso 6 step 5 — branch on the customer's answer to "¿has podido
 *  lavar/secar?":
 *    - "no" / "nada" / "no he podido" → Scenario 6.4: escalate
 *      immediately, mark `used service: no` so the summary builder
 *      generates the right operator brief.
 *    - any other reply (treat as yes) → Scenario 6.1: continue with the
 *      narrative ask. The customer's actual reply is preserved in
 *      issueSummary so the summary builder can quote the answer ("Sí,
 *      he lavado", "claro que sí", etc.). */
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
    // Scenario 6.4 — charged twice without using the service.
    ar.state.issueSummary = `double charge — used service: no — customer reply: ${userMessage.trim()}`
    ar.state.pendingFlow = ''
    escalate(ar, 'Doble cobro sin uso del servicio')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'double-charge-not-used-escalate',
    }
  }

  // Scenario 6.1 — service used; continue with narrative gather.
  ar.state.issueSummary = `double charge — used service: yes — customer reply: ${userMessage.trim()}`
  ar.state.pendingFlow = 'double-charge-ask-card-digits'
  return { reply: t('doubleChargeAskNarrative', lang(ar)), reason: 'double-charge-ask-narrative' }
}

/** Caso 6 step 3 — after relato, ask the last 4 card digits. */
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

/** Caso 6 step 4 — after 4 digits, ask the payment screenshot + closure. */
export const guardDoubleChargeAskReceipt: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-receipt' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
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
