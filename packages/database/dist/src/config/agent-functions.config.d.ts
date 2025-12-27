/**
 * SINGLE SOURCE OF TRUTH - Agent Available Functions
 *
 * This file defines ALL functions that LLM agents can call.
 * Used by:
 * - llm.service.ts (LLM function calling)
 * - agent-config.repository.ts (Database seed)
 * - Frontend /agents page (UI display)
 *
 * ⚠️ CRITICAL: This is the ONLY place where functions are defined!
 * Database availableFunctions field stores a COPY of these definitions.
 */
export interface FunctionDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required: string[];
        };
    };
}
/**
 * Router Agent Functions
 * Pure orchestration - delegates to specialist agents
 */
export declare const ROUTER_FUNCTIONS: FunctionDefinition[];
/**
 * Product & Services Search Agent Functions
 */
export declare const PRODUCT_SEARCH_FUNCTIONS: FunctionDefinition[];
/**
 * Cart Management Agent Functions
 */
export declare const CART_MANAGEMENT_FUNCTIONS: FunctionDefinition[];
/**
 * Order Tracking Agent Functions
 */
export declare const ORDER_TRACKING_FUNCTIONS: FunctionDefinition[];
/**
 * Customer Support Agent Functions
 */
export declare const CUSTOMER_SUPPORT_FUNCTIONS: FunctionDefinition[];
/**
 * Summary Agent Functions
 * Used for generating conversation summaries for email notifications
 */
export declare const SUMMARY_AGENT_FUNCTIONS: FunctionDefinition[];
/**
 * Profile Management Agent Functions
 */
export declare const PROFILE_MANAGEMENT_FUNCTIONS: FunctionDefinition[];
/**
 * Get all available functions for a specific agent type
 */
export declare function getAgentFunctions(agentType: string): FunctionDefinition[] | null;
/**
 * Get ALL functions (for LLM - all agents combined)
 * Currently returns global functions (used by all agents)
 */
export declare function getAllFunctions(): FunctionDefinition[];
/**
 * Get function NAMES only for a specific agent type (for database seed)
 * Returns JSON-compatible array of function names
 */
export declare function getAgentFunctionNames(agentType: string): string[] | null;
