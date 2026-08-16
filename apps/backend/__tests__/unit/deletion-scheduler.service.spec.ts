/**
 * DeletionSchedulerService - Unit Tests
 *
 * WHAT: verifies the daily hard-delete job removes whatsapp_settings rows
 * BEFORE deleting their workspaces inside the same transaction.
 *
 * WHY: whatsapp_settings has an ON DELETE RESTRICT foreign key to Workspace
 * (no cascade). Before the 2026-08-16 fix, performHardDelete() never touched
 * whatsapp_settings, so any workspace that had ever configured a Meta channel
 * made the whole transaction fail with an FK violation — the job silently
 * logged FAILED and "deleted" workspaces were retained forever (GDPR risk).
 *
 * Test Coverage:
 * - whatsappSettings.deleteMany runs before workspace.deleteMany (1 test)
 * - whatsappSettings cleanup is scoped to the expired workspace ids (1 test)
 * - no whatsappSettings cleanup when no workspace is expired (1 test)
 *
 * Total: 3 tests
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { DeletionSchedulerService } from "../../src/services/deletion-scheduler.service"

const emptyFindMany = (jest.fn() as any).mockResolvedValue([])
const deleteManyOk = () => (jest.fn() as any).mockResolvedValue({ count: 0 })

function buildMockPrisma(expiredWorkspaceIds: string[]) {
  // Records call order across models so we can assert FK-safe sequencing
  const callOrder: string[] = []
  const trackedDeleteMany = (name: string, count = 0) =>
    (jest.fn() as any).mockImplementation(() => {
      callOrder.push(name)
      return Promise.resolve({ count })
    })

  const tx = {
    whatsappSettings: { deleteMany: trackedDeleteMany("whatsappSettings") },
    message: { deleteMany: trackedDeleteMany("message") },
    chatSession: { deleteMany: trackedDeleteMany("chatSession") },
    orders: { deleteMany: trackedDeleteMany("orders") },
    customers: { deleteMany: trackedDeleteMany("customers") },
    workspace: { deleteMany: trackedDeleteMany("workspace", expiredWorkspaceIds.length) },
    user: { deleteMany: trackedDeleteMany("user") },
    softDeleteAuditLog: { create: (jest.fn() as any).mockResolvedValue({}) },
  }

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
    user: { findMany: emptyFindMany },
    workspace: {
      findMany: (jest.fn() as any).mockResolvedValue(
        expiredWorkspaceIds.map((id) => ({ id }))
      ),
    },
    customers: { findMany: emptyFindMany },
    orders: { findMany: emptyFindMany },
    message: { findMany: emptyFindMany },
    chatSession: { findMany: emptyFindMany },
    $transaction: (jest.fn() as any).mockImplementation(async (fn: any) => fn(tx)),
  } as any

  return { prisma, tx, callOrder }
}

describe("DeletionSchedulerService - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should delete whatsapp_settings BEFORE workspaces in the hard-delete transaction", async () => {
    const { prisma, tx, callOrder } = buildMockPrisma(["ws-expired-1"])
    const service = new DeletionSchedulerService(prisma)

    const result = await service.runHardDeleteJob()

    expect(result.success).toBe(true)
    expect(tx.whatsappSettings.deleteMany).toHaveBeenCalled()
    // FK is ON DELETE RESTRICT: settings MUST go first or the tx fails
    expect(callOrder.indexOf("whatsappSettings")).toBeLessThan(
      callOrder.indexOf("workspace")
    )
  })

  it("should scope whatsapp_settings cleanup to the expired workspace ids", async () => {
    // WHY: deleting settings of NON-expired workspaces would kill live
    // Meta channels of active tenants — the filter must be exact.
    const { prisma, tx } = buildMockPrisma(["ws-a", "ws-b"])
    const service = new DeletionSchedulerService(prisma)

    await service.runHardDeleteJob()

    expect(tx.whatsappSettings.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: ["ws-a", "ws-b"] } },
    })
  })

  it("should not touch whatsapp_settings when no workspace is expired", async () => {
    // Expired messages/users without expired workspaces → settings untouched
    const { prisma, tx } = buildMockPrisma([])
    prisma.message.findMany = (jest.fn() as any).mockResolvedValue([{ id: "m1" }])
    const service = new DeletionSchedulerService(prisma)

    await service.runHardDeleteJob()

    expect(tx.whatsappSettings.deleteMany).not.toHaveBeenCalled()
  })
})
