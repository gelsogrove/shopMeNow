// Shared TypeScript types for the cliente-0 chatbot demo.
// All business-logic types live here so every module can import without circular deps.

import type { SessionState } from './state.js'
import type { FlowNode } from './runtime.js'

export type Route = 'washer' | 'dryer' | 'faq' | 'operator' | 'reset' | 'greeting' | 'unknown'
export type NextOwner = 'conversation_history' | 'washer_specialist' | 'dryer_specialist'

export type RouterDecision = {
  route: Route
  nextOwner: NextOwner
  functionName: 'lavatrice_hs60xx' | 'asciugatrice_ed340' | 'contactOperator' | 'resetSession' | null
  extractedFacts: Record<string, string | boolean | null>
  missingFacts: string[]
  customerFacingGoal: string
  escalationReason: string | null
}

export type SpecialistDecision = {
  flowId: string | null
  shouldEscalate: boolean
  escalationReason: string | null
  technicalSummary: string
  missingFacts: string[]
  customerFacingGoal: string
}

export type FlowEngineResult = {
  flowId: string
  stepId: string
  prompt: string
  type: FlowNode['type']
  isTerminal: boolean
  action?: 'escalate'
}

export type TurnResult = {
  reply: string
  debug: string[]
}

export type ScriptedScenario = {
  name: string
  turns: string[]
}

export type UsecaseScenario = {
  name: string
  preState?: Partial<SessionState>
  turns: string[]
  assertions: import('./runtime.js').RegressionAssertion[]
}

export type AcceptanceCriterionAssessment = {
  criterion: string
  passed: boolean
  reason: string
  evidence: string[]
  suggestedRewrite?: string
}

export type AcceptanceReport = {
  caseNumber: number
  generatedAt: string
  scenario: string
  criteria: AcceptanceCriterionAssessment[]
  summary: string
  updatedAcceptanceCriteria: string[]
  failuresFromAssertions: string[]
}

export type LlmRequest = {
  systemPrompt?: string
  userPrompt: string
  json?: boolean
  maxTokens?: number
  temperature?: number
}

export type DetailedCriteriaEvaluation = {
  assessments: AcceptanceCriterionAssessment[]
  summary: string
  updatedAcceptanceCriteria: string[]
}
