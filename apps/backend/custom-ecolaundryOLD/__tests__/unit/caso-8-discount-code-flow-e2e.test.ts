// End-to-end flow simulation for Caso 8 — Discount code intent (NO LLM).
//
// SCENARIO (Andrea, 2026-05-09):
//   Real production chat showed the bot drifting into the machine flow
//   when the customer typed "teng un codigo y no se como utilizarlo"
//   (typo "teng" + variant "utilizarlo"):
//
//     usr: teng un codigo y no se como utilizarlo
//     bot: 👋 Hola, ... ¿En qué lavandería estás ahora mismo?
//     usr: Goya
//     bot: ¿Podrías indicarme, por favor, si es una lavadora o una secadora?
//     usr: lavadora
//     bot: ¿Podrías decirme, por favor, qué número tiene la lavadora?
//     usr: 4
//     bot: Cuéntame, por favor, ¿qué aparece exactamente en la pantalla?
//     usr: ↑ wrong! Customer never had a machine problem.
//
//   Root cause: the discount-code detection regex required "tengo" (full
//   verb form) and silently failed on the typo. Same shape as Bug A on
//   doble-cobro. The fix moves detection to detectDiscountCodeIntent
//   which is permissive on common verb-prefix typos and covers 6 langs.
//
// This test pins the fixed flow: the typo is detected on T1, pendingFlow
// becomes 'discount-code-ask', and on T1 the bot asks for the code value
// (not for the laundry, type, or display).
//
// Run with:
//   node --import tsx __tests__/unit/caso-8-discount-code-flow-e2e.test.ts

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
  assertState?: (ar: AgentRuntime) => void
}

function makeAr(): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  ar.state.turnCount = 0
  return ar
}

interface TranscriptLine {
  speaker: 'usuario' | 'bot'
  text: string
  reason?: string
}

function runConversation(ar: AgentRuntime, turns: Turn[]): TranscriptLine[] {
  const transcript: TranscriptLine[] = []
  for (const turn of turns) {
    ar.state.turnCount += 1
    autoExtractFacts(ar, turn.user)
    const outcome = runGuardPipeline(ar, turn.user)
    transcript.push({ speaker: 'usuario', text: turn.user })
    if (!outcome) {
      throw new Error(
        `Turn "${turn.user}" produced NO guard outcome (LLM would be invoked).`,
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
    if (turn.assertState) turn.assertState(ar)
  }
  return transcript
}

function printTranscript(title: string, transcript: TranscriptLine[]): void {
  console.log(`\n┌─ ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}`)
  for (const line of transcript) {
    const speaker = line.speaker === 'usuario' ? '👤 user' : '🤖 bot '
    const reason = line.reason ? `  [${line.reason}]` : ''
    const wrapped = line.text.replace(/\n/g, '\n         ')
    console.log(`│ ${speaker}: ${wrapped}${reason}`)
  }
  console.log('└' + '─'.repeat(80))
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    // Bug D regression — the exact phrasing from Andrea's production chat.
    name: 'Bug D regression: "teng un codigo y no se como utilizarlo" → discount flow (NO machine flow)',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        // T1 — typo "teng" + variant "utilizarlo". Must enter discount-code
        // flow IMMEDIATELY: the first reply asks for the code value, NOT
        // for the laundry, NOT for the machine type, NOT for the display.
        {
          user: 'teng un codigo y no se como utilizarlo',
          expectReason: 'discount-code-ask',
          expectReplyContains: /c[oó]digo\s+exacto|d[ií]me\s+el\s+c[oó]digo|tell\s+me\s+the\s+code/i,
          expectReplyDoesNotContain: /lavander[ií]a|lavadora\s+o\s+(?:una\s+)?secadora|n[uú]mero|pantalla/i,
          assertState: (ar) => {
            // After the ask guard fires, pendingFlow advances to '-await'
            // for T2's consume phase. Either value confirms we're in the
            // discount-code flow (NOT the machine flow).
            if (!ar.state.pendingFlow.startsWith('discount-code-')) {
              throw new Error(
                `pendingFlow must be 'discount-code-*' on T1, got "${ar.state.pendingFlow}"`,
              )
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Bug D regression — typo "teng" → discount flow', transcript)
    },
  },
  {
    // Canonical phrasing must still work (no regression).
    name: 'Canonical "tengo un código y no sé cómo usarlo" → discount flow',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        {
          user: 'tengo un código y no sé cómo usarlo',
          expectReason: 'discount-code-ask',
          expectReplyDoesNotContain: /lavander[ií]a|n[uú]mero|pantalla/i,
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Canonical phrasing — discount flow', transcript)
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
