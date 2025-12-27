"use strict";
/**
 * Agent Functions Configuration
 *
 * Maps each AgentType to its available function calls.
 * This is used by the Agent Settings UI to display which functions each agent can use.
 *
 * ⚠️ DEPRECATED: Use getFunctionNamesForAgentType() from agent-functions.ts instead
 * This file is kept for backward compatibility but delegates to the centralized config.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFunctionsForAgentType = getFunctionsForAgentType;
exports.getAllFunctionNames = getAllFunctionNames;
const agent_functions_1 = require("./agent-functions");
/**
 * Get function calls for a specific agent type
 * @deprecated Use getFunctionNamesForAgentType from agent-functions.ts
 */
function getFunctionsForAgentType(agentType) {
    return (0, agent_functions_1.getFunctionNamesForAgentType)(agentType);
}
/**
 * Get all unique function names across all agents
 * @deprecated Use getAllFunctionNames from agent-functions.ts
 */
function getAllFunctionNames() {
    return (0, agent_functions_1.getAllFunctionNames)();
}
//# sourceMappingURL=agent-function-mapping.js.map