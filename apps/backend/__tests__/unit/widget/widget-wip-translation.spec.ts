/**
 * 🎯 TEST: Widget WIP Message Translation
 *
 * SCENARIO: When workspace is in debugMode (WIP), the widget must translate
 * the WIP message using TranslationAgent — same translation pipeline as WhatsApp.
 *
 * KEY RULE: Widget and WhatsApp must have IDENTICAL translation behavior.
 * The translateWipMessage() private method delegates to TranslationAgent.process().
 *
 * 📚 WHAT WE TEST:
 * 1. WIP message (JSON object) → extracts English text → translates to customer language
 * 2. WIP message (plain string) → translates directly
 * 3. TranslationAgent failure → graceful fallback to raw text
 * 4. Null/undefined WIP message → uses hardcoded English fallback
 * 5. Default targetLanguage when none specified → "ENG" (English system default)
 */

import { TranslationAgent, TranslationResult, ProcessOptions } from "../../../src/application/agents/TranslationAgent"

// ---- Mocks ----

jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// Mock TranslationAgent
const mockProcess = jest.fn()
jest.mock("../../../src/application/agents/TranslationAgent", () => ({
  TranslationAgent: jest.fn().mockImplementation(() => ({
    process: mockProcess,
  })),
}))

// ---- Tests ----

describe("Widget WIP Translation", () => {
  /**
   * Helper: simulates the translateWipMessage() private method logic
   * from WidgetChatController. We test the logic directly rather than
   * going through HTTP, since WidgetChatController's constructor has
   * many dependencies.
   */
  async function translateWipMessage(
    rawMessage: Record<string, string> | string | null | undefined,
    targetLanguage: string | null,
    workspaceId: string
  ): Promise<string> {
    const rawText =
      typeof rawMessage === "string"
        ? rawMessage
        : typeof rawMessage === "object" && rawMessage !== null
          ? (rawMessage as Record<string, string>).en ||
            (rawMessage as Record<string, string>).it ||
            Object.values(rawMessage as Record<string, string>)[0] ||
            "Work in progress. Please contact us later."
          : "Work in progress. Please contact us later."

    try {
      const translationResult = await mockProcess({
        workspaceId,
        message: rawText,
        targetLanguage: targetLanguage || "ENG",
        customerName: "Customer",
        customerId: undefined,
        channel: "widget",
      })
      return translationResult.message || rawText
    } catch {
      return rawText
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("JSON WIP message extraction", () => {
    it("should extract English text from JSON wipMessage and translate", async () => {
      // SCENARIO: wipMessage is { en: "We're updating...", it: "Stiamo aggiornando..." }
      // RULE: Extract .en first, then translate to customer's language
      const wipMessage = { en: "We're updating the system", it: "Stiamo aggiornando il sistema" }

      mockProcess.mockResolvedValueOnce({
        translated: true,
        message: "Estamos actualizando el sistema",
        originalLanguage: "en",
        targetLanguage: "es",
      } as TranslationResult)

      const result = await translateWipMessage(wipMessage, "ESP", "ws-123")

      expect(result).toBe("Estamos actualizando el sistema")
      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-123",
          message: "We're updating the system", // .en extracted
          targetLanguage: "ESP",
          channel: "widget",
        })
      )
    })

    it("should fallback to .it when .en is missing", async () => {
      // SCENARIO: wipMessage only has Italian text
      const wipMessage = { it: "Stiamo aggiornando il sistema" }

      mockProcess.mockResolvedValueOnce({
        translated: true,
        message: "Estamos actualizando el sistema",
        originalLanguage: "it",
        targetLanguage: "es",
      } as TranslationResult)

      const result = await translateWipMessage(wipMessage, "ESP", "ws-123")

      expect(result).toBe("Estamos actualizando el sistema")
      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Stiamo aggiornando il sistema", // .it fallback
        })
      )
    })

    it("should use first available value when no .en or .it", async () => {
      // SCENARIO: wipMessage has only French text
      const wipMessage = { fr: "Mise à jour en cours" }

      mockProcess.mockResolvedValueOnce({
        translated: true,
        message: "Update in progress",
        originalLanguage: "fr",
        targetLanguage: "en",
      } as TranslationResult)

      const result = await translateWipMessage(wipMessage, "ENG", "ws-123")

      expect(result).toBe("Update in progress")
      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Mise à jour en cours", // first value from Object.values()
        })
      )
    })
  })

  describe("Plain string WIP message", () => {
    it("should translate plain string directly", async () => {
      // SCENARIO: wipMessage is a simple string, not JSON
      mockProcess.mockResolvedValueOnce({
        translated: true,
        message: "Wir aktualisieren das System",
        originalLanguage: "en",
        targetLanguage: "de",
      } as TranslationResult)

      const result = await translateWipMessage("We are updating the system", "DEU", "ws-123")

      expect(result).toBe("Wir aktualisieren das System")
      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "We are updating the system",
          targetLanguage: "DEU",
        })
      )
    })
  })

  describe("Default language fallback", () => {
    it("should default to ENG when no targetLanguage specified", async () => {
      // SCENARIO: Customer has no language set → default to English
      // RULE: System default language is English
      mockProcess.mockResolvedValueOnce({
        translated: false,
        message: "Work in progress",
        originalLanguage: "en",
        targetLanguage: "en",
      } as TranslationResult)

      const result = await translateWipMessage("Work in progress", null, "ws-123")

      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          targetLanguage: "ENG", // Default when null
        })
      )
    })
  })

  describe("Null/undefined WIP message", () => {
    it("should use hardcoded English fallback for null wipMessage", async () => {
      // SCENARIO: Workspace has no wipMessage configured
      // RULE: Fallback text is in English (system default)
      mockProcess.mockResolvedValueOnce({
        translated: true,
        message: "Lavori in corso. Contattaci più tardi.",
        originalLanguage: "en",
        targetLanguage: "it",
      } as TranslationResult)

      const result = await translateWipMessage(null, "ITA", "ws-123")

      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Work in progress. Please contact us later.",
        })
      )
    })

    it("should use hardcoded English fallback for undefined wipMessage", async () => {
      mockProcess.mockResolvedValueOnce({
        translated: false,
        message: "Work in progress. Please contact us later.",
        originalLanguage: "en",
        targetLanguage: "en",
      } as TranslationResult)

      const result = await translateWipMessage(undefined, "ENG", "ws-123")

      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Work in progress. Please contact us later.",
        })
      )
    })

    it("should use hardcoded English fallback for empty JSON object", async () => {
      mockProcess.mockResolvedValueOnce({
        translated: false,
        message: "Work in progress. Please contact us later.",
        originalLanguage: "en",
        targetLanguage: "en",
      } as TranslationResult)

      const result = await translateWipMessage({} as Record<string, string>, "ENG", "ws-123")

      expect(mockProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Work in progress. Please contact us later.",
        })
      )
    })
  })

  describe("TranslationAgent failure — graceful degradation", () => {
    it("should return raw text when TranslationAgent throws", async () => {
      // SCENARIO: LLM/OpenRouter API fails
      // RULE: Never crash — return untranslated text as fallback
      mockProcess.mockRejectedValueOnce(new Error("OpenRouter API timeout"))

      const result = await translateWipMessage("System update in progress", "ESP", "ws-123")

      // Fallback: raw text returned (no crash)
      expect(result).toBe("System update in progress")
    })

    it("should return raw text when TranslationAgent returns null message", async () => {
      // SCENARIO: TranslationAgent returns { message: null }
      mockProcess.mockResolvedValueOnce({
        translated: false,
        message: null,
        originalLanguage: "en",
        targetLanguage: "es",
      })

      const result = await translateWipMessage("System is updating", "ESP", "ws-123")

      // Fallback: raw text because result.message is falsy
      expect(result).toBe("System is updating")
    })
  })
})
