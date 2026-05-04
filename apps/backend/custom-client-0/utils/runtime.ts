// Runtime configuration and loading
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type FlowNode = {
  type: 'ACTION' | 'CONFIRMATION' | 'CHOICE' | 'INFO' | 'ROUTER' | 'INPUT'
  prompt: string
  transitions?: Record<string, string>
  logic?: Record<string, string>
  isTerminal?: boolean
  action?: 'escalate'
  strictMatching?: boolean
  onInterruptFallback?: string
}

export type FlowMap = Record<string, Record<string, FlowNode>>
export type FaqMap = Record<string, string>

export type LocationOverride = {
  pueblo?: string
  calle?: string
  displayName?: string
  metadata?: Record<string, unknown>
  faqOverrides?: Record<string, string>
  flowOverrides?: Record<string, { prompt?: string }>
  escalationRules?: Array<{ id: string; trigger: string; action: string; reason?: string }>
}

export type LocationsConfig = {
  _principle?: string
  _overrideTypes?: Record<string, string>
  locations: Record<string, LocationOverride>
}

export type SupportedLanguage = 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr'

export type Settings = {
  enabledLanguages: SupportedLanguage[]
  defaultLanguage: SupportedLanguage
  chatbotName?: string
  /** Tenant brand name, e.g. "Ecolaundry". Substituted into prompts and
   *  used by escalation/handover summaries. */
  companyName?: string
  /** OpenRouter model id used by every LLM call in this tenant (e.g.
   *  "openai/gpt-4o-mini"). Optional; falls back to LLM_MODEL env var or
   *  a hard-coded default in `utils/llm.ts` when omitted. */
  model?: string
  /** Sampling temperature for the agent loop (default 0.3). */
  agentTemperature?: number
  /** Hard cap on tool-call iterations per turn (default 6). */
  maxToolHops?: number
  /** Free-form description of the desired tone, injected into agent.txt. */
  tone?: string
  /** Tenant support email addresses, exposed to FAQ/handover messages. */
  supportEmails?: {
    invoice?: string
    support?: string
  }
  /** Public refund-form URL, used inside FAQ replies for double-charge etc. */
  refundFormUrl?: string
  /** Whitelisted external domains the bot is allowed to mention. */
  allowedExternalLinks?: string
  welcomeMessage?: Partial<Record<SupportedLanguage, string>>
}

export type Runtime = {
  prompts: Record<string, string>
  flows: {
    washer: FlowMap
    dryer: FlowMap
  }
  /** Kept for backwards compat with utils that still reference it; always []. */
  regressions: never[]
  locations: LocationsConfig
  settings: Settings
}

let FAQS: FaqMap = {}

export function getFaqs(): FaqMap {
  return FAQS
}

export function setFaqs(faqs: FaqMap): void {
  FAQS = faqs
}

export function getDemoDir(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

export async function loadRuntime(): Promise<Runtime> {
  const demoDir = path.resolve(getDemoDir(), '..')
  const flowDir = path.resolve(demoDir, 'json')
  const promptDir = path.resolve(demoDir, 'prompts')
  // Only `language.txt` is on the live call graph (used by llm.ts:detectLanguage
  // as a fallback when the regex heuristic in intent.ts can't decide). The
  // other prompt files in prompts/ are reference material — see docs/prompts.md
  // for the full inventory. We avoid loading them at boot to skip dead I/O.
  const promptNames = ['language']
  const promptEntries = await Promise.all(
    promptNames.map(async (name) => [name, await readFile(path.join(promptDir, `${name}.txt`), 'utf8')] as const),
  )
  const faqs = JSON.parse(await readFile(path.join(flowDir, 'faqs.json'), 'utf8')) as FaqMap
  setFaqs(faqs)
  const washer = JSON.parse(await readFile(path.join(flowDir, 'washer_hs60xx.json'), 'utf8')) as FlowMap
  const dryer = JSON.parse(await readFile(path.join(flowDir, 'dryer_ed340.json'), 'utf8')) as FlowMap
  const locations = JSON.parse(await readFile(path.join(flowDir, 'locations.json'), 'utf8')) as LocationsConfig
  const settings = JSON.parse(await readFile(path.join(flowDir, 'settings.json'), 'utf8')) as Settings
  return { prompts: Object.fromEntries(promptEntries), flows: { washer, dryer }, regressions: [], locations, settings }
}

export function getLocationOverride(runtime: Runtime, location: string | null | undefined): LocationOverride | null {
  if (!location) return null
  const entry = runtime.locations?.locations?.[location]
  return entry || null
}

export function buildLocationContext(runtime: Runtime, state: { location: string }): string {
  const override = getLocationOverride(runtime, state.location)
  if (!override) return ''
  return [
    'ACTIVE LOCATION CONTEXT (internal — do not recite to the customer):',
    JSON.stringify(override, null, 2),
    '',
    'INSTRUCTIONS:',
    '- This context is INTERNAL knowledge for routing and overrides. NEVER tell',
    '  the customer "you are in <pueblo>" or "the laundry is at <calle>" — the',
    '  customer already knows where they are. Only acknowledge their location',
    '  briefly if needed (e.g. "Perfecto, sigamos.") and continue the flow.',
    '- Apply faqOverrides verbatim when the customer asks a matching FAQ.',
    '- Apply flowOverrides when the Flow Engine renders the matching step.',
    '- Trigger escalationRules when the conversation matches a rule\'s trigger description.',
    '- Use metadata to adapt answers about hours, change, prices, etc.',
    '- Anti-hardcode: do not branch on location name; read everything from this context.',
    '- If the customer named a location that does NOT match this entry, trust the',
    '  customer over this context — never override what the customer said with',
    '  a different city/street.',
  ].join('\n')
}

export function replaceVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  )
}

/**
 * Build the standard variable bag derived from `settings.json`. Use this any
 * time you render a customer-facing string that may contain placeholders like
 * `{{companyName}}`, `{{invoiceEmail}}`, `{{supportEmail}}`, `{{refundFormUrl}}`.
 *
 * Adding a new setting? Map it here once and every consumer (FAQs,
 * localization, prompts) gets the substitution automatically.
 */
export function buildSettingsVars(settings: Settings): Record<string, string> {
  return {
    chatbotName: settings.chatbotName || 'Eco',
    companyName: settings.companyName || 'Ecolaundry',
    invoiceEmail: settings.supportEmails?.invoice || '',
    supportEmail: settings.supportEmails?.support || '',
    refundFormUrl: settings.refundFormUrl || '',
    allowedExternalLinks: settings.allowedExternalLinks || '',
    tone: settings.tone || 'calm, reassuring, relaxed, warm, step-by-step',
  }
}

/**
 * Convenience wrapper: substitutes settings-derived placeholders in `text`.
 * Equivalent to `replaceVars(text, buildSettingsVars(runtime.settings))`.
 */
export function applySettingsVars(text: string, runtime: Runtime): string {
  return replaceVars(text, buildSettingsVars(runtime.settings))
}
