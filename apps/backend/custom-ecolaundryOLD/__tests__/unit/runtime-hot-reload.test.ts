// F45 — Hot-reload runtime in dev: cache + in-place mutation.
//
// SCENARIO
// ========
// In production, `loadRuntime()` is called once per agent session. The same
// Runtime is shared across the process. When a JSON file changes during
// development (i18n, washer flow, settings, etc.) the bot must observe the
// new content WITHOUT a process restart — otherwise every wording fix
// requires Andrea to bounce the bot.
//
// FIX (F45)
// =========
// - `loadRuntime()` caches the Runtime in a module-level var and returns the
//   same reference on every subsequent call.
// - `reloadRuntimeFromDisk()` re-reads all JSON files and mutates the cached
//   Runtime IN-PLACE (so existing AgentSessions, which hold a reference to
//   the cached Runtime, observe the new content on their next access).
// - i18n + FAQs use module-level setters (setI18nCatalogue + setFaqs) so
//   they're automatically refreshed inside `buildRuntimeFromDisk`.
//
// Run with:
//   node --import tsx __tests__/unit/runtime-hot-reload.test.ts

import { loadRuntime, reloadRuntimeFromDisk, getFaqs } from '../../utils/runtime.js'
import { t } from '../../utils/localization.js'

interface Case {
  name: string
  run: () => Promise<void> | void
}

const cases: Case[] = [
  // ── Cache behavior — loadRuntime is idempotent ───────────────────────────
  {
    name: 'F45 — loadRuntime() returns the SAME cached Runtime reference on subsequent calls',
    run: async () => {
      const r1 = await loadRuntime()
      const r2 = await loadRuntime()
      if (r1 !== r2) {
        throw new Error('F45: loadRuntime must cache and return the same Runtime instance')
      }
    },
  },

  // ── reloadRuntimeFromDisk preserves the cached reference ────────────────
  {
    name: 'F45 — reloadRuntimeFromDisk() does NOT replace the cached Runtime (in-place mutation)',
    run: async () => {
      const r1 = await loadRuntime()
      await reloadRuntimeFromDisk()
      const r2 = await loadRuntime()
      if (r1 !== r2) {
        throw new Error(
          'F45: reloadRuntimeFromDisk must mutate cachedRuntime in-place; ' +
            'replacing the reference would leave existing AgentSessions stale',
        )
      }
    },
  },

  // ── i18n catalogue is loaded and accessible via t() ──────────────────────
  {
    name: 'F45 — t() returns the loaded i18n value after loadRuntime (sanity)',
    run: async () => {
      await loadRuntime()
      const out = t('invoiceAskCoste', 'es')
      // F42 added invoiceAskCoste; F45 ensures hot-reload doesn't break i18n.
      if (!out || !/coste/i.test(out)) {
        throw new Error(`F45: t('invoiceAskCoste', 'es') must include "coste", got "${out}"`)
      }
    },
  },

  // ── reloadRuntimeFromDisk preserves runtime.flows.washer access path ────
  {
    name: 'F45 — runtime.flows.washer still resolves after reloadRuntimeFromDisk',
    run: async () => {
      const r1 = await loadRuntime()
      const washerBefore = r1.flows.washer
      await reloadRuntimeFromDisk()
      const washerAfter = r1.flows.washer
      // After reload, runtime.flows.washer may point to a fresh JSON object
      // (we reassign the property). The important contract: the SAME
      // ar.runtime reference still resolves to a valid washer flow.
      if (!washerAfter || typeof washerAfter !== 'object') {
        throw new Error('F45: runtime.flows.washer must remain valid after reload')
      }
      // washerBefore is allowed to differ from washerAfter (top-level reassign).
      void washerBefore
    },
  },

  // ── getFaqs returns a populated map after load ───────────────────────────
  {
    name: 'F45 — getFaqs() returns populated FAQ map after loadRuntime',
    run: async () => {
      await loadRuntime()
      const faqs = getFaqs()
      if (!faqs || Object.keys(faqs).length === 0) {
        throw new Error('F45: getFaqs must return populated map after load')
      }
    },
  },
]

async function main(): Promise<void> {
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
