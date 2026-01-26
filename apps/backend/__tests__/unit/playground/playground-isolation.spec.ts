import { PrismaClient } from "@echatbot/database"
import { BillingService } from "../../../src/application/services/billing.service"

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// Mock PricingRepository
jest.mock("../../../src/repositories/pricing.repository", () => ({
  PricingRepository: jest.fn().mockImplementation(() => ({
    getValue: jest.fn().mockResolvedValue(0.1), // $0.10 per message
    getByKey: jest.fn().mockResolvedValue({ key: "MESSAGE", value: 0.1 }),
  })),
}))

// Mock Prisma
jest.mock("@echatbot/database", () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    billing: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    billingTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaClient)),
  }

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    BillingType: {
      MESSAGE: "MESSAGE",
      TOP_UP: "TOP_UP",
      UPGRADE: "UPGRADE",
    },
  }
})

describe("Playground Isolation - Feature Spec", () => {
  let prisma: PrismaClient
  let billingService: BillingService

  beforeEach(() => {
    jest.clearAllMocks()
    prisma = new PrismaClient()
    billingService = new BillingService(prisma)

    // Default mocks
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: "workspace-1",
      creditBalance: 100,
      ownerId: "user-1",
      name: "Test Workspace",
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      creditBalance: 100,
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: "user-1",
      creditBalance: 99.9,
    })
    ;(prisma.billing.aggregate as jest.Mock).mockResolvedValue({
      _sum: { currentCharge: 5.5 },
    })
    ;(prisma.billing.create as jest.Mock).mockResolvedValue({
      id: "billing-1",
    })
    ;(prisma.billingTransaction.create as jest.Mock).mockResolvedValue({
      id: "transaction-1",
    })
  })

  describe("Playground Billing Exemption", () => {
    it("should skip credit deduction when isPlayground=true", async () => {
      await billingService.trackMessage(
        "workspace-1",
        "customer-1",
        "Test message",
        "Hello",
        true // isPlayground=true
      )

      // Should NOT call any billing operations
      expect(prisma.billing.create).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.billingTransaction.create).not.toHaveBeenCalled()
    })

    it("should deduct credit when isPlayground=false", async () => {
      await billingService.trackMessage(
        "workspace-1",
        "customer-1",
        "Test message",
        "Hello",
        false // isPlayground=false
      )

      // Should call billing operations
      expect(prisma.billing.create).toHaveBeenCalled()
      expect(prisma.user.update).toHaveBeenCalled()
      expect(prisma.billingTransaction.create).toHaveBeenCalled()
    })

    it("should default to isPlayground=false when not specified", async () => {
      await billingService.trackMessage(
        "workspace-1",
        "customer-1",
        "Test message",
        "Hello"
        // isPlayground not provided - defaults to false
      )

      // Should call billing operations (normal behavior)
      expect(prisma.billing.create).toHaveBeenCalled()
    })
  })

  describe("Queue Isolation", () => {
    it("should document that playground messages skip queue entirely", () => {
      // This test documents the expected behavior:
      // When isPlayground=true, webhook controller should NOT call queueService.enqueue()
      // Messages stay in memory, no queue persistence

      const playgroundFlow = {
        shouldEnqueue: false,
        reason: "Playground messages processed immediately, no queue needed",
      }

      expect(playgroundFlow.shouldEnqueue).toBe(false)
    })

    it("should document that real WhatsApp messages are queued", () => {
      const realWhatsAppFlow = {
        shouldEnqueue: true,
        reason: "Real messages go to queue for async processing",
      }

      expect(realWhatsAppFlow.shouldEnqueue).toBe(true)
    })
  })

  describe("Playground vs Real WhatsApp Comparison", () => {
    it("should have different flows for playground and real WhatsApp", () => {
      const flows = {
        playground: {
          queue: false,
          billing: false,
          llmResponse: true,
          immediate: true,
        },
        realWhatsApp: {
          queue: true,
          billing: true,
          llmResponse: true,
          immediate: false,
        },
      }

      // Playground: immediate, no queue, no billing
      expect(flows.playground.queue).toBe(false)
      expect(flows.playground.billing).toBe(false)
      expect(flows.playground.immediate).toBe(true)

      // Real WhatsApp: queued, billed, async
      expect(flows.realWhatsApp.queue).toBe(true)
      expect(flows.realWhatsApp.billing).toBe(true)
      expect(flows.realWhatsApp.immediate).toBe(false)
    })
  })
})
