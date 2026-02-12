import { prisma } from '../config/database'
import logger from '../utils/logger'
import Handlebars from 'handlebars'

interface SecurityCheckResult {
  isSafe: boolean
  reason?: string
}

interface SecurityCheckParams {
  workspaceId: string
  messageContent: string
  customerId: string
}

/**
 * Security Agent Service for Scheduler
 * 
 * Validates outgoing messages before they are sent via WhatsApp.
 * Uses pattern-based detection for common threats:
 * - SQL Injection
 * - XSS attacks  
 * - Command injection
 * - Sensitive data exposure
 * - Spam/abuse patterns
 */
export class SecurityAgentService {
  // Dangerous patterns to detect
  private readonly dangerousPatterns: Array<{ pattern: RegExp; reason: string }> = [
    // SQL Injection patterns
    { pattern: /(\bSELECT\b.*\bFROM\b|\bDROP\b.*\bTABLE\b|\bUNION\b.*\bSELECT\b)/i, reason: 'SQL injection detected' },
    { pattern: /(\bINSERT\b.*\bINTO\b|\bUPDATE\b.*\bSET\b|\bDELETE\b.*\bFROM\b)/i, reason: 'SQL modification attempt' },
    
    // XSS patterns  
    { pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/i, reason: 'Script injection detected' },
    { pattern: /javascript:/i, reason: 'JavaScript protocol detected' },
    { pattern: /on(load|error|click|mouse|focus|blur|submit|change)=/i, reason: 'Event handler injection' },
    { pattern: /<iframe[\s\S]*?>/i, reason: 'Iframe injection detected' },
    
    // Command injection
    { pattern: /[;&|`$].*?(rm|cat|wget|curl|chmod|chown|sudo|bash|sh|nc|netcat)\b/i, reason: 'Command injection detected' },
    // Command substitution - only match actual shell patterns, not markdown backticks
    // $(command) or `command` with actual command-like content inside
    { pattern: /\$\([^)]*[a-z_][a-z0-9_]*\s/i, reason: 'Command substitution detected' },
    
    // Path traversal
    { pattern: /\.\.\/|\.\.\\|%2e%2e%2f/i, reason: 'Path traversal detected' },
    { pattern: /\/etc\/passwd|\/etc\/shadow/i, reason: 'Sensitive file access attempt' },
    
    // Sensitive data patterns (prevent accidental exposure)
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, reason: 'Credit card number detected' },
    { pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/i, reason: 'IBAN detected' },
    
    // Spam/abuse patterns
    { pattern: /(viagra|cialis|casino|lottery|winner|congratulations.*won|claim.*prize)/i, reason: 'Spam content detected' },
  ]
  private readonly openRouterApiKey = process.env.OPENROUTER_API_KEY || ''
  private readonly openRouterBaseUrl = 'https://openrouter.ai/api/v1'

  private buildSystemPrompt(basePrompt: string, variables: Record<string, string>) {
    // Use Handlebars to process BOTH conditionals ({{#if}}) AND variable replacement ({{var}})
    // in a single pass. noEscape prevents HTML-escaping values (not needed for LLM prompts).
    const template = Handlebars.compile(basePrompt, { noEscape: true })
    return template(variables)
  }

  /**
   * Validate a message before sending
   */
  async validateMessage(params: SecurityCheckParams): Promise<SecurityCheckResult> {
    const { workspaceId, messageContent, customerId } = params

    // 1. Check for empty message
    if (!messageContent || messageContent.trim().length === 0) {
      return { isSafe: false, reason: 'Empty message' }
    }

    // 2. Check customer is not blacklisted
    let customerName = 'Customer'
    try {
      const customer = await prisma.customers.findUnique({
        where: { 
          id: customerId,
          workspaceId, // Workspace isolation
        },
        select: { isBlacklisted: true, name: true },
      })

      if (customer?.isBlacklisted) {
        logger.warn(`🚫 Message blocked: Customer ${customerId} is blacklisted`)
        return { isSafe: false, reason: 'Customer is blacklisted' }
      }
      customerName = customer?.name || customerName
    } catch (error) {
      logger.error('Failed to check customer blacklist status:', error)
      // Don't block on error - proceed with pattern check
    }

    // 3. Check for dangerous patterns
    for (const { pattern, reason } of this.dangerousPatterns) {
      if (pattern.test(messageContent)) {
        logger.warn(`🚫 Message blocked: ${reason}`, {
          workspaceId,
          customerId,
          pattern: pattern.source,
        })
        return { isSafe: false, reason }
      }
    }

    // 4. Check message length (prevent extremely long messages)
    if (messageContent.length > 10000) {
      return { isSafe: false, reason: 'Message too long (max 10000 chars)' }
    }

    // 5. LLM-based Security (dynamic prompt from DB) - optional
    try {
      if (!this.openRouterApiKey) {
        logger.warn('⚠️ OPENROUTER_API_KEY missing - skipping LLM security check')
        return { isSafe: true }
      }

      const securityAgent = await prisma.agentConfig.findFirst({
        where: {
          workspaceId,
          type: 'SECURITY',
          isActive: true,
        },
        select: {
          systemPrompt: true,
          model: true,
          temperature: true,
          maxTokens: true,
        },
      })

      if (!securityAgent) {
        return { isSafe: true }
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { allowedExternalLinks: true },
      })

      // 🛡️ ALWAYS allow internal eChatbot domains (aligned with backend SecurityAgent.ts)
      const internalDomains = [
        'echatbot.ai',
        'www.echatbot.ai',
        'echatbot.ai/s/*',                    // Short links
        'www.echatbot.ai/s/*',
        'echatbot.ai/registration/*',          // Registration links
        'www.echatbot.ai/registration/*',
        'echatbot.ai/cart*',                   // Cart links
        'www.echatbot.ai/cart*',
        'echatbot.ai/orders-public*',          // Order links
        'www.echatbot.ai/orders-public*',
        'echatbot.ai/customer-profile*',       // Profile links
        'www.echatbot.ai/customer-profile*',
      ]

      // 🛡️ Merge internal domains with workspace-configured external links
      const allAllowedLinks = [
        ...internalDomains,
        ...(workspace?.allowedExternalLinks || []),
      ]

      const allowedLinks = allAllowedLinks.join(', ')

      const systemPrompt = this.buildSystemPrompt(securityAgent.systemPrompt, {
        nameUser: customerName,
        workspaceId,
        allowedExternalLinks: allowedLinks, // Fixed: camelCase to match Handlebars template
      })

      const userMessage = `Check if this message is safe:\n\n"${messageContent}"\n\nRespond with JSON: {"safe": true/false, "message": "...", "reason": "..."}` 

      const response = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://echatbot.ai',
          'X-Title': 'eChatbot Scheduler Security Layer',
        },
        body: JSON.stringify({
          model: securityAgent.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: securityAgent.temperature,
          max_tokens: securityAgent.maxTokens,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        logger.warn('⚠️ LLM security check failed - allowing message', {
          status: response.status,
          statusText: response.statusText,
        })
        return { isSafe: true }
      }

      const data: any = await response.json()
      const llmResponse = data?.choices?.[0]?.message?.content
      if (!llmResponse) {
        return { isSafe: true }
      }

      let parsed: { safe?: boolean; reason?: string; blockedReason?: string }
      try {
        parsed = JSON.parse(llmResponse)
      } catch (error) {
        logger.warn('⚠️ Failed to parse LLM security JSON - allowing message', {
          error,
        })
        return { isSafe: true }
      }

      const safe = parsed.safe !== false
      const reason = parsed.blockedReason || parsed.reason
      return { isSafe: safe, reason }
    } catch (error) {
      logger.warn('⚠️ LLM security check error - allowing message', { error })
      return { isSafe: true }
    }
  }
}
