/**
 * Unit tests — reaction context resolver + composer.
 *
 * WHAT: turn a reaction into the text fed to the LLM. The composer is pure; the
 * resolver looks up the reacted-to message by its stored WhatsApp id (workspace-
 * isolated) and must never throw; buildReactionText ties them together and
 * degrades to emoji-only when the original can't be found.
 * WHY: this is what gives the model the "👍 on WHICH message" context.
 */

import {
  truncateQuoted,
  composeReactionText,
  resolveReactedMessageText,
  buildReactionText,
} from "../../../services/reaction-context.service"

jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

describe("reaction-context: composeReactionText (pure)", () => {
  it("returns the emoji alone when there is no original text", () => {
    expect(composeReactionText("👍", null)).toBe("👍")
    expect(composeReactionText("👍", "   ")).toBe("👍")
  })

  it("quotes the original message next to the emoji", () => {
    expect(composeReactionText("👍", "Confermi l'ordine da 30€?")).toBe(
      '👍 → "Confermi l\'ordine da 30€?"'
    )
  })
})

describe("reaction-context: truncateQuoted (pure)", () => {
  it("collapses whitespace", () => {
    expect(truncateQuoted("hello   world\n\nfoo")).toBe("hello world foo")
  })

  it("truncates overly long text with an ellipsis", () => {
    const long = "x".repeat(200)
    const out = truncateQuoted(long, 10)
    expect(out.length).toBe(10)
    expect(out.endsWith("…")).toBe(true)
  })
})

describe("reaction-context: resolveReactedMessageText", () => {
  function mkPrisma(findFirst: jest.Mock) {
    return { message: { findFirst } } as any
  }

  it("returns the content of the reacted-to message (workspace-scoped query)", async () => {
    const findFirst = jest.fn().mockResolvedValue({ content: "Confirm order €30?" })
    const prisma = mkPrisma(findFirst)

    const text = await resolveReactedMessageText(prisma, "ws1", "wamid.A1")

    expect(text).toBe("Confirm order €30?")
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { whatsappMessageId: "wamid.A1", chatSession: { workspaceId: "ws1" } },
      })
    )
  })

  it("returns null when the message is not found", async () => {
    const prisma = mkPrisma(jest.fn().mockResolvedValue(null))
    expect(await resolveReactedMessageText(prisma, "ws1", "missing")).toBeNull()
  })

  it("never throws — returns null on a DB error", async () => {
    const prisma = mkPrisma(jest.fn().mockRejectedValue(new Error("db down")))
    await expect(resolveReactedMessageText(prisma, "ws1", "x")).resolves.toBeNull()
  })
})

describe("reaction-context: buildReactionText", () => {
  it("returns emoji-only when the provider gave no reacted message id", async () => {
    const prisma = { message: { findFirst: jest.fn() } } as any
    const out = await buildReactionText(prisma, "ws1", { emoji: "👍", messageId: null })
    expect(out).toBe("👍")
    expect(prisma.message.findFirst).not.toHaveBeenCalled()
  })

  it("composes emoji + original when the reacted message resolves", async () => {
    const prisma = {
      message: { findFirst: jest.fn().mockResolvedValue({ content: "Confirm order €30?" }) },
    } as any
    const out = await buildReactionText(prisma, "ws1", { emoji: "👍", messageId: "wamid.A1" })
    expect(out).toBe('👍 → "Confirm order €30?"')
  })

  it("degrades to emoji-only when the reacted message can't be found", async () => {
    const prisma = { message: { findFirst: jest.fn().mockResolvedValue(null) } } as any
    const out = await buildReactionText(prisma, "ws1", { emoji: "❤️", messageId: "gone" })
    expect(out).toBe("❤️")
  })
})
