/**
 * Widget Greeting Fix Test
 * 
 * Verifies that widget customers (Visitor XXXXX) do NOT get personalized greetings
 * while WhatsApp customers with real names DO get personalized greetings.
 * 
 * Related: Constitution Principle XIV - Widget customers are temporary
 */

import { PromptVariableBuilder } from "../../../src/application/services/prompt-variable-builder.service"
import { PromptProcessorService } from "../../../src/services/prompt-processor.service"

describe("Widget Greeting Fix", () => {
  let promptProcessor: PromptProcessorService

  beforeEach(() => {
    promptProcessor = new PromptProcessorService()
  })

  describe("PromptVariableBuilder - customerName handling", () => {
    it("should keep customerName for widget channel if name is provided", () => {
      const customer = {
        id: "visitor-123",
        name: "Mario Rossi", // Real name, widget channel
        email: null,
        phone: "widget-session-123",
      }

      const workspace = {
        id: "workspace-1",
        name: "Test Shop",
      }

      const context = {
        channel: "widget",
      }

      const variables = PromptVariableBuilder.build(customer, workspace, undefined, context)

      expect(variables.customerName).toBe("Mario Rossi") // Allowed because not "Visitor "
    })

    it("should set customerName to empty for Visitor pattern on ANY channel", () => {
      const customer = {
        id: "visitor-123",
        name: "Visitor abc123def456", // Anonymous visitor pattern
        email: null,
        phone: "+393331234567",
      }

      const workspace = {
        id: "workspace-1",
        name: "Test Shop",
      }

      const context = {
        channel: "whatsapp", // Even on WhatsApp, Visitor pattern = anonymous
      }

      const variables = PromptVariableBuilder.build(customer, workspace, undefined, context)

      // 🚫 Visitor pattern = empty name (no personalized greetings)
      expect(variables.customerName).toBe("")
    })

    it("should use 'Cliente' as fallback when name is missing (non-widget)", () => {
      const customer = {
        id: "customer-123",
        name: null,
        email: "test@example.com",
        phone: "+393331234567",
      }

      const workspace = {
        id: "workspace-1",
        name: "Test Shop",
      }

      const context = {
        channel: "whatsapp", // Non-widget channel
      }

      const variables = PromptVariableBuilder.build(customer, workspace, undefined, context)

      expect(variables.customerName).toBe("Cliente") // Falls back to 'Cliente' for non-widget
    })
  })

  describe("PromptProcessorService - customerName replacement", () => {
    it("should remove customerName from greetings for widget visitors", () => {
      const template = "Ciao {{customerName}}, come posso aiutarti?"

      const variables = {
        customerName: "", // Widget visitor with empty name
        customerPhone: "widget-session-123",
        customerEmail: "",
        customerDiscount: 0,
        customerIsActive: false,
        languageUser: "ITALIANO",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        companyName: "Test Shop",
        botIdentityResponse: "",
        customAiRules: "",
        address: "",
        adminEmail: "",
        channelName: "Test Shop",
        workspaceUrl: "",
        toneOfVoice: "friendly",
        hasHumanSupport: false,
        humanSupportInstructions: "",
        hasSalesAgents: false,
        channelMode: 'ECOMMERCE' as any,
        allowedExternalLinks: "",
        chatbotName: "Assistente",
        businessType: "retail",
        operatorContactMethod: "email",
        operatorWhatsappNumber: "",
        websiteUrl: "",
        supportEmail: "",
        channel: "widget",
      }

      const result = promptProcessor.processWithVariables(template, variables)

      // Should NOT have customer name in greeting
      expect(result).toBe("Ciao , come posso aiutarti?")
    })

    it("should keep customerName in greetings for real customers", () => {
      const template = "Ciao {{customerName}}, come posso aiutarti?"

      const variables = {
        customerName: "Mario Rossi",
        customerPhone: "+393331234567",
        customerEmail: "mario@example.com",
        customerDiscount: 0,
        customerIsActive: true,
        languageUser: "ITALIANO",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        companyName: "Test Shop",
        botIdentityResponse: "",
        customAiRules: "",
        address: "",
        adminEmail: "",
        channelName: "Test Shop",
        workspaceUrl: "",
        toneOfVoice: "friendly",
        hasHumanSupport: false,
        humanSupportInstructions: "",
        hasSalesAgents: false,
        channelMode: 'ECOMMERCE' as any,
        allowedExternalLinks: "",
        chatbotName: "Assistente",
        businessType: "retail",
        operatorContactMethod: "email",
        operatorWhatsappNumber: "",
        websiteUrl: "",
        supportEmail: "",
        channel: "whatsapp",
      }

      const result = promptProcessor.processWithVariables(template, variables)

      expect(result).toBe("Ciao Mario Rossi, come posso aiutarti?")
    })

    it("should use 'Cliente' fallback when customerName is undefined", () => {
      const template = "Ciao {{customerName}}, come posso aiutarti?"

      const variables = {
        customerName: undefined, // Explicitly undefined
        customerPhone: "",
        customerEmail: "",
        customerDiscount: 0,
        customerIsActive: false,
        languageUser: "ITALIANO",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        companyName: "Test Shop",
        botIdentityResponse: "",
        customAiRules: "",
        address: "",
        adminEmail: "",
        channelName: "Test Shop",
        workspaceUrl: "",
        toneOfVoice: "friendly",
        hasHumanSupport: false,
        humanSupportInstructions: "",
        hasSalesAgents: false,
        channelMode: 'ECOMMERCE' as any,
        allowedExternalLinks: "",
        chatbotName: "Assistente",
        businessType: "retail",
        operatorContactMethod: "email",
        operatorWhatsappNumber: "",
        websiteUrl: "",
        supportEmail: "",
        channel: "whatsapp",
      }

      const result = promptProcessor.processWithVariables(template, variables)

      expect(result).toBe("Ciao Cliente, come posso aiutarti?")
    })
  })

  describe("Template conditional {{#if hasCustomerName}}", () => {
    it("should remove greeting section when customerName is empty", () => {
      const template = "{{#if hasCustomerName}}Ciao {{customerName}}, {{/if}}come posso aiutarti?"

      const variables = {
        customerName: "", // Widget visitor
        customerPhone: "widget-session-123",
        customerEmail: "",
        customerDiscount: 0,
        customerIsActive: false,
        languageUser: "ITALIANO",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        companyName: "Test Shop",
        botIdentityResponse: "",
        customAiRules: "",
        address: "",
        adminEmail: "",
        channelName: "Test Shop",
        workspaceUrl: "",
        toneOfVoice: "friendly",
        hasHumanSupport: false,
        humanSupportInstructions: "",
        hasSalesAgents: false,
        channelMode: 'ECOMMERCE' as any,
        allowedExternalLinks: "",
        chatbotName: "Assistente",
        businessType: "retail",
        operatorContactMethod: "email",
        operatorWhatsappNumber: "",
        websiteUrl: "",
        supportEmail: "",
        channel: "widget",
      }

      const result = promptProcessor.processWithVariables(template, variables)

      // Should only show generic greeting
      expect(result).toBe("come posso aiutarti?")
    })

    it("should keep greeting section when customerName exists", () => {
      const template = "{{#if hasCustomerName}}Ciao {{customerName}}, {{/if}}come posso aiutarti?"

      const variables = {
        customerName: "Mario Rossi",
        customerPhone: "+393331234567",
        customerEmail: "mario@example.com",
        customerDiscount: 0,
        customerIsActive: true,
        languageUser: "ITALIANO",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        companyName: "Test Shop",
        botIdentityResponse: "",
        customAiRules: "",
        address: "",
        adminEmail: "",
        channelName: "Test Shop",
        workspaceUrl: "",
        toneOfVoice: "friendly",
        hasHumanSupport: false,
        humanSupportInstructions: "",
        hasSalesAgents: false,
        channelMode: 'ECOMMERCE' as any,
        allowedExternalLinks: "",
        chatbotName: "Assistente",
        businessType: "retail",
        operatorContactMethod: "email",
        operatorWhatsappNumber: "",
        websiteUrl: "",
        supportEmail: "",
        channel: "whatsapp",
      }

      const result = promptProcessor.processWithVariables(template, variables)

      // Template engine removes trailing space after {{/if}}, so "Rossi,come" not "Rossi, come"
      expect(result).toBe("Ciao Mario Rossi,come posso aiutarti?")
    })
  })
})
