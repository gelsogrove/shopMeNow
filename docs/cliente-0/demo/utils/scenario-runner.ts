// Scenario runner for automated testing
import type { SessionState } from './state.js'

export type ScenarioAssertion = {
  turn: number
  includes?: string[]
  excludes?: string[]
}

export type ScenarioFile = {
  case: number
  scenario: number
  name: string
  description: string
  turns: string[]
  assertions: ScenarioAssertion[]
  expectedOutcome: 'RESOLVED' | 'ESCALATED' | 'ERROR' | string
  notes?: string
}

export type AssertionResult = {
  turn: number
  passed: boolean
  reason: string
  expected?: ScenarioAssertion
}

export function evaluateAssertion(botReply: string, assertion: ScenarioAssertion): AssertionResult {
  const lowerReply = botReply.toLowerCase()

  // Check includes
  if (assertion.includes && assertion.includes.length > 0) {
    const allIncluded = assertion.includes.every((text) => lowerReply.includes(text.toLowerCase()))
    if (!allIncluded) {
      const missing = assertion.includes.filter((text) => !lowerReply.includes(text.toLowerCase()))
      return {
        turn: assertion.turn,
        passed: false,
        reason: `Missing expected content: ${missing.join(', ')}`,
        expected: assertion,
      }
    }
  }

  // Check excludes
  if (assertion.excludes && assertion.excludes.length > 0) {
    const anyExcluded = assertion.excludes.some((text) => lowerReply.includes(text.toLowerCase()))
    if (anyExcluded) {
      const found = assertion.excludes.filter((text) => lowerReply.includes(text.toLowerCase()))
      return {
        turn: assertion.turn,
        passed: false,
        reason: `Found unexpected content: ${found.join(', ')}`,
        expected: assertion,
      }
    }
  }

  return {
    turn: assertion.turn,
    passed: true,
    reason: 'All assertions passed',
    expected: assertion,
  }
}

export function getAssertionsForTurn(scenario: ScenarioFile, turn: number): ScenarioAssertion[] {
  return scenario.assertions.filter((a) => a.turn === turn)
}

export function formatScenarioName(scenario: ScenarioFile): string {
  return `Case ${scenario.case}.${String(scenario.scenario).split('.').join('_')} — ${scenario.name}`
}
