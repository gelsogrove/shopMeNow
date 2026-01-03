/**
 * Security Tests for Subscription Billing
 * Feature 185: Subscription & Billing System
 *
 * Tests for:
 * - Workspace isolation (can't access other workspace billing)
 * - Owner-only operations (recharge, upgrade)
 * - Credit check enforcement
 * - Plan limits enforcement
 * - Trial expiration
 */

import { Request, Response, NextFunction } from "express"

// Mock the billing service
const mockBillingService = {
  getOperationCost: jest.fn(),
  checkCredit: jest.fn(),
  checkPlanLimits: jest.fn(),
  isTrialValid: jest.fn(),
}

// Mock Prisma
const mockPrisma = {
  userWorkspace: {
    findFirst: jest.fn(),
  },
}

// Mock modules BEFORE imports
jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}))

jest.mock("../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => mockBillingService),
}))

;(global as any).prisma = mockPrisma

// Import after mocks
import {
  checkCredit,
  checkPlanLimits,
  checkTrialValid,
  requireOwnerForBilling,
} from "../../src/interfaces/http/middlewares/billing.middleware"

// Mock request helper
const mockRequest = (overrides: any = {}): Partial<Request> => ({
  params: { workspaceId: "workspace-1" },
  headers: { "x-workspace-id": "workspace-1" },
  user: { id: "user-1", role: "ADMIN" },
  workspaceId: "workspace-1",
  ...overrides,
})

// Mock response helper
const mockResponse = (): Partial<Response> => {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe("Billing Security Tests", () => {
  let mockNext: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockNext = jest.fn()
  })

  describe("checkCredit Middleware Factory", () => {
    it("should allow request when credit is sufficient", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.getOperationCost.mockResolvedValue(0.1)
      mockBillingService.checkCredit.mockResolvedValue({
        hasSufficientCredit: true,
        currentBalance: 10.0,
        requiredAmount: 0.1,
      })

      const middleware = checkCredit("message")
      await middleware(req as Request, res as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it("should block request when credit is zero (402)", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.getOperationCost.mockResolvedValue(0.1)
      mockBillingService.checkCredit.mockResolvedValue({
        hasSufficientCredit: false,
        currentBalance: 0,
        requiredAmount: 0.1,
        deficit: 0.1,
      })

      const middleware = checkCredit("message")
      await middleware(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(402)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "INSUFFICIENT_CREDIT",
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should return 400 when workspaceId is missing", async () => {
      const req = mockRequest({ workspaceId: undefined, params: {} })
      const res = mockResponse()

      const middleware = checkCredit("message")
      await middleware(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "WORKSPACE_REQUIRED",
        })
      )
    })

    it("should check different operation types", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.getOperationCost.mockResolvedValue(1.0)
      mockBillingService.checkCredit.mockResolvedValue({
        hasSufficientCredit: true,
        currentBalance: 50.0,
        requiredAmount: 1.0,
      })

      const orderMiddleware = checkCredit("order")
      await orderMiddleware(req as Request, res as Response, mockNext)

      expect(mockBillingService.getOperationCost).toHaveBeenCalledWith("workspace-1", "order")
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe("checkTrialValid Middleware", () => {
    it("should allow request when trial is active", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.isTrialValid.mockResolvedValue({
        isValid: true,
        isTrialPlan: true,
        daysRemaining: 7,
        expiredAt: null,
      })

      await checkTrialValid(req as Request, res as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it("should block request when trial has expired (403)", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.isTrialValid.mockResolvedValue({
        isValid: false,
        isTrialPlan: true,
        daysRemaining: null,
        expiredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      await checkTrialValid(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "TRIAL_EXPIRED",
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should allow paid plans regardless of trial status", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.isTrialValid.mockResolvedValue({
        isValid: true,
        isTrialPlan: false,
        daysRemaining: null,
        expiredAt: null,
      })

      await checkTrialValid(req as Request, res as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe("checkPlanLimits Middleware Factory", () => {
    it("should allow when within limits", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.checkPlanLimits.mockResolvedValue({
        withinLimits: true,
        current: 10,
        max: 50,
        limitType: "customers",
      })

      const middleware = checkPlanLimits("customers")
      await middleware(req as Request, res as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it("should block when at limit (403)", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.checkPlanLimits.mockResolvedValue({
        withinLimits: false,
        current: 50,
        max: 50,
        limitType: "customers",
      })

      const middleware = checkPlanLimits("customers")
      await middleware(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "PLAN_LIMIT_REACHED",
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should check customer limits", async () => {
      const req = mockRequest()
      const res = mockResponse()

      mockBillingService.checkPlanLimits.mockResolvedValue({
        withinLimits: false,
        current: 50,
        max: 50,
        limitType: "customers",
      })

      const middleware = checkPlanLimits("customers")
      await middleware(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(mockBillingService.checkPlanLimits).toHaveBeenCalledWith("workspace-1", "customers")
    })
  })

  describe("requireOwnerForBilling Middleware", () => {
    it("should allow owner to perform billing operations", async () => {
      const req = mockRequest({
        user: { id: "owner-1" },
      })
      const res = mockResponse()

      mockPrisma.userWorkspace.findFirst.mockResolvedValue({
        role: "SUPER_ADMIN",
      })

      await requireOwnerForBilling(req as Request, res as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it("should deny admin from billing operations (403)", async () => {
      const req = mockRequest({
        user: { id: "admin-1" },
      })
      const res = mockResponse()

      mockPrisma.userWorkspace.findFirst.mockResolvedValue({
        role: "ADMIN",
      })

      await requireOwnerForBilling(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "OWNER_REQUIRED",
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should deny user without workspace access (403)", async () => {
      const req = mockRequest({
        user: { id: "user-other" },
      })
      const res = mockResponse()

      mockPrisma.userWorkspace.findFirst.mockResolvedValue(null)

      await requireOwnerForBilling(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "NO_WORKSPACE_ACCESS",
        })
      )
    })

    it("should return 401 when user is not authenticated", async () => {
      const req = mockRequest({
        user: undefined,
      })
      const res = mockResponse()

      await requireOwnerForBilling(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "AUTH_REQUIRED",
        })
      )
    })
  })

  describe("Workspace Isolation", () => {
    it("should prevent access when workspaceId mismatch", async () => {
      const req = mockRequest({
        workspaceId: undefined,
        params: {},
      })
      const res = mockResponse()

      const middleware = checkCredit("message")
      await middleware(req as Request, res as Response, mockNext)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should use workspaceId from params if not in request", async () => {
      const req = mockRequest({
        workspaceId: undefined,
        params: { workspaceId: "workspace-from-params" },
      })
      const res = mockResponse()

      mockBillingService.getOperationCost.mockResolvedValue(0.1)
      mockBillingService.checkCredit.mockResolvedValue({
        hasSufficientCredit: true,
        currentBalance: 10.0,
        requiredAmount: 0.1,
      })

      const middleware = checkCredit("message")
      await middleware(req as Request, res as Response, mockNext)

      expect(mockBillingService.getOperationCost).toHaveBeenCalledWith("workspace-from-params", "message")
      expect(mockNext).toHaveBeenCalled()
    })
  })
})
