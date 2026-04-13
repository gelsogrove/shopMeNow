/**
 * E-commerce Variable Filtering Test
 * 
 * Verifies that e-commerce variables ({{products}}, {{offers}}, {{categories}}, 
 * {{services}}, {{lastOrderCode}}, {{cartContents}}) are only replaced when
 * channelMode=true.
 * 
 * Constitution Principle: Database-First Architecture
 * Variables must respect workspace configuration.
 */

import { PromptProcessorService } from '../../../services/prompt-processor.service'
import { PromptVariableBuilder } from '../../../application/services/prompt-variable-builder.service'
import { PromptVariables } from '../../../types/prompt-variables.types'

// Mock dependencies
jest.mock('../../../services/smart-prompt-builder.service', () => ({
  SmartPromptBuilder: {
    buildOptimizedProductList: jest.fn().mockResolvedValue({ products: '' }),
    buildProductsByCategory: jest.fn().mockResolvedValue(''),
    buildProductCharacteristics: jest.fn().mockResolvedValue(''),
  }
}))

describe('E-commerce Variable Filtering', () => {
  let promptProcessor: PromptProcessorService

  beforeEach(() => {
    promptProcessor = new PromptProcessorService(null as any)
  })

  const mockCustomer = {
    id: 'cust_123',
    name: 'Mario Rossi',
    email: 'mario@example.com',
    phone: '+39 123 456 7890',
    discount: 10,
    isActive: true,
    workspaceId: 'ws_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    agentId: null,
    lastInteractionAt: null,
    notes: null,
    language: 'ITALIANO',
    blocked: false,
    blockedReason: null,
  }

  const mockWorkspace = {
    id: 'ws_123',
    name: 'Test Workspace',
    slug: 'test-workspace',
    channelMode: 'ECOMMERCE' as any, // Will be changed per test
    hasSalesAgents: false,
    hasHumanSupport: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }

  const mockDynamicContent = {
    products: '• Product 1\n• Product 2\n• Product 3',
    categories: '• Category A\n• Category B',
    services: '• Service 1\n• Service 2',
    offers: '• Offer 1: 20% off\n• Offer 2: 10% off',
    faqs: '• Q: Question 1?\nA: Answer 1',
  }

  const mockContext = {
    lastOrderCode: 'ORD-2024-001',
    cartContents: '2x Product 1, 1x Product 2',
    channelName: 'WhatsApp Test',
    channel: 'whatsapp' as const,
  }

  describe('E-commerce ENABLED (channelMode=true)', () => {
    it('should replace ALL e-commerce variables', () => {
      const template = `
Products: {{products}}
Categories: {{categories}}
Services: {{services}}
Offers: {{offers}}
Last Order: {{lastOrderCode}}
Cart: {{cartContents}}
FAQs: {{faqs}}
`

      const variables = PromptVariableBuilder.build(
        mockCustomer,
        { ...mockWorkspace, channelMode: 'ECOMMERCE' as any },
        mockDynamicContent,
        mockContext
      )

      const result = promptProcessor.processWithVariables(template, variables)

      // E-commerce variables should be replaced
      expect(result).toContain('Product 1')
      expect(result).toContain('Category A')
      expect(result).toContain('Service 1')
      expect(result).toContain('Offer 1')
      expect(result).toContain('ORD-2024-001')
      expect(result).toContain('2x Product 1')
      
      // Non-ecommerce variables should still work
      expect(result).toContain('Question 1')

      // No unreplaced e-commerce variables
      expect(result).not.toContain('{{products}}')
      expect(result).not.toContain('{{categories}}')
      expect(result).not.toContain('{{services}}')
      expect(result).not.toContain('{{offers}}')
      expect(result).not.toContain('{{lastOrderCode}}')
      expect(result).not.toContain('{{cartContents}}')
    })
  })

  describe('E-commerce DISABLED (channelMode=false)', () => {
    it('should NOT replace e-commerce variables (leave empty)', () => {
      const template = `
Products: {{products}}
Categories: {{categories}}
Services: {{services}}
Offers: {{offers}}
Last Order: {{lastOrderCode}}
Cart: {{cartContents}}
FAQs: {{faqs}}
`

      const variables = PromptVariableBuilder.build(
        mockCustomer,
        { ...mockWorkspace, channelMode: 'INFORMATIONAL' as any },
        mockDynamicContent,
        mockContext
      )

      const result = promptProcessor.processWithVariables(template, variables)

      // E-commerce variables should be EMPTY (removed)
      expect(result).not.toContain('Product 1')
      expect(result).not.toContain('Category A')
      expect(result).not.toContain('Service 1')
      expect(result).not.toContain('Offer 1')
      expect(result).not.toContain('ORD-2024-001')
      expect(result).not.toContain('2x Product 1')
      
      // Lines should show "Products: " with empty content
      expect(result).toContain('Products: \n')
      expect(result).toContain('Categories: \n')
      expect(result).toContain('Services: \n')
      expect(result).toContain('Offers: \n')
      expect(result).toContain('Last Order: \n')
      expect(result).toContain('Cart: \n')

      // Non-ecommerce variables should still work
      expect(result).toContain('Question 1')
      expect(result).not.toContain('{{faqs}}')
    })

    it('should work with {{#if channelMode}} conditionals', () => {
      const template = `
{{#if channelMode}}
## E-commerce Features
Products: {{products}}
Categories: {{categories}}
{{/if}}

## Customer Support
FAQs: {{faqs}}
`

      const variables = PromptVariableBuilder.build(
        mockCustomer,
        { ...mockWorkspace, channelMode: 'INFORMATIONAL' as any },
        mockDynamicContent,
        mockContext
      )

      const result = promptProcessor.processWithVariables(template, variables)

      // E-commerce section should be completely removed by conditional
      expect(result).not.toContain('## E-commerce Features')
      expect(result).not.toContain('Products:')
      expect(result).not.toContain('Categories:')

      // Support section should remain
      expect(result).toContain('## Customer Support')
      expect(result).toContain('Question 1')
    })
  })

  describe('Legacy aliases', () => {
    it('should filter {{lastordercode}} (lowercase) when e-commerce disabled', () => {
      const template = `Last order: {{lastordercode}}`

      const variables = PromptVariableBuilder.build(
        mockCustomer,
        { ...mockWorkspace, channelMode: 'INFORMATIONAL' as any },
        mockDynamicContent,
        mockContext
      )

      const result = promptProcessor.processWithVariables(template, variables)

      expect(result).not.toContain('ORD-2024-001')
      expect(result).toContain('Last order: ')
    })
  })

  describe('Mixed workspace types', () => {
    it('should allow FAQ variables in informational workspace', () => {
      const template = `
Products: {{products}}
FAQs: {{faqs}}
Company: {{companyName}}
`

      const variables = PromptVariableBuilder.build(
        mockCustomer,
        { ...mockWorkspace, channelMode: 'INFORMATIONAL' as any },
        mockDynamicContent,
        mockContext
      )

      const result = promptProcessor.processWithVariables(template, variables)

      // E-commerce removed
      expect(result).not.toContain('Product 1')

      // Non-ecommerce variables work
      expect(result).toContain('Question 1')
      expect(result).toContain('Test Workspace')
    })
  })
})
