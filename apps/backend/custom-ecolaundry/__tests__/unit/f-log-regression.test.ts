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
      if (!/lastFaqKey:\s*'pricing'\s*\|\s*'openingHours'\s*\|\s*null/.test(content)) {
        throw new Error("F61: state.ts must declare lastFaqKey: 'pricing' | 'openingHours' | null")
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
      if (!/faq-prices-await-washer-confirm/.test(content)) {
        throw new Error('F58: faq handler must include faq-prices-await-washer-confirm in the delegate-to-legacy condition')
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
    name: 'F50 — new cassette files faq-hours.ts + faq-prices.ts exist and stay under 150 lines',
    run: () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const hoursPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-hours.ts')
      const pricesPath = path.resolve(here, '..', '..', 'utils', 'guards', 'faq-prices.ts')
      for (const p of [hoursPath, pricesPath]) {
        if (!fs.existsSync(p)) throw new Error(`F50: missing ${p}`)
        const lines = fs.readFileSync(p, 'utf8').split('\n').length
        if (lines > 150) throw new Error(`F50: ${path.basename(p)} exceeds 150 lines (${lines})`)
      }
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
      if (!/faqKey\s*===\s*['"]pricing['"]/.test(content) || !/faqKey\s*===\s*['"]openingHours['"]/.test(content)) {
        throw new Error('F50: faqHandler must delegate pricing/openingHours to legacy pipeline')
      }
      // T2+ delegation: sticky pendingFlow with empty routerDetails.
      if (!/pending\s*===\s*['"]faq-prices-await-location['"]/.test(content)) {
        throw new Error('F50: faqHandler must delegate when pendingFlow=faq-prices-await-location (T2+)')
      }
      if (!/pending\s*===\s*['"]faq-prices-await-dryer-confirm['"]/.test(content)) {
        throw new Error('F50: faqHandler must delegate when pendingFlow=faq-prices-await-dryer-confirm (T3)')
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
    name: 'F66 — agent-extract does NOT set displayState when machineType is unknown (guard present)',
    run: () => {
      // The fix adds `&& (state.machineType || state.displayState)` to the
      // primary display-capture branch. If that guard is removed, a customer
      // typing "AL001" while answering the location question would prematurely
      // set displayState and the flow would start without asking the display Q.
      const extractPath = path.resolve(__dirname, '..', '..', 'utils', 'agent-extract.ts')
      const content = fs.readFileSync(extractPath, 'utf8')
      // The guard must appear on the same line as newDisplay !== state.displayState
      if (!/(newDisplay && newDisplay !== state\.displayState && \(state\.machineType \|\| state\.displayState\))/.test(content)) {
        throw new Error(
          'F66: agent-extract.ts must guard displayState capture with (state.machineType || state.displayState) — see F66 in CLAUDE.md',
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
