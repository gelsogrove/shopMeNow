/**
 * Hard Delete Validation Tests
 * 
 * Feature 196 - Tests security validation for permanent hard-delete endpoint
 * 
 * CRITICAL SECURITY CHECKS:
 * 1. Cannot hard-delete items that are NOT soft-deleted (deletedAt = null)
 * 2. Requires exact confirmation text "PERMANENTLY DELETE"
 * 3. Requires Platform Admin role (isPlatformAdmin = true)
 * 4. Logs all hard-delete attempts with admin details
 */

import { TrashController } from '../../../src/interfaces/http/controllers/trash.controller'
import { Request, Response } from 'express'

// Mock Prisma
const mockPrisma = {
  customers: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  message: {
    deleteMany: jest.fn(),
  },
  chatSession: {
    deleteMany: jest.fn(),
  },
  orderItems: {
    deleteMany: jest.fn(),
  },
  orders: {
    deleteMany: jest.fn(),
  },
  softDeleteAuditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}

describe('TrashController - Hard Delete Validation', () => {
  let controller: TrashController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    controller = new TrashController(mockPrisma as any)
    
    jsonMock = jest.fn()
    statusMock = jest.fn(() => ({ json: jsonMock })) as any
    
    mockReq = {
      params: {},
      body: {},
      user: {
        id: 'admin-123',
        email: 'admin@echatbot.ai',
        isPlatformAdmin: true,
      } as any,
    }
    
    mockRes = {
      status: statusMock,
      json: jsonMock,
    }
  })

  describe('Security: Cannot hard-delete active (non-deleted) items', () => {
    it('should reject hard-delete of ACTIVE customer (deletedAt = null)', async () => {
      // Arrange: Customer exists but is NOT deleted
      mockReq.params = { id: 'customer-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'CUSTOMER',
        workspaceId: 'workspace-1',
      }

      mockPrisma.customers.findUnique.mockResolvedValueOnce({
        id: 'customer-123',
        deletedAt: null, // NOT deleted
        name: 'John Doe',
        email: 'john@example.com',
        workspaceId: 'workspace-1',
      })

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Cannot hard-delete active item',
        message: 'Item must be soft-deleted first. Use soft-delete endpoint.',
      })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('should reject hard-delete of ACTIVE workspace (deletedAt = null)', async () => {
      // Arrange
      mockReq.params = { id: 'workspace-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'WORKSPACE',
      }

      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: 'workspace-123',
        deletedAt: null, // NOT deleted
        name: 'My Workspace',
        ownerId: 'owner-123',
      })

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Cannot hard-delete active item',
        message: 'Item must be soft-deleted first. Use soft-delete endpoint.',
      })
    })

    it('should reject hard-delete of ACTIVE user (deletedAt = null)', async () => {
      // Arrange
      mockReq.params = { id: 'user-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'USER',
      }

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        deletedAt: null, // NOT deleted
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      })

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Cannot hard-delete active item',
        message: 'Item must be soft-deleted first. Use soft-delete endpoint.',
      })
    })
  })

  describe('Security: Requires exact confirmation text', () => {
    it('should reject hard-delete with wrong confirmation text', async () => {
      // Arrange
      mockReq.params = { id: 'customer-123' }
      mockReq.body = {
        confirmationText: 'delete', // Wrong text
        entityType: 'CUSTOMER',
      }

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid confirmation',
        message: 'Must type "PERMANENTLY DELETE" to confirm',
      })
      expect(mockPrisma.customers.findUnique).not.toHaveBeenCalled()
    })

    it('should reject hard-delete with partial confirmation text', async () => {
      // Arrange
      mockReq.body = {
        confirmationText: 'PERMANENTLY',
        entityType: 'CUSTOMER',
      }

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400)
      expect(mockPrisma.customers.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('Security: Validates item exists', () => {
    it('should return 404 if customer not found', async () => {
      // Arrange
      mockReq.params = { id: 'customer-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'CUSTOMER',
      }

      mockPrisma.customers.findUnique.mockResolvedValueOnce(null)

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Customer not found' })
    })

    it('should return 404 if workspace not found', async () => {
      // Arrange
      mockReq.params = { id: 'workspace-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'WORKSPACE',
      }

      mockPrisma.workspace.findUnique.mockResolvedValueOnce(null)

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Workspace not found' })
    })
  })

  describe('Success: Allow hard-delete of soft-deleted items', () => {
    it('should allow hard-delete of soft-deleted customer', async () => {
      // Arrange
      mockReq.params = { id: 'customer-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'CUSTOMER',
        workspaceId: 'workspace-1',
      }

      const deletedDate = new Date('2025-01-01')
      mockPrisma.customers.findUnique.mockResolvedValueOnce({
        id: 'customer-123',
        deletedAt: deletedDate, // SOFT-DELETED
        name: 'John Doe',
        email: 'john@example.com',
        workspaceId: 'workspace-1',
      })

      mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
        return callback({
          message: { deleteMany: mockPrisma.message.deleteMany },
          chatSession: { deleteMany: mockPrisma.chatSession.deleteMany },
          orderItems: { deleteMany: mockPrisma.orderItems.deleteMany },
          orders: { deleteMany: mockPrisma.orders.deleteMany },
          customers: { delete: mockPrisma.customers.delete },
          softDeleteAuditLog: { create: mockPrisma.softDeleteAuditLog.create },
        })
      })

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Item permanently deleted',
        })
      )
    })
  })

  describe('Audit Logging', () => {
    it('should log admin details in audit trail', async () => {
      // Arrange
      mockReq.params = { id: 'customer-123' }
      mockReq.body = {
        confirmationText: 'PERMANENTLY DELETE',
        entityType: 'CUSTOMER',
        workspaceId: 'workspace-1',
      }

      const deletedDate = new Date('2025-01-01')
      mockPrisma.customers.findUnique.mockResolvedValueOnce({
        id: 'customer-123',
        deletedAt: deletedDate,
        name: 'John Doe',
        email: 'john@example.com',
        workspaceId: 'workspace-1',
      })

      let auditLogData: any = null
      mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
        const tx = {
          message: { deleteMany: jest.fn() },
          chatSession: { deleteMany: jest.fn() },
          orderItems: { deleteMany: jest.fn() },
          orders: { deleteMany: jest.fn() },
          customers: { delete: jest.fn() },
          softDeleteAuditLog: {
            create: jest.fn((data) => {
              auditLogData = data
              return Promise.resolve()
            }),
          },
        }
        return callback(tx)
      })

      // Act
      await controller.permanentlyDeleteItem(mockReq as Request, mockRes as Response)

      // Assert
      expect(auditLogData).toBeTruthy()
      expect(auditLogData.data.reason).toContain('admin@echatbot.ai') // Admin email in reason
      expect(auditLogData.data.deletedByUserId).toBe('admin-123')
    })
  })
})
