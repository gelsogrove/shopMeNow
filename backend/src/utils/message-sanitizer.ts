/**
 * 🔒 MESSAGE CONTENT SANITIZER
 *
 * Protegge contro:
 * - XSS injection
 * - SQL injection (anche se Prisma protegge già)
 * - Command injection
 * - Malicious URLs
 * - Script injection
 * - Excessive message length (spam/abuse)
 * - Phishing attempts
 *
 * @author Andrea Gelso
 * @date 2025-01-13
 */

import logger from "./logger"

// Configuration
const MAX_MESSAGE_LENGTH = 4096 // WhatsApp limit
const MAX_URL_COUNT = 5 // Max URLs per message
const MAX_PHONE_NUMBERS = 3 // Max phone numbers per message

// Dangerous patterns (regex)
const DANGEROUS_PATTERNS = {
  // Script injection
  SCRIPT_TAG: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  JAVASCRIPT_PROTOCOL: /javascript:/gi,
  ONERROR_HANDLER: /onerror\s*=/gi,
  ONCLICK_HANDLER: /onclick\s*=/gi,

  // SQL injection attempts (Prisma protegge già, ma meglio essere sicuri)
  SQL_KEYWORDS:
    /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b).*(\bFROM\b|\bWHERE\b|\bTABLE\b)/gi,

  // Command injection
  SHELL_COMMANDS: /(\$\(|\`|&&|\|\||;|>|<)/g,

  // Suspicious URLs (phishing indicators)
  SUSPICIOUS_URLS:
    /(bit\.ly|tinyurl|goo\.gl|ow\.ly|t\.co|is\.gd)\/[a-zA-Z0-9]+/gi,
  DOUBLE_ENCODED_URL: /%25[0-9A-F]{2}/gi,

  // Excessive repeated characters (spam indicator)
  EXCESSIVE_REPEATS: /(.)\1{10,}/g,
}

// Blacklisted keywords (case-insensitive)
const BLACKLISTED_KEYWORDS = [
  // Phishing
  "verify your account",
  "urgent action required",
  "suspended account",
  "click here immediately",
  "confirm your password",
  "verify your identity",

  // Crypto scams
  "free bitcoin",
  "crypto giveaway",
  "double your money",
  "guaranteed profit",

  // Generic scam patterns
  "congratulations you won",
  "claim your prize",
  "limited time offer expires",
]

export interface SanitizationResult {
  isValid: boolean
  sanitizedMessage?: string
  errors: string[]
  warnings: string[]
  metadata: {
    originalLength: number
    sanitizedLength?: number
    urlCount?: number
    phoneNumberCount?: number
    suspiciousPatterns?: string[]
  }
}

/**
 * Sanitize and validate message content
 */
export function sanitizeMessageContent(message: string): SanitizationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const suspiciousPatterns: string[] = []

  // VALIDATION 1: Message length
  if (!message || message.trim().length === 0) {
    errors.push("Message is empty")
    return {
      isValid: false,
      errors,
      warnings,
      metadata: { originalLength: 0 },
    }
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push(
      `Message exceeds maximum length (${message.length}/${MAX_MESSAGE_LENGTH} chars)`
    )
  }

  // VALIDATION 2: Detect script injection
  if (DANGEROUS_PATTERNS.SCRIPT_TAG.test(message)) {
    errors.push("Script tags detected - potential XSS attack")
    suspiciousPatterns.push("SCRIPT_TAG")
    logger.error("🚨 [SECURITY] Script injection attempt detected!", {
      pattern: "SCRIPT_TAG",
      message: message.substring(0, 100),
    })
  }

  if (DANGEROUS_PATTERNS.JAVASCRIPT_PROTOCOL.test(message)) {
    errors.push("JavaScript protocol detected - potential XSS attack")
    suspiciousPatterns.push("JAVASCRIPT_PROTOCOL")
    logger.error("🚨 [SECURITY] JavaScript protocol injection detected!", {
      pattern: "JAVASCRIPT_PROTOCOL",
      message: message.substring(0, 100),
    })
  }

  if (
    DANGEROUS_PATTERNS.ONERROR_HANDLER.test(message) ||
    DANGEROUS_PATTERNS.ONCLICK_HANDLER.test(message)
  ) {
    errors.push("Event handlers detected - potential XSS attack")
    suspiciousPatterns.push("EVENT_HANDLER")
    logger.error("🚨 [SECURITY] Event handler injection detected!", {
      pattern: "EVENT_HANDLER",
      message: message.substring(0, 100),
    })
  }

  // VALIDATION 3: Detect SQL injection attempts
  if (DANGEROUS_PATTERNS.SQL_KEYWORDS.test(message)) {
    warnings.push("SQL-like keywords detected - message flagged for review")
    suspiciousPatterns.push("SQL_KEYWORDS")
    logger.warn("⚠️ [SECURITY] Possible SQL injection attempt", {
      pattern: "SQL_KEYWORDS",
      message: message.substring(0, 100),
    })
  }

  // VALIDATION 4: Detect command injection
  if (DANGEROUS_PATTERNS.SHELL_COMMANDS.test(message)) {
    errors.push(
      "Shell command characters detected - potential command injection"
    )
    suspiciousPatterns.push("SHELL_COMMANDS")
    logger.error("🚨 [SECURITY] Shell command injection attempt detected!", {
      pattern: "SHELL_COMMANDS",
      message: message.substring(0, 100),
    })
  }

  // VALIDATION 5: Count and validate URLs
  const urlMatches = message.match(/https?:\/\/[^\s]+/gi) || []
  const urlCount = urlMatches.length

  if (urlCount > MAX_URL_COUNT) {
    errors.push(
      `Too many URLs in message (${urlCount}/${MAX_URL_COUNT}) - possible spam`
    )
    suspiciousPatterns.push("EXCESSIVE_URLS")
    logger.warn("⚠️ [SECURITY] Excessive URLs detected", {
      urlCount,
      urls: urlMatches,
    })
  }

  // Check for suspicious URL shorteners
  const suspiciousUrls = message.match(DANGEROUS_PATTERNS.SUSPICIOUS_URLS) || []
  if (suspiciousUrls.length > 0) {
    warnings.push(
      `Suspicious URL shorteners detected (${suspiciousUrls.length}) - potential phishing`
    )
    suspiciousPatterns.push("SUSPICIOUS_URLS")
    logger.warn("⚠️ [SECURITY] Suspicious URL shorteners detected", {
      urls: suspiciousUrls,
    })
  }

  // Check for double-encoded URLs (obfuscation technique)
  if (DANGEROUS_PATTERNS.DOUBLE_ENCODED_URL.test(message)) {
    warnings.push("Double-encoded URL detected - possible obfuscation attempt")
    suspiciousPatterns.push("DOUBLE_ENCODED_URL")
    logger.warn("⚠️ [SECURITY] Double-encoded URL detected", {
      message: message.substring(0, 100),
    })
  }

  // VALIDATION 6: Count phone numbers (prevent spam)
  const phoneMatches = message.match(/\+?[0-9]{1,4}[\s.-]?[0-9]{6,14}/g) || []
  const phoneNumberCount = phoneMatches.length

  if (phoneNumberCount > MAX_PHONE_NUMBERS) {
    warnings.push(
      `Excessive phone numbers detected (${phoneNumberCount}/${MAX_PHONE_NUMBERS}) - possible spam`
    )
    suspiciousPatterns.push("EXCESSIVE_PHONES")
  }

  // VALIDATION 7: Detect excessive character repetition (spam indicator)
  const excessiveRepeats = message.match(DANGEROUS_PATTERNS.EXCESSIVE_REPEATS)
  if (excessiveRepeats) {
    warnings.push("Excessive character repetition detected - possible spam")
    suspiciousPatterns.push("EXCESSIVE_REPEATS")
    logger.warn("⚠️ [SECURITY] Spam pattern detected (excessive repeats)", {
      pattern: excessiveRepeats[0].substring(0, 20),
    })
  }

  // VALIDATION 8: Check for blacklisted phishing keywords
  const lowerMessage = message.toLowerCase()
  const foundBlacklisted = BLACKLISTED_KEYWORDS.filter((keyword) =>
    lowerMessage.includes(keyword)
  )

  if (foundBlacklisted.length > 0) {
    warnings.push(`Phishing keywords detected: ${foundBlacklisted.join(", ")}`)
    suspiciousPatterns.push("PHISHING_KEYWORDS")
    logger.warn("⚠️ [SECURITY] Phishing keywords detected", {
      keywords: foundBlacklisted,
      message: message.substring(0, 100),
    })
  }

  // SANITIZATION: Remove dangerous patterns (if any)
  let sanitizedMessage = message

  // Remove script tags
  sanitizedMessage = sanitizedMessage.replace(
    DANGEROUS_PATTERNS.SCRIPT_TAG,
    "[REMOVED:SCRIPT]"
  )

  // Remove javascript: protocols
  sanitizedMessage = sanitizedMessage.replace(
    DANGEROUS_PATTERNS.JAVASCRIPT_PROTOCOL,
    "[REMOVED:JS_PROTOCOL]"
  )

  // Remove event handlers
  sanitizedMessage = sanitizedMessage.replace(
    DANGEROUS_PATTERNS.ONERROR_HANDLER,
    "[REMOVED:HANDLER]"
  )
  sanitizedMessage = sanitizedMessage.replace(
    DANGEROUS_PATTERNS.ONCLICK_HANDLER,
    "[REMOVED:HANDLER]"
  )

  // Remove shell command characters (replace with safe alternatives)
  sanitizedMessage = sanitizedMessage.replace(/\$\(/g, "$(")
  sanitizedMessage = sanitizedMessage.replace(/\`/g, "'")
  sanitizedMessage = sanitizedMessage.replace(/&&/g, " and ")
  sanitizedMessage = sanitizedMessage.replace(/\|\|/g, " or ")

  // Trim excessive whitespace
  sanitizedMessage = sanitizedMessage.replace(/\s+/g, " ").trim()

  // If we had to sanitize, add warning
  if (sanitizedMessage !== message) {
    warnings.push(
      "Message was automatically sanitized - dangerous patterns removed"
    )
    logger.warn("⚠️ [SECURITY] Message sanitized", {
      originalLength: message.length,
      sanitizedLength: sanitizedMessage.length,
      patternsRemoved: suspiciousPatterns,
    })
  }

  // Final result
  const isValid = errors.length === 0

  return {
    isValid,
    sanitizedMessage: isValid ? sanitizedMessage : undefined,
    errors,
    warnings,
    metadata: {
      originalLength: message.length,
      sanitizedLength: sanitizedMessage.length,
      urlCount,
      phoneNumberCount,
      suspiciousPatterns:
        suspiciousPatterns.length > 0 ? suspiciousPatterns : undefined,
    },
  }
}

/**
 * Quick validation for message length only (lightweight check)
 */
export function validateMessageLength(message: string): {
  isValid: boolean
  error?: string
} {
  if (!message || message.trim().length === 0) {
    return { isValid: false, error: "Message is empty" }
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message exceeds maximum length (${message.length}/${MAX_MESSAGE_LENGTH} chars)`,
    }
  }

  return { isValid: true }
}

/**
 * Get security score for message (0-100)
 * Used for analytics and monitoring
 */
export function getMessageSecurityScore(message: string): number {
  const result = sanitizeMessageContent(message)
  let score = 100

  // Deduct points for issues
  score -= result.errors.length * 30 // Critical issues
  score -= result.warnings.length * 10 // Warnings
  score -= (result.metadata.urlCount || 0) * 5 // Each URL
  score -= (result.metadata.phoneNumberCount || 0) * 3 // Each phone

  return Math.max(0, score)
}
