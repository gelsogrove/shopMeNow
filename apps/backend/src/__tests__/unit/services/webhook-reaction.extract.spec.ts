/**
 * Unit tests — webhook reaction extraction (pure, no I/O).
 *
 * WHAT: a WhatsApp reaction (long-press emoji) arrives as its own message kind
 * and carries the id of the message it reacted to. These parsers must return
 * { emoji, messageId } for a live reaction, and null for a removed reaction
 * (empty emoji) or a non-reaction message.
 * WHY: the emoji (plus the reacted-to message) is fed to the LLM (rule #14 — no
 * hardcoded emoji→intent mapping), so wrong parsing = the reaction is lost or a
 * normal message is mis-read.
 */

import {
  extractMetaReaction,
  extractUltramsgReaction,
  extractWasenderReaction,
} from "../../../services/webhook-reaction.extract"

describe("webhook reaction extraction", () => {
  describe("Meta", () => {
    it("returns emoji + reacted message id", () => {
      expect(
        extractMetaReaction({ type: "reaction", reaction: { message_id: "wamid.A1", emoji: "👍" } })
      ).toEqual({ emoji: "👍", messageId: "wamid.A1" })
    })

    it("returns messageId null when the id is absent", () => {
      expect(extractMetaReaction({ type: "reaction", reaction: { emoji: "👍" } })).toEqual({
        emoji: "👍",
        messageId: null,
      })
    })

    it("returns null when the reaction was removed (empty emoji)", () => {
      expect(
        extractMetaReaction({ type: "reaction", reaction: { message_id: "m1", emoji: "" } })
      ).toBeNull()
    })

    it("returns null for a non-reaction message", () => {
      expect(extractMetaReaction({ type: "text", text: { body: "ciao" } })).toBeNull()
    })
  })

  describe("UltraMsg", () => {
    it("returns the emoji from the reaction field (messageId null — not exposed)", () => {
      expect(extractUltramsgReaction({ type: "reaction", reaction: "❤️" })).toEqual({
        emoji: "❤️",
        messageId: null,
      })
    })

    it("falls back to body when reaction field is absent", () => {
      expect(extractUltramsgReaction({ type: "reaction", body: "🔥" })).toEqual({
        emoji: "🔥",
        messageId: null,
      })
    })

    it("picks up a reference id when the payload happens to carry one", () => {
      expect(
        extractUltramsgReaction({ type: "reaction", reaction: "🔥", referenceId: "ref-1" })
      ).toEqual({ emoji: "🔥", messageId: "ref-1" })
    })

    it("returns null for a chat message", () => {
      expect(extractUltramsgReaction({ type: "chat", body: "hello" })).toBeNull()
    })
  })

  describe("Wasender", () => {
    it("returns emoji + reacted message id from reactionMessage", () => {
      expect(
        extractWasenderReaction({
          message: { reactionMessage: { text: "😂", key: { id: "m1" } } },
        })
      ).toEqual({ emoji: "😂", messageId: "m1" })
    })

    it("returns null when the reaction was removed (empty text)", () => {
      expect(
        extractWasenderReaction({ message: { reactionMessage: { text: "", key: { id: "m1" } } } })
      ).toBeNull()
    })

    it("returns null for a plain text message", () => {
      expect(extractWasenderReaction({ message: { conversation: "hi" } })).toBeNull()
    })
  })
})
