/**
 * UserUnsubscribeService - UNIT tests
 * Focus: owner unsubscribe finalizes invoice and disables workspace
 */

import { UserUnsubscribeService } from "../../../src/services/user-unsubscribe.service"

const mockInvoiceService = {
  getOrCreateCurrentInvoice: jest.fn(),
  finalizeInvoice: jest.fn(),
}

jest.mock("../../../src/application/services/invoice.service", () => ({
  invoiceService: mockInvoiceService,
}))

jest.mock("../../../src/application/services/email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendUnsubscribeNotification: jest.fn(),
  })),
}))

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  customers: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  orders: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  orderItems: {
    updateMany: jest.fn(),
  },
  message: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  chatSession: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  userWorkspace: {
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  softDeleteAuditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(async (callback: (tx: typeof mockPrisma) => Promise<any>) => {
    return callback(mockPrisma)
  }),
}

describe("UserUnsubscribeService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("finalizes invoice and disables workspace on owner unsubscribe", async () => {
    const service = new UserUnsubscribeService(mockPrisma as any)

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "owner-1",
      deletedAt: null,
    })

    mockPrisma.workspace.findMany.mockResolvedValueOnce([
      { id: "ws-1", ownerId: "owner-1" },
    ])

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "owner-1",
      deletedAt: null,
    })

    mockPrisma.workspace.findUnique.mockResolvedValueOnce({
      id: "ws-1",
      ownerId: "owner-1",
    })

    mockPrisma.customers.count.mockResolvedValue(0)
    mockPrisma.orders.count.mockResolvedValue(0)
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.chatSession.count.mockResolvedValue(0)
    mockPrisma.userWorkspace.count.mockResolvedValue(0)
    mockPrisma.userWorkspace.findMany.mockResolvedValue([])

    mockInvoiceService.getOrCreateCurrentInvoice.mockResolvedValue({ id: "inv-1" })

    await service.unsubscribeUser("owner-1", "request")

    expect(mockInvoiceService.getOrCreateCurrentInvoice).toHaveBeenCalledWith("owner-1")
    expect(mockInvoiceService.finalizeInvoice).toHaveBeenCalledWith("inv-1")

    expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        channelStatus: false,
      }),
    })

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        subscriptionStatus: "PAUSED",
        pausedAt: expect.any(Date),
      }),
    })
  })
})
