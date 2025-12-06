/**
 * TrashController Unit Tests
 * 
 * Feature 196 - Soft Delete System
 * 100% Coverage for all trash operations
 */

import { Request, Response } from 'express'

// Create mock factory for Prisma
const createMockPrisma = () => ({
  customers: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userWorkspace: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  softDeleteAuditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  message: { deleteMany: jest.fn() },
  conversationMessage: { deleteMany: jest.fn() },
  agentConversationLog: { deleteMany: jest.fn() },
  chatSession: { deleteMany: jest.fn(), updateMany: jest.fn() },
  campaignSent: { deleteMany: jest.fn() },
  campaign: { deleteMany: jest.fn() },
  productCertification: { deleteMany: jest.fn() },
  productTransportType: { deleteMany: jest.fn() },
  productCategory: { deleteMany: jest.fn() },
  cartItems: { deleteMany: jest.fn() },
  carts: { deleteMany: jest.fn() },
  creditNote: { deleteMany: jest.fn() },
  orderItems: { deleteMany: jest.fn() },
  orders: { findMany: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() },
  customerFeedback: { deleteMany: jest.fn() },
  searchConversations: { deleteMany: jest.fn() },
  certification: { deleteMany: jest.fn() },
  transportType: { deleteMany: jest.fn() },
  products: { deleteMany: jest.fn() },
  categories: { deleteMany: jest.fn() },
  offers: { deleteMany: jest.fn() },
  services: { deleteMany: jest.fn() },
  fAQ: { deleteMany: jest.fn() },
  documents: { deleteMany: jest.fn() },
  suppliers: { deleteMany: jest.fn() },
  sales: { deleteMany: jest.fn() },
  languages: { deleteMany: jest.fn() },
  agentConfig: { deleteMany: jest.fn() },
  whatsappSettings: { deleteMany: jest.fn() },
  gdprContent: { deleteMany: jest.fn() },
  whatsAppQueue: { deleteMany: jest.fn() },
  productSearch: { deleteMany: jest.fn() },
  secureToken: { deleteMany: jest.fn() },
  shortUrls: { deleteMany: jest.fn() },
  usage: { deleteMany: jest.fn() },
  billing: { deleteMany: jest.fn() },
  billingTransaction: { deleteMany: jest.fn() },
  adminSession: { deleteMany: jest.fn() },
  workspaceInvitation: { deleteMany: jest.fn() },
  registrationAttempts: { deleteMany: jest.fn() },
  registrationToken: { deleteMany: jest.fn() },
  twoFactorResetToken: { deleteMany: jest.fn() },
  authenticationAttempt: { deleteMany: jest.fn() },
  passwordReset: { deleteMany: jest.fn() },
  $transaction: jest.fn((fn) => fn(createMockPrisma())),
})

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock UserUnsubscribeService
jest.mock('../../../src/services/user-unsubscribe.service', () => ({
  UserUnsubscribeService: jest.fn().mockImplementation(() => ({
    unsubscribeUser: jest.fn(),
  })),
}))

// Mock TrashRestoreService
jest.mock('../../../src/services/trash-restore.service', () => ({
  TrashRestoreService: jest.fn().mockImplementation(() => ({
    restoreCustomer: jest.fn(),
    restoreWorkspace: jest.fn(),
  })),
}))

// Mock soft-delete helper
jest.mock('../../../src/utils/soft-delete.helper', () => ({
  buildTrashFilter: jest.fn().mockReturnValue({ deletedAt: { not: null } }),
  getDaysUntilPermanentDelete: jest.fn().mockReturnValue(86),
  getRetentionDaysConfig: jest.fn().mockReturnValue(90),
}))

import { TrashController } from '../../../src/interfaces/http/controllers/trash.controller'
import { UserUnsubscribeService } from '../../../src/services/user-unsubscribe.service'
import { TrashRestoreService } from '../../../src/services/trash-restore.service'

describe('TrashController', () => {
  let controller: TrashController
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockRes: Partial<Response>
  let mockReq: Partial<Request>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = createMockPrisma()
    controller = new TrashController(mockPrisma as any)
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { id: 'admin-user-123' },
    }
  })

  describe('unsubscribeUser', () => {
    it('should unsubscribe user successfully', async () => {
      const mockUnsubscribe = jest.fn().mockResolvedValue({
        success: true,
        userId: 'user-1',
        message: 'User soft-deleted',
      })
      ;(UserUnsubscribeService as jest.Mock).mockImplementation(() => ({
        unsubscribeUser: mockUnsubscribe,
      }))
      
      // Re-create controller with new mock
      controller = new TrashController(mockPrisma as any)
      
      mockReq.params = { id: 'user-1' }
      mockReq.body = { reason: 'User requested deletion' }

      await controller.unsubscribeUser(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ success: true }),
      })
    })

    it('should handle unsubscribe failure', async () => {
      const mockUnsubscribe = jest.fn().mockRejectedValue(new Error('User not found'))
      ;(UserUnsubscribeService as jest.Mock).mockImplementation(() => ({
        unsubscribeUser: mockUnsubscribe,
      }))
      
      controller = new TrashController(mockPrisma as any)
      
      mockReq.params = { id: 'non-existent' }
      mockReq.body = {}

      await controller.unsubscribeUser(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to unsubscribe user',
        message: expect.any(String),
      })
    })
  })

  describe('listDeletedCustomers', () => {
    it('should list deleted customers with pagination', async () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          name: 'Customer 1',
          email: 'c1@test.com',
          phone: '+111',
          deletedAt: new Date('2025-12-01'),
          language: 'en',
          workspaceId: 'ws-1',
          workspace: { name: 'Test Workspace' },
        },
      ]
      
      mockPrisma.customers.findMany.mockResolvedValue(mockCustomers)
      mockPrisma.customers.count.mockResolvedValue(1)

      mockReq.query = { workspaceId: 'ws-1', page: '1', limit: '50' }

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'cust-1',
            name: 'Customer 1',
            daysUntilPermanentDelete: 86,
          }),
        ]),
        pagination: expect.objectContaining({
          page: 1,
          limit: 50,
          total: 1,
        }),
      })
    })

    it('should list customers without workspaceId (Platform Admin view)', async () => {
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.count.mockResolvedValue(0)

      mockReq.query = {} // No workspaceId

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ workspaceId: expect.anything() }),
        })
      )
    })

    it('should handle pagination defaults', async () => {
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.count.mockResolvedValue(0)

      mockReq.query = { page: 'invalid', limit: '-10' }

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1, // Default to 1 for invalid
          }),
        })
      )
    })

    it('should handle error gracefully', async () => {
      mockPrisma.customers.findMany.mockRejectedValue(new Error('DB error'))

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to list deleted customers',
        message: expect.any(String),
      })
    })
  })

  describe('listDeletedWorkspaces', () => {
    it('should list deleted workspaces with owner filter', async () => {
      const mockWorkspaces = [
        {
          id: 'ws-1',
          name: 'Workspace 1',
          slug: 'ws-1',
          ownerId: 'owner-1',
          deletedAt: new Date('2025-12-01'),
          owner: { email: 'owner@test.com' },
        },
      ]
      
      mockPrisma.workspace.findMany.mockResolvedValue(mockWorkspaces)
      mockPrisma.workspace.count.mockResolvedValue(1)

      mockReq.query = { page: '1', limit: '50' }

      await controller.listDeletedWorkspaces(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'ws-1',
            name: 'Workspace 1',
            ownerEmail: 'owner@test.com',
            daysUntilPermanentDelete: 86,
          }),
        ]),
        pagination: expect.objectContaining({ total: 1 }),
      })
    })

    it('should filter out workspaces where owner is deleted', async () => {
      // This is handled by the whereClause: owner.deletedAt = null
      mockPrisma.workspace.findMany.mockResolvedValue([])
      mockPrisma.workspace.count.mockResolvedValue(0)

      await controller.listDeletedWorkspaces(mockReq as Request, mockRes as Response)

      expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            owner: { deletedAt: null },
          }),
        })
      )
    })

    it('should handle error gracefully', async () => {
      mockPrisma.workspace.findMany.mockRejectedValue(new Error('DB error'))

      await controller.listDeletedWorkspaces(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(500)
    })
  })

  describe('listDeletedUsers', () => {
    it('should list deleted users with workspace info', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user@test.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'OWNER',
          deletedAt: new Date('2025-12-01'),
          workspaces: [
            {
              workspace: { id: 'ws-1', name: 'Test WS', deletedAt: null },
              role: 'OWNER',
            },
          ],
        },
      ]
      
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'user-1',
            email: 'user@test.com',
            name: 'John Doe',
          }),
        ]),
        pagination: expect.any(Object),
      })
    })

    it('should filter out cascade-victim AGENT/OPERATOR users', async () => {
      const mockUsers = [
        {
          id: 'agent-1',
          email: 'agent@test.com',
          firstName: 'Agent',
          lastName: 'User',
          role: 'AGENT', // AGENT role
          deletedAt: new Date('2025-12-01'),
          workspaces: [
            {
              // ALL workspaces deleted = cascade victim
              workspace: { id: 'ws-1', name: 'Deleted WS', deletedAt: new Date() },
              role: 'AGENT',
            },
          ],
        },
      ]
      
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      // Agent with all deleted workspaces should be filtered out
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [], // Empty because agent is cascade victim
        })
      )
    })

    it('should include OWNER/ADMIN users always', async () => {
      const mockUsers = [
        {
          id: 'owner-1',
          email: 'owner@test.com',
          firstName: 'Owner',
          lastName: 'User',
          role: 'OWNER',
          deletedAt: new Date('2025-12-01'),
          workspaces: [], // Even with no workspaces
        },
      ]
      
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ id: 'owner-1' }),
          ]),
        })
      )
    })

    it('should handle AGENT with at least one active workspace', async () => {
      const mockUsers = [
        {
          id: 'agent-1',
          email: 'agent@test.com',
          firstName: 'Agent',
          lastName: 'User',
          role: 'AGENT',
          deletedAt: new Date('2025-12-01'),
          workspaces: [
            { workspace: { id: 'ws-1', name: 'Active WS', deletedAt: null }, role: 'AGENT' },
          ],
        },
      ]
      
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      // Agent with active workspace should be included (direct deletion)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ id: 'agent-1' }),
          ]),
        })
      )
    })

    it('should handle error gracefully', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'))

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(500)
    })
  })

  describe('restoreItem', () => {
    it('should restore workspace successfully', async () => {
      const mockRestore = jest.fn().mockResolvedValue({
        success: true,
        entityType: 'WORKSPACE',
      })
      ;(TrashRestoreService as jest.Mock).mockImplementation(() => ({
        restoreWorkspace: mockRestore,
        restoreCustomer: jest.fn(),
      }))
      
      controller = new TrashController(mockPrisma as any)
      
      mockReq.params = { id: 'ws-1' }
      mockReq.body = { entityType: 'WORKSPACE' }

      await controller.restoreItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ success: true }),
      })
    })

    it('should restore customer with workspaceId', async () => {
      const mockRestore = jest.fn().mockResolvedValue({
        success: true,
        entityType: 'CUSTOMER',
      })
      ;(TrashRestoreService as jest.Mock).mockImplementation(() => ({
        restoreWorkspace: jest.fn(),
        restoreCustomer: mockRestore,
      }))
      
      controller = new TrashController(mockPrisma as any)
      
      mockReq.params = { id: 'cust-1' }
      mockReq.body = { entityType: 'CUSTOMER', workspaceId: 'ws-1' }

      await controller.restoreItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })

    it('should require workspaceId for customer restore', async () => {
      mockReq.params = { id: 'cust-1' }
      mockReq.body = { entityType: 'CUSTOMER' } // No workspaceId

      await controller.restoreItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'workspaceId required for customer restore',
      })
    })

    it('should restore user with cascade', async () => {
      // Setup transaction mock to handle user restore
      const txMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            deletedAt: new Date('2025-12-01'),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        workspace: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ws-1', name: 'Workspace 1' },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        customers: { updateMany: jest.fn().mockResolvedValue({ count: 5 }) },
        orders: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
        chatSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        message: { updateMany: jest.fn().mockResolvedValue({ count: 10 }) },
        userWorkspace: { findFirst: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }) },
        softDeleteAuditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      
      mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
      
      mockReq.params = { id: 'user-1' }
      mockReq.body = { entityType: 'USER' }

      await controller.restoreItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          cascadeRestored: expect.objectContaining({
            workspaces: 1,
            customers: 5,
          }),
        }),
      })
    })

    it('should fail if user not found', async () => {
      const txMock = {
        user: { findUnique: jest.fn().mockResolvedValue(null) },
      }
      mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
      
      mockReq.params = { id: 'non-existent' }
      mockReq.body = { entityType: 'USER' }

      await controller.restoreItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should fail if user not deleted', async () => {
      const txMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            deletedAt: null, // Not deleted
          }),
        },
      }
      mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
      
      mockReq.params = { id: 'user-1' }
      mockReq.body = { entityType: 'USER' }

      await controller.restoreItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })
  })

  describe('permanentlyDeleteItem', () => {
    it('should require confirmation text', async () => {
      mockReq.params = { id: 'item-1' }
      mockReq.body = { confirmationText: 'wrong text' }

      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid confirmation',
        message: 'Must type "PERMANENTLY DELETE" to confirm',
      })
    })

    it('should permanently delete customer', async () => {
      const txMock = createMockPrisma()
      txMock.message.deleteMany.mockResolvedValue({ count: 5 })
      txMock.chatSession.deleteMany.mockResolvedValue({ count: 1 })
      txMock.orderItems.deleteMany.mockResolvedValue({ count: 3 })
      txMock.orders.deleteMany.mockResolvedValue({ count: 1 })
      txMock.customers.delete = jest.fn().mockResolvedValue({ id: 'cust-1' })
      txMock.softDeleteAuditLog.create.mockResolvedValue({})
      
      mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
      
      mockReq.params = { id: 'cust-1' }
      mockReq.body = {
        entityType: 'CUSTOMER',
        workspaceId: 'ws-1',
        confirmationText: 'PERMANENTLY DELETE',
      }

      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item permanently deleted',
        deletedCount: 1,
        permanentlyDeletedAt: expect.any(Date),
      })
    })

    it('should permanently delete workspace with all related data', async () => {
      // Create a fresh mock with delete method
      const txMock = {
        message: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
        conversationMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
        agentConversationLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        campaignSent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        campaign: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        productCertification: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        productTransportType: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        productCategory: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        cartItems: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        carts: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        creditNote: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        orderItems: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
        orders: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        customerFeedback: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        searchConversations: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        customers: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
        certification: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        transportType: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        products: { deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
        categories: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        offers: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        services: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        fAQ: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
        documents: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        suppliers: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        sales: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        languages: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        agentConfig: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        whatsappSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        gdprContent: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        whatsAppQueue: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        productSearch: { deleteMany: jest.fn().mockResolvedValue({ count: 50 }) },
        secureToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        shortUrls: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        usage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        billing: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        billingTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        adminSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        workspaceInvitation: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        registrationAttempts: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        registrationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        softDeleteAuditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        workspace: { delete: jest.fn().mockResolvedValue({ id: 'ws-1' }) },
      }
      
      mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
      
      mockReq.params = { id: 'ws-1' }
      mockReq.body = {
        entityType: 'WORKSPACE',
        confirmationText: 'PERMANENTLY DELETE',
      }

      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      // Verify key tables were deleted
      expect(txMock.message.deleteMany).toHaveBeenCalled()
      expect(txMock.conversationMessage.deleteMany).toHaveBeenCalled()
      expect(txMock.chatSession.deleteMany).toHaveBeenCalled()
      expect(txMock.products.deleteMany).toHaveBeenCalled()
      expect(txMock.orders.deleteMany).toHaveBeenCalled()
      expect(txMock.customers.deleteMany).toHaveBeenCalled()
      expect(txMock.agentConfig.deleteMany).toHaveBeenCalled()
      expect(txMock.userWorkspace.deleteMany).toHaveBeenCalled()
      expect(txMock.workspace.delete).toHaveBeenCalled()
    })

    it('should permanently delete user with all owned workspaces', async () => {
      // Create a fresh mock with all needed methods
      const txMock = {
        workspace: { 
          findMany: jest.fn().mockResolvedValue([{ id: 'ws-1' }, { id: 'ws-2' }]),
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        user: { delete: jest.fn().mockResolvedValue({ id: 'user-1' }) },
        twoFactorResetToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        authenticationAttempt: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        passwordReset: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        // Workspace-related tables (called for each workspace)
        message: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
        conversationMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
        agentConversationLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        campaignSent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        campaign: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        productCertification: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        productTransportType: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        productCategory: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        cartItems: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        carts: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        creditNote: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        orderItems: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
        orders: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        customerFeedback: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        searchConversations: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        customers: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
        certification: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        transportType: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        products: { deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
        categories: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        offers: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        services: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        fAQ: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
        documents: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        suppliers: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        sales: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        languages: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        agentConfig: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
        whatsappSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        gdprContent: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        whatsAppQueue: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        productSearch: { deleteMany: jest.fn().mockResolvedValue({ count: 50 }) },
        secureToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        shortUrls: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        usage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        billing: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        billingTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        adminSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        workspaceInvitation: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        registrationAttempts: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        registrationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        softDeleteAuditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }
      
      mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
      
      mockReq.params = { id: 'user-1' }
      mockReq.body = {
        entityType: 'USER',
        confirmationText: 'PERMANENTLY DELETE',
      }

      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item permanently deleted',
        deletedCount: 3, // 1 user + 2 workspaces
        permanentlyDeletedAt: expect.any(Date),
      })
      
      // Verify user-specific tables deleted
      expect(txMock.twoFactorResetToken.deleteMany).toHaveBeenCalled()
      expect(txMock.authenticationAttempt.deleteMany).toHaveBeenCalled()
      expect(txMock.passwordReset.deleteMany).toHaveBeenCalled()
      expect(txMock.user.delete).toHaveBeenCalled()
    })

    it('should handle delete error', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('FK violation'))
      
      mockReq.params = { id: 'item-1' }
      mockReq.body = {
        entityType: 'WORKSPACE',
        confirmationText: 'PERMANENTLY DELETE',
      }

      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to permanently delete item',
        message: expect.any(String),
      })
    })
  })

  describe('getAuditLog', () => {
    it('should return audit log for workspace', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          entityType: 'CUSTOMER_DELETED',
          deletedIds: ['cust-1'],
          deletedIdCount: 1,
          reason: 'User requested',
          deletedByUserId: 'admin-1',
          deletedAt: new Date('2025-12-01'),
        },
      ]
      
      mockPrisma.softDeleteAuditLog.findMany.mockResolvedValue(mockLogs)

      mockReq.query = { workspaceId: 'ws-1', days: '30' }

      await controller.getAuditLog(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        logs: mockLogs,
        daysShown: 30,
        totalCount: 1,
      })
    })

    it('should require workspaceId', async () => {
      mockReq.query = {} // No workspaceId

      await controller.getAuditLog(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'workspaceId required',
      })
    })

    it('should handle invalid days parameter', async () => {
      mockPrisma.softDeleteAuditLog.findMany.mockResolvedValue([])

      mockReq.query = { workspaceId: 'ws-1', days: 'invalid' }

      await controller.getAuditLog(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          daysShown: 30, // Default
        })
      )
    })

    it('should handle error gracefully', async () => {
      mockPrisma.softDeleteAuditLog.findMany.mockRejectedValue(new Error('DB error'))

      mockReq.query = { workspaceId: 'ws-1' }

      await controller.getAuditLog(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(500)
    })
  })
})

describe('TrashController - Edge Cases', () => {
  let controller: TrashController
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockRes: Partial<Response>
  let mockReq: Partial<Request>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = createMockPrisma()
    controller = new TrashController(mockPrisma as any)
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { id: 'admin-user-123' },
    }
  })

  describe('Pagination Edge Cases', () => {
    it('should cap limit at 100', async () => {
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.count.mockResolvedValue(0)

      mockReq.query = { limit: '1000' } // Over limit

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Capped
        })
      )
    })

    it('should handle negative page number', async () => {
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.count.mockResolvedValue(0)

      mockReq.query = { page: '-5' }

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1, // Minimum 1
          }),
        })
      )
    })
  })

  describe('Name Formatting', () => {
    it('should format user name correctly with firstName and lastName', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@test.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'OWNER',
          deletedAt: new Date(),
          workspaces: [],
        },
      ])

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              name: 'John Doe',
            }),
          ]),
        })
      )
    })

    it('should use email as fallback name', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@test.com',
          firstName: null,
          lastName: null,
          role: 'OWNER',
          deletedAt: new Date(),
          workspaces: [],
        },
      ])

      await controller.listDeletedUsers(mockReq as Request, mockRes as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              name: 'user@test.com',
            }),
          ]),
        })
      )
    })
  })

  describe('Workspace Owner Unknown', () => {
    it('should show "Unknown" for workspace without owner email', async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: 'ws-1',
          name: 'Orphan Workspace',
          slug: 'orphan',
          ownerId: 'deleted-owner',
          deletedAt: new Date(),
          owner: null, // Owner deleted/null
        },
      ])
      mockPrisma.workspace.count.mockResolvedValue(1)

      await controller.listDeletedWorkspaces(mockReq as Request, mockRes as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              ownerEmail: 'Unknown',
            }),
          ]),
        })
      )
    })
  })

  describe('Customer Workspace Name Unknown', () => {
    it('should show "Unknown" for customer without workspace', async () => {
      mockPrisma.customers.findMany.mockResolvedValue([
        {
          id: 'cust-1',
          name: 'Customer',
          email: 'c@test.com',
          phone: '+111',
          deletedAt: new Date(),
          language: 'en',
          workspaceId: 'ws-deleted',
          workspace: null, // Workspace deleted
        },
      ])
      mockPrisma.customers.count.mockResolvedValue(1)

      await controller.listDeletedCustomers(mockReq as Request, mockRes as Response)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              workspaceName: 'Unknown',
            }),
          ]),
        })
      )
    })
  })
})

describe('TrashController - Full Cascade Delete Tests', () => {
  let controller: TrashController
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockRes: Partial<Response>
  let mockReq: Partial<Request>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = createMockPrisma()
    controller = new TrashController(mockPrisma as any)
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { id: 'admin-user-123' },
    }
  })

  it('should delete ALL 40+ workspace-related tables in correct order', async () => {
    const txMock = createMockPrisma()
    const deletionOrder: string[] = []
    
    // Track deletion order
    const trackDelete = (tableName: string) => {
      return jest.fn().mockImplementation(() => {
        deletionOrder.push(tableName)
        return Promise.resolve({ count: 1 })
      })
    }
    
    txMock.message.deleteMany = trackDelete('message')
    txMock.conversationMessage.deleteMany = trackDelete('conversationMessage')
    txMock.agentConversationLog.deleteMany = trackDelete('agentConversationLog')
    txMock.chatSession.deleteMany = trackDelete('chatSession')
    txMock.campaignSent.deleteMany = trackDelete('campaignSent')
    txMock.campaign.deleteMany = trackDelete('campaign')
    txMock.productCertification.deleteMany = trackDelete('productCertification')
    txMock.productTransportType.deleteMany = trackDelete('productTransportType')
    txMock.productCategory.deleteMany = trackDelete('productCategory')
    txMock.cartItems.deleteMany = trackDelete('cartItems')
    txMock.carts.deleteMany = trackDelete('carts')
    txMock.creditNote.deleteMany = trackDelete('creditNote')
    txMock.orderItems.deleteMany = trackDelete('orderItems')
    txMock.orders.deleteMany = trackDelete('orders')
    txMock.customerFeedback.deleteMany = trackDelete('customerFeedback')
    txMock.searchConversations.deleteMany = trackDelete('searchConversations')
    txMock.customers.deleteMany = trackDelete('customers')
    txMock.certification.deleteMany = trackDelete('certification')
    txMock.transportType.deleteMany = trackDelete('transportType')
    txMock.products.deleteMany = trackDelete('products')
    txMock.categories.deleteMany = trackDelete('categories')
    txMock.offers.deleteMany = trackDelete('offers')
    txMock.services.deleteMany = trackDelete('services')
    txMock.fAQ.deleteMany = trackDelete('fAQ')
    txMock.documents.deleteMany = trackDelete('documents')
    txMock.suppliers.deleteMany = trackDelete('suppliers')
    txMock.sales.deleteMany = trackDelete('sales')
    txMock.languages.deleteMany = trackDelete('languages')
    txMock.agentConfig.deleteMany = trackDelete('agentConfig')
    txMock.whatsappSettings.deleteMany = trackDelete('whatsappSettings')
    txMock.gdprContent.deleteMany = trackDelete('gdprContent')
    txMock.whatsAppQueue.deleteMany = trackDelete('whatsAppQueue')
    txMock.productSearch.deleteMany = trackDelete('productSearch')
    txMock.secureToken.deleteMany = trackDelete('secureToken')
    txMock.shortUrls.deleteMany = trackDelete('shortUrls')
    txMock.usage.deleteMany = trackDelete('usage')
    txMock.billing.deleteMany = trackDelete('billing')
    txMock.billingTransaction.deleteMany = trackDelete('billingTransaction')
    txMock.adminSession.deleteMany = trackDelete('adminSession')
    txMock.workspaceInvitation.deleteMany = trackDelete('workspaceInvitation')
    txMock.registrationAttempts.deleteMany = trackDelete('registrationAttempts')
    txMock.registrationToken.deleteMany = trackDelete('registrationToken')
    txMock.softDeleteAuditLog.deleteMany = trackDelete('softDeleteAuditLog')
    txMock.userWorkspace.deleteMany = trackDelete('userWorkspace')
    txMock.workspace.delete = jest.fn().mockImplementation(() => {
      deletionOrder.push('workspace')
      return Promise.resolve({ id: 'ws-1' })
    })
    
    mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
    
    mockReq.params = { id: 'ws-1' }
    mockReq.body = {
      entityType: 'WORKSPACE',
      confirmationText: 'PERMANENTLY DELETE',
    }

    await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

    // Verify workspace is deleted last
    expect(deletionOrder[deletionOrder.length - 1]).toBe('workspace')
    
    // Verify leaf tables deleted before parent tables
    const messageIdx = deletionOrder.indexOf('message')
    const chatSessionIdx = deletionOrder.indexOf('chatSession')
    expect(messageIdx).toBeLessThan(chatSessionIdx)
    
    const orderItemsIdx = deletionOrder.indexOf('orderItems')
    const ordersIdx = deletionOrder.indexOf('orders')
    expect(orderItemsIdx).toBeLessThan(ordersIdx)
    
    const customersIdx = deletionOrder.indexOf('customers')
    expect(ordersIdx).toBeLessThan(customersIdx)
    
    // Verify all major tables were called
    expect(deletionOrder.length).toBeGreaterThanOrEqual(40)
  })

  it('should delete user auth tables before workspaces', async () => {
    const deletionOrder: string[] = []
    
    // Create comprehensive mock
    const txMock = {
      workspace: { 
        findMany: jest.fn().mockResolvedValue([{ id: 'ws-1' }]),
        deleteMany: jest.fn().mockImplementation(() => {
          deletionOrder.push('workspace')
          return { count: 1 }
        }),
      },
      user: { 
        delete: jest.fn().mockImplementation(() => {
          deletionOrder.push('user')
          return { id: 'user-1' }
        }) 
      },
      twoFactorResetToken: { 
        deleteMany: jest.fn().mockImplementation(() => {
          deletionOrder.push('twoFactorResetToken')
          return { count: 1 }
        })
      },
      authenticationAttempt: { 
        deleteMany: jest.fn().mockImplementation(() => {
          deletionOrder.push('authenticationAttempt')
          return { count: 1 }
        })
      },
      passwordReset: { 
        deleteMany: jest.fn().mockImplementation(() => {
          deletionOrder.push('passwordReset')
          return { count: 1 }
        })
      },
      userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      // All workspace-related tables
      message: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      conversationMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      agentConversationLog: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      campaignSent: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      campaign: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      productCertification: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      productTransportType: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      productCategory: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      cartItems: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      carts: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      creditNote: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderItems: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orders: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      customerFeedback: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      searchConversations: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      customers: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      certification: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      transportType: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      products: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      categories: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      offers: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      services: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      fAQ: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      documents: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      suppliers: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sales: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      languages: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      agentConfig: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      whatsappSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      gdprContent: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      whatsAppQueue: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      productSearch: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      secureToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      shortUrls: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      usage: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      billing: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      billingTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      adminSession: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      workspaceInvitation: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      registrationAttempts: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      registrationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      softDeleteAuditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }
    
    mockPrisma.$transaction.mockImplementation((fn) => fn(txMock))
    
    mockReq.params = { id: 'user-1' }
    mockReq.body = {
      entityType: 'USER',
      confirmationText: 'PERMANENTLY DELETE',
    }

    await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

    // Auth tables should be deleted first (before workspace delete)
    const twoFactorIdx = deletionOrder.indexOf('twoFactorResetToken')
    const authAttemptIdx = deletionOrder.indexOf('authenticationAttempt')
    const passwordResetIdx = deletionOrder.indexOf('passwordReset')
    const workspaceIdx = deletionOrder.indexOf('workspace')
    const userIdx = deletionOrder.indexOf('user')
    
    expect(twoFactorIdx).toBeGreaterThanOrEqual(0)
    expect(authAttemptIdx).toBeGreaterThanOrEqual(0)
    expect(passwordResetIdx).toBeGreaterThanOrEqual(0)
    expect(twoFactorIdx).toBeLessThan(workspaceIdx)
    expect(authAttemptIdx).toBeLessThan(workspaceIdx)
    expect(passwordResetIdx).toBeLessThan(workspaceIdx)
    
    // User should be deleted last
    expect(userIdx).toBe(deletionOrder.length - 1)
  })
})
