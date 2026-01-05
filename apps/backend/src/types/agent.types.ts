/**
 * Shared types for multi-agent LLM system
 * 
 * These types are used across all agents to ensure consistency
 * and enable data passing from Router to sub-agents without redundant DB queries.
 * 
 * @see docs/regole_di_prompts.md - Section "Rendering variabili"
 * @see PromptVariables for the NEW standardized variable system
 */

import { PromptVariables } from "./prompt-variables.types"

// Re-export for convenience
export { PromptVariables }

/**
 * @deprecated Use PromptVariables instead
 * 
 * Customer data pre-loaded by Router and passed to sub-agents
 * 
 * OPTIMIZATION: This data is loaded ONCE by the Router and passed to all sub-agents.
 * Sub-agents should NOT make additional DB queries for this data.
 * 
 * NOTE: This interface is kept for backward compatibility during migration.
 * New code should use PromptVariables from prompt-variables.types.ts
 * 
 * @example
 * // OLD (deprecated):
 * const customerData = await loadCustomerData(customerId, workspaceId)
 * 
 * // NEW (recommended):
 * const promptVariables = PromptVariableBuilder.build(customer, workspace, dynamicContent)
 */
export interface CustomerData {
  /** Customer ID (for workspace strategy) */
  id?: string
  /** Customer display name (e.g., "Mario Rossi") */
  nameUser: string
  /** Customer name (alias for nameUser) */
  name?: string
  /** Customer email */
  email: string
  /** Customer phone (WhatsApp format) */
  phone?: string
  /** Customer registration status */
  isActive?: boolean
  /** Customer discount percentage (0-100) */
  discountUser: number
  /** Company/workspace name for {{companyName}} replacement */
  companyName: string
  /** Last order code for {{lastordercode}} replacement */
  lastordercode: string
  /** Language display name (ITALIANO, ENGLISH, ESPAÑOL, PORTUGUÊS) */
  languageUser: string
  /** Assigned sales agent name */
  agentName: string
  /** Assigned sales agent phone */
  agentPhone: string
  /** Assigned sales agent email */
  agentEmail: string
  /** Push notification consent status */
  push_notifications_consent?: boolean
  /** Bot identity response for "chi siete?" */
  botIdentityResponse?: string
  /** Channel name (WhatsApp, Web, etc.) */
  channelName?: string
  /** Admin email for support/escalation */
  adminEmail?: string
}

/**
 * @deprecated Use PromptVariables instead for workspace config
 * 
 * Workspace configuration pre-loaded by Router
 * Used for {{#if}} conditionals and config variables in prompts
 */
export interface WorkspaceConfig {
  /** E-commerce mode (products/services) vs informational mode */
  sellsProductsAndServices: boolean
  /** Human support escalation enabled */
  hasHumanSupport: boolean
  /** Human support escalation instructions */
  humanSupportInstructions?: string
  /** Frustration escalation triggers */
  frustrationEscalationInstructions?: string
  /** Operator contact method (EMAIL, WHATSAPP, etc.) */
  operatorContactMethod?: string
  /** Operator WhatsApp number */
  operatorWhatsappNumber?: string
  /** Sales agents feature enabled */
  hasSalesAgents: boolean
  /** Bot identity response for "chi siete?" */
  botIdentityResponse?: string
  /** Tone of voice (friendly, professional, formal, casual) */
  toneOfVoice?: string
  /** Physical address for location questions */
  address?: string
  /** Custom AI rules that override defaults */
  customAiRules?: string
  /** Admin email for support escalation */
  adminEmail?: string
  /** Allowed external link domains */
  allowedExternalLinks?: string[]
  /** Chatbot name (optional, for UI display) */
  chatbotName?: string
  /** Business type (optional, for categorization) */
  businessType?: string
}
