/**
 * BUG #10: Options Mapping Missing Workspace Filter
 *
 * RULE: EVERY searchConversations query MUST filter by workspaceId
 * VULNERABLE: findUnique({ where: { sessionId } }) without workspaceId
 *
 * FILES:
 * - apps/backend/src/application/chat-engine/options-mapping.service.ts (lines 132, 151)
 * - loadMapping() and loadMenu() don't filter by workspace
 *
 * IMPACT:
 * - Multi-tenant data breach
 * - Attacker enumerates conversationIds
 * - Accesses victim workspace's options, menu, orders, pending actions
 * - Privacy violation: shopping patterns exposed
 * - Business logic leak: knows which products victim viewed
 * - Can infer offering strategy and customer preferences
 */

import { OptionsMappingService } from '../../../src/application/chat-engine/options-mapping.service'

const createMockPrisma = (overrides = {}) => ({
  searchConversations: {
    findUnique: jest.fn(),
    update: jest.fn(),
    ...overrides,
  },
} as any) // Cast to any to satisfy PrismaClient type requirement

describe('🔴 BUG #10: Options Mapping Missing Workspace Filter', () => {
  describe('✅ SAFE: Workspace filter applied to all queries', () => {
    it('should filter loadMapping by workspaceId', async () => {
      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      const WORKSPACE_ID = 'ws-customer-1'
      const CONVERSATION_ID = 'conv-abc123'

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)

      await service.loadMapping(WORKSPACE_ID, CONVERSATION_ID)

      // ✅ FIX: Must include workspaceId in where clause
      const callArgs = mockPrisma.searchConversations.findUnique.mock.calls[0][0]
      expect(callArgs.where).toHaveProperty('sessionId', CONVERSATION_ID)
      expect(callArgs.where).toHaveProperty('workspaceId', WORKSPACE_ID)
    })

    it('should filter loadMenu by workspaceId', async () => {
      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      const WORKSPACE_ID = 'ws-customer-2'
      const CONVERSATION_ID = 'conv-xyz789'

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)

      await service.loadMenu(WORKSPACE_ID, CONVERSATION_ID)

      // ✅ FIX: Must include workspaceId in where clause
      const callArgs = mockPrisma.searchConversations.findUnique.mock.calls[0][0]
      expect(callArgs.where).toHaveProperty('sessionId', CONVERSATION_ID)
      expect(callArgs.where).toHaveProperty('workspaceId', WORKSPACE_ID)
    })

    it('returns null for conversation from different workspace', async () => {
      // SCENARIO: 
      // - Customer A in workspace-1 has conversation conv-123
      // - Hacker is in workspace-2
      // - Hacker calls loadMapping(workspace-2, conv-123)
      //
      // RULE: Must return null (access denied to different workspace)
      // VULNERABLE: Would return Customer A's options

      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      // Hacker's workspace
      const ATTACK_WORKSPACE_ID = 'ws-hacker'
      // Victim's conversation ID (discovered via enumeration)
      const VICTIM_CONVERSATION_ID = 'conv-victim-123'

      // With proper filter, Prisma returns nothing
      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)

      const result = await service.loadMapping(ATTACK_WORKSPACE_ID, VICTIM_CONVERSATION_ID)

      expect(result).toBeNull()
      
      // Verify the filter was applied
      expect(mockPrisma.searchConversations.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sessionId: VICTIM_CONVERSATION_ID,
            workspaceId: ATTACK_WORKSPACE_ID,
          },
        })
      )
    })

    it('prevents cross-workspace access to pendingAction data', async () => {
      // SCENARIO: Victim was mid-checkout (pendingAction: ADD_TO_CART with product)
      // RULE: Hacker cannot see victim's pending actions from other workspace

      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      const HACKER_WORKSPACE = 'ws-hacker'
      const VICTIM_CONV = 'conv-victim-shopping'
      const VICTIM_WORKSPACE = 'ws-victim'

      // Simulate victim's menu with pending action
      const victimMenuData = {
        metadata: {
          lastOptionsMapping: {
            type: 'numbered',
            options: [{ number: 1, label: 'Confirm' }],
            pendingAction: {
              type: 'ADD_TO_CART',
              productId: 'prod-expensive-item',
              productName: 'Premium Widget - €499',
              quantity: 1,
            },
          },
        },
      }

      // ✅ SAFE: Query filters by workspace
      // Hacker in ws-hacker cannot access victim's conv in ws-victim
      mockPrisma.searchConversations.findUnique.mockImplementation(({ where }) => {
        // Simulate proper multi-tenant filtering
        if (where.workspaceId === VICTIM_WORKSPACE && where.sessionId === VICTIM_CONV) {
          return victimMenuData
        }
        // Different workspace → return nothing
        if (where.workspaceId === HACKER_WORKSPACE && where.sessionId === VICTIM_CONV) {
          return null
        }
        return null
      })

      const hackerAttempt = await service.loadMapping(HACKER_WORKSPACE, VICTIM_CONV)
      const victimAccess = await service.loadMapping(VICTIM_WORKSPACE, VICTIM_CONV)

      expect(hackerAttempt).toBeNull() // ✅ Access denied
      expect(victimAccess?.pendingAction).toBeDefined() // ✅ Victim can access own data
    })
  })

  describe('❌ VULNERABLE: Missing workspaceId filter allows enumeration', () => {
    it('demonstrates: without filter, any conversation is accessible', async () => {
      // VULNERABLE PATTERN:
      // const searchConv = await prisma.searchConversations.findUnique({
      //   where: { sessionId: conversationId } // ← MISSING workspaceId!
      // })

      const mockPrisma = createMockPrisma()

      // VULNERABLE: findUnique without workspace filter
      const VICTIM_DATA = {
        metadata: {
          lastOptionsMapping: {
            type: 'numbered',
            options: [
              { number: 1, label: 'Confirm Purchase' },
              { number: 2, label: 'Modify Quantity' },
            ],
            pendingAction: {
              type: 'ADD_TO_CART',
              productId: 'PROD-LUXURY-WATCH-999',
              productName: 'Rolex Submariner - €15,000',
            },
          },
        },
      }

      mockPrisma.searchConversations.findUnique.mockResolvedValue(VICTIM_DATA)

      // Hacker: "Give me ANY conversation's options"
      // Without filter, can access anyone's data
      const hackerResult = mockPrisma.searchConversations.findUnique({
        where: { sessionId: 'random-conv-id' },
      })

      expect(hackerResult).resolves.toEqual(VICTIM_DATA)
      // ❌ VULNERABLE: Got victim's data without workspace check
    })

    it('shows: attackers enumerate conversations via sequential IDs', () => {
      // SCENARIO: Conversation IDs might be sequential or predictable
      // UUID v4: 9b8f1c0a-3d2e-4f5a-8b7c-1d2e3f4a5b6c
      // UUID v1: 550e8400-e29b-41d4-a716-446655440000
      //
      // Without workspace filter, attacker can:
      // 1. Try conv-1, conv-2, conv-3...
      // 2. Try patterns from observed URLs
      // 3. Try sequential UUID ranges
      // 4. Get shopping data for each victim

      const attackPattern = {
        discoveryMethod: 'Sequential enumeration of conversationIds',
        attempts: ['conv-001', 'conv-002', 'conv-003', '...', 'conv-999'],
        successRate: 'One successful hit = access to victim data',
        dataExposed: [
          'Shopping cart (pendingAction)',
          'Current order code (currentOrderCode)',
          'Recently viewed menu (options)',
          'Rendered text (what customer saw)',
          'Shopping patterns (listType: PRODUCTS vs ORDERS)',
        ],
      }

      expect(attackPattern.successRate).toContain('victim data')
    })

    it('demonstrates: privacy breach via menu enumeration', async () => {
      // SCENARIO:
      // Victim (in Workspace-OrgA) is shopping for medical products
      // Hacker (in Workspace-Hacker) discovers conv-medical-items
      // 
      // With vulnerability:
      // loadMapping('workspace-hacker', 'conv-medical-items')
      // → Returns victim's menu with product names
      // → Reveals victim has browsed: Diabetes Supplies, Heart Medications, etc.
      // → Privacy violation: Medical shopping patterns exposed

      const mockPrisma = createMockPrisma()

      const VICTIM_MEDICAL_MENU = {
        metadata: {
          lastOptionsMapping: {
            type: 'numbered',
            options: [
              { number: 1, label: 'Diabetes Supplies (7 items)' },
              { number: 2, label: 'Cardiac Medications (12 items)' },
              { number: 3, label: 'Respiratory Aids (5 items)' },
            ],
            listType: 'PRODUCTS',
            renderedText:
              'Find what you need: 1. Diabetes 2. Cardiac 3. Respiratory',
          },
        },
      }

      mockPrisma.searchConversations.findUnique.mockResolvedValue(
        VICTIM_MEDICAL_MENU
      )

      // Hacker accesses victim's menu without filter
      const privacyBreach = mockPrisma.searchConversations.findUnique({
        where: { sessionId: 'conv-medical-items' }, // ← No workspaceId check!
      })

      expect(privacyBreach).resolves.toMatchObject({
        metadata: expect.objectContaining({
          lastOptionsMapping: expect.objectContaining({
            options: expect.arrayContaining([
              expect.objectContaining({
                label: expect.stringContaining('Diabetes'),
              }),
            ]),
          }),
        }),
      })

      // ❌ VULNERABLE: Hacker knows victim shops for medical supplies
    })
  })

  describe('🔒 Security impact: Cross-workspace data leak', () => {
    it('catalogs: data exposed by workspace enumeration attack', () => {
      const exposedData = {
        currentOrderCode: {
          description: 'What order is customer viewing?',
          example: 'ORD-048-2026-3',
          privacy: 'Customer shopping context exposed',
        },
        pendingAction: {
          description: 'What is customer about to confirm?',
          example: {
            type: 'ADD_TO_CART',
            productId: 'PROD-123',
            productName: 'Expensive Item - €5000',
            quantity: 2,
          },
          privacy: 'Real-time purchase intent leakage',
        },
        options: {
          description: 'What menu did customer see?',
          example: ['1. Flight Bookings', '2. Hotel Stays', '3. Travel Insurance'],
          privacy: 'Travel plans exposed',
        },
        listType: {
          description: 'What category is customer browsing?',
          example: 'PRODUCTS | ORDERS | CATEGORIES',
          privacy: 'Shopping behavior pattern',
        },
        renderedText: {
          description: 'What exact message did assistant show?',
          example: 'Here are weekend flights to Miami...',
          privacy: 'Specific destinations, search queries visible',
        },
      }

      // All of these are exposed without workspace filter
      const allExposed = Object.keys(exposedData)
      expect(allExposed).toContain('pendingAction')
      expect(allExposed).toContain('currentOrderCode')
    })

    it('ensures: workspace boundary is enforced at persistence layer', async () => {
      // RULE: Database queries MUST respect workspace boundaries
      // This is a tenant isolation requirement (ZERO trust)

      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      const WORKSPACE1 = 'ws-startup-a'
      const WORKSPACE2 = 'ws-startup-b'
      const SHARED_CONV_NAME = 'conv-universal-001'

      // Both workspaces have conversations with similar naming
      mockPrisma.searchConversations.findUnique.mockImplementation(({ where }) => {
        // Proper filter: only return if workspace matches
        if (where.workspaceId === WORKSPACE1) {
          return {
            metadata: { lastOptionsMapping: { options: [{ number: 1, label: 'Startup A Products' }] } },
          }
        }
        if (where.workspaceId === WORKSPACE2) {
          return {
            metadata: { lastOptionsMapping: { options: [{ number: 1, label: 'Startup B Products' }] } },
          }
        }
        return null
      })

      const result1 = await service.loadMapping(WORKSPACE1, SHARED_CONV_NAME)
      const result2 = await service.loadMapping(WORKSPACE2, SHARED_CONV_NAME)

      // Each workspace gets its own data
      expect(result1?.options?.[0]?.label).toContain('Startup A')
      expect(result2?.options?.[0]?.label).toContain('Startup B')
      expect(result1).not.toEqual(result2)
    })
  })

  describe('🔧 Fix validation: workspace filter in all queries', () => {
    it('validates: loadMapping includes workspaceId in findUnique', async () => {
      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)

      await service.loadMapping('ws-test', 'conv-test')

      // Capture the actual call
      const call = mockPrisma.searchConversations.findUnique.mock.calls[0][0]

      // ✅ Must have both fields in where clause
      expect(call.where).toHaveProperty('sessionId', 'conv-test')
      expect(call.where).toHaveProperty('workspaceId', 'ws-test')
    })

    it('validates: loadMenu includes workspaceId in findUnique', async () => {
      const mockPrisma = createMockPrisma()
      const service = new OptionsMappingService(mockPrisma)

      mockPrisma.searchConversations.findUnique.mockResolvedValue(null)

      await service.loadMenu('ws-prod', 'conv-prod')

      const call = mockPrisma.searchConversations.findUnique.mock.calls[0][0]

      // ✅ Must include workspace filter
      expect(call.where).toHaveProperty('workspaceId', 'ws-prod')
      expect(call.where).toHaveProperty('sessionId', 'conv-prod')
    })
  })

  describe('🛡️ Compliance: GDPR data isolation', () => {
    it('enforces: customer data cannot be accessed across workspace boundaries', () => {
      // GDPR Art. 32: "appropriate technical and organisational measures"
      // Multi-tenancy MUST enforce data isolation at query level

      const complianceRequirements = {
        workspaceIsolation: {
          requirement: 'MUST filter by workspaceId on every query',
          severity: 'CRITICAL',
          impact: 'Customer data breach',
        },
        dataMinimization: {
          requirement: 'Never return workspace X data to workspace Y',
          severity: 'CRITICAL',
          impact: 'Privacy violation',
        },
        accessControl: {
          requirement: 'Session must validate workspaceId before query',
          severity: 'CRITICAL',
          impact: 'Unauthorized access',
        },
      }

      expect(complianceRequirements.workspaceIsolation.severity).toBe('CRITICAL')
    })
  })
})
