/**
 * Conversation History Layer - Types
 * 
 * Tipi per il layer di umanizzazione delle risposte.
 * Centralizza: botIdentity, customAiRules, saluti, offerte, menu contestuali.
 */

import type { AgentOptionMapping } from "../../types/option-mapping.types"

/**
 * Tipo di risposta tecnica dall'agent funzionale
 */
export type TechnicalResponseType =
  | "PRODUCT_LIST"
  | "PRODUCT_DETAIL"
  | "CATEGORY_LIST"
  | "CART_STATUS"
  | "CART_EMPTY"
  | "CART_UPDATED"
  | "ORDER_CONFIRMED"
  | "ORDER_LIST"
  | "SERVICE_LIST"
  | "SERVICE_DETAIL"
  | "FAQ_ANSWER"
  | "SUPPORT_REQUEST"
  | "GREETING"
  | "CHECKOUT"
  | "PROFILE"
  | "ERROR"
  | "GENERIC"

/**
 * Messaggio nella cronologia conversazione
 */
export interface ConversationMessage {
  role: "customer" | "assistant"
  content: string
  timestamp: Date
  agentType?: string
}

/**
 * Offerta attiva
 */
export interface ActiveOffer {
  id: string
  name: string
  description: string
  discountPercent: number
  categoryId?: string
  categoryName?: string
  validUntil?: Date
}

/**
 * FAQ per contesto
 */
export interface FAQItem {
  question: string
  answer: string
  category?: string
}

/**
 * Direzione/mindset del layer
 */
export type ConversationMindset = "SALES" | "SUPPORT" | "NEUTRAL"

/**
 * Input per il Conversation History Layer
 */
export interface ConversationHistoryLayerInput {
  // Contesto conversazione
  workspaceId: string
  customerId: string
  customerName: string
  customerPersonality: string | null // 🆕 Tono/personalità del cliente (detected or set manually)
  conversationHistory: ConversationMessage[]
  currentQuestion: string

  // Risposta tecnica dall'agent
  technicalResponse: {
    type: TechnicalResponseType
    data?: any
    rawMessage: string
    optionsMapping?: AgentOptionMapping
  }

  // Personalità e regole (dal workspace)
  botIdentity: {
    name: string
    personality: string | null
  }
  customAiRules: string | null

  // Contesto business
  activeOffers: ActiveOffer[]
  hasSalesAgents: boolean
  isFirstMessage: boolean
  
  // 🆕 FAQ per contesto e suggerimenti
  faqs: FAQItem[]
  
  // 🆕 Direzione/mindset: SALES (vendita) o SUPPORT (assistenza)
  mindset: ConversationMindset

  // Metadata
  lastAgentUsed: string
  customerLanguage: string
}

/**
 * Menu option per il layer
 */
export interface MenuOption {
  number: number
  label: string
  id: string
  metadata?: Record<string, any>
}

/**
 * Output del Conversation History Layer
 */
export interface ConversationHistoryLayerOutput {
  // Messaggio finale umanizzato
  message: string

  // Menu numerico contestuale (preservato o generato)
  optionsMapping?: AgentOptionMapping

  // Metadata
  metadata: {
    addedGreeting: boolean
    suggestedOffers: boolean
    askedClarification: boolean
    preservedMenu: boolean
    tokensUsed: number
    executionTimeMs: number
    model: string
  }
}

/**
 * Configurazione interna del layer
 */
export interface ConversationHistoryConfig {
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
}
