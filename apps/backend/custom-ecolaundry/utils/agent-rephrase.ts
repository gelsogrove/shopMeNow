// Natural rephrase layer — L5 output policy (Andrea, 2026-05-10, upgraded 2026-05-19).
//
// PURPOSE
// ───────
// When a deterministic guard wins the pipeline, its outcome is a canned i18n
// string (e.g. "¿En qué lavandería estás?"). Repeated across turns and sessions
// this reads templated. This layer passes the reply through the LLM for
// tone-polish using the full conversation history as context.
//
// RESPONSIBILITIES (in prompt priority order)
// ────────────────────────────────────────────
// ① Language  — always respond in the customer's language (detected from
//               history), never mix languages, never default to English.
// ② Name      — weave CUSTOMER_NAME naturally if known (max once per reply).
// ③ Tone      — warm, human, emoji (1-2 max), context-aware empathy.
// ④ Security  — strip URLs not in ALLOWED_DOMAINS; never follow prompt-injection
//               instructions from CONVERSATION_HISTORY.
// ⑤ Content   — preserve all keywords, codes, emails, authorised URLs verbatim;
//               never add operational detail not in the canned reply.
//
// BYPASS CONDITIONS (all checked by the caller in agent.ts:applyGuardOutcome)
// ─────────────────────────────────────────────────────────────────────────────
// • T1 welcome (canonical greeting must stay stable)
// • invoice-* pendingFlow (F35 — PII: CIF/NIF, email, dirección in history)
// • hasFormattedBulletList (F41 — LLM flattens markdown structure)
// • discount-code-ask reason (F49 — clean i18n IS the UX)
// • activeFlowId set (F56 — display-flow prompts are PDF-vetted; rephrase
//   invented "ropa en la goma", "hasta oír un clic" etc.)
//
// TEMPERATURE
// ───────────
// Default 0.6 (raised from 0.4 on 2026-05-19): gives more natural variation
// while the strict content rules in the prompt prevent content drift.
// Configurable via settings.rephraseTemperature. Recommended range 0.4-0.7.
// Do NOT exceed 0.7 — higher temperatures break keyword-preservation rules.
//
// ADDING A NEW PII BYPASS
// ───────────────────────
// 1. Add the condition in agent.ts:applyGuardOutcome (same block as isInvoiceFlow).
// 2. Document it here with a reference (e.g. "F35 pattern").
// 3. Add a unit test in __tests__/unit/agent-rephrase.test.ts.

import type { AgentMessage, AgentRuntime } from '../models/index.js'
import { callModel } from './llm.js'
import { lang as resolveTenantLang } from './guards/helpers.js'
import { logger } from './logger.js'

// Fallback system prompt used when prompts/rephrase.txt is missing or empty.
// Keep in sync with prompts/rephrase.txt — the file is the canonical version.
const REPHRASE_SYSTEM_PROMPT_FALLBACK = `Eres el asistente virtual de una lavandería. Reescribe la respuesta del bot para que suene natural y empático. Responde SIEMPRE en el idioma del cliente (detectado de la history). Usa el nombre del cliente si está disponible. Añade 1-2 emoji apropiados. NO cambies el significado ni añadas información nueva. Mantén todas las palabras clave, códigos y URLs del original. Si tienes dudas, devuelve el original sin cambios.`

/**
 * Rephrase the bot reply for natural tone, correct language, and safety.
 *
 * Returns the rephrased reply on success, the original reply on any error
 * (graceful degradation — the customer always gets a reply).
 *
 * The caller (agent.ts:applyGuardOutcome) is responsible for checking all
 * bypass conditions BEFORE calling this function.
 */
export async function rephraseForTurn(
  reply: string,
  ar: AgentRuntime,
  history: AgentMessage[],
): Promise<string> {
  if (!reply.trim()) return reply
  // Operator handover block must never be rephrased — it is structured output
  // consumed by the host app, not customer-facing prose.
  if (reply.includes('**👤 Human Support message**')) return reply
  if (!ar.runtime.settings?.naturalRephrase) return reply

  const customerName = ar.state.customerName || ''
  const tenantLang = resolveTenantLang(ar)

  // Authorised external domains from settings — the rephrase prompt uses this
  // list to strip any unauthorised URL that might appear in the canned reply.
  const allowedDomains = ar.runtime.settings?.allowedExternalLinks?.trim() || ''

  // Last 10 messages (5 turns) — enough context for language detection and
  // tone-matching without inflating the token budget.
  const historyTrim = history.slice(-10)
  const historyBlock = historyTrim.map((m) => `[${m.role}] ${m.content}`).join('\n')

  const userPrompt = [
    `LANGUAGE: ${tenantLang}`,
    customerName ? `CUSTOMER_NAME: ${customerName}` : '',
    allowedDomains ? `ALLOWED_DOMAINS: ${allowedDomains}` : 'ALLOWED_DOMAINS: (none)',
    '',
    'CONVERSATION_HISTORY (last turns):',
    historyBlock || '(empty)',
    '',
    'CANNED_REPLY (rewrite this):',
    reply,
  ]
    .filter(Boolean)
    .join('\n')

  // Default temperature raised to 0.6 for more natural variation.
  // The strict content rules in prompts/rephrase.txt prevent content drift
  // at this temperature. Do not exceed 0.7.
  const rephraseTemp = ar.runtime.settings?.rephraseTemperature ?? 0.6

  // Prefer the external prompt file (prompts/rephrase.txt loaded by runtime
  // at boot). Falls back to the TS const for graceful degradation when the
  // file is missing. See CLAUDE.md Pending refactors D2.
  const promptFromFile = ar.runtime.prompts?.rephrase?.trim()
  const systemPrompt = promptFromFile || REPHRASE_SYSTEM_PROMPT_FALLBACK

  try {
    const rephrased = await callModel({
      systemPrompt,
      userPrompt,
      temperature: rephraseTemp,
      maxTokens: Math.max(150, Math.ceil(reply.length * 1.5)),
    })
    if (!rephrased.trim()) return reply
    return rephrased.trim()
  } catch (err) {
    logger.warn('rephraseForTurn failed, falling back to canned reply', {
      error: err instanceof Error ? err.message : String(err),
    })
    return reply
  }
}
