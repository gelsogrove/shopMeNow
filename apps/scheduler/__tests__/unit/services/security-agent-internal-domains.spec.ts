/**
 * Security Agent Service - Internal Domains Alignment Tests
 *
 * SCENARIO: Scheduler SecurityAgentService must include internal eChatbot domains
 * when sending the allowed links list to the LLM for outbound security validation.
 *
 * ROOT CAUSE OF BUG: Previously, scheduler only sent workspace.allowedExternalLinks
 * from the database, missing internal domains like echatbot.ai/registration/*,
 * causing the LLM to flag legitimate eChatbot links as UNAUTHORIZED_LINK.
 *
 * RULE: Internal domains in scheduler MUST match backend SecurityAgent.ts
 */

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}))

// Mock prisma
const mockPrisma = {
  customers: {
    findUnique: jest.fn(),
  },
  agentConfig: {
    findFirst: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
}
jest.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}))

// Mock fetch for OpenRouter
const mockFetch = jest.fn()
global.fetch = mockFetch

import { SecurityAgentService } from '../../../src/services/security-agent.service'

describe('SecurityAgentService - Internal Domains', () => {
  let service: SecurityAgentService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SecurityAgentService()
  })

  /**
   * SCENARIO: LLM security check should include internal eChatbot domains
   * RULE: Internal domains must be merged with workspace allowedExternalLinks
   */
  describe('Internal domains alignment with backend SecurityAgent', () => {
    const EXPECTED_INTERNAL_DOMAINS = [
      'echatbot.ai',
      'www.echatbot.ai',
      'echatbot.ai/s/*',
      'www.echatbot.ai/s/*',
      'echatbot.ai/registration/*',
      'www.echatbot.ai/registration/*',
      'echatbot.ai/cart*',
      'www.echatbot.ai/cart*',
      'echatbot.ai/orders-public*',
      'www.echatbot.ai/orders-public*',
      'echatbot.ai/customer-profile*',
      'www.echatbot.ai/customer-profile*',
    ]

    // SCENARIO: When LLM security check runs, it receives ALL internal domains
    it('should include all internal eChatbot domains in LLM prompt', async () => {
      // Setup: customer exists and is not blacklisted
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test Customer',
      })

      // Setup: security agent config exists WITH Handlebars {{#if}} conditionals
      // This matches the REAL template stored in the database (agent_configs.systemPrompt)
      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        systemPrompt: `# Security Agent

{{#if allowedExternalLinks}}
## ALLOWED EXTERNAL DOMAINS
The following domains are allowed for external links:
{{allowedExternalLinks}}
{{/if}}

Check if message is safe. Respond with JSON.`,
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        maxTokens: 500,
      })

      // Setup: workspace has some external links
      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: ['myshop.com', 'paypal.com'],
      })

      // Setup: LLM returns safe
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ safe: true, message: 'ok', reason: 'safe' }),
              },
            },
          ],
        }),
      })

      // Set API key via env
      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'

      // Need to recreate service to pick up env var
      service = new SecurityAgentService()

      await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Visit https://echatbot.ai/registration/my-shop?token=abc123',
        customerId: 'cust-456',
      })

      // VERIFY: fetch was called with system prompt containing all internal domains
      expect(mockFetch).toHaveBeenCalled()
      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const systemPromptSent = body.messages[0].content

      // RULE: All internal domains must be present in the prompt
      for (const domain of EXPECTED_INTERNAL_DOMAINS) {
        expect(systemPromptSent).toContain(domain)
      }

      // RULE: Workspace external links must also be present
      expect(systemPromptSent).toContain('myshop.com')
      expect(systemPromptSent).toContain('paypal.com')

      // RULE: Handlebars {{#if}} blocks must be processed - NO raw template syntax in final prompt
      expect(systemPromptSent).not.toContain('{{#if')
      expect(systemPromptSent).not.toContain('{{/if}}')
      expect(systemPromptSent).not.toContain('{{allowedExternalLinks}}')

      // RULE: The ALLOWED EXTERNAL DOMAINS section must be rendered (not stripped)
      expect(systemPromptSent).toContain('ALLOWED EXTERNAL DOMAINS')

      // Restore env
      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: Handlebars template with {{#if}} must NOT render "true" instead of actual values
    // ROOT CAUSE OF BUG: buildSystemPrompt was doing 2-pass (booleans then regex) causing
    // {{allowedExternalLinks}} to be replaced with "true" instead of actual domain list
    it('should render actual domain values, NOT boolean "true" in Handlebars template', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test Customer',
      })

      // Template with {{#if}} + {{variable}} inside (matches real DB template)
      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        systemPrompt: `{{#if allowedExternalLinks}}
## ALLOWED DOMAINS
{{allowedExternalLinks}}
{{/if}}
Validate the message.`,
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        maxTokens: 500,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: ['example.com', 'trusted.org'],
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"safe": true}' } }],
        }),
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()

      await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Hello, check https://echatbot.ai/registration/test',
        customerId: 'cust-456',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const prompt = body.messages[0].content

      // RULE: Must contain actual domain values, NOT the word "true"
      expect(prompt).toContain('example.com')
      expect(prompt).toContain('trusted.org')
      expect(prompt).toContain('echatbot.ai')
      expect(prompt).toContain('ALLOWED DOMAINS')

      // RULE: Must NOT contain raw Handlebars syntax
      expect(prompt).not.toContain('{{#if')
      expect(prompt).not.toContain('{{/if}}')
      expect(prompt).not.toContain('{{allowedExternalLinks}}')

      // CRITICAL REGRESSION CHECK: Must NOT contain "true" as the domain value
      // This was the bug - Handlebars replaced {{allowedExternalLinks}} with "true" (boolean)
      // instead of the actual domain list
      const allowedSection = prompt.split('ALLOWED DOMAINS')[1]?.split('Validate')[0] || ''
      expect(allowedSection).not.toMatch(/^\s*true\s*$/m)

      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: Internal domains should be present even if workspace has no external links
    it('should include internal domains even when workspace has empty allowedExternalLinks', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test',
      })

      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        systemPrompt: `{{#if allowedExternalLinks}}
Allowed: {{allowedExternalLinks}}
{{/if}}
Validate message.`,
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        maxTokens: 500,
      })

      // Empty external links
      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: [],
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"safe": true}' } }],
        }),
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()

      await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Check this: https://echatbot.ai/customer-profile?token=xyz',
        customerId: 'cust-456',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const prompt = body.messages[0].content

      // RULE: Internal domains always present regardless of workspace config
      expect(prompt).toContain('echatbot.ai/customer-profile*')
      expect(prompt).toContain('echatbot.ai/registration/*')

      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: Registration links should NEVER be flagged as unsafe
    it('should not block messages containing echatbot.ai registration links', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test',
      })

      // No agent config = no LLM check, pattern-only
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      // RULE: Pattern check should not flag registration URLs
      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Please register here: https://echatbot.ai/registration/my-shop?token=abc123',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })

    // SCENARIO: Cart links should not be flagged
    it('should not block messages containing echatbot.ai cart links', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test',
      })
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'View cart: https://www.echatbot.ai/cart?token=xyz789',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })

    // SCENARIO: Short links should not be flagged
    it('should not block messages containing echatbot.ai short links', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test',
      })
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Here is your link: https://echatbot.ai/s/abc123',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })
  })

  describe('Pattern-based security checks', () => {
    beforeEach(() => {
      // Default: customer exists, not blacklisted
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test',
      })
      // No LLM security agent
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)
    })

    // SCENARIO: SQL injection should be blocked
    it('should block SQL injection attempts', async () => {
      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: "SELECT * FROM users; DROP TABLE orders;",
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(false)
      expect(result.reason).toContain('SQL')
    })

    // SCENARIO: XSS should be blocked
    it('should block XSS script injection', async () => {
      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: '<script>alert("xss")</script>',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(false)
      expect(result.reason).toContain('Script injection')
    })

    // SCENARIO: Empty messages should be blocked
    it('should block empty messages', async () => {
      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: '',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(false)
      expect(result.reason).toBe('Empty message')
    })

    // SCENARIO: Normal messages should pass
    it('should allow normal messages', async () => {
      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Hello! Your order #1234 has been shipped. Track it here: https://echatbot.ai/orders-public?token=abc',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })

    // SCENARIO: Blacklisted customers should be blocked
    it('should block messages to blacklisted customers', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: true,
        name: 'Blocked User',
      })

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Normal message',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(false)
      expect(result.reason).toContain('blacklisted')
    })

    // SCENARIO: Messages over 10000 chars should be blocked
    it('should block messages exceeding 10000 characters', async () => {
      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'A'.repeat(10001),
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(false)
      expect(result.reason).toContain('too long')
    })
  })

  /**
   * SCENARIO: LLM returns UNAUTHORIZED_LINK but all URLs are internal eChatbot domains.
   * RULE: The code must override the LLM's false-positive and allow the message.
   * ROOT CAUSE: GPT-4o-mini sometimes fails to match https://echatbot.ai/registration/...
   * against the allowed pattern echatbot.ai/registration/* in the prompt.
   */
  describe('LLM UNAUTHORIZED_LINK override for internal URLs', () => {
    beforeEach(() => {
      // Customer exists, not blacklisted
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Andrea Gelsomino',
      })

      // Security agent config exists
      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        systemPrompt: `# Security Agent
{{#if allowedExternalLinks}}
## ALLOWED EXTERNAL DOMAINS
{{allowedExternalLinks}}
{{/if}}
Check if message is safe. Respond with JSON.`,
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        maxTokens: 500,
      })

      // Workspace exists
      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: [],
      })
    })

    // SCENARIO: LLM incorrectly flags echatbot.ai registration link as UNAUTHORIZED_LINK
    // RULE: Override LLM false-positive when all URLs are from echatbot.ai domain
    it('should override LLM UNAUTHORIZED_LINK for echatbot.ai registration links', async () => {
      // Setup: LLM returns UNAUTHORIZED_LINK false-positive
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                safe: false,
                reason: 'UNAUTHORIZED_LINK',
                details: 'External URL detected',
              }),
            },
          }],
        }),
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()

      const result = await service.validateMessage({
        workspaceId: 'echatbot-hq-support',
        messageContent: 'Ciao! Registrati qui: https://echatbot.ai/registration/echatbot-hq-support?token=abc123',
        customerId: 'cust-456',
      })

      // RULE: Must be safe - override LLM false-positive
      expect(result.isSafe).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Security override'),
        expect.any(Object),
      )

      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: LLM flags external URL as UNAUTHORIZED_LINK — should NOT override
    // RULE: Only override for internal echatbot.ai domains, not external URLs
    it('should NOT override LLM UNAUTHORIZED_LINK for external URLs', async () => {
      // Setup: LLM correctly blocks an external URL
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                safe: false,
                reason: 'UNAUTHORIZED_LINK',
                details: 'External URL detected',
              }),
            },
          }],
        }),
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Visit https://evil-site.com/phishing for more info',
        customerId: 'cust-456',
      })

      // RULE: Must remain blocked — external URL is NOT internal
      expect(result.isSafe).toBe(false)
      expect(result.reason).toBe('UNAUTHORIZED_LINK')

      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: Message with www.echatbot.ai URL should also be overridden
    it('should override LLM UNAUTHORIZED_LINK for www.echatbot.ai URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                safe: false,
                reason: 'UNAUTHORIZED_LINK',
                details: 'URL not in allowed list',
              }),
            },
          }],
        }),
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Ecco il tuo carrello: https://www.echatbot.ai/cart?token=xyz',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: Mixed internal + external URLs should NOT override
    // RULE: ALL URLs must be internal for the override to apply
    it('should NOT override when message has mix of internal and external URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                safe: false,
                reason: 'UNAUTHORIZED_LINK',
              }),
            },
          }],
        }),
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Visit https://echatbot.ai/cart and also https://malicious.com/steal',
        customerId: 'cust-456',
      })

      // RULE: Must remain blocked — not all URLs are internal
      expect(result.isSafe).toBe(false)
      process.env.OPENROUTER_API_KEY = originalKey
    })
  })
})
