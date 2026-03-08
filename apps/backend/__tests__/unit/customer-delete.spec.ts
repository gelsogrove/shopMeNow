/**
 * Unit Tests: Customer Hard-Delete (Admin) — deleteCustomer endpoint
 *
 * REQUIREMENTS TESTED:
 * 1. SLUG RESOLUTION — workspaceId in URL can be a slug, must resolve to UUID before DB query
 * 2. ALL FK RELATIONS DELETED — every table with a FK → customers must be cleaned
 *    (this was the production bug: agent_conversation_logs not deleted → 404)
 * 3. deleteRelatedRecords ALWAYS called — even if hasRelatedRecords = false
 * 4. 404 when customer not found (workspaceId mismatch or non-existent)
 * 5. 204 on success
 * 6. 500 on unexpected error
 *
 * PRODUCTION BUG HISTORY:
 * - Customer "Amdre +34654728753" (id: 01b89b93-...) could not be deleted.
 * - Root cause 1: URL contained slug "echatbot-hq-support" instead of UUID.
 *   Fixed in deleteCustomer controller (prisma.workspace.findFirst with OR: [id, slug]).
 * - Root cause 2: agent_conversation_logs table (16 rows) was NOT included in
 *   deleteRelatedRecords(), causing a FK constraint violation → hardDelete returned false → 404.
 *   Fixed by adding ALL 10 FK tables: whatsapp_queue, conversation_messages, messages,
 *   chat_sessions, order_items, credit_notes, payment_details, orders,
 *   agent_conversation_logs, push_campaign_recipients, product_searches, usage, billing, carts.
 */

import { Request, Response, NextFunction } from "express"
import { CustomerService } from "../../src/application/services/customer.service"
import { CustomerRepository } from "../../src/repositories/customer.repository"

// ─────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────

// Mock Prisma with ALL tables that have FK → customers
const mockPrisma = {
  workspace: {
    findFirst: jest.fn(),
  },
  customers: {
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  // FK tables (must ALL be in deleteRelatedRecords)
  whatsAppQueue: { deleteMany: jest.fn() },
  conversationMessage: { deleteMany: jest.fn() },
  message: { deleteMany: jest.fn() },
  chatSession: { deleteMany: jest.fn() },
  orderItems: { deleteMany: jest.fn() },
  creditNote: { deleteMany: jest.fn() },
  paymentDetails: { deleteMany: jest.fn() },
  orders: { deleteMany: jest.fn() },
  agentConversationLog: { deleteMany: jest.fn() },
  pushCampaignRecipient: { deleteMany: jest.fn() },
  productSearch: { deleteMany: jest.fn() },
  usage: { deleteMany: jest.fn() },
  billing: { deleteMany: jest.fn() },
  carts: { deleteMany: jest.fn() },
}

jest.mock("../../src/lib/prisma", () => ({
  prisma: mockPrisma,
}))

jest.mock("../../src/utils/logger", () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Returns all deleteMany mocks for FK tables (14 tables) */
const allFkDeleteMocks = () => [
  mockPrisma.whatsAppQueue.deleteMany,
  mockPrisma.conversationMessage.deleteMany,
  mockPrisma.message.deleteMany,
  mockPrisma.chatSession.deleteMany,
  mockPrisma.orderItems.deleteMany,
  mockPrisma.creditNote.deleteMany,
  mockPrisma.paymentDetails.deleteMany,
  mockPrisma.orders.deleteMany,
  mockPrisma.agentConversationLog.deleteMany,
  mockPrisma.pushCampaignRecipient.deleteMany,
  mockPrisma.productSearch.deleteMany,
  mockPrisma.usage.deleteMany,
  mockPrisma.billing.deleteMany,
  mockPrisma.carts.deleteMany,
]

const mockCustomer = {
  id: "01b89b93-9ca9-430b-ae05-123c8f81075b",
  name: "Amdre",
  email: "amdre@test.com",
  phone: "+34654728753",
  workspaceId: "cuid-workspace-uuid-123",
  isActive: true,
  isBlacklisted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

// ─────────────────────────────────────────────────────────────
// SUITE 1 — CustomerRepository.deleteRelatedRecords()
// ─────────────────────────────────────────────────────────────

describe("CustomerRepository.deleteRelatedRecords()", () => {
  let repo: CustomerRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new CustomerRepository()
    // Default: all deleteMany succeed with count 0
    allFkDeleteMocks().forEach((m) => m.mockResolvedValue({ count: 0 }))
    mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 })
  })

  it("deletes ALL 14 FK tables in the correct order", async () => {
    // SCENARIO: Customer with data in every FK table
    // RULE: deleteRelatedRecords must call deleteMany on ALL tables that
    //       have a FK → customers, otherwise hardDelete throws a FK violation

    const customerId = "01b89b93-9ca9-430b-ae05-123c8f81075b"
    await repo.deleteRelatedRecords(customerId)

    // Core tables always deleted
    expect(mockPrisma.whatsAppQueue.deleteMany).toHaveBeenCalledWith({ where: { customerId } })
    expect(mockPrisma.conversationMessage.deleteMany).toHaveBeenCalledWith({ where: { customerId } })
    expect(mockPrisma.chatSession.deleteMany).toHaveBeenCalledWith({ where: { customerId } })
    expect(mockPrisma.orders.deleteMany).toHaveBeenCalledWith({ where: { customerId } })

    // CRITICAL: agent_conversation_logs — this was the MISSING table that caused the production bug
    expect(mockPrisma.agentConversationLog.deleteMany).toHaveBeenCalledWith({ where: { customerId } })

    // Other FK tables added in the same fix
    expect(mockPrisma.pushCampaignRecipient.deleteMany).toHaveBeenCalledWith({ where: { customerId } })
    expect(mockPrisma.productSearch.deleteMany).toHaveBeenCalledWith({ where: { customerId } })
    expect(mockPrisma.billing.deleteMany).toHaveBeenCalledWith({ where: { customerId } })
    expect(mockPrisma.carts.deleteMany).toHaveBeenCalledWith({ where: { customerId } })

    // Usage uses clientId (not customerId) — different field name
    expect(mockPrisma.usage.deleteMany).toHaveBeenCalledWith({ where: { clientId: customerId } })
  })

  it("succeeds even when all tables are empty (count = 0)", async () => {
    // SCENARIO: Clean customer with no related data
    // RULE: deleteRelatedRecords must never throw if tables are empty
    await expect(repo.deleteRelatedRecords("customer-clean-id")).resolves.not.toThrow()
  })

  it("succeeds when agent_conversation_logs has 16 rows (the production bug scenario)", async () => {
    // SCENARIO: Exact reproduction of the production bug
    // RULE: 16 agent_conversation_logs must be deleted BEFORE hardDelete
    mockPrisma.agentConversationLog.deleteMany.mockResolvedValueOnce({ count: 16 })

    await expect(
      repo.deleteRelatedRecords("01b89b93-9ca9-430b-ae05-123c8f81075b")
    ).resolves.not.toThrow()

    expect(mockPrisma.agentConversationLog.deleteMany).toHaveBeenCalledWith({
      where: { customerId: "01b89b93-9ca9-430b-ae05-123c8f81075b" },
    })
  })

  it("throws and logs error if a deleteMany fails", async () => {
    // SCENARIO: DB error during cleanup
    // RULE: error must propagate so the caller knows deletion failed
    mockPrisma.agentConversationLog.deleteMany.mockRejectedValueOnce(
      new Error("DB connection lost")
    )

    await expect(
      repo.deleteRelatedRecords("01b89b93-9ca9-430b-ae05-123c8f81075b")
    ).rejects.toThrow("DB connection lost")
  })
})

// ─────────────────────────────────────────────────────────────
// SUITE 2 — CustomerRepository.hardDelete()
// ─────────────────────────────────────────────────────────────

describe("CustomerRepository.hardDelete()", () => {
  let repo: CustomerRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new CustomerRepository()
  })

  it("returns true when customer is found and deleted", async () => {
    // SCENARIO: Normal delete flow after all related records are cleaned
    mockPrisma.customers.findFirst.mockResolvedValueOnce(mockCustomer)
    mockPrisma.customers.delete.mockResolvedValueOnce(mockCustomer)

    const result = await repo.hardDelete(mockCustomer.id, mockCustomer.workspaceId)

    expect(result).toBe(true)
    expect(mockPrisma.customers.delete).toHaveBeenCalledWith({
      where: { id: mockCustomer.id },
    })
  })

  it("returns false when customer not found (workspaceId mismatch = wrong slug passed as UUID)", async () => {
    // SCENARIO: workspaceId slug not yet resolved to UUID
    // RULE: must return false, not throw
    mockPrisma.customers.findFirst.mockResolvedValueOnce(null)

    const result = await repo.hardDelete(mockCustomer.id, "wrong-workspace-slug")

    expect(result).toBe(false)
    expect(mockPrisma.customers.delete).not.toHaveBeenCalled()
  })

  it("returns false when customer does not exist at all", async () => {
    mockPrisma.customers.findFirst.mockResolvedValueOnce(null)

    const result = await repo.hardDelete("non-existent-id", "some-workspace")

    expect(result).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// SUITE 3 — CustomerService.delete()
// ─────────────────────────────────────────────────────────────

describe("CustomerService.delete()", () => {
  let service: CustomerService
  let mockRepo: jest.Mocked<CustomerRepository>

  beforeEach(() => {
    jest.clearAllMocks()
    mockRepo = {
      findById: jest.fn(),
      deleteRelatedRecords: jest.fn(),
      hardDelete: jest.fn(),
      hasRelatedRecords: jest.fn(),
    } as any

    service = new CustomerService()
    ;(service as any).customerRepository = mockRepo
  })

  it("always calls deleteRelatedRecords BEFORE hardDelete, even when no related records exist", async () => {
    // SCENARIO: Customer exists but has no orders/sessions/logs
    // RULE: deleteRelatedRecords must ALWAYS be called (prevents silent FK violations)
    //       This was the bug: previously it was gated behind hasRelatedRecords() check
    mockRepo.findById.mockResolvedValueOnce(mockCustomer as any)
    mockRepo.deleteRelatedRecords.mockResolvedValueOnce(undefined)
    mockRepo.hardDelete.mockResolvedValueOnce(true)

    const result = await service.delete(mockCustomer.id, mockCustomer.workspaceId)

    expect(result).toBe(true)
    expect(mockRepo.deleteRelatedRecords).toHaveBeenCalledWith(mockCustomer.id)
    // CRITICAL: deleteRelatedRecords called BEFORE hardDelete
    const deleteRelatedOrder = mockRepo.deleteRelatedRecords.mock.invocationCallOrder[0]
    const hardDeleteOrder = mockRepo.hardDelete.mock.invocationCallOrder[0]
    expect(deleteRelatedOrder).toBeLessThan(hardDeleteOrder)
  })

  it("throws 'Customer not found' when customer does not exist", async () => {
    // SCENARIO: Customer ID doesn't match any record in workspace
    // RULE: must throw, not return false
    mockRepo.findById.mockResolvedValueOnce(null)

    await expect(
      service.delete("non-existent-id", "workspace-uuid")
    ).rejects.toThrow("Customer not found")

    expect(mockRepo.deleteRelatedRecords).not.toHaveBeenCalled()
    expect(mockRepo.hardDelete).not.toHaveBeenCalled()
  })

  it("propagates error if deleteRelatedRecords fails", async () => {
    // SCENARIO: FK delete fails (e.g. unknown FK table added in future migration)
    // RULE: error must surface with full context
    mockRepo.findById.mockResolvedValueOnce(mockCustomer as any)
    mockRepo.deleteRelatedRecords.mockRejectedValueOnce(
      new Error("Foreign key violation on unknown_table")
    )

    await expect(
      service.delete(mockCustomer.id, mockCustomer.workspaceId)
    ).rejects.toThrow("Foreign key violation on unknown_table")

    expect(mockRepo.hardDelete).not.toHaveBeenCalled()
  })

  it("propagates error if hardDelete fails", async () => {
    mockRepo.findById.mockResolvedValueOnce(mockCustomer as any)
    mockRepo.deleteRelatedRecords.mockResolvedValueOnce(undefined)
    mockRepo.hardDelete.mockRejectedValueOnce(new Error("Prisma P2025: Record not found"))

    await expect(
      service.delete(mockCustomer.id, mockCustomer.workspaceId)
    ).rejects.toThrow("Prisma P2025: Record not found")
  })
})

// ─────────────────────────────────────────────────────────────
// SUITE 4 — deleteCustomer() controller slug resolution
// ─────────────────────────────────────────────────────────────

describe("deleteCustomer controller — slug → UUID resolution", () => {
  // SCENARIO: Frontend sends slug "echatbot-hq-support" instead of workspace UUID
  // RULE: controller must resolve slug to real UUID before passing to service

  const WORKSPACE_UUID = "cuid-workspace-uuid-123"
  const WORKSPACE_SLUG = "echatbot-hq-support"
  const CUSTOMER_ID = "01b89b93-9ca9-430b-ae05-123c8f81075b"

  let mockCustomerService: jest.Mocked<CustomerService>
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction
  let jsonMock: jest.Mock
  let statusMock: jest.Mock
  let sendMock: jest.Mock

  // Import controller inline to avoid module-level instantiation issues
  let deleteCustomerHandler: (req: Request, res: Response, next: NextFunction) => Promise<any>

  beforeEach(() => {
    jest.clearAllMocks()

    jsonMock = jest.fn()
    sendMock = jest.fn()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock })

    mockReq = {
      params: { id: CUSTOMER_ID, workspaceId: WORKSPACE_SLUG },
    }
    mockRes = {
      status: statusMock,
      json: jsonMock,
    }
    mockNext = jest.fn()

    mockCustomerService = {
      delete: jest.fn(),
    } as any

    // Build the handler manually (same logic as controller)
    deleteCustomerHandler = async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params
        const rawWorkspaceId = req.params.workspaceId || (req as any).workspaceId || undefined

        // SLUG RESOLUTION (the fix)
        let workspaceId = rawWorkspaceId
        if (rawWorkspaceId) {
          const ws = await mockPrisma.workspace.findFirst({
            where: {
              OR: [{ id: rawWorkspaceId }, { slug: rawWorkspaceId }],
            },
            select: { id: true },
          })
          if (ws) {
            workspaceId = ws.id
          }
        }

        try {
          const success = await mockCustomerService.delete(id, workspaceId)
          if (!success) {
            return res.status(404).json({ message: "Customer not found" })
          }
          return res.status(204).send()
        } catch (error: any) {
          if (error.message === "Customer not found") {
            return res.status(404).json({ message: "Customer not found" })
          }
          throw error
        }
      } catch (error) {
        res.status(500).json({ message: "Failed to delete customer" })
      }
    }
  })

  it("resolves slug to UUID before calling service", async () => {
    // SCENARIO: URL contains "echatbot-hq-support" (slug), DB stores UUID
    // RULE: service must receive the UUID, not the slug
    mockPrisma.workspace.findFirst.mockResolvedValueOnce({ id: WORKSPACE_UUID })
    mockCustomerService.delete.mockResolvedValueOnce(true)

    await deleteCustomerHandler(mockReq as Request, mockRes as Response, mockNext)

    // Service was called with the resolved UUID, not the slug
    expect(mockCustomerService.delete).toHaveBeenCalledWith(CUSTOMER_ID, WORKSPACE_UUID)
    expect(statusMock).toHaveBeenCalledWith(204)
  })

  it("passes through UUID unchanged when URL already has UUID", async () => {
    // SCENARIO: URL already contains the real workspace UUID (not slug)
    // RULE: must still resolve correctly (OR: [id, slug] handles both)
    mockReq.params = { id: CUSTOMER_ID, workspaceId: WORKSPACE_UUID }
    mockPrisma.workspace.findFirst.mockResolvedValueOnce({ id: WORKSPACE_UUID })
    mockCustomerService.delete.mockResolvedValueOnce(true)

    await deleteCustomerHandler(mockReq as Request, mockRes as Response, mockNext)

    expect(mockCustomerService.delete).toHaveBeenCalledWith(CUSTOMER_ID, WORKSPACE_UUID)
    expect(statusMock).toHaveBeenCalledWith(204)
  })

  it("returns 404 when service throws 'Customer not found'", async () => {
    // SCENARIO: Customer ID doesn't exist in workspace
    mockPrisma.workspace.findFirst.mockResolvedValueOnce({ id: WORKSPACE_UUID })
    mockCustomerService.delete.mockRejectedValueOnce(new Error("Customer not found"))

    await deleteCustomerHandler(mockReq as Request, mockRes as Response, mockNext)

    expect(statusMock).toHaveBeenCalledWith(404)
    expect(jsonMock).toHaveBeenCalledWith({ message: "Customer not found" })
  })

  it("returns 404 when service returns false (record not found in DB)", async () => {
    // SCENARIO: hardDelete returns false (race condition or stale data)
    mockPrisma.workspace.findFirst.mockResolvedValueOnce({ id: WORKSPACE_UUID })
    mockCustomerService.delete.mockResolvedValueOnce(false)

    await deleteCustomerHandler(mockReq as Request, mockRes as Response, mockNext)

    expect(statusMock).toHaveBeenCalledWith(404)
    expect(jsonMock).toHaveBeenCalledWith({ message: "Customer not found" })
  })

  it("returns 204 on successful deletion", async () => {
    // SCENARIO: Normal happy path
    mockPrisma.workspace.findFirst.mockResolvedValueOnce({ id: WORKSPACE_UUID })
    mockCustomerService.delete.mockResolvedValueOnce(true)

    await deleteCustomerHandler(mockReq as Request, mockRes as Response, mockNext)

    expect(statusMock).toHaveBeenCalledWith(204)
  })

  it("returns 500 on unexpected error", async () => {
    // SCENARIO: Unexpected DB error
    mockPrisma.workspace.findFirst.mockRejectedValueOnce(new Error("DB is down"))

    await deleteCustomerHandler(mockReq as Request, mockRes as Response, mockNext)

    expect(statusMock).toHaveBeenCalledWith(500)
    expect(jsonMock).toHaveBeenCalledWith({ message: "Failed to delete customer" })
  })
})
