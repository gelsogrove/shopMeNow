/**
 * WhatsAppRetentionService - Unit Tests
 *
 * WHAT: verifies the daily retention job purges ONLY what it must:
 * old webhook-dedup events, old terminal-status queue rows, and expired
 * anonymous widget sessions — never pending work.
 *
 * WHY: whatsapp_webhook_events and whatsapp_queue grew forever (the
 * schema's expiresAt index carried a "For cleanup job" comment since its
 * creation, but the job never existed until 2026-08-16). The critical
 * invariant is the opposite direction: a pending message of a channel that
 * comes online next week must survive every cleanup run.
 *
 * Total: 3 tests
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import {
  WhatsAppRetentionService,
  WEBHOOK_EVENT_RETENTION_DAYS,
  QUEUE_TERMINAL_RETENTION_DAYS,
} from "../../src/services/whatsapp-retention.service"

const mockPrisma = {
  whatsappWebhookEvent: { deleteMany: jest.fn() as any },
  whatsAppQueue: { deleteMany: jest.fn() as any },
} as any

describe("WhatsAppRetentionService - Unit Tests", () => {
  let service: WhatsAppRetentionService

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.whatsappWebhookEvent.deleteMany.mockResolvedValue({ count: 3 })
    mockPrisma.whatsAppQueue.deleteMany.mockResolvedValue({ count: 5 })
    service = new WhatsAppRetentionService(mockPrisma)
  })

  it("should delete webhook events older than the retention window", async () => {
    const before = Date.now()
    const result = await service.cleanup()
    const after = Date.now()

    expect(result.webhookEventsDeleted).toBe(3)
    const call = mockPrisma.whatsappWebhookEvent.deleteMany.mock.calls[0][0]
    const cutoff: Date = call.where.receivedAt.lt
    // Cutoff must be exactly retention-days in the past (within call runtime)
    const expectedMin = before - WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const expectedMax = after - WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin)
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax)
  })

  it("should purge only terminal-status queue rows and expired widget sessions", async () => {
    // WHY: the where clause is the whole safety contract — "pending" must
    // never appear in the terminal-status list, or queued campaign messages
    // of a temporarily offline channel would be destroyed.
    const result = await service.cleanup()

    expect(result.queueMessagesDeleted).toBe(5)
    const call = mockPrisma.whatsAppQueue.deleteMany.mock.calls[0][0]
    const [terminalBranch, widgetBranch] = call.where.OR

    expect(terminalBranch.status.in).toEqual(["sent", "delivered", "error", "failed"])
    expect(terminalBranch.status.in).not.toContain("pending")
    expect(terminalBranch.createdAt.lt).toBeInstanceOf(Date)

    // Widget branch: only rows WITH an expiresAt that has passed
    expect(widgetBranch.expiresAt.not).toBeNull()
    expect(widgetBranch.expiresAt.lt).toBeInstanceOf(Date)
  })

  it("should report both deletion counts", async () => {
    mockPrisma.whatsappWebhookEvent.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.whatsAppQueue.deleteMany.mockResolvedValue({ count: 0 })

    const result = await service.cleanup()

    expect(result).toEqual({ webhookEventsDeleted: 0, queueMessagesDeleted: 0 })
    // Sanity: both retention constants share the 30-day repo convention
    expect(QUEUE_TERMINAL_RETENTION_DAYS).toBe(30)
  })
})
