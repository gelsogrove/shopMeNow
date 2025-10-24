/**
 * Unit Tests for ManageNotifications Calling Function
 *
 * Tests SUBSCRIBE/UNSUBSCRIBE functionality and {{SUBSCRIBE_MESSAGE}} token
 *
 * Test Coverage:
 * 1. File existence and structure
 * 2. SUBSCRIBE action (new subscription)
 * 3. SUBSCRIBE action (already subscribed)
 * 4. UNSUBSCRIBE action (cancel subscription)
 * 5. UNSUBSCRIBE action (already unsubscribed)
 * 6. Security validation (workspace mismatch)
 * 7. Security validation (customer not found)
 * 8. {{SUBSCRIBE_MESSAGE}} token (not subscribed)
 * 9. {{SUBSCRIBE_MESSAGE}} token (already subscribed)
 * 10. Invalid action validation
 */

import * as fs from "fs"
import * as path from "path"
import { PrismaClient } from "@prisma/client"
import {
  ManageNotifications,
  ManageNotificationsRequest,
} from "../../domain/calling-functions/ManageNotifications"
import { PromptProcessorService } from "../../services/prompt-processor.service"

const prisma = new PrismaClient()

describe("🔔 ManageNotifications Calling Function", () => {
  const callingFunctionsDir = path.join(
    __dirname,
    "../../domain/calling-functions"
  )

  let testCustomerId: string
  let testWorkspaceId: string
  let testCustomer: any

  // Setup test data before all tests
  beforeAll(async () => {
    try {
      // Find or create test workspace using the correct model name
      const { PrismaClient: PrismaClientConstructor } =
        require("@prisma/client")
      const testPrisma = new PrismaClientConstructor()

      const workspace = await testPrisma.workspace.findFirst({
        where: { name: { contains: "Altro" } },
      })

      if (!workspace) {
        throw new Error(
          "No test workspace found. Run 'npm run seed' first to create test data."
        )
      }

      testWorkspaceId = workspace.id

      // Create test customer
      testCustomer = await testPrisma.customers.create({
        data: {
          phone: `+test${Date.now()}`,
          name: "Test User Notifications",
          email: `test-notifications-${Date.now()}@test.com`,
          workspaceId: testWorkspaceId,
          push_notifications_consent: false, // Start unsubscribed
          activeChatbot: true,
          isBlacklisted: false,
        },
      })

      testCustomerId = testCustomer.id

      await testPrisma.$disconnect()
    } catch (error) {
      console.error("❌ Test setup error:", error)
      throw error
    }
  })

  // Cleanup after all tests
  afterAll(async () => {
    // Delete test customer
    if (testCustomerId) {
      await prisma.customers.delete({
        where: { id: testCustomerId },
      })
    }
    await prisma.$disconnect()
  })

  describe("📁 File Structure Verification", () => {
    it("should have ManageNotifications.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "ManageNotifications.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should export ManageNotifications function", () => {
      expect(ManageNotifications).toBeDefined()
      expect(typeof ManageNotifications).toBe("function")
    })
  })

  describe("✅ SUBSCRIBE Action Tests", () => {
    it("should successfully SUBSCRIBE when not subscribed", async () => {
      // Ensure customer starts unsubscribed
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: { push_notifications_consent: false },
      })

      const request: ManageNotificationsRequest = {
        action: "SUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(true)
      expect(result.action).toBe("SUBSCRIBE")
      expect(result.currentStatus).toBe(true)
      expect(result.message).toContain("subscribed")
      expect(result.message).toContain("✅")

      // Verify database update
      const updatedCustomer = await prisma.customers.findUnique({
        where: { id: testCustomerId },
      })
      expect(updatedCustomer?.push_notifications_consent).toBe(true)
      expect(updatedCustomer?.push_notifications_consent_at).toBeDefined()
    })

    it("should return 'already subscribed' when SUBSCRIBE again", async () => {
      // Customer is already subscribed from previous test
      const request: ManageNotificationsRequest = {
        action: "SUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(true)
      expect(result.action).toBe("SUBSCRIBE")
      expect(result.currentStatus).toBe(true)
      expect(result.message).toContain("already subscribed")
    })
  })

  describe("❌ UNSUBSCRIBE Action Tests", () => {
    it("should successfully UNSUBSCRIBE when subscribed", async () => {
      // Ensure customer is subscribed
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: { push_notifications_consent: true },
      })

      const request: ManageNotificationsRequest = {
        action: "UNSUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(true)
      expect(result.action).toBe("UNSUBSCRIBE")
      expect(result.currentStatus).toBe(false)
      expect(result.message).toContain("unsubscribed")
      expect(result.message).toContain("✅")

      // Verify database update
      const updatedCustomer = await prisma.customers.findUnique({
        where: { id: testCustomerId },
      })
      expect(updatedCustomer?.push_notifications_consent).toBe(false)
      expect(updatedCustomer?.push_notifications_consent_at).toBeDefined()
    })

    it("should return 'already unsubscribed' when UNSUBSCRIBE again", async () => {
      // Customer is already unsubscribed from previous test
      const request: ManageNotificationsRequest = {
        action: "UNSUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(true)
      expect(result.action).toBe("UNSUBSCRIBE")
      expect(result.currentStatus).toBe(false)
      expect(result.message).toContain("already unsubscribed")
    })
  })

  describe("🔒 Security & Validation Tests", () => {
    it("should fail with invalid workspaceId", async () => {
      const request: ManageNotificationsRequest = {
        action: "SUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: "invalid-workspace-id",
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(false)
      expect(result.message).toContain("not found")
      expect(result.error).toBe("Customer not found")
    })

    it("should fail with invalid customerId", async () => {
      const request: ManageNotificationsRequest = {
        action: "SUBSCRIBE",
        customerId: "invalid-customer-id",
        workspaceId: testWorkspaceId,
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(false)
      expect(result.message).toContain("not found")
      expect(result.error).toBe("Customer not found")
    })

    it("should fail with invalid action", async () => {
      const request: any = {
        action: "INVALID_ACTION",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      const result = await ManageNotifications(request)

      expect(result.success).toBe(false)
      expect(result.message).toContain("Invalid action")
      expect(result.error).toBe("Invalid action parameter")
    })
  })

  describe("📝 {{SUBSCRIBE_MESSAGE}} Token Tests", () => {
    let promptProcessor: PromptProcessorService

    beforeAll(() => {
      promptProcessor = new PromptProcessorService()
    })

    it("should show invite message when NOT subscribed", async () => {
      const prompt =
        "Hello {{nameUser}}! Check our offers: {{OFFERS}}\n\n{{SUBSCRIBE_MESSAGE}}"

      const customerData = {
        nameUser: "John",
        push_notifications_consent: false,
      }

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "Special offer: 20% off!",
      }

      const result = await promptProcessor.preProcessPrompt(
        prompt,
        testWorkspaceId,
        customerData,
        dynamicContent
      )

      expect(result).toContain("John")
      expect(result).toContain("Special offer: 20% off!")
      expect(result).toContain("SUBSCRIBE")
      expect(result).toContain("exclusive offers")
    })

    it("should show EMPTY string when already subscribed", async () => {
      const prompt =
        "Hello {{nameUser}}! Check our offers: {{OFFERS}}\n\n{{SUBSCRIBE_MESSAGE}}"

      const customerData = {
        nameUser: "John",
        push_notifications_consent: true, // Already subscribed
      }

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "Special offer: 20% off!",
      }

      const result = await promptProcessor.preProcessPrompt(
        prompt,
        testWorkspaceId,
        customerData,
        dynamicContent
      )

      expect(result).toContain("John")
      expect(result).toContain("Special offer: 20% off!")
      expect(result).not.toContain("SUBSCRIBE")
      expect(result).not.toContain("exclusive offers")
      // Should only have the two newlines, no message
      expect(result).toContain("Special offer: 20% off!\n\n")
    })

    it("should handle missing push_notifications_consent (default to false)", async () => {
      const prompt = "{{SUBSCRIBE_MESSAGE}}"

      const customerData = {
        nameUser: "John",
        // push_notifications_consent is undefined
      }

      const dynamicContent = {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }

      const result = await promptProcessor.preProcessPrompt(
        prompt,
        testWorkspaceId,
        customerData,
        dynamicContent
      )

      // Should show invite message (default to not subscribed)
      expect(result).toContain("SUBSCRIBE")
      expect(result).toContain("exclusive offers")
    })
  })

  describe("⏱️ Timestamp Tests", () => {
    it("should update push_notifications_consent_at on SUBSCRIBE", async () => {
      // Ensure customer starts unsubscribed
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: {
          push_notifications_consent: false,
          push_notifications_consent_at: null,
        },
      })

      const beforeTime = new Date()

      const request: ManageNotificationsRequest = {
        action: "SUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      await ManageNotifications(request)

      const afterTime = new Date()

      // Verify timestamp is set and within test timeframe
      const updatedCustomer = await prisma.customers.findUnique({
        where: { id: testCustomerId },
      })
      expect(updatedCustomer?.push_notifications_consent_at).toBeDefined()
      const timestamp = updatedCustomer!.push_notifications_consent_at!
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })

    it("should update push_notifications_consent_at on UNSUBSCRIBE", async () => {
      // Ensure customer is subscribed
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: {
          push_notifications_consent: true,
          push_notifications_consent_at: new Date("2025-01-01"),
        },
      })

      const beforeTime = new Date()

      const request: ManageNotificationsRequest = {
        action: "UNSUBSCRIBE",
        customerId: testCustomerId,
        workspaceId: testWorkspaceId,
      }

      await ManageNotifications(request)

      const afterTime = new Date()

      // Verify timestamp is updated to current time
      const updatedCustomer = await prisma.customers.findUnique({
        where: { id: testCustomerId },
      })
      expect(updatedCustomer?.push_notifications_consent_at).toBeDefined()
      const timestamp = updatedCustomer!.push_notifications_consent_at!
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime())
      expect(timestamp.getTime()).toBeGreaterThan(
        new Date("2025-01-01").getTime()
      )
    })
  })
})
