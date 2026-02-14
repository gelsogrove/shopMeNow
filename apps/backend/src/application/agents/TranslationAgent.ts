/**
 * TranslationAgent
 *
 * Translation layer that runs BEFORE Security Agent for widget,
 * and before queue for WhatsApp (security handled in scheduler).
 * Translates all agent responses to customer's language.
 *
 * 🆕 DATABASE-DRIVEN PROMPTS: Uses agentConfig.systemPrompt when available
 * Falls back to shared/translation-prompts.ts if not found
 *
 * @architecture Clean Architecture - Shared prompt module
 * @critical ALWAYS call this BEFORE Security Agent for widget flow
 */

import { PrismaClient, prisma } from "@echatbot/database"
import axios from "axios"
import {
  buildTranslationOnlyPrompt,
  TRANSLATION_LLM_SETTINGS,
  getLanguageName,
  DEFAULT_ALLOWED_DOMAINS,
} from "@shared/translation-prompts"
import logger from "../../utils/logger"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import { PromptVariableBuilder } from "../services/prompt-variable-builder.service"

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
  customerId?: string
  channel?: string
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
  private openRouterApiKey: string
  private openRouterBaseUrl: string = "https://openrouter.ai/api/v1"
  private promptProcessor: PromptProcessorService

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private prisma: PrismaClient) {
    // Prisma kept for API compatibility but no longer used for agent config

    this.promptProcessor = new PromptProcessorService()
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
    logger.info(`🌍 [TranslationAgent] RECEIVED targetLanguage parameter`, {
      targetLanguage: options.targetLanguage,
      targetLanguageType: typeof options.targetLanguage,
      workspaceId: options.workspaceId,
      customerName: options.customerName,
      messagePreview: options.message?.substring(0, 100),
    })

    try {
      // 1. Normalize target language
      const normalizedLanguage = this.normalizeLanguage(options.targetLanguage)

      // 🆕 ALWAYS translate to target language - input may be mixed Italian/English
      logger.info(`🌍 [TranslationAgent] Normalized language`, {
        input: options.targetLanguage,
        inputType: typeof options.targetLanguage,
        normalized: normalizedLanguage,
        normalizedType: typeof normalizedLanguage,
        willTranslateTo: normalizedLanguage.toUpperCase(),
        mappingResult: this.normalizeLanguage(options.targetLanguage)
      })

      // Load workspace translation settings (product/category/service name translation rules)
      const translationSettings = await this.loadTranslationSettings(options.workspaceId)

      logger.info("🌍 TranslationAgent settings loaded", {
        translateProductNames: translationSettings.translateProductNames,
        translateCategoryNames: translationSettings.translateCategoryNames,
        translateServiceNames: translationSettings.translateServiceNames,
        catalogBaseLanguage: translationSettings.catalogBaseLanguage,
      })

      // 🆕 Load TRANSLATION agent config (database-driven prompt)
      let agentConfig: any = null
      let systemPrompt = ""
      let usingCustomPrompt = false

      try {
        agentConfig = await this.prisma.agentConfig.findFirst({
          where: {
            workspaceId: options.workspaceId,
            type: "TRANSLATION",
            isActive: true,
          },
        })

        if (agentConfig?.systemPrompt) {
          systemPrompt = await this.buildCustomPrompt(
            agentConfig.systemPrompt,
            options,
            normalizedLanguage
          )
          usingCustomPrompt = true
          logger.info("✅ Using custom TRANSLATION prompt from database", {
            workspaceId: options.workspaceId,
            promptLength: systemPrompt.length,
          })
        }
      } catch (dbError) {
        logger.warn("⚠️ Failed to load TRANSLATION agentConfig from database, using fallback", {
          error: dbError,
        })
      }

      // Fallback to hardcoded prompt if not found in database
      if (!systemPrompt) {
        logger.info("📝 Using fallback hardcoded TRANSLATION prompt", {
          workspaceId: options.workspaceId,
        })
        systemPrompt = buildTranslationOnlyPrompt({
          targetLanguage: normalizedLanguage,
          customerName: options.customerName,
          message: options.message,
        })
      }

      // Build preservation rules based on workspace settings
      const targetLanguageName = getLanguageName(normalizedLanguage)
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

      // Use LLM settings from database if available, otherwise fallback
      const model = agentConfig?.model || TRANSLATION_LLM_SETTINGS.model
      const temperature = agentConfig?.temperature ?? TRANSLATION_LLM_SETTINGS.temperature
      const maxTokens = agentConfig?.maxTokens || TRANSLATION_LLM_SETTINGS.maxTokens

      // Call OpenRouter LLM with dynamic settings
      logger.info("🌍 Calling TranslationAgent LLM", {
        workspaceId: options.workspaceId,
        model,
        targetLanguage: normalizedLanguage,
        usingCustomPrompt,
      })

      const headers = {
        Authorization: `Bearer ${this.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
        "X-Title": "eChatbot Translation Layer",
      }

      const buildRequest = (userContent: string) => ({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      })

      const callTranslationLLM = async (userContent: string) => {
        const response = await axios.post(
          `${this.openRouterBaseUrl}/chat/completions`,
          buildRequest(userContent),
          {
            headers,
            timeout: 30000,
          }
        )
        const llmResponse = response.data?.choices?.[0]?.message?.content || ""
        const tokensUsed = response.data?.usage?.total_tokens || 0
        return { llmResponse, tokensUsed }
      }

      let initialCall: { llmResponse: string; tokensUsed: number }
      try {
        initialCall = await callTranslationLLM(userMessage)
      } catch (error: any) {
        logger.error("🌍 TranslationAgent failed - falling back to passthrough", {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        })
        return {
          translated: false,
          originalLanguage: "unknown",
          targetLanguage: normalizedLanguage,
          message: options.message,
          detectedLanguage: "unknown",
          confidence: 0,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        } as any
      }
      let totalTokens = initialCall.tokensUsed
      let parsedResult = this.parseTranslationResponse(initialCall.llmResponse)
      let translatedMessage = parsedResult?.message || options.message
      let translated = parsedResult
        ? parsedResult.translated !== false && parsedResult.message !== undefined
        : false

      const needsForceTranslation =
        !translated ||
        (translatedMessage.trim() === options.message.trim() &&
          this.detectEnglishContent(options.message))

      if (needsForceTranslation) {
        logger.info("🌍 TranslationAgent forcing re-translation", {
          workspaceId: options.workspaceId,
          targetLanguage: normalizedLanguage,
        })
        const forceInstruction = `IMPORTANT: The previous translation matched the original input. Translate the text again to ${targetLanguageName}, ensure the output is entirely in ${targetLanguageName} and not identical to the input, and still respond with the requested JSON object.`
        const forcedCall = await callTranslationLLM(`${userMessage}\n${forceInstruction}`)
        totalTokens += forcedCall.tokensUsed
        const forcedParsed = this.parseTranslationResponse(forcedCall.llmResponse)
        if (forcedParsed?.message) {
          parsedResult = forcedParsed
          translatedMessage = forcedParsed.message
          translated =
            forcedParsed.translated !== false && forcedParsed.message !== undefined
        }
      }

      const executionTimeMs = Date.now() - startTime

      // 🔍 DEBUG: Log OUTPUT from TranslationAgent LLM
      logger.info("🔍 TranslationAgent OUTPUT", {
        containsImgTag: translatedMessage?.includes('<img'),
        llmResponsePreview: translatedMessage?.substring(0, 500),
      })

      logger.info("✅ TranslationAgent completed", {
        translated,
        targetLanguage: normalizedLanguage,
        tokensUsed: totalTokens,
        executionTimeMs,
      })

      return {
        translated,
        originalLanguage: "en",
        targetLanguage: normalizedLanguage,
        message: translatedMessage,
        tokensUsed: totalTokens,
        executionTimeMs,
        systemPrompt: systemPrompt,
        model,
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
   * Normalize language code (it, es, pt, en)
   *
   * @param language - Language code or name
   * @returns Normalized language code
   */
  private normalizeLanguage(language: string): string {
    const normalized = language?.trim?.().toLowerCase?.().split(/[-_]/)[0] || "en"

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
   * Parse LLM JSON response and log parsing failures
   */
  private parseTranslationResponse(
    llmResponse: string
  ): {
    translated?: boolean
    originalLanguage?: string
    targetLanguage?: string
    message?: string
  } | null {
    if (!llmResponse) return null
    try {
      return JSON.parse(llmResponse)
    } catch (error) {
      logger.error("❌ Failed to parse TranslationAgent JSON response", {
        llmResponse,
        error,
      })
      return null
    }
  }

  /**
   * Build custom system prompt from DB template with variables replaced
   */
  private async buildCustomPrompt(
    template: string,
    options: ProcessOptions,
    normalizedLanguage: string
  ): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: options.workspaceId },
        select: {
          id: true,
          name: true,
          url: true,
          language: true,
          toneOfVoice: true,
          botIdentityResponse: true,
          hasHumanSupport: true,
          humanSupportInstructions: true,
          frustrationEscalationInstructions: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          hasSalesAgents: true,
          notificationEmail: true,
          allowedExternalLinks: true,
          sellsProductsAndServices: true,
          address: true,
          customAiRules: true,
          chatbotName: true,
          businessType: true,
          websiteUrl: true,
        },
      })

      const customerInput = {
        id: options.customerId || "anonymous",
        name: options.customerName || null,
        language: normalizedLanguage,
      }

      const variables = PromptVariableBuilder.build(
        customerInput as any,
        (workspace as any) || null,
        undefined,
        {
          channel: options.channel,
        }
      )

      // Force languageUser to target language (override workspace default)
      variables.languageUser = this.getLanguageDisplayName(normalizedLanguage)

      let processed = this.promptProcessor.processWithVariables(template, variables)

      processed = this.applyLegacyPromptReplacements(
        processed,
        options,
        normalizedLanguage,
        workspace?.allowedExternalLinks || []
      )

      return processed
    } catch (error) {
      logger.warn("⚠️ Failed to process custom TRANSLATION prompt, using raw template", {
        error,
      })
      return template
    }
  }

  /**
   * Apply legacy {VAR} replacements for compatibility with older prompts
   */
  private applyLegacyPromptReplacements(
    prompt: string,
    options: ProcessOptions,
    normalizedLanguage: string,
    allowedLinks: string[]
  ): string {
    const languageName = getLanguageName(normalizedLanguage)
    const customerName = options.customerName || "Cliente"
    const allowedLinksText = allowedLinks?.length
      ? allowedLinks.map((link) => `- ${link}`).join("\n")
      : DEFAULT_ALLOWED_DOMAINS.map((d) => `- https://${d}/*`).join("\n")

    return prompt
      .replace(/\{TARGET_LANGUAGE\}/g, languageName)
      .replace(/\{\{TARGET_LANGUAGE\}\}/g, languageName)
      .replace(/\{CUSTOMER_NAME\}/g, customerName)
      .replace(/\{\{CUSTOMER_NAME\}\}/g, customerName)
      .replace(/\{MESSAGE\}/g, options.message)
      .replace(/\{\{MESSAGE\}\}/g, options.message)
      .replace(/\{ALLOWED_LINKS\}/g, allowedLinksText)
      .replace(/\{\{ALLOWED_LINKS\}\}/g, allowedLinksText)
  }

  /**
   * Map language code to display name used in prompts
   */
  private getLanguageDisplayName(langCode: string): string {
    const languageMap: Record<string, string> = {
      it: "ITALIANO",
      en: "ENGLISH",
      es: "ESPAÑOL",
      pt: "PORTUGUÊS",
      italian: "ITALIANO",
      italiano: "ITALIANO",
      english: "ENGLISH",
      spanish: "ESPAÑOL",
      español: "ESPAÑOL",
      portuguese: "PORTUGUÊS",
      português: "PORTUGUÊS",
    }

    return languageMap[langCode?.toLowerCase?.() || "en"] || "ENGLISH"
  }

  /**
   * Health check - TranslationAgent always available (fallback prompt)
   * @deprecated No longer checks DB - always returns true if API key present
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async healthCheck(workspaceId: string): Promise<boolean> {
    return !!this.openRouterApiKey
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
    const baseLanguageName = getLanguageName(settings.catalogBaseLanguage)

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

    rules.push(`- ALWAYS translate supporting descriptions, ingredients, flavors or textures even when they follow product/service names; only the official name itself can stay unchanged.`)

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
