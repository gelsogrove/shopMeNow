// Regression test runner — independent of the use-case evaluation suite.
// Takes handleTurn as a parameter to avoid circular dependencies.

import type { Runtime, RegressionAssertion } from '../utils/runtime.js'
import type { TurnResult, ScriptedScenario } from '../utils/types.js'
import { createInitialState, type SessionState } from '../utils/state.js'
import { printCliBanner, printCliMessage, printDebug, CLI_SUBRULE } from '../utils/cli.js'
import { normalizeForRegression } from '../utils/text.js'

type HandleTurn = (runtime: Runtime, state: SessionState, userMessage: string) => Promise<TurnResult>

// ── Assertion checker ─────────────────────────────────────────────────────────

export function assertRegressionReply(reply: string, assertion: RegressionAssertion): string[] {
  const failures: string[] = []
  const normalizedReply = normalizeForRegression(reply)

  for (const expected of assertion.includes || []) {
    if (!normalizedReply.includes(normalizeForRegression(expected))) {
      failures.push(`missing expected text: ${expected}`)
    }
  }

  for (const forbidden of assertion.excludes || []) {
    if (normalizedReply.includes(normalizeForRegression(forbidden))) {
      failures.push(`unexpected text present: ${forbidden}`)
    }
  }

  return failures
}

// ── Scripted runner ───────────────────────────────────────────────────────────

export async function runScripted(
  runtime: Runtime,
  scriptedScenarios: ScriptedScenario[],
  debugMode: boolean,
  handleTurn: HandleTurn,
): Promise<void> {
  printCliBanner(
    'Cliente-0 Demo',
    `Running ${scriptedScenarios.length} scripted scenarios in sequence.`,
  )
  for (const [index, scenario] of scriptedScenarios.entries()) {
    const state = createInitialState()
    printCliBanner(`Scenario ${index + 1}/${scriptedScenarios.length}: ${scenario.name}`)
    for (const turn of scenario.turns) {
      printCliMessage('You', turn)
      const result = await handleTurn(runtime, state, turn)
      printCliMessage('Bot', result.reply)
      if (debugMode) printDebug(result.debug)
    }
  }
}

// ── Regression suite ──────────────────────────────────────────────────────────

export async function runRegressionSuite(
  runtime: Runtime,
  debugMode: boolean,
  handleTurn: HandleTurn,
): Promise<void> {
  printCliBanner(
    'Cliente-0 Regression Suite',
    `Running ${runtime.regressions.length} regression scenarios with assertions.`,
  )

  const failures: string[] = []

  for (const [index, scenario] of runtime.regressions.entries()) {
    const state = createInitialState()
    printCliBanner(`Regression ${index + 1}/${runtime.regressions.length}: ${scenario.name}`)

    for (const [turnIndex, turn] of scenario.turns.entries()) {
      printCliMessage('You', turn)
      const result = await handleTurn(runtime, state, turn)
      printCliMessage('Bot', result.reply)
      if (debugMode) printDebug(result.debug)

      const assertions = scenario.assertions.filter((assertion) => assertion.turn === turnIndex + 1)
      for (const assertion of assertions) {
        const assertionFailures = assertRegressionReply(result.reply, assertion)
        for (const failure of assertionFailures) {
          failures.push(`[${scenario.name}] turn ${assertion.turn}: ${failure}`)
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n${CLI_SUBRULE}`)
    console.error('[REGRESSION FAILURES]')
    console.error(CLI_SUBRULE)
    for (const failure of failures) {
      console.error(failure)
    }
    console.error(CLI_SUBRULE)
    process.exitCode = 1
    return
  }

  printCliMessage('Info', 'All regression scenarios passed.')
}
