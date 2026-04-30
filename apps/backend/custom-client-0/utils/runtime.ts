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
}

export type Runtime = {
  prompts: Record<string, string>
  flows: {
    washer: FlowMap
    dryer: FlowMap
  }
  regressions: RegressionScenario[]
  locations: LocationsConfig
  settings: Settings
}

export type RegressionScenario = {
  name: string
  turns: string[]
  assertions: RegressionAssertion[]
}

export type RegressionAssertion = {
  turn: number
  includes?: string[]
  excludes?: string[]
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
  const promptNames = ['router', 'history', 'washer', 'dryer', 'language']
  const promptEntries = await Promise.all(
    promptNames.map(async (name) => [name, await readFile(path.join(promptDir, `${name}.txt`), 'utf8')] as const),
  )
  const faqs = JSON.parse(await readFile(path.join(flowDir, 'faqs.json'), 'utf8')) as FaqMap
  setFaqs(faqs)
  const regressions = JSON.parse(await readFile(path.join(demoDir, 'json', 'regressions.json'), 'utf8')) as RegressionScenario[]
  const washer = JSON.parse(await readFile(path.join(flowDir, 'lavatrice_hs60xx.json'), 'utf8')) as FlowMap
  const dryer = JSON.parse(await readFile(path.join(flowDir, 'asciugatrice_ed340.json'), 'utf8')) as FlowMap
  const locations = JSON.parse(await readFile(path.join(flowDir, 'locations.json'), 'utf8')) as LocationsConfig
  const settings = JSON.parse(await readFile(path.join(flowDir, 'settings.json'), 'utf8')) as Settings
  return { prompts: Object.fromEntries(promptEntries), flows: { washer, dryer }, regressions, locations, settings }
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
    'ACTIVE LOCATION CONTEXT:',
    JSON.stringify(override, null, 2),
    '',
    'INSTRUCTIONS:',
    '- Apply faqOverrides verbatim when the customer asks a matching FAQ.',
    '- Apply flowOverrides when the Flow Engine renders the matching step.',
    '- Trigger escalationRules when the conversation matches a rule\'s trigger description.',
    '- Use metadata to adapt answers about hours, change, prices, etc.',
    '- Anti-hardcode: do not branch on location name; read everything from this context.',
  ].join('\n')
}

export function replaceVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  )
}
