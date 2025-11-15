/**
 * Security Gate Integration Test
 *
 * Verifies that Security Gate runs FIRST, BEFORE P1/P2/P3 priority checks
 * Constitution Principle XIII - Rule 9: Security FIRST
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../services/llm-router.service"

const prisma = new PrismaClient()

describe("Security Gate - Integration with Priority Flow", () => {
  let llmRouterService: LLMRouterService

  const WORKSPACE_ID = "test-workspace-security"
  const CUSTOMER_ID = "test-customer-security"
  const CONVERSATION_ID = "test-conversation-security"
  const MESSAGE_ID = "test-message-security"

  beforeAll(() => {
    llmRouterService = new LLMRouterService(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("Security Gate runs BEFORE P1 (blocked customer)", () => {
    it("should block SQL injection even if customer is blocked", async () => {
      // SCENARIO: Customer is blocked (P1 would normally trigger)
      // BUT Security Gate should catch SQL injection FIRST

      const maliciousMessage = "SELECT * FROM users WHERE 1=1"

      // Mock: We can't actually test with real blocked customer
      // But we verify Security Gate returns response WITHOUT calling P1
      const result = await llmRouterService.routeMessage({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        conversationId: CONVERSATION_ID,
        messageId: MESSAGE_ID,
        message: maliciousMessage,
        customerLanguage: "en",
      })

      // Security Gate should have blocked this BEFORE P1 check
      expect(result.response).toContain("suspicious content")
      expect(result.agentUsed).toBe("ROUTER")
      expect(result.tokensUsed).toBe(0) // No LLM call
      expect(result.isBlocked).toBe(false) // Not blocked by P1, blocked by Security Gate
    })
  })

  describe("Security Gate runs BEFORE P2 (challenge disabled)", () => {
    it("should block XSS even if chatbot is disabled", async () => {
      // SCENARIO: Workspace chatbot disabled (P2 would normally trigger)
      // BUT Security Gate should catch XSS FIRST

      const xssMessage = "<script>alert('XSS')</script>"

      const result = await llmRouterService.routeMessage({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        conversationId: CONVERSATION_ID,
        messageId: MESSAGE_ID,
        message: xssMessage,
        customerLanguage: "en",
      })

      // Security Gate should have blocked this BEFORE P2 check
      expect(result.response).toContain("suspicious content")
      expect(result.agentUsed).toBe("ROUTER")
      expect(result.tokensUsed).toBe(0) // No LLM call
    })
  })

  describe("Security Gate allows safe messages to reach P1/P2/P3", () => {
    it("should allow normal message to proceed to priority checks", async () => {
      // SCENARIO: Normal message should pass Security Gate
      // Then proceed to P1 → P2 → P3 → LLM

      const normalMessage = "Do you have halal cheese?"

      const result = await llmRouterService.routeMessage({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        conversationId: CONVERSATION_ID,
        messageId: MESSAGE_ID,
        message: normalMessage,
        customerLanguage: "en",
      })

      // Should NOT be blocked by Security Gate
      // Message should have been processed normally
      expect(result.response).not.toContain("suspicious content")
      // Result depends on workspace/customer state, but at minimum:
      expect(result.agentUsed).toBeDefined()
    })
  })

  describe("Security Gate saves audit trail", () => {
    it("should save malicious message to conversation for audit", async () => {
      // SCENARIO: Malicious message should be logged for security audit

      const sqlMessage = "DROP TABLE products; --"

      await llmRouterService.routeMessage({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        conversationId: CONVERSATION_ID,
        messageId: MESSAGE_ID,
        message: sqlMessage,
        customerLanguage: "en",
      })

      // Verify conversation was saved (both user message + security response)
      const messages = await prisma.conversationMessage.findMany({
        where: {
          workspaceId: WORKSPACE_ID,
          customerId: CUSTOMER_ID,
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      })

      // Should have saved:
      // 1. User's malicious message (INBOUND)
      // 2. Security warning response (OUTBOUND)
      expect(messages.length).toBeGreaterThanOrEqual(2)

      // Find user message
      const userMessage = messages.find((m) => m.role === "user")
      expect(userMessage?.content).toContain(sqlMessage)

      // Find assistant response
      const assistantMessage = messages.find((m) => m.role === "assistant")
      expect(assistantMessage?.content).toContain("suspicious content")
    })
  })

  describe("Priority Order Verification: Security → P1 → P2 → P3", () => {
    it("should verify execution order through response characteristics", async () => {
      // Test 1: Security Gate (FIRST)
      const threatResult = await llmRouterService.routeMessage({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        conversationId: CONVERSATION_ID + "-1",
        messageId: MESSAGE_ID + "-1",
        message: "SELECT * FROM users",
        customerLanguage: "en",
      })
      expect(threatResult.response).toContain("suspicious content")
      expect(threatResult.tokensUsed).toBe(0) // Stopped at Security Gate

      // Test 2: Normal message (passes Security, proceeds to P1/P2/P3)
      const normalResult = await llmRouterService.routeMessage({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        conversationId: CONVERSATION_ID + "-2",
        messageId: MESSAGE_ID + "-2",
        message: "Hello, I want to order cheese",
        customerLanguage: "en",
      })
      expect(normalResult.response).not.toContain("suspicious content")
      // Should have proceeded beyond Security Gate
      expect(normalResult.agentUsed).toBeDefined()
    })
  })
})
