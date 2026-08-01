/**
 * Workspace custom-chatbot field round-trip
 *
 * Andrea 2026-08-02: "Max Reply Length: metto 2500, ricarico, mi dà 800".
 *
 * The value WAS being saved — production had customChatbotMaxTokens = 2500 —
 * but `customChatbotMaxTokens` was missing from the WorkspaceEntity props, its
 * getter, the repository mapping and all four controller responses. So the API
 * never returned it, the Settings form received undefined, and the input fell
 * back to its 800 placeholder. A silent read-path hole, not a write bug.
 *
 * Its sibling `customChatbotTemperature` was wired everywhere, which is what
 * made the gap easy to miss by eye. These tests therefore assert PARITY: every
 * layer that carries one of these settings must carry all of them. A future
 * field added to only half the stack fails here instead of in production.
 */
import fs from "fs"
import path from "path"

const BACKEND_SRC = path.join(__dirname, "..", "..", "src")

const read = (relativePath: string) =>
  fs.readFileSync(path.join(BACKEND_SRC, relativePath), "utf8")

// Settings the Settings UI writes and the chatbot runtime consumes. Each must
// survive the full round trip: DB → repository → entity → controller → UI.
const CUSTOM_CHATBOT_SETTINGS = [
  "customChatbotModel",
  "customChatbotTemperature",
  "customChatbotMaxTokens",
  "customChatbotOperatorEmail",
  "customChatbotEmailFrom",
  "customChatbotEmailSubjectPrefix",
]

describe("Workspace custom-chatbot settings round-trip", () => {
  describe("WorkspaceEntity", () => {
    const entity = read("domain/entities/workspace.entity.ts")

    it.each(CUSTOM_CHATBOT_SETTINGS)("declares %s in its props", (field) => {
      expect(entity).toMatch(new RegExp(`${field}\\?:`))
    })

    it.each(CUSTOM_CHATBOT_SETTINGS)("exposes a getter for %s", (field) => {
      // Without the getter the controller silently reads undefined.
      expect(entity).toMatch(new RegExp(`get ${field}\\(`))
    })
  })

  describe("WorkspaceRepository", () => {
    const repository = read("repositories/workspace.repository.ts")

    it.each(CUSTOM_CHATBOT_SETTINGS)("maps %s back out of the database row", (field) => {
      expect(repository).toContain(`${field}: workspace.${field}`)
    })
  })

  describe("WorkspaceController", () => {
    const controller = read("interfaces/http/controllers/workspace.controller.ts")

    it.each(CUSTOM_CHATBOT_SETTINGS)("returns %s to the frontend", (field) => {
      expect(controller).toContain(`${field}: workspace.${field}`)
    })

    it("returns every setting from the SAME number of endpoints", () => {
      // The controller builds its workspace payload in several places (get,
      // list, update, …). A field present in only some of them reloads
      // correctly on one screen and resets on another — exactly the reported
      // bug, where maxTokens appeared in 0 responses and temperature in 4.
      const occurrences = CUSTOM_CHATBOT_SETTINGS.map(
        (field) => controller.split(`${field}: workspace.${field}`).length - 1
      )

      expect(Math.min(...occurrences)).toBeGreaterThan(0)
      expect(new Set(occurrences).size).toBe(1)
    })
  })
})
