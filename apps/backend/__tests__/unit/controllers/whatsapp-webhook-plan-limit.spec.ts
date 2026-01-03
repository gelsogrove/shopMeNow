/**
 * Unit Test: WhatsApp webhook customer limit enforcement
 * Ensures new customers are blocked with 403 when limit is reached.
 */

import { Request, Response } from "express"

const mockIsTrialValid = jest.fn()
const mockGetOperationCost = jest.fn()
const mockCheckCredit = jest.fn()
const mockCheckPlanLimits = jest.fn()

const mockTx = {
  registrationAttempts: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}

const mockPrisma = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  customers: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
}

jest.mock("../../../src/lib/prisma", () => ({
  prisma: mockPrisma,
}))

jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

jest.mock("../../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({
    isTrialValid: mockIsTrialValid,
    getOperationCost: mockGetOperationCost,
    checkCredit: mockCheckCredit,
    checkPlanLimits: mockCheckPlanLimits,
  })),
}))

import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

describe("WhatsAppWebhookController - Plan limit", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.customers.findUnique.mockResolvedValue(null)
    mockPrisma.customers.findFirst.mockResolvedValue(null)
    mockTx.registrationAttempts.findUnique.mockResolvedValue(null)
    mockTx.registrationAttempts.create.mockResolvedValue({
      attemptCount: 1,
      isBlocked: false,
    })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx))

    mockIsTrialValid.mockResolvedValue({ isTrialPlan: false, isValid: true })
    mockGetOperationCost.mockResolvedValue(0.1)
    mockCheckCredit.mockResolvedValue({
      hasSufficientCredit: true,
      currentBalance: 10,
      requiredAmount: 0.1,
    })
    mockCheckPlanLimits.mockResolvedValue({
      withinLimits: false,
      current: 50,
      max: 50,
    })
  })

  it("should return 403 when customer limit is reached for new customer", async () => {
    const controller = new WhatsAppWebhookController()
    const req = {
      body: {
        message: "Hi",
        phoneNumber: "+15550001111",
        workspaceId: "ws-1",
      },
    } as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response

    await controller.receiveMessage(req, res)

    expect(mockCheckPlanLimits).toHaveBeenCalledWith("ws-1", "customers")
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "CUSTOMER_LIMIT_REACHED",
        status: "limit_reached",
      })
    )
  })
})
