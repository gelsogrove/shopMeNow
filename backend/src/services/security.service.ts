/**
 * Security Service - Detects malicious patterns in user messages
 *
 * CRITICAL: This runs FIRST before ANY message processing (P1/P2/P3)
 * Constitution Principle XIII - Rule 9: Security Gate FIRST
 *
 * Threat Detection:
 * - SQL Injection attempts
 * - XSS (Cross-Site Scripting) attacks
 * - Command injection patterns
 * - Path traversal attempts
 *
 * When threat detected:
 * - Log full details with severity
 * - Send alert email to admin
 * - Return safe generic message to customer
 * - Block message from LLM processing
 */

import logger from "../utils/logger"

export interface SecurityCheckResult {
  isSafe: boolean
  threatType?: "SQL_INJECTION" | "XSS" | "COMMAND_INJECTION" | "PATH_TRAVERSAL"
  detectedPattern?: string
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  message?: string
}

export class SecurityService {
  /**
   * SQL Injection patterns
   * Detects common SQL attack vectors
   */
  private static readonly SQL_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b.*\b(FROM|INTO|WHERE|TABLE|DATABASE)\b)/gi,
    /(UNION\s+ALL\s+SELECT)/gi,
    /(OR\s+1\s*=\s*1)/gi,
    /(AND\s+1\s*=\s*1)/gi,
    /(';\s*DROP\s+TABLE)/gi,
    /(--\s*$)/gm, // SQL comments
    /(\/\*.*\*\/)/g, // Block comments
    /(\bxp_cmdshell\b)/gi,
    /(\bEXEC\s*\()/gi,
  ]

  /**
   * XSS (Cross-Site Scripting) patterns
   * Detects attempts to inject malicious scripts
   */
  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>/gi,
    /javascript:/gi,
    /on(load|error|click|mouse\w+)\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi,
  ]

  /**
   * Command Injection patterns
   * Detects attempts to execute system commands
   */
  private static readonly COMMAND_PATTERNS = [
    /[;&|`]\s*(ls|cat|rm|chmod|wget|curl|nc|bash|sh)\b/gi,
    /\$\(.*\)/g, // Command substitution
    /`.*`/g, // Backticks
    /(&&|\|\|)\s*(ls|cat|rm)/gi,
  ]

  /**
   * Path Traversal patterns
   * Detects attempts to access unauthorized files
   */
  private static readonly PATH_PATTERNS = [
    /\.\.[\/\\]/g, // ../
    /(\/etc\/passwd)/gi,
    /(\/etc\/shadow)/gi,
    /(%2e%2e[\/\\%])/gi, // URL-encoded ../ or ..\
    /(%2e%2e%2f)/gi, // URL-encoded ../
  ]

  /**
   * Main security check - runs FIRST before any message processing
   *
   * @param message - User's raw message text
   * @param customerId - For logging purposes
   * @param workspaceId - For alert email routing
   * @returns SecurityCheckResult with threat details if detected
   */
  public static async checkMessage(
    message: string,
    customerId: string,
    workspaceId: string
  ): Promise<SecurityCheckResult> {
    // Skip empty messages
    if (!message || message.trim().length === 0) {
      return { isSafe: true }
    }

    // Check SQL Injection
    for (const pattern of this.SQL_PATTERNS) {
      const match = pattern.exec(message)
      if (match) {
        logger.error("🚨 SECURITY ALERT: SQL Injection detected", {
          workspaceId,
          customerId,
          message,
          detectedPattern: match[0],
          severity: "CRITICAL",
        })

        await this.sendSecurityAlert({
          workspaceId,
          customerId,
          threatType: "SQL_INJECTION",
          message,
          detectedPattern: match[0],
          severity: "CRITICAL",
        })

        return {
          isSafe: false,
          threatType: "SQL_INJECTION",
          detectedPattern: match[0],
          severity: "CRITICAL",
          message:
            "Your message contains suspicious content. Please contact support if this is a mistake.",
        }
      }
    }

    // Check XSS
    for (const pattern of this.XSS_PATTERNS) {
      const match = pattern.exec(message)
      if (match) {
        logger.error("🚨 SECURITY ALERT: XSS detected", {
          workspaceId,
          customerId,
          message,
          detectedPattern: match[0],
          severity: "HIGH",
        })

        await this.sendSecurityAlert({
          workspaceId,
          customerId,
          threatType: "XSS",
          message,
          detectedPattern: match[0],
          severity: "HIGH",
        })

        return {
          isSafe: false,
          threatType: "XSS",
          detectedPattern: match[0],
          severity: "HIGH",
          message:
            "Your message contains suspicious content. Please contact support if this is a mistake.",
        }
      }
    }

    // Check Command Injection
    for (const pattern of this.COMMAND_PATTERNS) {
      const match = pattern.exec(message)
      if (match) {
        logger.error("🚨 SECURITY ALERT: Command Injection detected", {
          workspaceId,
          customerId,
          message,
          detectedPattern: match[0],
          severity: "CRITICAL",
        })

        await this.sendSecurityAlert({
          workspaceId,
          customerId,
          threatType: "COMMAND_INJECTION",
          message,
          detectedPattern: match[0],
          severity: "CRITICAL",
        })

        return {
          isSafe: false,
          threatType: "COMMAND_INJECTION",
          detectedPattern: match[0],
          severity: "CRITICAL",
          message:
            "Your message contains suspicious content. Please contact support if this is a mistake.",
        }
      }
    }

    // Check Path Traversal
    for (const pattern of this.PATH_PATTERNS) {
      const match = pattern.exec(message)
      if (match) {
        logger.error("🚨 SECURITY ALERT: Path Traversal detected", {
          workspaceId,
          customerId,
          message,
          detectedPattern: match[0],
          severity: "HIGH",
        })

        await this.sendSecurityAlert({
          workspaceId,
          customerId,
          threatType: "PATH_TRAVERSAL",
          message,
          detectedPattern: match[0],
          severity: "HIGH",
        })

        return {
          isSafe: false,
          threatType: "PATH_TRAVERSAL",
          detectedPattern: match[0],
          severity: "HIGH",
          message:
            "Your message contains suspicious content. Please contact support if this is a mistake.",
        }
      }
    }

    // All checks passed
    return { isSafe: true }
  }

  /**
   * Send security alert email to workspace admin
   * TODO: Implement email sending via EmailService
   *
   * @param alert - Alert details
   */
  private static async sendSecurityAlert(alert: {
    workspaceId: string
    customerId: string
    threatType: string
    message: string
    detectedPattern: string
    severity: string
  }): Promise<void> {
    // TODO: Integrate with EmailService when available
    logger.warn("🚨 SECURITY ALERT EMAIL (not sent - EmailService needed)", {
      ...alert,
      timestamp: new Date().toISOString(),
    })

    // Future implementation:
    // await EmailService.send({
    //   to: workspace.adminEmail,
    //   subject: `🚨 SECURITY ALERT: ${alert.threatType}`,
    //   body: `
    //     Threat Type: ${alert.threatType}
    //     Severity: ${alert.severity}
    //     Customer ID: ${alert.customerId}
    //     Workspace ID: ${alert.workspaceId}
    //     Message: ${alert.message}
    //     Detected Pattern: ${alert.detectedPattern}
    //     Timestamp: ${new Date().toISOString()}
    //   `
    // })
  }
}
