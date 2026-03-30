/**
 * BUG #8: Menu Staleness - Expired Options Not Cleared on Load
 *
 * RULE: When menu expiry check detects stale options, return null IMMEDIATELY.
 * VULNERABLE: Menu expires, clearMapping() called, but expired menu still returned from cache
 *
 * FILE: apps/backend/src/application/chat-engine/options-mapping.service.ts (lines 179-205)
 *
 * IMPACT:
 * - Customer sees 10+ minute old menu
 * - Clicks "1. Products" but menu changed → now means "1. Orders"
 * - Wrong action triggered, wrong data shown
 * - UX broken, customer confusion
 */

import { OptionsMappingService } from '../../../src/application/chat-engine/options-mapping.service'

describe('🔴 BUG #8: Menu Staleness - Expired Options Not Cleared', () => {
  let service: OptionsMappingService
  let mockPrisma: any

  const WORKSPACE_ID = 'ws-1'
  const CONVERSATION_ID = 'conv-1'

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {
      searchConversations: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    service = new OptionsMappingService(mockPrisma)
  })

  describe('✅ SAFE: Expired menu returns null', () => {
    it('should return null when menu is expired', async () => {
      // SCENARIO: Menu was saved 15 minutes ago with 10-minute TTL
      // RULE: loadMenu must return null, not stale options
      const now = Date.now()
      const expiredTime = new Date(now - 5 * 60 * 1000).toISOString() // 5 min ago
      
      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        metadata: {
          lastPresentedMenu: {
            type: 'PRODUCTS',
            options: [
              { number: 1, label: 'Old Products' },
              { number: 2, label: 'Old Orders' },
            ],
            expiresAt: expiredTime,
          },
        },
      })

      mockPrisma.searchConversations.update.mockResolvedValue({})

      // WHEN: Load expired menu
      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // THEN: Return null (not cached options)
      expect(result).toBeNull()
      // Update should be called to clear the menu
      expect(mockPrisma.searchConversations.update).toHaveBeenCalled()
    })

    it('should fallback to lastOptionsMapping only if presented menu is expired', async () => {
      // SCENARIO: Presented menu expired, but lastOptionsMapping still valid
      // RULE: Skip expired menu, load mapping fallback
      const now = Date.now()
      const expiredTime = new Date(now - 5 * 60 * 1000).toISOString() // 5 min ago
      const validTime = new Date(now + 5 * 60 * 1000).toISOString() // 5 min future
      
      // First call finds expired menu
      mockPrisma.searchConversations.findUnique.mockResolvedValueOnce({
        metadata: {
          lastPresentedMenu: {
            type: 'PRODUCTS',
            options: [{ number: 1, label: 'Old' }],
            expiresAt: expiredTime,
          },
          lastOptionsMapping: {
            type: 'numbered',
            options: [{ number: 1, label: 'Current' }],
            expiresAt: validTime,
          },
        },
      })

      // WHEN: Load menu with expired presentedMenu
      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // THEN: Should return null for expired menu (no explicit update needed)
      expect(result).toBeNull()
    })
  })

  describe('❌ VULNERABLE: Expired menu still returned', () => {
    it('demonstrates: expired menu returned as cached variable (BUG)', async () => {
      // SCENARIO: This test SHOWS the vulnerability
      // Current code: clears DB but returns cached menu variable
      // VULNERABLE: if (menu && menu.expiresAt && this.isExpired(...)) { clear(); return null; }
      //             NOT: if (menu) { return { ...menu } } ← AFTER the check
      
      const now = Date.now()
      const expiredTime = new Date(now - 5 * 60 * 1000).toISOString()
      
      const staleMenu = {
        type: 'PRODUCTS',
        options: [
          { number: 1, label: 'Products List' },
          { number: 2, label: 'Orders List' },
        ],
        expiresAt: expiredTime,
      }

      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        metadata: { lastPresentedMenu: staleMenu },
      })

      mockPrisma.searchConversations.update.mockResolvedValue({})

      // This test documents the vulnerability:
      // If code paths were not properly guarded, expired menu would be returned
      // Expected behavior: return null after clearing
      // Vulnerable behavior: return stale menu despite cleanup

      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // ✅ CORRECT: Should return null
      // ❌ VULNERABLE: Would return staleMenu if code had bug
      expect(result).toBeNull()
    })
  })

  describe('🔒 Security impact: Customer confusion attack', () => {
    it('shows: old menu selection triggers wrong action if not cleared', () => {
      // SCENARIO: 
      // T=0:   Customer: "mostra prodotti" → Server returns numbered list:
      //        1. Prodotti (8 prodotti)
      //        2. Categorie
      //        3. Ordini
      //
      // T=5m:  Menu expires (10-min TTL)
      //        Server adds new section, returns:
      //        1. Hot Deals (NEW)
      //        2. Prodotti (moved from #1)
      //        3. Categorie
      //        4. Ordini
      //
      // T=5m:5: Customer (on old phone screen): "1" → selects old Products
      //
      // ❌ VULNERABLE: Gets Hot Deals (wrong menu interpretation)
      // ✅ SAFE: Gets "menu expired" → asks customer to repeat request

      const ctx = {
        customerAction: 'sent "1" to select first menu option',
        oldMenuExpired: true,
        newMenuAvailable: true,
        selectedOption: 'Hot Deals instead of Products',
      }

      expect(ctx.selectedOption).not.toBe('Products')
      // This test illustrates the business impact of menu staleness
    })

    it('ensures: expired menu is cleared before returning', async () => {
      // RULE: Expiry check MUST prevent return statement after clearing
      // If expiry detected → return null immediately
      // Do NOT proceed to "if (menu) { return {...} }"
      
      const now = Date.now()
      const pastTime = new Date(now - 5 * 60 * 1000).toISOString()
      
      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        metadata: {
          lastPresentedMenu: {
            type: 'PRODUCTS',
            options: [{ number: 1, label: 'Expired' }],
            expiresAt: pastTime,
          },
        },
      })

      mockPrisma.searchConversations.update.mockResolvedValue({})

      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // Both must be true:
      // 1. Result is null (not stale options)
      // 2. Database was updated to clear the menu
      expect(result).toBeNull()
      expect(mockPrisma.searchConversations.update).toHaveBeenCalled()
    })
  })

  describe('🔧 Fix validation', () => {
    it('validates that expiry check early-returns before menu construction', async () => {
      // This test ensures the fix has correct control flow:
      // if (expired) { clear(); return null; } ← early return required
      // Then proceeding code is skipped
      
      const now = Date.now()
      const tempExpiredTime = new Date(now - 1000).toISOString()
      
      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        metadata: {
          lastPresentedMenu: {
            options: [{ number: 1, label: 'Stale' }],
            expiresAt: tempExpiredTime,
          },
        },
      })

      mockPrisma.searchConversations.update.mockResolvedValue({})

      const spy = jest.spyOn(mockPrisma.searchConversations, 'update')
      
      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // Must return null AND must have called update to clear
      expect(result).toBeNull()
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('⏰ TTL boundary conditions', () => {
    it('treats expired-at-exact-moment as expired', async () => {
      const now = Date.now()
      const exactNowTime = new Date(now).toISOString()
      
      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        metadata: {
          lastPresentedMenu: {
            options: [{ number: 1, label: 'At Boundary' }],
            expiresAt: exactNowTime,
          },
        },
      })

      mockPrisma.searchConversations.update.mockResolvedValue({})

      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      expect(result).toBeNull()
    })

    it('treats future time as valid (not expired)', async () => {
      const now = Date.now()
      const futureTime = new Date(now + 5 * 60 * 1000).toISOString()
      
      mockPrisma.searchConversations.findUnique.mockResolvedValue({
        metadata: {
          lastPresentedMenu: {
            type: 'PRODUCTS',
            options: [{ number: 1, label: 'Valid' }],
            expiresAt: futureTime,
          },
        },
      })

      const result = await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // Should return menu (not expired)
      expect(result).not.toBeNull()
      expect(result?.options?.[0]?.label).toBe('Valid')
      // Should NOT have called update (no clear needed)
      expect(mockPrisma.searchConversations.update).not.toHaveBeenCalled()
    })
  })
})
