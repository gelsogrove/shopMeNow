// Operator briefing — LLM-generated handover summary (opt-in via
// settings.operatorBriefingFromLlm). Falls back to the deterministic
// `escalation.ts:buildEscalationSummary` on error / empty response.

import type { AgentMessage, AgentRuntime, SessionState } from '../models/index.js'
import { callModel } from './llm.js'
import { formatHandoverTimestamp } from './escalation.js'
import { logger } from './logger.js'

// F57: scope STATE_FACTS to the current escalation category to prevent
// pollution from abandoned flows. Mirror branches in `buildEscalationSummaryBody`.
export type EscalationCategory =
  | 'discount-code'
  | 'invoice'
  | 'non-trouble'
  | 'machine-trouble'

export function getEscalationCategory(state: SessionState): EscalationCategory {
  if (
    !!state.discountCodeData?.letters ||
    /^discount-code-/.test(state.pendingFlow || '') ||
    /caso\s*8|c[oó]digo\s+(?:de\s+)?descuento/i.test(state.escalationReason || '')
  ) {
    return 'discount-code'
  }
  if (
    !!state.invoiceData?.email ||
    /^invoice-/.test(state.pendingFlow || '') ||
    /invoice|factura/i.test(state.escalationReason || '')
  ) {
    return 'invoice'
  }
  if (state.nonTroubleshootingIncident) {
    return 'non-trouble'
  }
  return 'machine-trouble'
}

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

// Generate the operator briefing from the conversation history. Falls back
// to `fallbackSummary` on error / empty response. Never throws.
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
  // F27 — chronological list of displays for the "Secuencia de pantallas vista" line.
  const displayHistory = (ar.state.displayHistory || []).filter(Boolean)
  const displaySequence = displayHistory.length > 1 ? displayHistory.join(' → ') : ''

  // Last 30 turns max to keep token cost bounded.
  const trimmed = history.slice(-30)
  const historyBlock = trimmed
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n')

  // F57 — scope facts to the current escalation category.
  const category = getEscalationCategory(ar.state)
  const isMachineTrouble = category === 'machine-trouble'

  const factsLines: string[] = [
    'STATE_FACTS:',
    `  timestamp: ${formatHandoverTimestamp()}`,
    `  customerName: ${customerName || '(missing)'}`,
    `  location: ${location || '(missing)'}${locationStreet ? `, ${locationStreet}` : ''}`,
    `  escalationCategory: ${category}`,
    `  escalationReason: ${escalationReason || '(missing)'}`,
  ]
  if (isMachineTrouble) {
    factsLines.push(
      `  machineType: ${machineType || '(missing)'}`,
      `  machineNumber: ${machineNumber || '(missing)'}`,
      `  displayLabel: ${displayLabel || '(missing)'}`,
      `  displaySequence: ${displaySequence || '(single)'}`,
    )
  } else {
    factsLines.push(
      `  machineFacts: (not applicable for ${category} escalations — IGNORE machine/display details even if they appear in CONVERSATION_HISTORY)`,
    )
    if (category === 'discount-code') {
      const code = ar.state.faqCodeValue || ''
      factsLines.push(`  discountCode: ${code || '(missing)'}`)
    }
    if (category === 'invoice' && ar.state.invoiceData?.email) {
      const inv = ar.state.invoiceData
      factsLines.push(
        `  invoiceData: razonSocial=${inv.razonSocial}; cif=${inv.cif}; email=${inv.email}; fecha=${inv.fecha}; coste=${inv.costeTotal || '(missing)'}; notas=${inv.notes || '(none)'}`,
      )
    }
    if (category === 'non-trouble' && ar.state.nonTroubleshootingIncident) {
      factsLines.push(`  nonTroubleshootingIncident: ${ar.state.nonTroubleshootingIncident}`)
    }
  }

  const userPrompt = [
    ...factsLines,
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
