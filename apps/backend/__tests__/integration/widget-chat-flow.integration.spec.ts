/**
 * Widget Chat Flow Integration Test
 * Tests the complete widget chat flow:
 * 1. Send message via POST /api/v1/widget/chat/:workspaceId
 * 2. Message processed through LLM
 * 3. Response saved in queue
 * 4. Poll message via GET /api/v1/widget/poll/:messageId
 * 5. Receive LLM response
 */

import request from "supertest"
import { app } from "../../src/app"
import { prisma } from "@echatbot/database"
import { VisitorIdService } from "../../src/application/services/visitor-id.service"

describe("Widget Chat Flow Integration", () => {
  let testWorkspaceId: string
  let testVisitorId: string

  beforeAll(async () => {
    // Find a test workspace
    const workspace = await prisma.workspace.findFirst({
      where: { isActive: true },
      include: { owner: true },
    })

    if (!workspace) {
      throw new Error("No active workspace found for testing")
    }

    testWorkspaceId = workspace.id
    testVisitorId = VisitorIdService.generate()
  })

  afterAll(async () => {
    // Cleanup: Delete test messages
    await prisma.whatsAppQueue.deleteMany({
      where: { visitorId: testVisitorId },
    })

    // Cleanup: Delete test customer
    await prisma.customers.deleteMany({
      where: { customId: testVisitorId },
    })

    await prisma.$disconnect()
  })

  describe("POST /api/v1/widget/chat/:workspaceId", () => {
    it("should send widget message and return ready status immediately (debugMode=OFF)", async () => {
      // Ensure debug mode is OFF for this test
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { debugMode: false },
      })

      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: testVisitorId,
          message: "Ciao! Vorrei informazioni sui prodotti.",
        })
        .expect(200)

      expect(response.body).toHaveProperty("success", true)
      expect(response.body).toHaveProperty("messageId")
      expect(response.body).toHaveProperty("status", "ready") // Response immediately available
      expect(response.body).toHaveProperty("response") // Response IS returned when debugMode=OFF

      // Verify message saved in database with LLM response
      const message = await prisma.whatsAppQueue.findUnique({
        where: { id: response.body.messageId },
      })

      expect(message).not.toBeNull()
      expect(message!.channel).toBe("widget")
      expect(message!.visitorId).toBe(testVisitorId)
      expect(message!.status).toBe("sent") // Already processed
      expect(message!.responsePayload).not.toBeNull()
      expect(message!.responsePayload).toHaveProperty("response")
      expect(message!.responsePayload).toHaveProperty("agentUsed")
      expect(message!.responsePayload).toHaveProperty("tokensUsed")
    })

    it("should validate visitorId format", async () => {
      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: "invalid-format",
          message: "Test message",
        })
        .expect(400)

      expect(response.body).toHaveProperty("error", "INVALID_VISITOR_ID")
    })

    it("should validate message length", async () => {
      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: testVisitorId,
          message: "Hi", // Too short (min 3 chars)
        })
        .expect(400)

      expect(response.body).toHaveProperty("error", "INVALID_INPUT")
    })

    it("should reject expired visitorId", async () => {
      // Create expired visitorId (25 hours ago)
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000
      const expiredVisitorId = `visitor_${expiredTimestamp}_abc123`

      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: expiredVisitorId,
          message: "Test message",
        })
        .expect(403)

      expect(response.body).toHaveProperty("error", "VISITOR_ID_EXPIRED")
    })

    it("should block completely when debugMode is ON", async () => {
      // Find workspace and enable debug mode
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
      })
      
      // Enable debug mode
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { debugMode: true },
      })

      const debugVisitorId = VisitorIdService.generate()

      try {
        const response = await request(app)
          .post(`/api/v1/widget/chat/${testWorkspaceId}`)
          .send({
            visitorId: debugVisitorId,
            message: "Test message with debug mode",
          })
          .expect(503) // Service Unavailable

        expect(response.body).toHaveProperty("error", "SERVICE_UNAVAILABLE")
        
        // Verify NO message saved in database
        const messages = await prisma.whatsAppQueue.findMany({
          where: { visitorId: debugVisitorId },
        })
        expect(messages.length).toBe(0) // Nothing saved!
      } finally {
        // Restore original debug mode setting
        await prisma.workspace.update({
          where: { id: testWorkspaceId },
          data: { debugMode: workspace?.debugMode ?? false },
        })
      }
    })

    it("should return wipMessage when debugMode is false (WIP mode)", async () => {
      // Find workspace and get original values
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
      })
      
      // Set WIP mode (debugMode=true) with wipMessage
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { 
          debugMode: true,
          debugMode: false, // Ensure debug mode is off
          wipMessage: {
            it: "Stiamo aggiornando il servizio. Torna presto!",
            en: "We are updating the service. Come back soon!",
          },
        },
      })

      const wipVisitorId = VisitorIdService.generate()

      try {
        const response = await request(app)
          .post(`/api/v1/widget/chat/${testWorkspaceId}`)
          .send({
            visitorId: wipVisitorId,
            message: "Test message during WIP mode",
          })
          .expect(200) // WIP mode returns 200 with wipMessage

        expect(response.body).toHaveProperty("success", true)
        expect(response.body).toHaveProperty("status", "wip")
        expect(response.body).toHaveProperty("response")
        expect(response.body.response).toContain("Stiamo aggiornando")
        
        // Verify NO message saved in database (no LLM processing in WIP mode)
        const messages = await prisma.whatsAppQueue.findMany({
          where: { visitorId: wipVisitorId },
        })
        expect(messages.length).toBe(0) // Nothing saved - WIP mode blocks before LLM
      } finally {
        // Restore original workspace settings
        await prisma.workspace.update({
          where: { id: testWorkspaceId },
          data: { 
            channelStatus: workspace?.debugMode ?? true,
            wipMessage: workspace?.wipMessage ?? null,
          },
        })
      }
    })

    it("should fallback to default WIP message if wipMessage is not set", async () => {
      // Find workspace and get original values
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
      })
      
      // Set WIP mode without wipMessage
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { 
          debugMode: true,
          debugMode: false,
          wipMessage: null, // No custom message
        },
      })

      const wipVisitorId = VisitorIdService.generate()

      try {
        const response = await request(app)
          .post(`/api/v1/widget/chat/${testWorkspaceId}`)
          .send({
            visitorId: wipVisitorId,
            message: "Test message during WIP mode",
          })
          .expect(200)

        expect(response.body).toHaveProperty("success", true)
        expect(response.body).toHaveProperty("status", "wip")
        expect(response.body).toHaveProperty("response")
        // Should have default fallback message
        expect(response.body.response).toContain("temporaneamente non disponibile")
      } finally {
        // Restore original workspace settings
        await prisma.workspace.update({
          where: { id: testWorkspaceId },
          data: { 
            channelStatus: workspace?.debugMode ?? true,
            wipMessage: workspace?.wipMessage ?? null,
          },
        })
      }
    })
  })

  describe("GET /api/v1/widget/poll/:messageId", () => {
    let testMessageId: string

    beforeAll(async () => {
      // Create a test message
      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: testVisitorId,
          message: "Test message for polling",
        })
        .expect(200)

      testMessageId = response.body.messageId
    })

    it("should return LLM response on first poll", async () => {
      const response = await request(app)
        .get(`/api/v1/widget/poll/${testMessageId}`)
        .set("x-visitor-id", testVisitorId)
        .set("x-workspace-id", testWorkspaceId)
        .expect(200)

      expect(response.body).toHaveProperty("status", "ready")
      expect(response.body).toHaveProperty("message")
      expect(typeof response.body.message).toBe("string")
      expect(response.body.message.length).toBeGreaterThan(0)
    })

    it("should increment polling attempts", async () => {
      // Poll multiple times
      await request(app)
        .get(`/api/v1/widget/poll/${testMessageId}`)
        .set("x-visitor-id", testVisitorId)
        .set("x-workspace-id", testWorkspaceId)
        .expect(200)

      await request(app)
        .get(`/api/v1/widget/poll/${testMessageId}`)
        .set("x-visitor-id", testVisitorId)
        .set("x-workspace-id", testWorkspaceId)
        .expect(200)

      // Verify polling attempts incremented
      const message = await prisma.whatsAppQueue.findUnique({
        where: { id: testMessageId },
      })

      expect(message!.pollingAttempts).toBeGreaterThanOrEqual(2)
    })

    it("should reject invalid visitorId", async () => {
      const response = await request(app)
        .get(`/api/v1/widget/poll/${testMessageId}`)
        .set("x-visitor-id", "wrong-visitor-id")
        .set("x-workspace-id", testWorkspaceId)
        .expect(403)

      expect(response.body).toHaveProperty("error", "ACCESS_DENIED")
    })

    it("should require x-visitor-id header", async () => {
      const response = await request(app)
        .get(`/api/v1/widget/poll/${testMessageId}`)
        .set("x-workspace-id", testWorkspaceId)
        .expect(400)

      expect(response.body).toHaveProperty("error", "MISSING_HEADERS")
    })

    it("should require x-workspace-id header", async () => {
      const response = await request(app)
        .get(`/api/v1/widget/poll/${testMessageId}`)
        .set("x-visitor-id", testVisitorId)
        .expect(400)

      expect(response.body).toHaveProperty("error", "MISSING_HEADERS")
    })
  })

  describe("End-to-End Flow", () => {
    it("should complete full widget chat cycle", async () => {
      // Step 1: Send message
      const sendResponse = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: testVisitorId,
          message: "Quali sono le offerte attive?",
        })
        .expect(200)

      expect(sendResponse.body.status).toBe("ready") // Response immediately available

      const messageId = sendResponse.body.messageId

      // Step 2: Poll for response (should return immediately)
      const pollResponse = await request(app)
        .get(`/api/v1/widget/poll/${messageId}`)
        .set("x-visitor-id", testVisitorId)
        .set("x-workspace-id", testWorkspaceId)
        .expect(200)

      expect(pollResponse.body.status).toBe("ready")
      expect(pollResponse.body.message).toBeDefined()
      expect(typeof pollResponse.body.message).toBe("string")
      expect(pollResponse.body.message.length).toBeGreaterThan(10)

      // Step 3: Verify message history preserved
      const messages = await prisma.whatsAppQueue.findMany({
        where: {
          visitorId: testVisitorId,
          workspaceId: testWorkspaceId,
        },
        orderBy: { createdAt: "asc" },
      })

      expect(messages.length).toBeGreaterThan(0)
      expect(messages.every((m) => m.channel === "widget")).toBe(true)
    })

    it("should handle multiple consecutive messages", async () => {
      const messages = [
        "Ciao!",
        "Vorrei vedere il catalogo",
        "Quali sono i prezzi?",
      ]

      const messageIds: string[] = []

      // Send all messages
      for (const message of messages) {
        const response = await request(app)
          .post(`/api/v1/widget/chat/${testWorkspaceId}`)
          .send({
            visitorId: testVisitorId,
            message,
          })
          .expect(200)

        messageIds.push(response.body.messageId)
      }

      // Poll all messages
      for (const messageId of messageIds) {
        const response = await request(app)
          .get(`/api/v1/widget/poll/${messageId}`)
          .set("x-visitor-id", testVisitorId)
          .set("x-workspace-id", testWorkspaceId)
          .expect(200)

        expect(response.body.status).toBe("ready")
        expect(response.body.message).toBeDefined()
      }

      // Verify all messages saved with responses
      const savedMessages = await prisma.whatsAppQueue.findMany({
        where: { id: { in: messageIds } },
      })

      expect(savedMessages.length).toBe(messages.length)
      expect(
        savedMessages.every((m) => m.status === "sent" || m.status === "blocked")
      ).toBe(true)
      expect(savedMessages.every((m) => m.responsePayload !== null)).toBe(true)
    })
  })

  describe("Security & Rate Limiting", () => {
    it("should enforce rate limiting (5 messages in 10 seconds)", async () => {
      const newVisitorId = VisitorIdService.generate()

      // Send 5 messages rapidly
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/v1/widget/chat/${testWorkspaceId}`)
          .send({
            visitorId: newVisitorId,
            message: `Test message ${i + 1}`,
          })
          .expect(200)
      }

      // 6th message should be rate limited
      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: newVisitorId,
          message: "Test message 6 (should be blocked)",
        })
        .expect(429)

      expect(response.body).toHaveProperty("error", "ANTI_SPAM")
      expect(response.body).toHaveProperty("retryAfter")

      // Cleanup
      await prisma.whatsAppQueue.deleteMany({ where: { visitorId: newVisitorId } })
      await prisma.customers.deleteMany({ where: { customId: newVisitorId } })
    })

    it("should detect XSS attempts", async () => {
      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: testVisitorId,
          message: "<script>alert('XSS')</script>",
        })
        .expect(429)

      expect(response.body).toHaveProperty("error", "CONTENT_SAFETY")
    })

    it("should detect SQL injection attempts", async () => {
      const response = await request(app)
        .post(`/api/v1/widget/chat/${testWorkspaceId}`)
        .send({
          visitorId: testVisitorId,
          message: "'; DROP TABLE products; --",
        })
        .expect(429)

      expect(response.body).toHaveProperty("error", "CONTENT_SAFETY")
    })
  })
})
