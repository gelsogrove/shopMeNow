/**
 * Conversation History Layer
 *
 * Layer centralizzato che umanizza le risposte tecniche degli agent.
 * 
 * RESPONSABILITÀ:
 * 1. Leggere storico conversazione per contesto
 * 2. Applicare botIdentity (personalità bot)
 * 3. Applicare customAiRules (regole business)
 * 4. Aggiungere saluti se primo messaggio
 * 5. Suggerire offerte se opportuno
 * 6. Preservare o adattare menu numerici
 * 7. Chiedere chiarimenti se domanda ambigua
 *
 * POSIZIONE NEL FLUSSO:
 * [Intent Parser] → [Agent Funzionale] → [Conversation History Layer] → [Translation] → [Response]
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { withOpenRouterRetry } from "../../utils/llm-retry"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import logger from "../../utils/logger"
import type {
  ConversationHistoryLayerInput,
  ConversationHistoryLayerOutput,
  ConversationHistoryConfig,
  TechnicalResponseType,
} from "./conversation-history-layer.types"

export class ConversationHistoryLayer {
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string = "https://openrouter.ai/api/v1"

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""

    if (!this.openRouterApiKey) {
      logger.warn(
        "⚠️ OPENROUTER_API_KEY not found - ConversationHistoryLayer will return raw messages"
      )
    }
  }

  /**
   * Processa la risposta tecnica e la umanizza
   */
  async process(
    input: ConversationHistoryLayerInput
  ): Promise<ConversationHistoryLayerOutput> {
    const startTime = Date.now()

    logger.info("🎭 ConversationHistoryLayer.process() called", {
      workspaceId: input.workspaceId,
      customerId: input.customerId,
      responseType: input.technicalResponse.type,
      isFirstMessage: input.isFirstMessage,
      historyLength: input.conversationHistory.length,
      hasOffers: input.activeOffers.length > 0,
    })

    try {
      // 1. Load agent config from DB
      const config = await this.loadConfig(input.workspaceId)

      if (!config) {
        logger.warn(
          `⚠️ CONVERSATION_HISTORY agent not configured for workspace ${input.workspaceId} - returning raw message`
        )
        return this.createPassthroughResponse(input, startTime)
      }

      // 2. Check if we should skip humanization for certain response types
      if (this.shouldSkipHumanization(input.technicalResponse.type)) {
        logger.info(
          `⏭️ Skipping humanization for type: ${input.technicalResponse.type}`
        )
        return this.createPassthroughResponse(input, startTime)
      }

      // 3. Build context for LLM
      const userPrompt = this.buildUserPrompt(input)

      // 4. Build system prompt with variables replaced
      const systemPrompt = this.buildSystemPrompt(config.systemPrompt, input)

      // 5. Call LLM
      const llmResponse = await this.callLLM(
        systemPrompt,
        userPrompt,
        config.model,
        config.temperature,
        config.maxTokens
      )

      // 6. Parse response and return
      const executionTimeMs = Date.now() - startTime

      logger.info("✅ ConversationHistoryLayer completed", {
        executionTimeMs,
        tokensUsed: llmResponse.tokensUsed,
        responseLength: llmResponse.message.length,
      })

      return {
        message: llmResponse.message,
        optionsMapping: input.technicalResponse.optionsMapping, // Preserve original menu
        metadata: {
          addedGreeting: input.isFirstMessage,
          suggestedOffers: this.detectOfferSuggestion(llmResponse.message, input.activeOffers),
          askedClarification: this.detectClarificationRequest(llmResponse.message),
          preservedMenu: !!input.technicalResponse.optionsMapping,
          tokensUsed: llmResponse.tokensUsed,
          executionTimeMs,
          model: config.model,
        },
      }
    } catch (error) {
      logger.error("❌ ConversationHistoryLayer error:", error)
      return this.createPassthroughResponse(input, startTime)
    }
  }

  /**
   * Load CONVERSATION_HISTORY agent config from database
   */
  private async loadConfig(
    workspaceId: string
  ): Promise<ConversationHistoryConfig | null> {
    try {
      const agent = await this.agentConfigRepo.findByType(
        workspaceId,
        "CONVERSATION_HISTORY" as any
      )

      if (!agent) {
        return null
      }

      return {
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: Number(agent.temperature) || 0.7,
        maxTokens: agent.maxTokens || 500,
      }
    } catch (error) {
      logger.error("❌ Failed to load CONVERSATION_HISTORY config:", error)
      return null
    }
  }

  /**
   * Build user prompt with all context
   */
  private buildUserPrompt(input: ConversationHistoryLayerInput): string {
    const parts: string[] = []

    // 0. MINDSET - Obiettivo della conversazione
    parts.push("## 🎯 MINDSET ATTUALE")
    if (input.mindset === "SALES") {
      parts.push("**VENDITA** - Il cliente sta esplorando prodotti/categorie")
      parts.push("Obiettivo: Guidare verso l'acquisto, suggerire prodotti, proporre offerte")
      parts.push("")
    } else if (input.mindset === "SUPPORT") {
      parts.push("**SUPPORTO** - Il cliente cerca informazioni/assistenza")
      parts.push("Obiettivo: Rispondere con empatia, chiarezza, risolvere dubbi")
      parts.push("")
    } else {
      parts.push("**NEUTRALE** - Conversazione generica")
      parts.push("")
    }

    // 1. Conversation history (last 5 messages for context)
    if (input.conversationHistory.length > 0) {
      const recentHistory = input.conversationHistory.slice(-5)
      parts.push("## STORICO CONVERSAZIONE (ultimi messaggi)")
      for (const msg of recentHistory) {
        const role = msg.role === "customer" ? "CLIENTE" : "BOT"
        parts.push(`${role}: ${msg.content}`)
      }
      parts.push("")
    }

    // 2. Current question
    parts.push("## DOMANDA ATTUALE DEL CLIENTE")
    parts.push(input.currentQuestion)
    parts.push("")

    // 3. Technical response from agent
    parts.push("## RISPOSTA TECNICA DA UMANIZZARE")
    parts.push(`Tipo: ${input.technicalResponse.type}`)
    parts.push(`Messaggio: ${input.technicalResponse.rawMessage}`)
    parts.push("")

    // 4. Active offers (if any) - più enfatizzate in SALES mode
    if (input.activeOffers.length > 0) {
      if (input.mindset === "SALES") {
        parts.push("## 🔥 OFFERTE ATTIVE (suggerisci attivamente!)")
      } else {
        parts.push("## OFFERTE ATTIVE (menziona solo se pertinenti)")
      }
      for (const offer of input.activeOffers.slice(0, 3)) {
        parts.push(`- ${offer.name}: ${offer.description} (${offer.discountPercent}% sconto)`)
      }
      parts.push("")
    }

    // 5. FAQ - Contesto informativo per l'assistente
    if (input.faqs && input.faqs.length > 0) {
      parts.push("## 📚 FAQ - RISPOSTE PREDEFINITE (usa come contesto)")
      for (const faq of input.faqs.slice(0, 5)) {
        parts.push(`Q: ${faq.question}`)
        parts.push(`A: ${faq.answer}`)
        if (faq.category) {
          parts.push(`(Categoria: ${faq.category})`)
        }
        parts.push("")
      }
    }

    // 6. Context flags
    parts.push("## CONTESTO")
    // 🚫 WIDGET FIX: Don't show "Nome cliente" if empty (anonymous widget visitors)
    if (input.customerName && input.customerName.trim() !== "") {
      parts.push(`- Nome cliente: ${input.customerName}`)
      if (input.isFirstMessage) {
        parts.push(`- Primo messaggio: SÌ — aggiungi un saluto BREVE e PERSONALIZZATO (es. "Ciao ${input.customerName}!" nella lingua corretta) PRIMA della risposta, poi vai al punto`)
      } else {
        parts.push(`- Primo messaggio: NO — NON aggiungere saluti`)
      }
    } else {
      parts.push(`- Nome cliente: (non disponibile - NON usare nomi nei saluti)`)
      if (input.isFirstMessage) {
        parts.push(`- Primo messaggio: SÌ — NON aggiungere saluti generici ("Ciao!", "Benvenuto!"), vai DRITTO alla risposta`)
      } else {
        parts.push(`- Primo messaggio: NO — NON aggiungere saluti`)
      }
    }
    parts.push(`- Ha agenti commerciali: ${input.hasSalesAgents ? "SÌ" : "NO"}`)
    parts.push(`- Mindset: ${input.mindset}`)
    parts.push("")

    // 7. Menu to preserve
    if (input.technicalResponse.optionsMapping) {
      parts.push("## MENU NUMERICO (PRESERVA ESATTAMENTE)")
      const options = input.technicalResponse.optionsMapping.options || []
      for (const opt of options) {
        parts.push(`${opt.number}. ${opt.label}`)
      }
      parts.push("")
    }

    return parts.join("\n")
  }

  /**
   * Build system prompt with variables replaced
   */
  private buildSystemPrompt(
    template: string,
    input: ConversationHistoryLayerInput
  ): string {
    return template
      .replace(/\{\{chatbotName\}\}/g, input.botIdentity.name || "Assistente")
      .replace(/\{\{botIdentityResponse\}\}/g, input.botIdentity.personality || "Sii amichevole e professionale")
      .replace(/\{\{customAiRules\}\}/g, input.customAiRules || "Nessuna regola specifica")
      // 🚫 WIDGET FIX: Don't use "Cliente" fallback - empty name = anonymous visitor
      .replace(/\{\{customerName\}\}/g, input.customerName || "")
      .replace(/\{\{companyName\}\}/g, input.companyName || "")
  }

  /**
   * Call OpenRouter LLM
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<{ message: string; tokensUsed: number }> {
    if (!this.openRouterApiKey) {
      return { message: userPrompt, tokensUsed: 0 }
    }

    try {
      const response = await withOpenRouterRetry(() => axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://echatbot.ai",
            "X-Title": "eChatbot Conversation History Layer",
          },
          timeout: 30000,
        }
      ))

      const message = response.data.choices?.[0]?.message?.content || ""
      const tokensUsed = response.data.usage?.total_tokens || 0

      return { message: message.trim(), tokensUsed }
    } catch (error) {
      logger.error("❌ LLM call failed in ConversationHistoryLayer:", error)
      throw error
    }
  }

  /**
   * Check if we should skip humanization for certain response types
   */
  private shouldSkipHumanization(type: TechnicalResponseType): boolean {
    // Skip for error responses - let them pass through
    // Skip for support requests - they need exact handling
    const skipTypes: TechnicalResponseType[] = [
      "ERROR",
      "SUPPORT_REQUEST",
    ]
    return skipTypes.includes(type)
  }

  /**
   * Create passthrough response (no humanization)
   */
  private createPassthroughResponse(
    input: ConversationHistoryLayerInput,
    startTime: number
  ): ConversationHistoryLayerOutput {
    return {
      message: input.technicalResponse.rawMessage,
      optionsMapping: input.technicalResponse.optionsMapping,
      metadata: {
        addedGreeting: false,
        suggestedOffers: false,
        askedClarification: false,
        preservedMenu: !!input.technicalResponse.optionsMapping,
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
        model: "passthrough",
      },
    }
  }

  /**
   * Detect if response contains offer suggestion
   */
  private detectOfferSuggestion(message: string, offers: ConversationHistoryLayerInput["activeOffers"]): boolean {
    if (offers.length === 0) return false
    
    const offerKeywords = ["offerta", "sconto", "promozione", "speciale"]
    const lowerMessage = message.toLowerCase()
    
    return offerKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  /**
   * Detect if response asks for clarification
   */
  private detectClarificationRequest(message: string): boolean {
    const clarificationPatterns = [
      "non ho capito",
      "puoi specificare",
      "intendi",
      "cosa intendi",
      "puoi chiarire",
      "riformula",
    ]
    const lowerMessage = message.toLowerCase()
    
    return clarificationPatterns.some(pattern => lowerMessage.includes(pattern))
  }
}
