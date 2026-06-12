/**
 * Unit tests — delivery-status updater (✓ sent → ✓✓ delivered → ✓✓ blue read).
 *
 * WHAT: given a provider message id + target level from a status webhook, promote
 * the matching outbound ConversationMessage forward.
 * WHY: must be workspace-isolated, forward-only (never downgrade read→delivered),
 * idempotent, and never throw.
 */

jest.mock("../../../services/websocket.service", () => ({
  websocketService: { notifyNewMessage: jest.fn() },
}))
jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

import { applyStatusUpdate } from "../../../services/delivery-status.service"
import { websocketService } from "../../../services/websocket.service"

function makePrisma(found: any) {
  return {
    conversationMessage: {
      findFirst: jest.fn().mockResolvedValue(found),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any
}

describe("applyStatusUpdate", () => {
  beforeEach(() => jest.clearAllMocks())

  it("promotes sent → delivered and notifies the FE", async () => {
    const prisma = makePrisma({ id: "m1", conversationId: "s1", deliveryStatus: "sent" })
    const ok = await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "w.A", status: "delivered" })
    expect(ok).toBe(true)
    expect(prisma.conversationMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws", whatsappMessageId: "w.A" } })
    )
    expect(prisma.conversationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" }, data: expect.objectContaining({ deliveryStatus: "delivered" }) })
    )
    expect(websocketService.notifyNewMessage).toHaveBeenCalledWith(
      "ws",
      expect.objectContaining({ sessionId: "s1", deliveryStatus: "delivered" })
    )
  })

  it("promotes sent → read directly (skips delivered)", async () => {
    const prisma = makePrisma({ id: "m1", conversationId: "s1", deliveryStatus: "sent" })
    const ok = await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "w.A", status: "read" })
    expect(ok).toBe(true)
    expect(prisma.conversationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "read" }) })
    )
  })

  it("promotes delivered → read", async () => {
    const prisma = makePrisma({ id: "m1", conversationId: "s1", deliveryStatus: "delivered" })
    const ok = await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "w.A", status: "read" })
    expect(ok).toBe(true)
  })

  it("is forward-only: a 'delivered' event for an already-read message is a no-op", async () => {
    const prisma = makePrisma({ id: "m1", conversationId: "s1", deliveryStatus: "read" })
    const ok = await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "w.A", status: "delivered" })
    expect(ok).toBe(false)
    expect(prisma.conversationMessage.update).not.toHaveBeenCalled()
  })

  it("does not promote from a non-tracked state (pending/blocked/error)", async () => {
    for (const state of ["pending", "blocked", "error", "not_queued"]) {
      const prisma = makePrisma({ id: "m1", conversationId: "s1", deliveryStatus: state })
      const ok = await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "w.A", status: "delivered" })
      expect(ok).toBe(false)
    }
  })

  it("is a no-op for an unknown provider id (e.g. inbound message)", async () => {
    const prisma = makePrisma(null)
    const ok = await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "unknown", status: "delivered" })
    expect(ok).toBe(false)
    expect(prisma.conversationMessage.update).not.toHaveBeenCalled()
  })

  it("never throws — a DB error resolves to false", async () => {
    const prisma = {
      conversationMessage: {
        findFirst: jest.fn().mockRejectedValue(new Error("db down")),
        update: jest.fn(),
      },
    } as any
    await expect(
      applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "x", status: "delivered" })
    ).resolves.toBe(false)
  })

  it("ignores empty workspaceId / providerMessageId", async () => {
    const prisma = makePrisma({ id: "m", conversationId: "s", deliveryStatus: "sent" })
    expect(await applyStatusUpdate(prisma, { workspaceId: "", providerMessageId: "x", status: "delivered" })).toBe(false)
    expect(await applyStatusUpdate(prisma, { workspaceId: "ws", providerMessageId: "", status: "delivered" })).toBe(false)
    expect(prisma.conversationMessage.findFirst).not.toHaveBeenCalled()
  })
})
