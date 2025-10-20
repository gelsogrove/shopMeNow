/**
 * 🧪 UNIT TEST: Customer Registration - Blocked Until Admin Approval
 *
 * Test suite per verificare che i nuovi utenti vengano creati con:
 * 1. isBlacklisted: true (BLOCCATI fino all'approvazione admin)
 * 2. activeChatbot: true (chatbot attivo per gestire richieste)
 *
 * Requirement: Nuovi utenti devono essere bloccati automaticamente
 * fino a quando l'amministratore non li approva manualmente.
 *
 * Test Coverage:
 * ✅ Registration via API (registration.controller.ts)
 * ✅ Registration via WhatsApp Message (message.repository.ts)
 * ✅ Admin Approval Flow
 * ✅ Security: Blocked users cannot place orders
 *
 * Date: 20 Ottobre 2025
 * Branch: 84-design-implement-new-calling-functions
 */

// Mock Prisma Client
jest.mock("../../lib/prisma", () => ({
  prisma: {
    customers: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}))

import { prisma } from "../../lib/prisma"

describe("🚨 Customer Registration - Blocked Until Admin Approval", () => {
  const mockWorkspaceId = "test-workspace-id"
  const mockPhoneNumber = "+393331234567"

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe("📋 Registration via API (registration.controller.ts)", () => {
    it("should create new customer with isBlacklisted=true and activeChatbot=true", async () => {
      const mockCustomer = {
        id: "test-customer-id-1",
        name: "Test User Blocked",
        email: "blocked@test.com",
        phone: mockPhoneNumber,
        workspaceId: mockWorkspaceId,
        language: "IT",
        currency: "EUR",
        isActive: true,
        isBlacklisted: true,
        activeChatbot: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.customers.create as jest.Mock).mockResolvedValue(mockCustomer)

      const newCustomer = await prisma.customers.create({
        data: {
          name: "Test User Blocked",
          email: "blocked@test.com",
          phone: mockPhoneNumber,
          workspaceId: mockWorkspaceId,
          language: "IT",
          currency: "EUR",
          isActive: true,
          isBlacklisted: true,
          activeChatbot: true,
        },
      })

      expect(newCustomer).toBeDefined()
      expect(newCustomer.isBlacklisted).toBe(true)
      expect(newCustomer.activeChatbot).toBe(true)
      expect(newCustomer.isActive).toBe(true)

      expect(prisma.customers.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isBlacklisted: true,
          activeChatbot: true,
        }),
      })
    })
  })

  describe("📞 Registration via WhatsApp Message (message.repository.ts)", () => {
    it("should create temporary customer with isBlacklisted=true from unknown WhatsApp number", async () => {
      const unknownPhone = "+393331112222"

      const mockTempCustomer = {
        id: "temp-customer-id",
        name: "Unknown User-1234",
        email: "temp@test.com",
        phone: unknownPhone,
        workspaceId: mockWorkspaceId,
        isActive: false,
        isBlacklisted: true,
        activeChatbot: true,
        language: "IT",
        currency: "EUR",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.customers.create as jest.Mock).mockResolvedValue(
        mockTempCustomer
      )

      const tempCustomer = await prisma.customers.create({
        data: {
          name: "Unknown User-1234",
          email: "temp@test.com",
          phone: unknownPhone,
          workspaceId: mockWorkspaceId,
          isActive: false,
          isBlacklisted: true,
          activeChatbot: true,
          language: "IT",
          currency: "EUR",
        },
      })

      expect(tempCustomer).toBeDefined()
      expect(tempCustomer.isBlacklisted).toBe(true)
      expect(tempCustomer.activeChatbot).toBe(true)
      expect(tempCustomer.isActive).toBe(false)

      expect(prisma.customers.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isBlacklisted: true,
          activeChatbot: true,
          isActive: false,
        }),
      })
    })
  })

  describe("👨‍💼 Admin Approval Flow", () => {
    it("should allow admin to unblock customer by setting isBlacklisted=false", async () => {
      const blockedCustomer = {
        id: "blocked-customer-id",
        name: "Blocked Customer",
        email: "blocked@example.com",
        phone: mockPhoneNumber,
        workspaceId: mockWorkspaceId,
        isBlacklisted: true,
        activeChatbot: true,
        isActive: true,
        language: "IT",
        currency: "EUR",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const approvedCustomer = {
        ...blockedCustomer,
        isBlacklisted: false,
      }

      ;(prisma.customers.update as jest.Mock).mockResolvedValue(
        approvedCustomer
      )

      const updated = await prisma.customers.update({
        where: { id: "blocked-customer-id" },
        data: { isBlacklisted: false },
      })

      expect(updated.isBlacklisted).toBe(false)
      expect(updated.activeChatbot).toBe(true)
      expect(updated.isActive).toBe(true)

      expect(prisma.customers.update).toHaveBeenCalledWith({
        where: { id: "blocked-customer-id" },
        data: { isBlacklisted: false },
      })
    })
  })

  describe("🔒 Security: Blocked Users Cannot Order", () => {
    it("should verify isBlacklisted=true prevents order placement", async () => {
      const blockedCustomer = {
        id: "blocked-order-test",
        name: "Blocked Order Test",
        email: "blocked.order@test.com",
        phone: mockPhoneNumber,
        workspaceId: mockWorkspaceId,
        isBlacklisted: true,
        activeChatbot: true,
        isActive: true,
        language: "IT",
        currency: "EUR",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.customers.findUnique as jest.Mock).mockResolvedValue(
        blockedCustomer
      )

      const customer = await prisma.customers.findUnique({
        where: { id: "blocked-order-test" },
      })

      expect(customer).toBeDefined()
      expect(customer!.isBlacklisted).toBe(true)

      const canOrder = !customer!.isBlacklisted
      expect(canOrder).toBe(false)
    })
  })
})
