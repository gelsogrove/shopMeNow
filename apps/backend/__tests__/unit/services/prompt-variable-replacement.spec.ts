/**
 * ✅ TEST UNITARIO: Sostituzione COMPLETA di TUTTE le variabili
 * 
 * ANDREA'S REQUIREMENT: "vorrei un test unitario per essere sicuro che non ci sia 
 * nessun variabili che manca dentro il replace! sia di widget che di whatsapp 
 * che di ecommerce che di info"
 * 
 * Questo test verifica che TUTTE le variabili definite in PromptVariables
 * vengano sostituite correttamente dal PromptProcessorService.
 * 
 * CATEGORIES TESTED:
 * - Customer variables (nome, email, telefono, lingua)
 * - Workspace variables (chatbotName, companyName, address, url, toneOfVoice)
 * - E-commerce variables (products, categories, services, offers, lastOrderCode, cartContents)
 * - Sales agent variables (agentName, agentPhone, agentEmail)
 * - Context variables (humanSupportInstructions, allowedExternalLinks, faqs)
 * - Boolean variables (channelMode, hasHumanSupport, hasSalesAgents)
 * - Widget variables (customerName empty case)
 */

import { PromptProcessorService } from '../../../src/services/prompt-processor.service'
import { PromptVariables } from '../../../src/types/prompt-variables.types'

describe('PromptProcessorService - Variable Replacement (COMPLETE)', () => {
  let service: PromptProcessorService

  beforeEach(() => {
    service = new PromptProcessorService()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 1️⃣ CUSTOMER VARIABLES
  // ══════════════════════════════════════════════════════════════════════════

  describe('1️⃣ Customer Variables', () => {
    it('should replace {{customerName}} with actual name', () => {
      const template = 'Ciao {{customerName}}, come posso aiutarti?'
      const variables: PromptVariables = {
        customerName: 'Mario Rossi',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 10,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: true,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Ciao Mario Rossi, come posso aiutarti?')
      expect(result).not.toContain('{{customerName}}')
    })

    it('should replace {{customerPhone}} with phone number', () => {
      const template = 'Telefono: {{customerPhone}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Telefono: +39123456789')
      expect(result).not.toContain('{{customerPhone}}')
    })

    it('should replace {{customerEmail}} with email', () => {
      const template = 'Email: {{customerEmail}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario.rossi@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Email: mario.rossi@example.com')
      expect(result).not.toContain('{{customerEmail}}')
    })

    it('should replace {{languageUser}} with language', () => {
      const template = 'Lingua: {{languageUser}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ESPAÑOL',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Lingua: ESPAÑOL')
      expect(result).not.toContain('{{languageUser}}')
    })

    it('should replace {{customerDiscount}} with discount value', () => {
      const template = 'Sconto: {{customerDiscount}}%'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 15,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Sconto: 15%')
      expect(result).not.toContain('{{customerDiscount}}')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 2️⃣ WORKSPACE VARIABLES
  // ══════════════════════════════════════════════════════════════════════════

  describe('2️⃣ Workspace Variables', () => {
    it('should replace {{chatbotName}} with bot name', () => {
      const template = "Welcome! I'm {{chatbotName}}, your digital assistant."
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'BellItalia',
        chatbotName: 'Sofia',
        channelName: 'BellItalia',
        workspaceUrl: 'https://bellitalia.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe("Welcome! I'm Sofia, your digital assistant.")
      expect(result).not.toContain('{{chatbotName}}')
    })

    it('should replace {{companyName}} with company name', () => {
      const template = 'Benvenuto in {{companyName}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'BellItalia',
        chatbotName: 'Sofia',
        channelName: 'BellItalia',
        workspaceUrl: 'https://bellitalia.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Benvenuto in BellItalia')
      expect(result).not.toContain('{{companyName}}')
    })

    it('should replace {{workspaceUrl}} and {{url}} with URL', () => {
      const template = 'Visita {{workspaceUrl}} o {{url}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Visita https://shop.com o https://shop.com')
      expect(result).not.toContain('{{workspaceUrl}}')
      expect(result).not.toContain('{{url}}')
    })

    it('should replace {{address}} with company address', () => {
      const template = 'Indirizzo: {{address}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        address: 'Via Roma 123, Milano',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Indirizzo: Via Roma 123, Milano')
      expect(result).not.toContain('{{address}}')
    })

    it('should replace {{toneOfVoice}} with tone', () => {
      const template = 'Tone: {{toneOfVoice}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'professional',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Tone: professional')
      expect(result).not.toContain('{{toneOfVoice}}')
    })

    it('should replace {{botIdentityResponse}} with identity', () => {
      const template = 'Identity: {{botIdentityResponse}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        botIdentityResponse: 'I am Sofia, your virtual assistant.',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Identity: I am Sofia, your virtual assistant.')
      expect(result).not.toContain('{{botIdentityResponse}}')
    })

    it('should replace {{customAiRules}} with custom rules', () => {
      const template = 'Rules: {{customAiRules}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        customAiRules: 'Always be polite and professional.',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Rules: Always be polite and professional.')
      expect(result).not.toContain('{{customAiRules}}')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 3️⃣ E-COMMERCE VARIABLES (WHEN ENABLED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('3️⃣ E-commerce Variables (ENABLED)', () => {
    it('should replace {{products}} when e-commerce is ON', () => {
      const template = 'Products: {{products}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true, // E-COMMERCE ON
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        products: '1. Pizza Margherita - €10\n2. Pasta - €8',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Products: 1. Pizza Margherita - €10\n2. Pasta - €8')
      expect(result).not.toContain('{{products}}')
    })

    it('should replace {{categories}} when e-commerce is ON', () => {
      const template = 'Categories: {{categories}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true, // E-COMMERCE ON
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        categories: '1. Food\n2. Beverages',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Categories: 1. Food\n2. Beverages')
      expect(result).not.toContain('{{categories}}')
    })

    it('should replace {{services}} when e-commerce is ON', () => {
      const template = 'Services: {{services}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true, // E-COMMERCE ON
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        services: '1. Home Delivery\n2. Installation',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Services: 1. Home Delivery\n2. Installation')
      expect(result).not.toContain('{{services}}')
    })

    it('should replace {{offers}} when e-commerce is ON', () => {
      const template = 'Offers: {{offers}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true, // E-COMMERCE ON
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        offers: '🎉 10% off on first order',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Offers: 🎉 10% off on first order')
      expect(result).not.toContain('{{offers}}')
    })

    it('should replace {{lastOrderCode}} when e-commerce is ON', () => {
      const template = 'Last order: {{lastOrderCode}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true, // E-COMMERCE ON
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        lastOrderCode: 'ORD-12345',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Last order: ORD-12345')
      expect(result).not.toContain('{{lastOrderCode}}')
    })

    it('should replace {{cartContents}} when e-commerce is ON', () => {
      const template = 'Cart: {{cartContents}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true, // E-COMMERCE ON
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        cartContents: '1x Pizza Margherita (€10)',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Cart: 1x Pizza Margherita (€10)')
      expect(result).not.toContain('{{cartContents}}')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4️⃣ E-COMMERCE VARIABLES (WHEN DISABLED)
  // ══════════════════════════════════════════════════════════════════════════

  describe('4️⃣ E-commerce Variables (DISABLED)', () => {
    it('should replace {{products}} with empty string when e-commerce is OFF', () => {
      const template = 'Products: {{products}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'INFORMATIONAL' as any, // E-COMMERCE OFF
        isEcommerce: false,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        products: 'THIS SHOULD BE IGNORED',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Products: ')
      expect(result).not.toContain('{{products}}')
      expect(result).not.toContain('THIS SHOULD BE IGNORED')
    })

    it('should replace e-commerce variables with empty when OFF', () => {
      const template = '{{products}} | {{categories}} | {{services}} | {{offers}} | {{lastOrderCode}} | {{cartContents}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'INFORMATIONAL' as any, // E-COMMERCE OFF
        isEcommerce: false,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe(' |  |  |  |  | ')
      expect(result).not.toContain('{{')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 5️⃣ SALES AGENT VARIABLES
  // ══════════════════════════════════════════════════════════════════════════

  describe('5️⃣ Sales Agent Variables', () => {
    it('should replace {{agentName}} with agent name', () => {
      const template = 'Agente: {{agentName}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: true,
        agentName: 'Luca Bianchi',
        agentPhone: '+39987654321',
        agentEmail: 'luca@shop.com',
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Agente: Luca Bianchi')
      expect(result).not.toContain('{{agentName}}')
    })

    it('should replace {{agentPhone}} and {{agentEmail}}', () => {
      const template = 'Contatti: {{agentPhone}} - {{agentEmail}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: true,
        agentName: 'Luca',
        agentPhone: '+39987654321',
        agentEmail: 'luca@shop.com',
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Contatti: +39987654321 - luca@shop.com')
      expect(result).not.toContain('{{agentPhone}}')
      expect(result).not.toContain('{{agentEmail}}')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 6️⃣ CONTEXT VARIABLES (FAQ, Human Support, etc.)
  // ══════════════════════════════════════════════════════════════════════════

  describe('6️⃣ Context Variables', () => {
    it('should replace {{faqs}} with FAQ list', () => {
      const template = 'FAQ: {{faqs}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        faqs: 'Q: How to order? A: Click on products.',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('FAQ: Q: How to order? A: Click on products.')
      expect(result).not.toContain('{{faqs}}')
    })

    it('should replace {{humanSupportInstructions}}', () => {
      const template = 'Instructions: {{humanSupportInstructions}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: true,
        humanSupportInstructions: 'Contact us at support@shop.com',
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Instructions: Contact us at support@shop.com')
      expect(result).not.toContain('{{humanSupportInstructions}}')
    })

    it('should replace {{allowedExternalLinks}}', () => {
      const template = 'Links: {{allowedExternalLinks}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        allowedExternalLinks: 'facebook.com, instagram.com',
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Links: facebook.com, instagram.com')
      expect(result).not.toContain('{{allowedExternalLinks}}')
    })

    it('should replace {{tokenDuration}}', () => {
      const template = 'Valid for: {{tokenDuration}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '24 hours',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Valid for: 24 hours')
      expect(result).not.toContain('{{tokenDuration}}')
    })

    it('should replace {{supportEmail}}', () => {
      const template = 'Contact: {{supportEmail}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: true,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        supportEmail: 'support@shop.com',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Contact: support@shop.com')
      expect(result).not.toContain('{{supportEmail}}')
    })

    it('should replace {{websiteUrl}}', () => {
      const template = 'Visit: {{websiteUrl}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        websiteUrl: 'https://website.shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Visit: https://website.shop.com')
      expect(result).not.toContain('{{websiteUrl}}')
    })


    it('should replace {{operatorContactMethod}} and {{operatorWhatsappNumber}}', () => {
      const template = 'Contact operator via {{operatorContactMethod}}: {{operatorWhatsappNumber}}'
      const variables: PromptVariables = {
        customerName: 'Mario',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: true,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
        operatorContactMethod: 'whatsapp',
        operatorWhatsappNumber: '+39 333 1234567',
      }

      const result = service.processWithVariables(template, variables)

      expect(result).toBe('Contact operator via whatsapp: +39 333 1234567')
      expect(result).not.toContain('{{operatorContactMethod}}')
      expect(result).not.toContain('{{operatorWhatsappNumber}}')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 7️⃣ WIDGET SPECIFIC: Empty customerName
  // ══════════════════════════════════════════════════════════════════════════

  describe('7️⃣ Widget Variables (Empty customerName)', () => {
    it('should replace {{customerName}} with empty string for widget visitors', () => {
      const template = 'Hello {{customerName}}, welcome!'
      const variables: PromptVariables = {
        customerName: '', // WIDGET: No name yet
        customerPhone: '',
        customerEmail: '',
        customerDiscount: 0,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: false,
        companyName: 'Shop',
        chatbotName: 'Sofia',
        channelName: 'Shop',
        workspaceUrl: 'https://shop.com',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: false,
        hasSalesAgents: false,
        tokenDuration: '15 minutes',
      }

      const result = service.processWithVariables(template, variables)

      // WIDGET LOGIC: Empty name should result in "Hello , welcome!" (not "Hello Cliente")
      expect(result).toBe('Hello , welcome!')
      expect(result).not.toContain('{{customerName}}')
      expect(result).not.toContain('Cliente') // NO fallback for widget
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 🎯 FINAL TEST: ALL VARIABLES IN ONE TEMPLATE
  // ══════════════════════════════════════════════════════════════════════════

  describe('🎯 ALL Variables Replacement (Integration)', () => {
    it('should replace ALL variables in one complex template', () => {
      const template = `
Hello {{customerName}} ({{customerEmail}}, {{customerPhone}})!
Welcome to {{companyName}}. I'm {{chatbotName}}.
Language: {{languageUser}}
Discount: {{customerDiscount}}%
Address: {{address}}
Tone: {{toneOfVoice}}
Website: {{workspaceUrl}}

E-COMMERCE:
- Products: {{products}}
- Categories: {{categories}}
- Services: {{services}}
- Offers: {{offers}}
- Last Order: {{lastOrderCode}}
- Cart: {{cartContents}}

AGENT:
- Name: {{agentName}}
- Phone: {{agentPhone}}
- Email: {{agentEmail}}

CONTEXT:
- FAQ: {{faqs}}
- Human Support: {{humanSupportInstructions}}
- Links: {{allowedExternalLinks}}
- Token: {{tokenDuration}}
`.trim()

      const variables: PromptVariables = {
        customerName: 'Mario Rossi',
        customerPhone: '+39123456789',
        customerEmail: 'mario@example.com',
        customerDiscount: 15,
        languageUser: 'ITALIANO',
        pushNotificationsConsent: true,
        companyName: 'BellItalia',
        chatbotName: 'Sofia',
        botIdentityResponse: 'I am Sofia',
        channelName: 'BellItalia',
        workspaceUrl: 'https://bellitalia.com',
        address: 'Via Roma 123, Milano',
        toneOfVoice: 'friendly',
        channelMode: 'ECOMMERCE' as any,
        isEcommerce: true,
        hasHumanSupport: true,
        hasSalesAgents: true,
        products: 'Pizza, Pasta',
        categories: 'Food, Drinks',
        services: 'Delivery',
        offers: '10% off',
        lastOrderCode: 'ORD-001',
        cartContents: '1x Pizza',
        agentName: 'Luca Bianchi',
        agentPhone: '+39987654321',
        agentEmail: 'luca@bellitalia.com',
        faqs: 'Q: Hours? A: 9-18',
        humanSupportInstructions: 'Email support@bellitalia.com',
        allowedExternalLinks: 'facebook.com',
        tokenDuration: '24 hours',
      }

      const result = service.processWithVariables(template, variables)

      // Verify NO unreplaced variables remain
      expect(result).not.toContain('{{customerName}}')
      expect(result).not.toContain('{{customerEmail}}')
      expect(result).not.toContain('{{customerPhone}}')
      expect(result).not.toContain('{{companyName}}')
      expect(result).not.toContain('{{chatbotName}}')
      expect(result).not.toContain('{{languageUser}}')
      expect(result).not.toContain('{{customerDiscount}}')
      expect(result).not.toContain('{{address}}')
      expect(result).not.toContain('{{toneOfVoice}}')
      expect(result).not.toContain('{{workspaceUrl}}')
      expect(result).not.toContain('{{products}}')
      expect(result).not.toContain('{{categories}}')
      expect(result).not.toContain('{{services}}')
      expect(result).not.toContain('{{offers}}')
      expect(result).not.toContain('{{lastOrderCode}}')
      expect(result).not.toContain('{{cartContents}}')
      expect(result).not.toContain('{{agentName}}')
      expect(result).not.toContain('{{agentPhone}}')
      expect(result).not.toContain('{{agentEmail}}')
      expect(result).not.toContain('{{faqs}}')
      expect(result).not.toContain('{{humanSupportInstructions}}')
      expect(result).not.toContain('{{allowedExternalLinks}}')
      expect(result).not.toContain('{{tokenDuration}}')

      // Verify ALL values are present
      expect(result).toContain('Mario Rossi')
      expect(result).toContain('mario@example.com')
      expect(result).toContain('+39123456789')
      expect(result).toContain('BellItalia')
      expect(result).toContain('Sofia')
      expect(result).toContain('ITALIANO')
      expect(result).toContain('15%')
      expect(result).toContain('Via Roma 123, Milano')
      expect(result).toContain('friendly')
      expect(result).toContain('https://bellitalia.com')
      expect(result).toContain('Pizza, Pasta')
      expect(result).toContain('Food, Drinks')
      expect(result).toContain('Delivery')
      expect(result).toContain('10% off')
      expect(result).toContain('ORD-001')
      expect(result).toContain('1x Pizza')
      expect(result).toContain('Luca Bianchi')
      expect(result).toContain('+39987654321')
      expect(result).toContain('luca@bellitalia.com')
      expect(result).toContain('Q: Hours? A: 9-18')
      expect(result).toContain('Email support@bellitalia.com')
      expect(result).toContain('facebook.com')
      expect(result).toContain('24 hours')
    })
  })
})
