/**
 * SafetyTranslationAgent
 *
 * Final layer that ALWAYS processes responses before sending to customer.
 *
 * Functions:
 * 1. **Safety Check**: Blocks PII, profanity, phishing, spam
 * 2. **Translation**: Translates response to customer's language
 *
 * Uses SAFETY_TRANSLATION agent config from database (order: 99)
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 * @critical ALWAYS call this before sending response to customer
 */

import { PrismaClient } from "@prisma/client"
import axios from "axios"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import logger from "../../utils/logger"

export interface SafetyResult {
  safe: boolean
  translatedText: string
  blockedReason?: string
  tokensUsed?: number
  executionTimeMs?: number
}

export interface ProcessOptions {
  workspaceId: string
  response: string
  targetLanguage: string
  customerName?: string
  allowedLinks?: string[] // Workspace-specific allowed domains
}

export class SafetyTranslationAgent {
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string = "https://openrouter.ai/api/v1"

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn(
        "⚠️ OPENROUTER_API_KEY not found - Safety layer will fallback to original text"
      )
    } else {
      logger.info(
        "✅ SafetyTranslationAgent initialized with OpenRouter API key"
      )
    }
  }

  /**
   * Process response through safety and translation layer
   *
   * @param options - Processing options
   * @returns SafetyResult with translated and filtered text
   */
  async process(options: ProcessOptions): Promise<SafetyResult> {
    const startTime = Date.now()

    try {
      // 1. Load SAFETY_TRANSLATION agent config from database
      const safetyAgent = await this.agentConfigRepo.findByType(
        options.workspaceId,
        "SAFETY_TRANSLATION"
      )

      if (!safetyAgent) {
        logger.warn(
          `⚠️ SAFETY_TRANSLATION agent not configured for workspace ${options.workspaceId}`
        )
        // Fallback: return original text without safety check (NOT RECOMMENDED)
        return {
          safe: true,
          translatedText: options.response,
          blockedReason: undefined,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      if (!safetyAgent.isActive) {
        logger.warn(
          `⚠️ SAFETY_TRANSLATION agent is INACTIVE for workspace ${options.workspaceId}`
        )
        // Return original if agent disabled
        return {
          safe: true,
          translatedText: options.response,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      // 2. Build system prompt with dynamic allowed links
      const systemPrompt = this.buildSystemPrompt(
        safetyAgent.systemPrompt,
        options.allowedLinks || []
      )

      // 3. Build user message with context
      const userMessage = this.buildUserMessage(
        options.response,
        options.targetLanguage,
        options.customerName
      )

      // 4. Call OpenRouter LLM
      logger.info("🔒 Calling SafetyTranslationAgent LLM", {
        workspaceId: options.workspaceId,
        model: safetyAgent.model,
        targetLanguage: options.targetLanguage,
      })

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: safetyAgent.model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          temperature: safetyAgent.temperature,
          max_tokens: safetyAgent.maxTokens,
          response_format: { type: "json_object" }, // Force JSON response
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "https://shopme.ai",
            "X-Title": "ShopME Safety & Translation Layer",
          },
          timeout: 30000, // 30 second timeout
        }
      )

      const llmResponse = response.data.choices[0].message.content
      const tokensUsed = response.data.usage?.total_tokens || 0
      const executionTimeMs = Date.now() - startTime

      // 5. Parse JSON response
      let parsed: {
        safe?: boolean
        translatedText?: string
        translatedResponse?: string // Alternative field name
        blocked?: boolean // Alternative field name
        blockedReason?: string
        reason?: string // Alternative field name
      }

      try {
        parsed = JSON.parse(llmResponse)
      } catch (error) {
        logger.error(
          "❌ Failed to parse SafetyTranslationAgent JSON response",
          {
            llmResponse,
            error,
          }
        )
        // Fallback: return original text
        return {
          safe: true,
          translatedText: options.response,
          blockedReason: "JSON parse error",
          tokensUsed,
          executionTimeMs,
        }
      }

      // 6. Extract result (handle multiple field name formats)
      const safe = parsed.safe !== undefined ? parsed.safe : !parsed.blocked
      const translatedText =
        parsed.translatedText || parsed.translatedResponse || options.response
      const blockedReason = parsed.blockedReason || parsed.reason

      logger.info("✅ SafetyTranslationAgent completed", {
        safe,
        blocked: !safe,
        blockedReason,
        tokensUsed,
        executionTimeMs,
      })

      return {
        safe,
        translatedText,
        blockedReason,
        tokensUsed,
        executionTimeMs,
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime
      logger.error("❌ SafetyTranslationAgent error", error)

      // Fallback: return original text (UNSAFE - but better than crash)
      return {
        safe: true, // Assume safe to not block customer
        translatedText: options.response,
        blockedReason: `Error: ${error instanceof Error ? error.message : String(error)}`,
        tokensUsed: 0,
        executionTimeMs,
      }
    }
  }

  /**
   * Build system prompt with allowed links injection
   */
  private buildSystemPrompt(
    basePrompt: string,
    allowedLinks: string[]
  ): string {
    // Replace {{ALLOWED_LINKS}} placeholder with workspace-specific links
    const allowedLinksText =
      allowedLinks.length > 0
        ? allowedLinks.map((link) => `- ${link}`).join("\n")
        : "- No allowed links configured for this workspace"

    return basePrompt.replace("{{ALLOWED_LINKS}}", allowedLinksText)
  }

  /**
   * Build user message with context
   */
  private buildUserMessage(
    response: string,
    targetLanguage: string,
    customerName?: string
  ): string {
    return `# Response to translate and check:
${response}

# Target language: ${targetLanguage}
# Customer name: ${customerName || "Unknown"}

Please:
1. Check safety (PII, profanity, phishing, spam)
2. Translate to ${targetLanguage} if needed
3. Return JSON with: { "safe": true/false, "translatedText": "...", "blockedReason": "..." }`
  }

  /**
   * Health check - verify agent is configured
   */
  async healthCheck(workspaceId: string): Promise<boolean> {
    try {
      const agent = await this.agentConfigRepo.findByType(
        workspaceId,
        "SAFETY_TRANSLATION"
      )
      return agent !== null && agent.isActive
    } catch (error) {
      logger.error("SafetyTranslationAgent health check failed", error)
      return false
    }
  }

  /**
   * Get fallback messages for blocked content
   */
  static getFallbackMessage(language: string): string {
    const messages: Record<string, string> = {
      it: "Mi dispiace, non posso completare questa richiesta. Contatta il supporto se hai bisogno di assistenza.",
      es: "Lo siento, no puedo completar esta solicitud. Contacta con soporte si necesitas ayuda.",
      en: "I'm sorry, I cannot complete this request. Contact support if you need assistance.",
      pt: "Desculpe, não posso completar esta solicitação. Entre em contato com o suporte se precisar de ajuda.",
      de: "Es tut mir leid, ich kann diese Anfrage nicht bearbeiten. Kontaktieren Sie den Support, wenn Sie Hilfe benötigen.",
      fr: "Désolé, je ne peux pas compléter cette demande. Contactez le support si vous avez besoin d'aide.",
    }
    return messages[language] || messages.en
  }
}
