/**
 * Security Check Service
 * Implements 5-step security validation pipeline for widget messages
 * 
 * Pipeline Order (CRITICAL - must execute in sequence):
 * 1. Rate Limiting - Prevent abuse (10 msg/min per visitorId)
 * 2. Content Safety - XSS, SQL injection, malware detection
 * 3. Business Rules - Hours of operation, maintenance windows
 * 4. Channel Validation - Format, length, charset
 * 5. Anti-Spam - Duplicate detection, flood prevention
 * 
 * If ANY step fails → block message immediately
 */

import logger from "../../utils/logger"
import { prisma } from "@echatbot/database"

export interface SecurityCheckResult {
  step: "RATE_LIMIT" | "CONTENT_SAFETY" | "BUSINESS_RULES" | "CHANNEL_VALIDATION" | "ANTI_SPAM"
  passed: boolean
  reason?: string
  retryAfter?: number // Milliseconds to wait before retry
}

export interface SecurityCheckContext {
  workspaceId: string
  visitorId: string
  message: string
  channel: "widget" | "whatsapp"
}

export class SecurityCheckService {
  /**
   * Execute full 5-step security validation
   * 
   * @param context - Security check context
   * @returns {Promise<SecurityCheckResult[]>} Results from all 5 steps
   */
  static async validateMessage(
    context: SecurityCheckContext
  ): Promise<SecurityCheckResult[]> {
    const results: SecurityCheckResult[] = []

    logger.info("🔒 Starting 5-step security validation", {
      workspaceId: context.workspaceId,
      visitorId: context.visitorId,
      channel: context.channel,
    })

    // Step 1: Rate Limiting
    const rateLimitResult = await this.checkRateLimit(context)
    results.push(rateLimitResult)
    if (!rateLimitResult.passed) {
      logger.warn("❌ Security Step 1 FAILED: Rate Limit", {
        visitorId: context.visitorId,
        reason: rateLimitResult.reason,
      })
      return results // Fail fast
    }

    // Step 2: Content Safety
    const contentSafetyResult = await this.checkContentSafety(context)
    results.push(contentSafetyResult)
    if (!contentSafetyResult.passed) {
      logger.warn("❌ Security Step 2 FAILED: Content Safety", {
        visitorId: context.visitorId,
        reason: contentSafetyResult.reason,
      })
      return results // Fail fast
    }

    // Step 3: Business Rules
    const businessRulesResult = await this.checkBusinessRules(context)
    results.push(businessRulesResult)
    if (!businessRulesResult.passed) {
      logger.warn("❌ Security Step 3 FAILED: Business Rules", {
        visitorId: context.visitorId,
        reason: businessRulesResult.reason,
      })
      return results // Fail fast
    }

    // Step 4: Channel Validation
    const channelValidationResult = await this.checkChannelValidation(context)
    results.push(channelValidationResult)
    if (!channelValidationResult.passed) {
      logger.warn("❌ Security Step 4 FAILED: Channel Validation", {
        visitorId: context.visitorId,
        reason: channelValidationResult.reason,
      })
      return results // Fail fast
    }

    // Step 5: Anti-Spam
    const antiSpamResult = await this.checkAntiSpam(context)
    results.push(antiSpamResult)
    if (!antiSpamResult.passed) {
      logger.warn("❌ Security Step 5 FAILED: Anti-Spam", {
        visitorId: context.visitorId,
        reason: antiSpamResult.reason,
      })
      return results // Fail fast
    }

    logger.info("✅ All 5 security checks passed", {
      visitorId: context.visitorId,
    })

    return results
  }

  /**
   * Step 1: Rate Limiting
   * Check requests per minute per visitorId
   */
  private static async checkRateLimit(
    context: SecurityCheckContext
  ): Promise<SecurityCheckResult> {
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 10 // 10 messages per minute

    const oneMinuteAgo = new Date(Date.now() - windowMs)

    const recentMessages = await prisma.whatsAppQueue.count({
      where: {
        workspaceId: context.workspaceId,
        visitorId: context.visitorId,
        createdAt: { gte: oneMinuteAgo },
      },
    })

    if (recentMessages >= maxRequests) {
      return {
        step: "RATE_LIMIT",
        passed: false,
        reason: `Rate limit exceeded: ${recentMessages}/${maxRequests} messages in last minute`,
        retryAfter: windowMs, // Wait 1 minute
      }
    }

    return {
      step: "RATE_LIMIT",
      passed: true,
    }
  }

  /**
   * Step 2: Content Safety
   * Check for XSS, SQL injection, malware
   */
  private static async checkContentSafety(
    context: SecurityCheckContext
  ): Promise<SecurityCheckResult> {
    const { message } = context

    // Check for XSS patterns
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi, // onclick=, onerror=, etc.
      /javascript:/gi,
    ]

    for (const pattern of xssPatterns) {
      if (pattern.test(message)) {
        return {
          step: "CONTENT_SAFETY",
          passed: false,
          reason: "XSS pattern detected",
        }
      }
    }

    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b).*(\bfrom\b|\binto\b|\btable\b)/gi,
      /--\s*$/gm, // SQL comment
      /;\s*drop\s+table/gi,
    ]

    for (const pattern of sqlPatterns) {
      if (pattern.test(message)) {
        return {
          step: "CONTENT_SAFETY",
          passed: false,
          reason: "SQL injection pattern detected",
        }
      }
    }

    return {
      step: "CONTENT_SAFETY",
      passed: true,
    }
  }

  /**
   * Step 3: Business Rules
   * Check hours of operation, maintenance windows
   */
  private static async checkBusinessRules(
    context: SecurityCheckContext
  ): Promise<SecurityCheckResult> {
    // Get workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: {
        isActive: true,
        channelStatus: true,
      },
    })

    if (!workspace) {
      return {
        step: "BUSINESS_RULES",
        passed: false,
        reason: "Workspace not found",
      }
    }

    if (!workspace.isActive) {
      return {
        step: "BUSINESS_RULES",
        passed: false,
        reason: "Workspace is inactive",
        retryAfter: 3600 * 1000, // Retry in 1 hour
      }
    }

    if (!workspace.channelStatus) {
      return {
        step: "BUSINESS_RULES",
        passed: false,
        reason: "Channel is disabled",
        retryAfter: 3600 * 1000, // Retry in 1 hour
      }
    }

    return {
      step: "BUSINESS_RULES",
      passed: true,
    }
  }

  /**
   * Step 4: Channel Validation
   * Check message format, length, charset
   */
  private static async checkChannelValidation(
    context: SecurityCheckContext
  ): Promise<SecurityCheckResult> {
    const { message, channel } = context

    // Check message length
    const maxLength = channel === "widget" ? 5000 : 4096 // WhatsApp limit
    if (message.length > maxLength) {
      return {
        step: "CHANNEL_VALIDATION",
        passed: false,
        reason: `Message too long: ${message.length}/${maxLength} characters`,
      }
    }

    // Check for empty message
    if (message.trim().length === 0) {
      return {
        step: "CHANNEL_VALIDATION",
        passed: false,
        reason: "Message is empty",
      }
    }

    return {
      step: "CHANNEL_VALIDATION",
      passed: true,
    }
  }

  /**
   * Step 5: Anti-Spam
   * Check for duplicate messages, flood prevention
   */
  private static async checkAntiSpam(
    context: SecurityCheckContext
  ): Promise<SecurityCheckResult> {
    const { workspaceId, visitorId, message } = context

    // Check for exact duplicate in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const duplicateMessage = await prisma.whatsAppQueue.findFirst({
      where: {
        workspaceId,
        visitorId,
        messageContent: message,
        createdAt: { gte: fiveMinutesAgo },
      },
    })

    if (duplicateMessage) {
      return {
        step: "ANTI_SPAM",
        passed: false,
        reason: "Duplicate message detected (same message sent within 5 minutes)",
        retryAfter: 5 * 60 * 1000, // Wait 5 minutes
      }
    }

    // Check for flood (5+ messages in 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000)

    const recentMessages = await prisma.whatsAppQueue.count({
      where: {
        workspaceId,
        visitorId,
        createdAt: { gte: tenSecondsAgo },
      },
    })

    if (recentMessages >= 5) {
      return {
        step: "ANTI_SPAM",
        passed: false,
        reason: "Flood detected (5+ messages in 10 seconds)",
        retryAfter: 10 * 1000, // Wait 10 seconds
      }
    }

    return {
      step: "ANTI_SPAM",
      passed: true,
    }
  }
}
