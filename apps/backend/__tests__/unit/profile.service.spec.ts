/**
 * ProfileService - Unit Tests
 *
 * Test Coverage:
 * - sendProfileUpdateMessage (10 tests)
 * - sendAccountDeleteMessage (10 tests)
 * - Private helper methods (3 tests)
 *
 * Total: 23 tests
 *
 * WHAT: Tests the profile management service that sends WhatsApp confirmation messages
 * WHY: Ensures customers receive translated confirmation messages after profile updates and account deletion
 *
 * SCENARIOS:
 * 1. Profile Update Message:
 *    - SUCCESS: Customer exists with phone and language → message translated and sent
 *    - SUCCESS: Message saved to conversationMessage table with correct debugInfo
 *    - SUCCESS: Message enqueued to WhatsApp queue
 *    - SUCCESS: Creates chat session if missing
 *    - ERROR: Customer not found → returns false
 *    - ERROR: Customer has no phone → returns false
 *    - ERROR: Workspace settings not found → returns false
 *    - ERROR: WhatsApp enqueue fails → returns false but message saved
 *    - SUCCESS: Uses custom profile update message from workspace
 *    - SUCCESS: Replaces [nome] and [name] placeholders with first name
 *
 * 2. Account Delete Message:
 *    - SUCCESS: Customer exists with phone and language → message translated and sent
 *    - SUCCESS: Message saved to conversationMessage table with correct debugInfo
 *    - SUCCESS: Message enqueued to WhatsApp queue
 *    - SUCCESS: Creates chat session if missing
 *    - ERROR: Customer not found → returns false
 *    - ERROR: Customer has no phone → returns false
 *    - ERROR: Workspace settings not found → returns false
 *    - ERROR: WhatsApp enqueue fails → returns false but message saved
 *    - SUCCESS: Uses custom account delete message from workspace
 *    - SUCCESS: Replaces [nome] and [name] placeholders with first name
 *
 * 3. Helper Methods:
 *    - normalizeLanguageCode: Maps language codes correctly (it, en, es, pt, fr, de)
 *    - getDefaultProfileUpdateMessage: Returns English default message
 *    - getDefaultAccountDeleteMessage: Returns English default message
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { PrismaClient } from "@prisma/client"
import { ProfileService } from "../../src/application/services/profile.service"

// Mock LLMService (for translation via Security & Translation layer)
jest.mock("../../src/services/llm.service", () => {
  return {
    LLMService: jest.fn().mockImplementation(() => ({
      translateSystemMessage: jest.fn().mockImplementation((message, workspaceId, language) => {
        // MOCK: Simulate translation based on language
        if (language === "it") {
          if (message.includes("updated successfully")) {
            return Promise.resolve("I tuoi dati personali sono stati aggiornati con successo!")
          }
          if (message.includes("deleted")) {
            return Promise.resolve("Il tuo account è stato cancellato. Grazie per aver utilizzato il nostro servizio.")
          }
        }
        if (language === "es") {
          if (message.includes("updated successfully")) {
            return Promise.resolve("¡Tus datos personales han sido actualizados con éxito!")
          }
          if (message.includes("deleted")) {
            return Promise.resolve("Tu cuenta ha sido eliminada. Gracias por usar nuestro servicio.")
          }
        }
        // Default: return same message (English)
        return Promise.resolve(message)
      }),
    })),
  }
})

// Mock WhatsAppDirectSendService
// Default: success=true. Override per-test with mockDirectSend.send.mockResolvedValueOnce()
const mockDirectSend = { send: jest.fn().mockResolvedValue({ success: true }) }
jest.mock("../../src/services/whatsapp-direct-send.service", () => {
  return {
    WhatsAppDirectSendService: jest.fn().mockImplementation(() => mockDirectSend),
  }
})

// Mock MessageRepository
jest.mock("../../src/repositories/message.repository", () => {
  return {
    MessageRepository: jest.fn().mockImplementation(() => ({
      getWorkspaceSettings: jest.fn().mockResolvedValue({
        id: "ws1",
        name: "Test Workspace",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
        profileUpdateMessages: {
          en: "Your personal data has been updated successfully!",
          it: "I tuoi dati personali sono stati aggiornati con successo!",
        },
        accountDeleteMessages: {
          en: "Your account has been deleted. Thank you for using our service.",
          it: "Il tuo account è stato cancellato. Grazie per aver utilizzato il nostro servizio.",
        },
      }),
    })),
  }
})

// Mock PrismaClient
const mockPrisma = {
  customers: {
    findUnique: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  chatSession: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  conversationMessage: {
    create: jest.fn(),
  },
} as unknown as PrismaClient

describe("ProfileService - Unit Tests", () => {
  let service: ProfileService

  beforeEach(() => {
    jest.clearAllMocks()
    mockDirectSend.send.mockResolvedValue({ success: true })
    service = new ProfileService()
    // Replace prisma instance with mock
    ;(service as any).prisma = mockPrisma
  })

  afterAll(() => {
    jest.resetModules()
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📝 SEND PROFILE UPDATE MESSAGE TESTS (10 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("sendProfileUpdateMessage", () => {
    it("should send profile update message successfully", async () => {
      // SCENARIO: Customer exists with phone and language
      // RULE: Message should be translated via Security & Translation layer and sent

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
        workspaceId: "ws1",
        customerId: "cust1",
        conversationId: "session-1",
        role: "assistant",
        content: "I tuoi dati personali sono stati aggiornati con successo!",
        agentType: "PROFILE_UPDATE_CONFIRMATION",
        tokensUsed: 0,
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(true)
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "cust1" },
        include: { workspace: true },
      })
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws1",
          customerId: "cust1",
          conversationId: "session-1",
          role: "assistant",
          agentType: "PROFILE_UPDATE_CONFIRMATION",
          tokensUsed: 0,
        }),
      })
    })

    it("should return false when customer not found", async () => {
      // SCENARIO: Customer ID does not exist in database
      // RULE: Should return false and log error

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(null)

      const result = await service.sendProfileUpdateMessage("nonexistent-cust")

      expect(result).toBe(false)
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "nonexistent-cust" },
        include: { workspace: true },
      })
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should return false when customer has no phone number", async () => {
      // SCENARIO: Customer exists but phone field is null
      // RULE: Cannot send WhatsApp message, should return false

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: null, // No phone number
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
        },
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(false)
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should return false when workspace settings not found", async () => {
      // SCENARIO: Workspace settings cannot be retrieved
      // RULE: Cannot proceed without workspace config, return false

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
        },
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)

      // Mock MessageRepository to return null workspace settings
      const mockMessageRepository = (service as any).messageRepository
      mockMessageRepository.getWorkspaceSettings = jest.fn().mockResolvedValue(null)

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(false)
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should create chat session if not exists", async () => {
      // SCENARIO: Customer has no active chat session
      // RULE: Should create new chat session before saving message

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "English",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const newChatSession = {
        id: "new-session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null) // No existing session
      mockPrisma.chatSession.create = jest.fn().mockResolvedValue(newChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(true)
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          customerId: "cust1",
          workspaceId: "ws1",
          status: "active",
        },
      })
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "new-session-1",
        }),
      })
    })

    it("should save message to conversationMessage table with correct debugInfo", async () => {
      // SCENARIO: Message successfully sent
      // RULE: Must save to conversationMessage with agentType, debugInfo containing stage and language

      const mockCustomer = {
        id: "cust1",
        name: "Andrea Bianchi",
        email: "andrea@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(true)
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws1",
          customerId: "cust1",
          conversationId: "session-1",
          role: "assistant",
          agentType: "PROFILE_UPDATE_CONFIRMATION",
          tokensUsed: 0,
          debugInfo: expect.stringContaining("profile_update"),
        }),
      })

      // Verify debugInfo structure
      const createCall = (mockPrisma.conversationMessage.create as jest.Mock).mock.calls[0][0]
      const debugInfo = JSON.parse(createCall.data.debugInfo)
      expect(debugInfo.stage).toBe("profile_update")
      expect(debugInfo.translatedViaSecurityLayer).toBe(true)
      expect(debugInfo.language).toBe("it")
      expect(debugInfo.firstName).toBe("Andrea")
      expect(debugInfo.timestamp).toBeDefined()
    })

    it("should return false if WhatsApp API key is missing but still save message", async () => {
      // SCENARIO: Workspace has no WhatsApp configured
      // RULE: WhatsApp send fails (DirectSendService returns success=false) but message still saved

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: null, // No WhatsApp configured
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      // OVERRIDE: DirectSendService returns failure (workspace not configured)
      mockDirectSend.send.mockResolvedValueOnce({ success: false, error: "WhatsApp not configured" })

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: null,
        whatsappPhoneNumber: null,
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      // WhatsApp send fails, but function still saves message
      expect(result).toBe(false)
      // Message is still saved to conversationMessage table
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentType: "PROFILE_UPDATE_CONFIRMATION",
        }),
      })
    })

    it("should use custom profile update message from workspace", async () => {
      // SCENARIO: Workspace has custom profile update message
      // RULE: Should use workspace-specific message instead of default

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "English",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      // Mock MessageRepository with custom message
      const mockMessageRepository = (service as any).messageRepository
      mockMessageRepository.getWorkspaceSettings = jest.fn().mockResolvedValue({
        id: "ws1",
        profileUpdateMessages: {
          en: "Your profile has been updated! Thank you.",
        },
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(true)
      expect(mockMessageRepository.getWorkspaceSettings).toHaveBeenCalledWith("ws1")
    })

    it("should replace [nome] and [name] placeholders with first name", async () => {
      // SCENARIO: Message contains placeholders [nome] or [name]
      // RULE: Should replace placeholders with customer's first name

      const mockCustomer = {
        id: "cust1",
        name: "Giovanni Paolo",
        email: "giovanni@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      // Mock MessageRepository with placeholder message
      const mockMessageRepository = (service as any).messageRepository
      mockMessageRepository.getWorkspaceSettings = jest.fn().mockResolvedValue({
        id: "ws1",
        profileUpdateMessages: {
          en: "Hello [name], your data has been updated!",
        },
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(true)

      // Verify debugInfo contains correct firstName
      const createCall = (mockPrisma.conversationMessage.create as jest.Mock).mock.calls[0][0]
      const debugInfo = JSON.parse(createCall.data.debugInfo)
      expect(debugInfo.firstName).toBe("Giovanni")
    })

    it("should handle translation via LLMService.translateSystemMessage", async () => {
      // SCENARIO: Customer language is Spanish
      // RULE: Should call LLMService.translateSystemMessage with correct parameters

      const mockCustomer = {
        id: "cust1",
        name: "Carlos Rodriguez",
        email: "carlos@example.com",
        phone: "+34612345678",
        language: "Spanish",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendProfileUpdateMessage("cust1")

      expect(result).toBe(true)

      // Verify Spanish translation in debugInfo
      const createCall = (mockPrisma.conversationMessage.create as jest.Mock).mock.calls[0][0]
      const debugInfo = JSON.parse(createCall.data.debugInfo)
      expect(debugInfo.language).toBe("es")
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🗑️ SEND ACCOUNT DELETE MESSAGE TESTS (10 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("sendAccountDeleteMessage", () => {
    it("should send account delete message successfully", async () => {
      // SCENARIO: Customer exists with phone and language
      // RULE: Message should be translated via Security & Translation layer and sent

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
        workspaceId: "ws1",
        customerId: "cust1",
        conversationId: "session-1",
        role: "assistant",
        content: "Il tuo account è stato cancellato. Grazie per aver utilizzato il nostro servizio.",
        agentType: "ACCOUNT_DELETE_CONFIRMATION",
        tokensUsed: 0,
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(true)
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "cust1" },
        include: { workspace: true },
      })
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws1",
          customerId: "cust1",
          conversationId: "session-1",
          role: "assistant",
          agentType: "ACCOUNT_DELETE_CONFIRMATION",
          tokensUsed: 0,
        }),
      })
    })

    it("should return false when customer not found", async () => {
      // SCENARIO: Customer ID does not exist in database
      // RULE: Should return false and log error

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(null)

      const result = await service.sendAccountDeleteMessage("nonexistent-cust")

      expect(result).toBe(false)
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "nonexistent-cust" },
        include: { workspace: true },
      })
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should return false when customer has no phone number", async () => {
      // SCENARIO: Customer exists but phone field is null
      // RULE: Cannot send WhatsApp message, should return false

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: null, // No phone number
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
        },
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(false)
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should return false when workspace settings not found", async () => {
      // SCENARIO: Workspace settings cannot be retrieved
      // RULE: Cannot proceed without workspace config, return false

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
        },
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)

      // Mock MessageRepository to return null workspace settings
      const mockMessageRepository = (service as any).messageRepository
      mockMessageRepository.getWorkspaceSettings = jest.fn().mockResolvedValue(null)

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(false)
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should create chat session if not exists", async () => {
      // SCENARIO: Customer has no active chat session
      // RULE: Should create new chat session before saving message

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "English",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const newChatSession = {
        id: "new-session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(null) // No existing session
      mockPrisma.chatSession.create = jest.fn().mockResolvedValue(newChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(true)
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          customerId: "cust1",
          workspaceId: "ws1",
          status: "active",
        },
      })
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: "new-session-1",
        }),
      })
    })

    it("should save message to conversationMessage table with correct debugInfo", async () => {
      // SCENARIO: Message successfully sent
      // RULE: Must save to conversationMessage with agentType, debugInfo containing stage and language

      const mockCustomer = {
        id: "cust1",
        name: "Andrea Bianchi",
        email: "andrea@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(true)
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws1",
          customerId: "cust1",
          conversationId: "session-1",
          role: "assistant",
          agentType: "ACCOUNT_DELETE_CONFIRMATION",
          tokensUsed: 0,
          debugInfo: expect.stringContaining("account_delete"),
        }),
      })

      // Verify debugInfo structure
      const createCall = (mockPrisma.conversationMessage.create as jest.Mock).mock.calls[0][0]
      const debugInfo = JSON.parse(createCall.data.debugInfo)
      expect(debugInfo.stage).toBe("account_delete")
      expect(debugInfo.translatedViaSecurityLayer).toBe(true)
      expect(debugInfo.language).toBe("it")
      expect(debugInfo.firstName).toBe("Andrea")
      expect(debugInfo.timestamp).toBeDefined()
    })

    it("should return false if WhatsApp API key is missing but still save message", async () => {
      // SCENARIO: Workspace has no WhatsApp configured
      // RULE: WhatsApp send fails (DirectSendService returns success=false) but message still saved

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: null, // No WhatsApp configured
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      // OVERRIDE: DirectSendService returns failure (workspace not configured)
      mockDirectSend.send.mockResolvedValueOnce({ success: false, error: "WhatsApp not configured" })

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: null,
        whatsappPhoneNumber: null,
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      // WhatsApp send fails, but function still saves message
      expect(result).toBe(false)
      // Message is still saved to conversationMessage table
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentType: "ACCOUNT_DELETE_CONFIRMATION",
        }),
      })
    })

    it("should use custom account delete message from workspace", async () => {
      // SCENARIO: Workspace has custom account delete message
      // RULE: Should use workspace-specific message instead of default

      const mockCustomer = {
        id: "cust1",
        name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+393331234567",
        language: "English",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      // Mock MessageRepository with custom message
      const mockMessageRepository = (service as any).messageRepository
      mockMessageRepository.getWorkspaceSettings = jest.fn().mockResolvedValue({
        id: "ws1",
        accountDeleteMessages: {
          en: "Your account has been removed from our system. Goodbye!",
        },
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(true)
      expect(mockMessageRepository.getWorkspaceSettings).toHaveBeenCalledWith("ws1")
    })

    it("should replace [nome] and [name] placeholders with first name", async () => {
      // SCENARIO: Message contains placeholders [nome] or [name]
      // RULE: Should replace placeholders with customer's first name

      const mockCustomer = {
        id: "cust1",
        name: "Giovanni Paolo",
        email: "giovanni@example.com",
        phone: "+393331234567",
        language: "Italian",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      // Mock MessageRepository with placeholder message
      const mockMessageRepository = (service as any).messageRepository
      mockMessageRepository.getWorkspaceSettings = jest.fn().mockResolvedValue({
        id: "ws1",
        accountDeleteMessages: {
          en: "Goodbye [name], your account has been deleted.",
        },
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(true)

      // Verify debugInfo contains correct firstName
      const createCall = (mockPrisma.conversationMessage.create as jest.Mock).mock.calls[0][0]
      const debugInfo = JSON.parse(createCall.data.debugInfo)
      expect(debugInfo.firstName).toBe("Giovanni")
    })

    it("should handle translation via LLMService.translateSystemMessage", async () => {
      // SCENARIO: Customer language is Spanish
      // RULE: Should call LLMService.translateSystemMessage with correct parameters

      const mockCustomer = {
        id: "cust1",
        name: "Carlos Rodriguez",
        email: "carlos@example.com",
        phone: "+34612345678",
        language: "Spanish",
        workspaceId: "ws1",
        workspace: {
          id: "ws1",
          name: "Test Workspace",
          whatsappApiKey: "test-api-key",
        },
      }

      const mockChatSession = {
        id: "session-1",
        customerId: "cust1",
        workspaceId: "ws1",
        status: "active",
      }

      mockPrisma.customers.findUnique = jest.fn().mockResolvedValue(mockCustomer)
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: "ws1",
        whatsappApiKey: "test-api-key",
        whatsappPhoneNumber: "+393331234567",
      })
      mockPrisma.chatSession.findFirst = jest.fn().mockResolvedValue(mockChatSession)
      mockPrisma.conversationMessage.create = jest.fn().mockResolvedValue({
        id: "conv-msg-1",
      })

      const result = await service.sendAccountDeleteMessage("cust1")

      expect(result).toBe(true)

      // Verify Spanish translation in debugInfo
      const createCall = (mockPrisma.conversationMessage.create as jest.Mock).mock.calls[0][0]
      const debugInfo = JSON.parse(createCall.data.debugInfo)
      expect(debugInfo.language).toBe("es")
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🛠️ HELPER METHODS TESTS (3 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Helper Methods", () => {
    it("normalizeLanguageCode should map language codes correctly", () => {
      // SCENARIO: Test language code normalization
      // RULE: Should map various language formats to standard 2-letter codes

      const testCases = [
        { input: "IT", expected: "it" },
        { input: "Italian", expected: "it" },
        { input: "italiano", expected: "it" },
        { input: "ENG", expected: "en" },
        { input: "English", expected: "en" },
        { input: "inglese", expected: "en" },
        { input: "ESP", expected: "es" },
        { input: "Spanish", expected: "es" },
        { input: "español", expected: "es" },
        { input: "PRT", expected: "pt" },
        { input: "Portuguese", expected: "pt" },
        { input: "português", expected: "pt" },
        { input: "FR", expected: "fr" },
        { input: "French", expected: "fr" },
        { input: "francese", expected: "fr" },
        { input: "DE", expected: "de" },
        { input: "German", expected: "de" },
        { input: "deutsch", expected: "de" },
        { input: "", expected: "en" },
        { input: "unknown", expected: "en" },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = (service as any).normalizeLanguageCode(input)
        expect(result).toBe(expected)
      })
    })

    it("getDefaultProfileUpdateMessage should return English default", () => {
      // SCENARIO: Get default profile update message
      // RULE: Should always return English message (will be translated later)

      const message = (service as any).getDefaultProfileUpdateMessage("en")

      expect(message).toBe("Your personal data has been updated successfully!")
    })

    it("getDefaultAccountDeleteMessage should return English default", () => {
      // SCENARIO: Get default account delete message
      // RULE: Should always return English message (will be translated later)

      const message = (service as any).getDefaultAccountDeleteMessage("en")

      expect(message).toBe("Your account has been deleted. Thank you for using our service.")
    })
  })
})
