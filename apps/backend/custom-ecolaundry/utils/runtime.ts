// Runtime loading + helpers. Type definitions live in ../models/runtime.ts.

import { readFile } from 'node:fs/promises'
import * as fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  FaqMap,
  FlowMap,
  LocationOverride,
  LocationsConfig,
  Runtime,
  Settings,
  SupportedLanguage,
} from '../models/index.js'
import {
  validateDisplayFlowsFile,
  validateI18nCatalogue,
  validateNluPatternsFile,
} from '../models/index.js'
import { setI18nCatalogue } from './localization.js'

const I18N_LANGS: SupportedLanguage[] = ['es', 'it', 'ca', 'en', 'pt', 'fr']

/**
 * Fail-fast validator for settings.json. Catches the misconfigurations that
 * would silently produce wrong replies later (empty enabledLanguages, default
 * language not in the allowlist, non-positive maxToolHops, …). Throws on the
 * first violation so the process refuses to start.
 */
function validateSettings(settings: Settings): void {
  const errors: string[] = []
  const enabled = settings.enabledLanguages
  if (!Array.isArray(enabled) || enabled.length === 0) {
    errors.push('enabledLanguages must be a non-empty array')
  }
  if (!settings.defaultLanguage) {
    errors.push('defaultLanguage is required')
  } else if (Array.isArray(enabled) && !enabled.includes(settings.defaultLanguage)) {
    errors.push(
      `defaultLanguage "${settings.defaultLanguage}" is not in enabledLanguages [${enabled.join(', ')}]`,
    )
  }
  if (typeof settings.maxToolHops !== 'number' || settings.maxToolHops < 1) {
    errors.push('maxToolHops must be a positive number')
  }
  // F46 — discountCodePrefix gates the regex builder used by Caso 8 guards
  // AND by validateCustomerName (to refuse code-shaped tokens as a name).
  // Iron rule #7 (settings are law) → fail-fast on missing/invalid prefix
  // instead of falling back to a hardcoded "SAU".
  if (
    typeof settings.discountCodePrefix !== 'string' ||
    !/^[A-Z]+$/.test(settings.discountCodePrefix)
  ) {
    errors.push(
      'discountCodePrefix must be a non-empty uppercase letters-only string (e.g. "SAU")',
    )
  }
  if (
    settings.agentTemperature !== undefined &&
    (typeof settings.agentTemperature !== 'number' ||
      settings.agentTemperature < 0 ||
      settings.agentTemperature > 2)
  ) {
    errors.push('agentTemperature must be a number in [0, 2]')
  }
  if (errors.length) {
    throw new Error(`Invalid settings.json:\n  - ${errors.join('\n  - ')}`)
  }
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

// F45 — Andrea 2026-05-11: module-level cache so that hot-reload can mutate
// the runtime in-place. All AgentSessions created via `loadRuntime()` share
// the same Runtime reference; when a watched JSON file changes, we patch the
// cached object's properties so all existing sessions observe the new data
// on their NEXT property access (no agent restart needed).
let cachedRuntime: Runtime | null = null
let devWatcherActive = false
let reloadDebounce: NodeJS.Timeout | null = null

export async function loadRuntime(): Promise<Runtime> {
  if (cachedRuntime) return cachedRuntime
  cachedRuntime = await buildRuntimeFromDisk()
  // F45 — start the dev watcher on first load. Strict opt-in: only when
  // NODE_ENV === 'development'. Tests run with unset/test NODE_ENV → no
  // fs.watch handle, no hanging event loop. Production runs with
  // NODE_ENV === 'production' → no watcher. Andrea must run with
  // NODE_ENV=development (ts-node-dev sets this by default).
  if (process.env.NODE_ENV === 'development' && !devWatcherActive) {
    watchRuntimeFilesForDev()
  }
  return cachedRuntime
}

/**
 * F45 — re-read all JSON files and mutate the cached runtime in-place.
 *
 * Why in-place? Existing AgentSessions hold a reference to the cached
 * Runtime object. If we replace `cachedRuntime` with a new object, those
 * sessions keep the OLD reference and never see the new data. By assigning
 * to existing properties (`cachedRuntime.flows.washer = fresh.flows.washer`,
 * etc.), every session observes the updated catalogue on its next access.
 *
 * For i18n + FAQs, the module-level setters (setI18nCatalogue, setFaqs)
 * are called inside `buildRuntimeFromDisk()` → automatically refreshed.
 */
export async function reloadRuntimeFromDisk(): Promise<void> {
  if (!cachedRuntime) return
  const fresh = await buildRuntimeFromDisk()
  // Prompts: mutate keys on the existing dict.
  for (const key of Object.keys(cachedRuntime.prompts)) delete cachedRuntime.prompts[key]
  Object.assign(cachedRuntime.prompts, fresh.prompts)
  // Flows: top-level reassign (consumers access via ar.runtime.flows.washer
  // each time, no nested caching observed in current call graph).
  cachedRuntime.flows.washer = fresh.flows.washer
  cachedRuntime.flows.dryer = fresh.flows.dryer
  cachedRuntime.locations = fresh.locations
  cachedRuntime.settings = fresh.settings
  cachedRuntime.displayFlows = fresh.displayFlows
  cachedRuntime.nluPatterns = fresh.nluPatterns
}

/**
 * F45 — fs.watch on the JSON + prompts directories. Debounced 150ms to
 * coalesce editor double-fires. Active only in NODE_ENV=development.
 */
export function watchRuntimeFilesForDev(): void {
  if (devWatcherActive) return
  devWatcherActive = true
  const demoDir = path.resolve(getDemoDir(), '..')
  const dirsToWatch = [
    path.resolve(demoDir, 'json'),
    path.resolve(demoDir, 'json', 'i18n'),
    path.resolve(demoDir, 'prompts'),
  ]
  for (const dir of dirsToWatch) {
    try {
      fs.watch(dir, (_event, filename) => {
        if (!filename) return
        if (!filename.endsWith('.json') && !filename.endsWith('.txt')) return
        if (reloadDebounce) clearTimeout(reloadDebounce)
        reloadDebounce = setTimeout(() => {
          reloadRuntimeFromDisk().then(
            () => console.log(`[runtime] Hot-reloaded after change in ${dir}/${filename}`),
            (err) => console.error(`[runtime] Hot-reload failed:`, err),
          )
        }, 150)
      })
    } catch (err) {
      console.warn(`[runtime] fs.watch failed for ${dir}:`, err)
    }
  }
}

async function buildRuntimeFromDisk(): Promise<Runtime> {
  const demoDir = path.resolve(getDemoDir(), '..')
  const flowDir = path.resolve(demoDir, 'json')
  const promptDir = path.resolve(demoDir, 'prompts')
  // Live prompts loaded at boot (call graph touches them at runtime):
  //   - language: utils/llm.ts:detectLanguage (fallback when regex heuristic can't decide)
  //   - router: utils/router.ts:classifyMessageBranch (T1 branch classifier)
  //   - rephrase: utils/agent-rephrase.ts:rephraseForTurn (LLM polish layer)
  //   - operator-briefing: utils/operator-briefing.ts:generateOperatorBriefingFromHistory
  // The other prompt files in prompts/ are reference material — see docs/prompts.md.
  // Each caller has a TS-const fallback if the file is missing (graceful degradation).
  const promptNames = ['language', 'router', 'rephrase', 'operator-briefing']
  // Safe-load: missing files become empty strings, so callers can fall back
  // to their TS-const default. This keeps deployments forgiving (a missing
  // optional prompt file does not break the bot at boot).
  const promptEntries = await Promise.all(
    promptNames.map(async (name) => {
      try {
        const content = await readFile(path.join(promptDir, `${name}.txt`), 'utf8')
        return [name, content] as const
      } catch {
        return [name, ''] as const
      }
    }),
  )
  const faqs = JSON.parse(await readFile(path.join(flowDir, 'faqs.json'), 'utf8')) as FaqMap
  setFaqs(faqs)
  const washer = JSON.parse(await readFile(path.join(flowDir, 'washer_hs60xx.json'), 'utf8')) as FlowMap
  const dryer = JSON.parse(await readFile(path.join(flowDir, 'dryer_ed340.json'), 'utf8')) as FlowMap
  const locations = JSON.parse(await readFile(path.join(flowDir, 'locations.json'), 'utf8')) as LocationsConfig
  const settings = JSON.parse(await readFile(path.join(flowDir, 'settings.json'), 'utf8')) as Settings
  validateSettings(settings)
  const displayFlowsRaw = JSON.parse(await readFile(path.join(flowDir, 'display-flows.json'), 'utf8'))
  const displayFlows = validateDisplayFlowsFile(displayFlowsRaw)
  const nluPatternsRaw = JSON.parse(await readFile(path.join(flowDir, 'nlu-patterns.json'), 'utf8'))
  const nluPatterns = validateNluPatternsFile(nluPatternsRaw)

  // i18n catalogue — load all per-language maps in parallel and install the
  // validated catalogue into the localization helper. Missing files are
  // tolerated (a tenant may disable a language); the validator enforces
  // that every key declared in the base language exists in every language
  // file that IS present.
  const i18nDir = path.join(flowDir, 'i18n')
  const i18nRaw: Partial<Record<SupportedLanguage, unknown>> = {}
  await Promise.all(
    I18N_LANGS.map(async (lang) => {
      try {
        const buf = await readFile(path.join(i18nDir, `${lang}.json`), 'utf8')
        i18nRaw[lang] = JSON.parse(buf)
      } catch (err) {
        // ENOENT is acceptable (language not provided); other errors propagate.
        if ((err as { code?: string } | null)?.code !== 'ENOENT') throw err
      }
    }),
  )
  const i18n = validateI18nCatalogue(i18nRaw)
  setI18nCatalogue(i18n)

  return {
    prompts: Object.fromEntries(promptEntries),
    flows: { washer, dryer },
    regressions: [],
    locations,
    settings,
    displayFlows,
    nluPatterns,
  }
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
