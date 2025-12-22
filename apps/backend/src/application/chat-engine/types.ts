import { AgentType } from "@echatbot/database"
import { ListType } from "./options-mapping.service"

export interface WorkspaceConfig {
  name: string
  sellsProductsAndServices: boolean
  hasSalesAgents: boolean
  hasHumanSupport: boolean
  humanSupportInstructions: string | null
  operatorContactMethod: string | null
  welcomeMessage: any
  botIdentityResponse: string | null
  botIdentity: string | null
  customAiRules: string | null
  adminEmail: string | null
  workspaceName: string
  address: string | null
  chatbotName: string | null
  businessType: string | null
}

export interface DebugStep {
  type:
    | "router"
    | "sub_agent"
    | "function_call"
    | "function_result"
    | "safety"
    | "link-replacement"
    | "intent-parser"
    | "data-loader"
    | "llm-formatter"
    | "save-history"
    | "whatsapp-queue"
  agent: string
  model?: string
  temperature?: number
  timestamp: string | number
  step?: string
  description?: string
  details?: Record<string, any>
  tokensUsed?: number
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
    targetLanguage?: string
    message?: string
    [key: string]: any
  }
  output?: {
    decision?: string
    functionCall?: { name: string; arguments: any } | string
    textResponse?: string
    result?: any
    executionTimeMs?: number
    textContent?: string
    translated?: boolean
    message?: string
    error?: string
    [key: string]: any
  }
  duration?: number
  executionTimeMs?: number
}

export interface ChatEngineInput {
  message: string
  customerId: string
  workspaceId: string
  conversationId?: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number
  isUnregisteredUser?: boolean
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
  response?: string
  agentUsed?: string
  tokensUsed?: number
  executionTimeMs?: number
  wasFAQ?: boolean
  isBlocked?: boolean
  _assistantMessageId?: string
  assistantMessageId?: string
  customerMessageId?: string
  messageIds?: {
    customerMessageId?: string
    assistantMessageId?: string
  }
  conversationId?: string
  debug?: DebugStep[]
}
