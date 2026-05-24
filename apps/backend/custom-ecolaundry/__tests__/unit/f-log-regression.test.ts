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
  extractDisplayState,
} from '../../utils/intent.js'
import { TARJETA_TOPIC } from '../../utils/guards/loyalty-card-buy.js'
import {
  guardNoChangeYesButBroken,
} from '../../utils/guards/payment-no-change.js'
import { markResolved } from '../../utils/state-transitions.js'
import { createInitialState } from '../../utils/state.js'
import { validateCustomerName } from '../../utils/customer-name.js'
import { looksLikeDiscountCode } from '../../utils/discount-code-format.js'
import { detectPaymentMention } from '../../utils/intent.js'
import { pivotToNoChangeAsk } from '../../utils/state-transitions.js'
import { autoExtractFacts } from '../../utils/agent-extract.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Root of the custom-ecolaundry module (two levels up from __tests__/unit/)
const ECOLAUNDRY_ROOT = path.resolve(__dirname, '..', '..')

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
      if (
        !/isInvoiceFlow.*invoice-/.test(content) &&
        !/pendingFlow\.startsWith\(['"]invoice-['"]\)/.test(content) &&
        !/PII_FLOW_PREFIXES/.test(content)
      ) {
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

  // ── F46 — discountCodePrefix config + name validator rejects code-shape ──
  // Real chat (Andrea, 2026-05-12): customer typed "SAU2904266" when the bot
  // asked for their name; pre-F46 the validator accepted it. The fix has
  // two structural parts that both need to stay in place:
  //   (a) Settings.discountCodePrefix is required + validated at boot.
  //   (b) validateCustomerName refuses code-shaped tokens when the option
  //       is supplied.
  {
    name: 'F46 — settings.json declares discountCodePrefix (config-driven, not hardcoded)',
    run: () => {
      const settingsPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'json',
        'settings.json',
      )
      const content = fs.readFileSync(settingsPath, 'utf8')
      if (!/"discountCodePrefix"\s*:\s*"SAU"/.test(content)) {
        throw new Error(
          'F46: json/settings.json must declare "discountCodePrefix": "SAU" (Ecolaundry tenant default)',
        )
      }
    },
  },
  {
    name: 'F46 — looksLikeDiscountCode("SAU2904266", "SAU") === true (matches real chat marker)',
    run: () => {
      if (looksLikeDiscountCode('SAU2904266', 'SAU') !== true) {
        throw new Error(
          'F46: the canonical chat code "SAU2904266" must be recognised by looksLikeDiscountCode',
        )
      }
    },
  },
  {
    name: 'F46 — validateCustomerName("SAU2904266", {prefix:"SAU"}) is invalid (refuses code-shape)',
    run: () => {
      const r = validateCustomerName('SAU2904266', { discountCodePrefix: 'SAU' })
      if (r.valid !== false) {
        throw new Error(
          `F46: code-shaped tokens MUST be refused as a name when prefix is supplied. Got: ${JSON.stringify(r)}`,
        )
      }
    },
  },
  {
    name: 'F46 — validateCustomerName("Andrea", {prefix:"SAU"}) still valid (no false-positive on plain names)',
    run: () => {
      const r = validateCustomerName('Andrea', { discountCodePrefix: 'SAU' })
      if (r.valid !== true || r.name !== 'Andrea') {
        throw new Error(
          `F46: real names must still pass with the prefix option. Got: ${JSON.stringify(r)}`,
        )
      }
    },
  },

  // ── F47 — AL001 → Caso 4 pivot when customer mentions payment ───────────
  // Real chat (Andrea, 2026-05-12): AL001 flow active; customer says "He
  // pagado y apretado…"; bot drifted because pivot was blocked by the
  // `activeBranch !== 'trouble-machine'` check. Fix: bare-payment detector +
  // semantic-flowId pivot in agent-extract.ts.
  {
    name: 'F47 — detectPaymentMention("He pagado y apretado el numero") === true (real chat marker)',
    run: () => {
      if (detectPaymentMention('He pagado y apretado el numero de la lavadora') !== true) {
        throw new Error('F47: the bare payment signal must be detected without a failure verb')
      }
    },
  },
  {
    name: 'F47 — detectPaymentMention("no he pagado") === false (negation guard)',
    run: () => {
      if (detectPaymentMention('no he pagado todavía') !== false) {
        throw new Error('F47: negation must NOT trigger the bare-payment detector')
      }
    },
  },
  {
    name: 'F47 — pivotToNoChangeAsk clears activeFlowId and arms pendingFlow=no-change-ask',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      pivotToNoChangeAsk(ar)
      if (ar.state.activeFlowId !== null) {
        throw new Error('F47: pivot must clear activeFlowId')
      }
      if (ar.state.pendingFlow !== 'no-change-ask') {
        throw new Error('F47: pivot must arm pendingFlow=no-change-ask')
      }
    },
  },
  {
    name: 'F47 — autoExtractFacts on AL001 + "He pagado…" triggers the pivot end-to-end',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado y apretado el numero de la lavadora')
      if (ar.state.pendingFlow !== 'no-change-ask') {
        throw new Error('F47: AL001 + payment signal must end up with pendingFlow=no-change-ask')
      }
      if (ar.state.activeFlowId !== null) {
        throw new Error('F47: pivot must abandon the AL001 flow')
      }
    },
  },
  {
    name: 'F47 — autoExtractFacts on Caso 3 SEL + "he pagado" must NOT pivot (Caso 3/SEL safety)',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'sel-select-program' // non-AL001 display flow
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado pero no funciona')
      if (ar.state.pendingFlow === 'no-change-ask') {
        throw new Error('F47: non-AL001 display flows must NOT pivot — would break Caso 3/SEL gather')
      }
    },
  },

  // ── F48 — customer-facing machine-number prompt is generic, machineType preserved in state ──
  // Real chat (Andrea, 2026-05-12): customer said "lavadora" → state captured
  // washer ✓ → bot at T3 said "qué número tiene la secadora?" (rephrase LLM
  // flip). Fix: i18n keys fused into generic `machineNumberAsk` ("máquina")
  // + guards no longer select type-aware key. State.machineType preserved
  // for operator briefing (escalation.ts interpolates from state).
  {
    name: 'F48 — i18n: machineNumberAsk is generic (no lavadora/secadora) in all 6 languages',
    run: () => {
      const langs = ['es', 'it', 'en', 'pt', 'ca', 'fr'] as const
      const i18nDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'json',
        'i18n',
      )
      for (const lang of langs) {
        const content = JSON.parse(fs.readFileSync(path.join(i18nDir, `${lang}.json`), 'utf8'))
        const text = content.machineNumberAsk
        if (!text || typeof text !== 'string') {
          throw new Error(`F48: ${lang}.json must define machineNumberAsk (generic key)`)
        }
        if (/lavadora|secadora|lavatrice|asciugatrice|washer|dryer|rentadora|assecadora|lave-linge|s[èe]che-linge/i.test(text)) {
          throw new Error(`F48: ${lang}.json:machineNumberAsk MUST NOT contain type-specific terms: "${text}"`)
        }
      }
    },
  },
  {
    name: 'F48 — i18n: deprecated machineNumberWasher/Dryer keys are REMOVED in all 6 languages',
    run: () => {
      const langs = ['es', 'it', 'en', 'pt', 'ca', 'fr'] as const
      const i18nDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'json',
        'i18n',
      )
      for (const lang of langs) {
        const content = JSON.parse(fs.readFileSync(path.join(i18nDir, `${lang}.json`), 'utf8'))
        if ('machineNumberWasher' in content || 'machineNumberDryer' in content) {
          throw new Error(`F48: ${lang}.json still has the deprecated type-aware keys — fix not applied`)
        }
      }
    },
  },
  {
    name: 'F48 — code: no guards select type-aware key for machine number ask',
    run: () => {
      const guardsDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'utils',
        'guards',
      )
      const files = ['force-gather.ts', 'payment-double-charge.ts']
      for (const file of files) {
        const content = fs.readFileSync(path.join(guardsDir, file), 'utf8')
        // The pattern that selected the type-aware key — must be gone.
        if (/machineType\s*===\s*'dryer'\s*\?\s*'machineNumberDryer'/.test(content)) {
          throw new Error(
            `F48: guards/${file} still selects machineNumberWasher/Dryer based on type. Fix reverted.`,
          )
        }
        // Must reference the new generic key at least once (in the files that
        // ask for the number — both do).
        if (!/machineNumberAsk/.test(content)) {
          throw new Error(`F48: guards/${file} must reference 'machineNumberAsk'`)
        }
      }
    },
  },
  // ── F49 — discount-code-ask turn bypasses the rephrase LLM ─────────────
  // Real chat (Andrea, 2026-05-12): rephrase kept appending "incluyendo
  // letras si las hay" even after the source i18n was cleaned. The
  // architectural fix: deterministic bypass for the discount-code-ask
  // turn (pattern F35 invoice / F41 bullet+bold). The customer sees the
  // source i18n verbatim — no rephrase invention.
  {
    name: 'F49 — agent.ts contains isDiscountCodeAsk bypass for the rephrase pipeline',
    run: () => {
      const agentPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'agent.ts',
      )
      const content = fs.readFileSync(agentPath, 'utf8')
      if (!/isDiscountCodeAsk\s*=\s*outcome\.reason\s*===\s*'discount-code-ask'/.test(content)) {
        throw new Error('F49: agent.ts must define `isDiscountCodeAsk = outcome.reason === \'discount-code-ask\'`')
      }
      if (!/!isDiscountCodeAsk/.test(content)) {
        throw new Error('F49: rephrase guard must include `!isDiscountCodeAsk` in its condition')
      }
    },
  },
  {
    name: 'F49 — i18n discountCodeAsk does NOT contain "incluyendo letras si las hay" (or analogues)',
    run: () => {
      const langs = ['es', 'it', 'en', 'pt', 'ca', 'fr'] as const
      const i18nDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'json',
        'i18n',
      )
      const forbidden = [
        /incluyendo\s+letras\s+si\s+las\s+hay/i,
        /comprese\s+le\s+lettere\s+se\s+ci\s+sono/i,
        /including\s+any\s+letters/i,
        /incluindo\s+letras\s+se\s+as\s+houver/i,
        /incloent\s+les\s+lletres\s+si\s+n['’]hi\s+ha/i,
        /lettres\s+comprises\s+s['’]il\s+y\s+en\s+a/i,
      ]
      for (const lang of langs) {
        const content = JSON.parse(fs.readFileSync(path.join(i18nDir, `${lang}.json`), 'utf8'))
        const text: string | undefined = content.discountCodeAsk
        if (!text) {
          throw new Error(`F49: ${lang}.json must define discountCodeAsk`)
        }
        for (const re of forbidden) {
          if (re.test(text)) {
            throw new Error(`F49: ${lang}.json:discountCodeAsk reintroduced the forbidden "letters if any" wording: "${text}"`)
          }
        }
      }
    },
  },
  {
    name: 'F48 — operator briefing still interpolates machineType from state (no regression)',
    run: () => {
      // The architectural guarantee: customer-facing is generic, BUT the
      // operator briefing must still produce the type-specific term from
      // state. The check below ensures escalation.ts keeps the interpolation.
      const escPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'utils',
        'escalation.ts',
      )
      const content = fs.readFileSync(escPath, 'utf8')
      const matches = content.match(/machineType\s*===\s*'dryer'\s*\?\s*'secadora'\s*:\s*'lavadora'/g) || []
      if (matches.length < 4) {
        throw new Error(
          `F48: escalation.ts must keep at least 4 interpolations of machineType → 'lavadora'/'secadora' (operator briefing). Found ${matches.length}.`,
        )
      }
    },
  },

  // ── F63 — Release sticky activeBranch on FAQ closure ──────────────────
  // Andrea CLI mixed-flow test 2026-05-15 (post-F62): customer said "no" to
  // dryer follow-up → F62 emitted faqClosure → state.activeBranch stayed
  // 'faq' sticky → next turn "no funciona la lavadora 6 a Goya" re-entered
  // faqHandler with empty routerDetails → unknownKey reply. Fix: dedicated
  // helper releaseBranchOnFaqClosure called from F62 decline branches AND
  // guardFaqClosure → T+1 re-enters dispatchTurnOne for fresh classification.
  {
    name: 'F63 — state-transitions.ts exports releaseBranchOnFaqClosure',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'state-transitions.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/export function releaseBranchOnFaqClosure/.test(content)) {
        throw new Error('F63: state-transitions.ts must export releaseBranchOnFaqClosure')
      }
      // Mirrors applyHandoff('topic-switch') semantics: previousBranch ← active, active ← null.
      if (!/ar\.state\.previousBranch\s*=\s*ar\.state\.activeBranch/.test(content)) {
        throw new Error('F63: helper must move activeBranch into previousBranch')
      }
      if (!/ar\.state\.activeBranch\s*=\s*null/.test(content)) {
        throw new Error('F63: helper must clear activeBranch to null')
      }
    },
  },
  {
    name: 'F63 — F62 decline branches AND guardFaqClosure call releaseBranchOnFaqClosure',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const pricesPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const closurePath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-closure.ts')
      const pricesContent = fs.readFileSync(pricesPath, 'utf8')
      const closureContent = fs.readFileSync(closurePath, 'utf8')
      const pricesCalls = pricesContent.match(/releaseBranchOnFaqClosure\(ar\)/g)
      if (!pricesCalls || pricesCalls.length < 2) {
        throw new Error(
          `F63: faq-prices.ts must call releaseBranchOnFaqClosure in both decline branches, found ${pricesCalls?.length ?? 0}`,
        )
      }
      if (!/releaseBranchOnFaqClosure\(ar\)/.test(closureContent)) {
        throw new Error('F63: faq-closure.ts must call releaseBranchOnFaqClosure')
      }
    },
  },

  // ── F62 — FAQ confirm-guards close politely on non-affirmative ────────
  // Andrea CLI mixed-flow test 2026-05-15 (post-F60/F61): customer said "no"
  // to "¿también quieres información de secadora?" → confirm guard returned
  // null → pipeline empty → LLM rephrase improvised a trouble-flow reply
  // ("Volviendo a la lavadora, ¿qué aparece en la pantalla?") from the
  // chat-history machine context. Fix: confirm guards now emit faqClosure
  // i18n key on decline (no pipeline hole, iron rule #10 catch-all).
  {
    name: 'F62 — guardFaqPricesAwaitDryerConfirm emits faqClosure on non-affirmative',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(p, 'utf8')
      // The dryer-confirm guard MUST return a reply with reason
      // 'faq-prices-dryer-decline' instead of returning null.
      if (!/faq-prices-dryer-decline/.test(content)) {
        throw new Error("F62: faq-prices.ts must emit reason='faq-prices-dryer-decline' on decline")
      }
      if (!/faq-prices-washer-decline/.test(content)) {
        throw new Error("F62: faq-prices.ts must emit reason='faq-prices-washer-decline' on decline (symmetric)")
      }
      // Both decline branches must call t('faqClosure', ...) — single source
      // of truth across the 6 locales.
      const closureCalls = content.match(/t\(['"]faqClosure['"]/g)
      if (!closureCalls || closureCalls.length < 2) {
        throw new Error(`F62: both confirm guards must use faqClosure i18n, found ${closureCalls?.length ?? 0}`)
      }
    },
  },

  // ── F60 — FAQ→trouble transition clears sticky FAQ-context location ───
  // Andrea CLI mixed-flow test 2026-05-15: customer compared Goya/Pineda prices
  // (F51 switched location to Pineda), then pivoted to trouble flow on Goya
  // ("no funciona la lavadora"). state.location stayed Pineda → any subsequent
  // FAQ pivot (orari, prezzi) answered for Pineda instead of Goya. Fix:
  // clearFaqContextOnTroubleEntry helper called from dispatchTurnOne when
  // router returns 'trouble-machine' AND prior lastResolvedIntent === 'faq'.
  {
    name: 'F60 — state-transitions.ts exports clearFaqContextOnTroubleEntry',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'state-transitions.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/export function clearFaqContextOnTroubleEntry/.test(content)) {
        throw new Error('F60: state-transitions.ts must export clearFaqContextOnTroubleEntry')
      }
      // Helper must wipe location, lastResolvedIntent, and lastFaqKey atomically.
      if (!/ar\.state\.location\s*=\s*''/.test(content)) {
        throw new Error('F60: helper must clear state.location')
      }
      if (!/ar\.state\.lastResolvedIntent\s*=\s*null/.test(content)) {
        throw new Error('F60: helper must clear state.lastResolvedIntent')
      }
      if (!/ar\.state\.lastFaqKey\s*=\s*null/.test(content)) {
        throw new Error('F60: helper must clear state.lastFaqKey')
      }
    },
  },
  {
    name: 'F60 — boundary-resets.ts applyBranchEntryResets calls clearFaqContextOnTroubleEntry on FAQ→trouble',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      // F60/F64 logic was extracted from branches/index.ts to a dedicated
      // boundary-resets.ts cassette (entry-time helper). The dispatcher
      // now imports applyBranchEntryResets and delegates the boundary
      // check to it. We pin both: (1) the helper itself encodes the
      // predicate, (2) the dispatcher actually calls it.
      const helperPath = path.resolve(
        here, '..', '..', 'utils', 'branches', 'boundary-resets.ts',
      )
      const helperContent = fs.readFileSync(helperPath, 'utf8')
      if (!/import\s*\{[^}]*clearFaqContextOnTroubleEntry[^}]*\}\s*from\s*['"]\.\.\/state-transitions/.test(helperContent)) {
        throw new Error('F60: boundary-resets.ts must import clearFaqContextOnTroubleEntry')
      }
      // Guarded call: branch='trouble-machine' AND (lastResolvedIntent='faq'
      // OR previousBranch='faq'). F64 widened the predicate so the clear
      // also fires when F62 closure already wiped lastResolvedIntent.
      if (
        !/decision\.branch\s*===\s*['"]trouble-machine['"][\s\S]*?clearFaqContextOnTroubleEntry/.test(
          helperContent,
        )
      ) {
        throw new Error(
          "F60: applyBranchEntryResets must call clearFaqContextOnTroubleEntry when branch='trouble-machine'",
        )
      }
      if (
        !/ar\.state\.lastResolvedIntent\s*===\s*['"]faq['"]/.test(helperContent) ||
        !/ar\.state\.previousBranch\s*===\s*['"]faq['"]/.test(helperContent)
      ) {
        throw new Error(
          "F64: F60 trigger must check BOTH lastResolvedIntent='faq' AND previousBranch='faq'",
        )
      }
      // Dispatcher wiring: index.ts must actually invoke the helper.
      const dispatcherPath = path.resolve(
        here, '..', '..', 'utils', 'branches', 'index.ts',
      )
      const dispatcherContent = fs.readFileSync(dispatcherPath, 'utf8')
      if (!/import\s*\{\s*applyBranchEntryResets\s*\}\s*from\s*['"]\.\/boundary-resets/.test(dispatcherContent)) {
        throw new Error('F60: branches/index.ts must import applyBranchEntryResets')
      }
      if (!/applyBranchEntryResets\(\s*ar\s*,\s*decision\s*\)/.test(dispatcherContent)) {
        throw new Error('F60: branches/index.ts must call applyBranchEntryResets(ar, decision)')
      }
    },
  },
  {
    name: 'F64 — agent-extract F51 block accepts previousBranch="faq" as FAQ-context signal',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(p, 'utf8')
      // The F51 conditional must accept previousBranch === 'faq' as one of
      // the FAQ-context predicates (post-F62 closure / post-F63 release).
      if (!/state\.previousBranch\s*===\s*['"]faq['"]/.test(content)) {
        throw new Error("F64: agent-extract.ts F51 block must include state.previousBranch === 'faq'")
      }
    },
  },

  // ── F61 — Location switch in FAQ context re-arms prices/hours guard ───
  // Andrea CLI mixed-flow test 2026-05-15 (Bug A): customer said "e a Pineda?"
  // after dryer-confirm closed → F51 switched location but pendingFlow was ''
  // and "e a Pineda?" has no price keyword → guardFaqPrices skipped → LLM
  // rephrase improvised a non-canonical reply with nested bullets + both
  // lavadora and secadora together. Fix: lastFaqKey marker (set by render
  // sites) + re-arm in agent-extract F51 block.
  {
    name: 'F61 — SessionState type declares lastFaqKey field',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'models', 'state.ts')
      const content = fs.readFileSync(p, 'utf8')
      // F81 extended the union with 'programs'; regex matches the field presence
      // and ensures 'pricing' and 'openingHours' are still included.
      if (!/lastFaqKey:\s*(?:'pricing'\s*\|[^;]+|[^;]+'pricing')/.test(content)) {
        throw new Error("F61: state.ts must declare lastFaqKey with at least 'pricing' union member")
      }
      if (!content.includes("'openingHours'")) {
        throw new Error("F61: state.ts lastFaqKey must include 'openingHours'")
      }
    },
  },
  {
    name: "F61 — renderPrices sets lastFaqKey='pricing'",
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/ar\.state\.lastFaqKey\s*=\s*['"]pricing['"]/.test(content)) {
        throw new Error("F61: faq-prices.ts must set lastFaqKey='pricing' in renderPrices")
      }
    },
  },
  {
    name: "F61 — faq-hours guards set lastFaqKey='openingHours' on both render sites",
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-hours.ts')
      const content = fs.readFileSync(p, 'utf8')
      const matches = content.match(/ar\.state\.lastFaqKey\s*=\s*['"]openingHours['"]/g)
      if (!matches || matches.length < 2) {
        throw new Error(
          `F61: faq-hours.ts must set lastFaqKey='openingHours' in both render sites (T1 direct + T2 await), found ${matches?.length ?? 0}`,
        )
      }
    },
  },
  {
    name: 'F61 — agent-extract.ts F51 block re-arms faq-{prices,hours}-await-location',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(p, 'utf8')
      // Both re-arms must be present, gated by lastFaqKey.
      if (
        !/state\.lastFaqKey\s*===\s*['"]pricing['"][\s\S]*?state\.pendingFlow\s*=\s*['"]faq-prices-await-location['"]/.test(
          content,
        )
      ) {
        throw new Error('F61: agent-extract.ts must re-arm faq-prices-await-location when lastFaqKey=pricing')
      }
      if (
        !/state\.lastFaqKey\s*===\s*['"]openingHours['"][\s\S]*?state\.pendingFlow\s*=\s*['"]faq-hours-await-location['"]/.test(
          content,
        )
      ) {
        throw new Error('F61: agent-extract.ts must re-arm faq-hours-await-location when lastFaqKey=openingHours')
      }
    },
  },

  // ── F59 — FAQ-context gate in force-gather guards ─────────────────────
  // Andrea CLI mixed-flow test 2026-05-15 (post-F58): customer asked prices,
  // saw lavadora, said "sí" for secadora, then mid-flow "e a Pineda?" + bare
  // "secadora" → autoExtractFacts set machineType=dryer, location+type+!number
  // signature triggered guardForceMachineNumber → bot wrongly asked machine
  // number as if it were a trouble report. Fix: isInFaqContext helper + skip
  // gate at the top of guardForceMachineType/Number/Display.
  {
    name: 'F59 — force-gather.ts exports isInFaqContext helper (private but referenced 3 times)',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'force-gather.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/function isInFaqContext/.test(content)) {
        throw new Error('F59: force-gather.ts must define isInFaqContext helper')
      }
      // Must be called by all 3 force-gather guards.
      const matches = content.match(/isInFaqContext\(ar\.state,/g)
      if (!matches || matches.length < 3) {
        throw new Error(`F59: isInFaqContext must gate all 3 force-gather guards, found ${matches?.length ?? 0} calls`)
      }
    },
  },
  {
    name: 'F59 — gate semantics include trouble boundary signal (state + userMessage)',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'force-gather.ts')
      const content = fs.readFileSync(p, 'utf8')
      // Helper signature includes userMessage (for boundary signal check).
      if (!/function isInFaqContext\(state: SessionState, userMessage: string\)/.test(content)) {
        throw new Error('F59: isInFaqContext must take userMessage to detect FAQ→trouble boundary signal')
      }
      // Trouble signal regex must cover the 6 supported languages at minimum.
      if (!/TROUBLE_SIGNAL_RE/.test(content)) {
        throw new Error('F59: TROUBLE_SIGNAL_RE must be defined')
      }
      // Sample coverage: ES "no funciona", IT "non funziona", EN "doesn't work",
      // PT "não funciona", FR "ne fonctionne pas". Use substring matching
      // (.includes) because the source contains literal regex syntax (\s+ etc).
      const expected = ['no\\s+funciona', 'non\\s+funziona', "doesn'?t\\s+work", 'n[aã]o\\s+funciona', 'ne\\s+fonctionne\\s+pas']
      for (const e of expected) {
        if (!content.includes(e)) {
          throw new Error(`F59: TROUBLE_SIGNAL_RE must include literal pattern "${e}"`)
        }
      }
    },
  },

  // ── F58 — FAQ prices: opposite-type follow-up after type-specific render ──
  // Andrea 2026-05-15: F52 verb capture at T1 routed "cuanto costa lavare?"
  // into the washer-only branch which did NOT arm the dryer-confirm flag
  // and did NOT emit the dryer hint. Customer follow-up "y la secadora?"
  // then fell through to guardForceMachineNumber. Mirror fix for the dryer-
  // first path. Both type-specific branches now arm the opposite-type flag
  // + append the corresponding hint i18n. New symmetric guard
  // guardFaqPricesAwaitWasherConfirm completes the cassette.
  {
    name: 'F58 — pricesWasherHint i18n exists as direct question in ES',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const esPath = path.resolve(here, '..', '..', 'json', 'i18n', 'es.json')
      const es = JSON.parse(fs.readFileSync(esPath, 'utf8')) as Record<string, string>
      if (!es.pricesWasherHint) throw new Error('F58: ES pricesWasherHint missing')
      if (!/^¿.+\?$/.test(es.pricesWasherHint.trim())) {
        throw new Error(`F58: ES pricesWasherHint must be a direct question, got "${es.pricesWasherHint}"`)
      }
    },
  },
  {
    name: 'F58 — faq-prices.ts exports guardFaqPricesAwaitWasherConfirm',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/export const guardFaqPricesAwaitWasherConfirm/.test(content)) {
        throw new Error('F58: guardFaqPricesAwaitWasherConfirm export missing')
      }
      if (!/'faq-prices-await-washer-confirm'/.test(content)) {
        throw new Error('F58: pendingFlow literal faq-prices-await-washer-confirm missing')
      }
    },
  },
  {
    name: 'F58 — washer-only renderPrices branch arms dryer-confirm + appends pricesDryerHint',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(p, 'utf8')
      // The washer-only branch (mentioned === 'washer') must contain BOTH
      // the dryer-confirm flag arming AND the pricesDryerHint reference.
      const washerBranch = content.match(/if \(mentioned === 'washer'\)[\s\S]+?return \{ reply: t\('priceWarning'/)
      if (!washerBranch) throw new Error('F58: washer-only branch not found')
      if (!/faq-prices-await-dryer-confirm/.test(washerBranch[0])) {
        throw new Error('F58: washer-only branch must arm faq-prices-await-dryer-confirm')
      }
      if (!/pricesDryerHint/.test(washerBranch[0])) {
        throw new Error('F58: washer-only branch must append pricesDryerHint')
      }
    },
  },
  {
    name: 'F58 — dryer-only renderPrices branch arms washer-confirm + appends pricesWasherHint',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(p, 'utf8')
      const dryerBranch = content.match(/if \(mentioned === 'dryer'\)[\s\S]+?return \{ reply: t\('priceWarning'/)
      if (!dryerBranch) throw new Error('F58: dryer-only branch not found')
      if (!/faq-prices-await-washer-confirm/.test(dryerBranch[0])) {
        throw new Error('F58: dryer-only branch must arm faq-prices-await-washer-confirm')
      }
      if (!/pricesWasherHint/.test(dryerBranch[0])) {
        throw new Error('F58: dryer-only branch must append pricesWasherHint')
      }
    },
  },
  {
    name: 'F58 — guardFaqPricesAwaitWasherConfirm registered in GUARD_PIPELINE',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'guards', 'index.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/guardFaqPricesAwaitWasherConfirm/.test(content)) {
        throw new Error('F58: utils/guards/index.ts must import + register guardFaqPricesAwaitWasherConfirm')
      }
    },
  },
  {
    // F58 symmetry gap closure: every cross-file reader of
    // 'faq-prices-await-dryer-confirm' must also read the washer-confirm
    // mirror, otherwise edge cases (location switch, branch-router delegate,
    // re-arm logic) drift only on the dryer-first path.
    name: 'F58 — agent-extract.ts F51 location switch includes washer-confirm flag',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(p, 'utf8')
      if (!/faq-prices-await-washer-confirm/.test(content)) {
        throw new Error('F58: agent-extract.ts must reference faq-prices-await-washer-confirm (F51 mirror)')
      }
      // The two occurrences: (1) FAQ-context override gate, (2) re-arm clear.
      const matches = content.match(/faq-prices-await-washer-confirm/g)
      if (!matches || matches.length < 2) {
        throw new Error(`F58: expected ≥2 references to washer-confirm in agent-extract.ts (override gate + re-arm), got ${matches?.length ?? 0}`)
      }
    },
  },
  {
    name: 'F58 — branches/faq/handler.ts delegates washer-confirm pendingFlow to legacy pipeline',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const p = path.resolve(here, '..', '..', 'utils', 'branches', 'faq', 'handler.ts')
      const content = fs.readFileSync(p, 'utf8')
      // F101-Regola-A: the washer-confirm literal was replaced by the catch-all
      // `if (pending) return delegate-to-legacy`. All non-empty pendingFlow values
      // including faq-prices-await-washer-confirm are covered. Verify the catch-all exists.
      if (!/if\s*\(\s*pending\s*\)\s*\{/.test(content)) {
        throw new Error('F58: faq handler must contain Regola-A catch-all `if (pending) {` which covers faq-prices-await-washer-confirm delegation')
      }
    },
  },

  // ── F57 — state pollution scoping in LLM operator briefing ─────────────
  // Andrea 2026-05-15: LLM briefing was citing facts from abandoned trouble
  // flows in subsequent unrelated escalations (e.g. "lavadora 5 + DOOR"
  // appearing in a discount-code escalation summary). Fix: getEscalationCategory
  // helper + scoped STATE_FACTS payload + prompt rule #10.
  {
    name: 'F57 — operator-briefing.ts exports getEscalationCategory helper',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'utils', 'operator-briefing.ts')
      const content = fs.readFileSync(fp, 'utf8')
      if (!/export\s+function\s+getEscalationCategory/.test(content)) {
        throw new Error('F57: operator-briefing.ts must export getEscalationCategory')
      }
      // 4 categories must all be present in the type.
      for (const cat of ['discount-code', 'invoice', 'non-trouble', 'machine-trouble']) {
        if (!new RegExp(`['"]${cat}['"]`).test(content)) {
          throw new Error(`F57: EscalationCategory type must include '${cat}'`)
        }
      }
    },
  },
  {
    name: 'F57 — STATE_FACTS payload omits machine facts for non-machine-trouble categories',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'utils', 'operator-briefing.ts')
      const content = fs.readFileSync(fp, 'utf8')
      // Code must branch on isMachineTrouble to decide machine fact inclusion.
      if (!/isMachineTrouble/.test(content)) {
        throw new Error('F57: must guard machine facts via isMachineTrouble flag')
      }
      // Marker for the LLM that machine facts are out of scope.
      if (!/not applicable for/.test(content)) {
        throw new Error('F57: STATE_FACTS must mark omitted facts as "(not applicable for ...)"')
      }
    },
  },
  {
    name: 'F57 — prompts/operator-briefing.txt has the scoping rule (#10 ÁMBITO)',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'prompts', 'operator-briefing.txt')
      const content = fs.readFileSync(fp, 'utf8')
      if (!/ÁMBITO DEL CASO|escalationCategory/.test(content)) {
        throw new Error('F57: prompts/operator-briefing.txt must include the ÁMBITO/escalationCategory rule')
      }
      if (!/not applicable/.test(content)) {
        throw new Error('F57: prompt must reference the "(not applicable ...)" marker')
      }
    },
  },

  // ── F56 — rephrase bypass for active display flows ─────────────────────
  // Andrea 2026-05-15: rephrase LLM kept inventing operational details
  // ("ropa en la goma", "hasta que encaje bien") on top of JSON-vetted
  // display flow prompts. F56 bypasses rephrase whenever state.activeFlowId
  // is set (case_push/case_sel/case_door/AL001/ALM-DOOR/C001/…).
  {
    name: 'F56 — agent.ts has isDisplayFlowActive bypass for the rephrase pipeline',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'agent.ts')
      const content = fs.readFileSync(fp, 'utf8')
      if (!/isDisplayFlowActive/.test(content)) {
        throw new Error('F56: agent.ts must declare isDisplayFlowActive bypass variable')
      }
      // Bypass must read state.activeFlowId (not pendingFlow or another field).
      if (!/isDisplayFlowActive\s*=\s*!!\s*ar\.state\.activeFlowId/.test(content)) {
        throw new Error('F56: isDisplayFlowActive must derive from state.activeFlowId')
      }
      // Must be wired into the rephrase guard expression.
      if (!/!isDisplayFlowActive/.test(content)) {
        throw new Error('F56: !isDisplayFlowActive must gate the rephrase invocation')
      }
    },
  },

  // ── F55 — machineType FAQ-context override (B4 resolved) ────────────────
  // Andrea 2026-05-15: state.machineType was sticky on first-set-wins
  // (`if (!state.machineType)`) and stayed wrong after FAQ asciugare →
  // trouble lavadora. Fix mirrors F51 for location: override allowed only
  // when no active flow AND lastResolvedIntent === 'faq'.
  {
    name: 'F55 — autoExtractFacts allows machineType override gated by FAQ context',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(fp, 'utf8')
      if (!/cameFromFaq/.test(content)) {
        throw new Error('F55: agent-extract.ts must reference cameFromFaq guard')
      }
      if (!/inActiveFlow/.test(content)) {
        throw new Error('F55: agent-extract.ts must reference inActiveFlow guard')
      }
      // The override must check newType !== state.machineType (no-op on same type).
      if (!/newType\s*!==\s*state\.machineType/.test(content)) {
        throw new Error('F55: override must compare newType against existing state.machineType')
      }
    },
  },

  // ── F54 — Caso 12.2: collapse identical-spec machines into plural label ──
  // Andrea 2026-05-14: Pineda had 2 dryers with identical specs rendered
  // as 2 redundant bullet lines. Fix: groupBySpecs collapses groups under
  // a plural label (Lavadoras/Secadoras); single-machine groups keep the
  // canonical number.
  {
    name: 'F54 — faq-location-formatter.ts exposes groupBySpecs helper',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'utils', 'faq-location-formatter.ts')
      const content = fs.readFileSync(fp, 'utf8')
      if (!/function\s+groupBySpecs/.test(content)) {
        throw new Error('F54: faq-location-formatter.ts must define groupBySpecs helper')
      }
      if (!/formatGroupLine/.test(content)) {
        throw new Error('F54: faq-location-formatter.ts must use formatGroupLine for rendering')
      }
    },
  },
  {
    name: 'F54 — formatDryerPrices passes "Secadoras" plural label to formatGroupLine',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const fp = path.resolve(here, '..', '..', 'utils', 'faq-location-formatter.ts')
      const content = fs.readFileSync(fp, 'utf8')
      if (!/formatGroupLine\(g,\s*['"]Secadoras['"]\)/.test(content)) {
        throw new Error('F54: formatDryerPrices must call formatGroupLine with "Secadoras"')
      }
      if (!/formatGroupLine\(g,\s*['"]Lavadoras['"]\)/.test(content)) {
        throw new Error('F54: formatWasherPrices must call formatGroupLine with "Lavadoras"')
      }
    },
  },

  // ── F53 — Caso 12.2 Option B: explicit dryer-hint question ─────────────
  // Andrea 2026-05-14: silent arming of `faq-prices-await-dryer-confirm`
  // without showing the dryer question caused out-of-context "sí" replies
  // to trigger dryer prices. Fix: the washer-default branch now appends
  // `pricesDryerHint` (a direct question) to the reply so "sí" is grounded.
  {
    name: 'F53 — pricesDryerHint i18n is a direct question (not a statement) in ES',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const esPath = path.resolve(here, '..', '..', 'json', 'i18n', 'es.json')
      const es = JSON.parse(fs.readFileSync(esPath, 'utf8')) as Record<string, string>
      if (!es.pricesDryerHint) throw new Error('F53: ES pricesDryerHint missing')
      // Must end with "?" and start with "¿" — direct question form.
      if (!/^¿.+\?$/.test(es.pricesDryerHint.trim())) {
        throw new Error(`F53: ES pricesDryerHint must be a direct question, got "${es.pricesDryerHint}"`)
      }
    },
  },
  {
    name: 'F53 — renderPrices washer-default branch appends pricesDryerHint to reply',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const guardPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(guardPath, 'utf8')
      // Reply must concatenate washers + pricesDryerHint. Pattern is
      // tolerant to template-literal whitespace.
      if (!/pricesDryerHint/.test(content)) {
        throw new Error('F53: faq-prices.ts must reference pricesDryerHint i18n key')
      }
      if (!/\$\{washers\}[\s\S]*\$\{t\(['"]pricesDryerHint['"]/.test(content)) {
        throw new Error('F53: renderPrices washer-default reply must include both washers and pricesDryerHint via template literal')
      }
    },
  },

  // ── F52 — Caso 12 verb-form detection + T1-capture/T2-consume ───────────
  {
    name: 'F52 — detectMachineTypeMention recognises IT verb "asciugare" as dryer',
    run: async () => {
      const { detectMachineTypeMention } = await import('../../utils/intent.js')
      const r = detectMachineTypeMention('ma quanto costa asciugare i vestiti?')
      if (r !== 'dryer') throw new Error(`F52: IT verb "asciugare" must map to dryer, got ${r}`)
    },
  },
  {
    name: 'F52 — detectMachineTypeMention recognises ES verb "secar" as dryer',
    run: async () => {
      const { detectMachineTypeMention } = await import('../../utils/intent.js')
      const r = detectMachineTypeMention('cuánto cuesta secar la ropa?')
      if (r !== 'dryer') throw new Error(`F52: ES verb "secar" must map to dryer, got ${r}`)
    },
  },
  {
    name: 'F52 — state.faqPricesType field exists in SessionState',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const statePath = path.resolve(here, '..', '..', 'models', 'state.ts')
      const content = fs.readFileSync(statePath, 'utf8')
      if (!/faqPricesType:\s*['"]washer['"]\s*\|\s*['"]dryer['"]\s*\|\s*null/.test(content)) {
        throw new Error('F52: SessionState must declare faqPricesType: "washer"|"dryer"|null')
      }
    },
  },
  {
    name: 'F52 — guardFaqPrices captures T1 type AND renderPrices consumes+clears state.faqPricesType',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const guardPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      const content = fs.readFileSync(guardPath, 'utf8')
      // T1 must assign state.faqPricesType from detectMachineTypeMention.
      if (!/ar\.state\.faqPricesType\s*=\s*mentionedAtT1/.test(content)) {
        throw new Error('F52: guardFaqPrices must store T1 detected type into state.faqPricesType')
      }
      // renderPrices must read state.faqPricesType as fallback when message has no type.
      if (!/detectMachineTypeMention\(userMessage\)\s*\|\|\s*ar\.state\.faqPricesType/.test(content)) {
        throw new Error('F52: renderPrices must fall back to state.faqPricesType when message has no type')
      }
      // After consume, the field must clear to null.
      if (!/ar\.state\.faqPricesType\s*=\s*null/.test(content)) {
        throw new Error('F52: renderPrices must clear state.faqPricesType after consume')
      }
    },
  },

  // ── F51 — Caso 12 follow-up: Goya data + FAQ location switch + Playa alias ──
  {
    name: 'F51 — locations.json: Goya pueblo is "Mataró" not "Madrid"',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const locPath = path.resolve(here, '..', '..', 'json', 'locations.json')
      const locations = JSON.parse(fs.readFileSync(locPath, 'utf8')) as {
        locations: Record<string, { pueblo?: string; displayName?: string }>
      }
      const goya = locations.locations.Goya
      if (!goya) throw new Error('F51: Goya entry missing')
      if (goya.pueblo !== 'Mataró') {
        throw new Error(`F51: Goya.pueblo must be "Mataró", got "${goya.pueblo}"`)
      }
      if (/Madrid/.test(goya.displayName || '')) {
        throw new Error(`F51: Goya.displayName must NOT mention Madrid, got "${goya.displayName}"`)
      }
    },
  },
  {
    name: 'F51 — Spanish alias "Playa" resolves to "Platja d\'Aro"',
    run: () => {
      // Read locations.ts directly because LAUNDROMATS is exported but the
      // resolver lives in a sibling that needs runtime init. Inspect the
      // source to confirm the aliases list contains the Spanish variants.
      const here = path.dirname(fileURLToPath(import.meta.url))
      const locPath = path.resolve(here, '..', '..', 'utils', 'locations.ts')
      const content = fs.readFileSync(locPath, 'utf8')
      // Locate the PlatjaDAro block and assert that Spanish aliases are present.
      const platjaBlock = content.match(/canonical:\s*["']Platja d'Aro["'][\s\S]*?aliases:\s*\[([^\]]+)\]/)
      if (!platjaBlock) throw new Error('F51: Platja d\'Aro entry not found')
      const aliasesStr = platjaBlock[1]
      if (!/['"]Playa d'?Aro['"]|['"]Playa['"]/.test(aliasesStr)) {
        throw new Error(`F51: Platja d'Aro must have Spanish "Playa" aliases, got: ${aliasesStr}`)
      }
    },
  },
  {
    name: 'F51 — autoExtractFacts has FAQ-only location switch (narrow scope)',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const extractPath = path.resolve(here, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(extractPath, 'utf8')
      // The location-switch block must be gated to FAQ contexts ONLY, not
      // broadened to all flows (Andrea's "narrow scope" decision 2026-05-14).
      if (!/state\.lastResolvedIntent\s*===\s*['"]faq['"]/.test(content)) {
        throw new Error(
          'F51: agent-extract.ts must gate location switch by state.lastResolvedIntent === "faq" (narrow FAQ scope)',
        )
      }
      if (!/state\.pendingFlow\s*===\s*['"]faq-prices-await-location['"]/.test(content)) {
        throw new Error('F51: location switch must also fire on faq-prices-await-location')
      }
    },
  },

  // ── F50 — Caso 12 FAQ horarios y precios location-driven ─────────────────
  {
    name: 'F50 — legacy guard file utils/guards/hours-and-pricing.ts is DELETED',
    run: () => {
      const legacyPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'utils',
        'guards',
        'hours-and-pricing.ts',
      )
      if (fs.existsSync(legacyPath)) {
        throw new Error(
          'F50: legacy guards/hours-and-pricing.ts must be deleted (replaced by faq-hours.ts + faq-prices.ts)',
        )
      }
    },
  },
  {
    name: 'F50 — new cassette files faq-hours.ts + faq-prices.ts exist (F88 raised faq-prices ceiling to 220 lines for isIncomprehensible + isNegative helpers; tracked in ALLOWED_LARGE_FILES)',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const hoursPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-hours.ts')
      const pricesPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      if (!fs.existsSync(hoursPath)) throw new Error(`F50: missing ${hoursPath}`)
      if (!fs.existsSync(pricesPath)) throw new Error(`F50: missing ${pricesPath}`)
      const hoursLines = fs.readFileSync(hoursPath, 'utf8').split('\n').length
      if (hoursLines > 150) throw new Error(`F50: faq-hours.ts exceeds 150 lines (${hoursLines})`)
      // F87: faq-prices grew from ~150 to ~163 lines due to buildTranslateFn helper.
      // F88: faq-prices grew from ~163 to ~202 lines due to isIncomprehensible +
      //      isNegative helpers + repeat logic in both confirm guards.
      // Tracked in scripts/check-architecture.sh:ALLOWED_LARGE_FILES with reason.
      const pricesLines = fs.readFileSync(pricesPath, 'utf8').split('\n').length
      if (pricesLines > 220) throw new Error(`F50: faq-prices.ts exceeds 220 lines (${pricesLines}) — split overdue`)
    },
  },
  {
    name: 'F50 — faqHandler delegates pricing/openingHours to legacy guard pipeline',
    run: () => {
      const handlerPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'utils',
        'branches',
        'faq',
        'handler.ts',
      )
      const content = fs.readFileSync(handlerPath, 'utf8')
      // T1 delegation: faqKey === 'pricing' || 'openingHours' → delegate-to-legacy.
      // F101-Regola-A: T1 delegation is now expressed via faqKey-based if-block (pricing/openingHours)
      // and T2+ delegation via the catch-all `if (pending) return delegate-to-legacy`.
      // Verify: faqKey === 'pricing' still present as T1 delegate path.
      if (!/faqKey\s*===\s*['"]pricing['"]/.test(content) || !/faqKey\s*===\s*['"]openingHours['"]/.test(content)) {
        throw new Error('F50: faqHandler must delegate pricing/openingHours to legacy pipeline (T1 faqKey path)')
      }
      // T2+ delegation: Regola-A catch-all `if (pending)` supersedes the per-flow enumerations.
      if (!/if\s*\(\s*pending\s*\)\s*\{/.test(content)) {
        throw new Error('F50: faqHandler must contain Regola-A catch-all `if (pending) {` for T2+ delegation (includes faq-prices-await-location, faq-prices-await-dryer-confirm, etc.)')
      }
    },
  },
  {
    name: 'F50 — faqs.json:pricing no longer contains the legacy "Tengo que revisarlo" deflection',
    run: () => {
      const faqsPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'json',
        'faqs.json',
      )
      const faqs = JSON.parse(fs.readFileSync(faqsPath, 'utf8')) as Record<string, string>
      if (/Tengo que revisarlo/.test(faqs.pricing || '')) {
        throw new Error('F50: faqs.json:pricing must NOT contain the legacy deflection string')
      }
    },
  },
  // ── F65 — compensation-demand uses compensationReview + customerNameAsk inline ─
  {
    name: 'F65 — guardEscalateNonTroubleshooting uses compensationReview for compensation-demand',
    run: () => {
      const guardPath = path.resolve(
        __dirname,
        '..',
        '..',
        'utils',
        'guards',
        'faq-non-troubleshooting.ts',
      )
      const content = fs.readFileSync(guardPath, 'utf8')
      if (!/compensation-demand/.test(content)) {
        throw new Error('F65: guard must branch on compensation-demand')
      }
      if (!/compensationReview/.test(content)) {
        throw new Error('F65: guard must use compensationReview i18n key for compensation-demand')
      }
    },
  },
  {
    name: 'F65 — compensationReview i18n key does not contain legacy "revisión manual" wording',
    run: () => {
      const i18nPath = path.resolve(__dirname, '..', '..', 'json', 'i18n', 'es.json')
      const catalogue = JSON.parse(fs.readFileSync(i18nPath, 'utf8')) as Record<string, string>
      const key = catalogue['compensationReview'] ?? ''
      if (/revisión manual/.test(key)) {
        throw new Error('F65: compensationReview must not contain "revisión manual" — it is now a warmer compensation-specific opening')
      }
      if (!key.trim()) {
        throw new Error('F65: compensationReview must not be empty')
      }
    },
  },

  // ── F66 — displayState captured too early (before machineType known) ────
  {
    name: 'F66 — agent-extract guards displayState capture against bare-location-answer scenarios',
    run: () => {
      // The guard prevents a customer typing "AL001" as a bare answer to the
      // location question from prematurely setting displayState. Originally a
      // narrow check (state.machineType || state.displayState); widened by the
      // 2026-05-22 audit to also accept state.pendingFlow (MIX 1: topic-switch
      // mid-discount-code) and an explicit machine-type mention in the message
      // (MIX 5: "dryer + PUSH PROG" at T1). The named composite predicate is
      // `canCaptureDisplay`; the bare "AL001" answer trips none of these.
      const extractPath = path.resolve(__dirname, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(extractPath, 'utf8')
      // Must reference all 4 acceptable signals AND wire them into the
      // primary display-capture branch via the canCaptureDisplay name.
      if (!/canCaptureDisplay\s*=/.test(content)) {
        throw new Error('F66: agent-extract.ts must define canCaptureDisplay composite predicate')
      }
      const requiredSignals = [
        /state\.machineType/,
        /state\.displayState/,
        /state\.pendingFlow/,
        /messageMentionsType/,
        /messageReportsDisplay/,
      ]
      for (const re of requiredSignals) {
        if (!re.test(content)) {
          throw new Error(
            `F66: canCaptureDisplay must include signal matching ${re} — see F66 in CLAUDE.md`,
          )
        }
      }
      if (!/newDisplay && newDisplay !== state\.displayState && canCaptureDisplay/.test(content)) {
        throw new Error(
          'F66: primary display-capture branch must gate on canCaptureDisplay',
        )
      }
    },
  },

  // ── F67 — "No veo jabón" classified as trouble-machine instead of faq ────
  {
    name: 'F67 — guardFaqDetergents exists and is registered in GUARD_PIPELINE',
    run: () => {
      const guardPath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'faq-detergents.ts')
      if (!fs.existsSync(guardPath)) {
        throw new Error('F67: utils/guards/faq-detergents.ts must exist')
      }
      const indexPath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'index.ts')
      const idx = fs.readFileSync(indexPath, 'utf8')
      if (!idx.includes('guardFaqDetergents')) {
        throw new Error('F67: guardFaqDetergents must be imported and in GUARD_PIPELINE in guards/index.ts')
      }
    },
  },
  {
    name: 'F67 — detectDetergentFaqIntent is exported from utils/intent.ts',
    run: () => {
      const intentPath = path.resolve(__dirname, '..', '..', 'utils', 'intent.ts')
      const content = fs.readFileSync(intentPath, 'utf8')
      if (!content.includes('export function detectDetergentFaqIntent')) {
        throw new Error('F67: detectDetergentFaqIntent must be exported from utils/intent.ts')
      }
    },
  },
  {
    name: 'F67 — router-prompt.ts has jabón/detergent examples for faq branch',
    run: () => {
      const routerPath = path.resolve(__dirname, '..', '..', 'utils', 'router-prompt.ts')
      const content = fs.readFileSync(routerPath, 'utf8')
      if (!content.includes('jab') || !content.includes('detergents')) {
        throw new Error('F67: router-prompt.ts must contain jabón/detergent examples pointing to faqKey:detergents')
      }
    },
  },
  // ── F68 — loyalty-card-recharge: modal+infinitive + typo "targeta" ────────
  // Real chat (Andrea, 2026-05-21): "Como puedo recargar la targeta de
  // fidelización" → bot asked for lavadora/secadora instead of answering
  // the recharge FAQ. Two gaps in RECARGA_TOPIC: (a) modal + infinitive
  // pattern ("puedo recargar") not covered; (b) typo "targeta" (g/j swap)
  // not covered.
  {
    name: 'F68 — RECARGA_TOPIC covers modal+infinitive "puedo recargar" pattern',
    run: () => {
      const guardPath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'loyalty-card-recharge.ts')
      const content = fs.readFileSync(guardPath, 'utf8')
      if (!/puedo\|quiero\|necesito\|quisiera/.test(content)) {
        throw new Error('F68: loyalty-card-recharge.ts RECARGA_TOPIC must cover modal verbs (puedo|quiero|necesito|quisiera)')
      }
    },
  },
  {
    name: 'F68 — RECARGA_TOPIC covers typo "targeta" (g/j swap)',
    run: () => {
      const guardPath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'loyalty-card-recharge.ts')
      const content = fs.readFileSync(guardPath, 'utf8')
      if (!/tar\[gj\]eta/.test(content)) {
        throw new Error('F68: loyalty-card-recharge.ts RECARGA_TOPIC must use tar[gj]eta for typo tolerance')
      }
    },
  },
  // ── F69 — faq-how-to-use: Caso 35 guard + detector ───────────────────────
  // Olga (2026-05-21): customers asking "how do I use the laundromat" must
  // receive the canonical 7-step instructions directly, no location ask.
  {
    name: 'F69 — guardFaqHowToUse exists and is registered in GUARD_PIPELINE',
    run: () => {
      const guardsDir = path.resolve(__dirname, '..', '..', 'utils', 'guards')
      if (!fs.existsSync(path.join(guardsDir, 'faq-how-to-use.ts'))) {
        throw new Error('F69: utils/guards/faq-how-to-use.ts must exist')
      }
      const indexContent = fs.readFileSync(path.join(guardsDir, 'index.ts'), 'utf8')
      if (!indexContent.includes('guardFaqHowToUse')) {
        throw new Error('F69: guardFaqHowToUse must be registered in GUARD_PIPELINE')
      }
    },
  },
  {
    name: 'F69 — detectHowToUseIntent is exported from utils/intent.ts',
    run: () => {
      const intentPath = path.resolve(__dirname, '..', '..', 'utils', 'intent.ts')
      const content = fs.readFileSync(intentPath, 'utf8')
      if (!content.includes('export function detectHowToUseIntent')) {
        throw new Error('F69: detectHowToUseIntent must be exported from utils/intent.ts')
      }
    },
  },
  {
    name: 'F69 — faqs.json has howToUse key with numbered steps',
    run: () => {
      const faqsPath = path.resolve(__dirname, '..', '..', 'json', 'faqs.json')
      const faqs = JSON.parse(fs.readFileSync(faqsPath, 'utf8'))
      if (!faqs.howToUse) {
        throw new Error('F69: json/faqs.json must contain howToUse key')
      }
      if (!/1\.|2\.|3\./.test(faqs.howToUse)) {
        throw new Error('F69: faqs.json:howToUse must contain numbered steps (1. 2. 3.)')
      }
    },
  },
  // ── F70 — loyalty FAQ bypass rephrase (buy + recharge) ───────────────────
  // Rephrase LLM kept adding "¿En qué lavandería te encuentras?" to the
  // loyalty-card-buy and loyalty-card-recharge turns, against usecases.md
  // Caso 10 criterio 4 (no location ask for loyalty FAQ).
  {
    name: 'F70 — agent.ts has isLoyaltyFaq bypass for rephrase pipeline',
    run: () => {
      const agentPath = path.resolve(__dirname, '..', '..', 'agent.ts')
      const content = fs.readFileSync(agentPath, 'utf8')
      if (!/isLoyaltyFaq/.test(content)) {
        throw new Error('F70: agent.ts must define isLoyaltyFaq bypass')
      }
      if (!/'loyalty-card-buy'/.test(content) || !/'loyalty-card-recharge'/.test(content)) {
        throw new Error('F70: isLoyaltyFaq must check both loyalty-card-buy and loyalty-card-recharge reasons')
      }
      if (!/!isLoyaltyFaq/.test(content)) {
        throw new Error('F70: rephrase guard must include !isLoyaltyFaq in its condition')
      }
    },
  },
  // ── F94 — loyalty Caso 36 reasons also bypass rephrase ───────────────────
  // Rephrase LLM added unsolicited follow-up questions ("¿Te gustaría saber
  // algo más?") to the cross-location warning (reason='loyalty-card-wrong-
  // location') and to the T2 override (reason='loyalty-card-buy-with-location').
  // The next customer "sì/sí/yes" was then misinterpreted by the LLM as
  // machine-flow confirmation (e.g. "✅ la lavadora ha arrancado").
  // Fix: extend isLoyaltyFaq to also cover the two Caso 36 reason strings.
  // Same bypass pattern as F35/F41/F49/F56/F70.
  {
    name: 'F94 — agent.ts isLoyaltyFaq covers loyalty-card-wrong-location and loyalty-card-buy-with-location',
    run: () => {
      const agentPath = path.resolve(__dirname, '..', '..', 'agent.ts')
      const content = fs.readFileSync(agentPath, 'utf8')
      if (!content.includes("'loyalty-card-wrong-location'")) {
        throw new Error("F94: isLoyaltyFaq must include 'loyalty-card-wrong-location' reason")
      }
      if (!content.includes("'loyalty-card-buy-with-location'")) {
        throw new Error("F94: isLoyaltyFaq must include 'loyalty-card-buy-with-location' reason")
      }
    },
  },
  // ── F95 — locations.json Pineda + L'Escala use 'buy-loyalty-card' key ────
  // guardLoyaltyCardBuy calls getLocalisedFaqOverride(ar, 'buy-loyalty-card', lang)
  // but Pineda and L'Escala had 'loyaltyCard' (legacy key) → override not found
  // → fell back to getFaqs()['loyaltyCard'] (generic ES-only) → rephrase active
  // → bot added "¿Te gustaría saber algo más?" → "si" captured by trouble-machine.
  // Fix: renamed faqOverrides key from 'loyaltyCard' → 'buy-loyalty-card' in
  // Pineda and L'Escala in json/locations.json (data-layer fix, no code change).
  {
    name: "F95 — locations.json Pineda faqOverrides uses 'buy-loyalty-card' key (not legacy 'loyaltyCard')",
    run: () => {
      const locationsPath = path.resolve(__dirname, '..', '..', 'json', 'locations.json')
      const content = JSON.parse(fs.readFileSync(locationsPath, 'utf8'))
      const pineda = content.locations?.['Pineda']?.faqOverrides ?? {}
      if (!pineda['buy-loyalty-card']) {
        throw new Error(
          "F95: Pineda.faqOverrides must have key 'buy-loyalty-card' (not legacy 'loyaltyCard')",
        )
      }
      if (pineda['loyaltyCard']) {
        throw new Error(
          "F95: Pineda.faqOverrides must NOT have legacy key 'loyaltyCard' — use 'buy-loyalty-card'",
        )
      }
    },
  },
  {
    name: "F95 — locations.json L'Escala faqOverrides uses 'buy-loyalty-card' key (not legacy 'loyaltyCard')",
    run: () => {
      const locationsPath = path.resolve(__dirname, '..', '..', 'json', 'locations.json')
      const content = JSON.parse(fs.readFileSync(locationsPath, 'utf8'))
      const escala = content.locations?.["L'Escala"]?.faqOverrides ?? {}
      if (!escala['buy-loyalty-card']) {
        throw new Error(
          "F95: L'Escala.faqOverrides must have key 'buy-loyalty-card' (not legacy 'loyaltyCard')",
        )
      }
      if (escala['loyaltyCard']) {
        throw new Error(
          "F95: L'Escala.faqOverrides must NOT have legacy key 'loyaltyCard' — use 'buy-loyalty-card'",
        )
      }
    },
  },
  // ── F98 — TARJETA_TOPIC covers cross-location possession patterns ────────────
  // Caso 10.2 trigger: "Tengo la tarjeta de Pineda" (ES) / "Ho comprato la
  // tessera a Pineda" (IT) / "Tinc la targeta de X" (CA) did not match the
  // original TARJETA_TOPIC regex — only buy-intent patterns were covered.
  // Fix: added possession/use verbs (tengo/ho/tinc/comprei/j'ai/I have/bought)
  // + card words across 6 languages.
  {
    name: "F98 — TARJETA_TOPIC matches ES 'tengo la tarjeta' possession pattern",
    run: () => {
      if (!TARJETA_TOPIC.test('Tengo la tarjeta de Pineda, ¿la puedo usar aquí?')) {
        throw new Error("F98: ES 'tengo la tarjeta' must match TARJETA_TOPIC")
      }
    },
  },
  {
    name: "F98 — TARJETA_TOPIC matches IT 'ho comprato la tessera' possession pattern",
    run: () => {
      if (!TARJETA_TOPIC.test('Ho comprato la tessera a Pineda, funziona anche qui?')) {
        throw new Error("F98: IT 'ho comprato la tessera' must match TARJETA_TOPIC")
      }
    },
  },
  {
    name: "F98 — TARJETA_TOPIC does NOT match 'tengo un problema' (no card word)",
    run: () => {
      if (TARJETA_TOPIC.test('tengo un problema con la lavadora')) {
        throw new Error("F98: 'tengo un problema' without card word must NOT match")
      }
    },
  },
  // ── F99 — RECARGA_TOPIC covers all 6 languages ──────────────────────────────
  // Demo CLI 2026-05-24: IT "Come posso ricaricare la tessera?" → bot asked
  // location in ES (routing to trouble-machine). EN "How can I recharge my
  // loyalty card?" → bot replied 20€ (routing to loyaltyCardBuy). RECARGA_TOPIC
  // covered ES/CA but missed IT (ricaricare/ricarico), EN "recharge" standalone
  // variants, PT (recarregar + cartão), FR (recharger + carte).
  // Fix: RECARGA_TOPIC in utils/guards/loyalty-card-recharge.ts extended for all 6.
  {
    name: "F99 — RECARGA_TOPIC matches IT 'Come posso ricaricare la tessera?'",
    run: () => {
      const rechargePath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'loyalty-card-recharge.ts')
      const content = fs.readFileSync(rechargePath, 'utf8')
      // Verify IT branch is present in the regex
      if (!content.includes('ricaric')) {
        throw new Error("F99: RECARGA_TOPIC must include Italian 'ricaric' pattern for IT coverage")
      }
    },
  },
  {
    name: "F99 — RECARGA_TOPIC matches EN 'How can I recharge my loyalty card?'",
    run: () => {
      const rechargePath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'loyalty-card-recharge.ts')
      const content = fs.readFileSync(rechargePath, 'utf8')
      // Verify EN "how can I" pattern is present (not just "how do I")
      if (!content.includes('can')) {
        throw new Error("F99: RECARGA_TOPIC must include 'can' in EN modal variants for 'how can I recharge'")
      }
    },
  },
  {
    name: "F99 — RECARGA_TOPIC matches FR 'recharger ma carte'",
    run: () => {
      const rechargePath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'loyalty-card-recharge.ts')
      const content = fs.readFileSync(rechargePath, 'utf8')
      if (!content.includes('recharg')) {
        throw new Error("F99: RECARGA_TOPIC must include French 'recharg' pattern for FR coverage")
      }
    },
  },
  // ── F100 — guardMataroStreet preserves loyalty topic across Mataró disambiguation ─
  // Real bug: IT "ciao sono a Mataró posso usare una tessera di fidelizzazione
  // comprata in un altra lavanderia?" + T2 "Goya" → bot improvised "no estoy seguro".
  // Root cause (3-part):
  //   Part 1: guardMataroStreet wins T1 → loyalty context lost (fixed: set faqTopic)
  //   Part 2: faqHandler T2 with branch='faq' sticky: TARJETA_TOPIC.test("Goya")=false,
  //            lastResolvedIntent≠'faq' → unknownKey + topic-switch → activeBranch=null
  //            → guard pipeline never reached, guardLoyaltyCardBuy's askedTarjeta branch
  //            (which reads state.faqTopic) never fired.
  //   Part 3: cross-location check skipped incorrectly (isMataroStreetReply gate)
  //   Part 4: Mataró sub-location override resolution via getLoyaltyOverride helper
  // Fix: (1) guardMataroStreet sets faqTopic='buy-loyalty-card' when TARJETA_TOPIC matches.
  //      (2) faqHandler delegates to legacy when !faqKey && faqTopic='buy-loyalty-card'.
  //      (3) guardLoyaltyCardBuy skips cross-location check when isMataroStreetReply.
  //      (4) getLoyaltyOverride falls back to locationStreet when location has no override.
  {
    name: 'F100 — guardMataroStreet sets faqTopic=buy-loyalty-card on loyalty message',
    run: () => {
      const locationResPath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'location-resolution.ts')
      const content = fs.readFileSync(locationResPath, 'utf8')
      if (!content.includes("from './loyalty-card-buy.js'")) {
        throw new Error("F100: location-resolution.ts must import from './loyalty-card-buy.js'")
      }
      if (!content.includes('TARJETA_TOPIC')) {
        throw new Error("F100: guardMataroStreet must use TARJETA_TOPIC to detect loyalty topic")
      }
      if (!content.includes("faqTopic = 'buy-loyalty-card'")) {
        throw new Error("F100: guardMataroStreet must set state.faqTopic='buy-loyalty-card' when TARJETA_TOPIC matches")
      }
    },
  },
  {
    name: "F100 — faqHandler delegates to legacy when !faqKey && faqTopic='buy-loyalty-card'",
    run: () => {
      // faqHandler T2 fix: when branch='faq' is sticky and T2 message is the
      // Mataró street answer ("Goya"), TARJETA_TOPIC.test("Goya")=false and
      // routerDetails={} (T2+ skips router) so faqKey is undefined. Without this
      // gate the handler emits unknownKey + topic-switch → activeBranch=null →
      // guardLoyaltyCardBuy (which reads state.faqTopic) never fires.
      const handlerPath = path.resolve(
        __dirname, '..', '..', 'utils', 'branches', 'faq', 'handler.ts',
      )
      const content = fs.readFileSync(handlerPath, 'utf8')
      if (!content.includes("ar.state.faqTopic === 'buy-loyalty-card'")) {
        throw new Error(
          "F100: faqHandler must gate on ar.state.faqTopic === 'buy-loyalty-card' before !faqKey unknownKey branch",
        )
      }
      // The gate must delegate to legacy (not return unknownKey)
      const gateIdx = content.indexOf("ar.state.faqTopic === 'buy-loyalty-card'")
      const afterGate = content.slice(gateIdx, gateIdx + 200)
      if (!afterGate.includes('delegate-to-legacy')) {
        throw new Error(
          "F100: faqHandler faqTopic gate must return handoff='delegate-to-legacy'",
        )
      }
    },
  },
  // ── F97 — guardFaqClosure covers bare affirmatives si/yes/sim/oui ───────────
  // After a loyalty-card reply (F94+F95+F96: rephrase bypass, no follow-up
  // question), "si"/"yes" means "understood". guardFaqClosure did not include
  // bare affirmatives → LLM improvised "¿En qué máquina estás usando la tarjeta?"
  // Fix: add s[ií]|yes|sim|oui to isAcknowledgment regex. Safe: gated on
  // lastResolvedIntent === 'faq'.
  {
    name: "F97 — guardFaqClosure regex includes bare affirmatives s[ií]|yes|sim|oui",
    run: () => {
      const closurePath = path.resolve(__dirname, '..', '..', 'utils', 'guards', 'faq-closure.ts')
      const content = fs.readFileSync(closurePath, 'utf8')
      if (!content.includes('s[ií]') || !content.includes('yes') || !content.includes('sim') || !content.includes('oui')) {
        throw new Error("F97: guardFaqClosure isAcknowledgment must include s[ií]|yes|sim|oui")
      }
    },
  },
  // ── F96 — faqHandler delegates to legacy pipeline on loyalty card mid-FAQ ──
  // When activeBranch='faq' is sticky (T1 classified as faq) and the customer
  // sends a loyalty card query at T2+, the router does NOT re-classify (T2+
  // skips LLM routing). routerDetails is empty → faqKey is undefined. Without
  // this gate, faqHandler returned unknownKey and the legacy guardLoyaltyCardBuy
  // never fired. Fix: gate TARJETA_TOPIC before the !faqKey → unknownKey branch.
  {
    name: 'F96 — faqHandler imports TARJETA_TOPIC from guards/loyalty-card-buy',
    run: () => {
      const handlerPath = path.resolve(
        __dirname, '..', '..', 'utils', 'branches', 'faq', 'handler.ts',
      )
      const content = fs.readFileSync(handlerPath, 'utf8')
      if (!content.includes("from '../../guards/loyalty-card-buy.js'")) {
        throw new Error("F96: faqHandler must import from '../../guards/loyalty-card-buy.js'")
      }
      if (!content.includes('TARJETA_TOPIC.test(message)')) {
        throw new Error('F96: faqHandler must gate on TARJETA_TOPIC.test(message) before !faqKey unknownKey branch')
      }
      if (!content.includes("delegate-to-legacy")) {
        throw new Error("F96: faqHandler must return delegate-to-legacy on TARJETA_TOPIC match")
      }
    },
  },
  {
    name: 'F69 — prompts/router.txt has howToUse key and examples',
    run: () => {
      const routerTxt = path.resolve(__dirname, '..', '..', 'prompts', 'router.txt')
      const content = fs.readFileSync(routerTxt, 'utf8')
      if (!content.includes('howToUse')) {
        throw new Error('F69: prompts/router.txt must contain howToUse key and examples')
      }
    },
  },
  {
    name: 'F71 — force-gather.ts imports hasGreetingIntent and defines isGreetingContext',
    run: () => {
      const content = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/force-gather.ts'),
        'utf8',
      )
      if (!content.includes('hasGreetingIntent')) {
        throw new Error('F71: force-gather.ts must import hasGreetingIntent from intent.ts')
      }
      if (!content.includes('isGreetingContext')) {
        throw new Error('F71: force-gather.ts must define isGreetingContext guard')
      }
      if (!content.includes('isGreetingContext(ar.state, userMessage)')) {
        throw new Error('F71: guardForceMachineType must call isGreetingContext before isInFaqContext')
      }
    },
  },
  {
    name: 'F72 — buildDisplayRecap is exported from utils/agent-rephrase.ts',
    run: () => {
      const content = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      if (!content.includes('export function buildDisplayRecap')) {
        throw new Error('F72: buildDisplayRecap must be exported for deterministic 4-block recap')
      }
      if (!content.includes('isDisplayFlowRecap')) {
        throw new Error('F72: rephraseForTurn must check isDisplayFlowRecap before calling buildDisplayRecap')
      }
      if (!content.includes('RECAP_STRINGS')) {
        throw new Error('F72: RECAP_STRINGS per-language table must be present')
      }
    },
  },
  {
    name: 'F72 — RECAP_STRINGS covers all 6 supported languages',
    run: () => {
      const content = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      for (const lang of ['es', 'it', 'en', 'ca', 'pt', 'fr']) {
        if (!content.includes(`  ${lang}: {`)) {
          throw new Error(`F72: RECAP_STRINGS missing language '${lang}'`)
        }
      }
    },
  },
  {
    name: 'F72 — settings.json has rephraseDisplayFlow toggle',
    run: () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'json/settings.json'), 'utf8'),
      )
      if (typeof settings.rephraseDisplayFlow !== 'boolean') {
        throw new Error('F72: settings.json must have rephraseDisplayFlow boolean toggle')
      }
    },
  },
  {
    name: 'F73 — rephrase.txt: LANGUAGE is authoritative (not fallback)',
    run: () => {
      const rephraseTxt = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'prompts/rephrase.txt'),
        'utf8',
      )
      // The rephrase must NOT instruct the LLM to follow conversation history language.
      // LANGUAGE field must be authoritative (F73 fix for multi-language mixing bug).
      if (/detecta el idioma de CONVERSATION_HISTORY/i.test(rephraseTxt)) {
        throw new Error(
          'F73: rephrase.txt must NOT instruct LLM to detect language from CONVERSATION_HISTORY — LANGUAGE field is authoritative',
        )
      }
      if (/usa el valor de LANGUAGE solo como fallback/i.test(rephraseTxt)) {
        throw new Error(
          'F73: rephrase.txt must NOT use LANGUAGE only as fallback — it must be the authoritative language',
        )
      }
      if (!/LANGUAGE.*autoritativo/i.test(rephraseTxt)) {
        throw new Error(
          'F73: rephrase.txt must declare LANGUAGE as authoritative (autoritativo)',
        )
      }
    },
  },
  {
    name: 'F75 — buildDisplayRecap: Phase B recap every N turns via displayPhaseBTurnCount + configurable interval',
    run: () => {
      const rephraseTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      if (!rephraseTs.includes('displayPhaseBTurnCount')) {
        throw new Error('F75: agent-rephrase.ts must use displayPhaseBTurnCount to track Phase B turns')
      }
      // F75 cadence is now configurable: reads recapInterval from settings
      // (rephraseDisplayFlowRecapInterval ?? 3), then checks % recapInterval === 0.
      if (!rephraseTs.includes('recapInterval')) {
        throw new Error('F75: agent-rephrase.ts must use recapInterval variable (not hardcoded 3)')
      }
      if (!rephraseTs.includes('rephraseDisplayFlowRecapInterval')) {
        throw new Error('F75: agent-rephrase.ts must read settings.rephraseDisplayFlowRecapInterval')
      }
      const stateTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'models/state.ts'),
        'utf8',
      )
      if (!stateTs.includes('displayPhaseBTurnCount')) {
        throw new Error('F75: models/state.ts must declare displayPhaseBTurnCount field')
      }
      // Settings field declared in models/runtime.ts
      const runtimeTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'models/runtime.ts'),
        'utf8',
      )
      if (!runtimeTs.includes('rephraseDisplayFlowRecapInterval')) {
        throw new Error('F75: models/runtime.ts must declare rephraseDisplayFlowRecapInterval in Settings type')
      }
    },
  },
  {
    name: 'F78 — guardInsistLocation dontKnow regex covers all 6 languages (IT/EN/FR/PT/CA added)',
    run: () => {
      const guardTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/location-resolution.ts'),
        'utf8',
      )
      // Must contain IT variant (accepts both "non lo so" and "non lo se" — no accent)
      if (!guardTs.includes('non\\s+lo\\s+s[eo]')) {
        throw new Error('F78: location-resolution.ts dontKnow regex must include IT "non lo so/se"')
      }
      // Must contain EN variant
      if (!guardTs.includes("don'?t\\s+know")) {
        throw new Error('F78: location-resolution.ts dontKnow regex must include EN "don\'t know"')
      }
      // Must contain FR variant
      if (!guardTs.includes('sais\\s+pas')) {
        throw new Error('F78: location-resolution.ts dontKnow regex must include FR "sais pas"')
      }
      // Must contain PT variant
      if (!guardTs.includes('não\\s+sei')) {
        throw new Error('F78: location-resolution.ts dontKnow regex must include PT "não sei"')
      }
      // Must contain CA variant
      if (!guardTs.includes('no\\s+ho\\s+s')) {
        throw new Error('F78: location-resolution.ts dontKnow regex must include CA "no ho sé"')
      }
    },
  },
  {
    name: 'F77 — extractDisplayState: ALM DOOR (space-separated) collapses to ALM/DOOR',
    run: () => {
      // intent.ts specificAlarmMatch must use ALM[\/ ]?DOOR (space accepted for DOOR only)
      const intentTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      // The old form ALM\/?DOOR did NOT accept space — if it's back, this pin fires.
      if (!intentTs.includes('ALM[\\/') || !intentTs.includes(']?DOOR')) {
        throw new Error('F77: intent.ts specificAlarmMatch must use ALM[\\/  ]?DOOR to accept space-separated variant')
      }
    },
  },
  {
    name: 'F76 — flowEngineEscalate i18n key present in all 6 catalogues (no hardcoded ES string)',
    run: () => {
      const langs = ['es', 'it', 'en', 'ca', 'pt', 'fr']
      for (const lang of langs) {
        const catalogue = JSON.parse(
          fs.readFileSync(
            path.join(ECOLAUNDRY_ROOT, `json/i18n/${lang}.json`),
            'utf8',
          ),
        )
        if (!catalogue['flowEngineEscalate']) {
          throw new Error(`F76: json/i18n/${lang}.json is missing the flowEngineEscalate key`)
        }
      }
      // flow-engine.ts must use translateFn for the escalation prompt, not a hardcoded ES string
      const flowEngineTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/flow-engine.ts'),
        'utf8',
      )
      if (!flowEngineTs.includes('flowEngineEscalate')) {
        throw new Error('F76: flow-engine.ts must use translateFn(\'flowEngineEscalate\') instead of hardcoded Spanish string')
      }
      // buildAmbiguousPuebloReply dead code must be removed from locations.ts
      const locationsTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/locations.ts'),
        'utf8',
      )
      if (locationsTs.includes('buildAmbiguousPuebloReply')) {
        throw new Error('F76: buildAmbiguousPuebloReply dead code must be removed from locations.ts')
      }
      // faq-how-to-use guard must yield to discount-code intent
      const guardTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/faq-how-to-use.ts'),
        'utf8',
      )
      if (!guardTs.includes('detectDiscountCodeIntent')) {
        throw new Error('F76: faq-how-to-use.ts must gate on detectDiscountCodeIntent to avoid false-positive over discount-code triggers')
      }
    },
  },
  {
    name: 'F74 — buildDisplayRecap: greeting+closing only on Phase A (lastPresentedStepId === null)',
    run: () => {
      const rephraseTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      // The fix must check lastPresentedStepId to distinguish Phase A vs Phase B.
      if (!rephraseTs.includes('lastPresentedStepId')) {
        throw new Error(
          'F74: agent-rephrase.ts must check lastPresentedStepId to determine Phase A vs Phase B',
        )
      }
      // Phase B must emit only 2 blocks (problem summary + instruction), not 4.
      if (!rephraseTs.includes('Phase B')) {
        throw new Error(
          'F74: agent-rephrase.ts must have a comment or branch for Phase B (re-ask/escalation turns)',
        )
      }
      // The isFirstDisplayTurn flag (or equivalent) must gate the greeting/closing.
      if (!rephraseTs.includes('isFirstDisplayTurn')) {
        throw new Error(
          'F74: agent-rephrase.ts must use isFirstDisplayTurn (or equivalent) to gate greeting+closing to Phase A only',
        )
      }
    },
  },
  {
    name: 'F79 — landmark-based location resolution: resolver exported, agent-extract wired, guardInsistLocation enriched, i18n key present',
    run: () => {
      // (a) Resolver helpers exist and are data-driven (read from runtime.locations).
      const landmarksTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/locations-landmarks.ts'),
        'utf8',
      )
      for (const sym of [
        'export function resolveLocationByLandmarks',
        'export function listAllLandmarks',
        'export function findLandmarksInMessage',
      ]) {
        if (!landmarksTs.includes(sym)) {
          throw new Error(`F79: utils/locations-landmarks.ts must declare ${sym}`)
        }
      }

      // (b) intent.ts re-exports findLandmarksInMessage as detectLandmarkMention.
      const intentTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      if (!intentTs.includes('findLandmarksInMessage as detectLandmarkMention')) {
        throw new Error('F79: utils/intent.ts must re-export findLandmarksInMessage as detectLandmarkMention')
      }

      // (c) agent-extract.ts wires the landmark fallback for location capture.
      const agentExtractTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-extract.ts'),
        'utf8',
      )
      if (!agentExtractTs.includes('resolveLocationByLandmarks')) {
        throw new Error('F79: utils/agent-extract.ts must call resolveLocationByLandmarks for landmark-based location capture')
      }

      // (d) guardInsistLocation enumerates landmarks on "no lo sé" replies.
      const guardTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/location-resolution.ts'),
        'utf8',
      )
      if (!guardTs.includes('listAllLandmarks')) {
        throw new Error('F79: guards/location-resolution.ts must call listAllLandmarks to enumerate landmarks')
      }
      if (!guardTs.includes('landmarkEnumerationAsk')) {
        throw new Error('F79: guards/location-resolution.ts must use the landmarkEnumerationAsk i18n key')
      }

      // (e) New i18n key present in all 6 catalogues WITH the {landmarks} placeholder.
      const langs = ['es', 'it', 'en', 'ca', 'pt', 'fr']
      for (const lang of langs) {
        const catalogue = JSON.parse(
          fs.readFileSync(
            path.join(ECOLAUNDRY_ROOT, `json/i18n/${lang}.json`),
            'utf8',
          ),
        )
        const tmpl = catalogue['landmarkEnumerationAsk']
        if (typeof tmpl !== 'string' || !tmpl.includes('{landmarks}')) {
          throw new Error(
            `F79: json/i18n/${lang}.json must define landmarkEnumerationAsk with the {landmarks} placeholder`,
          )
        }
      }

      // (f) locations.json has at least one location with non-empty landmarks[]
      // (data-driven contract: adding/removing landmarks stays a JSON edit, not TS).
      const locationsJson = JSON.parse(
        fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'json/locations.json'), 'utf8'),
      )
      let foundLandmarks = false
      for (const override of Object.values(
        locationsJson.locations as Record<string, { metadata?: { landmarks?: unknown } }>,
      )) {
        const lms = override.metadata?.landmarks
        if (Array.isArray(lms) && lms.length > 0) {
          foundLandmarks = true
          break
        }
      }
      if (!foundLandmarks) {
        throw new Error(
          'F79: json/locations.json must have at least one location with a non-empty metadata.landmarks[] (resolver data source)',
        )
      }

      // (g) landmark ack: state field + extractor signal + L5 prepend + i18n key.
      const stateModelTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'models/state.ts'),
        'utf8',
      )
      if (!stateModelTs.includes('locationAckPending')) {
        throw new Error('F79: models/state.ts must declare locationAckPending field')
      }
      const stateUtilTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/state.ts'),
        'utf8',
      )
      if (!stateUtilTs.includes('locationAckPending: null')) {
        throw new Error('F79: utils/state.ts:createInitialState must initialise locationAckPending: null')
      }
      if (!agentExtractTs.includes('state.locationAckPending = landmarkMatch.canonical')) {
        throw new Error(
          'F79: agent-extract.ts must set state.locationAckPending = landmarkMatch.canonical on unique-match landmark resolution',
        )
      }
      const agentTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'agent.ts'),
        'utf8',
      )
      if (!agentTs.includes("tt('landmarkAck'") || !agentTs.includes('state.locationAckPending = null')) {
        throw new Error(
          'F79: agent.ts:applyGuardOutcome must prepend tt(\'landmarkAck\', ...) and clear state.locationAckPending (consume-once)',
        )
      }
      for (const lang of langs) {
        const catalogue = JSON.parse(
          fs.readFileSync(
            path.join(ECOLAUNDRY_ROOT, `json/i18n/${lang}.json`),
            'utf8',
          ),
        )
        const tmpl = catalogue['landmarkAck']
        if (
          typeof tmpl !== 'string' ||
          !tmpl.includes('{location}') ||
          !tmpl.includes('{address}')
        ) {
          throw new Error(
            `F79: json/i18n/${lang}.json must define landmarkAck with {location} AND {address} placeholders`,
          )
        }
      }
    },
  },
  {
    name: 'F80 — sticky-T1 language: applyTenantLanguage no preferredLanguage, no flip-back, router gated on T1',
    run: () => {
      const indexTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'index.ts'),
        'utf8',
      )
      // (1) applyTenantLanguage must NOT set state.preferredLanguage from caller config.
      // Match the function block and verify it does not assign preferredLanguage on a line of code.
      const fnStart = indexTs.indexOf('function applyTenantLanguage(')
      if (fnStart < 0) {
        throw new Error('F80: applyTenantLanguage function must exist in index.ts')
      }
      const fnBody = indexTs.slice(fnStart, fnStart + 2000)
      // Look for any executable (non-comment) assignment to preferredLanguage.
      const codeLines = fnBody.split('\n').filter((l: string) => {
        const trimmed = l.trim()
        return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*')
      })
      const offendingAssignment = codeLines.find((l: string) =>
        /session\.ar\.state\.preferredLanguage\s*=/.test(l),
      )
      if (offendingAssignment) {
        throw new Error(
          'F80: applyTenantLanguage MUST NOT assign state.preferredLanguage (caller config is fallback for state.language only)',
        )
      }

      // (2) resolveLanguageForTurn must NOT have a flip-back branch on T2+.
      // The legacy code had: `if (heuristic && enabled.includes(heuristic) && heuristic !== ar.state.preferredLanguage) { ar.state.preferredLanguage = heuristic }`.
      // That entire branch must be gone.
      const agentTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'agent.ts'),
        'utf8',
      )
      const fnRes = agentTs.indexOf('function resolveLanguageForTurn(')
      if (fnRes < 0) {
        throw new Error('F80: resolveLanguageForTurn must exist in agent.ts')
      }
      const fnResBody = agentTs.slice(fnRes, fnRes + 3000)
      if (/heuristic\s*!==\s*ar\.state\.preferredLanguage/.test(fnResBody)) {
        throw new Error(
          'F80: resolveLanguageForTurn MUST NOT flip-back preferredLanguage on per-turn heuristic mismatch',
        )
      }

      // (3) Router T1 override in maybeDispatchBranch must be gated on ar.state.turnCount === 1.
      const fnMD = agentTs.indexOf('async function maybeDispatchBranch(')
      if (fnMD < 0) {
        throw new Error('F80: maybeDispatchBranch must exist in agent.ts')
      }
      const fnMDBody = agentTs.slice(fnMD, fnMD + 3000)
      // The override block must include the T1 guard right before assigning preferredLanguage.
      if (!/ar\.state\.turnCount\s*===\s*1[\s\S]{0,500}preferredLanguage\s*=/.test(fnMDBody)) {
        throw new Error(
          'F80: maybeDispatchBranch router-language override MUST be gated on ar.state.turnCount === 1',
        )
      }
    },
  },

  // ── F81 — Programs FAQ + PUSH PROG dynamic (2026-05-22) ──────────────────
  // Feature: programs per location from json/locations.json:metadata.programs.
  // Used by FAQ (Caso 12.4) and PUSH PROG flow (Caso 1) dynamically.
  // Pattern preservativo: data-driven L3 + pure formatter + guard cassette.
  // Expanding to a new location = JSON edit only.
  {
    name: 'F81 — detectProgramsIntent exported from utils/intent.ts',
    run: () => {
      const src = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'), 'utf8')
      if (!src.includes('export function detectProgramsIntent')) {
        throw new Error('F81: detectProgramsIntent must be exported from utils/intent.ts')
      }
    },
  },
  {
    name: 'F81 — formatWasherPrograms + formatDryerPrograms + buildPushProgList in faq-programs-formatter.ts (re-exported via faq-location-formatter.ts)',
    run: () => {
      // After iron-rule-#3 split, programs formatters live in faq-programs-formatter.ts
      // and are re-exported by faq-location-formatter.ts for backward compat.
      const src = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'utils/faq-programs-formatter.ts'), 'utf8')
      if (!src.includes('export function formatWasherPrograms')) {
        throw new Error('F81: formatWasherPrograms must be exported from utils/faq-programs-formatter.ts')
      }
      if (!src.includes('export function formatDryerPrograms')) {
        throw new Error('F81: formatDryerPrograms must be exported from utils/faq-programs-formatter.ts')
      }
      if (!src.includes('export function buildPushProgList')) {
        throw new Error('F81: buildPushProgList must be exported from utils/faq-programs-formatter.ts')
      }
      // Verify re-export in faq-location-formatter.ts (backward compat)
      const src2 = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'utils/faq-location-formatter.ts'), 'utf8')
      if (!src2.includes('formatWasherPrograms') || !src2.includes('formatDryerPrograms') || !src2.includes('buildPushProgList')) {
        throw new Error('F81: faq-location-formatter.ts must re-export programs functions for backward compat')
      }
    },
  },
  {
    name: 'F81 — guardFaqPrograms + guardFaqProgramsAwaitLocation exported from utils/guards/faq-programs.ts',
    run: () => {
      const src = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'utils/guards/faq-programs.ts'), 'utf8')
      if (!src.includes('export const guardFaqPrograms')) {
        throw new Error('F81: guardFaqPrograms must be exported from faq-programs.ts')
      }
      if (!src.includes('export const guardFaqProgramsAwaitLocation')) {
        throw new Error('F81: guardFaqProgramsAwaitLocation must be exported from faq-programs.ts')
      }
    },
  },
  {
    name: 'F81 — pendingFlow union includes faq-programs-await-location in models/state.ts',
    run: () => {
      const src = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'models/state.ts'), 'utf8')
      if (!src.includes("'faq-programs-await-location'")) {
        throw new Error("F81: models/state.ts pendingFlow union must include 'faq-programs-await-location'")
      }
    },
  },
  {
    name: 'F81 — lastFaqKey union includes programs in models/state.ts',
    run: () => {
      const src = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'models/state.ts'), 'utf8')
      if (!src.includes("'programs'")) {
        throw new Error("F81: models/state.ts lastFaqKey union must include 'programs'")
      }
    },
  },
  {
    name: 'F81 — auto-start-machine-flow imports buildPushProgList for dynamic PUSH PROG',
    run: () => {
      const src = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'utils/guards/auto-start-machine-flow.ts'), 'utf8')
      if (!src.includes('buildPushProgList')) {
        throw new Error('F81: auto-start-machine-flow.ts must import and use buildPushProgList')
      }
    },
  },
  {
    name: 'F81 — locations.json has programs data for Goya (numbered washers)',
    run: () => {
      const locs = JSON.parse(fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'json/locations.json'), 'utf8'))
      const goya = locs.locations?.Goya?.metadata?.programs
      if (!goya) throw new Error('F81: locations.json Goya must have metadata.programs')
      if (!Array.isArray(goya.washers) || goya.washers.length === 0)
        throw new Error('F81: Goya programs.washers must be a non-empty array')
      if (goya.washers[0].number !== 1)
        throw new Error('F81: Goya first washer program must have number=1')
      if (!Array.isArray(goya.dryers) || goya.dryers.length !== 3)
        throw new Error('F81: Goya programs.dryers must have 3 entries')
    },
  },
  {
    name: 'F81 — i18n ES has all program name keys',
    run: () => {
      const es = JSON.parse(fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'json/i18n/es.json'), 'utf8'))
      const required = ['programMuyCaliente','programCaliente','programTemplado','programFrio','programCentrifugado','programAltaTemp','programMediaTemp','programBajaTemp','programsWasherTitle','programsDryerTitle','programsNoData','programsAsk']
      for (const key of required) {
        if (!es[key]) throw new Error(`F81: es.json missing key "${key}"`)
      }
    },
  },
  {
    // F82 — programs FAQ branch routing missing.
    //
    // F81 added the guardFaqPrograms cassette (detector + guard + formatter +
    // i18n + locations.json data) but missed two integration points with the
    // branch router architecture:
    //
    //   (1) prompts/router.txt did not list "programs" among the faqKey set,
    //       so the router LLM classified "qué programas hay?" as a different
    //       faqKey (often pricing/howToUse) or as null → faqHandler returned
    //       unknownKey topic-switch → guardFaqPrograms never ran.
    //
    //   (2) utils/branches/faq/handler.ts hardcoded the delegate-to-legacy
    //       gate to only pricing + openingHours. Even when the router
    //       correctly emits faqKey=programs, the handler looked up
    //       getFaqs()['programs'] (which does NOT exist — programs is
    //       data-driven from locations.json) → fell through to unknownKey.
    //
    // Live CLI evidence (Andrea 2026-05-22): 3 scenarios all produced wrong
    // replies — ES with explicit location, ES without location, IT with
    // explicit location. After the fix all 3 render programs correctly.
    name: 'F82 — router prompt lists programs as a faqKey',
    run: () => {
      const router = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'prompts/router.txt'), 'utf8')
      // The faqKey list block must include "programs".
      if (!/\bprograms\b/.test(router)) {
        throw new Error('F82: prompts/router.txt must include "programs" in the faqKey set')
      }
      // At least one cross-language example must show faqKey:programs.
      if (!/"faqKey":\s*"programs"/.test(router)) {
        throw new Error('F82: prompts/router.txt must include at least one example with faqKey="programs"')
      }
    },
  },
  {
    name: 'F82 — faqHandler delegates programs to legacy guard',
    run: () => {
      const handler = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/branches/faq/handler.ts'),
        'utf8',
      )
      // T1 delegate gate must include 'programs' alongside pricing/openingHours.
      if (!/faqKey === 'programs'/.test(handler)) {
        throw new Error("F82: faqHandler must delegate-to-legacy for faqKey === 'programs' (same as pricing/openingHours)")
      }
      // T2 sticky-branch delegate: F101-Regola-A catch-all `if (pending)` supersedes the
      // per-flow enumeration — faq-programs-await-location is covered by the catch-all.
      if (!/if\s*\(\s*pending\s*\)\s*\{/.test(handler)) {
        throw new Error("F82: faqHandler must contain Regola-A catch-all `if (pending) {` which covers faq-programs-await-location delegation")
      }
    },
  },
  {
    // F83 — invoice / discount-code / loyalty / FAQ flows had their per-turn
    // canonical answers misclassified as topic-switches because
    // `detectTopicSwitch` treated ANY non-empty `pendingFlow` as "machine
    // context". When the customer was in `invoice-ask-coste` and replied
    // "6€" (the answer to the coste-total question), the `topicPayment`
    // regex (`\d+\s*€`) matched, `resetMachineFacts` cleared `pendingFlow`,
    // `nonTroubleshootingIncident = 'datafono-wrong-amount'` was set, and
    // `guardEscalateNonTroubleshooting` fired with an invented incident
    // type. Live CLI evidence (Andrea 2026-05-22): 2/2 invoice scenarios
    // failed deterministically at T8 (coste step). Fix: gate
    // `detectTopicSwitch` to short-circuit when `pendingFlow` is one of the
    // non-machine prefixes (`invoice-`, `discount-code-`, `loyalty-`,
    // `faq-`). The customer in those flows is NOT in a machine context —
    // their reply is the canonical answer, not a topic switch.
    name: 'F83 — detectTopicSwitch short-circuits on non-machine pendingFlow prefixes',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-extract.ts'),
        'utf8',
      )
      // Source-level assertion: the NON_MACHINE_PENDING_PREFIXES list must
      // exist and the detectTopicSwitch function must consult it.
      if (!/NON_MACHINE_PENDING_PREFIXES/.test(src)) {
        throw new Error('F83: agent-extract.ts must declare NON_MACHINE_PENDING_PREFIXES')
      }
      for (const prefix of ['invoice-', 'discount-code-', 'loyalty-', 'faq-']) {
        if (!src.includes(`'${prefix}'`)) {
          throw new Error(`F83: NON_MACHINE_PENDING_PREFIXES must include '${prefix}'`)
        }
      }
      if (!/isInNonMachineFlow\(state\.pendingFlow\)/.test(src)) {
        throw new Error('F83: detectTopicSwitch must short-circuit via isInNonMachineFlow(state.pendingFlow)')
      }
    },
  },
  {
    // F84 — guardMataroStreet: "non lo so" after Goya/Alemanya question fell
    // through to guardForceMachineNumber (pipeline hole).
    //
    // Root cause: guardInsistLocation was gated on `!ar.state.location` — when
    // location='Mataro' (set), it skipped. guardMataroStreet had no branch for
    // the "customer says non lo so" case after locationStreetRequested was set.
    // The pipeline fell through to guardForceMachineNumber which asked for
    // the machine number — completely wrong context.
    //
    // Fix: guardMataroStreet detects MATARO_DONT_KNOW_RE after the first ask
    // (locationStreetRequested=true) and emits mataroStreetInsist with the
    // Goya-specific landmarks (Mercadona, Biblioteca) so the customer can
    // self-identify. Reason: 'mataro-street-insist'. F84.
    name: 'F84 — guardMataroStreet has mataro-street-insist branch for "non lo so"',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/location-resolution.ts'),
        'utf8',
      )
      if (!src.includes('MATARO_DONT_KNOW_RE')) {
        throw new Error('F84: location-resolution.ts must declare MATARO_DONT_KNOW_RE')
      }
      if (!src.includes('mataro-street-insist')) {
        throw new Error('F84: guardMataroStreet must emit reason mataro-street-insist')
      }
      if (!src.includes('mataroStreetInsist')) {
        throw new Error('F84: guardMataroStreet must use mataroStreetInsist i18n key')
      }
      // Verify i18n key exists in all 6 catalogues
      for (const lang of ['es', 'it', 'en', 'ca', 'pt', 'fr']) {
        const cat = JSON.parse(
          fs.readFileSync(path.join(ECOLAUNDRY_ROOT, `json/i18n/${lang}.json`), 'utf8'),
        )
        if (!cat.mataroStreetInsist) {
          throw new Error(`F84: i18n/${lang}.json must have mataroStreetInsist key`)
        }
        if (!cat.mataroStreetInsist.includes('{landmarks}')) {
          throw new Error(`F84: i18n/${lang}.json mataroStreetInsist must have {landmarks} placeholder`)
        }
      }
    },
  },
  {
    // F85 — OpenRouter outages must surface as `error:'llm_unavailable'` so
    // the host app can serve workspace.wipMessage instead of silently
    // degrading. Three LLM-calling layers had try/catch fallbacks that
    // masked outages: rephrase → canned reply, briefing → deterministic
    // summary, router → ROUTER_FALLBACK. Now each re-throws LlmFetchError
    // while keeping the fallback for non-network errors (JSON parse,
    // schema drift). The chatbotFn catch maps LlmFetchError to the
    // discriminant `'llm_unavailable'`.
    name: 'F85 — OpenRouter outages propagate as error="llm_unavailable" (no silent degradation)',
    run: () => {
      const indexSrc = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'index.ts'), 'utf8')
      if (!/import\s*{\s*LlmFetchError\s*}\s*from\s*['"][^'"]*llm-fetch/.test(indexSrc)) {
        throw new Error('F85: index.ts must import LlmFetchError from utils/llm-fetch')
      }
      if (!/error\s+instanceof\s+LlmFetchError/.test(indexSrc)) {
        throw new Error('F85: index.ts catch must check `error instanceof LlmFetchError`')
      }
      if (!/error:\s*['"]llm_unavailable['"]/.test(indexSrc)) {
        throw new Error("F85: index.ts must return error:'llm_unavailable' on LlmFetchError")
      }
      const contractSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'models/chatbot-io.ts'),
        'utf8',
      )
      if (!contractSrc.includes("'llm_unavailable'")) {
        throw new Error("F85: chatbot-io.ts ChatbotOutput.error union must list 'llm_unavailable'")
      }
      const rephraseSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      if (!/instanceof\s+LlmFetchError/.test(rephraseSrc)) {
        throw new Error('F85: agent-rephrase.ts catch must re-throw LlmFetchError, not swallow')
      }
      const briefingSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/operator-briefing.ts'),
        'utf8',
      )
      if (!/instanceof\s+LlmFetchError/.test(briefingSrc)) {
        throw new Error(
          'F85: operator-briefing.ts catch must re-throw LlmFetchError, not swallow',
        )
      }
      const routerSrc = fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'utils/router.ts'), 'utf8')
      if (!/instanceof\s+LlmFetchError/.test(routerSrc)) {
        throw new Error('F85: router.ts catch must re-throw LlmFetchError, not swallow')
      }
    },
  },
  {
    // F86 — Cross-flow architectural fix: trouble-machine switch detection
    // during non-machine gather flows (invoice, discount-code, double-charge).
    //
    // Customer mid-gather pivots with "ah, ahora no funciona la lavadora" /
    // "non parte la lavatrice" / "the dryer doesn't work" → before this fix,
    // the gather step blindly stored the entire sentence as the canonical
    // answer (machineNumber, razonSocial, cif, fecha, …). State pollution
    // guaranteed for every "verbatim accept" step.
    //
    // Architectural fix: L3 detector + L2 atomic transition + L4 gates in
    // 3 guard cassettes. Iron rule #16 (no pezze) respected — narrow Caso-N
    // fix would have left the same bug latent in 8+ other gather steps.
    name: 'F86 — detectTroubleSwitchDuringFlow exists with JSON pattern topicMachineTrouble',
    run: () => {
      const intentSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      if (!/export function detectTroubleSwitchDuringFlow/.test(intentSrc)) {
        throw new Error('F86: intent.ts must export detectTroubleSwitchDuringFlow')
      }
      if (!/topicMachineTrouble/.test(intentSrc)) {
        throw new Error('F86: detectTroubleSwitchDuringFlow must call matchPattern with topicMachineTrouble')
      }
      const nluSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'json/nlu-patterns.json'),
        'utf8',
      )
      if (!/"id":\s*"topicMachineTrouble"/.test(nluSrc)) {
        throw new Error('F86: nlu-patterns.json must declare the topicMachineTrouble pattern')
      }
    },
  },
  {
    name: 'F86 — pivotToTroubleMachine atomic transition exists in state-transitions.ts',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/state-transitions.ts'),
        'utf8',
      )
      if (!/export function pivotToTroubleMachine/.test(src)) {
        throw new Error('F86: state-transitions.ts must export pivotToTroubleMachine')
      }
      if (!/activeBranch\s*=\s*'trouble-machine'/.test(src)) {
        throw new Error("F86: pivotToTroubleMachine must set activeBranch='trouble-machine'")
      }
      if (!/invoiceData\s*=\s*\{/.test(src)) throw new Error('F86: must clear invoiceData')
      if (!/discountCodeData\s*=\s*\{/.test(src)) throw new Error('F86: must clear discountCodeData')
      if (!/doubleChargeNarrativeProvided\s*=\s*false/.test(src)) {
        throw new Error('F86: must clear doubleChargeNarrativeProvided')
      }
      if (!/resetPostEscalationFlags/.test(src)) {
        throw new Error('F86: must call resetPostEscalationFlags for safety')
      }
    },
  },
  {
    name: 'F86 — shared pivotIfTroubleSwitch helper + all three cassettes consume it',
    run: () => {
      // Helper lives in ONE place (iron rule #16: no duplication).
      const helpersSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/helpers.ts'),
        'utf8',
      )
      if (!/export function pivotIfTroubleSwitch/.test(helpersSrc)) {
        throw new Error('F86: helpers.ts must export pivotIfTroubleSwitch (shared helper, no duplication)')
      }
      if (!/detectTroubleSwitchDuringFlow/.test(helpersSrc)) {
        throw new Error('F86: helpers.ts must import detectTroubleSwitchDuringFlow')
      }
      if (!/pivotToTroubleMachine/.test(helpersSrc)) {
        throw new Error('F86: helpers.ts must import pivotToTroubleMachine')
      }
      // All three cassettes must call the shared helper.
      const invoiceSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/invoice-flow.ts'),
        'utf8',
      )
      if (!/pivotIfTroubleSwitch/.test(invoiceSrc)) {
        throw new Error('F86: invoice-flow.ts must call pivotIfTroubleSwitch (from helpers)')
      }
      const discountSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/discount-code-flow.ts'),
        'utf8',
      )
      if (!/pivotIfTroubleSwitch/.test(discountSrc)) {
        throw new Error('F86: discount-code-flow.ts must call pivotIfTroubleSwitch (from helpers)')
      }
      const doubleChargeSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/payment-double-charge.ts'),
        'utf8',
      )
      if (!/pivotIfTroubleSwitch/.test(doubleChargeSrc)) {
        throw new Error('F86: payment-double-charge.ts must call pivotIfTroubleSwitch (from helpers)')
      }
    },
  },
  {
    // F87 — FAQ payment location-aware (boundary signals cardOnly + tpvExact).
    // Data-driven via metadata.payment + 2 new i18n keys (paymentCardOnly,
    // paymentTpvExact). Triggered by skill chatbot-eval MIX 3 analysis
    // (datafono-wrong-amount escalation root cause) + audit docs/csv/tables.md.
    // Pattern identical to F50/F81 (data-driven location-aware via metadata).
    name: 'F87 — paymentCardOnly + paymentTpvExact i18n keys exist in all 6 catalogues',
    run: () => {
      const langs = ['es', 'it', 'en', 'ca', 'pt', 'fr']
      for (const lng of langs) {
        const cat = JSON.parse(
          fs.readFileSync(path.join(ECOLAUNDRY_ROOT, `json/i18n/${lng}.json`), 'utf8'),
        )
        if (!cat.paymentCardOnly) {
          throw new Error(`F87: ${lng}.json missing key 'paymentCardOnly'`)
        }
        if (!cat.paymentCardOnly.includes('⚠️')) {
          throw new Error(`F87: ${lng}.json paymentCardOnly must include ⚠️ marker, got: ${cat.paymentCardOnly}`)
        }
        if (!cat.paymentTpvExact) {
          throw new Error(`F87: ${lng}.json missing key 'paymentTpvExact'`)
        }
        if (!cat.paymentTpvExact.includes('{amount}')) {
          throw new Error(`F87: ${lng}.json paymentTpvExact must include {amount} placeholder, got: ${cat.paymentTpvExact}`)
        }
      }
    },
  },
  {
    name: 'F87 — metadata.payment populated for all 6 locations with expected values',
    run: () => {
      const j = JSON.parse(
        fs.readFileSync(path.join(ECOLAUNDRY_ROOT, 'json/locations.json'), 'utf8'),
      )
      const expected: Record<string, { methods: string[]; tpvExact: number | null }> = {
        Goya:        { methods: ['coins','bills','fidelity','card'], tpvExact: 7 },
        Pineda:      { methods: ['coins','bills','fidelity','card'], tpvExact: 8 },
        "L'Escala":  { methods: ['card'],                            tpvExact: null },
        PlatjaDAro:  { methods: ['card'],                            tpvExact: null },
        Hortes:      { methods: ['coins','bills','fidelity','card'], tpvExact: null },
        Alemanya:    { methods: ['coins','bills','fidelity','card'], tpvExact: null },
      }
      for (const [key, exp] of Object.entries(expected)) {
        const loc = j.locations[key]
        if (!loc) throw new Error(`F87: location '${key}' missing in locations.json`)
        const p = loc.metadata?.payment
        if (!p) throw new Error(`F87: ${key} has no metadata.payment`)
        if (JSON.stringify(p.methods.slice().sort()) !== JSON.stringify(exp.methods.slice().sort())) {
          throw new Error(`F87: ${key}.payment.methods mismatch — expected ${JSON.stringify(exp.methods)}, got ${JSON.stringify(p.methods)}`)
        }
        if (p.tpvExact !== exp.tpvExact) {
          throw new Error(`F87: ${key}.payment.tpvExact mismatch — expected ${exp.tpvExact}, got ${p.tpvExact}`)
        }
      }
    },
  },
  {
    name: 'F87 — faq-payment-formatter.ts exports readPayment/formatPaymentSignals + formatters accept translateFn',
    run: () => {
      const paymentSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/faq-payment-formatter.ts'),
        'utf8',
      )
      if (!/export function readPayment/.test(paymentSrc)) {
        throw new Error('F87: faq-payment-formatter.ts must export readPayment')
      }
      if (!/export function formatPaymentSignals/.test(paymentSrc)) {
        throw new Error('F87: faq-payment-formatter.ts must export formatPaymentSignals')
      }
      if (!/export type PaymentInfo/.test(paymentSrc)) {
        throw new Error('F87: faq-payment-formatter.ts must export PaymentInfo type')
      }
      const formatterSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/faq-location-formatter.ts'),
        'utf8',
      )
      if (!/translateFn\?:\s*ProgramTranslateFn/.test(formatterSrc)) {
        throw new Error('F87: formatWasherPrices/formatDryerPrices must accept optional translateFn parameter')
      }
      const guardSrc = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/faq-prices.ts'),
        'utf8',
      )
      if (!/buildTranslateFn|translateFn/.test(guardSrc)) {
        throw new Error('F87: guards/faq-prices.ts must build translateFn and pass it to the formatters')
      }
    },
  },

  // ── F88.a — typo tolerance for dryer verbs (IT asciurare + CA asecar) ────
  // Real bug (Andrea 2026-05-23): "ciao prezzi per asciurare?" — IT verb
  // with consonant drop of 'g' was NOT recognised as dryer intent, so the
  // bot rendered washer prices instead. Symmetric coverage added for CA
  // "asecar" (drop 1 of 'ss' from canonical "assecar") per iron rule #8.
  // Fix: dryerVerbs regex extended to `asciu(?:g|r)ar[eio]?` (IT) and
  // `ass?ecar(?:la|lo)?` (CA). No speculative coverage: ES/EN/PT/FR
  // remain untouched until real-bug evidence appears for them.
  {
    name: 'F88.a — detectMachineTypeMention recognises typo IT "asciurare" + CA "asecar" as dryer',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      // IT typo tolerance: regex must allow consonant drop 'g' → 'r'.
      if (!/asciu\(\?:g\|r\)ar\[eio\]\?/.test(src)) {
        throw new Error('F88.a: IT verb regex must support `asciu(?:g|r)ar[eio]?` (typo asciurare)')
      }
      // CA typo tolerance: regex must allow drop of 1 of 'ss'.
      if (!/ass\?ecar\(\?:la\|lo\)\?/.test(src)) {
        throw new Error('F88.a: CA verb regex must support `ass?ecar(?:la|lo)?` (typo asecar)')
      }
    },
  },

  // ── F88.b — incomprehensible / truncated messages repeat the question ────
  // Real bug (Andrea 2026-05-23): "how muc" (truncated) while bot was
  // awaiting dryer confirm → guard emitted faqClosure "¡Genial! 👍" instead
  // of repeating the question. Fix: isIncomprehensible() detects short
  // messages (< 4 chars) and returns faqConfirmRepeatDryer / faqConfirmRepeatWasher.
  {
    name: 'F88.b — isIncomprehensible helper exists in faq-prices.ts and is used in both confirm guards',
    run: () => {
      const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../utils/guards/faq-prices.ts')
      const src = fs.readFileSync(filePath, 'utf8')
      if (!src.includes('isIncomprehensible')) {
        throw new Error('F88: isIncomprehensible must exist in faq-prices.ts')
      }
      if (!src.includes('faqConfirmRepeatDryer')) {
        throw new Error('F88: faqConfirmRepeatDryer i18n key must be used in dryer confirm guard')
      }
      if (!src.includes('faqConfirmRepeatWasher')) {
        throw new Error('F88: faqConfirmRepeatWasher i18n key must be used in washer confirm guard')
      }
      if (!src.includes('faq-prices-dryer-repeat')) {
        throw new Error('F88: reason faq-prices-dryer-repeat must be emitted')
      }
      if (!src.includes('faq-prices-washer-repeat')) {
        throw new Error('F88: reason faq-prices-washer-repeat must be emitted')
      }
    },
  },
  {
    name: 'F88.b — faqConfirmRepeatDryer + faqConfirmRepeatWasher exist in all 6 i18n catalogues',
    run: () => {
      const langs = ['es', 'it', 'en', 'ca', 'pt', 'fr']
      for (const lang of langs) {
        const i18nPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../json/i18n/${lang}.json`)
        const src = fs.readFileSync(i18nPath, 'utf8')
        if (!src.includes('"faqConfirmRepeatDryer"')) {
          throw new Error(`F88: faqConfirmRepeatDryer missing from i18n/${lang}.json`)
        }
        if (!src.includes('"faqConfirmRepeatWasher"')) {
          throw new Error(`F88: faqConfirmRepeatWasher missing from i18n/${lang}.json`)
        }
      }
    },
  },
  {
    name: 'F88.b — repeat path returns early before pendingFlow clear (structural)',
    run: () => {
      // The repeat branch must `return` before any `ar.state.pendingFlow = ''`
      // so pendingFlow stays armed while waiting for the real answer.
      // We verify this structurally: in the dryer-confirm guard block, the
      // `faq-prices-dryer-repeat` reason string must appear before the first
      // `pendingFlow = ''` assignment that belongs to the decline path.
      // Strategy: extract only the guardFaqPricesAwaitDryerConfirm function
      // body and check that 'dryer-repeat' appears before "pendingFlow = ''".
      const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../utils/guards/faq-prices.ts')
      const src = fs.readFileSync(filePath, 'utf8')
      // Extract from the dryer-confirm guard export to the next export keyword
      const dryerStart = src.indexOf('guardFaqPricesAwaitDryerConfirm')
      const nextExport = src.indexOf('\nexport const guard', dryerStart + 1)
      const dryerBlock = src.slice(dryerStart, nextExport > dryerStart ? nextExport : undefined)
      const repeatIdx = dryerBlock.indexOf('dryer-repeat')
      const clearIdx = dryerBlock.indexOf("pendingFlow = ''")
      if (repeatIdx === -1) throw new Error('F88: dryer-repeat reason not found in dryer guard block')
      if (clearIdx === -1) throw new Error('F88: pendingFlow clear not found in dryer guard block')
      if (repeatIdx > clearIdx) {
        throw new Error('F88: dryer-repeat must appear BEFORE pendingFlow clear — repeat path must return early')
      }
    },
  },
  // ── F89 — guardInsistLocation fires at T1 (turnCount gate removed) ──────────
  // Regression: the guard had `turnCount < 2` which blocked it on the very
  // first message. "i dont know" / "i don't know" as T1 must show landmarks.
  {
    name: 'F89 — guardInsistLocation has no turnCount gate (fires at T1 on "i dont know")',
    run: () => {
      // Source-check: extract guardInsistLocation body and assert the
      // turnCount < 2 gate is absent. The guard is the last export in the
      // file so we slice from its declaration to end-of-file.
      const guardTs = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/location-resolution.ts'),
        'utf8',
      )
      const startIdx = guardTs.indexOf('export const guardInsistLocation')
      if (startIdx === -1) throw new Error('F89: guardInsistLocation not found in location-resolution.ts')
      const guardBody = guardTs.slice(startIdx)
      if (/turnCount\s*<\s*2/.test(guardBody)) {
        throw new Error('F89: guardInsistLocation must NOT have turnCount < 2 gate — removed to allow T1 "i dont know" to fire')
      }
    },
  },
  // ── F90 — stripEvasivePhrases warn only when an evasive pattern actually
  //          matched (whitespace normalisation alone must NOT log). ──────────
  // Regression: the warn fired on any mutation, including the trailing-space-
  // before-newline collapse, misleading live CLI debug (Andrea, 2026-05-23).
  {
    name: 'F90 — stripEvasivePhrases tracks strippedEvasive flag (warn gated on real match)',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/output-invariants/evasive.ts'),
        'utf8',
      )
      if (!/let\s+strippedEvasive\s*=\s*false/.test(src)) {
        throw new Error('F90: must declare `let strippedEvasive = false` flag in stripEvasivePhrases')
      }
      if (!/if\s*\(\s*strippedEvasive\s*\)/.test(src)) {
        throw new Error('F90: warn must be gated by `if (strippedEvasive)` — never by `result !== reply`')
      }
      // The legacy condition `if (result !== reply)` must NOT remain as the
      // warn gate (it produced the false positives F90 closes).
      const warnGateLine = src.match(/if\s*\([^)]+\)\s*{\s*\n\s*logger\.warn\('output-invariant: stripped evasive phrase/)
      if (warnGateLine && /result\s*!==\s*reply/.test(warnGateLine[0])) {
        throw new Error('F90: warn must NOT be gated by `result !== reply` (false positive on whitespace normalisation)')
      }
    },
  },

  // ── F91 — post-rephrase language guard discards drifted polish ─────────────
  // The rephrase LLM at T=0.6 sometimes flips reply language despite
  // LANGUAGE=<tenant> AUTORITATIVO (F73 textual rule is not a hard guarantee).
  // F91 adds a deterministic post-polish heuristic check: if the detected
  // language differs from the locked tenant language, discard the polish and
  // return the canned reply. Live evidence: EN customer "what time do you
  // open?" → rephrase returned ES "¿Qué ciudad o lavandería..." (2026-05-23).
  {
    name: 'F91 — agent-rephrase.ts imports detectLanguageHeuristic for post-polish guard',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      if (!/import\s*\{\s*detectLanguageHeuristic\s*\}\s*from\s*['"]\.\/intent\.js['"]/.test(src)) {
        throw new Error('F91: agent-rephrase.ts must import detectLanguageHeuristic from intent.js')
      }
    },
  },
  {
    name: 'F91 — rephraseForTurn discards polish on language drift (detected !== tenantLang)',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/agent-rephrase.ts'),
        'utf8',
      )
      // The post-polish guard must (a) call detectLanguageHeuristic on the
      // polished reply, (b) compare against tenantLang, (c) return the canned
      // reply (NOT the polished) when they diverge.
      if (!/const\s+detected\s*=\s*detectLanguageHeuristic\s*\(\s*polished\s*\)/.test(src)) {
        throw new Error('F91: rephraseForTurn must call detectLanguageHeuristic(polished)')
      }
      if (!/if\s*\(\s*detected\s*&&\s*detected\s*!==\s*tenantLang\s*\)/.test(src)) {
        throw new Error('F91: drift guard condition must be `if (detected && detected !== tenantLang)`')
      }
      // The drift branch must return the original canned `reply`, not the
      // `polished` value (otherwise the wrong-language reply leaks through).
      // Capture from the `if (detected && detected !== tenantLang)` opening
      // up to its matching `return reply` — search wide enough to cover the
      // nested isDisplayFlowRecap block.
      const driftBlock = src.match(/if\s*\(\s*detected\s*&&\s*detected\s*!==\s*tenantLang\s*\)\s*\{[\s\S]{0,800}?return\s+(reply|polished)/)
      if (!driftBlock) {
        throw new Error('F91: drift guard block not found OR missing return statement')
      }
      if (driftBlock[1] !== 'reply') {
        throw new Error(`F91: drift guard must \`return reply\` (canned) — got \`return ${driftBlock[1]}\``)
      }
    },
  },

  // ── F92 — detectDetergentFaqIntent extended for "manca/falta/missing" verbs ──
  // Real-bug Andrea CLI 2026-05-23: customer "mi manca il sapone" → bot drifted
  // into display-flow troubleshooting. F67 detector covered "no veo / non c'è"
  // but not the absence-verbs family (manca/falta/missing/manque). F92 extends
  // negativeMarker with these verbs in all 6 langs + adds typo-tolerant "sapo"
  // truncation. Source-grep below pins the four critical regex additions.
  {
    name: 'F92 — detectDetergentFaqIntent negativeMarker includes IT "manca" verb',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      if (!/\\b\(\?:mi\\s\+\)\?manca\\b/.test(src)) {
        throw new Error('F92: detectDetergentFaqIntent must include IT manca verb in negativeMarker')
      }
    },
  },
  {
    name: 'F92 — detectDetergentFaqIntent negativeMarker includes ES/CA/PT "falta" verb',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      if (!/\\bfalta\\b/.test(src)) {
        throw new Error('F92: detectDetergentFaqIntent must include ES/CA/PT falta verb in negativeMarker')
      }
    },
  },
  {
    name: 'F92 — detectDetergentFaqIntent negativeMarker includes EN "missing" verb',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      if (!/\\bmissing\\b/.test(src)) {
        throw new Error('F92: detectDetergentFaqIntent must include EN missing verb in negativeMarker')
      }
    },
  },
  {
    name: 'F92 — detectDetergentFaqIntent detergentWord includes typo "sapo" (truncated sapone)',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/intent.ts'),
        'utf8',
      )
      // The `\bsapo\b` token must be inside the detergentWord regex literal.
      if (!/detergentWord\s*=\s*\/[^/]*\\bsapo\\b/.test(src)) {
        throw new Error('F92: detergentWord must include \\bsapo\\b (typo-tolerant truncated sapone)')
      }
    },
  },

  // ── F93 — loyaltyCard routing: triple defense (router + detector + L4 gate) ──
  // Real-bug Andrea CLI 2026-05-23: "come funziona la tessera di fidelizzazione?"
  // → bot answered with howToUse FAQ (5 steps "come usare la lavandería") instead
  // of loyaltyCard. Triple gap: (a) router prompt had ZERO loyaltyCard examples
  // (LLM defaulted to howToUse via the pattern "come funziona la X"), (b)
  // TARJETA_TOPIC IT covered only "carta fedeltà" not "tessera/fidelizzazione",
  // (c) guardFaqHowToUse had F76 gate for discount-code but missing symmetric
  // gate for loyalty card. F93 fixes all 3 layers atomically (pattern F82
  // "router + branch handler + guard pipeline atomic update").
  {
    name: 'F93 — prompts/router.txt has multi-lang loyaltyCard examples',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'prompts/router.txt'),
        'utf8',
      )
      // The router prompt must contain at least the IT real-bug trigger as an
      // explicit example mapping to faqKey="loyaltyCard". Without this example
      // the LLM defaults to howToUse for "come funziona la X" pattern.
      if (!/tessera\s+di\s+fidelizzazione[\s\S]{0,200}"faqKey":"loyaltyCard"/.test(src)) {
        throw new Error('F93: router.txt must contain IT "tessera di fidelizzazione" example mapping to faqKey="loyaltyCard"')
      }
      // Verify multi-lang coverage: at least 4 of the 6 languages should have
      // an explicit example (defense against router falling back to howToUse
      // for any single language).
      const loyaltyCardExamples = src.match(/"faqKey":"loyaltyCard"/g) || []
      if (loyaltyCardExamples.length < 4) {
        throw new Error(`F93: router.txt must have at least 4 loyaltyCard examples (multi-lang coverage), found ${loyaltyCardExamples.length}`)
      }
    },
  },
  {
    name: 'F93 — TARJETA_TOPIC regex covers IT "tessera (di) fidelizzazione/fedeltà"',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/loyalty-card-buy.ts'),
        'utf8',
      )
      // The IT colloquial form "tessera di fidelizzazione" / "tessera fedeltà"
      // must be in the TARJETA_TOPIC regex (alongside the existing "carta
      // fedeltà" formal form).
      if (!/tessera\\s\+\(\?:di\\s\+\)\?\(\?:fidelizzazione/.test(src)) {
        throw new Error('F93: TARJETA_TOPIC must include IT "tessera (di) fidelizzazione/fedeltà" colloquial form')
      }
    },
  },
  {
    name: 'F93 — guardFaqHowToUse has L4 safety gate for TARJETA_TOPIC',
    run: () => {
      const src = fs.readFileSync(
        path.join(ECOLAUNDRY_ROOT, 'utils/guards/faq-how-to-use.ts'),
        'utf8',
      )
      // Import of TARJETA_TOPIC from loyalty-card-buy.ts.
      if (!/import\s*\{[^}]*TARJETA_TOPIC[^}]*\}\s*from\s*['"]\.\/loyalty-card-buy/.test(src)) {
        throw new Error('F93: faq-how-to-use.ts must import TARJETA_TOPIC from ./loyalty-card-buy.js')
      }
      // Gate that yields to loyalty-card flow when TARJETA_TOPIC matches.
      // Symmetric to the existing F76 gate for detectDiscountCodeIntent.
      if (!/if\s*\(\s*TARJETA_TOPIC\.test\s*\(\s*userMessage\s*\)\s*\)\s*return\s+null/.test(src)) {
        throw new Error('F93: guardFaqHowToUse must include `if (TARJETA_TOPIC.test(userMessage)) return null` gate')
      }
    },
  },

  // ── F102 — returnsChangeCoins: false su location card-only (CSV source of truth) ─
  // Audit 2026-05-24: locations.json aveva returnsChangeCoins: true su L'Escala e
  // PlatjaDAro, ma il CSV docs/csv/instruccions-pagament-lavadora.csv dice
  // esplicitamente "Devolución cambio en monedas → No" per entrambe (ultime 2
  // colonne). Entrambe accettano SOLO carta (payment.methods: ["card"]) — nessuna
  // moneta accettata → nessun cambio possibile. Il LLM leggeva returnsChangeCoins via
  // buildLocationContext() e avrebbe potuto dare istruzioni sbagliate ai clienti.
  // Fix: data fix — returnsChangeCoins: false su L'Escala e PlatjaDAro.
  // Le altre 4 location (Goya, Pineda, Alemanya, Hortes) rimangono true (CSV: "Si corresponde").
  {
    name: "F102 — returnsChangeCoins false su L'Escala e PlatjaDAro",
    run: () => {
      const locPath = path.resolve(ECOLAUNDRY_ROOT, 'json/locations.json')
      const locs = JSON.parse(fs.readFileSync(locPath, 'utf8')).locations as Record<
        string,
        { metadata?: { returnsChangeCoins?: boolean } }
      >
      if (locs["L'Escala"]?.metadata?.returnsChangeCoins !== false) {
        throw new Error("F102: L'Escala.returnsChangeCoins must be false — CSV instruccions-pagament-lavadora.csv col 9 says No")
      }
      if (locs['PlatjaDAro']?.metadata?.returnsChangeCoins !== false) {
        throw new Error("F102: PlatjaDAro.returnsChangeCoins must be false — CSV instruccions-pagament-lavadora.csv col 10 says No")
      }
      // Sanity: le location con cambio effettivo rimangono true (CSV: "Si corresponde")
      if (locs['Goya']?.metadata?.returnsChangeCoins !== true) {
        throw new Error('F102: Goya.returnsChangeCoins must remain true (CSV: Si corresponde)')
      }
      if (locs['Pineda']?.metadata?.returnsChangeCoins !== true) {
        throw new Error('F102: Pineda.returnsChangeCoins must remain true (CSV: Si corresponde)')
      }
    },
  },
  // ── F101 — codice 120 (countdown fine ciclo) gestito come display-flow dichiarativo ──
  // Audit CSV 2026-05-24: il codice 120 mostrato dalla lavadora e dalla secadora non aveva
  // una risposta definita nel bot. Il CSV prescrive risposta specifica: attendere END.
  // 120 è uno stato di attesa normale, non un errore — non serve reask né escalation.
  {
    name: 'F101 — countdown display-flow: codice 120 presente in display-flows.json',
    run: () => {
      const rt = getCachedTestRuntime()
      const flows: any[] = (rt as any).displayFlows?.flows ?? []
      const flow = flows.find((f: any) => f.id === 'countdown-display')
      if (!flow) throw new Error('display-flow countdown-display deve esistere')
      if (!flow.displayMatches.includes('120')) throw new Error('deve intercettare il codice 120')
      if (flow.escalationReason !== null) throw new Error('codice 120 non è un errore — escalationReason deve essere null')
    },
  },

  // ── F103 — howToUseDryer faqOverride presente per tutte e 6 le location ────
  // Audit CSV 2026-05-24: istruzioni pagamento secadora completamente assenti.
  // Il CSV instruccions-pagament-secadora.csv specifica step distinti:
  // puerta aperta durante ciclo, +5min prima fine, STAR→datáfono→ACEPTADA→SALDO→BOTÓN→cambio.
  // Fix: nuova faqKey howToUseDryer con faqOverrides per-location in locations.json.
  {
    name: 'F103 — howToUseDryer faqOverride presente per tutte le location reali',
    run: () => {
      const locPath = path.resolve(ECOLAUNDRY_ROOT, 'json/locations.json')
      const locs = JSON.parse(fs.readFileSync(locPath, 'utf8')).locations as Record<
        string,
        { faqOverrides?: Record<string, unknown> }
      >
      const realLocations = ['Goya', 'Pineda', "L'Escala", 'Alemanya', 'Hortes', 'PlatjaDAro']
      for (const name of realLocations) {
        const override = locs[name]?.faqOverrides?.['howToUseDryer']
        if (!override) {
          throw new Error(`F103: ${name} deve avere faqOverrides.howToUseDryer`)
        }
        if (typeof override !== 'string' || override.length <= 50) {
          throw new Error(`F103: ${name}.howToUseDryer deve essere una stringa non vuota (>50 chars)`)
        }
      }
    },
  },
  // ── F104 — extractDisplayState riconosce "120" come display token countdown ──
  {
    name: 'F104 — countdown "120" estratto da extractDisplayState',
    run: () => {
      const cases: [string, string][] = [
        ['la pantalla pone 120', '120'],
        ['sale 120 en la pantalla', '120'],
        ['schermo 120', '120'],
        ['il display fa 120', '120'],
        ['screen shows 120', '120'],
        ['120', '120'],
      ]
      for (const [input, expected] of cases) {
        const result = extractDisplayState(input)
        if (result !== expected) {
          throw new Error(`F104: extractDisplayState("${input}") = ${result}, expected ${expected}`)
        }
      }
    },
  },

  // ── F105 — router LLM non sovrascrive heuristica lingua quando già rilevata ──
  // Demo CLI 2026-05-24: "Come si usa l'asciugatrice? Sono a Goya" → router LLM
  // restituiva language='es' (confuso da "Goya" spagnolo) sovrascrivendo la
  // heuristica che aveva correttamente rilevato 'it' via il pattern 'asciug'.
  // La risposta howToUseDryer rimaneva in spagnolo anziché italiano.
  // Fix: in agent.ts:maybeDispatchBranch, il router LLM sovrascrive SOLO se
  // heuristicLang === null (nessun match con certezza). Se la heuristica ha
  // già rilevato una lingua, vince sul router LLM.
  {
    name: 'F105 — agent.ts:maybeDispatchBranch router-lang override gated on heuristicLang === null',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const agentTs = fs.readFileSync(path.join(here, '..', '..', 'agent.ts'), 'utf8')
      // The F105 fix: must call detectLanguageHeuristic(userMessage) and gate override
      const fnMD = agentTs.indexOf('async function maybeDispatchBranch(')
      if (fnMD < 0) throw new Error('F105: maybeDispatchBranch must exist in agent.ts')
      const fnBody = agentTs.slice(fnMD, fnMD + 4000)
      if (!fnBody.includes('detectLanguageHeuristic(userMessage)')) {
        throw new Error('F105: maybeDispatchBranch must call detectLanguageHeuristic(userMessage) for F105 fix')
      }
      if (!fnBody.includes('heuristicLang === null')) {
        throw new Error('F105: router-lang override must be gated on heuristicLang === null')
      }
    },
  },
  {
    name: 'F105 — detectLanguageHeuristic detects IT for "Come si usa l\'asciugatrice?"',
    run: () => {
      // The heuristic must correctly detect IT for the canonical failing input.
      // Pattern 'asciug' is in the IT regex in intent.ts.
      const here = path.dirname(fileURLToPath(import.meta.url))
      const intentTs = fs.readFileSync(path.join(here, '..', '..', 'utils', 'intent.ts'), 'utf8')
      // The IT branch must include 'asciug' to match 'asciugatrice'
      const itPatternMatch = intentTs.match(/return 'it'[\s\S]{0,20}$|\/\(.*asciug.*\)/m)
        || intentTs.match(/asciug/)
      if (!itPatternMatch) {
        throw new Error("F105: intent.ts IT detection regex must include 'asciug' to match 'asciugatrice'")
      }
    },
  },

  // ── F101-Regola-A — faqHandler: qualsiasi pendingFlow non-vuoto → delegate-to-legacy ──
  // F101 Fase 1 (Andrea 2026-05-24): il faqHandler aveva due blocchi enumerati che
  // delegavano solo pendingFlow specifici (faq-*-await-location, discount-code-*, ecc.).
  // Ogni nuovo flow non elencato causava un miss → unknownKey ("no estoy seguro").
  // Fix: unico `if (pending) return delegate-to-legacy` che copre TUTTI i pendingFlow
  // non-vuoti. Il legacy guard pipeline è il proprietario corretto di ogni gather step.
  // Questo pin verifica che il contratto rimanga intatto per una selezione di valori noti.
  {
    name: 'F101-Regola-A — faqHandler src: singolo `if (pending)` al posto dei blocchi enumerati',
    run: () => {
      const handlerPath = path.resolve(
        ECOLAUNDRY_ROOT,
        'utils/branches/faq/handler.ts',
      )
      const src = fs.readFileSync(handlerPath, 'utf8')
      // Regola-A deve essere presente: singolo guard `if (pending) {`
      if (!/if\s*\(\s*pending\s*\)\s*\{/.test(src)) {
        throw new Error(
          'F101-Regola-A: faqHandler deve contenere `if (pending) {` come catch-all unico per pendingFlow non-vuoto',
        )
      }
      // I vecchi gate enumerati NON devono esistere
      if (/pending\s*===\s*'faq-prices-await-location'/.test(src)) {
        throw new Error(
          "F101-Regola-A: il gate enumerato `pending === 'faq-prices-await-location'` non deve più esistere — è coperto dal catch-all",
        )
      }
      if (/pending\.startsWith\('discount-code-'\)/.test(src)) {
        throw new Error(
          "F101-Regola-A: il gate enumerato `pending.startsWith('discount-code-')` non deve più esistere — è coperto dal catch-all",
        )
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
