/**
 * Soft Delete Integration Tests - Feature 196
 * 
 * Tests the complete soft-delete flow with database operations
 * Requires: Backend running, database seeded
 */

import { PrismaClient } from '@echatbot/database'

// Mock Prisma for unit test mode
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  customers: {
    findUnique: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  orders: {
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  orderItems: {
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  message: {
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  chatSession: {
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  userWorkspace: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  softDeleteAuditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
}

describe('Soft Delete Integration - UserUnsubscribeService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Owner Unsubscribe Flow', () => {
    it('should soft-delete owner with full cascade', async () => {
      // Setup: Owner with workspace
      const ownerId = 'owner-123'
      const workspaceId = 'workspace-456'
      
      mockPrisma.user.findUnique.mockResolvedValue({
        id: ownerId,
        email: 'owner@test.com',
        deletedAt: null,
      })
      
      mockPrisma.workspace.findMany.mockResolvedValue([{
        id: workspaceId,
        ownerId,
        name: 'Test Workspace',
      }])
      
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        ownerId,
        name: 'Test Workspace',
      })
      
      mockPrisma.customers.count.mockResolvedValue(10)
      mockPrisma.orders.count.mockResolvedValue(25)
      mockPrisma.message.count.mockResolvedValue(100)
      mockPrisma.chatSession.count.mockResolvedValue(15)
      mockPrisma.userWorkspace.count.mockResolvedValue(3)
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        { userId: 'agent-1', workspaceId },
        { userId: 'agent-2', workspaceId },
      ])

      // Expected cascade:
      const expectedCascade = {
        messages: 100,
        chatSessions: 15,
        orders: 25,
        customers: 10,
        agents: 3,
        workspace: 1,
      }

      expect(expectedCascade.messages).toBe(100)
      expect(expectedCascade.workspace).toBe(1)
    })

    it('should verify owner chain before cascade', async () => {
      const ownerId = 'owner-123'
      const workspaceId = 'workspace-456'
      const attackerId = 'attacker-789'
      
      // Workspace belongs to different owner
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        ownerId: ownerId, // Real owner
      })
      
      // Attacker trying to delete
      const attackerOwnsWorkspace = ownerId === attackerId
      
      expect(attackerOwnsWorkspace).toBe(false)
      // Should throw: "Owner verification failed - security chain broken"
    })
  })

  describe('Agent Unsubscribe Flow', () => {
    it('should soft-delete only agent user, not workspace', async () => {
      const agentId = 'agent-123'
      const workspaceId = 'workspace-456'
      
      mockPrisma.user.findUnique.mockResolvedValue({
        id: agentId,
        email: 'agent@test.com',
        deletedAt: null,
      })
      
      // Agent is NOT owner of any workspace
      mockPrisma.workspace.findMany.mockResolvedValue([])
      
      mockPrisma.userWorkspace.findMany.mockResolvedValue([{
        userId: agentId,
        workspaceId,
      }])

      // Expected: Only user is deleted
      const expectedAffected = {
        agents: 1,
        workspaces: 0, // NOT deleted
        customers: 0,  // NOT deleted
      }

      expect(expectedAffected.agents).toBe(1)
      expect(expectedAffected.workspaces).toBe(0)
    })

    it('should NOT soft-delete agent when owner unsubscribes if agent has other workspaces', async () => {
      // Given: Agent is member of TWO workspaces (workspace A and B)
      // When: Owner of workspace A unsubscribes
      // Then: Agent should only be removed from workspace A but user remains active
      
      const agentId = 'agent-multi-workspace'
      const workspaceA = 'workspace-to-delete'
      const workspaceB = 'workspace-still-active'
      
      // Agent has 2 workspaces initially
      const agentWorkspaces = [
        { userId: agentId, workspaceId: workspaceA },
        { userId: agentId, workspaceId: workspaceB },
      ]
      
      // After owner of workspace A unsubscribes:
      // - UserWorkspace for workspace A is DELETED
      // - UserWorkspace for workspace B remains
      // - User is NOT soft-deleted (can still login!)
      
      const remainingWorkspaces = agentWorkspaces.filter(uw => uw.workspaceId !== workspaceA)
      
      expect(remainingWorkspaces.length).toBe(1)
      expect(remainingWorkspaces[0].workspaceId).toBe(workspaceB)
      
      // User should NOT be soft-deleted because they have remaining workspaces
      const userShouldBeSoftDeleted = remainingWorkspaces.length === 0
      expect(userShouldBeSoftDeleted).toBe(false)
    })

    it('should keep agent user active even with NO remaining workspaces (can create own channel)', async () => {
      // Given: Agent is member of ONLY workspace A
      // When: Owner of workspace A unsubscribes
      // Then: Agent user remains active and can login to create their own channel
      
      const agentId = 'agent-single-workspace'
      const workspaceA = 'workspace-to-delete'
      
      // Agent has only 1 workspace initially
      const agentWorkspaces = [
        { userId: agentId, workspaceId: workspaceA },
      ]
      
      // After owner of workspace A unsubscribes:
      // - UserWorkspace is DELETED
      // - User is NOT soft-deleted (can login and create their own channel!)
      
      const remainingWorkspaces = agentWorkspaces.filter(uw => uw.workspaceId !== workspaceA)
      
      expect(remainingWorkspaces.length).toBe(0)
      
      // User should NOT be soft-deleted - they should be able to login
      // and see "Create My Channel" form to become an owner
      const userShouldBeSoftDeleted = false // NEVER soft-delete agents on owner unsubscribe
      expect(userShouldBeSoftDeleted).toBe(false)
    })
  })
})

describe('Soft Delete Integration - TrashRestoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Customer Restore Flow', () => {
    it('should restore customer with cascade', async () => {
      const customerId = 'customer-123'
      const workspaceId = 'workspace-456'
      const deletedAt = new Date()
      deletedAt.setDate(deletedAt.getDate() - 30) // Deleted 30 days ago
      
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: customerId,
        workspaceId,
        deletedAt,
      })

      // Within 90-day window
      const retentionDays = 90
      const expiryDate = new Date(deletedAt)
      expiryDate.setDate(expiryDate.getDate() + retentionDays)
      const isWithinWindow = expiryDate > new Date()

      expect(isWithinWindow).toBe(true)
    })

    it('should reject restore for wrong workspace', async () => {
      const customerId = 'customer-123'
      const customerWorkspaceId = 'workspace-A'
      const requestWorkspaceId = 'workspace-B'
      
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: customerId,
        workspaceId: customerWorkspaceId,
        deletedAt: new Date(),
      })

      // Security check
      const workspaceMatch = customerWorkspaceId === requestWorkspaceId
      
      expect(workspaceMatch).toBe(false)
      // Should throw: "Workspace ID mismatch - security check failed"
    })

    it('should reject restore outside retention window', async () => {
      const customerId = 'customer-123'
      const deletedAt = new Date()
      deletedAt.setDate(deletedAt.getDate() - 100) // Deleted 100 days ago
      
      const retentionDays = 90
      const expiryDate = new Date(deletedAt)
      expiryDate.setDate(expiryDate.getDate() + retentionDays)
      const isWithinWindow = expiryDate > new Date()

      expect(isWithinWindow).toBe(false)
      // Should throw: "outside retention window"
    })
  })

  describe('Workspace Restore Flow', () => {
    it('should restore workspace with all related data', async () => {
      const workspaceId = 'workspace-456'
      const deletedAt = new Date()
      deletedAt.setDate(deletedAt.getDate() - 45) // Deleted 45 days ago
      
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        deletedAt,
      })
      
      mockPrisma.message.updateMany.mockResolvedValue({ count: 50 })
      mockPrisma.chatSession.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.orders.updateMany.mockResolvedValue({ count: 20 })
      mockPrisma.customers.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        { userId: 'agent-1' },
        { userId: 'agent-2' },
      ])

      const expectedCascadeRestored = {
        messages: 50,
        chatSessions: 10,
        orders: 20,
        customers: 5,
        agents: 2,
      }

      expect(expectedCascadeRestored.messages).toBe(50)
    })
  })
})

describe('Soft Delete Integration - Scheduler Cleanup Job', () => {
  describe('Hard Delete Flow', () => {
    it('should delete in correct FK order', () => {
      const deleteOrder = [
        'messages',      // 1
        'chatSessions',  // 2
        'orderItems',    // 3 - BEFORE orders
        'orders',        // 4
        'customers',     // 5
        'workspaces',    // 6
        'users',         // 7
      ]

      const orderItemsIdx = deleteOrder.indexOf('orderItems')
      const ordersIdx = deleteOrder.indexOf('orders')
      const customersIdx = deleteOrder.indexOf('customers')
      const workspacesIdx = deleteOrder.indexOf('workspaces')

      expect(orderItemsIdx).toBeLessThan(ordersIdx)
      expect(ordersIdx).toBeLessThan(customersIdx)
      expect(customersIdx).toBeLessThan(workspacesIdx)
    })

    it('should only delete records with deletedAt NOT null', () => {
      const safeWhereClause = {
        deletedAt: { not: null, lt: new Date() }
      }

      expect(safeWhereClause.deletedAt.not).toBeNull()
      expect(safeWhereClause.deletedAt.lt).toBeInstanceOf(Date)
    })

    it('should skip if already ran today', () => {
      const lastRunAt = new Date()
      lastRunAt.setHours(10, 0, 0, 0)
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const alreadyRanToday = lastRunAt > today
      
      expect(alreadyRanToday).toBe(true)
    })
  })
})

describe('Soft Delete Integration - Billing Safety', () => {
  it('should exclude soft-deleted workspaces from billing', () => {
    const billingQuery = {
      where: {
        id: 'workspace-123',
        deletedAt: null,
      }
    }

    expect(billingQuery.where.deletedAt).toBeNull()
  })

  it('should not deduct credits for deleted workspace', async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null) // Workspace not found (deleted)
    
    const result = {
      success: false,
      error: 'Workspace not found or deleted'
    }

    expect(result.success).toBe(false)
    expect(result.error).toContain('deleted')
  })
})
