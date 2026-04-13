import { ChannelMode } from "@echatbot/database"
import { Intent } from "../intent/intent.types"

export type IntentConfidence = "HIGH" | "MEDIUM" | "LOW"

export interface RecognizedIntent {
  intent: Intent
  confidence: IntentConfidence
  source: "PATTERN" | "KEYWORD" | "LLM" | "HYBRID" | "FALLBACK"
  reasoning?: string
}

export interface OrchestrationInput {
  workspaceId: string
  customerId: string
  conversationId: string
  message: string
  customerLanguage?: string
  customerName?: string
  isRegistered?: boolean
  channelMode?: ChannelMode
}

export interface ConversationSnapshot {
  summary?: string
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface PreferenceEntry {
  key: string
  value: any
  confidence: number
  source: "explicit" | "inferred"
  expiresAt?: Date | null
}

export interface LoadedContext {
  products?: any
  faqs?: any
  offers?: any
  services?: any
  customerProfile?: any
  preferences?: PreferenceEntry[]
  conversation: ConversationSnapshot
  workspace: {
    channelMode: ChannelMode
    toneOfVoice?: string | null
  }
}

export interface ProductGroupBlock {
  title: string
  items: Array<{ id: string; name: string; price?: number; sku?: string }>
}

export interface FAQBlock {
  question: string
  answer: string
}

export interface OfferBlock {
  title: string
  description?: string
  discountPercent?: number
  categoryName?: string | null
}

export interface ServiceBlock {
  title: string
  description?: string
  price?: number
  duration?: number
}

export interface MixerOutput {
  intro?: string
  productGroups?: ProductGroupBlock[]
  faqSections?: FAQBlock[]
  offerSections?: OfferBlock[]
  serviceSections?: ServiceBlock[]
  questions?: string[]
  registrationPrompt?: string
}

export interface OrchestrationResult {
  intents: RecognizedIntent[]
  context: LoadedContext
  mixed: MixerOutput
  message?: string
  translated?: string
}
