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

import { PrismaClient, prisma } from "@echatbot/database"
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
  model?: string // 🆕 Model used for debugging timeline
}

export interface ProcessOptions {
  workspaceId: string
  message: string
  targetLanguage: string
  customerName?: string
}

/**
 * 🆕 Translation settings loaded from workspace
 */
export interface TranslationSettings {
  translateProductNames: boolean
  translateCategoryNames: boolean
  translateServiceNames: boolean
  catalogBaseLanguage: string
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

    // 🔍 DEBUG: Log exactly what language we received
    logger.info(`🌍 TranslationAgent.process() called`, {
      targetLanguage: options.targetLanguage,
      workspaceId: options.workspaceId,
      customerName: options.customerName,
      messageLength: options.message?.length,
    })

    try {
      // 1. Normalize target language
      const normalizedLanguage = this.normalizeLanguage(options.targetLanguage)
      
      // 🆕 ALWAYS translate to target language - input may be mixed Italian/English
      // The Translation Agent will translate EVERYTHING to the target language
      // NOTE: Never skip translation - content from DB may be in any language
      logger.info(`🌍 TranslationAgent - Translating to ${normalizedLanguage.toUpperCase()} (original input: ${options.targetLanguage})`)

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
          originalLanguage: "it",
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
          originalLanguage: "it",
          targetLanguage: options.targetLanguage,
          message: options.message,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      // 2.5 🆕 Load translation settings from workspace
      const translationSettings = await this.loadTranslationSettings(options.workspaceId)
      
      logger.info("🌍 TranslationAgent settings loaded", {
        translateProductNames: translationSettings.translateProductNames,
        translateCategoryNames: translationSettings.translateCategoryNames,
        translateServiceNames: translationSettings.translateServiceNames,
        catalogBaseLanguage: translationSettings.catalogBaseLanguage,
      })

      // 3. Build system prompt with dynamic customer info
      const systemPrompt = this.buildSystemPrompt(
        translationAgent.systemPrompt,
        {
          nameUser: options.customerName || "Customer",
          languageUser: normalizedLanguage,
          workspaceId: options.workspaceId,
        }
      )

      // 4. Build user message with translation rules based on workspace settings
      const targetLanguageName = this.getLanguageName(normalizedLanguage)
      const preservationRules = this.buildPreservationRules(translationSettings)
      
      const userMessage = `Translate this message to ${targetLanguageName}. The input may be in Italian, English, or mixed. Output must be 100% in ${targetLanguageName}.

${preservationRules}

Message to translate:
"${options.message}"

Respond with JSON: {"translated": true, "originalLanguage": "mixed", "targetLanguage": "${normalizedLanguage}", "message": "..."}`
      
      // 🔍 DEBUG: Log INPUT to TranslationAgent
      logger.info("🔍 TranslationAgent INPUT", {
        containsImgTag: options.message?.includes('<img'),
        messagePreview: options.message?.substring(0, 500),
        preservationRules,
      })

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
            "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
            "X-Title": "eChatbot Translation Layer",
          },
          timeout: 30000, // 30 second timeout
        }
      )

      const llmResponse = response.data.choices[0].message.content
      const tokensUsed = response.data.usage?.total_tokens || 0
      const executionTimeMs = Date.now() - startTime

      // 🔍 DEBUG: Log OUTPUT from TranslationAgent LLM
      logger.info("🔍 TranslationAgent OUTPUT", {
        containsImgTag: llmResponse?.includes('<img'),
        llmResponsePreview: llmResponse?.substring(0, 500),
      })

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
        systemPrompt: systemPrompt, // 🆕 Use PROCESSED prompt (with variables replaced)
        model: translationAgent.model, // 🆕 Include model for debugging timeline
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
      italiano: "it",
      it: "it",
      ita: "it", // 🆕 Handle ITA code for Italian
      spanish: "es",
      español: "es",
      espanol: "es",
      es: "es",
      esp: "es",
      spa: "es", // 🆕 Handle SPA code for Spanish
      portuguese: "pt",
      português: "pt",
      portugues: "pt",
      pt: "pt",
      prt: "pt", // 🆕 Handle PRT code for Portuguese
      english: "en",
      en: "en",
      eng: "en",
      french: "fr",
      francais: "fr",
      français: "fr",
      fr: "fr",
      german: "de",
      deutsch: "de",
      de: "de",
    }

    return mapping[normalized] || "en"
  }

  /**
   * Get full language name from code
   * 
   * @param code - Language code (it, es, pt, en)
   * @returns Full language name
   */
  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      it: "Italian",
      es: "Spanish",
      pt: "Portuguese",
      en: "English",
      fr: "French",
      de: "German",
    }
    return names[code] || "English"
  }

  /**
   * Detect if message appears to be in English
   * Simple heuristic based on common English words
   * 
   * @param message - Message to check
   * @returns true if message appears to be English
   */
  private detectEnglishContent(message: string): boolean {
    const englishIndicators = [
      /\bthe\b/i,
      /\byour\b/i,
      /\bwith\b/i,
      /\bfor\b/i,
      /\band\b/i,
      /\bhas been\b/i,
      /\bwould you\b/i,
      /\bplease\b/i,
      /\bhere is\b/i,
      /\bhere are\b/i,
      /\bsuccessfully\b/i,
      /\border\b/i,
      /\bcart\b/i,
      /\bproduct\b/i,
    ]
    
    let matchCount = 0
    for (const pattern of englishIndicators) {
      if (pattern.test(message)) {
        matchCount++
      }
    }
    
    // If 2+ English indicators found, likely English
    return matchCount >= 2
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

  /**
   * Load translation settings from workspace configuration
   * 
   * @param workspaceId - Workspace ID to load settings for
   * @returns Translation settings with defaults if not configured
   */
  private async loadTranslationSettings(workspaceId: string): Promise<TranslationSettings> {
    try {
      // Use raw query to avoid TypeScript type issues with new schema fields
      const result = await prisma.$queryRaw<Array<{
        translateProductNames: boolean | null
        translateCategoryNames: boolean | null
        translateServiceNames: boolean | null
        catalogBaseLanguage: string | null
      }>>`
        SELECT "translateProductNames", "translateCategoryNames", "translateServiceNames", "catalogBaseLanguage"
        FROM "Workspace"
        WHERE id = ${workspaceId}
        LIMIT 1
      `

      if (!result || result.length === 0) {
        logger.warn("⚠️ Workspace not found for translation settings, using defaults", { workspaceId })
        return {
          translateProductNames: false, // Preserve product names by default
          translateCategoryNames: false, // Preserve category names by default
          translateServiceNames: true,   // Translate service names by default
          catalogBaseLanguage: "it",     // Default to Italian catalog
        }
      }

      const workspace = result[0]
      return {
        translateProductNames: workspace.translateProductNames ?? false,
        translateCategoryNames: workspace.translateCategoryNames ?? false,
        translateServiceNames: workspace.translateServiceNames ?? true,
        catalogBaseLanguage: workspace.catalogBaseLanguage ?? "it",
      }
    } catch (error) {
      logger.error("❌ Error loading translation settings", { workspaceId, error })
      return {
        translateProductNames: false,
        translateCategoryNames: false,
        translateServiceNames: true,
        catalogBaseLanguage: "it",
      }
    }
  }

  /**
   * Build preservation rules string based on workspace settings
   * These rules tell the LLM what to preserve vs translate
   * 
   * @param settings - Translation settings from workspace
   * @returns Formatted rules string for LLM prompt
   */
  private buildPreservationRules(settings: TranslationSettings): string {
    const rules: string[] = []
    const baseLanguageName = this.getLanguageName(settings.catalogBaseLanguage)

    // Product names
    if (!settings.translateProductNames) {
      rules.push(`- DO NOT translate product names. Keep them EXACTLY as they appear in ${baseLanguageName} (e.g., "Pecorino Romano" stays "Pecorino Romano", "Prosciutto di Parma" stays "Prosciutto di Parma")`)
    }

    // Category names
    if (!settings.translateCategoryNames) {
      rules.push(`- DO NOT translate category names. Keep them EXACTLY as they appear in ${baseLanguageName}`)
    }

    // Service names
    if (!settings.translateServiceNames) {
      rules.push(`- DO NOT translate service names. Keep them EXACTLY as they appear in ${baseLanguageName}`)
    }

    // Additional rules for data preservation
    rules.push(`- ALWAYS preserve: prices (€X.XX), order codes (ORD-xxxxx), product codes, HTML tags (<img>, <b>, etc.)`)
    rules.push(`- ALWAYS preserve: emojis, bullet points, numbered lists formatting`)

    if (rules.length === 1) {
      // Only generic preservation rule, all translations enabled
      return "PRESERVATION RULES:\n" + rules.join("\n")
    }

    return "IMPORTANT PRESERVATION RULES:\n" + rules.join("\n")
  }
}
