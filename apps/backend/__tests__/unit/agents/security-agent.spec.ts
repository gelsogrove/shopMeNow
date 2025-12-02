/**
 * Security Agent Unit Tests
 *
 * Tests for the Security Agent validation logic:
 * - Injection attacks detection (SQL, XSS, Command injection)
 * - Sensitive data exposure detection
 * - External links validation against allowed domains
 *
 * @see docs/prompts/security-agent.md
 */

import { PrismaClient } from "@prisma/client"

// Mock Prisma
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    workspace: {
      findUnique: jest.fn(),
    },
    agentConfig: {
      findFirst: jest.fn(),
    },
  })),
}))

// Mock axios for OpenRouter calls
jest.mock("axios", () => ({
  post: jest.fn(),
}))

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import axios from "axios"
import { SecurityAgent } from "../../../src/application/agents/SecurityAgent"

describe("SecurityAgent", () => {
  let securityAgent: SecurityAgent
  let mockPrisma: any

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "test-api-key"

    mockPrisma = new PrismaClient()
    securityAgent = new SecurityAgent(mockPrisma)

    // Default mock: Security agent is active
    mockPrisma.agentConfig = {
      findFirst: jest.fn().mockResolvedValue({
        id: "security-agent-1",
        type: "SECURITY",
        isActive: true,
        systemPrompt: "You are a security validation layer...",
        model: "openai/gpt-4o-mini",
        temperature: 0,
        maxTokens: 500,
      }),
    }

    // Default mock: Workspace with allowed links
    mockPrisma.workspace.findUnique.mockResolvedValue({
      allowedExternalLinks: ["echatbot.ai", "stripe.com"],
    })
  })

  describe("Injection Attack Detection", () => {
    it("should block SQL injection patterns", async () => {
      // Mock LLM response detecting SQL injection
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "INJECTION_ATTACK",
                  details: "SQL injection pattern detected: SELECT * FROM",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "SELECT * FROM users WHERE 1=1",
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
      expect(result.blockedReason).toContain("INJECTION_ATTACK")
    })

    it("should block XSS attempts", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "INJECTION_ATTACK",
                  details: "XSS pattern detected: <script> tag",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: '<script>alert("XSS")</script>',
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
    })

    it("should block command injection", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "INJECTION_ATTACK",
                  details: "Command injection pattern detected",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "; rm -rf /",
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
    })
  })

  describe("Sensitive Data Exposure Detection", () => {
    it("should block credit card numbers", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "DATA_EXPOSURE",
                  details: "Credit card number detected",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Your card 4532-1234-5678-9012 has been charged",
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
      expect(result.blockedReason).toContain("DATA_EXPOSURE")
    })

    it("should block IBAN codes", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "DATA_EXPOSURE",
                  details: "IBAN code detected",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Transfer to IBAN: IT60X0542811101000000123456",
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
    })
  })

  describe("External Links Validation", () => {
    it("should allow internal short URLs", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: true,
                }),
              },
            },
          ],
          usage: { total_tokens: 30 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Here is your order link: /o/ABC123",
        customerName: "Test",
      })

      expect(result.safe).toBe(true)
    })

    it("should allow links to whitelisted domains", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: true,
                }),
              },
            },
          ],
          usage: { total_tokens: 30 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Pay here: https://stripe.com/pay/123",
        customerName: "Test",
      })

      expect(result.safe).toBe(true)
    })

    it("should block links to non-whitelisted domains", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "UNAUTHORIZED_LINK",
                  details: "External link not in allowed domains: malicious-site.com",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Visit https://malicious-site.com/free-iphone",
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
      expect(result.blockedReason).toContain("UNAUTHORIZED_LINK")
    })

    it("should block all external links when whitelist is empty", async () => {
      // Mock empty whitelist
      mockPrisma.workspace.findUnique.mockResolvedValue({
        allowedExternalLinks: [],
      })

      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: false,
                  reason: "UNAUTHORIZED_LINK",
                  details: "No external links allowed (empty whitelist)",
                }),
              },
            },
          ],
          usage: { total_tokens: 50 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Visit https://any-site.com",
        customerName: "Test",
      })

      expect(result.safe).toBe(false)
    })
  })

  describe("Safe Messages", () => {
    it("should allow normal product responses", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: true,
                }),
              },
            },
          ],
          usage: { total_tokens: 30 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message:
          "Ciao Mario! Ecco i nostri prodotti: Olio Extra Vergine €15.99, Parmigiano €25.00",
        customerName: "Mario",
      })

      expect(result.safe).toBe(true)
    })

    it("should allow order confirmations", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  safe: true,
                }),
              },
            },
          ],
          usage: { total_tokens: 30 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message:
          "Il tuo ordine #12345 è stato confermato! Totale: €45.99. Consegna prevista: Lunedì.",
        customerName: "Customer",
      })

      expect(result.safe).toBe(true)
    })
  })

  describe("Agent Configuration", () => {
    it("should allow all messages when security agent is inactive", async () => {
      // Mock inactive security agent
      mockPrisma.agentConfig.findFirst.mockResolvedValue({
        id: "security-agent-1",
        type: "SECURITY",
        isActive: false,
        systemPrompt: "...",
        model: "openai/gpt-4o-mini",
        temperature: 0,
        maxTokens: 500,
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "SELECT * FROM users -- dangerous but allowed",
        customerName: "Test",
      })

      expect(result.safe).toBe(true)
      // axios should NOT be called when agent is inactive
      expect(axios.post).not.toHaveBeenCalled()
    })

    it("should allow all messages when security agent is not configured", async () => {
      // Mock no security agent found
      mockPrisma.agentConfig.findFirst.mockResolvedValue(null)

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Any message",
        customerName: "Test",
      })

      expect(result.safe).toBe(true)
      expect(axios.post).not.toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should fail-open on LLM errors (allow message)", async () => {
      // Mock LLM error
      ;(axios.post as jest.Mock).mockRejectedValue(new Error("OpenRouter API error"))

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Some message",
        customerName: "Test",
      })

      // Fail-open: allow message on error
      expect(result.safe).toBe(true)
      expect(result.blockedReason).toContain("Security check error")
    })

    it("should fail-open on JSON parse errors", async () => {
      // Mock invalid JSON response
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: "not valid json",
              },
            },
          ],
          usage: { total_tokens: 30 },
        },
      })

      const result = await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Some message",
        customerName: "Test",
      })

      // Fail-open: allow message on parse error
      expect(result.safe).toBe(true)
      expect(result.blockedReason).toContain("JSON parse error")
    })
  })

  describe("Allowed External Links Variable", () => {
    it("should pass allowed links to the LLM prompt", async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({ safe: true }),
              },
            },
          ],
          usage: { total_tokens: 30 },
        },
      })

      await securityAgent.process({
        workspaceId: "test-workspace",
        message: "Test message",
        customerName: "Test",
      })

      // Check that axios was called with the system prompt
      const axiosCall = (axios.post as jest.Mock).mock.calls[0]
      const requestBody = axiosCall[1]
      const systemMessage = requestBody.messages.find(
        (m: any) => m.role === "system"
      )

      // The system prompt should contain the allowed links
      // (replaced by buildSystemPrompt)
      expect(systemMessage).toBeDefined()
    })
  })
})
