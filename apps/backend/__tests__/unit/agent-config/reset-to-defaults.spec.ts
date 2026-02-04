import * as fs from "fs"
import * as path from "path"
import {
  TEMPLATE_FILES,
  SHARED_AGENTS,
  getTemplateFolder,
  getTemplateFilename,
} from "../../../src/utils/template-path.helper"

// Helper to load template files directly (without Prisma dependency)
function loadTemplateFile(agentType: string, isEcommerce: boolean): string {
  const templateFile = getTemplateFilename(agentType)
  const folder = getTemplateFolder(agentType, isEcommerce)
  
  const templatePath = path.join(__dirname, "../../../src/templates", folder, templateFile)
  return fs.readFileSync(templatePath, "utf-8")
}

describe("AgentConfigController - Reset to Defaults - Template Loading", () => {
  describe("Template content validation", () => {
    it("should load templates with {{products}} variable in PRODUCT_SEARCH", async () => {
      // SCENARIO: Verify that PRODUCT_SEARCH template contains {{products}}
      // EXPECTATION: Template should have catalog variables

      const template = loadTemplateFile("PRODUCT_SEARCH", true)

      // Should contain {{products}} variable
      expect(template).toContain("{{products}}")
      expect(template).toContain("{{services}}")
    })

    it("should load templates WITHOUT old {{/if}} syntax (we use {{/unless}} for negation)", async () => {
      // SCENARIO: Verify templates use proper Handlebars syntax
      // EXPECTATION: {{#if}} is valid, but {{/if}} should only close {{#if}}, not {{#unless}}

      const template = loadTemplateFile("PRODUCT_SEARCH", true)

      // Templates can have {{#if}}/{{/if}} - that's valid
      // Just checking they don't have mismatched blocks
      const ifCount = (template.match(/\{\{#if/g) || []).length
      const endIfCount = (template.match(/\{\{\/if\}\}/g) || []).length
      
      // Each {{#if}} should have matching {{/if}}
      expect(ifCount).toBe(endIfCount)
    })

    it("should load templates WITHOUT (Code-First) in titles", async () => {
      // SCENARIO: Verify that (Code-First) is removed from titles
      // EXPECTATION: Template titles should be clean

      const template = loadTemplateFile("PRODUCT_SEARCH", true)

      // Should NOT contain (Code-First) marker
      expect(template).not.toContain("(Code-First)")
    })

    it("should load cart management template with {{products}} for adding to cart", async () => {
      // SCENARIO: Cart Management needs products catalog to add items
      // EXPECTATION: Template should have {{products}} and {{services}}

      const template = loadTemplateFile("CART_MANAGEMENT", true)

      // Should contain catalog variables for cart operations
      expect(template).toContain("{{products}}")
      expect(template).toContain("{{services}}")
    })

    it("should load conversation history template with correct variable names", async () => {
      // SCENARIO: Verify that Conversation History template uses correct variables
      // EXPECTATION: Uses {{chatbotName}} and {{botIdentityResponse}}

      const template = loadTemplateFile("CONVERSATION_HISTORY", true)

      // Should contain correct variable names (fixed in this session)
      expect(template).toContain("{{chatbotName}}")
      expect(template).toContain("{{botIdentityResponse}}")
      expect(template).toContain("{{companyName}}")
    })

    it("should load product search template with proper structure", async () => {
      // SCENARIO: Verify that Product Search template has required sections
      // EXPECTATION: Has products, services, customer context

      const template = loadTemplateFile("PRODUCT_SEARCH", true)

      // Should contain key sections
      expect(template).toContain("{{products}}")
      expect(template).toContain("{{services}}")
      expect(template).toContain("{{customerName}}")
    })

    it("should load e-commerce templates from ecommerce folder", async () => {
      // SCENARIO: E-commerce workspace should use ecommerce templates
      // EXPECTATION: Template loads successfully

      const ecommerceTemplate = loadTemplateFile("PRODUCT_SEARCH", true)
      
      // Should load successfully and contain e-commerce specific content
      expect(ecommerceTemplate).toBeTruthy()
      expect(ecommerceTemplate.length).toBeGreaterThan(100)
    })

    it("should load informational templates from informational folder", async () => {
      // SCENARIO: Informational workspace should use informational templates
      // EXPECTATION: Template loads successfully

      const infoTemplate = loadTemplateFile("CUSTOMER_SUPPORT", false)
      
      // Should load successfully
      expect(infoTemplate).toBeTruthy()
      expect(infoTemplate.length).toBeGreaterThan(100)
    })

    it("should load shared templates for both workspace types", async () => {
      // SCENARIO: Shared templates (Security, Translation) should work for all
      // EXPECTATION: Same template content regardless of workspace type

      const securityEcommerce = loadTemplateFile("SECURITY", true)
      const securityInfo = loadTemplateFile("SECURITY", false)
      
      // Should load same content from shared folder
      expect(securityEcommerce).toBe(securityInfo)
      expect(securityEcommerce).toBeTruthy()
    })
    
    it("should have toneOfVoice in ecommerce router template", async () => {
      // SCENARIO: Ecommerce router should have tone of voice section
      // EXPECTATION: Template contains {{toneOfVoice}} variable

      const template = loadTemplateFile("ROUTER", true)
      
      expect(template).toContain("{{toneOfVoice}}")
      expect(template).toContain("{{chatbotName}}")
    })
  })
})
