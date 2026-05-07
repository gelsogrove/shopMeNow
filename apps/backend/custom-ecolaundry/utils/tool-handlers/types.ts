// Public types shared by every tool handler. Kept minimal: a handler is
// simply (ar, args) => Promise<ToolResult>. Side-effects on
// AgentRuntime/state are explicit at the handler level.

import type { AgentRuntime } from '../../models/index.js'

export type ToolResult = { ok: boolean; data?: unknown; error?: string }

export type ToolHandler = (
  ar: AgentRuntime,
  args: Record<string, unknown>,
) => Promise<ToolResult>
