/**
 * Unit tests — reaction send service (operator → customer).
 *
 * WHAT: resolve the workspace's provider and delegate to provider.sendReaction.
 * Must (a) send via the provider, (b) report `unsupported` when the provider has
 * no reaction method (e.g. UltraMsg), (c) surface provider failures, (d) never
 * throw, (e) stay workspace-isolated (provider built from the loaded workspace).
 */

import { sendOperatorReaction } from "../../../services/reaction-send.service"
import { WhatsAppProviderFactory } from "../../../services/whatsapp/whatsapp-provider.factory"

jest.mock("../../../services/whatsapp/whatsapp-provider.factory")
jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

const mockFactory = WhatsAppProviderFactory as jest.Mocked<typeof WhatsAppProviderFactory>

function mkPrisma(workspace: any) {
  return { workspace: { findUnique: jest.fn().mockResolvedValue(workspace) } } as any
}

const INPUT = {
  workspaceId: "ws1",
  phoneNumber: "+393331234567",
  whatsappMessageId: "wamid.IN1",
  emoji: "👍",
}

describe("sendOperatorReaction", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFactory.isConfigured = jest.fn().mockReturnValue(true)
  })

  it("sends the reaction via the provider and returns the provider message id", async () => {
    const sendReaction = jest.fn().mockResolvedValue({ success: true, messageId: "wamid.OUT1" })
    mockFactory.create = jest.fn().mockReturnValue({
      sendReaction,
      getProviderName: () => "Meta",
    } as any)

    const res = await sendOperatorReaction(mkPrisma({ id: "ws1", whatsappProvider: "meta" }), INPUT)

    expect(res.ok).toBe(true)
    expect(res.providerMessageId).toBe("wamid.OUT1")
    expect(sendReaction).toHaveBeenCalledWith("+393331234567", "wamid.IN1", "👍")
  })

  it("reports unsupported when the provider has no sendReaction", async () => {
    mockFactory.create = jest.fn().mockReturnValue({ getProviderName: () => "UltraMsg" } as any)

    const res = await sendOperatorReaction(mkPrisma({ id: "ws1", whatsappProvider: "ultramsg" }), INPUT)

    expect(res.ok).toBe(false)
    expect(res.unsupported).toBe(true)
  })

  it("surfaces a provider send failure", async () => {
    mockFactory.create = jest.fn().mockReturnValue({
      sendReaction: jest.fn().mockResolvedValue({ success: false, error: "Invalid message_id" }),
      getProviderName: () => "Meta",
    } as any)

    const res = await sendOperatorReaction(mkPrisma({ id: "ws1" }), INPUT)

    expect(res.ok).toBe(false)
    expect(res.error).toBe("Invalid message_id")
  })

  it("returns provider_not_configured when the workspace has no provider", async () => {
    mockFactory.isConfigured = jest.fn().mockReturnValue(false)
    const res = await sendOperatorReaction(mkPrisma({ id: "ws1" }), INPUT)
    expect(res.ok).toBe(false)
    expect(res.error).toBe("provider_not_configured")
  })

  it("returns workspace_not_found when the workspace is missing", async () => {
    const res = await sendOperatorReaction(mkPrisma(null), INPUT)
    expect(res.ok).toBe(false)
    expect(res.error).toBe("workspace_not_found")
  })

  it("never throws — returns an error result if a dependency throws", async () => {
    const prisma = { workspace: { findUnique: jest.fn().mockRejectedValue(new Error("db down")) } } as any
    await expect(sendOperatorReaction(prisma, INPUT)).resolves.toEqual(
      expect.objectContaining({ ok: false })
    )
  })
})
