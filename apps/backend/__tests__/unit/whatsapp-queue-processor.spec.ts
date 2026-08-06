/**
 * Tests for WhatsAppQueueService.processAllPendingWorkspaces() — the cron
 * entry point that drains queued (push campaign) messages.
 *
 * WHY these cases: the processor was missing entirely (prod had messages
 * stuck 'pending' since 2026-06-13), so what matters is pinning the rules
 * of the NEW loop:
 * - the guard Andrea specified (2026-08-06): a workspace is only processed
 *   when WhatsApp is ACTIVE and a provider is CONFIGURED — otherwise its
 *   messages must stay pending (not error) until the channel is set up;
 * - the per-cycle cap (MAX_MESSAGES_PER_CYCLE) so one bulk campaign cannot
 *   monopolize a cycle or hammer the provider;
 * - no work at all when the queue is empty (this runs every 60s).
 */

const mockPrisma = {
  whatsAppQueue: {
    groupBy: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
  },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(),
}))

// The service constructor wires repository/security/billing — none of them
// are exercised here because processPendingMessages itself is stubbed.
jest.mock("../../src/application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({})),
}))
jest.mock("../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({})),
}))
jest.mock("../../src/repositories/whatsapp-queue.repository", () => ({
  WhatsAppQueueRepository: jest.fn().mockImplementation(() => ({})),
}))

import { WhatsAppQueueService } from "../../src/services/whatsapp-queue.service"

describe("WhatsAppQueueService.processAllPendingWorkspaces", () => {
  let service: WhatsAppQueueService
  let processSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WhatsAppQueueService(mockPrisma as any)
    // Stub the single-message processor: these tests verify WHICH workspaces
    // get processed and HOW MANY times, not the send mechanics (covered by
    // whatsapp-queue.service.spec.ts).
    processSpy = jest
      .spyOn(service, "processPendingMessages")
      .mockResolvedValue(undefined)
  })

  it("does nothing (no workspace lookup) when the queue has no pending messages", async () => {
    mockPrisma.whatsAppQueue.groupBy.mockResolvedValue([])

    await service.processAllPendingWorkspaces()

    expect(mockPrisma.workspace.findMany).not.toHaveBeenCalled()
    expect(processSpy).not.toHaveBeenCalled()
  })

  it("SKIPS a workspace with WhatsApp disabled — its messages stay pending", async () => {
    mockPrisma.whatsAppQueue.groupBy.mockResolvedValue([
      { workspaceId: "ws-off", _count: { _all: 3 } },
    ])
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws-off", name: "Off", enableWhatsapp: false, whatsappProvider: "meta" },
    ])

    await service.processAllPendingWorkspaces()

    expect(processSpy).not.toHaveBeenCalled()
  })

  it("SKIPS a workspace with no provider configured — its messages stay pending", async () => {
    mockPrisma.whatsAppQueue.groupBy.mockResolvedValue([
      { workspaceId: "ws-noprov", _count: { _all: 2 } },
    ])
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws-noprov", name: "NoProv", enableWhatsapp: true, whatsappProvider: null },
    ])

    await service.processAllPendingWorkspaces()

    expect(processSpy).not.toHaveBeenCalled()
  })

  it("processes each pending message (FIFO calls) for an active workspace with a provider", async () => {
    mockPrisma.whatsAppQueue.groupBy.mockResolvedValue([
      { workspaceId: "ws-ok", _count: { _all: 3 } },
    ])
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws-ok", name: "Ok", enableWhatsapp: true, whatsappProvider: "meta" },
    ])

    await service.processAllPendingWorkspaces()

    expect(processSpy).toHaveBeenCalledTimes(3)
    expect(processSpy).toHaveBeenCalledWith("ws-ok")
  })

  it("caps a bulk campaign at MAX_MESSAGES_PER_CYCLE per cycle", async () => {
    mockPrisma.whatsAppQueue.groupBy.mockResolvedValue([
      { workspaceId: "ws-bulk", _count: { _all: 500 } },
    ])
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws-bulk", name: "Bulk", enableWhatsapp: true, whatsappProvider: "wasender" },
    ])

    await service.processAllPendingWorkspaces()

    expect(processSpy).toHaveBeenCalledTimes(WhatsAppQueueService.MAX_MESSAGES_PER_CYCLE)
  })

  it("processes eligible workspaces and skips ineligible ones in the same cycle", async () => {
    mockPrisma.whatsAppQueue.groupBy.mockResolvedValue([
      { workspaceId: "ws-ok", _count: { _all: 1 } },
      { workspaceId: "ws-off", _count: { _all: 4 } },
    ])
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws-ok", name: "Ok", enableWhatsapp: true, whatsappProvider: "ultramsg" },
      { id: "ws-off", name: "Off", enableWhatsapp: false, whatsappProvider: null },
    ])

    await service.processAllPendingWorkspaces()

    expect(processSpy).toHaveBeenCalledTimes(1)
    expect(processSpy).toHaveBeenCalledWith("ws-ok")
  })
})
