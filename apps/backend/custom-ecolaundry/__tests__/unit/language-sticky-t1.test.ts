// F80 — Sticky-T1 language contract (NO LLM, pure logic replication).
//
// PURPOSE: pin down the architectural contract that the customer's language
// is decided EXACTLY ONCE — at the first real customer message — and never
// changes thereafter.
//
// REGRESSION CONTEXT (Andrea, 2026-05-22 chat):
//   The bot mixed languages within the same session:
//     - welcome      → EN ("Hi, I'm the laundry virtual assistant")
//     - T2 reply     → ES ("Para poder ayudarte...")
//     - T3 ack       → mixed ("Got it, you're at Pineda. ¿Cuál es el número?")
//     - T4 question  → EN ("What does the screen show?")
//     - T5 instruction → EN
//     - T6+ ES
//   Root cause: `resolveLanguageForTurn` had a flip-back branch that allowed
//   the per-turn heuristic to overwrite `preferredLanguage` whenever a new
//   customer message detected a different enabled language. Combined with
//   the caller config (browser locale) pre-setting `preferredLanguage=EN`
//   via `applyTenantLanguage`, every neutral or short customer message
//   could oscillate the language.
//
// CONTRACT:
//   (a) Caller config (phone prefix, browser locale, widget) sets ONLY
//       `state.language` as a transient fallback. It does NOT set
//       `state.preferredLanguage`.
//   (b) At T1, the customer's first real message is the input for the
//       sticky lock. Heuristic detects language; if enabled, lock to it;
//       if disabled (e.g. IT when enabled={es,ca,en}), lock to
//       defaultLanguage.
//   (c) The router LLM may CORRECT the heuristic AT T1 ONLY (more accurate
//       than the heuristic), but never at T2+.
//   (d) From T2 onward, `preferredLanguage` is LAW. No heuristic, no
//       router, no caller-supplied value can change it.
//
// Run with:
//   node --import tsx __tests__/unit/language-sticky-t1.test.ts

import type { SupportedLanguage } from '../../models/index.js'

// ── Replicated contract under test (must mirror agent.ts + index.ts) ──────

interface State {
  language: SupportedLanguage | ''
  preferredLanguage: SupportedLanguage | ''
  turnCount: number
}

interface Settings {
  enabledLanguages: SupportedLanguage[]
  defaultLanguage: SupportedLanguage
}

/** Mirrors `index.ts:applyTenantLanguage` (caller config fallback, no preferredLanguage set). */
function applyTenantLanguage(state: State, settings: Settings, callerLanguage: SupportedLanguage | null): void {
  const enabled = settings.enabledLanguages || []
  const resolved =
    callerLanguage && enabled.includes(callerLanguage) ? callerLanguage : settings.defaultLanguage
  if (!resolved) return
  state.language = resolved
  // INTENTIONALLY does NOT touch preferredLanguage (F80).
}

/** Mirrors `agent.ts:resolveLanguageForTurn` (T1 detect + sticky T2+). */
function resolveLanguageForTurn(
  state: State,
  settings: Settings,
  heuristicDetect: SupportedLanguage | null,
): void {
  const enabled = settings.enabledLanguages || []
  if (!state.preferredLanguage) {
    const candidate =
      heuristicDetect && enabled.includes(heuristicDetect)
        ? heuristicDetect
        : settings.defaultLanguage
    state.language = candidate
    state.preferredLanguage = candidate
    return
  }
  // F80: strict-sticky — preferredLanguage NEVER changes after T1.
  state.language = state.preferredLanguage
}

/** Mirrors the T1-only router override branch in `agent.ts:maybeDispatchBranch`. */
function routerT1Override(state: State, settings: Settings, routerLang: SupportedLanguage | null): void {
  if (state.turnCount !== 1) return // F80: router can correct ONLY at T1
  if (!routerLang) return
  const enabled = settings.enabledLanguages || []
  if (!enabled.includes(routerLang)) return
  state.language = routerLang
  state.preferredLanguage = routerLang
}

// ── Test cases ─────────────────────────────────────────────────────────────

const TENANT: Settings = {
  enabledLanguages: ['es', 'ca', 'en'],
  defaultLanguage: 'es',
}

function fresh(): State {
  return { language: '', preferredLanguage: '', turnCount: 0 }
}

interface Case {
  name: string
  run: () => void
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`[${label}] expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const cases: Case[] = [
  // ── applyTenantLanguage — caller config fallback ────────────────────────
  {
    name: 'applyTenantLanguage: caller=EN with enabled=[es,ca,en] → state.language=EN, preferredLanguage UNCHANGED',
    run: () => {
      const state = fresh()
      applyTenantLanguage(state, TENANT, 'en')
      assertEq(state.language, 'en', 'language set to caller')
      assertEq(state.preferredLanguage, '', 'preferredLanguage MUST stay empty (caller does not lock)')
    },
  },
  {
    name: 'applyTenantLanguage: caller=IT (disabled) → state.language=ES (fallback), preferredLanguage UNCHANGED',
    run: () => {
      const state = fresh()
      applyTenantLanguage(state, TENANT, 'it')
      assertEq(state.language, 'es', 'language falls back to default')
      assertEq(state.preferredLanguage, '', 'preferredLanguage MUST stay empty')
    },
  },
  {
    name: 'applyTenantLanguage: no caller language → state.language=defaultLanguage, preferredLanguage UNCHANGED',
    run: () => {
      const state = fresh()
      applyTenantLanguage(state, TENANT, null)
      assertEq(state.language, 'es', 'language uses default')
      assertEq(state.preferredLanguage, '', 'preferredLanguage MUST stay empty')
    },
  },

  // ── resolveLanguageForTurn — T1 lock ────────────────────────────────────
  {
    name: 'T1 customer message in ES (enabled) → locks ES',
    run: () => {
      const state = fresh()
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, 'es')
      assertEq(state.language, 'es', 'language')
      assertEq(state.preferredLanguage, 'es', 'preferredLanguage locked at T1')
    },
  },
  {
    name: 'T1 customer message in EN (enabled) → locks EN',
    run: () => {
      const state = fresh()
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, 'en')
      assertEq(state.preferredLanguage, 'en', 'EN is enabled')
    },
  },
  {
    name: 'T1 customer message in IT (DISABLED) → falls back to defaultLanguage=ES (Andrea regression)',
    run: () => {
      // Real chat: customer wrote "ciao non mi va la lavatrice" → must lock ES.
      const state = fresh()
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, 'it')
      assertEq(state.language, 'es', 'fallback to default')
      assertEq(state.preferredLanguage, 'es', 'sticky locked to default')
    },
  },
  {
    name: 'T1 unknown language (null) → locks defaultLanguage=ES',
    run: () => {
      const state = fresh()
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, null)
      assertEq(state.preferredLanguage, 'es', 'no detection → default')
    },
  },
  {
    name: 'T1 with caller config already applied (language=EN, preferredLanguage="") → heuristic still detects',
    run: () => {
      // applyTenantLanguage ran first (caller=EN), then customer sends IT.
      // Must lock to ES (because IT is disabled, defaultLanguage wins).
      // The EN from caller config MUST NOT leak into preferredLanguage.
      const state = fresh()
      applyTenantLanguage(state, TENANT, 'en')
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, 'it')
      assertEq(state.preferredLanguage, 'es', 'EN from caller did not preempt T1 detection')
    },
  },

  // ── resolveLanguageForTurn — T2+ strict-sticky (the actual bug) ─────────
  {
    name: 'T2 ES message after T1 EN lock → preferredLanguage STAYS EN (no flip-back)',
    run: () => {
      const state = fresh()
      state.preferredLanguage = 'en'
      state.language = 'en'
      state.turnCount = 2
      // Customer sends "Policia" which heuristic detects as ES.
      resolveLanguageForTurn(state, TENANT, 'es')
      assertEq(state.preferredLanguage, 'en', 'STICKY: no mid-session flip')
      assertEq(state.language, 'en', 'language follows preferredLanguage')
    },
  },
  {
    name: 'T2 EN message after T1 ES lock → preferredLanguage STAYS ES (Andrea regression mirror)',
    run: () => {
      const state = fresh()
      state.preferredLanguage = 'es'
      state.language = 'es'
      state.turnCount = 3
      // Customer sends "5" or "DOOR" or "no funciona" — heuristic may flip.
      resolveLanguageForTurn(state, TENANT, 'en')
      assertEq(state.preferredLanguage, 'es', 'STICKY at T3')
    },
  },
  {
    name: 'T2+ neutral message (heuristic=null) → preferredLanguage UNCHANGED',
    run: () => {
      const state = fresh()
      state.preferredLanguage = 'ca'
      state.language = 'ca'
      state.turnCount = 5
      resolveLanguageForTurn(state, TENANT, null)
      assertEq(state.preferredLanguage, 'ca', 'no-op when heuristic is null')
    },
  },

  // ── routerT1Override — router LLM corrects ONLY at T1 ───────────────────
  {
    name: 'Router at T1: corrects heuristic (EN → ES) when router knows better',
    run: () => {
      const state = fresh()
      state.turnCount = 1
      state.preferredLanguage = 'en' // heuristic set this
      state.language = 'en'
      routerT1Override(state, TENANT, 'es')
      assertEq(state.preferredLanguage, 'es', 'router corrects at T1')
    },
  },
  {
    name: 'Router at T2 (NEVER overrides) — sticky preserved',
    run: () => {
      const state = fresh()
      state.turnCount = 2
      state.preferredLanguage = 'es'
      state.language = 'es'
      // Router somehow returns EN — must be IGNORED at T2.
      routerT1Override(state, TENANT, 'en')
      assertEq(state.preferredLanguage, 'es', 'router T2 override blocked')
    },
  },
  {
    name: 'Router with disabled language (IT) at T1 → ignored, sticky preserved',
    run: () => {
      const state = fresh()
      state.turnCount = 1
      state.preferredLanguage = 'es'
      state.language = 'es'
      routerT1Override(state, TENANT, 'it')
      assertEq(state.preferredLanguage, 'es', 'IT disabled, ignored')
    },
  },

  // ── End-to-end scenarios mirroring Andrea's 2026-05-22 chat ─────────────
  {
    name: 'E2E Andrea chat: caller=EN + customer T1=IT (disabled) + T2 mention "Policia" → ALL ES',
    run: () => {
      const state = fresh()
      // 1) Caller passes EN (e.g. browser locale).
      applyTenantLanguage(state, TENANT, 'en')
      // 2) Customer T1 message in IT.
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, 'it')
      // Router corrects (let's say it agrees with heuristic → ES).
      routerT1Override(state, TENANT, 'es')
      assertEq(state.preferredLanguage, 'es', 'T1 locked to ES (IT disabled → default)')
      // 3) Customer T2 message "Policia" (ES detected).
      state.turnCount = 2
      resolveLanguageForTurn(state, TENANT, 'es')
      assertEq(state.preferredLanguage, 'es', 'T2 stays ES')
      // 4) Customer T3 message "DOOR" (no detection).
      state.turnCount = 3
      resolveLanguageForTurn(state, TENANT, null)
      assertEq(state.language, 'es', 'T3 stays ES')
    },
  },
  {
    name: 'E2E EN-speaking customer: T1 "my washer is broken" → all EN, no flip-back',
    run: () => {
      const state = fresh()
      state.turnCount = 1
      resolveLanguageForTurn(state, TENANT, 'en')
      routerT1Override(state, TENANT, 'en')
      assertEq(state.preferredLanguage, 'en', 'T1 EN locked')
      // T2 customer answers "Goya" (ES) — must stay EN.
      state.turnCount = 2
      resolveLanguageForTurn(state, TENANT, 'es')
      assertEq(state.language, 'en', 'EN session continues despite ES word')
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  try {
    c.run()
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
