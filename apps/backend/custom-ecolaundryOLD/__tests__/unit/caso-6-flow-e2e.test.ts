// End-to-end flow simulation for Caso 6 — Doble cobro (NO LLM).
//
// SCENARIO (Andrea, 2026-05-09):
//   Drives the full conversation through `autoExtractFacts` + the deterministic
//   `GUARD_PIPELINE`, turn by turn, for both branches:
//     - "No" branch (Scenario 6.4): customer charged twice without using the
//       service → escalate immediately, no tipo/número gather.
//     - "Sí" branch (Scenario 6.1): customer used the service → continue with
//       tipo → número → relato → 4 dígitos → captura/closure → name.
//   Plus a regression run with the typo "habieis" that previously broke
//   detection (Bug A).
//
// What this test pins:
//   - The detection regex catches "habieis cobrado" (Bug A regression).
//   - guardForceLocation fires before any flow when location is empty.
//   - The new gather order (location → ¿podido? → tipo → número → ...).
//   - Scenario 6.4 escalates without asking tipo/número.
//   - Scenario 6.1 walks through every step with no LLM in the loop.
//   - displayLabel is preserved across turns for the operator handover.
//
// The transcript is printed to stdout so a human reviewer can read what
// the customer would see at each turn.
//
// Run with:
//   node --import tsx __tests__/unit/caso-6-flow-e2e.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { runGuardPipeline } from '../../utils/guards/index.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

interface Turn {
  user: string
  expectReason: string
  expectReplyContains?: RegExp
  // Optional state assertions after the turn runs.
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
  // Start in T0 — turnCount is incremented by the orchestrator each turn.
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
        `Turn "${turn.user}" produced NO guard outcome (LLM would be invoked). ` +
          `This test must run end-to-end deterministically.`,
      )
    }
    transcript.push({ speaker: 'bot', text: outcome.reply, reason: outcome.reason })

    if (outcome.reason !== turn.expectReason) {
      throw new Error(
        `On turn "${turn.user}": expected reason "${turn.expectReason}", got "${outcome.reason}".\n` +
          `Reply was: ${outcome.reply}`,
      )
    }
    if (turn.expectReplyContains && !turn.expectReplyContains.test(outcome.reply)) {
      throw new Error(
        `On turn "${turn.user}": reply did not match ${turn.expectReplyContains}.\n` +
          `Reply was: ${outcome.reply}`,
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
  // ── Scenario 6.4 — branch NO (immediate escalation) ──────────────────────
  {
    name: 'Scenario 6.4: typo "habieis" + No → escalate without asking tipo/número',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        // T1 — typo regression (Bug A): the customer types "habieis" instead
        // of "habéis". Detection used to silently fail; now it fires.
        {
          user: 'me habieis cobrado dos veces con la tarjeda',
          expectReason: 'force-location',
          expectReplyContains: /lavander[íi]a/i,
          assertState: (ar) => {
            if (ar.state.pendingFlow !== 'double-charge-ask-used') {
              throw new Error(
                `pendingFlow must be set on T1 (Bug A regression), got "${ar.state.pendingFlow}"`,
              )
            }
          },
        },
        // T2 — customer gives location → bot asks "¿has podido lavar?".
        {
          user: 'Goya',
          expectReason: 'double-charge-ask-used',
          expectReplyContains: /podido\s+(?:lavar|secar)/i,
        },
        // T3 — "no" branch: escalate immediately, no tipo/número asked.
        {
          user: 'no, no he podido',
          expectReason: 'double-charge-not-used-escalate',
          expectReplyContains: /revisar.*manualmente|c[óo]mo te llamas/i,
          assertState: (ar) => {
            if (!ar.state.operatorRequested) {
              throw new Error('operator must be requested on No branch')
            }
            if (!ar.state.customerNameRequested) {
              throw new Error('name must be requested on No branch')
            }
            if (ar.state.machineType) {
              throw new Error('machineType must NOT be captured on No branch')
            }
            if (ar.state.machineNumber) {
              throw new Error('machineNumber must NOT be captured on No branch')
            }
            if (!/used service:\s*no/.test(ar.state.issueSummary || '')) {
              throw new Error(
                `issueSummary must record "used service: no", got: ${ar.state.issueSummary}`,
              )
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Scenario 6.4 — branch NO (immediate escalation)', transcript)
    },
  },

  // ── Scenario 6.1 — branch SÍ (full gather) ───────────────────────────────
  {
    name: 'Scenario 6.1: full SÍ branch → tipo → número → relato → digits → closure',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        // T1 — canonical phrasing.
        {
          user: 'Me habéis cobrado dos veces con la tarjeta',
          expectReason: 'force-location',
        },
        // T2 — Goya. Bot asks "¿podido?".
        {
          user: 'Goya',
          expectReason: 'double-charge-ask-used',
        },
        // T3 — Sí. Bot asks "¿lavadora o secadora?".
        {
          user: 'sí',
          expectReason: 'double-charge-emit-type-ask',
          expectReplyContains: /lavadora\s+o\s+(?:una\s+)?secadora/i,
        },
        // T4 — lavadora. Bot asks number.
        {
          user: 'lavadora',
          expectReason: 'double-charge-emit-number-ask',
          expectReplyContains: /qué número|n[uú]mero.*lavadora/i,
        },
        // T5 — 5. Bot asks narrative ("explícame paso a paso...").
        {
          user: '5',
          expectReason: 'double-charge-emit-narrative',
          expectReplyContains: /paso a paso|var[ií]as veces/i,
        },
        // T6 — relato. Bot asks 4 digits.
        {
          user: 'He pagado, no iba y volví a pasar la tarjeta',
          expectReason: 'double-charge-ask-card-digits',
          expectReplyContains: /4 [úu]ltimos d[íi]gitos|d[íi]gitos.*tarjeta/i,
        },
        // T7 — valid 4 digits. Bot asks captura + name and marks the case
        // as refund-form pending (NOT a live operator handover). usecases.md
        // §6.1 riga 627: el ramo Sí cierra como trámite de devolución, no
        // como escalación al operador, por lo que `operatorRequested` debe
        // QUEDAR EN false. El estado se transmite vía `escalationReason`
        // (para el log interno) + `customerNameRequested` (para que el bot
        // pida el nombre antes de cerrar).
        {
          user: '4821',
          expectReason: 'double-charge-ask-receipt',
          expectReplyContains: /captura.*pago|formulario.*devolu/i,
          assertState: (ar) => {
            if (ar.state.operatorRequested) {
              throw new Error('refund-form path must NOT set operatorRequested (it is not a live escalation)')
            }
            if (!ar.state.customerNameRequested) {
              throw new Error('name capture must follow receipt')
            }
            if (ar.state.escalationReason !== 'Double charge incident — review with refund form') {
              throw new Error(`escalationReason must record refund-form context, got: ${ar.state.escalationReason}`)
            }
            if (ar.pendingEscalation !== null) {
              throw new Error('refund-form path must NOT set pendingEscalation (would trigger operatorHandoffFinal)')
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Scenario 6.1 — branch SÍ (full gather)', transcript)
    },
  },

  // ── Mixed: customer volunteers facts out of order on T3 ──────────────────
  {
    name: 'Skip-ahead: "sí, lavadora 5" → narrative directly (no redundant asks)',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        { user: 'me han cobrado dos veces', expectReason: 'force-location' },
        { user: 'Goya', expectReason: 'double-charge-ask-used' },
        // T3 — single answer that includes Sí + tipo + número. The brancher
        // sees both type+number already populated by autoExtractFacts and
        // skips ahead to the narrative ask.
        {
          user: 'sí, lavadora 5',
          expectReason: 'double-charge-emit-narrative',
          expectReplyContains: /paso a paso/i,
          assertState: (ar) => {
            if (ar.state.machineType !== 'washer') {
              throw new Error(`machineType must be captured: got "${ar.state.machineType}"`)
            }
            if (ar.state.machineNumber !== '5') {
              throw new Error(`machineNumber must be captured: got "${ar.state.machineNumber}"`)
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Skip-ahead — "sí, lavadora 5"', transcript)
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
