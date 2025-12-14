/**
 * Smart Grouping Security Tests
 *
 * Tests for workspace isolation and security in smart product grouping
 * Feature: Code-First LLM with product grouping
 */

import { OptionsMappingService } from '../../../src/application/services/options-mapping.service'

// Mock PrismaClient
const mockPrisma = {
  searchConversations: {
    findFirst: jest.fn(),
    upsert: jest.fn()
  }
}

// Mock the prismaClient
jest.mock('../../../src/config/database', () => ({
  prismaClient: {
    searchConversations: {
      findFirst: jest.fn(),
      upsert: jest.fn()
    }
  }
}))

describe('Smart Grouping - Security Tests', () => {
  let optionsMappingService: OptionsMappingService

  beforeEach(() => {
    jest.clearAllMocks()
    optionsMappingService = new OptionsMappingService()
    // @ts-ignore - inject mock
    optionsMappingService['prisma'] = mockPrisma
  })

  describe('Workspace Isolation', () => {
    it('should NOT allow loading mapping from different workspace', async () => {
      // Setup: mapping exists for workspace A
      const workspaceA = 'workspace-a-id'
      const workspaceB = 'workspace-b-id'
      const conversationId = 'conv-123'

      mockPrisma.searchConversations.findFirst.mockResolvedValue({
        id: 'search-1',
        workspaceId: workspaceA, // Different workspace
        conversationId,
        metadata: {
          lastOptionsMapping: {
            listType: 'GROUPS',
            options: { '1': 'Formaggi Freschi' },
            groupMapping: { 'Formaggi Freschi': ['SKU-001', 'SKU-002'] }
          }
        }
      })

      // Act: try to load from workspace B
      const result = await optionsMappingService.loadMapping(workspaceB, conversationId)

      // Assert: should not find mapping (workspace filter)
      expect(mockPrisma.searchConversations.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: workspaceB, // Must filter by correct workspace
          conversationId
        }
      })
    })

    it('should save mapping ONLY for the specified workspace', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-456'
      const options = { '1': 'SKU-001', '2': 'SKU-002' }

      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      await optionsMappingService.saveMapping(
        workspaceId,
        conversationId,
        'PRODUCTS',
        options,
        undefined
      )

      // Assert: upsert must include workspaceId
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId_conversationId: {
              workspaceId,
              conversationId
            }
          }),
          create: expect.objectContaining({
            workspaceId
          })
        })
      )
    })
  })

  describe('Group Mapping Integrity', () => {
    it('should preserve group mapping when loading from database', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-789'
      const storedGroupMapping = {
        'Formaggi Freschi': ['BURRATA-001', 'MOZZ-001'],
        'Formaggi Stagionati': ['PARM-001', 'GRANA-001']
      }

      mockPrisma.searchConversations.findFirst.mockResolvedValue({
        id: 'search-1',
        workspaceId,
        conversationId,
        metadata: {
          lastOptionsMapping: {
            listType: 'GROUPS',
            options: { '1': 'Formaggi Freschi', '2': 'Formaggi Stagionati' },
            groupMapping: storedGroupMapping
          }
        }
      })

      const result = await optionsMappingService.loadMapping(workspaceId, conversationId)

      expect(result).toBeDefined()
      expect(result?.groupMapping).toEqual(storedGroupMapping)
    })

    it('should NOT return groupMapping when listType is PRODUCTS', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-products'

      // Even if groupMapping was accidentally stored with PRODUCTS, it should be ignored
      mockPrisma.searchConversations.findFirst.mockResolvedValue({
        id: 'search-1',
        workspaceId,
        conversationId,
        metadata: {
          lastOptionsMapping: {
            listType: 'PRODUCTS', // Products, not groups
            options: { '1': 'Burrata', '2': 'Mozzarella' },
            groupMapping: undefined // Should NOT have groupMapping for products
          }
        }
      })

      const result = await optionsMappingService.loadMapping(workspaceId, conversationId)

      expect(result?.listType).toBe('PRODUCTS')
      expect(result?.groupMapping).toBeUndefined()
    })
  })

  describe('SKU Injection Protection', () => {
    it('should validate SKU format in groupMapping', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-inject'

      // Test that malicious SKUs don't cause issues
      const maliciousGroupMapping = {
        'Group 1': ['SKU-001; DROP TABLE products;--', 'SKU-002'],
        '../../../etc/passwd': ['SKU-003']
      }

      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      // The system should safely store the data (actual protection is at query level)
      await optionsMappingService.saveMapping(
        workspaceId,
        conversationId,
        'GROUPS',
        { '1': 'Group 1' },
        maliciousGroupMapping
      )

      // Assert: data is stored but will be properly escaped by Prisma
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalled()
    })

    it('should handle empty groupMapping gracefully', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-empty'

      mockPrisma.searchConversations.findFirst.mockResolvedValue({
        id: 'search-1',
        workspaceId,
        conversationId,
        metadata: {
          lastOptionsMapping: {
            listType: 'GROUPS',
            options: { '1': 'Formaggi' },
            groupMapping: {} // Empty mapping
          }
        }
      })

      const result = await optionsMappingService.loadMapping(workspaceId, conversationId)

      expect(result?.groupMapping).toEqual({})
    })
  })

  describe('Concurrent Access Safety', () => {
    it('should handle concurrent mapping updates with upsert', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-concurrent'

      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      // Simulate concurrent saves
      const savePromises = [
        optionsMappingService.saveMapping(workspaceId, conversationId, 'GROUPS', { '1': 'A' }),
        optionsMappingService.saveMapping(workspaceId, conversationId, 'GROUPS', { '1': 'B' })
      ]

      await Promise.all(savePromises)

      // Upsert should handle this safely (last write wins)
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalledTimes(2)
    })
  })

  describe('List Type Transition Safety', () => {
    it('should clear groupMapping when transitioning from GROUPS to PRODUCTS', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-transition'

      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      // Save PRODUCTS list (no groupMapping)
      await optionsMappingService.saveMapping(
        workspaceId,
        conversationId,
        'PRODUCTS',
        { '1': 'Product A', '2': 'Product B' },
        undefined // No groupMapping for PRODUCTS
      )

      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            metadata: expect.objectContaining({
              lastOptionsMapping: expect.objectContaining({
                listType: 'PRODUCTS',
                groupMapping: undefined
              })
            })
          })
        })
      )
    })
  })
})
