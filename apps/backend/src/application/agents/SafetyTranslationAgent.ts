/**
 * SafetyTranslationAgent
 *
 * Final layer that processes responses before sending to customer.
 *
 * ⚠️ IMPORTANT: Widget-only (as of 2025-01)
 * - Widget channel: SafetyTranslationAgent is applied (no scheduler)
 * - WhatsApp channel: SKIPPED - Scheduler handles security + translation
 *
 * This optimization prevents double LLM costs for WhatsApp messages.
 * See llm-router.service.ts:shouldApplySafetyTranslation() for channel check logic.
 *
 * Functions:
 * 1. **Safety Check**: Blocks PII, profanity, phishing, spam
 * 2. **Translation**: Translates response to customer's language (IT → target)
 *
 * 🆕 DATABASE-DRIVEN PROMPTS: Uses agentConfig.systemPrompt from database
 * Falls back to shared/translation-prompts.ts if not found
 *
 * @architecture Clean Architecture - Database-driven configuration
 * @channel Widget only - WhatsApp uses Scheduler services
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import {
  buildSafetyTranslationPrompt,
  TRANSLATION_LLM_SETTINGS,
} from "@shared/translation-prompts"
import logger from "../../utils/logger"

export interface SafetyResult {
  safe: boolean
  translatedText: string
  blockedReason?: string
  tokensUsed?: number
  executionTimeMs?: number
  systemPrompt?: string
}

export interface ProcessOptions {
  workspaceId: string
  response: string
  targetLanguage: string
  customerName?: string
  allowedLinks?: string[] // Workspace-specific allowed domains
}

export class SafetyTranslationAgent {
  private openRouterApiKey: string
  private openRouterBaseUrl: string = "https://openrouter.ai/api/v1"

  constructor(private prisma: PrismaClient) {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn(
        "⚠️ OPENROUTER_API_KEY not found - Safety layer will fallback to original text"
      )
    } else {
      logger.info(
        "✅ SafetyTranslationAgent initialized with OpenRouter API key (database-driven prompt)"
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
      // 🌍 DEBUG: Log incoming parameters
      logger.info("🌍 SafetyTranslationAgent.process() called", {
        workspaceId: options.workspaceId,
        targetLanguage: options.targetLanguage,
        responseLength: options.response.length,
        customerName: options.customerName,
      })

      // 🆕 LOAD FROM DATABASE - Try to get custom prompt from agentConfig
      let systemPromptTemplate: string | null = null
      let agentConfig: any = null

      try {
        agentConfig = await this.prisma.agentConfig.findFirst({
          where: {
            workspaceId: options.workspaceId,
            type: "TRANSLATION",
            isActive: true,
          },
        })

        if (agentConfig?.systemPrompt) {
          systemPromptTemplate = agentConfig.systemPrompt
          logger.info("✅ Using custom TRANSLATION prompt from database", {
            workspaceId: options.workspaceId,
            promptLength: systemPromptTemplate.length,
          })
        }
      } catch (dbError) {
        logger.warn("⚠️ Failed to load TRANSLATION agentConfig from database, using fallback", {
          error: dbError,
        })
      }

      // Fallback to hardcoded prompt if not found in database
      if (!systemPromptTemplate) {
        logger.info("📝 Using fallback hardcoded TRANSLATION prompt", {
          workspaceId: options.workspaceId,
        })
        systemPromptTemplate = buildSafetyTranslationPrompt({
          targetLanguage: options.targetLanguage,
          customerName: options.customerName,
          allowedLinks: options.allowedLinks,
          message: options.response,
        })
      } else {
        // Replace variables in custom prompt
        const languageName = options.targetLanguage.toUpperCase()
        const customerName = options.customerName || "Cliente"
        const allowedLinksText = options.allowedLinks?.length
          ? options.allowedLinks.map((link) => `- ${link}`).join("\n")
          : "- https://echatbot.ai/*\n- https://shopmenow.it/*\n- https://wa.me/*"

        systemPromptTemplate = systemPromptTemplate
          .replace(/{TARGET_LANGUAGE}/g, languageName)
          .replace(/{CUSTOMER_NAME}/g, customerName)
          .replace("{ALLOWED_LINKS}", allowedLinksText)
          .replace("{MESSAGE}", options.response)
      }

      // Use LLM settings from database if available, otherwise fallback
      const model = agentConfig?.model || TRANSLATION_LLM_SETTINGS.model
      const temperature = agentConfig?.temperature ?? TRANSLATION_LLM_SETTINGS.temperature
      const maxTokens = agentConfig?.maxTokens || TRANSLATION_LLM_SETTINGS.maxTokens

      // Call OpenRouter LLM
      logger.info("🔒 Calling SafetyTranslationAgent LLM", {
        workspaceId: options.workspaceId,
        model,
        targetLanguage: options.targetLanguage,
        usingCustomPrompt: !!agentConfig?.systemPrompt,
      })

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model,
          messages: [
            {
              role: "user",
              content: systemPromptTemplate, // Full prompt with message included
            },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" }, // Force JSON response
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
            "X-Title": "eChatbot Safety & Translation Layer",
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

      // 🌍 DEBUG: Log translation result
      logger.info("✅ SafetyTranslationAgent completed", {
        safe,
        blocked: !safe,
        blockedReason,
        tokensUsed,
        executionTimeMs,
        targetLanguage: options.targetLanguage,
        originalLength: options.response.length,
        translatedLength: translatedText.length,
        wasTranslated: options.response !== translatedText,
      })

      return {
        safe,
        translatedText,
        blockedReason,
        tokensUsed,
        executionTimeMs,
        systemPrompt: systemPromptTemplate, // ✅ Add processed system prompt for debugging
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
   * Health check - SafetyTranslationAgent always available (hardcoded prompt)
   * @deprecated No longer checks DB - always returns true if API key present
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async healthCheck(workspaceId: string): Promise<boolean> {
    return !!this.openRouterApiKey
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
