// Operator briefing — LLM-generated handover summary (opt-in via
// settings.operatorBriefingFromLlm). Falls back to deterministic
// `escalation.ts:buildEscalationSummary` on parse/empty errors.
//
// F106 (2026-05-25) — language driven by settings.operatorBriefingLanguage.
// The system prompt has a `{language}` placeholder substituted at runtime
// with the localised language name (e.g. "español", "italiano", "English").
// Internal-token leaks ("(single)", "(missing)") are eliminated: fact lines
// without a value are simply omitted instead of being filled with a
// placeholder the LLM could parrot back into the customer-visible briefing.
import type { AgentMessage, AgentRuntime, SessionState, SupportedLanguage } from '../models/index.js'
import { callModel } from './llm.js'
import { LlmFetchError } from './llm-fetch.js'
import { formatHandoverTimestamp } from './escalation.js'
import { t } from './localization.js'
import { logger } from './logger.js'

// F57: scope FACTS to the current escalation category to prevent pollution
// from abandoned flows. Mirror branches in `buildEscalationSummaryBody`.
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

// Fallback system prompt used when prompts/operator-briefing.txt is missing.
// Production reads the file via runtime.prompts['operator-briefing'].
// `{language}` is substituted at runtime via getLanguageName(briefingLang).
const BRIEFING_SYSTEM_PROMPT = `You produce an operational briefing for a human operator of a self-service laundry. The briefing is an INTERNAL message TO the operator, NOT to the customer.

STRICT RULES:
1. ONLY observable facts from the conversation. Do NOT invent details, codes, locations, amounts or names.
2. Start with "Customer [name] at [location]…" if both are known. If a fact is missing, skip it entirely — never write "(missing)", "(single)", "(unknown)" or any internal placeholder.
3. Explicitly mention: machine type and number when present, display code EXACTLY as the customer wrote it (PUSH PROG / SEL / DOOR / AL001 / etc.), the escalation reason, and the customer narrative if relevant.
4. Length: 2-4 sentences. Concise, factual, professional. NOT empathic.
5. Language: {language}, regardless of the customer's language.
6. NO markdown (no asterisks, no lists).
7. NO greetings, closings, or instructions to the operator.

Reply ONLY with the briefing, no preamble.`

// Localised language names sourced from each i18n catalogue
// (key `summaryLanguageName`). Falls back to the lang code when missing.
function getLanguageName(lang: SupportedLanguage): string {
  return t('summaryLanguageName', lang) || lang
}

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

  const briefingLang: SupportedLanguage = ar.runtime.settings?.operatorBriefingLanguage ?? 'es'
  const temperature = ar.runtime.settings?.operatorBriefingTemperature ?? 0.2
  const customerName = ar.state.customerName || ''
  const location = ar.state.location || ''
  const locationStreet = ar.state.locationStreet || ''
  const machineType = ar.state.machineType || ''
  const machineNumber = ar.state.machineNumber || ''
  const displayLabel = ar.state.displayLabel || ar.state.displayState || ''
  const escalationReason = ar.state.escalationReason || ''
  // F27 — chronological list of displays. Only emitted when ≥2 distinct codes.
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

  // F106 — fact lines are emitted ONLY when the underlying value is present.
  // No "(missing)" / "(single)" placeholders the LLM could leak verbatim
  // into the customer-visible briefing.
  const factsLines: string[] = ['FACTS:']
  factsLines.push(`  timestamp: ${formatHandoverTimestamp(briefingLang)}`)
  if (customerName) factsLines.push(`  customerName: ${customerName}`)
  if (location) {
    factsLines.push(`  location: ${location}${locationStreet ? `, ${locationStreet}` : ''}`)
  }
  factsLines.push(`  escalationCategory: ${category}`)
  if (escalationReason) factsLines.push(`  escalationReason: ${escalationReason}`)

  if (isMachineTrouble) {
    if (machineType) factsLines.push(`  machineType: ${machineType}`)
    if (machineNumber) factsLines.push(`  machineNumber: ${machineNumber}`)
    if (displayLabel) factsLines.push(`  displayLabel: ${displayLabel}`)
    if (displaySequence) factsLines.push(`  displaySequence: ${displaySequence}`)
  } else {
    if (category === 'discount-code') {
      const code = ar.state.faqCodeValue || ''
      if (code) factsLines.push(`  discountCode: ${code}`)
    }
    if (category === 'invoice' && ar.state.invoiceData?.email) {
      const inv = ar.state.invoiceData
      factsLines.push(
        `  invoiceData: razonSocial=${inv.razonSocial}; cif=${inv.cif}; email=${inv.email}; fecha=${inv.fecha}; coste=${inv.costeTotal || '-'}; notas=${inv.notes || '-'}`,
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
    `Produce the operator briefing in ${getLanguageName(briefingLang)}, following the system rules.`,
  ].join('\n')

  // System prompt: prefer prompts/operator-briefing.txt (loaded by runtime),
  // fall back to the TS const for graceful degradation. CLAUDE.md D2.
  // F106 — substitute {language} placeholder with the localised language name.
  const promptFromFile = ar.runtime.prompts?.['operator-briefing']?.trim()
  const rawSystemPrompt = promptFromFile || BRIEFING_SYSTEM_PROMPT
  const systemPrompt = rawSystemPrompt.split('{language}').join(getLanguageName(briefingLang))
  try {
    const briefing = await callModel({
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens: 250,
      caller: 'operator-briefing',
    })
    if (!briefing.trim()) return fallbackSummary
    return briefing.trim()
  } catch (err) {
    // F85 — Network outages re-throw (host serves WIP); parse/schema keep fallback.
    if (err instanceof LlmFetchError) throw err
    logger.warn('operator briefing LLM failed, falling back to deterministic summary', {
      error: err instanceof Error ? err.message : String(err),
    })
    return fallbackSummary
  }
}
