// No-change incident — He pagado y no se ha activado, sin cambio.
//
// After the gather guards have collected location + machineType +
// machineNumber, the LLM sets pendingFlow='no-change-ask'. This guard
// then deterministically asks "¿la central te ha devuelto el cambio?"
// and transitions to the `no-change-await-confirm` phase.
//
// In `no-change-await-confirm` two deterministic branches handle the
// most common yes/no answers (the LLM remains the fallback for unusual
// phrasings):
//
//   - guardNoChangeNoCambio: "No" answer → emit the canonical retry
//                            instruction (must include "número" + "central"
//                            so the operator can verify the reply). The
//                            instruction is in i18n key `centralRetryAfterReview`.
//   - guardNoChangeYesButBroken: "Sí + still broken" → escalate (no retry
//                                makes sense, uniform with Scenario 4.2).
//
// Bare "Sí + ahora arranca" (resolution) and uncommon phrasings stay with
// the LLM, which reads the sticky state and follows the prompt.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { escalate, markResolved, requireCustomerName } from '../state-transitions.js'
import { lang } from './helpers.js'

/** Caso 4 step 4 — after location + tipo + numero, ask
 *  "¿La central te ha devuelto el cambio?". */
export const guardNoChangeAsk: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'no-change-ask' ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'no-change-await-confirm'
  return { reply: t('centralReturnedChange', lang(ar)), reason: 'no-change-ask' }
}

/** Caso 4 step 5 (retry instruction) — deterministic catch for "No"
 *  (cambio NOT returned) in the await-confirm phase.
 *
 *  The LLM is supposed to read the prompt and emit the retry instruction
 *  ("Es posible que no hayas marcado bien el número de la máquina en la
 *  central. Mira si todavía aparece saldo en la central y marca el
 *  número correctamente"). In practice the LLM occasionally escalates
 *  instead, ignoring the prompt section. This guard pins the "No" path
 *  deterministically across the 6 supported languages.
 *
 *  After emitting the retry instruction, pendingFlow advances to
 *  `no-change-await-confirmation`: the customer's next reply (yes it
 *  works / no still broken) is interpreted by the LLM. */
export const guardNoChangeNoCambio: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'no-change-await-confirm' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  // 6-language no-affirmation: short answers only ("no", "no me ha
  // devuelto", "ningún cambio", "nada", "non", "non ancora", "nope", …).
  // We keep this conservative — long phrasings ("la central no parece
  // haberme dado el cambio porque…") stay with the LLM.
  const isNoCambio =
    /^(no|nada|niente|nope|non|n[ãa]o|gens|ningu)(?:[\s,.!?]|$)/i.test(lower) ||
    /^(no\s+me\s+ha\s+devuelto|no\s+me\s+lo\s+ha\s+devuelto|ning[uú]n\s+cambio|nada\s+de\s+cambio|non\s+(?:mi\s+)?(?:ha|ho)\s+(?:dato|reso)|n[ãa]o\s+(?:me\s+)?devolveu|aucune\s+monnaie)/i.test(lower)
  if (!isNoCambio) return null

  ar.state.pendingFlow = 'no-change-await-confirmation'
  return {
    reply: t('centralRetryAfterReview', lang(ar)),
    reason: 'no-change-no-cambio',
  }
}

/** Caso 4 step 5 (escalation) — deterministic catch for the combined
 *  "Sí (cambio devuelto) PERO la máquina no arranca" answer.
 *
 *  When the customer is in `pendingFlow='no-change-await-confirm'` and
 *  answers a "yes" affirmation followed by a still-broken signal, the
 *  retry instruction makes no sense (the central did its part — it's
 *  not a number-selection mistake). Escalate immediately with the
 *  uniform handover path (`reaffirmEscalate` + `customerNameAsk` + the
 *  L5 `operatorHandoffFinal` invariant adds "operador"+"desactivado"
 *  on the next turn after capture_customer_name).
 *
 *  Multilingual coverage by design (rule #8): patterns cover the 6
 *  supported languages. The yes-marker and the still-broken-marker are
 *  both required — bare "Sí" alone keeps the LLM-driven branch active
 *  (the LLM may produce the retry instruction for the location-aware
 *  case, e.g. Pineda override).
 */
export const guardNoChangeYesButBroken: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'no-change-await-confirm' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  // 6-language yes-affirmation at the start of the reply. We use a
  // lookahead instead of \b because \b is ASCII-only in JS regex and
  // does not work after accented characters like "í".
  const startsWithYes = /^(s[íi]|s[íì]|sim|yes|oui|ja|gi[aà])(?=[\s,.!?]|$)/i.test(lower)
  // 6-language still-broken signals (verb + negation OR persist patterns).
  const stillBroken = /(no\s+(?:arranca|funciona|empieza|responde|parte|va)|sigue\s+sin|todav[ií]a\s+(?:no|sin)|aun\s+(?:no|sin)|non\s+(?:parte|funziona|risponde)|n[ãa]o\s+(?:arranca|funciona|liga)|ne\s+(?:fonctionne|d[ée]marre)\s+pas|doesn'?t\s+(?:start|work)|still\s+(?:broken|not\s+(?:starting|working)))/i.test(lower)
  if (!startsWithYes || !stillBroken) return null

  ar.state.pendingFlow = ''
  escalate(ar, 'No-change incident — cambio devuelto pero máquina no se activa')
  requireCustomerName(ar)
  return {
    reply: t('reaffirmEscalate', lang(ar)),
    reason: 'no-change-yes-but-broken',
  }
}

/** Caso 4 step 6 — after `centralRetryAfterReview` (the "fix the number"
 *  guidance), the customer reports the outcome:
 *    - "Sí, ahora arranca / funciona / se ha activado" → resolved.
 *      Emit deterministic `noChangeResolved` + mark state resolved.
 *      Without this guard the LLM improvises ("¡Perfecto, eso es buena
 *      señal!") and the i18n key is bypassed.
 *    - "No, sigue sin arrancar" → escalate (operator handover).
 *
 *  REGRESSION (Andrea, 2026-05-09 Caso 4 LLM run): the `no-change-await-
 *  confirmation` phase had NO deterministic guard, so the LLM owned the
 *  closure. Tests asserting "ya estaría resuelto" failed because the
 *  LLM produced free-form text. */
export const guardNoChangeAfterRetry: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'no-change-await-confirmation' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  // 6-language "yes, it works now" affirmation
  const isResolved =
    /^(s[íi]|sim|yes|oui)(?:[\s,.!?]|$)/i.test(lower) &&
    /(arranc|funcion|activ|march|empez|partit|started|works|d[ée]marr[ée])/i.test(lower)
  // Standalone "ya funciona / ahora sí / ya está / ya arrancó / ya empezó"
  // patterns (without explicit yes prefix). Required: a working-state verb.
  const isResolvedStandalone =
    /\b(ya|ahora)\s+(?:funciona|arranca|empieza|s[íi]\s+funciona|s[íi]\s+arranca|est[áa]\s+(?:en\s+marcha|funcionando|encendida))/i.test(lower) ||
    /\b(?:ya\s+(?:arranc[oó]|empez[oó])|ya\s+est[áa]\s+(?:en\s+marcha|funcionando)|ya\s+(?:lo\s+)?ha\s+(?:arrancad|comenzad|empezad))/i.test(lower)
  if (isResolved || isResolvedStandalone) {
    ar.state.pendingFlow = ''
    markResolved(ar)
    return {
      reply: t('noChangeResolved', lang(ar)),
      reason: 'no-change-resolved',
    }
  }
  // 6-language "still broken" signal
  const isStillBroken =
    /(no\s+(?:arranca|funciona|empieza|responde|parte|va)|sigue\s+sin|todav[ií]a\s+(?:no|sin)|aun\s+(?:no|sin)|nada|sin\s+arrancar|sin\s+activar)/i.test(lower)
  if (isStillBroken) {
    ar.state.pendingFlow = ''
    escalate(ar, 'No-change incident — retry no resolvió, escalado')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'no-change-retry-failed',
    }
  }
  // Unrecognised reply → let the LLM handle it.
  return null
}
