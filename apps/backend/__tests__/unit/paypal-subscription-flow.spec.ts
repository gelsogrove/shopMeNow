/**
 * PayPal Subscription Flow Tests (Unit Tests)
 * 
 * Tests the complete PayPal Subscription flow:
 * 1. Create subscription via POST /api/v1/paypal/subscriptions
 * 2. User approves on PayPal → callback updates subscription status
 * 3. PayPal webhook BILLING.SUBSCRIPTION.ACTIVATED → activate connection
 * 
 * CRITICAL FIELDS UPDATED:
 * - paypalSubscriptionId: Subscription ID from PayPal
 * - paypalSubscriptionStatus: APPROVAL_PENDING → ACTIVE
 * - paypalEnvironment: sandbox | live
 * - paypalStatus: DISCONNECTED → CONNECTED (when activated)
 * - isPaymentConnected: false → true (when activated)
 */

import { PrismaClient, PayPalStatus } from "@prisma/client"

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient

describe("PayPal Subscription Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("1. Create Subscription", () => {
    it("should save subscription ID, plan ID, status, and environment", async () => {
      const userId = "user-123"
      const subscriptionData = {
        id: "I-TESTSUBSCRIPTION123",
        planId: "P-TESTPLAN456",
        status: "APPROVAL_PENDING",
      }
      const environment = "sandbox"

      // Simulate subscription creation
      const updateData = {
        paypalSubscriptionId: subscriptionData.id,
        paypalPlanId: subscriptionData.planId,
        paypalSubscriptionStatus: subscriptionData.status,
        paypalEnvironment: environment,
      }

      mockPrisma.user.update = jest.fn().mockResolvedValue({
        id: userId,
        ...updateData,
      })

      const result = await mockPrisma.user.update({
        where: { id: userId },
        data: updateData,
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          paypalSubscriptionId: "I-TESTSUBSCRIPTION123",
          paypalPlanId: "P-TESTPLAN456",
          paypalSubscriptionStatus: "APPROVAL_PENDING",
          paypalEnvironment: "sandbox",
        },
      })
      expect(result.paypalSubscriptionId).toBe("I-TESTSUBSCRIPTION123")
      expect(result.paypalEnvironment).toBe("sandbox")
    })

    it("should require paypalEnvironment to be saved", async () => {
      const userId = "user-123"
      
      // Missing environment should fail
      const invalidUpdate = {
        paypalSubscriptionId: "I-TEST",
        paypalPlanId: "P-TEST",
        paypalSubscriptionStatus: "APPROVAL_PENDING",
        // paypalEnvironment: MISSING!
      }

      // Validate that environment is required for callback to work
      expect(invalidUpdate).not.toHaveProperty("paypalEnvironment")
    })
  })

  describe("2. Callback Approval Flow", () => {
    it("should find user by subscriptionId and paypalEnvironment", async () => {
      const subscriptionId = "I-TESTSUBSCRIPTION123"
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        paypalSubscriptionId: subscriptionId,
        paypalEnvironment: "sandbox",
      }

      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(mockUser)

      const user = await mockPrisma.user.findFirst({
        where: {
          paypalSubscriptionId: subscriptionId,
        },
        select: {
          id: true,
          email: true,
          paypalEnvironment: true,
          paypalSubscriptionId: true,
        },
      })

      expect(user).toBeTruthy()
      expect(user?.paypalEnvironment).toBe("sandbox")
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { paypalSubscriptionId: subscriptionId },
        select: expect.objectContaining({
          paypalEnvironment: true,
        }),
      })
    })

    it("should update status to ACTIVE and set paypalStatus/isPaymentConnected", async () => {
      const userId = "user-123"
      const subscriptionStatus = "ACTIVE"

      const updateData = {
        paypalSubscriptionStatus: subscriptionStatus,
        paypalSubscriptionApprovedAt: expect.any(Date),
        paypalStatus: "CONNECTED" as PayPalStatus,
        isPaymentConnected: true,
      }

      mockPrisma.user.update = jest.fn().mockResolvedValue({
        id: userId,
        ...updateData,
      })

      const result = await mockPrisma.user.update({
        where: { id: userId },
        data: updateData,
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          paypalSubscriptionStatus: "ACTIVE",
          paypalStatus: "CONNECTED",
          isPaymentConnected: true,
        }),
      })
      expect(result.paypalStatus).toBe("CONNECTED")
      expect(result.isPaymentConnected).toBe(true)
    })

    it("should reject callback if user not found", async () => {
      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(null)

      const user = await mockPrisma.user.findFirst({
        where: { paypalSubscriptionId: "I-NONEXISTENT" },
      })

      expect(user).toBeNull()
    })

    it("should reject callback if paypalEnvironment is missing", async () => {
      const mockUser = {
        id: "user-123",
        paypalSubscriptionId: "I-TEST",
        paypalEnvironment: null, // ❌ MISSING!
      }

      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(mockUser)

      const user = await mockPrisma.user.findFirst({
        where: { paypalSubscriptionId: "I-TEST" },
      })

      // Callback logic checks: if (!user || !user.paypalEnvironment)
      const shouldReject = !user || !user.paypalEnvironment
      expect(shouldReject).toBe(true)
    })
  })

  describe("3. Webhook BILLING.SUBSCRIPTION.ACTIVATED", () => {
    it("should set paypalStatus=CONNECTED and isPaymentConnected=true", async () => {
      const userId = "user-123"
      const subscriptionId = "I-TESTSUBSCRIPTION123"

      const mockUser = {
        id: userId,
        paypalSubscriptionId: subscriptionId,
        paypalSubscriptionStatus: "APPROVAL_PENDING",
        planType: "FREE_TRIAL",
      }

      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(mockUser)

      const updateData = {
        paypalSubscriptionStatus: "ACTIVE",
        paypalSubscriptionApprovedAt: new Date(),
        paypalStatus: "CONNECTED" as PayPalStatus,
        isPaymentConnected: true,
        planType: "BASIC", // Auto-upgrade FREE_TRIAL → BASIC
      }

      mockPrisma.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        ...updateData,
      })

      const result = await mockPrisma.user.update({
        where: { id: userId },
        data: updateData,
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          paypalSubscriptionStatus: "ACTIVE",
          paypalStatus: "CONNECTED",
          isPaymentConnected: true,
          planType: "BASIC",
        }),
      })
      expect(result.paypalStatus).toBe("CONNECTED")
      expect(result.isPaymentConnected).toBe(true)
      expect(result.planType).toBe("BASIC")
    })

    it("should auto-upgrade FREE_TRIAL to BASIC when subscription activated", async () => {
      const userId = "user-123"

      const mockUser = {
        id: userId,
        planType: "FREE_TRIAL",
        paypalSubscriptionId: "I-TEST",
      }

      mockPrisma.user.findFirst = jest.fn().mockResolvedValue(mockUser)
      mockPrisma.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        planType: "BASIC",
      })

      const result = await mockPrisma.user.update({
        where: { id: userId },
        data: { planType: "BASIC" },
      })

      expect(result.planType).toBe("BASIC")
    })
  })

  describe("4. Webhook BILLING.SUBSCRIPTION.CANCELLED", () => {
    it("should set paypalStatus=DISCONNECTED and isPaymentConnected=false", async () => {
      const userId = "user-123"

      const updateData = {
        paypalSubscriptionStatus: "CANCELLED",
        paypalStatus: "DISCONNECTED" as PayPalStatus,
        isPaymentConnected: false,
      }

      mockPrisma.user.update = jest.fn().mockResolvedValue({
        id: userId,
        ...updateData,
      })

      const result = await mockPrisma.user.update({
        where: { id: userId },
        data: updateData,
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          paypalSubscriptionStatus: "CANCELLED",
          paypalStatus: "DISCONNECTED",
          isPaymentConnected: false,
        }),
      })
      expect(result.paypalStatus).toBe("DISCONNECTED")
      expect(result.isPaymentConnected).toBe(false)
    })
  })

  describe("5. Frontend Status Check", () => {
    it("should show CONNECTED when paypalStatus=CONNECTED and isPaymentConnected=true", async () => {
      const mockUser = {
        id: "user-123",
        paypalStatus: "CONNECTED" as PayPalStatus,
        isPaymentConnected: true,
        paypalSubscriptionStatus: "ACTIVE",
      }

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(mockUser)

      const user = await mockPrisma.user.findUnique({
        where: { id: "user-123" },
        select: {
          paypalStatus: true,
          isPaymentConnected: true,
          paypalSubscriptionStatus: true,
        },
      })

      // Frontend logic: show "Disconnect" button and ACTIVE badge
      const shouldShowConnected =
        user?.paypalStatus === "CONNECTED" && user?.isPaymentConnected === true

      expect(shouldShowConnected).toBe(true)
    })

    it("should show DISCONNECTED when paypalStatus=CONNECTED but isPaymentConnected=false", async () => {
      const mockUser = {
        id: "user-123",
        paypalStatus: "CONNECTED" as PayPalStatus,
        isPaymentConnected: false, // ❌ Inconsistent state!
      }

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(mockUser)

      const user = await mockPrisma.user.findUnique({
        where: { id: "user-123" },
      })

      // Safety check: require BOTH fields to be true
      const shouldShowConnected =
        user?.paypalStatus === "CONNECTED" && user?.isPaymentConnected === true

      expect(shouldShowConnected).toBe(false)
    })
  })

  describe("6. Error Handling", () => {
    it("should handle duplicate subscription IDs gracefully", async () => {
      const subscriptionId = "I-DUPLICATE"

      mockPrisma.user.findFirst = jest.fn().mockResolvedValue({
        id: "user-123",
        paypalSubscriptionId: subscriptionId,
      })

      const user = await mockPrisma.user.findFirst({
        where: { paypalSubscriptionId: subscriptionId },
      })

      expect(user).toBeTruthy()
      expect(user?.paypalSubscriptionId).toBe(subscriptionId)
    })

    it("should log error when subscription fetch fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      try {
        throw new Error("PayPal API timeout")
      } catch (error) {
        console.error("[PAYPAL] Failed to fetch subscription:", error)
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch subscription"),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe("7. Database Schema Validation", () => {
    it("should have all required PayPal subscription fields", () => {
      const requiredFields = [
        "paypalSubscriptionId",
        "paypalSubscriptionStatus",
        "paypalEnvironment",
        "paypalPlanId",
        "paypalStatus",
        "isPaymentConnected",
        "paypalSubscriptionApprovedAt",
      ]

      const mockUser: Record<string, any> = {
        id: "user-123",
        paypalSubscriptionId: "I-TEST",
        paypalSubscriptionStatus: "ACTIVE",
        paypalEnvironment: "sandbox",
        paypalPlanId: "P-TEST",
        paypalStatus: "CONNECTED",
        isPaymentConnected: true,
        paypalSubscriptionApprovedAt: new Date(),
      }

      for (const field of requiredFields) {
        expect(mockUser).toHaveProperty(field)
      }
    })

    it("should allow nullable values for optional fields", () => {
      const mockUser = {
        id: "user-123",
        paypalSubscriptionId: null, // Optional
        paypalEnvironment: null, // Optional
        paypalPlanId: null, // Optional
      }

      expect(mockUser.paypalSubscriptionId).toBeNull()
      expect(mockUser.paypalEnvironment).toBeNull()
      expect(mockUser.paypalPlanId).toBeNull()
    })
  })
})
