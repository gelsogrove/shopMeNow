/**
 * DeletionSchedulerService - Unit Tests
 *
 * WHAT: verifies the daily hard-delete job removes every RESTRICT-FK child
 * before its parent, in independent per-scope transactions.
 *
 * WHY: many tables reference Workspace/Customers/Orders with ON DELETE
 * RESTRICT (whatsapp_settings, products, carts, payment_details, usage,
 * appointments, ...). Before the 2026-08-16 fixes, performHardDelete()
 * deleted none of them, so ANY workspace with real data made the single
 * monolithic transaction fail — the job logged FAILED and "deleted" data
 * was silently retained forever (GDPR risk). The fix cascades all children
 * and splits scopes so one failure cannot block the others.
 *
 * Test Coverage:
 * - workspace scope: children deleted before parents, correct order (2 tests)
 * - workspace scope: cleanup scoped to expired workspace ids (1 test)
 * - no expired workspaces → workspace-scoped tables untouched (1 test)
 * - a failing scope does not abort the other scopes (1 test)
 * - customer scope: children (orders, carts, usage) deleted first (1 test)
 *
 * Total: 6 tests
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { DeletionSchedulerService } from "../../src/services/deletion-scheduler.service"

// Every model touched by the job. findMany defaults to "nothing expired";
// individual tests override the scopes they exercise.
const WORKSPACE_CHILD_MODELS = [
  "message", "cartItems", "paymentDetails", "appointment",
  "lateCancellationAttempt", "usage", "chatSession", "carts", "orders",
  "customers", "products", "offers", "categories", "sales", "languages",
  "services", "secureToken", "billing", "searchConversations",
  "userWorkspace", "whatsappSettings", "passwordReset", "workspaceInvitation",
] as const

function buildMockPrisma() {
  const callOrder: string[] = []
  const tx: any = {}

  for (const model of [...WORKSPACE_CHILD_MODELS, "workspace", "user"]) {
    tx[model] = {
      deleteMany: (jest.fn() as any).mockImplementation(() => {
        callOrder.push(model)
        return Promise.resolve({ count: 1 })
      }),
      findMany: (jest.fn() as any).mockResolvedValue([]),
    }
  }
  tx.softDeleteAuditLog = { create: (jest.fn() as any).mockResolvedValue({}) }

  const prisma = {
    schedulerJobStatus: {
      upsert: (jest.fn() as any).mockResolvedValue({
        jobName: "soft-delete-hard-delete",
        isActive: true,
        lastRunAt: null, // never ran today → job proceeds
        lastStatus: "NEVER_RUN",
      }),
      update: (jest.fn() as any).mockResolvedValue({}),
    },
    // findExpiredRecords discovery queries (outside the transactions)
    user: { findMany: (jest.fn() as any).mockResolvedValue([]) },
    workspace: { findMany: (jest.fn() as any).mockResolvedValue([]) },
    customers: { findMany: (jest.fn() as any).mockResolvedValue([]) },
    orders: { findMany: (jest.fn() as any).mockResolvedValue([]) },
    message: { findMany: (jest.fn() as any).mockResolvedValue([]) },
    chatSession: { findMany: (jest.fn() as any).mockResolvedValue([]) },
    $transaction: (jest.fn() as any).mockImplementation(async (fn: any) => fn(tx)),
  } as any

  return { prisma, tx, callOrder }
}

describe("DeletionSchedulerService - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should delete every RESTRICT child BEFORE the workspace row", async () => {
    const { prisma, tx, callOrder } = buildMockPrisma()
    // Discovery + in-transaction re-verify both see one expired workspace
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-expired-1" }])
    tx.workspace.findMany.mockResolvedValue([{ id: "ws-expired-1" }])

    const service = new DeletionSchedulerService(prisma)
    const result = await service.runHardDeleteJob()

    expect(result.success).toBe(true)
    const workspacePos = callOrder.indexOf("workspace")
    // Every workspace-scoped RESTRICT child must be deleted first
    for (const child of [
      "whatsappSettings", "customers", "orders", "carts", "usage",
      "products", "services", "billing", "userWorkspace",
    ]) {
      expect(callOrder.indexOf(child)).toBeGreaterThanOrEqual(0)
      expect(callOrder.indexOf(child)).toBeLessThan(workspacePos)
    }
  })

  it("should respect grandchild → child → parent order inside the workspace scope", async () => {
    // WHY: cart_items RESTRICT carts, payment_details RESTRICT orders,
    // messages RESTRICT chat_sessions, appointments RESTRICT services &
    // customers — a wrong order re-introduces the original FK failure.
    const { prisma, tx, callOrder } = buildMockPrisma()
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws1" }])
    tx.workspace.findMany.mockResolvedValue([{ id: "ws1" }])

    const service = new DeletionSchedulerService(prisma)
    await service.runHardDeleteJob()

    expect(callOrder.indexOf("cartItems")).toBeLessThan(callOrder.indexOf("carts"))
    expect(callOrder.indexOf("paymentDetails")).toBeLessThan(callOrder.indexOf("orders"))
    expect(callOrder.indexOf("message")).toBeLessThan(callOrder.indexOf("chatSession"))
    expect(callOrder.indexOf("appointment")).toBeLessThan(callOrder.indexOf("services"))
    expect(callOrder.indexOf("appointment")).toBeLessThan(callOrder.indexOf("customers"))
    expect(callOrder.indexOf("usage")).toBeLessThan(callOrder.indexOf("customers"))
    expect(callOrder.indexOf("carts")).toBeLessThan(callOrder.indexOf("customers"))
    expect(callOrder.indexOf("orders")).toBeLessThan(callOrder.indexOf("customers"))
  })

  it("should scope workspace-child cleanup to the expired workspace ids", async () => {
    // WHY: deleting settings/products of NON-expired workspaces would destroy
    // live tenants — the filter must be exactly the verified expired ids.
    const { prisma, tx } = buildMockPrisma()
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-a" }, { id: "ws-b" }])
    tx.workspace.findMany.mockResolvedValue([{ id: "ws-a" }, { id: "ws-b" }])

    const service = new DeletionSchedulerService(prisma)
    await service.runHardDeleteJob()

    expect(tx.whatsappSettings.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: ["ws-a", "ws-b"] } },
    })
    expect(tx.products.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: ["ws-a", "ws-b"] } },
    })
  })

  it("should not touch workspace-scoped tables when no workspace is expired", async () => {
    const { prisma, tx } = buildMockPrisma()
    // Only an expired standalone message — no workspace involved
    prisma.message.findMany.mockResolvedValue([{ id: "m1" }])

    const service = new DeletionSchedulerService(prisma)
    await service.runHardDeleteJob()

    expect(tx.whatsappSettings.deleteMany).not.toHaveBeenCalled()
    expect(tx.products.deleteMany).not.toHaveBeenCalled()
    expect(tx.workspace.deleteMany).not.toHaveBeenCalled()
  })

  it("should continue with the other scopes when one scope fails", async () => {
    // WHY: the original bug was one monolithic transaction — a single FK
    // violation retained EVERYTHING. Scopes must be independent.
    const { prisma, tx } = buildMockPrisma()
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws1" }])
    tx.workspace.findMany.mockResolvedValue([{ id: "ws1" }])
    prisma.user.findMany.mockResolvedValue([{ id: "u1" }])
    tx.user.findMany.mockResolvedValue([{ id: "u1" }])
    // Workspace scope blows up (e.g. an FK we did not foresee)
    tx.workspace.deleteMany.mockRejectedValue(new Error("FK violation"))

    const service = new DeletionSchedulerService(prisma)
    const result = await service.runHardDeleteJob()

    // Job overall still succeeds and the users scope still ran
    expect(result.success).toBe(true)
    expect(tx.user.deleteMany).toHaveBeenCalled()
  })

  it("should delete a customer's dependent records before the customer", async () => {
    const { prisma, tx, callOrder } = buildMockPrisma()
    prisma.customers.findMany.mockResolvedValue([{ id: "cust1" }])
    tx.customers.findMany.mockResolvedValue([{ id: "cust1" }])

    const service = new DeletionSchedulerService(prisma)
    await service.runHardDeleteJob()

    expect(tx.orders.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: { in: ["cust1"] } } })
    )
    expect(tx.usage.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: { in: ["cust1"] } } })
    )
    expect(callOrder.indexOf("orders")).toBeLessThan(callOrder.indexOf("customers"))
  })
})
