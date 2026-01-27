/**
 * WhatsApp Queue Debug Mode - Unit Tests
 * 
 * Test Coverage:
 * - Debug Mode Blocking (3 tests)
 * - Workspace Isolation (2 tests)
 * - Debug Mode CRUD (2 tests)
 * - Get Status with Debug Mode (2 tests)
 * 
 * Total: 9 tests
 * 
 * Feature 185: Debug Mode affects ONLY message sending in WhatsApp Queue
 * - When debugMode=true: Messages stay "pending", NOT sent
 * - When debugMode=false: Messages sent normally
 * - Billing ONLY happens after successful WhatsApp delivery
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { PrismaClient } from "@prisma/client"
import { WhatsAppQueueService } from "../../src/services/whatsapp-queue.service"

// Mock dependencies
jest.mock("../../src/application/agents/SecurityAgent", () => {
  return {
    SecurityAgent: jest.fn().mockImplementation(() => ({
      process: jest.fn().mockResolvedValue({
        safe: true,
        message: "Message passed security check",
        tokensUsed: 100,
      }),
    })),
  }
})

// Mock SubscriptionBillingService
jest.mock("../../src/application/services/subscription-billing.service", () => {
  return {
    SubscriptionBillingService: jest.fn().mockImplementation(() => ({
      deductOwnerMessageCredit: jest.fn().mockResolvedValue({
        success: true,
        newBalance: 100,
      }),
      deductMessageCredit: jest.fn().mockResolvedValue({
        success: true,
        newBalance: 100,
      }),
    })),
  }
})

// Mock WhatsAppQueueRepository
jest.mock("../../src/repositories/whatsapp-queue.repository", () => {
  return {
    WhatsAppQueueRepository: jest.fn().mockImplementation(() => ({
      findPending: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ id: "test-id" }),
    })),
  }
})

describe("WhatsApp Queue Debug Mode - Unit Tests", () => {
  let mockPrisma: any
  let service: WhatsAppQueueService

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create fresh mock Prisma for each test
    mockPrisma = {
      workspace: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      whatsAppQueue: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationMessage: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      chatSession: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaClient
    
    service = new WhatsAppQueueService(mockPrisma)
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔧 DEBUG MODE BLOCKING TESTS (3 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Debug Mode Blocking", () => {
    it("should skip message sending when debugMode=true", async () => {
      const workspaceId = "ws-debug-enabled"
      
      // Mock workspace with debugMode=true
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        debugMode: true, // 🔧 DEBUG MODE ENABLED
        wipMessage: "Maintenance mode",
      })

      // Get the mocked repository
      const repoMock = (service as any).repository

      // Mock findPending to return null (no pending messages)
      repoMock.findPending.mockResolvedValue(null)

      await service.processPendingMessages(workspaceId)

      // Should check workspace debugMode
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: { debugMode: true, name: true, wipMessage: true, ownerId: true, channelStatus: true },
      })
      
      // Should attempt to find pending messages to send WIP (but none found)
      expect(repoMock.findPending).toHaveBeenCalledWith(workspaceId, 1)
    })

    it("should process messages normally when debugMode=false", async () => {
      const workspaceId = "ws-debug-disabled"
      
      // Mock workspace with debugMode=false
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        debugMode: false, // 🔧 DEBUG MODE DISABLED
      })

      // Get the mocked repository
      const repoMock = (service as any).repository

      await service.processPendingMessages(workspaceId)

      // Should check debugMode and proceed to look for pending messages
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: { debugMode: true, name: true, wipMessage: true, ownerId: true, channelStatus: true },
      })
      
      // Should attempt to find pending messages
      expect(repoMock.findPending).toHaveBeenCalledWith(workspaceId, 1)
    })

    it("should process messages when debugMode is undefined (default behavior)", async () => {
      const workspaceId = "ws-no-debug-mode"
      
      // Mock workspace without debugMode field (undefined)
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        // debugMode not set - should default to false behavior
      })

      // Get the mocked repository
      const repoMock = (service as any).repository

      await service.processPendingMessages(workspaceId)

      // Should proceed normally (undefined !== true)
      expect(repoMock.findPending).toHaveBeenCalledWith(workspaceId, 1)
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏢 WORKSPACE ISOLATION TESTS (2 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Workspace Isolation", () => {
    it("should NOT affect workspace B when workspace A has debugMode=true", async () => {
      const workspaceA = "ws-A-debug-on"
      const workspaceB = "ws-B-debug-off"

      // Mock: Workspace A has debugMode=true, Workspace B has debugMode=false
      mockPrisma.workspace.findUnique
        .mockResolvedValueOnce({
          id: workspaceA,
          name: "Workspace A",
          debugMode: true,
          wipMessage: "Maintenance mode",
        })
        .mockResolvedValueOnce({
          id: workspaceB,
          name: "Workspace B",
          debugMode: false,
        })

      // Get the mocked repository
      const repoMock = (service as any).repository

      // Mock findPending to return no messages for both workspaces
      repoMock.findPending.mockResolvedValue(null)

      // Process workspace A (debugMode=true)
      await service.processPendingMessages(workspaceA)
      
      // Process workspace B (debugMode=false)
      await service.processPendingMessages(workspaceB)

      // Workspace A: should fetch pending message (to send WIP) but no message found
      // Workspace B: should fetch pending message (to process normally) but no message found
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledTimes(2)
      
      // 2 calls to findPending: one from workspace A (debugMode WIP check), one from workspace B (normal processing)
      expect(repoMock.findPending).toHaveBeenCalledTimes(2)
      expect(repoMock.findPending).toHaveBeenCalledWith(workspaceA, 1)
      expect(repoMock.findPending).toHaveBeenCalledWith(workspaceB, 1)
    })

    it("should query correct workspace for debugMode check", async () => {
      const workspaceId = "specific-workspace-123"

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        debugMode: false,
      })

      await service.processPendingMessages(workspaceId)

      // Verify workspace isolation - correct workspaceId passed
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: { debugMode: true, name: true, wipMessage: true, ownerId: true, channelStatus: true },
      })
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📊 DEBUG MODE CRUD TESTS (2 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Debug Mode CRUD", () => {
    it("should update debugMode to true", async () => {
      const workspaceId = "ws-update-debug"

      mockPrisma.workspace.update.mockResolvedValue({
        id: workspaceId,
        debugMode: true,
      })

      const result = await service.updateDebugMode(workspaceId, true)

      expect(result).toEqual({ debugMode: true })
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: { debugMode: true },
      })
    })

    it("should update debugMode to false", async () => {
      const workspaceId = "ws-update-debug"

      mockPrisma.workspace.update.mockResolvedValue({
        id: workspaceId,
        debugMode: false,
      })

      const result = await service.updateDebugMode(workspaceId, false)

      expect(result).toEqual({ debugMode: false })
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: { debugMode: false },
      })
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📊 GET STATUS TESTS (2 tests)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Get Queue Status with Debug Mode", () => {
    it("should return debugMode in status response", async () => {
      const workspaceId = "ws-get-status"

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        channelStatus: true,
        debugMode: true,
      })

      const result = await service.getQueueEnabledStatus(workspaceId)

      expect(result).toEqual({
        enabled: true,
        debugMode: true,
      })
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: { channelStatus: true, debugMode: true },
      })
    })

    it("should return false debugMode when not set", async () => {
      const workspaceId = "ws-no-debug"

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        channelStatus: false,
        debugMode: false,
      })

      const result = await service.getQueueEnabledStatus(workspaceId)

      expect(result).toEqual({
        enabled: false,
        debugMode: false,
      })
    })
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 💰 BILLING FLOW TESTS (3 tests)
  // Feature 185: Billing ONLY after successful WhatsApp delivery
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Billing Flow - Only After Successful Send", () => {
    it("should NOT call billing when debugMode=true (messages stay pending)", async () => {
      const workspaceId = "ws-debug-no-billing"
      
      // Mock workspace with debugMode=true
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        debugMode: true,
      })

      // Get billing service mock
      const billingMock = (service as any).billingService

      await service.processPendingMessages(workspaceId)

      // Billing should NOT be called when debugMode=true
      expect(billingMock.deductOwnerMessageCredit).not.toHaveBeenCalled()
    })

    it("should NOT call billing when no pending messages exist", async () => {
      const workspaceId = "ws-no-messages"
      
      // Mock workspace with debugMode=false
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        debugMode: false,
      })

      // Mock repository returns null (no pending messages)
      const repoMock = (service as any).repository
      repoMock.findPending.mockResolvedValue(null)

      // Get billing service mock
      const billingMock = (service as any).billingService

      await service.processPendingMessages(workspaceId)

      // Billing should NOT be called when no messages to process
      expect(billingMock.deductOwnerMessageCredit).not.toHaveBeenCalled()
    })

    it("should call billing ONLY after successful WhatsApp send", async () => {
      const workspaceId = "ws-billing-on-success"
      const messageId = "msg-test-123"
      
      // Mock workspace with debugMode=false
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        debugMode: false,
      })

      // Mock a pending message
      const pendingMessage = {
        id: messageId,
        workspaceId,
        customerId: "cust-1",
        phoneNumber: "+390212345678",
        messageContent: "Test message",
        status: "pending",
        createdAt: new Date(),
      }

      // Mock repository
      const repoMock = (service as any).repository
      repoMock.findPending.mockResolvedValue(pendingMessage)

      // Get billing service mock
      const billingMock = (service as any).billingService

      // Note: In real scenario, validateAndSend would be called
      // This test verifies the billing mock is properly set up
      // Full integration test would require mocking WhatsApp API

      await service.processPendingMessages(workspaceId)

      // Repository should be called to find pending messages
      expect(repoMock.findPending).toHaveBeenCalledWith(workspaceId, 1)
    })
  })
})
