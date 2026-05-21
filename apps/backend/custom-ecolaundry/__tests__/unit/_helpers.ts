// Shared helpers for unit tests (no LLM).
//
// makeTestRuntime() loads the REAL nlu-patterns.json + display-flows.json so
// the deterministic extractors and guards can run without their consumers
// having to know about runtime wiring. We do NOT load the LLM stack — only
// the JSON-backed config. This stays fast (<10ms) and deterministic.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  validateDisplayFlowsFile,
  validateI18nCatalogue,
  validateNluPatternsFile,
  type Runtime,
  type SupportedLanguage,
} from '../../models/index.js'
import { setI18nCatalogue } from '../../utils/localization.js'
import { setFaqs } from '../../utils/runtime.js'

const I18N_LANGS: SupportedLanguage[] = ['es', 'it', 'ca', 'en', 'pt', 'fr']

const here = path.dirname(fileURLToPath(import.meta.url))
const jsonDir = path.resolve(here, '..', '..', 'json')

let cachedRuntime: Runtime | null = null

export async function loadTestRuntime(): Promise<Runtime> {
  if (cachedRuntime) return cachedRuntime
  const displayFlowsRaw = JSON.parse(
    await readFile(path.join(jsonDir, 'display-flows.json'), 'utf8'),
  )
  const nluPatternsRaw = JSON.parse(
    await readFile(path.join(jsonDir, 'nlu-patterns.json'), 'utf8'),
  )
  // Load the washer + dryer flow maps so guards that rely on the flow
  // engine (e.g. guardAutoStartMachineFlow) can resolve nodes against
  // real data instead of an empty `{}`. Casting is safe because the
  // JSON is validated at runtime production-side; in tests we trust
  // the source-of-truth files.
  const washerFlowsRaw = JSON.parse(
    await readFile(path.join(jsonDir, 'washer_hs60xx.json'), 'utf8'),
  )
  const dryerFlowsRaw = JSON.parse(
    await readFile(path.join(jsonDir, 'dryer_ed340.json'), 'utf8'),
  )
  // Load all i18n maps so t()/tt() lookups behave identically to production.
  const i18nDir = path.join(jsonDir, 'i18n')
  const i18nRaw: Partial<Record<SupportedLanguage, unknown>> = {}
  await Promise.all(
    I18N_LANGS.map(async (lang) => {
      try {
        i18nRaw[lang] = JSON.parse(await readFile(path.join(i18nDir, `${lang}.json`), 'utf8'))
      } catch (err) {
        if ((err as { code?: string } | null)?.code !== 'ENOENT') throw err
      }
    }),
  )
  setI18nCatalogue(validateI18nCatalogue(i18nRaw))

  // Load FAQ data so guards that read getFaqs() work in unit tests.
  const faqsRaw = JSON.parse(await readFile(path.join(jsonDir, 'faqs.json'), 'utf8'))
  setFaqs(faqsRaw)

  // Strip JSON-comment fields (`_principle`, etc.) so the FlowMap shape
  // is not polluted; they're documentation-only in the source files.
  const stripCommentKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (!k.startsWith('_')) out[k] = v
    }
    return out
  }

  cachedRuntime = {
    prompts: {},
    flows: {
      washer: stripCommentKeys(washerFlowsRaw) as Runtime['flows']['washer'],
      dryer: stripCommentKeys(dryerFlowsRaw) as Runtime['flows']['dryer'],
    },
    regressions: [],
    locations: { locations: {} },
    settings: {
      enabledLanguages: ['es'],
      defaultLanguage: 'es',
      // F46 — required field. Tests pin "SAU" so the discount-code guard and
      // validateCustomerName behave identically to the Ecolaundry tenant.
      discountCodePrefix: 'SAU',
    } as Runtime['settings'],
    displayFlows: validateDisplayFlowsFile(displayFlowsRaw),
    nluPatterns: validateNluPatternsFile(nluPatternsRaw),
  }
  return cachedRuntime
}

/** Synchronous variant: test runners that load this helper at top level can
 *  await loadTestRuntime() once and reuse the cached instance everywhere. */
export function getCachedTestRuntime(): Runtime {
  if (!cachedRuntime) {
    throw new Error(
      'getCachedTestRuntime called before loadTestRuntime(). Call `await loadTestRuntime()` once at the top of your test file.',
    )
  }
  return cachedRuntime
}
