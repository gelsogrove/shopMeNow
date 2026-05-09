// Natural rephrase layer (Andrea, 2026-05-10).
//
// Purpose: when a deterministic guard wins the pipeline, its outcome is a
// canned i18n string (e.g. "¿En qué lavandería estás?"). Repeated across
// turns and sessions this reads templated. This layer lets the LLM polish
// the customer-facing line for natural tone-matching, using the full
// conversation history as context, WITHOUT changing the content invariants
// the guard encoded.
//
// What this function does:
//   - Calls the LLM with a tight system prompt: "riformula in modo
//     naturale, MANTIENI tutte le parole chiave, mantieni significato,
//     puoi aggiungere il nome del cliente se noto, max +30%"
//   - Returns the rephrased reply. On any error/timeout, falls back to the
//     original canned reply (graceful degradation).
//
// What this function does NOT do:
//   - Change the state (no `escalate` / `markResolved` / etc. — the guard
//     already mutated state, this is presentation-only).
//   - Touch operator-only structured output (`**👤 Human Support message**`).
//   - Run during T1 welcome (canonical greeting must stay stable).
//   - Run during the first turn that emits sacred-rule replies (pricing
//     deflect, no-confrontar, format validators) — the caller filters.
//
// Opt-in via `settings.naturalRephrase` (false by default).

import type { AgentMessage, AgentRuntime } from '../models/index.js'
import { callModel } from './llm.js'
import { lang as resolveTenantLang } from './guards/helpers.js'
import { logger } from './logger.js'

const REPHRASE_SYSTEM_PROMPT = `Eres un editor que reescribe la respuesta del bot de una lavandería para que suene más natural y empático, manteniendo el significado y todas las palabras clave del original.

REGLAS ESTRICTAS:
1. NO cambies el significado. Si el original dice "¿En qué lavandería estás?", la versión reescrita debe seguir preguntando lo mismo.
2. NO añadas información nueva (no inventes precios, códigos, ubicaciones, horarios).
3. MANTÉN las palabras clave: nombres de lavanderías (Goya, Pineda, Alemanya, Hortes, L'Escala, Mataró), códigos display (PUSH PROG, SEL, DOOR, AL001, ALM, ALN, ERR, etc.), números de máquina, importes, "operador", "desactivado", "revisión manual", "formulario", "devolución".
4. MANTÉN los emoji y la formattación markdown del original (negrita, listas, saltos de línea).
5. PUEDES añadir el nombre del cliente si está disponible en el historial.
6. PUEDES variar el tono según el contexto (cliente angry → más empático).
7. NO superes el original en más del 30% de longitud.
8. Responde SOLO con el texto reescrito, sin comillas ni preámbulos.

Si tienes dudas, devuelve el original sin cambios.`

/**
 * Rephrase the bot reply naturally, using conversation history for context.
 * Returns the rephrased reply on success, the original reply on failure.
 *
 * Skipped automatically when:
 *   - settings.naturalRephrase is false (caller MUST check)
 *   - reply contains the operator-only handover marker
 *   - reply is empty
 */
export async function rephraseForTurn(
  reply: string,
  ar: AgentRuntime,
  history: AgentMessage[],
): Promise<string> {
  if (!reply.trim()) return reply
  if (reply.includes('**👤 Human Support message**')) return reply
  if (!ar.runtime.settings?.naturalRephrase) return reply

  const customerName = ar.state.customerName || ''
  const tenantLang = resolveTenantLang(ar)
  const historyTrim = history.slice(-10) // last 5 turns max
  const historyBlock = historyTrim
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n')

  const userPrompt = [
    `LANGUAGE: ${tenantLang}`,
    customerName ? `CUSTOMER_NAME: ${customerName}` : '',
    'CONVERSATION_HISTORY (last turns):',
    historyBlock || '(empty)',
    '',
    'CANNED_REPLY (rewrite this):',
    reply,
  ]
    .filter(Boolean)
    .join('\n')

  // Rephrase temperature: moderate — this is a generative task with strict
  // content constraints (keep keywords, keep meaning). Higher temperature
  // gives more natural variation but risks drifting from the canned reply.
  // Configurable via `settings.rephraseTemperature` (default 0.4);
  // recommended 0.2-0.5.
  const rephraseTemp = ar.runtime.settings?.rephraseTemperature ?? 0.4
  try {
    const rephrased = await callModel({
      systemPrompt: REPHRASE_SYSTEM_PROMPT,
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
