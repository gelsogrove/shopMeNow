/**
 * Unit Test: LLM Link Auto-Fix
 * Tests that hardcoded links are automatically replaced with proper token-based links
 */

import { LLMService } from '../../services/llm.service'
import { CallingFunctionsService } from '../../services/calling-functions.service'

// Mock the dependencies
jest.mock('../../services/calling-functions.service')
jest.mock('../../services/prompt-processor.service')
jest.mock('../../services/translation-security.service')
jest.mock('../../utils/logger')

describe('LLM Link Auto-Fix', () => {
  let llmService: LLMService
  let mockCallingFunctionsService: jest.Mocked<CallingFunctionsService>

  const mockCustomer = {
    id: 'customer-123',
    name: 'Mario Rossi',
    phone: '+393515334482',
    email: 'mario@test.com',
    workspaceId: 'workspace-123',
    language: 'it',
  }

  const mockWorkspace = {
    id: 'workspace-123',
    name: 'Test Workspace',
    url: 'http://localhost:3000',
    agentConfigs: [{
      systemPrompt: 'Test prompt',
      model: 'gpt-4-mini',
      temperature: 0.7,
    }],
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create fresh instance
    llmService = new LLMService()
    mockCallingFunctionsService = (llmService as any).callingFunctionsService as jest.Mocked<CallingFunctionsService>
  })

  describe('Auto-Fix Hardcoded /orders Links', () => {
    it('should detect and replace hardcoded /orders link', async () => {
      // Mock the getOrdersListLink response
      mockCallingFunctionsService.getOrdersListLink.mockResolvedValue({
        success: true,
        token: 'test-token-123456789',
        linkUrl: 'http://localhost:3000/s/abc123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'orders',
        timestamp: new Date().toISOString(),
      })

      // Simulate LLM response with hardcoded link
      const llmResponse = 'Ecco il link per vedere tutti i tuoi ordini: http://localhost:3000/orders ⏰ Link valido per 1 ora.'

      // Call replaceLinkTokens (which includes auto-fix logic)
      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      // Verify the hardcoded link was replaced
      expect(result).not.toContain('http://localhost:3000/orders')
      expect(result).toContain('http://localhost:3000/s/abc123')

      // Verify linkReplacements array was populated
      expect(linkReplacements.length).toBeGreaterThan(0)
      
      // Find the auto-fix replacement
      const autoFixReplacement = linkReplacements.find(r => r.autoFixed === true)
      expect(autoFixReplacement).toBeDefined()
      expect(autoFixReplacement?.token).toContain('AUTO-FIX')
      expect(autoFixReplacement?.replacedWith).toBe('http://localhost:3000/s/abc123')
      expect(autoFixReplacement?.shortUrlCreated).toBe(true)

      // Verify getOrdersListLink was called
      expect(mockCallingFunctionsService.getOrdersListLink).toHaveBeenCalledWith({
        customerId: mockCustomer.id,
        workspaceId: mockWorkspace.id,
      })
    })

    it('should NOT replace /orders-public links', async () => {
      const llmResponse = 'Puoi vedere l\'ordine qui: http://localhost:3000/orders-public/ORD-001?token=xyz'

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      // Verify /orders-public was NOT replaced
      expect(result).toContain('http://localhost:3000/orders-public/ORD-001?token=xyz')
      
      // Verify NO auto-fix was applied
      const autoFixReplacement = linkReplacements.find(r => r.autoFixed === true)
      expect(autoFixReplacement).toBeUndefined()

      // Verify getOrdersListLink was NOT called
      expect(mockCallingFunctionsService.getOrdersListLink).not.toHaveBeenCalled()
    })

    it('should replace multiple hardcoded /orders links', async () => {
      mockCallingFunctionsService.getOrdersListLink.mockResolvedValue({
        success: true,
        token: 'test-token-123456789',
        linkUrl: 'http://localhost:3000/s/abc123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'orders',
        timestamp: new Date().toISOString(),
      })

      const llmResponse = `
        Link 1: http://localhost:3000/orders
        Link 2: http://localhost:3000/orders
      `

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      // Both links should be replaced
      expect(result).not.toContain('http://localhost:3000/orders')
      expect((result.match(/http:\/\/localhost:3000\/s\/abc123/g) || []).length).toBe(2)
    })
  })

  describe('Auto-Fix Hardcoded /checkout Links', () => {
    it('should detect and replace hardcoded /checkout link', async () => {
      mockCallingFunctionsService.getCartLink.mockResolvedValue({
        success: true,
        token: 'test-checkout-token-123',
        linkUrl: 'http://localhost:3000/s/xyz789',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'cart',
        timestamp: new Date().toISOString(),
      })

      const llmResponse = 'Clicca qui per il carrello: http://localhost:3000/checkout'

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      expect(result).not.toContain('http://localhost:3000/checkout')
      expect(result).toContain('http://localhost:3000/s/xyz789')

      const autoFixReplacement = linkReplacements.find(r => r.autoFixed === true)
      expect(autoFixReplacement).toBeDefined()
      expect(autoFixReplacement?.token).toContain('AUTO-FIX')
      expect(autoFixReplacement?.token).toContain('checkout')

      expect(mockCallingFunctionsService.getCartLink).toHaveBeenCalledWith({
        customerId: mockCustomer.id,
        workspaceId: mockWorkspace.id,
      })
    })
  })

  describe('Token Replacement (Normal Flow)', () => {
    it('should replace [LINK_ORDERS_WITH_TOKEN] with proper link', async () => {
      mockCallingFunctionsService.getOrdersListLink.mockResolvedValue({
        success: true,
        token: 'normal-token-456',
        linkUrl: 'http://localhost:3000/s/def456',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'orders',
        timestamp: new Date().toISOString(),
      })

      const llmResponse = 'Ecco il link: [LINK_ORDERS_WITH_TOKEN] ⏰ Link valido per 1 ora.'

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      expect(result).not.toContain('[LINK_ORDERS_WITH_TOKEN]')
      expect(result).toContain('http://localhost:3000/s/def456')

      const normalReplacement = linkReplacements.find(r => r.token === '[LINK_ORDERS_WITH_TOKEN]')
      expect(normalReplacement).toBeDefined()
      expect(normalReplacement?.autoFixed).toBeUndefined() // NOT an auto-fix
      expect(normalReplacement?.replacedWith).toBe('http://localhost:3000/s/def456')
    })

    it('should replace [LINK_CHECKOUT_WITH_TOKEN] with proper link', async () => {
      mockCallingFunctionsService.getCartLink.mockResolvedValue({
        success: true,
        token: 'checkout-token-789',
        linkUrl: 'http://localhost:3000/s/ghi789',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'cart',
        timestamp: new Date().toISOString(),
      })

      const llmResponse = 'Carrello: [LINK_CHECKOUT_WITH_TOKEN]'

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      expect(result).not.toContain('[LINK_CHECKOUT_WITH_TOKEN]')
      expect(result).toContain('http://localhost:3000/s/ghi789')

      const normalReplacement = linkReplacements.find(r => r.token === '[LINK_CHECKOUT_WITH_TOKEN]')
      expect(normalReplacement).toBeDefined()
      expect(normalReplacement?.autoFixed).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle response with no links', async () => {
      const llmResponse = 'Ciao! Come posso aiutarti oggi?'

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      expect(result).toBe(llmResponse)
      expect(linkReplacements.length).toBe(0)
      expect(mockCallingFunctionsService.getOrdersListLink).not.toHaveBeenCalled()
      expect(mockCallingFunctionsService.getCartLink).not.toHaveBeenCalled()
    })

    it('should handle mixed tokens and hardcoded links', async () => {
      mockCallingFunctionsService.getOrdersListLink.mockResolvedValue({
        success: true,
        token: 'mixed-token-111',
        linkUrl: 'http://localhost:3000/s/mix111',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'orders',
        timestamp: new Date().toISOString(),
      })

      mockCallingFunctionsService.getCartLink.mockResolvedValue({
        success: true,
        token: 'mixed-token-222',
        linkUrl: 'http://localhost:3000/s/mix222',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'cart',
        timestamp: new Date().toISOString(),
      })

      const llmResponse = `
        Ordini: [LINK_ORDERS_WITH_TOKEN]
        Checkout: http://localhost:3000/checkout
      `

      const linkReplacements: any[] = []
      const result = await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      // Both should be replaced
      expect(result).not.toContain('[LINK_ORDERS_WITH_TOKEN]')
      expect(result).not.toContain('http://localhost:3000/checkout')
      expect(result).toContain('http://localhost:3000/s/mix111')
      expect(result).toContain('http://localhost:3000/s/mix222')

      // Should have 2 replacements
      expect(linkReplacements.length).toBe(2)

      // One normal, one auto-fix
      const normalReplacement = linkReplacements.find(r => r.token === '[LINK_ORDERS_WITH_TOKEN]')
      const autoFixReplacement = linkReplacements.find(r => r.autoFixed === true)

      expect(normalReplacement).toBeDefined()
      expect(autoFixReplacement).toBeDefined()
    })
  })

  describe('Integration with debugInfo', () => {
    it('should populate debugInfo.linkReplacements correctly', async () => {
      mockCallingFunctionsService.getOrdersListLink.mockResolvedValue({
        success: true,
        token: 'debug-token-999',
        linkUrl: 'http://localhost:3000/s/dbg999',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'orders',
        timestamp: new Date().toISOString(),
      })

      const llmResponse = 'Link: http://localhost:3000/orders'

      const linkReplacements: any[] = []
      await (llmService as any).replaceLinkTokens(
        llmResponse,
        mockCustomer,
        mockWorkspace,
        linkReplacements
      )

      // Verify structure matches what frontend expects
      expect(linkReplacements[0]).toMatchObject({
        token: expect.any(String),
        replacedWith: expect.any(String),
        tokenGenerated: expect.any(String),
        shortUrlCreated: expect.any(Boolean),
        timestamp: expect.any(String),
        autoFixed: true,
      })
    })
  })
})
