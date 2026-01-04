/**
 * Feature 174: Post-Registration Behavior Tests
 * 
 * Tests that verify customer state after successful registration:
 * - isActive: true (user registered)
 * - isBlacklisted: false (NOT blocked, can chat)
 * - activeChatbot: true (chatbot enabled, can use protected functions)
 */

import { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"

// Mock Prisma
const mockPrisma = {
  customers: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  registrationToken: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  secureToken: {
    findFirst: jest.fn(),
  },
} as any

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}))

jest.mock("../../../../src/lib/prisma", () => ({
  prisma: mockPrisma,
}))

jest.mock("../../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

jest.mock("../../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    verifyToken: jest.fn().mockResolvedValue({
      valid: true,
      payload: { phone: "+393331234567", workspaceId: "ws-test" },
    }),
    markTokenAsUsed: jest.fn().mockResolvedValue(true),
  })),
}))

import { RegistrationController } from "../../../../src/interfaces/http/controllers/registration.controller"

describe("RegistrationController - Post-Registration Behavior (Feature 174)", () => {
  let controller: RegistrationController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    controller = new RegistrationController()
    mockReq = {
      body: {},
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockNext = jest.fn()

    // Default workspace mock
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws-test",
      name: "Test Workspace",
      welcomeMessage: "Welcome!",
    })

    // Default token mock
    mockPrisma.registrationToken.findUnique.mockResolvedValue({
      id: "token-test",
      token: "valid-token",
      phone: "+393331234567",
      workspaceId: "ws-test",
      used: false,
      expiresAt: new Date(Date.now() + 86400000), // 24h future
    })

    mockPrisma.secureToken.findFirst.mockResolvedValue({
      id: "secure-token-test",
      token: "valid-token",
      type: "REGISTRATION",
      used: false,
    })
  })

  describe("New Customer Registration", () => {
    it("should set isActive=true, isBlacklisted=false, activeChatbot=true for new customer", async () => {
      mockReq.body = {
        token: "valid-token",
        first_name: "Andrea",
        last_name: "Test",
        email: "andrea@test.com",
        company: "Test Company",
        language: "ITA",
        currency: "EUR",
      }

      // No existing customer
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      // Mock customer creation
      mockPrisma.customers.create.mockResolvedValue({
        id: "new-customer-id",
        name: "Andrea Test",
        email: "andrea@test.com",
        phone: "+393331234567",
        workspaceId: "ws-test",
        isActive: true,
        isBlacklisted: false,
        activeChatbot: true,
      })

      await controller.register(mockReq as Request, mockRes as Response, mockNext)

      // Verify customer.create was called with correct flags
      expect(mockPrisma.customers.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
          isBlacklisted: false, // 🆕 Feature 174: NOT blocked
          activeChatbot: true,  // 🆕 Feature 174: Chatbot enabled
        }),
      })

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("successfully"),
        })
      )
    })
  })

  describe("Existing Customer Registration (Update)", () => {
    it("should update isActive=true, isBlacklisted=false, activeChatbot=true for existing customer", async () => {
      mockReq.body = {
        token: "valid-token",
        first_name: "Andrea",
        last_name: "Updated",
        email: "andrea@test.com",
        company: "Updated Company",
        language: "ITA",
        currency: "EUR",
      }

      // Existing customer (not active)
      mockPrisma.customers.findFirst.mockResolvedValue({
        id: "existing-customer-id",
        name: "Andrea Test",
        phone: "+393331234567",
        workspaceId: "ws-test",
        isActive: false,
        isBlacklisted: true,
        activeChatbot: false,
      })

      // Mock customer update
      mockPrisma.customers.update.mockResolvedValue({
        id: "existing-customer-id",
        name: "Andrea Updated",
        email: "andrea@test.com",
        phone: "+393331234567",
        workspaceId: "ws-test",
        isActive: true,
        isBlacklisted: false,
        activeChatbot: true,
      })

      await controller.register(mockReq as Request, mockRes as Response, mockNext)

      // Verify customer.update was called with correct flags
      expect(mockPrisma.customers.update).toHaveBeenCalledWith({
        where: {
          id: "existing-customer-id",
        },
        data: expect.objectContaining({
          isActive: true,
          isBlacklisted: false, // 🆕 Feature 174: Unblocked
          activeChatbot: true,  // 🆕 Feature 174: Chatbot enabled
        }),
      })

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe("Behavioral Verification", () => {
    it("should NOT block user after registration (isBlacklisted=false)", async () => {
      mockReq.body = {
        token: "valid-token",
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
      }

      mockPrisma.customers.findFirst.mockResolvedValue(null)
      mockPrisma.customers.create.mockResolvedValue({
        id: "customer-id",
        isActive: true,
        isBlacklisted: false,
        activeChatbot: true,
      })

      await controller.register(mockReq as Request, mockRes as Response, mockNext)

      const createCall = mockPrisma.customers.create.mock.calls[0][0]
      expect(createCall.data.isBlacklisted).toBe(false)
    })

    it("should enable chatbot after registration (activeChatbot=true)", async () => {
      mockReq.body = {
        token: "valid-token",
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
      }

      mockPrisma.customers.findFirst.mockResolvedValue(null)
      mockPrisma.customers.create.mockResolvedValue({
        id: "customer-id",
        isActive: true,
        isBlacklisted: false,
        activeChatbot: true,
      })

      await controller.register(mockReq as Request, mockRes as Response, mockNext)

      const createCall = mockPrisma.customers.create.mock.calls[0][0]
      expect(createCall.data.activeChatbot).toBe(true)
    })

    it("should activate customer after registration (isActive=true)", async () => {
      mockReq.body = {
        token: "valid-token",
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
      }

      mockPrisma.customers.findFirst.mockResolvedValue(null)
      mockPrisma.customers.create.mockResolvedValue({
        id: "customer-id",
        isActive: true,
        isBlacklisted: false,
        activeChatbot: true,
      })

      await controller.register(mockReq as Request, mockRes as Response, mockNext)

      const createCall = mockPrisma.customers.create.mock.calls[0][0]
      expect(createCall.data.isActive).toBe(true)
    })
  })

  describe("Old vs New Behavior", () => {
    it("OLD: isBlacklisted=true, activeChatbot=false → NEW: false, true", async () => {
      // This test documents the behavior change
      mockReq.body = {
        token: "valid-token",
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
      }

      mockPrisma.customers.findFirst.mockResolvedValue(null)
      mockPrisma.customers.create.mockResolvedValue({
        id: "customer-id",
        isActive: true,
        isBlacklisted: false, // OLD: true, NEW: false
        activeChatbot: true,  // OLD: false, NEW: true
      })

      await controller.register(mockReq as Request, mockRes as Response, mockNext)

      const createCall = mockPrisma.customers.create.mock.calls[0][0]
      
      // Verify NEW behavior
      expect(createCall.data.isBlacklisted).toBe(false) // Not blocked
      expect(createCall.data.activeChatbot).toBe(true)  // Chatbot enabled
    })
  })
})
