// End-to-end orchestration tests (NO LLM) — multi-topic conversations.
//
// SCENARIO (Andrea, 2026-05-09):
//   Verify that the bot can handle complex sessions where the customer
//   pivots between multiple topics (discount code → display incident →
//   FAQ → invoice) without losing state coherence.
//
// What this test pins:
//   1. **MIXED ORCHESTRATION** — customer asks several different things
//      in one session: discount code → "me sale SEL" (topic switch) →
//      "PUSH PROG" (another switch) → "DOOR" → "horarios" (FAQ) →
//      "factura" (invoice). Each transition must reach the right guard
//      WITHOUT the bot getting stuck or mixing previous-topic content.
//   2. **CODE RETRY + RECOVERY** — customer types invalid format, bot
//      asks for retry, customer corrects with valid code, flow advances
//      to name/pueblo/machine/door (Bug #13 happy path).
//   3. **CARD DIGITS VALIDATION** — bot asks last 4 digits, customer
//      types 5 digits, bot re-asks. Customer types 4 digits, flow
//      advances. (Caso 6 step Andrea explicitly mentioned.)
//
// Run with:
//   node --import tsx __tests__/unit/orchestration-mix-flow-e2e.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { runGuardPipeline } from '../../utils/guards/index.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

interface Turn {
  user: string
  expectReason?: string
  expectReplyContains?: RegExp
  expectReplyDoesNotContain?: RegExp
  expectNoGuardFired?: boolean // for LLM-territory turns
  assertState?: (ar: AgentRuntime) => void
  description?: string
}

function makeAr(): AgentRuntime {
  return {
    state: { ...createInitialState(), turnCount: 0 },
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface TranscriptLine {
  speaker: 'usuario' | 'bot'
  text: string
  reason?: string
  description?: string
}

function runConversation(ar: AgentRuntime, turns: Turn[]): TranscriptLine[] {
  const transcript: TranscriptLine[] = []
  for (const turn of turns) {
    ar.state.turnCount += 1
    autoExtractFacts(ar, turn.user)
    const outcome = runGuardPipeline(ar, turn.user)

    transcript.push({ speaker: 'usuario', text: turn.user, description: turn.description })

    if (turn.expectNoGuardFired) {
      if (outcome) {
        throw new Error(
          `Turn "${turn.user}": expected NO guard to fire (LLM territory), but got "${outcome.reason}".`,
        )
      }
      transcript.push({ speaker: 'bot', text: '<LLM territory — would call OpenAI>' })
    } else {
      if (!outcome) {
        throw new Error(
          `Turn "${turn.user}": expected a deterministic guard to fire, but none did.`,
        )
      }
      transcript.push({ speaker: 'bot', text: outcome.reply, reason: outcome.reason })
      if (turn.expectReason && outcome.reason !== turn.expectReason) {
        throw new Error(
          `Turn "${turn.user}": expected reason "${turn.expectReason}", got "${outcome.reason}".\nReply: ${outcome.reply}`,
        )
      }
      if (turn.expectReplyContains && !turn.expectReplyContains.test(outcome.reply)) {
        throw new Error(
          `Turn "${turn.user}": reply did not match ${turn.expectReplyContains}.\nReply: ${outcome.reply}`,
        )
      }
      if (turn.expectReplyDoesNotContain && turn.expectReplyDoesNotContain.test(outcome.reply)) {
        throw new Error(
          `Turn "${turn.user}": reply must NOT match ${turn.expectReplyDoesNotContain}.\nReply: ${outcome.reply}`,
        )
      }
    }
    if (turn.assertState) turn.assertState(ar)
  }
  return transcript
}

function printTranscript(title: string, transcript: TranscriptLine[]): void {
  console.log(`\n┌─ ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}`)
  for (const line of transcript) {
    const speaker = line.speaker === 'usuario' ? '👤 user' : '🤖 bot '
    const reason = line.reason ? `  [${line.reason}]` : ''
    const annot = line.description ? `  // ${line.description}` : ''
    const wrapped = line.text.replace(/\n/g, '\n         ')
    console.log(`│ ${speaker}: ${wrapped}${reason}${annot}`)
  }
  console.log('└' + '─'.repeat(80))
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── 1. MIXED ORCHESTRATION ───────────────────────────────────────────────
  // Customer pivots between several topics in one session. We verify each
  // pivot reaches the correct guard. Some turns are LLM-territory (the
  // bot's resolution of a flow needs the LLM); we mark those explicitly.
  {
    name: 'MIX 1: code → topic-switch SEL → topic-switch PUSH PROG → DOOR → horarios → factura',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        // T1 — customer asks for help with a code
        {
          user: 'Tengo un código y no sé cómo usarlo',
          expectReason: 'discount-code-ask',
          expectReplyContains: /c[oó]digo\s+exacto/i,
          description: 'discount-code intent → ask for code',
        },
        // T2 — invalid format, retry
        {
          user: 'ABC123',
          expectReason: 'discount-code-format-retry',
          expectReplyContains: /no\s+encaja|comprobarlo/i,
          description: 'invalid format → retry (no escalate)',
        },
        // T3 — customer pivots: now reports SEL on the machine.
        // The topic-switch detector resets the discount-code flow because
        // the message contains a display code (SEL) and a "ahora me sale"
        // pivot phrase. Bot then asks for the (unknown) location; reason is
        // `unknown-location` (autoExtractFacts captured the message as a
        // candidate that didn't resolve) which provides the same UX value
        // as `force-location` plus a list of available laundries.
        {
          user: 'ahora me sale SEL en la pantalla',
          expectReason: 'unknown-location',
          expectReplyContains: /lavander[íi]as?\s+son|lavander[íi]a|d[óo]nde\s+est[áa]s/i,
          description: 'TOPIC SWITCH to SEL incident → reset + ask location',
          assertState: (ar) => {
            // State should have reset: discount-code flow gone, displayState='SEL'
            if (ar.state.displayState !== 'SEL') {
              throw new Error(`SEL must be captured: got "${ar.state.displayState}"`)
            }
            if (ar.state.pendingFlow.startsWith('discount-code')) {
              throw new Error(`discount-code flow must be cleared after topic switch`)
            }
          },
        },
        // T4 — customer gives location. machineType still empty (the T1
        // trigger "Tengo un código" had no machine word), so the canonical
        // gather asks for type next.
        {
          user: 'Goya',
          expectReason: 'force-machine-type',
          expectReplyContains: /lavadora\s+o\s+(?:una\s+)?secadora/i,
          description: 'location captured → ask type (T1 "Tengo un código" had no type word)',
        },
        // T5 — customer says lavadora and pivots: now PUSH PROG instead of SEL
        {
          user: 'lavadora, en realidad me sale PUSH PROG',
          expectReason: 'force-machine-number',
          expectReplyContains: /n[uú]mero/i,
          description: 'type captured + display pivot to PUSH PROG → ask number',
          assertState: (ar) => {
            if (ar.state.machineType !== 'washer') {
              throw new Error(`type must be washer: got "${ar.state.machineType}"`)
            }
            if (ar.state.displayState !== 'PUSH') {
              throw new Error(`PUSH must be captured: got "${ar.state.displayState}"`)
            }
            if (ar.state.displayLabel !== 'PUSH PROG') {
              throw new Error(`label must be "PUSH PROG": got "${ar.state.displayLabel}"`)
            }
          },
        },
        // T6 — customer gives number, autoStart fires for PUSH PROG
        {
          user: '5',
          expectReason: 'auto-start-machine-flow',
          expectReplyContains: /60[º°]|fr[íi]o|programa/i,
          description: 'all facts present → flow engine emits PUSH PROG guidance',
        },
        // T7 — customer pivots: asks for opening hours (FAQ during active flow)
        {
          user: '¿Cuál es el horario?',
          expectReason: 'opening-hours',
          expectReplyContains: /8:00\s+a\s+22:00/i,
          description: 'FAQ during active flow → opening-hours wins',
        },
        // T8 — customer asks for invoice (Caso 9 trigger)
        {
          user: 'también quiero una factura',
          expectReason: 'invoice',
          expectReplyContains: /raz[óo]n\s+social|m[áa]quina|lavadora/i,
          description: 'invoice intent → invoice flow takes over (location already known)',
          assertState: (ar) => {
            if (!ar.state.pendingFlow.startsWith('invoice-')) {
              throw new Error(`invoice flow must be active: got "${ar.state.pendingFlow}"`)
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('MIX 1 — multi-topic orchestration', transcript)
    },
  },

  // ── 2. CODE WRONG → RETRY → CORRECT ──────────────────────────────────────
  // Customer types an invalid code, bot retries (Bug #13 fix), customer
  // types a valid code, the discount-code flow advances normally.
  {
    name: 'MIX 2: invalid code → retry → valid code → flow advances to name',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        {
          user: 'Tengo un código',
          expectReason: 'discount-code-ask',
          description: 'discount-code intent',
        },
        {
          user: 'xxjdse7',
          expectReason: 'discount-code-format-retry',
          expectReplyContains: /comprobarlo|escr[íi]b[íi]rmelo|no\s+encaja/i,
          description: '1st invalid → retry hint',
          assertState: (ar) => {
            if (ar.state.discountCodeAskAttempts !== 1) {
              throw new Error(
                `attempts must be 1, got ${ar.state.discountCodeAskAttempts}`,
              )
            }
          },
        },
        {
          user: 'SAU2904266',
          expectReason: 'discount-code-ask-name',
          expectReplyContains: /nombre/i,
          description: 'valid code → counter resets, flow advances to name',
          assertState: (ar) => {
            if (ar.state.discountCodeAskAttempts !== 0) {
              throw new Error(
                `counter must reset on success, got ${ar.state.discountCodeAskAttempts}`,
              )
            }
            if (ar.state.discountCodeData.letters !== 'SAU') {
              throw new Error(
                `letters must be parsed: got "${ar.state.discountCodeData.letters}"`,
              )
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('MIX 2 — code retry then valid', transcript)
    },
  },

  // ── 3. CARD DIGITS — 5 DIGITS → RE-ASK → 4 DIGITS ────────────────────────
  // Caso 6 step "últimos 4 dígitos de la tarjeta": bot asks 4, customer
  // types 5 (or 3, or no-digits), bot re-asks. After 4 valid digits, flow
  // advances to receipt + closure.
  {
    name: 'MIX 3: bot asks 4 digits, customer gives 5 → re-ask, then 4 valid → continue',
    run: () => {
      const ar = makeAr()
      // Pre-condition: customer is mid Caso 6 SI branch, just gave narrative
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.pendingFlow = 'double-charge-ask-card-digits'
      ar.state.issueSummary = 'double charge — used service: yes — customer reply: sí'
      ar.state.turnCount = 5

      const turns: Turn[] = [
        {
          user: 'He pagado dos veces, no iba',
          expectReason: 'double-charge-ask-card-digits',
          expectReplyContains: /4\s+(?:[úu]ltimos\s+)?d[íi]gitos/i,
          description: 'narrative consumed → bot asks 4 digits',
        },
        {
          user: '48215', // 5 digits — invalid
          expectReason: 'double-charge-card-digits-retry',
          expectReplyContains: /exactamente\s+(?:los\s+)?(?:4|cuatro)\s+(?:[úu]ltimos\s+)?d[íi]gitos|escr[íi]b[íi]rmelos\s+de\s+nuevo/i,
          description: '5 digits → re-ask exactly 4',
          assertState: (ar) => {
            if (ar.state.cardDigitsAskAttempts !== 1) {
              throw new Error(
                `attempts must be 1, got ${ar.state.cardDigitsAskAttempts}`,
              )
            }
            if (ar.state.operatorRequested) {
              throw new Error('NO escalate on first invalid digits')
            }
          },
        },
        {
          user: '4821', // 4 digits — valid
          expectReason: 'double-charge-ask-receipt',
          expectReplyContains: /captura.*pago|formulario.*devoluc/i,
          description: '4 valid digits → continue to receipt + closure',
          assertState: (ar) => {
            if (ar.state.cardDigitsAskAttempts !== 0) {
              throw new Error('counter must reset on success')
            }
            if (!ar.state.operatorRequested) {
              throw new Error('receipt step also escalates for refund handover')
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('MIX 3 — 4-digit validation', transcript)
    },
  },

  // ── 5. DRYER + PUSH PROG — display already known infers payment ──────────
  // REGRESSION (Andrea-2026-05-09 secadora chat): customer typed "me sale
  // push prog" + "secadora" + "5" → bot used to ask "¿has pagado?" twice,
  // then escalate. The fix:
  //   1. autoExtractFacts infers paymentCompleted=true when displayState
  //      is in RECOVERABLE_DISPLAYS (a recoverable code only appears AFTER
  //      payment).
  //   2. Flow engine dryer entry router routes display=PUSH to ready_state
  //      ("la secadora está lista, selecciona programa") instead of falling
  //      through to problem_check (which would re-ask the display).
  //   3. Dryer JSON interpret_display gets PUSH alias for SEL.
  {
    name: 'MIX 5: dryer + PUSH PROG → infers payment + routes to ready_state (no re-ask)',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        {
          user: 'me sale push prog',
          expectReason: 'force-location',
          description: 'T1: PUSH captured + payment INFERRED true',
          assertState: (ar) => {
            if (ar.state.displayState !== 'PUSH') {
              throw new Error(`PUSH must be captured: got "${ar.state.displayState}"`)
            }
            if (ar.state.paymentCompleted !== true) {
              throw new Error(
                `payment must be inferred true (recoverable display): got ${ar.state.paymentCompleted}`,
              )
            }
          },
        },
        { user: 'goya', expectReason: 'force-machine-type' },
        { user: 'secadora', expectReason: 'force-machine-number' },
        {
          user: '5',
          expectReason: 'auto-start-machine-flow',
          expectReplyContains: /secadora\s+est[áa]\s+lista|selecciona\s+el\s+programa/i,
          expectReplyDoesNotContain: /has\s+pagado|qu[eé]\s+aparece\s+exactamente/i,
          description: 'auto-start routes to ready_state, NOT pay-ask or display re-ask',
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('MIX 5 — dryer + PUSH PROG (Bug fix)', transcript)
    },
  },

  // ── 4. CARD DIGITS — 5 → 3 → ESCALATE (2 invalid in a row) ──────────────
  {
    name: 'MIX 4: 2 invalid digits in a row → escalate to operator',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.pendingFlow = 'double-charge-ask-card-digits'
      ar.state.issueSummary = 'double charge — used service: yes'
      ar.state.turnCount = 5

      const turns: Turn[] = [
        { user: 'He pagado, narrative', expectReason: 'double-charge-ask-card-digits' },
        {
          user: '48215',
          expectReason: 'double-charge-card-digits-retry',
          description: '1st invalid (5 digits) → retry',
        },
        {
          user: '482',
          expectReason: 'double-charge-card-digits-escalate',
          description: '2nd invalid (3 digits) → escalate',
          assertState: (ar) => {
            if (!ar.state.operatorRequested) {
              throw new Error('operator must be requested after 2 invalids')
            }
            if (!ar.state.customerNameRequested) {
              throw new Error('name must be requested after escalate')
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('MIX 4 — 2 invalid digits → escalate', transcript)
    },
  },
]

async function main(): Promise<void> {
  await loadTestRuntime()
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`\n\x1b[32m  ✓ ${c.name}\x1b[0m`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\n\x1b[31m  ✗ ${c.name}\x1b[0m\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
