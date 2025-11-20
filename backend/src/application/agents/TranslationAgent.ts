/**
 * TranslationAgent
 *
 * Translation layer that runs AFTER Security Agent validates content.
 * Translates all agent responses to customer's language.
 *
 * Uses TRANSLATION agent config from database (order: 99)
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 * @critical ALWAYS call this AFTER Security Agent passes
 */

import { PrismaClient } from "@prisma/client"
import axios from "axios"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import logger from "../../utils/logger"

export interface TranslationResult {
  translated: boolean
  originalLanguage: string
  targetLanguage: string
  message: string
  tokensUsed?: number
  executionTimeMs?: number
  systemPrompt?: string
}

export interface ProcessOptions {
  workspaceId: string
  message: string
  targetLanguage: string
  customerName?: string
}

export class TranslationAgent {
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string = "https://openrouter.ai/api/v1"

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn(
        "⚠️ OPENROUTER_API_KEY not found - Translation layer will return message as-is"
      )
    } else {
      logger.info("✅ TranslationAgent initialized with OpenRouter API key")
    }
  }

  /**
   * Translate message to target language
   *
   * @param options - Processing options
   * @returns TranslationResult with translated message
   */
  async process(options: ProcessOptions): Promise<TranslationResult> {
    const startTime = Date.now()

    try {
      // 1. Check if translation is needed
      const normalizedLanguage = this.normalizeLanguage(options.targetLanguage)
      if (normalizedLanguage === "en") {
        // No translation needed for English
        logger.info("✅ TranslationAgent - English language, no translation needed")
        return {
          translated: false,
          originalLanguage: "en",
          targetLanguage: options.targetLanguage,
          message: options.message,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      // 2. Load TRANSLATION agent config from database
      const translationAgent = await this.agentConfigRepo.findByType(
        options.workspaceId,
        "TRANSLATION"
      )

      if (!translationAgent) {
        logger.warn(
          `⚠️ TRANSLATION agent not configured for workspace ${options.workspaceId}`
        )
        // Fallback: return message without translation
        return {
          translated: false,
          originalLanguage: "en",
          targetLanguage: options.targetLanguage,
          message: options.message,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      if (!translationAgent.isActive) {
        logger.warn(
          `⚠️ TRANSLATION agent is INACTIVE for workspace ${options.workspaceId}`
        )
        // Return message without translation if agent disabled
        return {
          translated: false,
          originalLanguage: "en",
          targetLanguage: options.targetLanguage,
          message: options.message,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      // 3. Build system prompt with dynamic customer info
      const systemPrompt = this.buildSystemPrompt(
        translationAgent.systemPrompt,
        {
          nameUser: options.customerName || "Customer",
          languageUser: normalizedLanguage,
          workspaceId: options.workspaceId,
        }
      )

      // 4. Build user message
      const userMessage = `Translate this message to ${normalizedLanguage}:\n\n"${options.message}"\n\nRespond with JSON: {"translated": true, "originalLanguage": "en", "targetLanguage": "${normalizedLanguage}", "message": "..."}`

      // 5. Call OpenRouter LLM
      logger.info("🌍 Calling TranslationAgent LLM", {
        workspaceId: options.workspaceId,
        model: translationAgent.model,
        targetLanguage: normalizedLanguage,
      })

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: translationAgent.model,
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
          temperature: translationAgent.temperature,
          max_tokens: translationAgent.maxTokens,
          response_format: { type: "json_object" }, // Force JSON response
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "https://shopme.ai",
            "X-Title": "ShopME Translation Layer",
          },
          timeout: 30000, // 30 second timeout
        }
      )

      const llmResponse = response.data.choices[0].message.content
      const tokensUsed = response.data.usage?.total_tokens || 0
      const executionTimeMs = Date.now() - startTime

      // 6. Parse JSON response
      let parsed: {
        translated?: boolean
        originalLanguage?: string
        targetLanguage?: string
        message?: string
      }

      try {
        parsed = JSON.parse(llmResponse)
      } catch (error) {
        logger.error("❌ Failed to parse TranslationAgent JSON response", {
          llmResponse,
          error,
        })
        // Fallback: return original message
        return {
          translated: false,
          originalLanguage: "en",
          targetLanguage: options.targetLanguage,
          message: options.message,
          tokensUsed,
          executionTimeMs,
        }
      }

      // 7. Extract result
      const translatedMessage =
        parsed.message || options.message
      const translated =
        parsed.translated !== false && parsed.message !== undefined

      logger.info("✅ TranslationAgent completed", {
        translated,
        targetLanguage: normalizedLanguage,
        tokensUsed,
        executionTimeMs,
      })

      return {
        translated,
        originalLanguage: "en",
        targetLanguage: normalizedLanguage,
        message: translatedMessage,
        tokensUsed,
        executionTimeMs,
        systemPrompt: translationAgent.systemPrompt,
      }
    } catch (error) {
      logger.error("❌ TranslationAgent error", error)

      // On error, return message as-is (fail-open for availability)
      return {
        translated: false,
        originalLanguage: "en",
        targetLanguage: options.targetLanguage,
        message: options.message,
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Build system prompt with template variable replacement
   *
   * @param basePrompt - Base prompt from database
   * @param variables - Template variables for replacement
   * @returns Processed system prompt
   */
  private buildSystemPrompt(
    basePrompt: string,
    variables: Record<string, string>
  ): string {
    let prompt = basePrompt

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g")
      prompt = prompt.replace(regex, value)
    }

    return prompt
  }

  /**
   * Normalize language code (it, es, pt, en)
   *
   * @param language - Language code or name
   * @returns Normalized language code
   */
  private normalizeLanguage(language: string): string {
    const normalized = language?.toLowerCase?.() || "en"

    // Map common language codes
    const mapping: Record<string, string> = {
      italian: "it",
      it: "it",
      spanish: "es",
      es: "es",
      esp: "es",
      portuguese: "pt",
      pt: "pt",
      english: "en",
      en: "en",
      eng: "en",
    }

    return mapping[normalized] || "en"
  }

  /**
   * Health check - verify agent is configured
   */
  async healthCheck(workspaceId: string): Promise<boolean> {
    try {
      const agent = await this.agentConfigRepo.findByType(
        workspaceId,
        "TRANSLATION"
      )
      return agent !== null && agent.isActive
    } catch (error) {
      logger.error("TranslationAgent health check failed", error)
      return false
    }
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return ["en", "it", "es", "pt"]
  }
}
