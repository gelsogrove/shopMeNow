/**
 * SecurityAgent
 *
 * Security validation layer that runs BEFORE Translation Agent.
 * Detects dangerous content: SQL injection, XSS, offensive language, data breach attempts.
 * If blocked: message is NOT sent, deliveryStatus='blocked', shows 🚫 icon to customer.
 *
 * Uses SECURITY agent config from database (order: 98)
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 * @critical ALWAYS call this BEFORE Translation Agent
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import Handlebars from "handlebars"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import logger from "../../utils/logger"

export interface SecurityResult {
  safe: boolean
  message: string
  blockedReason?: string
  tokensUsed?: number
  executionTimeMs?: number
  systemPrompt?: string
}

export interface ProcessOptions {
  workspaceId: string
  message: string
  customerName?: string
  customerId?: string
}

export class SecurityAgent {
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string = "https://openrouter.ai/api/v1"

  constructor(private prisma: PrismaClient) {
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn(
        "⚠️ OPENROUTER_API_KEY not found - Security layer will allow all messages"
      )
    } else {
      logger.info("✅ SecurityAgent initialized with OpenRouter API key")
    }
  }

  /**
   * Check if a URL matches any allowed domain (internal + workspace allowedExternalLinks).
   * Used to override LLM false-positives on URLs that ARE in the allowed list.
   * Handles www. prefix: if 'youtube.com' is allowed, 'www.youtube.com' also matches.
   */
  private isAllowedUrl(url: string, allowedDomains: string[]): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.toLowerCase()
      return allowedDomains.some((domain) => {
        const d = domain.toLowerCase()
        return (
          hostname === d ||
          hostname === `www.${d}` ||
          (d.startsWith("www.") && hostname === d.replace("www.", ""))
        )
      })
    } catch {
      return false
    }
  }

  /**
   * Check if ALL URLs in a message match allowed domains.
   * Returns true if there are no URLs or all URLs are from allowed domains.
   */
  private allUrlsAllowed(
    messageContent: string,
    allowedDomains: string[]
  ): boolean {
    const urls = messageContent.match(/https?:\/\/[^\s)]+/gi) || []
    if (urls.length === 0) return true
    return urls.every((url) => this.isAllowedUrl(url, allowedDomains))
  }

  /**
   * Process message through security layer
   *
   * @param options - Processing options
   * @returns SecurityResult with safe flag and optional blocked reason
   */
  async process(options: ProcessOptions): Promise<SecurityResult> {
    const startTime = Date.now()

    // 🛡️ Fail-safe: Skip security check for internal operator notifications
    // Even if skipSecurityCheck flag is missing from DB (sync issues), we trust the pattern
    if (options.message.includes('🔔 *RICHIESTA ASSISTENZA OPERATORE*')) {
      logger.info(`🛡️ [SecurityAgent] Trusted operator notification detected - bypassing LLM`, {
        workspaceId: options.workspaceId,
      })
      return {
        safe: true,
        message: options.message,
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }

    try {
      // 1. Load SECURITY agent config from database
      const securityAgent = await this.agentConfigRepo.findByType(
        options.workspaceId,
        "SECURITY"
      )

      if (!securityAgent) {
        logger.warn(
          `⚠️ SECURITY agent not configured for workspace ${options.workspaceId}`
        )
        // Fallback: allow message if no security agent configured
        return {
          safe: true,
          message: options.message,
          blockedReason: undefined,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      if (!securityAgent.isActive) {
        logger.warn(
          `⚠️ SECURITY agent is INACTIVE for workspace ${options.workspaceId}`
        )
        // Allow message if security agent disabled
        return {
          safe: true,
          message: options.message,
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
        }
      }

      // 🛡️ Load workspace to get allowedExternalLinks and name
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: options.workspaceId },
        select: { allowedExternalLinks: true, name: true },
      })

      // 🛡️ ALWAYS allow internal domains (short links, registration, etc.)
      const internalDomains = [
        "echatbot.ai",
        "www.echatbot.ai",
        "echatbot.ai/s/*", // Short links
        "www.echatbot.ai/s/*", // Short links
        "echatbot.ai/registration/*", // Registration links
        "www.echatbot.ai/registration/*", // Registration links
        "echatbot.ai/cart*", // Cart links
        "www.echatbot.ai/cart*", // Cart links
        "echatbot.ai/orders-public*", // Order links
        "www.echatbot.ai/orders-public*", // Order links
        "echatbot.ai/customer-profile*", // Profile links
        "www.echatbot.ai/customer-profile*", // Profile links
      ]

      // 🛡️ Merge internal domains with workspace-configured external links
      const allAllowedLinks = [
        ...internalDomains,
        ...(workspace?.allowedExternalLinks || []),
      ]

      // 🛡️ Build allowed links string (comma-separated)
      const allowedLinks = allAllowedLinks.join(", ")

      // 2. Build system prompt with dynamic variables
      const systemPrompt = this.buildSystemPrompt(securityAgent.systemPrompt, {
        nameUser: options.customerName || "Customer",
        workspaceId: options.workspaceId,
        companyName: workspace?.name || options.workspaceId,
        allowedExternalLinks: allowedLinks, // 🛡️ Pass to prompt (lowercase to match template)
      })

      // 3. Build user message
      const userMessage = `Check if this message is safe:\n\n"${options.message}"\n\nRespond with JSON: {"safe": true/false, "message": "...", "reason": "..."}`

      // 4. Call OpenRouter LLM
      logger.info("🛡️ Calling SecurityAgent LLM", {
        workspaceId: options.workspaceId,
        model: securityAgent.model,
      })

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: securityAgent.model,
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
          temperature: securityAgent.temperature,
          max_tokens: securityAgent.maxTokens,
          response_format: { type: "json_object" }, // Force JSON response
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
            "X-Title": "eChatbot Security Layer",
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
        message?: string
        userMessage?: string
        blockedReason?: string
        reason?: string
      }

      try {
        parsed = JSON.parse(llmResponse)
      } catch (error) {
        logger.error("❌ Failed to parse SecurityAgent JSON response", {
          llmResponse,
          error,
        })
        // Fallback: allow message if parsing fails
        return {
          safe: true,
          message: options.message,
          blockedReason: "JSON parse error",
          tokensUsed,
          executionTimeMs,
        }
      }

      // 6. Extract result
      const safe = parsed.safe !== false
      const userMessage2 =
        parsed.message || parsed.userMessage || options.message
      const blockedReason = parsed.blockedReason || parsed.reason

      // 🛡️ Override LLM false-positive: if reason is UNAUTHORIZED_LINK but ALL URLs
      // in the message are from allowed domains (internal + workspace allowedExternalLinks),
      // allow the message. The LLM sometimes fails to match URLs against the allowed domain patterns.
      if (
        !safe &&
        blockedReason?.includes("UNAUTHORIZED_LINK") &&
        this.allUrlsAllowed(options.message, allAllowedLinks)
      ) {
        logger.info(
          "✅ Security override: LLM flagged UNAUTHORIZED_LINK but all URLs are from allowed domains — allowing message",
          {
            workspaceId: options.workspaceId,
            customerId: options.customerId,
            allowedDomains: allAllowedLinks,
          }
        )
        return {
          safe: true,
          message: options.message,
          tokensUsed,
          executionTimeMs,
          systemPrompt,
        }
      }

      // 7. If BLOCKED, call sendAlertEmail to notify admin
      if (!safe && blockedReason) {
        logger.warn("🚫 SecurityAgent BLOCKED message", {
          reason: blockedReason,
          customerId: options.customerId,
          workspaceId: options.workspaceId,
        })

        // Call sendAlertEmail to notify admin
        try {
          logger.warn("🚨 Security Alert - Message Blocked", {
            reason: blockedReason,
            customerId: options.customerId,
            workspaceId: options.workspaceId,
            message: options.message.substring(0, 200),
          })
          // TODO: Integrate with notification service to send actual email alerts
        } catch (alertError) {
          logger.error("❌ Failed to log security alert", alertError)
          // Don't fail the security check if alert logging fails
        }
      }

      logger.info("✅ SecurityAgent completed", {
        safe,
        blocked: !safe,
        blockedReason,
        tokensUsed,
        executionTimeMs,
      })

      return {
        safe,
        message: userMessage2,
        blockedReason,
        tokensUsed,
        executionTimeMs,
        systemPrompt: securityAgent.systemPrompt,
      }
    } catch (error) {
      logger.error("❌ SecurityAgent error", error)

      // On error, allow message (fail-open for availability)
      return {
        safe: true,
        message: options.message,
        blockedReason: `Security check error: ${error instanceof Error ? error.message : "Unknown error"
          }`,
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
    // Use Handlebars to process BOTH conditionals ({{#if}}) AND variable replacement ({{var}})
    // in a single pass. noEscape prevents HTML-escaping values (not needed for LLM prompts).
    const template = Handlebars.compile(basePrompt, { noEscape: true })
    return template(variables)
  }
}
