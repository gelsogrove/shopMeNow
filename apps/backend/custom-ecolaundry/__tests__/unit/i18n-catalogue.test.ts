// Standalone unit test (NO LLM) — i18n catalogue contract.
//
// PURPOSE:
//   1. Every key declared in es.json (the BASE language) must exist in all
//      the other language files. The validator already enforces this at
//      boot — this test pins the contract from the consumer side so a
//      regression (someone deletes a key from one file) shows up here too.
//   2. Spot-check that t() returns the right localised value for a few
//      well-known keys after the catalogue has been loaded.
//   3. Verify tt() interpolation still works.
//   4. Verify the tone refactor stuck: ES strings include the agreed
//      politeness markers (por favor / podrías / cuéntame / 🙂).
//
// Run with:
//   node --import tsx __tests__/unit/i18n-catalogue.test.ts

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { t, tt, listBaseKeys } from '../../utils/localization.js'
import { loadTestRuntime } from './_helpers.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const i18nDir = path.resolve(here, '..', '..', 'json', 'i18n')

interface Case {
  name: string
  run: () => Promise<void> | void
}

const cases: Case[] = [
  {
    name: 'every i18n file is valid JSON and uses string values',
    run: async () => {
      const files = (await readdir(i18nDir)).filter((f) => f.endsWith('.json'))
      if (files.length === 0) throw new Error('no i18n files found')
      for (const f of files) {
        const raw = JSON.parse(await readFile(path.join(i18nDir, f), 'utf8'))
        for (const [k, v] of Object.entries(raw)) {
          if (k.startsWith('_')) continue
          if (typeof v !== 'string') {
            throw new Error(`${f}: key "${k}" is not a string (got ${typeof v})`)
          }
        }
      }
    },
  },
  {
    name: 'every base (es) key is present in it/ca/en/pt/fr',
    run: async () => {
      const ALL = ['es', 'it', 'ca', 'en', 'pt', 'fr']
      const maps: Record<string, Record<string, unknown>> = {}
      for (const lang of ALL) {
        try {
          maps[lang] = JSON.parse(await readFile(path.join(i18nDir, `${lang}.json`), 'utf8'))
        } catch {
          // tenant may legitimately disable a language
        }
      }
      const baseKeys = Object.keys(maps.es).filter((k) => !k.startsWith('_'))
      if (baseKeys.length < 10) throw new Error(`base catalogue suspiciously small: ${baseKeys.length} keys`)
      for (const lang of ALL) {
        if (lang === 'es' || !maps[lang]) continue
        for (const key of baseKeys) {
          if (!(key in maps[lang])) {
            throw new Error(`${lang}.json missing key "${key}"`)
          }
        }
      }
    },
  },
  {
    name: 't() returns the ES value for a known key',
    run: () => {
      const got = t('machineType', 'es')
      if (!got.toLowerCase().includes('lavadora')) {
        throw new Error(`expected ES value to mention "lavadora", got: ${got}`)
      }
    },
  },
  {
    name: 't() falls back to ES when language is missing',
    run: () => {
      // Ask for a language for which the key may exist in the file or not.
      // Either way, t() must return SOME string (never undefined).
      const got = t('machineType', undefined)
      if (typeof got !== 'string' || got.length === 0) {
        throw new Error(`expected non-empty string, got ${typeof got}: ${got}`)
      }
    },
  },
  {
    name: 't() returns the key name when called for an unknown key (no undefined)',
    run: () => {
      const got = t('this-key-does-not-exist', 'es')
      if (got !== 'this-key-does-not-exist') {
        throw new Error(`expected key-name fallback, got: ${got}`)
      }
    },
  },
  {
    name: 'tt() interpolates {placeholder} occurrences',
    run: () => {
      const got = tt('unknownDisplayEscalate', 'es', { display: 'XYZ123' })
      if (!got.includes('XYZ123')) {
        throw new Error(`expected interpolated placeholder, got: ${got}`)
      }
    },
  },
  {
    name: 'tone refactor: ES customerNameAsk is gentle',
    run: () => {
      const got = t('customerNameAsk', 'es')
      if (!got.includes('por favor')) {
        throw new Error(`expected "por favor" in customerNameAsk, got: ${got}`)
      }
    },
  },
  {
    name: 'tone refactor: ES machineType uses "podrías"',
    run: () => {
      const got = t('machineType', 'es')
      if (!got.toLowerCase().includes('podrías')) {
        throw new Error(`expected "podrías" in machineType, got: ${got}`)
      }
    },
  },
  {
    name: 'listBaseKeys returns a non-empty list',
    run: () => {
      const keys = listBaseKeys()
      if (keys.length < 10) throw new Error(`base keys list too small: ${keys.length}`)
    },
  },
  // F34 — refundFormFinal must include both placeholders ({name} + {refundFormUrl})
  // in all 6 language catalogues. agent.ts substitutes them at runtime; missing
  // a placeholder = customer never gets the URL = "ma a chi lo mandiamo?"
  // Andrea bug 2026-05-10.
  {
    name: 'F34: refundFormFinal contains {name} placeholder in every language',
    run: async () => {
      const files = (await readdir(i18nDir)).filter((f) => f.endsWith('.json'))
      for (const f of files) {
        const raw = JSON.parse(await readFile(path.join(i18nDir, f), 'utf8')) as Record<string, string>
        const tpl = raw.refundFormFinal
        if (!tpl) throw new Error(`${f}: refundFormFinal missing`)
        if (!tpl.includes('{name}')) {
          throw new Error(`${f}: refundFormFinal must contain {name} placeholder, got: ${tpl}`)
        }
      }
    },
  },
  {
    name: 'F34: refundFormFinal contains {refundFormUrl} placeholder in every language',
    run: async () => {
      const files = (await readdir(i18nDir)).filter((f) => f.endsWith('.json'))
      for (const f of files) {
        const raw = JSON.parse(await readFile(path.join(i18nDir, f), 'utf8')) as Record<string, string>
        const tpl = raw.refundFormFinal
        if (!tpl) throw new Error(`${f}: refundFormFinal missing`)
        if (!tpl.includes('{refundFormUrl}')) {
          throw new Error(`${f}: refundFormFinal must contain {refundFormUrl} placeholder, got: ${tpl}`)
        }
      }
    },
  },
]

async function main(): Promise<void> {
  await loadTestRuntime()
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      await c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
