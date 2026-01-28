/**
 * Prompt Variables Replace Test
 * 
 * Verifica che tutte le variabili definite in PromptVariables
 * vengano correttamente sostituite nei template.
 */

import { PromptVariableBuilder } from '../application/services/prompt-variable-builder.service'
import { PromptVariables } from '../types/prompt-variables.types'

describe('PromptVariableBuilder - Variable Replace Test', () => {
  
  // Mock data
  const mockCustomer = {
    id: 'cust_123',
    name: 'Mario Rossi',
    email: 'mario@example.com',
    phone: '+39 123 456 7890',
    discount: 10,
    isActive: true,
    language: 'it',
    company: 'Acme Corp',
    push_notifications_consent: true,
    sales: {
      firstName: 'Giulia',
      lastName: 'Bianchi',
      phone: '+39 987 654 3210',
      email: 'giulia@example.com',
    },
  }

  const mockWorkspace = {
    id: 'ws_123',
    name: 'BellItalia Shop',
    url: 'https://bellitalia.com',
    language: 'it',
    toneOfVoice: 'friendly' as const,
    botIdentityResponse: 'Sono Sofia, assistente AI di BellItalia',
    hasHumanSupport: true,
    humanSupportInstructions: 'Contatta il supporto per problemi complessi',
    operatorContactMethod: 'whatsapp' as const,
    operatorWhatsappNumber: '+39 123 456 7890',
    hasSalesAgents: true,
    notificationEmail: 'support@bellitalia.com',
    allowedExternalLinks: ['bellitalia.com', 'instagram.com/bellitalia'],
    sellsProductsAndServices: true,
    address: 'Via Roma 123, Firenze',
    customAiRules: 'Sempre menzionare la collezione Chianti',
    chatbotName: 'Sofia',
    businessType: 'food',
    websiteUrl: 'https://bellitalia.com',
  }

  const mockDynamicContent = {
    products: 'Chianti Classico - €25, Pecorino Romano - €15',
    categories: 'Vini, Formaggi, Salumi',
    services: 'Degustazione, Consulenza',
    offers: 'Sconto 20% su vini - fino al 31/12',
    faqs: 'Q: Spedite in tutta Italia? A: Sì, spediamo ovunque',
  }

  const mockContext = {
    lastOrderCode: 'ORD-2024-001',
    cartContents: '2x Chianti Classico, 1x Pecorino Romano',
    channelName: 'WhatsApp BellItalia',
    channel: 'whatsapp' as const,
  }

  // Template con TUTTE le variabili
  const testTemplate = `
## Customer Info
Name: {{customerName}}
Phone: {{customerPhone}}
Email: {{customerEmail}}
Discount: {{customerDiscount}}%
Active: {{customerIsActive}}
Language: {{languageUser}}
Push: {{pushNotificationsConsent}}

## Sales Agent
Agent: {{agentName}}
Phone: {{agentPhone}}
Email: {{agentEmail}}

## Company Info
Company: {{companyName}}
Bot Identity: {{botIdentityResponse}}
Custom Rules: {{customAiRules}}
Address: {{address}}
Admin Email: {{adminEmail}}
Channel: {{channelName}}
URL: {{workspaceUrl}}
Tone: {{toneOfVoice}}
Human Support: {{hasHumanSupport}}
Support Instructions: {{humanSupportInstructions}}
Sales Agents: {{hasSalesAgents}}
E-commerce: {{sellsProductsAndServices}}
External Links: {{allowedExternalLinks}}
Bot Name: {{chatbotName}}
Business Type: {{businessType}}
Contact Method: {{operatorContactMethod}}
Operator WhatsApp: {{operatorWhatsappNumber}}
Website: {{websiteUrl}}
Support Email: {{supportEmail}}

## Dynamic Content
Products: {{products}}
Categories: {{categories}}
Services: {{services}}
Offers: {{offers}}
FAQs: {{faqs}}

## Context
Last Order: {{lastOrderCode}}
Cart: {{cartContents}}
Token Duration: {{tokenDuration}}
Channel Type: {{channel}}
`

  /**
   * Simple variable replacement (simulates preProcessPrompt)
   */
  function replaceVariables(template: string, variables: PromptVariables): string {
    let result = template
    
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const placeholder = `{{${key}}}`
        const replacement = value.toString()
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement)
      }
    }
    
    return result
  }

  /**
   * Extract unreplaced variables from processed template
   */
  function findUnreplacedVariables(processedTemplate: string): string[] {
    const matches = processedTemplate.match(/\{\{[^}]+\}\}/g)
    return matches || []
  }

  describe('Variable Building', () => {
    it('should build all variables without errors', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext,
        { skipValidation: false }
      )

      expect(variables).toBeDefined()
      expect(typeof variables).toBe('object')
      expect(Object.keys(variables).length).toBeGreaterThan(25)
    })

    it('should include all required customer variables', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      expect(variables.customerName).toBe('Mario Rossi')
      expect(variables.customerPhone).toBe('+39 123 456 7890')
      expect(variables.customerEmail).toBe('mario@example.com')
      expect(variables.customerDiscount).toBe(10)
      expect(variables.customerIsActive).toBe(true)
      expect(variables.languageUser).toBe('ITALIANO')
    })

    it('should include all workspace variables', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      expect(variables.companyName).toBe('BellItalia Shop')
      expect(variables.botIdentityResponse).toBe('Sono Sofia, assistente AI di BellItalia')
      expect(variables.chatbotName).toBe('Sofia')
      expect(variables.businessType).toBe('food')
      expect(variables.address).toBe('Via Roma 123, Firenze')
      expect(variables.websiteUrl).toBe('https://bellitalia.com')
    })

    it('should include sales agent variables', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      expect(variables.agentName).toBe('Giulia Bianchi')
      expect(variables.agentPhone).toBe('+39 987 654 3210')
      expect(variables.agentEmail).toBe('giulia@example.com')
    })

    it('should include dynamic content variables', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      expect(variables.products).toBe('Chianti Classico - €25, Pecorino Romano - €15')
      expect(variables.categories).toBe('Vini, Formaggi, Salumi')
      expect(variables.services).toBe('Degustazione, Consulenza')
      expect(variables.offers).toBe('Sconto 20% su vini - fino al 31/12')
      expect(variables.faqs).toBe('Q: Spedite in tutta Italia? A: Sì, spediamo ovunque')
    })

    it('should include context variables', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      expect(variables.lastOrderCode).toBe('ORD-2024-001')
      expect(variables.cartContents).toBe('2x Chianti Classico, 1x Pecorino Romano')
      expect(variables.channelName).toBe('WhatsApp BellItalia')
      expect(variables.channel).toBe('whatsapp')
    })
  })

  describe('Variable Replacement', () => {
    it('should replace ALL variables in template', () => {
      // Build variables
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext,
        { skipValidation: true }
      )

      // Replace variables
      const processed = replaceVariables(testTemplate, variables)

      // Check for unreplaced variables
      const unreplaced = findUnreplacedVariables(processed)

      // Log details if test fails
      if (unreplaced.length > 0) {
        console.log('❌ UNREPLACED VARIABLES:')
        unreplaced.forEach(v => console.log(`   ${v}`))
        console.log('\n📦 Available variables:')
        Object.keys(variables).forEach(k => console.log(`   {{${k}}}`))
      }

      expect(unreplaced).toHaveLength(0)
    })

    it('should replace customer variables correctly', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      const template = 'Hello {{customerName}}, your email is {{customerEmail}}'
      const processed = replaceVariables(template, variables)

      expect(processed).toBe('Hello Mario Rossi, your email is mario@example.com')
    })

    it('should replace workspace variables correctly', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      const template = 'Welcome to {{companyName}}! I am {{chatbotName}}'
      const processed = replaceVariables(template, variables)

      expect(processed).toBe('Welcome to BellItalia Shop! I am Sofia')
    })

    it('should handle missing variables gracefully', () => {
      const variables = PromptVariableBuilder.build(
        null, // No customer
        mockWorkspace,
        undefined, // No dynamic content
        undefined // No context
      )

      const template = 'Hello {{customerName}}, company: {{companyName}}'
      const processed = replaceVariables(template, variables)

      // Should replace companyName but leave customerName as default
      expect(processed).toContain('BellItalia Shop')
      expect(processed).toContain('Cliente') // Default customer name
    })
  })

  describe('Edge Cases', () => {
    it('should handle null customer data', () => {
      const variables = PromptVariableBuilder.build(
        null,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      expect(variables.customerName).toBe('Cliente') // Default
      expect(variables.customerPhone).toBe('')
      expect(variables.customerEmail).toBe('')
      expect(variables.agentName).toBe('Non assegnato') // Default
    })

    it('should handle null workspace data', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        null,
        mockDynamicContent,
        mockContext
      )

      expect(variables.companyName).toBe('Acme Corp') // From customer.company
      expect(variables.chatbotName).toBe('Assistente') // Default
      expect(variables.toneOfVoice).toBe('friendly') // Default
    })

    it('should handle widget channel correctly', () => {
      const widgetContext = {
        ...mockContext,
        channel: 'widget' as const,
      }

      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        widgetContext
      )

      // Widget should have empty customer name (anonymous)
      expect(variables.customerName).toBe('')
      expect(variables.channel).toBe('widget')
    })

    it('should validate required variables', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext,
        { skipValidation: false }
      )

      const validation = PromptVariableBuilder.validate(variables)
      
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe('Performance', () => {
    it('should build variables quickly', () => {
      const start = Date.now()
      
      for (let i = 0; i < 100; i++) {
        PromptVariableBuilder.build(
          mockCustomer,
          mockWorkspace,
          mockDynamicContent,
          mockContext,
          { skipValidation: true }
        )
      }
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete 100 builds in < 1s
    })

    it('should replace variables quickly', () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer,
        mockWorkspace,
        mockDynamicContent,
        mockContext
      )

      const start = Date.now()
      
      for (let i = 0; i < 100; i++) {
        replaceVariables(testTemplate, variables)
      }
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(500) // Should complete 100 replacements in < 0.5s
    })
  })
})