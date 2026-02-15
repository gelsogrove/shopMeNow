/**
 * Security Agent Service - Internal Domains Alignment Tests
 *
 * SCENARIO: Scheduler SecurityAgentService must include internal eChatbot domains
 * when sending the allowed links list to the LLM for outbound security validation.
 *
 * ROOT CAUSE OF BUG (4 days debugging!):
 * 1. Scheduler only sent workspace.allowedExternalLinks from DB, missing echatbot.ai
 * 2. Handlebars 2-pass compilation replaced {{allowedExternalLinks}} with "true"
 * 3. LLM (GPT-4o-mini) flagged echatbot.ai links as UNAUTHORIZED_LINK (false positive)
 * 4. blocked status was TERMINAL — messages never retried
 * 5. No code-level override existed to catch LLM false positives on internal domains
 *
 * SOLUTION:
 * - Always inject echatbot.ai + www.echatbot.ai as internal domains
 * - Single-pass Handlebars compilation (no boolean "true" bug)
 * - Code-level override: if LLM says UNAUTHORIZED_LINK but ALL URLs are echatbot.ai → allow
 * - debugPrompt/debugModel returned to debug view for visibility
 *
 * RULE: These tests are the BIBLE — never change logic without Andrea's approval
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
    // Only base domains — no need to list every path, the domain check is sufficient
    const EXPECTED_INTERNAL_DOMAINS = [
      'echatbot.ai',
      'www.echatbot.ai',
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

      // RULE: Internal base domains always present regardless of workspace config
      expect(prompt).toContain('echatbot.ai')
      expect(prompt).toContain('www.echatbot.ai')

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

    // SCENARIO: LLM incorrectly flags a URL that IS in workspace allowedExternalLinks
    // RULE: Override LLM false-positive when all URLs match allowed domains (not just echatbot.ai)
    // ROOT CAUSE: LLM (GPT-4o-mini) sometimes fails to match www.youtube.com against youtube.com
    it('should override LLM UNAUTHORIZED_LINK for workspace allowedExternalLinks domains', async () => {
      // Setup: Workspace has youtube.com as allowed domain
      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: ['youtube.com', 'paypal.com'],
        name: 'Test Workspace',
      })

      // Setup: LLM returns UNAUTHORIZED_LINK false-positive for youtube link
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                safe: false,
                reason: 'UNAUTHORIZED_LINK',
                details: 'External URL detected: www.youtube.com',
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
        messageContent: 'Buongiorno! Ecco il link della canzone https://www.youtube.com/watch?v=Qem0WSJXLCE',
        customerId: 'cust-456',
      })

      // RULE: Must be safe — youtube.com is in allowedExternalLinks, LLM is wrong
      expect(result.isSafe).toBe(true)
      process.env.OPENROUTER_API_KEY = originalKey
    })

    // SCENARIO: Mix of allowed external + disallowed URLs should still block
    // RULE: ALL URLs must be from allowed domains for override to apply
    it('should NOT override when message has allowed + disallowed URLs mixed', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: ['youtube.com'],
        name: 'Test Workspace',
      })

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
        messageContent: 'Guarda https://www.youtube.com/watch?v=abc e anche https://malicious.com/steal',
        customerId: 'cust-456',
      })

      // RULE: Must remain blocked — malicious.com is NOT allowed
      expect(result.isSafe).toBe(false)
      process.env.OPENROUTER_API_KEY = originalKey
    })
  })

  /**
   * 🔴 REGRESSION TESTS - 4-DAY BUG (Feb 2026)
   *
   * These tests prevent the exact bugs that took 4 days to debug in production.
   * NEVER remove or weaken these without Andrea's explicit approval.
   *
   * Bug timeline:
   * Day 1: Messages blocked with UNAUTHORIZED_LINK — couldn't see why
   * Day 2: Found Handlebars rendered "true" instead of domain list
   * Day 3: Fixed Handlebars, but LLM still false-positive on echatbot.ai links
   * Day 4: Added code-level override + debug view with real prompt
   */
  describe('🔴 REGRESSION: UNAUTHORIZED_LINK 4-day production bug', () => {
    // Helper to set up LLM mock that returns UNAUTHORIZED_LINK
    const setupLLMBlockMock = () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                safe: false,
                reason: 'UNAUTHORIZED_LINK',
                details: 'External URL not in allowed domains',
              }),
            },
          }],
        }),
      })
    }

    const setupLLMSafeMock = () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({ safe: true }),
            },
          }],
        }),
      })
    }

    beforeEach(() => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        isBlacklisted: false,
        name: 'Test Customer',
      })

      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        systemPrompt: `# Security Agent - {{companyName}}
{{#if allowedExternalLinks}}
## ALLOWED EXTERNAL DOMAINS
{{allowedExternalLinks}}
{{/if}}
Check if message is safe. Respond with JSON: {"safe": true/false, "reason": "..."}`,
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        maxTokens: 500,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: ['paypall.com'],
        name: 'eChatbot HQ',
      })

      const originalKey = process.env.OPENROUTER_API_KEY
      process.env.OPENROUTER_API_KEY = 'test-key'
      service = new SecurityAgentService()
    })

    afterEach(() => {
      delete process.env.OPENROUTER_API_KEY
    })

    // REGRESSION: The EXACT message that was blocked in production for 4 days
    // This is the registration link that eChatbot sends to new workspace owners
    it('should NEVER block echatbot.ai/registration links (the exact production bug)', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'echatbot-hq-support',
        messageContent: 'Ciao Andrea! Benvenuto su eChatbot. Registrati qui: https://echatbot.ai/registration/echatbot-hq-support?token=eyJhbGciOiJIUzI1NiJ9.abc123',
        customerId: 'cust-production',
      })

      // CRITICAL: Must be safe — this is an internal link, LLM is wrong
      expect(result.isSafe).toBe(true)
    })

    // REGRESSION: Order links were also blocked
    it('should NEVER block echatbot.ai/orders-public links', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'echatbot-hq-support',
        messageContent: 'Il tuo ordine è pronto! Controlla qui: https://echatbot.ai/orders-public?token=abc123&orderId=ord_456',
        customerId: 'cust-789',
      })

      expect(result.isSafe).toBe(true)
    })

    // REGRESSION: Cart links were also blocked
    it('should NEVER block echatbot.ai/cart links', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Ecco il tuo carrello: https://www.echatbot.ai/cart?token=xyz789&workspaceId=ws-123',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })

    // REGRESSION: Short links (echatbot.ai/s/xxx) were also blocked
    it('should NEVER block echatbot.ai/s/ short links', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Clicca qui per vedere i dettagli: https://echatbot.ai/s/abc123xyz',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })

    // REGRESSION: Customer profile links were also blocked
    it('should NEVER block echatbot.ai/customer-profile links', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Accedi al tuo profilo: https://echatbot.ai/customer-profile?token=profile_token_123',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true)
    })

    // REGRESSION: External URLs must STILL be blocked — override only for echatbot.ai
    it('should STILL block truly external UNAUTHORIZED_LINK', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Visita https://phishing-site.com/steal-your-data',
        customerId: 'cust-456',
      })

      // CRITICAL: External links must remain blocked
      expect(result.isSafe).toBe(false)
      expect(result.reason).toBe('UNAUTHORIZED_LINK')
    })

    // REGRESSION: Domains list in prompt must be SIMPLE (just base domains)
    // Bug was: listing every path (echatbot.ai/s/*, echatbot.ai/cart*, etc) = useless noise
    it('should send only base domains to LLM, not every path pattern', async () => {
      setupLLMSafeMock()

      await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Normal safe message',
        customerId: 'cust-456',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const prompt = body.messages[0].content

      // RULE: Only base domains, NOT path patterns
      expect(prompt).toContain('echatbot.ai')
      expect(prompt).toContain('www.echatbot.ai')
      expect(prompt).toContain('paypall.com') // from DB

      // RULE: Must NOT contain path-specific patterns (the old noise)
      expect(prompt).not.toContain('echatbot.ai/s/*')
      expect(prompt).not.toContain('echatbot.ai/registration/*')
      expect(prompt).not.toContain('echatbot.ai/cart*')
      expect(prompt).not.toContain('echatbot.ai/orders-public*')
      expect(prompt).not.toContain('echatbot.ai/customer-profile*')
    })

    // REGRESSION: Handlebars must NOT render "true" instead of actual domain values
    // This was the root cause — 2-pass compilation replaced variables with booleans
    it('should never render boolean "true" instead of domain list in prompt', async () => {
      setupLLMSafeMock()

      await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Test message',
        customerId: 'cust-456',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const prompt = body.messages[0].content

      // CRITICAL: The word "true" must NOT appear as a domain value
      // Split at ALLOWED EXTERNAL DOMAINS and check the domain section
      const domainSection = prompt.split('ALLOWED EXTERNAL DOMAINS')[1]?.split('Check if')[0] || ''
      expect(domainSection).not.toMatch(/^\s*true\s*$/m)
      expect(domainSection).toContain('echatbot.ai')
    })

    // REGRESSION: {{companyName}} must be replaced with actual workspace name
    // Bug: prompt showed "# Security Agent - " (empty) because companyName wasn't passed
    it('should replace {{companyName}} with workspace name', async () => {
      setupLLMSafeMock()

      await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Test message',
        customerId: 'cust-456',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const prompt = body.messages[0].content

      // RULE: companyName must be resolved to workspace.name
      expect(prompt).toContain('# Security Agent - eChatbot HQ')
      expect(prompt).not.toContain('{{companyName}}')
    })

    // REGRESSION: debugPrompt and debugModel must be returned for debug view
    // Bug: debug view showed hardcoded "security-patterns/v1" instead of real prompt
    it('should return debugPrompt and debugModel in SecurityCheckResult', async () => {
      setupLLMSafeMock()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Test message',
        customerId: 'cust-456',
      })

      // RULE: Result must contain the actual compiled prompt and model
      expect(result.debugPrompt).toBeDefined()
      expect(result.debugPrompt).toContain('Security Agent')
      expect(result.debugPrompt).toContain('echatbot.ai')
      expect(result.debugModel).toBe('openai/gpt-4o-mini')
    })

    // REGRESSION: Override must also return debugPrompt/debugModel
    // So debug view shows what happened even when override kicks in
    it('should return debugPrompt and debugModel even when overriding LLM', async () => {
      setupLLMBlockMock()

      const result = await service.validateMessage({
        workspaceId: 'ws-123',
        messageContent: 'Link: https://echatbot.ai/registration/test?token=abc',
        customerId: 'cust-456',
      })

      expect(result.isSafe).toBe(true) // Overridden
      expect(result.debugPrompt).toBeDefined()
      expect(result.debugPrompt).toContain('Security Agent')
      expect(result.debugModel).toBe('openai/gpt-4o-mini')
    })
  })
})
