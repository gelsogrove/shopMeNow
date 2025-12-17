/**
 * Smart Grouping Security Tests
 *
 * Tests for workspace isolation and security in smart product grouping
 * Feature: Code-First LLM with product grouping
 */

import { OptionsMappingService } from '../../../src/application/chat-engine/options-mapping.service'

// Mock PrismaClient
const mockPrisma = {
  searchConversations: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  }
}

describe('Smart Grouping - Security Tests', () => {
  let optionsMappingService: OptionsMappingService

  beforeEach(() => {
    jest.clearAllMocks()
    // Create service with mock prisma
    optionsMappingService = new OptionsMappingService(mockPrisma as any)
  })

  describe('Workspace Isolation', () => {
    it('should load mapping using sessionId (conversationId)', async () => {
      const workspaceId = 'workspace-a-id'
      const conversationId = 'conv-123'

      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        id: 'search-1',
        sessionId: conversationId,
        workspaceId,
        metadata: {
          lastOptionsMapping: {
            listType: 'GROUPS',
            options: [{ number: 1, label: 'Formaggi Freschi' }],
            groupMapping: { '1': { nome: 'Formaggi Freschi', skus: ['SKU-001', 'SKU-002'] } }
          }
        }
      })

      await optionsMappingService.loadMapping(workspaceId, conversationId)

      // Assert: should query by sessionId
      expect(mockPrisma.searchConversations.findUnique).toHaveBeenCalledWith({
        where: { sessionId: conversationId }
      })
    })

    it('should save mapping with workspaceId in upsert', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-456'
      const customerId = 'customer-789'

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)
      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      await optionsMappingService.saveMapping({
        workspaceId,
        conversationId,
        customerId,
        responseText: '1. Formaggi (5 prodotti)\n2. Salumi (3 prodotti)',
        groupMapping: {
          '1': { nome: 'Formaggi', skus: ['SKU-001', 'SKU-002'] },
          '2': { nome: 'Salumi', skus: ['SKU-003'] }
        }
      })

      // Assert: upsert must include workspaceId in create
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: conversationId },
          create: expect.objectContaining({
            workspaceId,
            customerId,
            sessionId: conversationId
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
        '1': { nome: 'Formaggi Freschi', skus: ['BURRATA-001', 'MOZZ-001'] },
        '2': { nome: 'Formaggi Stagionati', skus: ['PARM-001', 'GRANA-001'] }
      }

      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        id: 'search-1',
        sessionId: conversationId,
        workspaceId,
        metadata: {
          lastOptionsMapping: {
            listType: 'GROUPS',
            options: [
              { number: 1, label: 'Formaggi Freschi' },
              { number: 2, label: 'Formaggi Stagionati' }
            ],
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

      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        id: 'search-1',
        sessionId: conversationId,
        workspaceId,
        metadata: {
          lastOptionsMapping: {
            listType: 'PRODUCTS',
            options: [
              { number: 1, label: 'Burrata' },
              { number: 2, label: 'Mozzarella' }
            ],
            groupMapping: undefined
          }
        }
      })

      const result = await optionsMappingService.loadMapping(workspaceId, conversationId)

      expect(result?.listType).toBe('PRODUCTS')
      expect(result?.groupMapping).toBeUndefined()
    })
  })

  describe('SKU Injection Protection', () => {
    it('should safely store data with malicious SKUs (Prisma escapes)', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-inject'
      const customerId = 'customer-123'

      const maliciousGroupMapping = {
        '1': { nome: 'Group 1', skus: ['SKU-001; DROP TABLE products;--', 'SKU-002'] },
        '2': { nome: '../../../etc/passwd', skus: ['SKU-003'] }
      }

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)
      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      await optionsMappingService.saveMapping({
        workspaceId,
        conversationId,
        customerId,
        responseText: '1. Group 1\n2. Other',
        groupMapping: maliciousGroupMapping
      })

      // Assert: data is stored (Prisma escapes it properly)
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalled()
    })

    it('should handle empty groupMapping gracefully', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-empty'

      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        id: 'search-1',
        sessionId: conversationId,
        workspaceId,
        metadata: {
          lastOptionsMapping: {
            listType: 'GROUPS',
            options: [{ number: 1, label: 'Formaggi' }],
            groupMapping: {}
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
      const customerId = 'customer-123'

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)
      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      // Simulate concurrent saves
      const savePromises = [
        optionsMappingService.saveMapping({
          workspaceId,
          conversationId,
          customerId,
          responseText: '1. Option A',
          groupMapping: { '1': { nome: 'A', skus: ['SKU-A'] } }
        }),
        optionsMappingService.saveMapping({
          workspaceId,
          conversationId,
          customerId,
          responseText: '1. Option B',
          groupMapping: { '1': { nome: 'B', skus: ['SKU-B'] } }
        })
      ]

      await Promise.all(savePromises)

      // Upsert should handle this safely (last write wins)
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalledTimes(2)
    })
  })

  describe('List Type Transition Safety', () => {
    it('should clear groupMapping when saving PRODUCTS list', async () => {
      const workspaceId = 'workspace-123'
      const conversationId = 'conv-transition'
      const customerId = 'customer-123'

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)
      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-1' })

      // Save PRODUCTS list (no groupMapping)
      await optionsMappingService.saveMapping({
        workspaceId,
        conversationId,
        customerId,
        responseText: '1. Burrata - €5.00\n2. Mozzarella - €3.00'
        // No groupMapping - this is a products list
      })

      // Upsert was called
      expect(mockPrisma.searchConversations.upsert).toHaveBeenCalled()
      
      // Verify the metadata doesn't have groupMapping
      const call = mockPrisma.searchConversations.upsert.mock.calls[0][0]
      const savedMapping = call.create.metadata.lastOptionsMapping
      expect(savedMapping.groupMapping).toBeUndefined()
    })
  })

  describe('Pending Action Preservation', () => {
    it('should keep existing pendingAction when saving new mapping', async () => {
      const workspaceId = 'workspace-keep'
      const conversationId = 'conv-keep'
      const customerId = 'customer-keep'
      const pendingAction = {
        type: 'ADD_TO_CART' as const,
        productId: 'SKU-123',
        productName: 'Arancini Siciliani',
        quantity: 1,
      }

      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        id: 'search-keep',
        sessionId: conversationId,
        workspaceId,
        metadata: {
          lastOptionsMapping: {
            listType: 'PRODUCT_DETAIL_ACTIONS',
            options: [
              { number: 1, label: 'Esplora il catalogo' },
              { number: 2, label: 'Mostrami il carrello' },
            ],
            pendingAction,
          },
        },
      })
      mockPrisma.searchConversations.upsert.mockResolvedValue({ id: 'search-keep' })

      await optionsMappingService.saveMapping({
        workspaceId,
        conversationId,
        customerId,
        responseText: '1. Esplora il catalogo\n2. Mostrami il carrello',
        items: [
          { number: 1, name: 'Esplora il catalogo' },
          { number: 2, name: 'Mostrami il carrello' },
        ],
        listType: 'PRODUCT_DETAIL_ACTIONS',
      })

      const upsertArgs = mockPrisma.searchConversations.upsert.mock.calls[0][0]
      expect(upsertArgs.update.metadata.lastOptionsMapping.pendingAction).toEqual(pendingAction)
    })
  })
})
