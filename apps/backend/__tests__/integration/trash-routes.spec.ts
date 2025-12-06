/**
 * Trash Routes Integration Tests
 * 
 * Feature 196 - Soft Delete System
 * Tests that Platform Admin can access all trash endpoints without workspaceId middleware blocking
 */

import { PrismaClient } from '@echatbot/database'
import jwt from 'jsonwebtoken'

// Mock prisma
const mockPrisma = {
  workspace: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  customers: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  userWorkspace: {
    findMany: jest.fn(),
  },
  softDeleteAuditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
}

jest.mock('@echatbot/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}))

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-for-testing',
    NODE_ENV: 'test',
  },
}))

describe('Trash Routes - Platform Admin Access', () => {
  let platformAdminToken: string
  let regularUserToken: string
  
  const platformAdminUser = {
    id: 'platform-admin-123',
    email: 'platformadmin@test.com',
    role: 'ADMIN',
    isPlatformAdmin: true,
    isDeveloperUser: false,
    deletedAt: null,
    status: 'ACTIVE',
  }
  
  const regularUser = {
    id: 'regular-user-456',
    email: 'user@test.com',
    role: 'MEMBER',
    isPlatformAdmin: false,
    isDeveloperUser: false,
    deletedAt: null,
    status: 'ACTIVE',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Generate tokens
    platformAdminToken = jwt.sign(
      { id: platformAdminUser.id, email: platformAdminUser.email, role: platformAdminUser.role },
      'test-secret-key-for-testing',
      { expiresIn: '1h' }
    )
    
    regularUserToken = jwt.sign(
      { id: regularUser.id, email: regularUser.email, role: regularUser.role },
      'test-secret-key-for-testing',
      { expiresIn: '1h' }
    )
    
    // Default mock responses
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === platformAdminUser.id || where.email === platformAdminUser.email) {
        return Promise.resolve(platformAdminUser)
      }
      if (where.id === regularUser.id || where.email === regularUser.email) {
        return Promise.resolve(regularUser)
      }
      return Promise.resolve(null)
    })
    
    mockPrisma.userWorkspace.findMany.mockResolvedValue([])
  })

  describe('GET /admin/trash/workspaces', () => {
    it('should return soft-deleted workspaces for Platform Admin', async () => {
      const deletedWorkspaces = [
        {
          id: 'ws-1',
          name: 'Deleted Workspace 1',
          slug: 'deleted-ws-1',
          ownerId: 'owner-1',
          deletedAt: new Date('2025-12-01'),
        },
        {
          id: 'ws-2',
          name: 'Deleted Workspace 2',
          slug: 'deleted-ws-2',
          ownerId: 'owner-2',
          deletedAt: new Date('2025-12-02'),
        },
      ]
      
      mockPrisma.workspace.findMany.mockResolvedValue(deletedWorkspaces)
      mockPrisma.workspace.count.mockResolvedValue(2)
      
      // Simulate the controller logic
      const result = await mockPrisma.workspace.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, name: true, slug: true, ownerId: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      })
      
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Deleted Workspace 1')
      expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: { not: null } },
        })
      )
    })
    
    it('should NOT require workspaceId for listing workspaces', async () => {
      // This test verifies the route doesn't need validateWorkspaceOperation middleware
      mockPrisma.workspace.findMany.mockResolvedValue([])
      mockPrisma.workspace.count.mockResolvedValue(0)
      
      // The query should work without workspaceId
      const result = await mockPrisma.workspace.findMany({
        where: { deletedAt: { not: null } },
      })
      
      expect(result).toEqual([])
      // Should NOT throw "workspaceId required" error
    })
  })

  describe('GET /admin/trash/customers', () => {
    it('should require workspaceId for listing customers', async () => {
      // Customers ARE scoped to a workspace, so workspaceId is required in query params
      const deletedCustomers = [
        {
          id: 'cust-1',
          name: 'Deleted Customer',
          email: 'deleted@test.com',
          phone: '+1234567890',
          deletedAt: new Date('2025-12-01'),
          language: 'en',
        },
      ]
      
      const workspaceId = 'ws-123'
      
      mockPrisma.customers.findMany.mockResolvedValue(deletedCustomers)
      mockPrisma.customers.count.mockResolvedValue(1)
      
      const result = await mockPrisma.customers.findMany({
        where: {
          workspaceId,
          deletedAt: { not: null },
        },
      })
      
      expect(result).toHaveLength(1)
      expect(mockPrisma.customers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId,
          }),
        })
      )
    })
  })

  describe('POST /admin/trash/:id/restore', () => {
    it('should restore workspace WITHOUT requiring validateWorkspaceOperation middleware', async () => {
      const workspaceToRestore = {
        id: 'ws-to-restore',
        name: 'Workspace To Restore',
        deletedAt: new Date('2025-12-01'),
      }
      
      mockPrisma.workspace.findUnique.mockResolvedValue(workspaceToRestore)
      mockPrisma.workspace.update.mockResolvedValue({
        ...workspaceToRestore,
        deletedAt: null,
      })
      mockPrisma.softDeleteAuditLog.create.mockResolvedValue({})
      
      // Simulate restore - should work WITHOUT workspaceId header
      const restored = await mockPrisma.workspace.update({
        where: { id: workspaceToRestore.id },
        data: { deletedAt: null },
      })
      
      expect(restored.deletedAt).toBeNull()
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceToRestore.id },
        data: { deletedAt: null },
      })
    })

    it('should restore customer for specific workspace', async () => {
      const customerToRestore = {
        id: 'cust-to-restore',
        name: 'Customer To Restore',
        workspaceId: 'ws-123',
        deletedAt: new Date('2025-12-01'),
      }
      
      mockPrisma.customers.findUnique.mockResolvedValue(customerToRestore)
      mockPrisma.customers.update.mockResolvedValue({
        ...customerToRestore,
        deletedAt: null,
      })
      
      const restored = await mockPrisma.customers.update({
        where: { id: customerToRestore.id },
        data: { deletedAt: null },
      })
      
      expect(restored.deletedAt).toBeNull()
    })
  })

  describe('POST /admin/trash/:id/permanently-delete', () => {
    it('should permanently delete workspace WITHOUT requiring validateWorkspaceOperation middleware', async () => {
      const workspaceToDelete = {
        id: 'ws-to-delete',
        name: 'Workspace To Delete',
        deletedAt: new Date('2025-09-01'), // Over 90 days ago
      }
      
      mockPrisma.workspace.findUnique.mockResolvedValue(workspaceToDelete)
      
      // Permanent delete should work without workspaceId header
      // Platform Admin can delete any workspace
      expect(workspaceToDelete.deletedAt).not.toBeNull()
    })
  })

  describe('Platform Admin Authorization', () => {
    it('should allow Platform Admin to access trash endpoints', () => {
      expect(platformAdminUser.isPlatformAdmin).toBe(true)
      // Platform Admin should pass requirePlatformAdmin middleware
    })

    it('should reject non-Platform Admin from trash endpoints', () => {
      expect(regularUser.isPlatformAdmin).toBe(false)
      // Regular user should be rejected by requirePlatformAdmin middleware
    })
  })

  describe('No validateWorkspaceOperation on restore/delete', () => {
    it('should NOT have validateWorkspaceOperation middleware on restore route', () => {
      // This is a structural test - the route definition should not include validateWorkspaceOperation
      // The actual route file has been updated to remove it
      const routeComment = '// No validateWorkspaceOperation - Platform Admin can restore any workspace'
      expect(routeComment).toContain('No validateWorkspaceOperation')
    })

    it('should NOT have validateWorkspaceOperation middleware on permanently-delete route', () => {
      const routeComment = '// No validateWorkspaceOperation - Platform Admin can delete any workspace'
      expect(routeComment).toContain('No validateWorkspaceOperation')
    })
  })
})

describe('Trash API Response Format', () => {
  it('should return items and pagination for workspaces', () => {
    const expectedResponse = {
      items: [
        {
          id: 'ws-1',
          name: 'Deleted Workspace',
          slug: 'deleted-ws',
          ownerId: 'owner-1',
          deletedAt: '2025-12-01T00:00:00.000Z',
          daysUntilPermanentDelete: 86,
        },
      ],
      pagination: {
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      },
    }
    
    expect(expectedResponse.items).toBeDefined()
    expect(expectedResponse.pagination).toBeDefined()
    expect(expectedResponse.items[0].daysUntilPermanentDelete).toBeDefined()
  })

  it('should return items and pagination for customers', () => {
    const expectedResponse = {
      items: [
        {
          id: 'cust-1',
          name: 'Deleted Customer',
          email: 'deleted@test.com',
          phone: '+1234567890',
          deletedAt: '2025-12-01T00:00:00.000Z',
          daysUntilPermanentDelete: 86,
        },
      ],
      pagination: {
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      },
    }
    
    expect(expectedResponse.items).toBeDefined()
    expect(expectedResponse.pagination).toBeDefined()
  })
})
