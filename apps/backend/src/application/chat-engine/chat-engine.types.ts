/**
 * Chat Engine Types — Shared types for the ChatEngine service and its handlers
 */

import { AgentType, ChannelMode } from "@echatbot/database"
import { ListType } from "./options-mapping.service"

// ================================================================================
// WORKSPACE CONFIG
// ================================================================================

export interface WorkspaceConfig {
  name: string                    // Workspace name (e.g., "BellItalia VIP")
  channelMode: ChannelMode
  hasSalesAgents: boolean
  hasHumanSupport: boolean
  humanSupportInstructions: string | null
  operatorContactMethod: string | null
  welcomeMessage: any
  botIdentityResponse: string | null  // Bot personality
  botIdentity: string | null          // Alias for botIdentityResponse
  customAiRules: string | null  // Custom AI rules that override default behavior
  adminEmail: string | null
  workspaceName: string
  address: string | null
  chatbotName?: string | null      // Custom chatbot name
  businessType?: string | null     // Business sector
  catalogBaseLanguage?: string | null  // Base language of catalog content (default "it")
  customChatbotId?: string | null  // Custom chatbot module id (e.g. "cliente-0"). When set, the
                                    // custom chatbot owns translation and the engine MUST skip
                                    // its own TranslationAgent layer to avoid double-translation.
}

// ================================================================================
// DEBUG STEP TYPES (for Message Flow Timeline)
// ================================================================================

export interface DebugStep {
  type: "router" | "sub_agent" | "function_call" | "function_result" | "safety" | "link-replacement" | "intent-parser" | "data-loader" | "llm-formatter" | "save-history" | "whatsapp-queue" | "token-replacement"
  agent: string
  model?: string
  temperature?: number
  timestamp: string | number
  step?: string
  details?: Record<string, any>
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  systemPrompt?: string
  input?: {
    userMessage?: string
    conversationHistory?: any[]
    functionResult?: any
    textContent?: string
    textToValidate?: string
    previousResponse?: string
    targetLanguage?: string
    customerLanguage?: string
  }
  output?: {
    decision?: string
    functionCall?: { name: string; arguments: any } | string
    functionCalls?: any[]
    textResponse?: string
    translatedText?: string
    safe?: boolean
    blockedReason?: string
    result?: any
    executionTimeMs?: number
    textContent?: string
    skipped?: boolean
    reason?: string
    translated?: boolean
  }
  duration?: number
  executionTimeMs?: number
}

// ================================================================================
// INPUT/OUTPUT TYPES
// ================================================================================

export interface ChatEngineInput {
  message: string
  customerId: string
  workspaceId: string
  conversationId?: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number
  isPlayground?: boolean
  channel?: string
  registrationPromptLevel?: number
}

export interface ChatEngineOutput {
  message: string
  agentType: AgentType
  wasHandled: boolean
  intent: string
  confidence: "HIGH" | "MEDIUM" | "LOW"
  source: "PATTERN" | "KEYWORD" | "LLM_FALLBACK" | "LLM_CONTEXT"
  processingTimeMs: number
  debugInfo?: {
    loadedDataType?: string
    responseType?: string
    llmUsed?: boolean
    steps?: DebugStep[]
    totalTokens?: number
    totalCost?: number
    executionTimeMs?: number
    hybridFallback?: boolean
    originalLabel?: string
    invalidOption?: number
    maxOption?: number
    listType?: ListType
    step?: string
    [key: string]: any
  }
  action?: {
    type: "open_profile_modal" | "open_link"
    customerId?: string
    link?: string
  }
  response?: string
  agentUsed?: string
  tokensUsed?: number
  executionTimeMs?: number
  wasFAQ?: boolean
  isBlocked?: boolean
  _assistantMessageId?: string
}
