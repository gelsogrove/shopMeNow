// F-log regression pins — one test per F-fix entry in CLAUDE.md.
//
// PURPOSE
// =======
// Every entry in the "Architectural fixes log" (F17→F44+) lives here as a
// minimal pin test. If a future change reverts one of those fixes, the
// matching test fails with a name that DIRECTLY cites the F-number — the
// developer knows exactly which entry in CLAUDE.md to consult.
//
// RULES (enforced by check-architecture.sh)
// =========================================
// 1. Every F-entry in CLAUDE.md F-log MUST have at least one pin here.
// 2. Each pin's `name` MUST start with the F-number ("F39 — ...").
// 3. Pins assert the CANONICAL regression marker (the exact symptom that
//    closed the F-entry). Do NOT duplicate full test coverage — the
//    dedicated unit tests live in their own files.
//
// WHEN TO ADD
// ===========
// After closing a new F-entry in CLAUDE.md, add a pin here with the
// minimal assertion that fails IF the fix is reverted. Update the
// F-log preface in CLAUDE.md if needed.
//
// Run with:
//   node --import tsx __tests__/unit/f-log-regression.test.ts

import {
  detectInvoiceIntent,
  detectDoubleChargeIntent,
  detectDiscountCodeIntent,
  detectPaidNotActivatedIntent,
  detectDisplayUnreadableIntent,
  detectNumericCodeIntent,
  detectFaqPause,
  hasGreetingIntent,
  parsePaymentAnswer,
} from '../../utils/intent.js'
import { TARJETA_TOPIC } from '../../utils/guards/loyalty-card-buy.js'
import {
  guardNoChangeYesButBroken,
} from '../../utils/guards/payment-no-change.js'
import { markResolved } from '../../utils/state-transitions.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── F17 — parsePaymentAnswer accent + ES vocabulary ──────────────────────
  {
    name: 'F17 — parsePaymentAnswer("sí") returns positive (accent word-end lookahead)',
    run: () => {
      const out = parsePaymentAnswer('sí')
      if (out !== true) throw new Error(`F17: "sí" must parse as positive, got ${out}`)
    },
  },
  {
    name: 'F17 — parsePaymentAnswer("aun no") returns negative (ES vocab)',
    run: () => {
      const out = parsePaymentAnswer('aun no')
      if (out !== false) throw new Error(`F17: "aun no" must parse as negative, got ${out}`)
    },
  },

  // ── F18 — hasGreetingIntent multi-lang ───────────────────────────────────
  {
    name: 'F18 — hasGreetingIntent("buenos días") → true (ES accent)',
    run: () => {
      if (!hasGreetingIntent('buenos días')) {
        throw new Error('F18: "buenos días" must be detected as greeting')
      }
    },
  },

  // ── F19 — detectDoubleChargeIntent ES plural preterito ───────────────────
  {
    name: 'F19 — detectDoubleChargeIntent("me cobraron dos veces") → true (ES plural preterito)',
    run: () => {
      if (!detectDoubleChargeIntent('me cobraron dos veces')) {
        throw new Error('F19: ES plural preterito "cobraron" must match')
      }
    },
  },

  // ── F20 — detectDisplayUnreadableIntent expanded ─────────────────────────
  {
    name: 'F20 — detectDisplayUnreadableIntent("pantalla apagada") → true',
    run: () => {
      if (!detectDisplayUnreadableIntent('pantalla apagada')) {
        throw new Error('F20: "pantalla apagada" must match display-unreadable')
      }
    },
  },

  // ── F21 — detectNumericCodeIntent extended ───────────────────────────────
  {
    name: 'F21 — detectNumericCodeIntent("Mi código es 123456") returns numeric value',
    run: () => {
      const out = detectNumericCodeIntent('Mi código es 123456')
      if (out !== '123456') {
        throw new Error(`F21: "Mi código es 123456" must extract "123456", got ${out}`)
      }
    },
  },

  // ── F22 — detectDiscountCodeIntent extended articles + typo ──────────────
  {
    name: 'F22 — detectDiscountCodeIntent("tengo el código") → true (article variant)',
    run: () => {
      if (!detectDiscountCodeIntent('tengo el código')) {
        throw new Error('F22: "tengo el código" must match (article "el")')
      }
    },
  },

  // ── F23 — multi-lang angry customer (covered by angry-customer.test.ts) ──
  // F24 — display-code preflight in detectPaidNotActivatedIntent ───────────
  {
    name: 'F24 — detectPaidNotActivatedIntent("aparece SEL pero no arranca") → false (display preflight)',
    run: () => {
      if (detectPaidNotActivatedIntent('aparece SEL pero no arranca')) {
        throw new Error('F24: display preflight must cede to display flow')
      }
    },
  },

  // ── F25 — TARJETA_TOPIC "descuento" + "recargarla" ───────────────────────
  {
    name: 'F25 — TARJETA_TOPIC matches "quiero la tarjeta de descuento"',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero la tarjeta de descuento')) {
        throw new Error('F25: "tarjeta de descuento" must match')
      }
    },
  },

  // ── F26-F27-F33 — escalation summary contents ─────────────────────────────
  // Covered by escalation.test.ts (heavy mock setup). Reference only here.
  // ── F28 — detectFaqPause ──────────────────────────────────────────────────
  {
    name: 'F28 — detectFaqPause("Espera, antes una pregunta: ¿cuánto cuesta lavar?") → true',
    run: () => {
      if (!detectFaqPause('Espera, antes una pregunta: ¿cuánto cuesta lavar?')) {
        throw new Error('F28: FAQ pause with marker + topic must match')
      }
    },
  },
  {
    name: 'F28 — detectFaqPause("espera un momento") → false (no FAQ topic)',
    run: () => {
      if (detectFaqPause('espera un momento')) {
        throw new Error('F28: pause marker alone (no FAQ topic) must NOT match')
      }
    },
  },

  // ── F29 — detectPaidNotActivatedIntent triggers from usecases ────────────
  {
    name: 'F29 — detectPaidNotActivatedIntent("he pagado pero no se arranca") → true',
    run: () => {
      if (!detectPaidNotActivatedIntent('he pagado pero no se arranca')) {
        throw new Error('F29: "no se arranca" reflexive must match Caso 4')
      }
    },
  },

  // ── F30 — display-flow Phase C pivot on new display token ────────────────
  {
    name: 'F30 — display-flow.ts:guardDisplayFlowFollowUp contains Phase C pivot logic',
    run: () => {
      const filePath = path.resolve(__dirname, '../../utils/guards/display-flow.ts')
      const content = fs.readFileSync(filePath, 'utf8')
      // Phase C must clear pendingFlow + activeFlowId when a new display
      // token arrives in the customer's reply (otherwise unconditionally
      // escalates as before F30).
      if (!/F30|Phase\s+C.*pivot/i.test(content)) {
        throw new Error('F30: display-flow.ts must document Phase C pivot logic')
      }
    },
  },

  // ── F32 — rephrase prompt anti-pattern list ───────────────────────────────
  {
    name: 'F32 — rephrase.txt contains operational-detail anti-patterns (hasta oír un clic, espera 30 seg, etc.)',
    run: () => {
      const filePath = path.resolve(__dirname, '../../prompts/rephrase.txt')
      const content = fs.readFileSync(filePath, 'utf8')
      if (!/hasta\s+o[ií]r\s+un\s+clic/i.test(content)) {
        throw new Error('F32: rephrase.txt must forbid "hasta oír un clic" invention')
      }
      if (!/pegado\s+en\s+la\s+m[aá]quina/i.test(content)) {
        throw new Error('F38: rephrase.txt must forbid "pegado en la máquina" invention')
      }
    },
  },

  // ── F34 — refundFormUrl placeholder in refundFormFinal i18n ──────────────
  {
    name: 'F34 — refundFormFinal i18n contains {refundFormUrl} placeholder (all 6 langs)',
    run: () => {
      for (const lang of ['es', 'it', 'en', 'ca', 'pt', 'fr']) {
        const filePath = path.resolve(__dirname, `../../json/i18n/${lang}.json`)
        const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (!obj.refundFormFinal || !obj.refundFormFinal.includes('{refundFormUrl}')) {
          throw new Error(`F34: ${lang}.json refundFormFinal must contain {refundFormUrl} placeholder`)
        }
      }
    },
  },

  // ── F35 — invoice PII bypass + privacy disclaimer + notes field ──────────
  {
    name: 'F35 — agent.ts bypasses rephrase for pendingFlow starting with "invoice-"',
    run: () => {
      const filePath = path.resolve(__dirname, '../../agent.ts')
      const content = fs.readFileSync(filePath, 'utf8')
      if (!/isInvoiceFlow.*invoice-/.test(content) && !/pendingFlow\.startsWith\(['"]invoice-['"]\)/.test(content)) {
        throw new Error('F35: agent.ts must bypass rephrase for invoice flow (PII privacy)')
      }
    },
  },
  {
    name: 'F35 — invoiceFinal i18n contains privacy disclaimer "no se comparten con terceros" (ES)',
    run: () => {
      const filePath = path.resolve(__dirname, '../../json/i18n/es.json')
      const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      if (!obj.invoiceFinal || !/no se comparten con terceros/i.test(obj.invoiceFinal)) {
        throw new Error('F35: ES invoiceFinal must include privacy disclaimer')
      }
    },
  },

  // ── F36 — markResolved clears all escalation flags ───────────────────────
  {
    name: 'F36 — markResolved clears operatorRequested + customerNameRequested + escalationReason + pendingEscalation',
    run: () => {
      const ar = makeAr()
      ar.state.operatorRequested = true
      ar.state.customerNameRequested = true
      ar.state.escalationReason = 'previous escalation reason'
      ar.pendingEscalation = { reason: 'x', timestamp: '', state: ar.state }
      markResolved(ar)
      if (ar.state.operatorRequested !== false) throw new Error('F36: operatorRequested not cleared')
      if (ar.state.customerNameRequested !== false) throw new Error('F36: customerNameRequested not cleared')
      if (ar.state.escalationReason !== '') throw new Error('F36: escalationReason not cleared')
      if (ar.pendingEscalation !== null) throw new Error('F36: pendingEscalation not cleared')
      if (ar.state.pendingClosure !== 'resolved') throw new Error('F36: pendingClosure must be "resolved"')
    },
  },

  // ── F38 — resetIncidentDetails preserves machineType/Number ───────────────
  // Covered by post-resolution-reset.test.ts. Reference only here.

  // ── F39 — bare "Sí" in no-change-await-confirm → escalate ─────────────────
  {
    name: 'F39 — guardNoChangeYesButBroken: bare "Sí" → escalate (still-broken implicit)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'Sí')
      if (!out) throw new Error('F39: bare "Sí" must escalate (Caso 4.2)')
      if (ar.state.pendingFlow !== '') throw new Error('F39: pendingFlow must be cleared on escalate')
    },
  },
  {
    name: 'F39 — guardNoChangeYesButBroken: "Sí, ahora arranca" → null (resolution exception)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'Sí, ahora arranca')
      if (out !== null) throw new Error('F39: explicit resolution must NOT escalate')
    },
  },

  // ── F40 — PUSH PROG reply has 4-program bullet list in bold ──────────────
  {
    name: 'F40 — washer_hs60xx.json case_push contains **60º** / **40º** / **30º** / **FRÍO** in bullet list',
    run: () => {
      const filePath = path.resolve(__dirname, '../../json/washer_hs60xx.json')
      const content = fs.readFileSync(filePath, 'utf8')
      const obj = JSON.parse(content)
      const pushPrompt = obj?.non_parte?.case_push?.prompt
      if (!pushPrompt) throw new Error('F40: case_push prompt not found in washer JSON')
      if (!pushPrompt.includes('**60º**')) throw new Error('F40: missing **60º** in case_push')
      if (!pushPrompt.includes('**40º**')) throw new Error('F40: missing **40º** in case_push')
      if (!pushPrompt.includes('**30º**')) throw new Error('F40: missing **30º** in case_push')
      if (!pushPrompt.includes('**FRÍO**')) throw new Error('F40/F41: missing **FRÍO** in case_push (capital)')
      // Bullet list marker
      if (!/\n-\s+\*\*/.test(pushPrompt)) throw new Error('F40: case_push must use markdown bullet list')
    },
  },

  // ── F41 — rephrase bypass when reply contains markdown bullet+bold ───────
  {
    name: 'F41 — agent.ts contains hasFormattedBulletList bypass detection',
    run: () => {
      const filePath = path.resolve(__dirname, '../../agent.ts')
      const content = fs.readFileSync(filePath, 'utf8')
      if (!/hasFormattedBulletList/.test(content)) {
        throw new Error('F41: agent.ts must declare hasFormattedBulletList bypass variable')
      }
      if (!/\\n-\\s\+\\\*\\\*/.test(content)) {
        throw new Error('F41: agent.ts must contain bullet+bold detection regex /\\n-\\s+\\*\\*/')
      }
    },
  },

  // ── F42 — invoice flow has invoice-ask-coste step ────────────────────────
  {
    name: 'F42 — invoice-flow.ts contains "invoice-ask-coste" case',
    run: () => {
      const filePath = path.resolve(__dirname, '../../utils/guards/invoice-flow.ts')
      const content = fs.readFileSync(filePath, 'utf8')
      if (!/case\s+['"]invoice-ask-coste['"]/.test(content)) {
        throw new Error('F42: invoice-flow.ts must contain case "invoice-ask-coste"')
      }
    },
  },
  {
    name: 'F42 — invoiceAskCoste i18n key exists in all 6 languages',
    run: () => {
      for (const lang of ['es', 'it', 'en', 'ca', 'pt', 'fr']) {
        const filePath = path.resolve(__dirname, `../../json/i18n/${lang}.json`)
        const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (!obj.invoiceAskCoste) {
          throw new Error(`F42: invoiceAskCoste missing in ${lang}.json`)
        }
      }
    },
  },

  // ── F43 — detectInvoiceIntent matches receipt synonyms ───────────────────
  {
    name: 'F43 — detectInvoiceIntent("puedo recibir el recibo?") → true (ES synonym)',
    run: () => {
      if (!detectInvoiceIntent('puedo recibir el recibo?')) {
        throw new Error('F43: "recibo" synonym must match invoice intent')
      }
    },
  },
  {
    name: 'F43 — detectInvoiceIntent("teneis el comprobante?") → true (ES synonym)',
    run: () => {
      if (!detectInvoiceIntent('teneis el comprobante?')) {
        throw new Error('F43: "comprobante" synonym must match invoice intent')
      }
    },
  },
  {
    name: 'F43 — detectInvoiceIntent("voy a recibir un paquete") → false (verb, not noun)',
    run: () => {
      if (detectInvoiceIntent('voy a recibir un paquete')) {
        throw new Error('F43: verb "recibir" alone must NOT match (only noun "recibo")')
      }
    },
  },

  // ── F45 — runtime hot-reload cache + in-place mutation (dev UX) ──────────
  // Full behavioral assertions in __tests__/unit/runtime-hot-reload.test.ts.
  // Here we pin only the architectural invariant: the exported functions
  // exist and runtime.ts uses module-level caching (presence check on source).
  {
    name: 'F45 — utils/runtime.ts exports reloadRuntimeFromDisk + watchRuntimeFilesForDev',
    run: () => {
      const filePath = path.resolve(__dirname, '../../utils/runtime.ts')
      const content = fs.readFileSync(filePath, 'utf8')
      if (!/export\s+async\s+function\s+reloadRuntimeFromDisk/.test(content)) {
        throw new Error('F45: runtime.ts must export reloadRuntimeFromDisk()')
      }
      if (!/export\s+function\s+watchRuntimeFilesForDev/.test(content)) {
        throw new Error('F45: runtime.ts must export watchRuntimeFilesForDev()')
      }
      if (!/let\s+cachedRuntime/.test(content)) {
        throw new Error('F45: runtime.ts must declare module-level cachedRuntime')
      }
    },
  },

  // ── F44 — TARJETA_TOPIC matches verb+adjective variants ──────────────────
  {
    name: 'F44 — TARJETA_TOPIC matches "quiero comprar una nueva tarjeta" (real customer chat)',
    run: () => {
      if (!TARJETA_TOPIC.test('quiero comprar una nueva tarjeta')) {
        throw new Error('F44: verb+adjective intermediates must not break match')
      }
    },
  },
  {
    name: 'F44 — TARJETA_TOPIC matches "necesito sacar la tarjeta"',
    run: () => {
      if (!TARJETA_TOPIC.test('necesito sacar la tarjeta')) {
        throw new Error('F44: action verb "sacar" must be accepted')
      }
    },
  },
]

async function main(): Promise<void> {
  await loadTestRuntime()
  let passed = 0
  let failed = 0
  const failures: Array<{ name: string; reason: string }> = []
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      failures.push({ name: c.name, reason })
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) {
    console.log('\x1b[31mF-log regressions detected. See CLAUDE.md → Architectural fixes log for each F-number.\x1b[0m\n')
    process.exit(1)
  }
}

main()
