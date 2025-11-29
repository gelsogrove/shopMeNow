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

import { PrismaClient } from "@prisma/client"
import axios from "axios"
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
   * Process message through security layer
   *
   * @param options - Processing options
   * @returns SecurityResult with safe flag and optional blocked reason
   */
  async process(options: ProcessOptions): Promise<SecurityResult> {
    const startTime = Date.now()

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

      // 🛡️ Load workspace to get allowedExternalLinks
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: options.workspaceId },
        select: { allowedExternalLinks: true },
      })
      
      // 🛡️ Build allowed links string (comma-separated)
      const allowedLinks = workspace?.allowedExternalLinks?.length 
        ? workspace.allowedExternalLinks.join(", ")
        : "" // Empty = no external links allowed

      // 2. Build system prompt with dynamic variables
      const systemPrompt = this.buildSystemPrompt(securityAgent.systemPrompt, {
        nameUser: options.customerName || "Customer",
        workspaceId: options.workspaceId,
        ALLOWED_EXTERNAL_LINKS: allowedLinks, // 🛡️ Pass to prompt
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
            "HTTP-Referer": process.env.FRONTEND_URL || "https://shopme.ai",
            "X-Title": "ShopME Security Layer",
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
      const userMessage2 = parsed.message || parsed.userMessage || options.message
      const blockedReason = parsed.blockedReason || parsed.reason

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
        blockedReason: `Security check error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
}
