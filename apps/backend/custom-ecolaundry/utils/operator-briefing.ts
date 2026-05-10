// Operator briefing — LLM-generated handover summary (Andrea, 2026-05-10).
//
// Purpose: today the "**👤 Human Support message**" briefing sent to the
// human operator is built deterministically by `escalation.ts:buildEscalationSummary`
// using state facts + per-incident templates. This file adds an opt-in
// alternative: an LLM rewrites the briefing from the conversation history,
// producing a natural narrative that captures nuance the state doesn't
// (customer mood, what they tried, exact wording).
//
// Constraints to prevent hallucinations:
//   - low temperature (default 0.2, configurable via settings.operatorBriefingTemperature)
//   - strict system prompt: facts only, no invention, fall back to dashes
//     when a fact is missing
//   - graceful fallback to deterministic summary on any error
//
// Opt-in via settings.operatorBriefingFromLlm (false by default → tests
// see deterministic content, production may flip to true for natural
// briefings). See CLAUDE.md "Test deterministic vs production polished".

import type { AgentMessage, AgentRuntime } from '../models/index.js'
import { callModel } from './llm.js'
import { formatHandoverTimestamp } from './escalation.js'
import { logger } from './logger.js'

const BRIEFING_SYSTEM_PROMPT = `Eres un asistente que produce un briefing operativo en español para un operador humano de una lavandería de autoservicio. El briefing es UN MENSAJE INTERNO al operador, NO al cliente.

REGLAS ESTRICTAS:
1. SOLO HECHOS observables en la conversación. NO inventes detalles, códigos, ubicaciones, importes ni nombres no dichos por el cliente.
2. Inicia con "Usuario [nombre] en [ubicación]..." si conoces ambos. Si falta un dato, usa "sin nombre" / "ubicación no especificada".
3. Menciona explícitamente: tipo de máquina (lavadora/secadora) y número si presentes, código de pantalla EXACTO tal como lo escribió el cliente (PUSH PROG / SEL / DOOR / ALM DOOR / AL001 / ERR 52 / etc., sin reinterpretarlos), motivo de la escalación, narrativa del cliente si relevante.
4. Lunghezza: 2-4 frasi. Conciso, factual, profesional. NO empático (es para el operador).
5. Idioma: español, independientemente del idioma del cliente.
6. NO uses markdown (no asteriscos, no listas).
7. NO incluyas saludos, despedidas, ni instrucciones para el operador.

Responde SOLO con el briefing, sin preámbulos.`

/**
 * Generate the operator briefing from the conversation history. Falls
 * back to the deterministic `fallbackSummary` on any error / empty
 * response — never throws.
 */
export async function generateOperatorBriefingFromHistory(
  ar: AgentRuntime,
  history: AgentMessage[],
  fallbackSummary: string,
): Promise<string> {
  if (!ar.runtime.settings?.operatorBriefingFromLlm) {
    return fallbackSummary
  }

  const temperature = ar.runtime.settings?.operatorBriefingTemperature ?? 0.2
  const customerName = ar.state.customerName || ''
  const location = ar.state.location || ''
  const locationStreet = ar.state.locationStreet || ''
  const machineType = ar.state.machineType || ''
  const machineNumber = ar.state.machineNumber || ''
  const displayLabel = ar.state.displayLabel || ar.state.displayState || ''
  const escalationReason = ar.state.escalationReason || ''
  // F27 — chronological list of every distinct display the customer reported
  // during this incident. Drives the "Secuencia de pantallas vista: X → Y → Z"
  // line in the operator briefing when the customer cycled through multiple
  // display states (Caso 32.1 marathon).
  const displayHistory = (ar.state.displayHistory || []).filter(Boolean)
  const displaySequence = displayHistory.length > 1 ? displayHistory.join(' → ') : ''

  // Last 30 turns max to keep token cost bounded.
  const trimmed = history.slice(-30)
  const historyBlock = trimmed
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n')

  const userPrompt = [
    'STATE_FACTS:',
    `  timestamp: ${formatHandoverTimestamp()}`,
    `  customerName: ${customerName || '(missing)'}`,
    `  location: ${location || '(missing)'}${locationStreet ? `, ${locationStreet}` : ''}`,
    `  machineType: ${machineType || '(missing)'}`,
    `  machineNumber: ${machineNumber || '(missing)'}`,
    `  displayLabel: ${displayLabel || '(missing)'}`,
    `  displaySequence: ${displaySequence || '(single)'}`,
    `  escalationReason: ${escalationReason || '(missing)'}`,
    '',
    'CONVERSATION_HISTORY:',
    historyBlock || '(empty)',
    '',
    'Produce el briefing operativo siguiendo las reglas del sistema.',
  ].join('\n')

  // System prompt: prefer prompts/operator-briefing.txt (loaded by runtime),
  // fall back to the TS const BRIEFING_SYSTEM_PROMPT for graceful degradation.
  // See CLAUDE.md Pending refactors D2.
  const promptFromFile = ar.runtime.prompts?.['operator-briefing']?.trim()
  const systemPrompt = promptFromFile || BRIEFING_SYSTEM_PROMPT
  try {
    const briefing = await callModel({
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens: 250,
    })
    if (!briefing.trim()) return fallbackSummary
    return briefing.trim()
  } catch (err) {
    logger.warn('operator briefing LLM failed, falling back to deterministic summary', {
      error: err instanceof Error ? err.message : String(err),
    })
    return fallbackSummary
  }
}
