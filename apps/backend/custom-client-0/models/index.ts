// Barrel re-export for cliente-0 type definitions. Allows consumers to
// write `import type { Settings, AgentSession } from '../models/index.js'`
// instead of dipping into individual files.
//
// Every type/interface used across two or more modules lives here. Types
// that are private to a single file (e.g. localization's TranslationKey,
// llm-fetch's LlmFetchErrorCategory) stay where they are.

export type {
  ChatChannel,
  ChatbotInput,
  ChatbotOutput,
  HistoryEntry,
} from './chatbot-io.js'

export type {
  AgentMessage,
  AgentRuntime,
  AgentSession,
  PromptBundle,
} from './agent.js'

export type {
  FaqMap,
  FlowMap,
  FlowNode,
  LocationOverride,
  LocationsConfig,
  Runtime,
  Settings,
  SupportedLanguage,
} from './runtime.js'

export type { SessionState } from './state.js'

export type {
  DisplayFlowDefinition,
  DisplayFlowRequirement,
  DisplayFlowsFile,
} from './display-flow.js'
export { validateDisplayFlowsFile } from './display-flow.js'

export type {
  NluPatternDefinition,
  NluPatternKind,
  NluPatternsFile,
} from './nlu-patterns.js'
export { validateNluPatternsFile } from './nlu-patterns.js'

export type { I18nCatalogue, I18nMap } from './i18n.js'
export { validateI18nCatalogue } from './i18n.js'

export type { EscalationContext } from './escalation.js'

export type {
  FlowEngineResult,
  LlmRequest,
  Route,
} from './flow.js'

export type { Guard, GuardOutcome } from './guards.js'
