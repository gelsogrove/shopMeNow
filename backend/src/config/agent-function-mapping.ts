/**
 * Agent Functions Configuration
 *
 * Maps each AgentType to its available function calls.
 * This is used by the Agent Settings UI to display which functions each agent can use.
 *
 * ⚠️ DEPRECATED: Use getFunctionNamesForAgentType() from agent-functions.ts instead
 * This file is kept for backward compatibility but delegates to the centralized config.
 */

import {
  getAllFunctionNames as getAllFromCentralConfig,
  getFunctionNamesForAgentType as getFromCentralConfig,
} from "./agent-functions"

/**
 * Get function calls for a specific agent type
 * @deprecated Use getFunctionNamesForAgentType from agent-functions.ts
 */
export function getFunctionsForAgentType(agentType: string): readonly string[] {
  return getFromCentralConfig(agentType)
}

/**
 * Get all unique function names across all agents
 * @deprecated Use getAllFunctionNames from agent-functions.ts
 */
export function getAllFunctionNames(): string[] {
  return getAllFromCentralConfig()
}
