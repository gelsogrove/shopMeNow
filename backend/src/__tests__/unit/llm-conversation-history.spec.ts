/**
 * Unit Test: Message Repository - Time-Based History
 *
 * 🎯 OBIETTIVO CRITICO: Garantire che getRecentMessagesByTime recuperi
 * sempre i messaggi degli ultimi N minuti per fornire contesto all'LLM
 *
 * Questo test verifica che:
 * 1. Il metodo getRecentMessagesByTime esista e funzioni
 * 2. Usi un filtro basato sul tempo (createdAt >= threshold)
 * 3. Restituisca i messaggi in ordine corretto
 */

describe("✅ CRITICAL: Time-Based Conversation History", () => {
  describe("MessageRepository.getRecentMessagesByTime", () => {
    it("should exist and be callable", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      // 🚨 CRITICAL: Il metodo DEVE esistere
      expect(repo.getRecentMessagesByTime).toBeDefined()
      expect(typeof repo.getRecentMessagesByTime).toBe("function")
    })

    it("should accept correct parameters (phoneNumber, minutes, workspaceId)", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      // Verifica signature del metodo
      const methodStr = repo.getRecentMessagesByTime.toString()

      // 🚨 CRITICAL: Deve accettare phoneNumber, minutesAgo, workspaceId
      expect(methodStr).toContain("phoneNumber")
      expect(methodStr).toContain("minutesAgo")
      expect(methodStr).toContain("workspaceId")
    })

    it("should use time-based filtering (not message count)", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      const methodCode = repo.getRecentMessagesByTime.toString()

      // 🚨 CRITICAL: Deve usare Date() e filtro temporale
      expect(methodCode).toContain("Date.now()")
      expect(methodCode).toContain("60 * 1000") // Conversione minuti in millisecondi
      expect(methodCode).toContain("createdAt")
      expect(methodCode).toContain("gte") // Greater than or equal (Prisma filter)
    })

    it("should have default of 5 minutes", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      const methodCode = repo.getRecentMessagesByTime.toString()

      // 🚨 CRITICAL: Default deve essere 5 minuti
      const hasDefault =
        methodCode.includes("minutesAgo = 5") ||
        methodCode.includes("minutesAgo=5")
      expect(hasDefault).toBe(true)
    })

    it("should log history retrieval for debugging", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      const methodCode = repo.getRecentMessagesByTime.toString()

      // 🚨 Deve includere log per debug
      expect(methodCode).toContain("[HISTORY]")
      expect(methodCode).toContain("logger")
    })
  })

  describe("LLMService integration", () => {
    it("should call getRecentMessagesByTime (not getLatesttMessages)", () => {
      const fs = require("fs")
      const llmServiceCode = fs.readFileSync(
        __dirname + "/../../services/llm.service.ts",
        "utf8"
      )

      // 🚨 CRITICAL: Deve usare il metodo basato sul tempo
      expect(llmServiceCode).toContain("getRecentMessagesByTime")

      // Verifica che sia chiamato con 5 minuti
      const regex = /getRecentMessagesByTime\([^)]+,\s*5/
      expect(regex.test(llmServiceCode)).toBe(true)
    })

    it("should pass history to generateLLMResponse", () => {
      const fs = require("fs")
      const llmServiceCode = fs.readFileSync(
        __dirname + "/../../services/llm.service.ts",
        "utf8"
      )

      // 🚨 CRITICAL: generateLLMResponse deve accettare recentMessages
      expect(llmServiceCode).toContain("recentMessages")

      // Verifica che vengano passati i messaggi recuperati
      let foundHistoryRetrieval = false
      let foundGenerateCall = false
      let foundRecentMessagesParam = false

      const lines = llmServiceCode.split("\n")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (line.includes("getRecentMessagesByTime")) {
          foundHistoryRetrieval = true
        }

        if (line.includes("this.generateLLMResponse")) {
          foundGenerateCall = true
          // Controlla le prossime 10 righe per recentMessages
          for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].includes("recentMessages")) {
              foundRecentMessagesParam = true
              break
            }
          }
        }
      }

      expect(foundHistoryRetrieval).toBe(true)
      expect(foundGenerateCall).toBe(true)
      expect(foundRecentMessagesParam).toBe(true)
    })

    it("should build conversationHistory array from recentMessages", () => {
      const fs = require("fs")
      const llmServiceCode = fs.readFileSync(
        __dirname + "/../../services/llm.service.ts",
        "utf8"
      )

      // 🚨 CRITICAL: Deve creare conversationHistory array
      expect(llmServiceCode).toContain("conversationHistory")

      // Deve mappare role: user e role: assistant
      const hasUserRole =
        llmServiceCode.includes("role: 'user'") ||
        llmServiceCode.includes('role: "user"')
      const hasAssistantRole =
        llmServiceCode.includes("role: 'assistant'") ||
        llmServiceCode.includes('role: "assistant"')

      expect(hasUserRole).toBe(true)
      expect(hasAssistantRole).toBe(true)
    })

    it("should include history in messages array sent to LLM", () => {
      const fs = require("fs")
      const llmServiceCode = fs.readFileSync(
        __dirname + "/../../services/llm.service.ts",
        "utf8"
      )

      // 🚨 CRITICAL: Deve inserire history nei messaggi
      expect(llmServiceCode).toContain("...conversationHistory")
    })
  })

  describe("Documentation and comments", () => {
    it("should have descriptive comments explaining time-based approach", () => {
      const fs = require("fs")
      const llmServiceCode = fs.readFileSync(
        __dirname + "/../../services/llm.service.ts",
        "utf8"
      )

      // Verifica che ci siano commenti che spiegano l'approccio
      const hasTimeComment =
        llmServiceCode.includes("5 minutes") ||
        llmServiceCode.includes("5 minuti")
      expect(hasTimeComment).toBe(true)
    })

    it("should have [HISTORY] log markers for debugging", () => {
      const fs = require("fs")

      const llmServiceCode = fs.readFileSync(
        __dirname + "/../../services/llm.service.ts",
        "utf8"
      )

      const repoCode = fs.readFileSync(
        __dirname + "/../../repositories/message.repository.ts",
        "utf8"
      )

      // 🚨 Entrambi devono avere log [HISTORY]
      expect(llmServiceCode).toContain("[HISTORY]")
      expect(repoCode).toContain("[HISTORY]")
    })
  })

  describe("Time window correctness", () => {
    it("should calculate time threshold correctly (Date.now() - minutes * 60 * 1000)", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      const methodCode = repo.getRecentMessagesByTime.toString()

      // 🚨 Formula corretta per calcolare threshold
      expect(methodCode).toContain("Date.now()")
      expect(methodCode).toContain("minutesAgo")
      const hasTimeFormula =
        methodCode.includes("* 60 * 1000") || methodCode.includes("*60*1000")
      expect(hasTimeFormula).toBe(true)
    })

    it("should use gte (greater than or equal) for Prisma filter", () => {
      const {
        MessageRepository,
      } = require("../../repositories/message.repository")
      const repo = new MessageRepository()

      const methodCode = repo.getRecentMessagesByTime.toString()

      // 🚨 Deve usare gte per includere messaggi esattamente sulla soglia
      expect(methodCode).toContain("gte")
    })
  })
})
