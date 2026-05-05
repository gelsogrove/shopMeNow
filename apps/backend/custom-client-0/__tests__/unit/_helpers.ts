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
  validateNluPatternsFile,
  type Runtime,
} from '../../models/index.js'

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
  cachedRuntime = {
    prompts: {},
    flows: { washer: {}, dryer: {} },
    regressions: [],
    locations: { locations: {} },
    settings: {
      enabledLanguages: ['es'],
      defaultLanguage: 'es',
    },
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
