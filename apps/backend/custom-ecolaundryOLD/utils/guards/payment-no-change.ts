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
import { lang, RECOVERABLE_DISPLAYS } from './helpers.js'

/** Caso 4 → Caso 3 pivot — the router sometimes classifies "He pagado pero
 *  la lavadora no empieza" (Caso 3 trigger, usecases.md:534) as `paid-not-
 *  activated` (Caso 4) because the wording overlaps with "He pagado y no
 *  se ha activado" (usecases.md:596). When the gather then captures a
 *  recoverable display code (SEL/PUSH/DOOR/…), the no-change assumption
 *  is invalidated — the display tells us the real incident is display-
 *  driven (Caso 3/Caso 1/Caso 2), not a missing-change problem.
 *
 *  This guard runs BEFORE every other no-change guard. It clears
 *  `pendingFlow` and returns null so the pipeline continues in the same
 *  turn — `guardAutoStartMachineFlow` (later in GUARD_PIPELINE) then
 *  starts the right display flow (case_sel / case_push / case_door / …)
 *  using the per-language promptKey, which is what fixes the CA/EN
 *  language drift observed in the original bug (the LLM would otherwise
 *  improvise in Spanish because the no-change flow had no recoverable-
 *  display branch).
 *
 *  Iron rule #6 respected: we detect input TYPE (recoverable-display
 *  code already extracted by autoExtractFacts), not a content/phrase
 *  pattern in the user message. Iron rule #8: works for every language
 *  because RECOVERABLE_DISPLAYS is language-agnostic. */
export const guardNoChangePivotOnDisplay: Guard = (ar) => {
  const flow = ar.state.pendingFlow
  const isNoChangeFlow =
    flow === 'no-change-ask' ||
    flow === 'no-change-await-confirm' ||
    flow === 'no-change-await-confirmation'
  if (!isNoChangeFlow) return null
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  const display = String(ar.state.displayState || '').toUpperCase()
  if (!display || !RECOVERABLE_DISPLAYS.has(display)) return null
  // Pivot: drop the no-change assumption. activeBranch stays
  // 'trouble-machine' (we're not changing topic — same incident, correct
  // sub-case). Return null so guardAutoStartMachineFlow takes over in the
  // same turn and emits the canonical localised display reply.
  ar.state.pendingFlow = ''
  return null
}

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

/** Caso 4 step 5 (escalation) — deterministic catch for "Sí (cambio
 *  devuelto)" in the await-confirm phase.
 *
 *  When the customer is in `pendingFlow='no-change-await-confirm'` and
 *  answers "yes" to "¿la central te ha devuelto el cambio?", the retry
 *  instruction makes no sense (central did its part — not a number-
 *  selection mistake). The trigger already stated the machine is not
 *  activated, so any yes-affirmation implies "cambio devuelto AND
 *  machine still broken" → escalate (Caso 4.2).
 *
 *  Exception: explicit resolution markers ("Sí, ahora arranca", "ya
 *  funciona") → null, let downstream LLM/guard close as resolved
 *  (corner case where customer found a workaround between turns).
 *
 *  REGRESSION (Andrea, 2026-05-11 F39 CLI): bot fell through to LLM on
 *  bare "Sí" → LLM improvised asking for display → cascaded into Caso 2
 *  DOOR flow. The fix: bare yes-affirmation alone is sufficient signal
 *  (still-broken state is IMPLICIT from the trigger context).
 *
 *  Multilingual coverage by design (rule #8): yes-marker and resolution
 *  markers cover all 6 supported languages.
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
  if (!startsWithYes) return null

  // 6-language explicit resolution markers — customer indicates the
  // machine NOW works. Corner case in this phase; let LLM/downstream
  // close as resolved instead of escalating.
  const isResolution =
    /\b(ahora|ya)\s+(?:s[íi]\s+)?(?:arranca|funciona|empieza|march|est[áa]\s+(?:funcionando|en\s+marcha|encendida))/i.test(lower) ||
    /\bya\s+(?:lo\s+)?ha\s+(?:arrancad|funcionad|empezad|comenzad)/i.test(lower) ||
    /\b(now\s+(?:it\s+)?works|works\s+now|started\s+now|is\s+working\s+now|just\s+started)/i.test(lower) ||
    /\b(ora\s+(?:funziona|parte|va\s+bene)|adesso\s+(?:funziona|parte))/i.test(lower) ||
    /\bmaintenant\s+(?:il|elle|ça|ca)\s+(?:fonctionne|d[ée]marre|marche)/i.test(lower) ||
    /\bagora\s+(?:funciona|arranca|liga)/i.test(lower) ||
    /\bara\s+(?:funciona|arranca|marxa)/i.test(lower)
  if (isResolution) return null

  ar.state.pendingFlow = ''
  escalate(ar, 'No-change incident — cambio devuelto pero máquina no se activa')
  requireCustomerName(ar)
  return {
    reply: t('reaffirmEscalate', lang(ar)),
    reason: 'no-change-yes-but-broken',
  }
}

/** F112 (Andrea random eval 2026-05-26 Scenario 2) — retry+escalate ladder
 *  for `no-change-await-confirm` when the customer's reply is NEITHER yes
 *  NOR no. Customer correcting an unrelated fact ("sorry I meant the washer",
 *  "number 5") used to loop forever on "Did the central give you the change
 *  back?" — guardNoChangeNoCambio/YesButBroken don't match, fall through to
 *  the LLM, the LLM re-emits the same question.
 *
 *  Pattern mirror of displayAskAttempts / discountCodeAskAttempts:
 *    0 → first ask emitted (centralReturnedChange)
 *    1 → re-ask with "yes or no" hint (centralReturnedChangeReask)
 *    ≥2 → escalate to operator
 *
 *  MUST run AFTER guardNoChangeNoCambio and guardNoChangeYesButBroken so a
 *  legitimate yes/no answer wins. MUST run AFTER guardNoChangePivotOnDisplay
 *  so a display pivot wins (customer reports DOOR instead of yes/no).
 *
 *  Iron rule #4: state mutation goes through state-transitions.escalate +
 *  requireCustomerName. The ask-attempt counter is a tracked field (not in
 *  the protected-flag list), so inline `++` is allowed (same pattern as
 *  every other `*AskAttempts` field in this codebase). */
export const guardNoChangeAwaitInvalidLadder: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'no-change-await-confirm' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  // Increment strike counter. The previous guards (NoCambio, YesButBroken,
  // PivotOnDisplay) have already had their chance; if we're here, the reply
  // is invalid (not yes/no/display).
  ar.state.noChangeAskAttempts += 1
  if (ar.state.noChangeAskAttempts >= 2) {
    ar.state.pendingFlow = ''
    escalate(ar, 'No-change incident — customer cannot confirm cambio yes/no after retries')
    requireCustomerName(ar)
    return {
      reply: t('reaffirmEscalate', lang(ar)),
      reason: 'no-change-ladder-escalate',
    }
  }
  // First strike: re-ask with hint.
  return {
    reply: t('centralReturnedChangeReask', lang(ar)),
    reason: 'no-change-await-reask',
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
