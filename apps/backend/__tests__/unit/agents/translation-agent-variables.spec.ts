/**
 * 🎯 TEST: TranslationAgent Prompt Variables Completeness
 *
 * SCENARIO: TranslationAgent builds prompts from DB-stored templates.
 * Variables like {{frustrationEscalationInstructions}}, {{humanSupportInstructions}},
 * etc. MUST be replaced before sending to LLM.
 *
 * KEY RULES:
 * 1. All workspace-specific variables must be fetched from DB
 * 2. PromptVariableBuilder.build() maps them to template variables
 * 3. processWithVariables() replaces ALL {{VAR}} in the template
 * 4. No {{VAR}} placeholder should remain after replacement
 *
 * 📚 minrequirement: "Ensure TranslationAgent prompt variables include:
 * frustrationEscalation..., and are replaced (no {{VAR}} left)"
 */

import { PromptVariableBuilder, PromptVariables } from "../../../src/application/services/prompt-variable-builder.service"
import { PromptProcessorService } from "../../../src/services/prompt-processor.service"

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe("TranslationAgent Prompt Variables Completeness", () => {
  const promptProcessor = new PromptProcessorService()

  // Simulate workspace data as fetched from DB
  const mockWorkspace = {
    name: "Test Shop",
    chatbotName: "ShopBot",
    url: "https://testshop.com",
    websiteUrl: "https://testshop.com",
    language: "it",
    toneOfVoice: "friendly",
    hasHumanSupport: true,
    operatorContactMethod: "whatsapp",
    operatorWhatsappNumber: "+39 333 1234567",
    hasSalesAgents: false,
    notificationEmail: "admin@testshop.com",
    channelMode: 'ECOMMERCE' as any,
    address: "Via Roma 1, Milano",
    customAiRules: "Always be polite",
    businessType: "ecommerce",
    // 🎯 CRITICAL variables from minrequirement
    frustrationEscalationInstructions: "If the customer is frustrated, offer to connect with a human agent immediately.",
    humanSupportInstructions: "Our team is available Mon-Fri 9:00-18:00. Contact via WhatsApp at +39 333 1234567.",
    botIdentityResponse: "I'm ShopBot, your digital shopping assistant.",
    allowedExternalLinks: ["https://testshop.com", "https://wa.me/393331234567"],
  }

  const mockCustomer = {
    id: "cust-123",
    name: "Maria Rossi",
    email: "maria@test.com",
    phone: "+39 333 9876543",
    discount: null,
    isActive: true,
    language: "es",
    company: null,
    push_notifications_consent: true,
    sales: null,
  }

  describe("PromptVariableBuilder includes all required variables", () => {
    it("should include frustrationEscalationInstructions in built variables", () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer as any,
        mockWorkspace as any,
        { products: "", categories: "", services: "", offers: "", faqs: "" }
      )

      expect(variables.frustrationEscalationInstructions).toBe(
        "If the customer is frustrated, offer to connect with a human agent immediately."
      )
    })

    it("should include humanSupportInstructions in built variables", () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer as any,
        mockWorkspace as any,
        { products: "", categories: "", services: "", offers: "", faqs: "" }
      )

      expect(variables.humanSupportInstructions).toBe(
        "Our team is available Mon-Fri 9:00-18:00. Contact via WhatsApp at +39 333 1234567."
      )
    })

    it("should include botIdentityResponse in built variables", () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer as any,
        mockWorkspace as any,
        { products: "", categories: "", services: "", offers: "", faqs: "" }
      )

      expect(variables.botIdentityResponse).toBe(
        "I'm ShopBot, your digital shopping assistant."
      )
    })

    it("should include allowedExternalLinks in built variables", () => {
      const variables = PromptVariableBuilder.build(
        mockCustomer as any,
        mockWorkspace as any,
        { products: "", categories: "", services: "", offers: "", faqs: "" }
      )

      expect(variables.allowedExternalLinks).toContain("https://testshop.com")
      expect(variables.allowedExternalLinks).toContain("https://wa.me/393331234567")
    })
  })

  describe("No {{VAR}} remains after replacement", () => {
    it("should replace ALL variables in a template containing the 4 critical vars", () => {
      // Build variables
      const variables = PromptVariableBuilder.build(
        mockCustomer as any,
        mockWorkspace as any,
        { products: "", categories: "", services: "", offers: "", faqs: "" }
      )

      // Template with ALL 4 critical variables
      const template = `
You are {{chatbotName}}, assistant for {{companyName}}.

When the customer is frustrated:
{{frustrationEscalationInstructions}}

Human support info:
{{humanSupportInstructions}}

About yourself:
{{botIdentityResponse}}

Allowed links:
{{allowedExternalLinks}}

Customer: {{customerName}}
Language: translate to {TARGET_LANGUAGE}

{MESSAGE}
`
      // Process template
      let result = promptProcessor.processWithVariables(template, variables)

      // Apply legacy replacements (like TranslationAgent does)
      result = result
        .replace(/{TARGET_LANGUAGE}/g, "Spanish")
        .replace(/{CUSTOMER_NAME}/g, mockCustomer.name)
        .replace(/{MESSAGE}/g, "Hello, I need help!")

      // RULE: No {{VAR}} or {VAR} placeholders should remain
      const unreplacedDoubleBrace = result.match(/\{\{[a-zA-Z_]+\}\}/g)
      const unreplacedSingleBrace = result.match(/\{[A-Z_]+\}/g)

      expect(unreplacedDoubleBrace).toBeNull()
      expect(unreplacedSingleBrace).toBeNull()
    })

    it("should handle empty/null workspace fields gracefully (no crash)", () => {
      // SCENARIO: Workspace has none of the 4 critical fields set
      const emptyWorkspace = {
        ...mockWorkspace,
        frustrationEscalationInstructions: null,
        humanSupportInstructions: null,
        botIdentityResponse: null,
        allowedExternalLinks: null,
      }

      const variables = PromptVariableBuilder.build(
        mockCustomer as any,
        emptyWorkspace as any,
        { products: "", categories: "", services: "", offers: "", faqs: "" }
      )

      // Should not crash — empty string fallbacks
      expect(variables.frustrationEscalationInstructions).toBe("")
      expect(variables.humanSupportInstructions).toBe("")
      expect(variables.botIdentityResponse).toBe("")
      // allowedExternalLinks with null should be empty string
      expect(variables.allowedExternalLinks).toBe("")
    })
  })
})
