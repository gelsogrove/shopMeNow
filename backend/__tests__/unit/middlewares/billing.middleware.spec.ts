/**
 * Unit Tests for Billing Middleware
 * Feature 185: Subscription & Billing System
 *
 * Tests for:
 * - checkPlanLimits: Block when limits reached
 * - checkCredit: Block when insufficient credit
 * - checkTrialValid: Block when trial expired
 */

import { Request, Response, NextFunction } from "express"

// Mock functions - defined before jest.mock
const mockCheckPlanLimits = jest.fn()
const mockCheckCredit = jest.fn()
const mockGetOperationCost = jest.fn()
const mockIsTrialValid = jest.fn()

// Mock Prisma
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}))

// Mock the billing service module
jest.mock(
  "../../../src/application/services/subscription-billing.service",
  () => ({
    SubscriptionBillingService: jest.fn().mockImplementation(() => ({
      checkPlanLimits: mockCheckPlanLimits,
      checkCredit: mockCheckCredit,
      getOperationCost: mockGetOperationCost,
      isTrialValid: mockIsTrialValid,
    })),
  })
)

// Import AFTER mocks
import {
  checkPlanLimits,
  checkCredit,
  checkTrialValid,
} from "../../../src/interfaces/http/middlewares/billing.middleware"

describe("Billing Middleware", () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let nextFunction: NextFunction

  const testWorkspaceId = "test-workspace-123"

  beforeEach(() => {
    jest.clearAllMocks()

    mockReq = {
      params: { workspaceId: testWorkspaceId },
    }
    ;(mockReq as any).workspaceId = testWorkspaceId

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    nextFunction = jest.fn()
  })

  // ===========================================================================
  // checkPlanLimits TESTS
  // ===========================================================================
  describe("checkPlanLimits", () => {
    describe("Products Limit", () => {
      it("should call next() when under product limit (10/50)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: true,
          current: 10,
          max: 50,
          limitType: "products",
        })

        const middleware = checkPlanLimits("products")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
        expect(mockRes.status).not.toHaveBeenCalled()
      })

      it("should return 403 when at product limit (50/50)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: false,
          current: 50,
          max: 50,
          limitType: "products",
        })

        const middleware = checkPlanLimits("products")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).not.toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "PLAN_LIMIT_REACHED",
            details: {
              limitType: "products",
              current: 50,
              max: 50,
            },
          })
        )
      })

      it("should call next() at 49/50 products (edge case)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: true,
          current: 49,
          max: 50,
          limitType: "products",
        })

        const middleware = checkPlanLimits("products")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
      })
    })

    describe("Customers Limit", () => {
      it("should call next() when under customer limit (25/50)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: true,
          current: 25,
          max: 50,
          limitType: "customers",
        })

        const middleware = checkPlanLimits("customers")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
      })

      it("should return 403 when at customer limit (50/50)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: false,
          current: 50,
          max: 50,
          limitType: "customers",
        })

        const middleware = checkPlanLimits("customers")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).not.toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "PLAN_LIMIT_REACHED",
            details: {
              limitType: "customers",
              current: 50,
              max: 50,
            },
          })
        )
      })
    })

    describe("Channels Limit", () => {
      it("should call next() when under channel limit (0/1)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: true,
          current: 0,
          max: 1,
          limitType: "channels",
        })

        const middleware = checkPlanLimits("channels")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
      })

      it("should return 403 when at channel limit FREE_TRIAL (1/1)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: false,
          current: 1,
          max: 1,
          limitType: "channels",
        })

        const middleware = checkPlanLimits("channels")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).not.toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "PLAN_LIMIT_REACHED",
            details: {
              limitType: "channels",
              current: 1,
              max: 1,
            },
          })
        )
      })

      it("should return 403 when at channel limit PREMIUM (2/2)", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: false,
          current: 2,
          max: 2,
          limitType: "channels",
        })

        const middleware = checkPlanLimits("channels")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).not.toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(403)
      })

      it("should call next() for PREMIUM plan with 1/2 channels", async () => {
        mockCheckPlanLimits.mockResolvedValue({
          withinLimits: true,
          current: 1,
          max: 2,
          limitType: "channels",
        })

        const middleware = checkPlanLimits("channels")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalled()
      })
    })

    describe("Error Handling", () => {
      it("should return 400 when workspaceId is missing", async () => {
        mockReq = { params: {} }

        const middleware = checkPlanLimits("products")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "WORKSPACE_REQUIRED",
          })
        )
      })

      it("should return 500 on service error", async () => {
        mockCheckPlanLimits.mockRejectedValue(new Error("Database error"))

        const middleware = checkPlanLimits("products")
        await middleware(mockReq as Request, mockRes as Response, nextFunction)

        expect(mockRes.status).toHaveBeenCalledWith(500)
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "PLAN_LIMITS_CHECK_ERROR",
          })
        )
      })
    })
  })

  // ===========================================================================
  // checkCredit TESTS
  // ===========================================================================
  describe("checkCredit", () => {
    beforeEach(() => {
      mockGetOperationCost.mockResolvedValue(0.1) // €0.10 per message
    })

    it("should call next() when sufficient credit", async () => {
      mockCheckCredit.mockResolvedValue({
        hasSufficientCredit: true,
        currentBalance: 25.0,
        requiredAmount: 0.1,
      })

      const middleware = checkCredit("message")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).toHaveBeenCalled()
    })

    it("should return 402 when insufficient credit", async () => {
      mockCheckCredit.mockResolvedValue({
        hasSufficientCredit: false,
        currentBalance: 0.05,
        requiredAmount: 0.1,
        deficit: 0.05,
      })

      const middleware = checkCredit("message")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(402)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "INSUFFICIENT_CREDIT",
          details: expect.objectContaining({
            currentBalance: 0.05,
            requiredAmount: 0.1,
            deficit: 0.05,
          }),
        })
      )
    })

    it("should return 402 when credit is exactly 0", async () => {
      mockCheckCredit.mockResolvedValue({
        hasSufficientCredit: false,
        currentBalance: 0,
        requiredAmount: 0.1,
        deficit: 0.1,
      })

      const middleware = checkCredit("message")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(402)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "INSUFFICIENT_CREDIT",
        })
      )
    })

    it("should check order cost correctly", async () => {
      mockGetOperationCost.mockResolvedValue(1.0) // €1.00 per order
      mockCheckCredit.mockResolvedValue({
        hasSufficientCredit: true,
        currentBalance: 10.0,
        requiredAmount: 1.0,
      })

      const middleware = checkCredit("order")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockGetOperationCost).toHaveBeenCalledWith(testWorkspaceId, "order")
      expect(nextFunction).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // checkTrialValid TESTS
  // ===========================================================================
  describe("checkTrialValid", () => {
    it("should call next() when trial is valid", async () => {
      mockIsTrialValid.mockResolvedValue({
        isValid: true,
        isTrialPlan: true,
        daysRemaining: 7,
        expiredAt: null,
      })

      await checkTrialValid(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).toHaveBeenCalled()
    })

    it("should return 403 when trial is expired", async () => {
      mockIsTrialValid.mockResolvedValue({
        isValid: false,
        isTrialPlan: true,
        daysRemaining: null,
        expiredAt: new Date("2024-01-01"),
      })

      await checkTrialValid(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "TRIAL_EXPIRED",
        })
      )
    })

    it("should call next() for paid plans (BASIC)", async () => {
      mockIsTrialValid.mockResolvedValue({
        isValid: true,
        isTrialPlan: false,
        daysRemaining: null,
        expiredAt: null,
      })

      await checkTrialValid(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).toHaveBeenCalled()
    })
  })
})
