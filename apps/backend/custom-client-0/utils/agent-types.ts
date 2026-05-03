// Public types shared across the agent modules.

import type { Runtime } from './runtime.js'
import type { SessionState } from './state.js'

export interface AgentRuntime {
  runtime: Runtime
  state: SessionState
  pendingEscalation: { reason: string } | null
  resolved: boolean
  photoRequested: boolean
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export interface PromptBundle {
  template: string
  reglas: string
}

export interface AgentSession {
  ar: AgentRuntime
  history: AgentMessage[]
  bundle: PromptBundle
}
