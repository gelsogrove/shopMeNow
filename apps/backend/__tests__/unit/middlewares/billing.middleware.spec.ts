/**
 * Unit Tests for Billing Middleware
 * Feature 185: Subscription & Billing System
 */

import { Request, Response, NextFunction } from "express"

const mockCheckPlanLimits = jest.fn()
const mockCheckCredit = jest.fn()
const mockGetOperationCost = jest.fn()
const mockIsTrialValid = jest.fn()

jest.mock("@echatbot/database", () => ({
  prisma: {},
}))

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

  describe("checkPlanLimits", () => {
    it("should call next() when under customer limit", async () => {
      mockCheckPlanLimits.mockResolvedValue({
        withinLimits: true,
        current: 10,
        max: 50,
        limitType: "customers",
      })

      const middleware = checkPlanLimits("customers")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(nextFunction).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it("should return 403 when at customer limit", async () => {
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
        })
      )
    })

    it("should include customer limit message when at customer limit", async () => {
      mockCheckPlanLimits.mockResolvedValue({
        withinLimits: false,
        current: 50,
        max: 50,
        limitType: "customers",
      })

      const middleware = checkPlanLimits("customers")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      const payload = (mockRes.json as jest.Mock).mock.calls[0][0]
      expect(payload.code).toBe("PLAN_LIMIT_REACHED")
      expect(payload.message).toContain("clienti")
    })

    it("should include channel limit message when at channel limit", async () => {
      mockCheckPlanLimits.mockResolvedValue({
        withinLimits: false,
        current: 3,
        max: 3,
        limitType: "channels",
      })

      const middleware = checkPlanLimits("channels")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      const payload = (mockRes.json as jest.Mock).mock.calls[0][0]
      expect(payload.code).toBe("PLAN_LIMIT_REACHED")
      expect(payload.message).toContain("canali")
    })

    it("should include limit details when limit is reached", async () => {
      mockCheckPlanLimits.mockResolvedValue({
        withinLimits: false,
        current: 50,
        max: 50,
        limitType: "customers",
      })

      const middleware = checkPlanLimits("customers")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      const payload = (mockRes.json as jest.Mock).mock.calls[0][0]
      expect(payload.code).toBe("PLAN_LIMIT_REACHED")
      expect(payload.details).toEqual({
        limitType: "customers",
        current: 50,
        max: 50,
      })
    })

    it("should return 400 when workspaceId is missing", async () => {
      mockReq = { params: {} }

      const middleware = checkPlanLimits("customers")
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

      const middleware = checkPlanLimits("customers")
      await middleware(mockReq as Request, mockRes as Response, nextFunction)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "PLAN_LIMITS_CHECK_ERROR",
        })
      )
    })
  })

  describe("checkCredit", () => {
    beforeEach(() => {
      mockGetOperationCost.mockResolvedValue(0.1)
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
      mockGetOperationCost.mockResolvedValue(1.0)
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

    it("should call next() for paid plans", async () => {
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
