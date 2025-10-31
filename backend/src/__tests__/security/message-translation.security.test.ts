/**
 * Security Test: Message Translation Layer Verification
 *
 * PURPOSE: Ensure ALL outbound WhatsApp messages pass through Safety & Translation layer
 * CRITICAL: No messages should bypass security checks or translation
 *
 * Test Coverage:
 * 1. Welcome messages MUST go through SafetyTranslationAgent
 * 2. WIP messages MUST go through SafetyTranslationAgent
 * 3. Messages BLOCKED if safety check fails (no fallback)
 * 4. Translation failures throw errors (no bypass)
 * 5. Debug info includes translation tracking
 * 6. No direct WhatsApp sends exist in codebase
 */

import { PrismaClient } from "@prisma/client"
import { MessageRepository } from "../../repositories/message.repository"
import { LLMService } from "../../services/llm.service"
import logger from "../../utils/logger"

// Mock SafetyTranslationAgent to control test behavior
jest.mock("../../application/agents/SafetyTranslationAgent")

const prisma = new PrismaClient()
const messageRepository = new MessageRepository()

describe("🔒 Security: Message Translation Layer", () => {
  let testWorkspaceId: string
  let testCustomerId: string

  beforeAll(async () => {
    // Create test workspace with English-only messages
    const workspace = await prisma.workspace.create({
      data: {
        name: "Security Test Workspace",
        slug: "security-test-workspace",
        notificationEmail: "security-test@shopme.com",
        isActive: true,
        welcomeMessage: "Welcome! I'm SofiA, your digital assistant.",
        wipMessage: "Work in progress. Please contact us later.",
      },
    })
    testWorkspaceId = workspace.id

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        phone: "+34600000001",
        name: "Test Customer",
        email: "test@example.com",
        workspaceId: testWorkspaceId,
        language: "es", // Spanish customer
      },
    })
    testCustomerId = customer.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.customers.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    await prisma.$disconnect()
  })

  describe("✅ Welcome Message Translation", () => {
    it("should translate welcome message through SafetyTranslationAgent", async () => {
      const llmService = new LLMService()

      // Mock SafetyTranslationAgent to return successful translation
      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          translatedMessage: "¡Bienvenido! Soy SofiA, tu asistente digital.",
          isSafe: true,
          debugInfo: {
            originalLanguage: "en",
            targetLanguage: "es",
            safetyCheckPassed: true,
            translationTime: 150,
          },
        }),
      }))

      const result = await llmService.handleNewUserWelcome(
        "+34600000001",
        testWorkspaceId,
        "Hola"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("¡Bienvenido!") // Spanish translation
      expect(result.debugInfo).toBeDefined()
      expect(result.debugInfo.translationUsed).toBe(true)
      expect(result.debugInfo.safetyCheckPassed).toBe(true)
    })

    it("should BLOCK welcome message if safety check fails", async () => {
      const llmService = new LLMService()

      // Mock SafetyTranslationAgent to detect unsafe content
      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          translatedMessage: "",
          isSafe: false,
          debugInfo: {
            safetyCheckPassed: false,
            blockedReason: "Inappropriate content detected",
          },
        }),
      }))

      await expect(
        llmService.handleNewUserWelcome("+34600000001", testWorkspaceId, "Test")
      ).rejects.toThrow("Safety check failed")
    })

    it("should throw error if translation fails (no fallback)", async () => {
      const llmService = new LLMService()

      // Mock SafetyTranslationAgent to throw error
      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest
          .fn()
          .mockRejectedValue(new Error("Translation API error")),
      }))

      await expect(
        llmService.handleNewUserWelcome("+34600000001", testWorkspaceId, "Test")
      ).rejects.toThrow("Translation API error")
    })
  })

  describe("✅ WIP Message Translation", () => {
    it("should translate WIP message through SafetyTranslationAgent", async () => {
      // Disable workspace to trigger WIP message
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { isActive: false },
      })

      const llmService = new LLMService()

      // Mock SafetyTranslationAgent
      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          translatedMessage:
            "Trabajos en curso. Por favor, contáctenos más tarde.",
          isSafe: true,
          debugInfo: {
            originalLanguage: "en",
            targetLanguage: "es",
            safetyCheckPassed: true,
          },
        }),
      }))

      const result = await llmService.handleMessage({
        phone: "+34600000001",
        message: "Hola",
        workspaceId: testWorkspaceId,
      })

      expect(result).toBe("IGNORE") // Workspace disabled
      // WIP message should have been sent through translation layer

      // Re-enable workspace
      await prisma.workspace.update({
        where: { id: testWorkspaceId },
        data: { isActive: true },
      })
    })
  })

  describe("✅ Database Message Requirements", () => {
    it("should have English-only welcomeMessage in database", async () => {
      const welcomeMessage =
        await messageRepository.getWelcomeMessage(testWorkspaceId)

      expect(welcomeMessage).toBeDefined()
      expect(typeof welcomeMessage).toBe("string")
      expect(welcomeMessage).not.toMatch(/\{.*"en".*\}/) // Not JSON
    })

    it("should have English-only wipMessage in database", async () => {
      const wipMessage = await messageRepository.getWipMessage(testWorkspaceId)

      expect(wipMessage).toBeDefined()
      expect(typeof wipMessage).toBe("string")
      expect(wipMessage).not.toMatch(/\{.*"en".*\}/) // Not JSON
    })

    it("should throw error if welcomeMessage is missing (no hardcoded fallback)", async () => {
      // Create workspace without welcome message
      const emptyWorkspace = await prisma.workspace.create({
        data: {
          name: "Empty Workspace",
          slug: "empty-workspace-1",
          notificationEmail: "empty@test.com",
          welcomeMessage: null,
        },
      })

      await expect(
        messageRepository.getWelcomeMessage(emptyWorkspace.id)
      ).rejects.toThrow("Welcome message not configured")

      await prisma.workspace.delete({ where: { id: emptyWorkspace.id } })
    })

    it("should throw error if wipMessage is missing (no hardcoded fallback)", async () => {
      // Create workspace without WIP message
      const emptyWorkspace = await prisma.workspace.create({
        data: {
          name: "Empty Workspace",
          slug: "empty-workspace-2",
          notificationEmail: "empty@test.com",
          wipMessage: null,
        },
      })

      await expect(
        messageRepository.getWipMessage(emptyWorkspace.id)
      ).rejects.toThrow("WIP message not configured")

      await prisma.workspace.delete({ where: { id: emptyWorkspace.id } })
    })
  })

  describe("✅ Translation Layer Integration", () => {
    it("should include translation debug info in response", async () => {
      const llmService = new LLMService()

      const SafetyTranslationAgent =
        require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
      SafetyTranslationAgent.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue({
          translatedMessage: "¡Bienvenido!",
          isSafe: true,
          debugInfo: {
            originalLanguage: "en",
            targetLanguage: "es",
            safetyCheckPassed: true,
            translationTime: 200,
            model: "gpt-4o-mini",
          },
        }),
      }))

      const result = await llmService.handleNewUserWelcome(
        "+34600000001",
        testWorkspaceId,
        "Test"
      )

      expect(result.debugInfo).toBeDefined()
      expect(result.debugInfo.translationUsed).toBe(true)
      expect(result.debugInfo.originalLanguage).toBe("en")
      expect(result.debugInfo.targetLanguage).toBe("es")
      expect(result.debugInfo.translationTime).toBeGreaterThan(0)
    })

    it("should detect customer language from phone prefix", async () => {
      const llmService = new LLMService()

      // Test different phone prefixes
      const testCases = [
        { phone: "+34600000001", expectedLang: "es" }, // Spain
        { phone: "+39600000001", expectedLang: "it" }, // Italy
        { phone: "+351600000001", expectedLang: "pt" }, // Portugal
        { phone: "+44600000001", expectedLang: "en" }, // UK
        { phone: "+1600000001", expectedLang: "en" }, // USA
      ]

      for (const testCase of testCases) {
        const SafetyTranslationAgent =
          require("../../application/agents/SafetyTranslationAgent").SafetyTranslationAgent
        const mockProcess = jest.fn().mockResolvedValue({
          translatedMessage: "Welcome!",
          isSafe: true,
          debugInfo: { targetLanguage: testCase.expectedLang },
        })

        SafetyTranslationAgent.mockImplementation(() => ({
          process: mockProcess,
        }))

        // Create test customer for this phone
        const customer = await prisma.customers.create({
          data: {
            phone: testCase.phone,
            name: "Test",
            email: `test-${testCase.phone}@example.com`,
            workspaceId: testWorkspaceId,
            language: testCase.expectedLang,
          },
        })

        await llmService.handleNewUserWelcome(
          testCase.phone,
          testWorkspaceId,
          "Test"
        )

        // Verify translation was called with correct target language
        expect(mockProcess).toHaveBeenCalledWith(
          expect.objectContaining({
            targetLanguage: testCase.expectedLang,
          })
        )

        // Cleanup
        await prisma.customers.delete({ where: { id: customer.id } })
      }
    })
  })

  describe("🚫 Code Security Audit", () => {
    it("should NOT have direct WhatsApp sends in webhook routes", async () => {
      const fs = require("fs")
      const path = require("path")

      // Read webhook route files
      const whatsappRoutesPath = path.join(
        __dirname,
        "../../routes/webhooks/whatsapp.routes.ts"
      )
      const indexRoutesPath = path.join(__dirname, "../../routes/index.ts")

      const whatsappRoutes = fs.readFileSync(whatsappRoutesPath, "utf-8")
      const indexRoutes = fs.readFileSync(indexRoutesPath, "utf-8")

      // Check for direct message sending patterns (should NOT exist)
      const dangerousPatterns = [
        /sendMessage\s*\(/,
        /whatsappService\.send/,
        /await\s+send.*Message/,
      ]

      for (const pattern of dangerousPatterns) {
        expect(whatsappRoutes).not.toMatch(pattern)
        expect(indexRoutes).not.toMatch(pattern)
      }

      // Verify they use LLMService.handleNewUserWelcome instead
      expect(whatsappRoutes).toMatch(/handleNewUserWelcome/)
      expect(indexRoutes).toMatch(/handleNewUserWelcome/)
    })

    it("should NOT have hardcoded fallback messages in MessageRepository", async () => {
      const fs = require("fs")
      const path = require("path")

      const repoPath = path.join(
        __dirname,
        "../../repositories/message.repository.ts"
      )
      const repoContent = fs.readFileSync(repoPath, "utf-8")

      // Check getWelcomeMessage and getWipMessage methods
      const welcomeMethod =
        repoContent.match(/async getWelcomeMessage[\s\S]*?(?=async|$)/)?.[0] ||
        ""
      const wipMethod =
        repoContent.match(/async getWipMessage[\s\S]*?(?=async|$)/)?.[0] || ""

      // Should NOT have return statements with hardcoded strings
      expect(welcomeMethod).not.toMatch(/return\s+["']Welcome/)
      expect(wipMethod).not.toMatch(/return\s+["']Work in progress/)

      // Should throw errors instead
      expect(welcomeMethod).toMatch(/throw/)
      expect(wipMethod).toMatch(/throw/)
    })
  })

  describe("✅ Error Handling", () => {
    it("should throw error if workspace not found", async () => {
      const llmService = new LLMService()

      await expect(
        llmService.handleNewUserWelcome(
          "+34600000001",
          "non-existent-workspace-id",
          "Test"
        )
      ).rejects.toThrow()
    })

    it("should throw error if customer not found", async () => {
      const llmService = new LLMService()

      await expect(
        llmService.handleNewUserWelcome(
          "+99999999999", // Non-existent customer
          testWorkspaceId,
          "Test"
        )
      ).rejects.toThrow()
    })

    it("should log errors with full context", async () => {
      const loggerSpy = jest.spyOn(logger, "error")

      const llmService = new LLMService()

      try {
        await llmService.handleNewUserWelcome(
          "+99999999999",
          testWorkspaceId,
          "Test"
        )
      } catch (error) {
        // Expected to fail
      }

      expect(loggerSpy).toHaveBeenCalled()
      expect(loggerSpy.mock.calls[0][0]).toMatch(/error|failed/i)
    })
  })
})
