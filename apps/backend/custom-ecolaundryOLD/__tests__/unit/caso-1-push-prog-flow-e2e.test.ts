// End-to-end flow simulation for Caso 1 — PUSH PROG (NO LLM).
//
// SCENARIO (Andrea, 2026-05-09):
//   Drives the full PUSH PROG conversation deterministically, for both
//   sub-scenarios:
//     1.1 — Happy Path: customer pushes the program button, the washer
//           starts → bot closes the incident with a positive message.
//     1.2 — Escalation: customer pushes but the machine doesn't respond
//           → Phase B re-ask of the display → on confirmed "PUSH PROG"
//           the bot escalates with name capture and an operator handover.
//
// What this test pins:
//   - Location → número → pantalla gather order (no "¿has pagado?" step,
//     since PUSH PROG implies payment was already made).
//   - Recognition of "PUSH PROG" → canonical PUSH + label "PUSH PROG"
//     (Bug C regression).
//   - The 4-program list (60º / 40º / 30º / Frío) + loopback question.
//   - Phase B re-ask after post-instruction failure.
//   - Phase C escalation on confirmed display + operator-handover summary
//     containing the customer-facing label "PUSH PROG" (NOT just "PUSH").
//
// The transcript is printed to stdout for visual inspection.
//
// Run with:
//   node --import tsx __tests__/unit/caso-1-push-prog-flow-e2e.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { runGuardPipeline } from '../../utils/guards/index.js'
import { createInitialState } from '../../utils/state.js'
import { extractEscalationContext, buildEscalationSummary } from '../../utils/escalation.js'
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
        `Turn "${turn.user}": expected reason "${turn.expectReason}", got "${outcome.reason}".\n` +
          `Reply was: ${outcome.reply}`,
      )
    }
    if (turn.expectReplyContains && !turn.expectReplyContains.test(outcome.reply)) {
      throw new Error(
        `Turn "${turn.user}": reply did not match ${turn.expectReplyContains}.\n` +
          `Reply was: ${outcome.reply}`,
      )
    }
    if (turn.expectReplyDoesNotContain && turn.expectReplyDoesNotContain.test(outcome.reply)) {
      throw new Error(
        `Turn "${turn.user}": reply must NOT match ${turn.expectReplyDoesNotContain}.\n` +
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
  // ── Scenario 1.1 — Happy Path (deterministic up to instruction) ─────────
  // NOTE: the final step T5 — customer says "Sí, ahora funciona" → bot
  // closes with "perfecto, resuelto" — is **LLM-driven**, not handled by
  // any deterministic guard. The agent test (`__tests__/agent/11-push-prog`)
  // covers T5 with a real LLM. Here we pin the deterministic part: T1–T4
  // (location → number → display → program guidance with 4 options).
  {
    name: 'Scenario 1.1: PUSH PROG happy gather T1–T4 (deterministic part)',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        // T1 — customer reports the issue. autoExtractFacts captures
        // machineType="washer" from "lavadora". Location empty → forceLocation.
        {
          user: 'La lavadora no funciona',
          expectReason: 'force-location',
          expectReplyContains: /lavander[ií]a/i,
        },
        // T2 — Goya. Type already known → bot asks NUMBER (not type — Caso 1
        // doc: "primero lavandería, luego número, luego pantalla").
        {
          user: 'Goya',
          expectReason: 'force-machine-number',
          expectReplyContains: /n[uú]mero.*lavadora|qu[eé]\s+n[uú]mero/i,
          expectReplyDoesNotContain: /lavadora\s+o\s+(?:una\s+)?secadora|pagado/i,
        },
        // T3 — "La 5" → number captured. Bot asks display.
        {
          user: 'La 5',
          expectReason: 'force-display',
          expectReplyContains: /pantalla/i,
          expectReplyDoesNotContain: /pagado|has\s+podido/i,
          assertState: (ar) => {
            if (ar.state.machineNumber !== '5') {
              throw new Error(`machineNumber must be "5", got "${ar.state.machineNumber}"`)
            }
          },
        },
        // T4 — PUSH PROG. canonical → 'PUSH', label → 'PUSH PROG' (Bug C).
        // F40 (Andrea 2026-05-11) — REVERSE of F37: usecases requires the
        // 4-program list with bold numbers and descriptions ("Desviación
        // documentada respecto al PDF" — UX priority over strict alignment).
        {
          user: 'PUSH PROG',
          // F81: dynamic list format is "**N** — Name (60º)" (numbers in bold, temp in parens).
          // Hardcoded fallback format is "**60º** Name" (temp in bold).
          // Both formats must include all 4 temperature/name references.
          expectReplyContains: /60[°º].*40[°º].*30[°º].*(frí[o]|frio)/is,
          assertState: (ar) => {
            if (ar.state.displayState !== 'PUSH') {
              throw new Error(`canonical must be "PUSH", got "${ar.state.displayState}"`)
            }
            if (ar.state.displayLabel !== 'PUSH PROG') {
              throw new Error(`label must be "PUSH PROG", got "${ar.state.displayLabel}"`)
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Scenario 1.1 — Happy Path (T1-T4 deterministic)', transcript)
      console.log(`\n  ℹ️  T5 ("Sí, ahora funciona" → resolved) is LLM-driven and`)
      console.log(`     covered by __tests__/agent/11-push-prog.test.spec.ts.`)
    },
  },

  // ── Scenario 1.2 — Escalation (post-instruction failure) ─────────────────
  {
    name: 'Scenario 1.2: PUSH PROG → push → no responde → re-ask → escalate → operator summary',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        { user: 'La lavadora no funciona', expectReason: 'force-location' },
        { user: 'Goya', expectReason: 'force-machine-number' },
        { user: 'La 5', expectReason: 'force-display' },
        // T4 — PUSH PROG → flow engine pushes program guidance (F40 — 4-program list with bold).
        {
          user: 'PUSH PROG',
          // F81: dynamic list format is "**N** — Name (60º)" (numbers in bold, temp in parens).
          // Hardcoded fallback format is "**60º** Name" (temp in bold).
          // Both formats must include all 4 temperature/name references.
          expectReplyContains: /60[°º].*40[°º].*30[°º].*(frí[o]|frio)/is,
        },
        // T5 — customer reports failure. Phase B should re-ask the display.
        {
          user: 'He pulsado pero no responde',
          expectReplyContains: /qu[eé]\s+aparece|c[oó]digo\s+exacto|pantalla/i,
        },
        // T6 — customer confirms PUSH PROG → escalate (Phase C). Bot asks
        // for the customer name.
        {
          user: 'PUSH PROG',
          expectReplyContains: /c[oó]mo\s+te\s+llamas|tu\s+nombre/i,
          assertState: (ar) => {
            if (!ar.state.operatorRequested) {
              throw new Error('operator must be requested on Phase C escalate')
            }
            if (!ar.state.customerNameRequested) {
              throw new Error('name must be requested on Phase C escalate')
            }
          },
        },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Scenario 1.2 — PUSH PROG Escalación', transcript)

      // Manually compute the operator handover summary and confirm it
      // contains the customer-facing label "PUSH PROG" (Bug C regression).
      const ctx = extractEscalationContext(ar.state, 'Andrea')
      const summary = buildEscalationSummary(ctx)
      console.log(`\n  📋 Operator summary:\n     ${summary}\n`)
      if (!/PUSH PROG/.test(summary)) {
        throw new Error(`Operator summary must contain literal "PUSH PROG", got: ${summary}`)
      }
      if (/muestra PUSH\b(?! PROG)/.test(summary)) {
        throw new Error(`Operator summary must NOT show truncated "PUSH" alone, got: ${summary}`)
      }
    },
  },

  // ── Negative: bot does not ask "¿has pagado?" because PUSH PROG implies
  // payment was already made (regla del Caso 1).
  {
    name: 'Caso 1 invariant: bot never asks "¿has pagado?" during PUSH PROG flow',
    run: () => {
      const ar = makeAr()
      const turns: Turn[] = [
        { user: 'La lavadora no funciona', expectReason: 'force-location' },
        { user: 'Goya', expectReplyDoesNotContain: /pagado|has\s+podido\s+pagar/i },
        { user: 'La 5', expectReplyDoesNotContain: /pagado|has\s+podido\s+pagar/i },
        { user: 'PUSH PROG', expectReplyDoesNotContain: /pagado|has\s+podido\s+pagar/i },
      ]
      const transcript = runConversation(ar, turns)
      printTranscript('Caso 1 invariant — no "¿has pagado?"', transcript)
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
