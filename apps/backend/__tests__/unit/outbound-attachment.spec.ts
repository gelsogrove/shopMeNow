/**
 * Unit Tests — Outbound Attachment Send
 *
 * WHAT: Validates the operator→customer attachment send orchestration: the
 *       "active" gate, channel branching (whatsapp sends, widget persists only),
 *       provider success/failure mapping, and fail-safe behaviour.
 *
 * WHY:  Encodes two product rules: (1) "if active is false it neither receives
 *       nor sends anything" and (2) outbound only hits the provider on the
 *       WhatsApp channel. See docs/media-attachments-plan.md §5–§7.
 */

import {
  OutboundProvider,
  sendOperatorAttachment,
} from "../../src/services/outbound-attachment.service"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

function makeProvider(result = { messageId: "wamid.out1", success: true }): jest.Mocked<OutboundProvider> {
  return {
    sendMediaMessage: jest.fn().mockResolvedValue(result),
  } as unknown as jest.Mocked<OutboundProvider>
}

const imageAtt = { kind: "IMAGE" as const, publicUrl: "https://cdn/file.jpg" }
const pdfAtt = { kind: "DOCUMENT" as const, publicUrl: "https://cdn/file.pdf" }

describe("sendOperatorAttachment()", () => {
  it("does NOT send when the channel is inactive (active=false)", async () => {
    const provider = makeProvider()
    const r = await sendOperatorAttachment(
      { provider, logger },
      { active: false, channel: "whatsapp", to: "+34600", attachment: imageAtt }
    )
    expect(r).toMatchObject({ ok: true, sent: false, skipped: "inactive" })
    expect(provider.sendMediaMessage).not.toHaveBeenCalled()
  })

  it("persists only (no provider send) on the widget channel", async () => {
    const provider = makeProvider()
    const r = await sendOperatorAttachment(
      { provider, logger },
      { active: true, channel: "widget", to: "visitor", attachment: imageAtt }
    )
    expect(r).toEqual({ ok: true, sent: false })
    expect(provider.sendMediaMessage).not.toHaveBeenCalled()
  })

  it("sends an image via the provider on the whatsapp channel", async () => {
    const provider = makeProvider()
    const r = await sendOperatorAttachment(
      { provider, logger },
      { active: true, channel: "whatsapp", to: "+34600", attachment: imageAtt, caption: "here" }
    )
    expect(r).toMatchObject({ ok: true, sent: true, providerMessageId: "wamid.out1" })
    expect(provider.sendMediaMessage).toHaveBeenCalledWith(
      "+34600",
      "https://cdn/file.jpg",
      "here",
      "image"
    )
  })

  it("maps DOCUMENT kind to provider mediaType 'document'", async () => {
    const provider = makeProvider()
    await sendOperatorAttachment(
      { provider, logger },
      { active: true, channel: "whatsapp", to: "+34600", attachment: pdfAtt }
    )
    expect(provider.sendMediaMessage).toHaveBeenCalledWith(
      "+34600",
      "https://cdn/file.pdf",
      undefined,
      "document"
    )
  })

  it("returns an error when the provider reports failure", async () => {
    const provider = makeProvider({ messageId: "", success: false } as any)
    ;(provider.sendMediaMessage as jest.Mock).mockResolvedValue({
      messageId: "",
      success: false,
      error: "rate limited",
    })
    const r = await sendOperatorAttachment(
      { provider, logger },
      { active: true, channel: "whatsapp", to: "+34600", attachment: imageAtt }
    )
    expect(r).toMatchObject({ ok: false, sent: false, error: "rate limited" })
  })

  it("errors when whatsapp channel has no provider configured", async () => {
    const r = await sendOperatorAttachment(
      { logger },
      { active: true, channel: "whatsapp", to: "+34600", attachment: imageAtt }
    )
    expect(r).toMatchObject({ ok: false, error: "no_provider_configured" })
  })

  it("never throws: a provider exception becomes ok:false", async () => {
    const provider = makeProvider()
    ;(provider.sendMediaMessage as jest.Mock).mockRejectedValue(new Error("socket hang up"))
    const r = await sendOperatorAttachment(
      { provider, logger },
      { active: true, channel: "whatsapp", to: "+34600", attachment: imageAtt }
    )
    expect(r).toMatchObject({ ok: false, sent: false, error: "socket hang up" })
  })
})
