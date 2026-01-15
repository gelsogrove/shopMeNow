/**
 * Test: Router Template Variables Replacement
 * 
 * Verifies that ALL variables in Router templates (informational + ecommerce)
 * are correctly replaced by VariableResolver + PromptBuilder
 * 
 * Tests:
 * 1. Informational Router: All variables resolved
 * 2. E-commerce Router: All variables resolved
 * 3. No leftover {{variables}} after replacement
 */

import { prisma } from "@echatbot/database"
import { VariableResolverService } from "../../../application/services/prompt-builder/variable-resolver.service"
import { PromptBuilderService } from "../../../application/services/prompt-builder/prompt-builder.service"
import { TemplateLoaderService } from "../../../application/services/template-loader.service"

describe("Router Template Variables Replacement", () => {
  let variableResolver: VariableResolverService
  let promptBuilder: PromptBuilderService
  let templateLoader: TemplateLoaderService

  // Test workspace IDs - will be set from database
  let INFORMATIONAL_WORKSPACE: string
  let ECOMMERCE_WORKSPACE: string
  let TEST_CUSTOMER: string

  beforeAll(async () => {
    variableResolver = new VariableResolverService(prisma)
    promptBuilder = new PromptBuilderService(prisma)
    templateLoader = TemplateLoaderService.getInstance(prisma)

    // Get first workspace (should be BellItalia VIP - ecommerce)
    const ecommerceWorkspace = await prisma.workspace.findFirst({
      where: { sellsProductsAndServices: true },
      select: { id: true },
    })

    // Get first informational workspace
    const infoWorkspace = await prisma.workspace.findFirst({
      where: { sellsProductsAndServices: false },
      select: { id: true },
    })

    if (!ecommerceWorkspace || !infoWorkspace) {
      throw new Error("Database must have both ecommerce and informational workspaces. Run: npm run seed")
    }

    ECOMMERCE_WORKSPACE = ecommerceWorkspace.id
    INFORMATIONAL_WORKSPACE = infoWorkspace.id

    // Get first customer
    const customer = await prisma.customers.findFirst({
      select: { id: true },
    })

    if (!customer) {
      throw new Error("Database must have at least 1 customer. Run: npm run seed")
    }

    TEST_CUSTOMER = customer.id
  })

  afterAll(async () => {
    // Prisma disconnected by jest.setup.js global teardown
  })

  describe("Informational Router Template", () => {
    it("should resolve all variables correctly", async () => {
      // Use PromptBuilder.build() to get final prompt with all variables replaced
      const result = await promptBuilder.build("ROUTER", {
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.content.length).toBeGreaterThan(0)

      // Verify NO leftover {{variables}}
      const leftoverVariables = result.content.match(/\{\{[^}]+\}\}/g)
      
      if (leftoverVariables) {
        console.error("❌ Leftover variables in informational Router:", leftoverVariables)
      }

      expect(leftoverVariables).toBeNull()
    })

    it("should include FAQ content", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        INFORMATIONAL_WORKSPACE,
        TEST_CUSTOMER
      )

      // FAQ should be loaded for informational workspace
      expect(variables.faq).toBeDefined()
      expect(typeof variables.faq).toBe("string")

      // Should contain Q: and A: format
      if (variables.faq) {
        expect(variables.faq).toMatch(/Q:|A:/)
      }
    })

    it("should include customer context", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        INFORMATIONAL_WORKSPACE,
        TEST_CUSTOMER
      )

      expect(variables.customerName).toBeDefined()
      expect(variables.languageUser).toBeDefined()
    })

    it("should include workspace identity", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        INFORMATIONAL_WORKSPACE,
        TEST_CUSTOMER
      )

      expect(variables.workspaceName).toBeDefined()
      expect(variables.toneOfVoice).toBeDefined()
      expect(variables.adminEmail).toBeDefined()
    })

    it("should include human support settings", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        INFORMATIONAL_WORKSPACE,
        TEST_CUSTOMER
      )

      expect(variables.hasHumanSupport).toBeDefined()
      expect(variables.hasSalesAgents).toBeDefined()
      
      if (variables.hasSalesAgents) {
        expect(variables.agentName).toBeDefined()
        expect(variables.agentPhone).toBeDefined()
        expect(variables.agentEmail).toBeDefined()
      }
    })
  })

  describe("E-commerce Router Template", () => {
    it("should resolve all variables correctly", async () => {
      // Use PromptBuilder.build() to get final prompt
      const result = await promptBuilder.build("ROUTER", {
        workspaceId: ECOMMERCE_WORKSPACE,
        customerId: TEST_CUSTOMER,
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()

      // Verify NO leftover {{variables}}
      const leftoverVariables = result.content.match(/\{\{[^}]+\}\}/g)
      
      if (leftoverVariables) {
        console.error("❌ Leftover variables:", leftoverVariables)
      }

      expect(leftoverVariables).toBeNull()
    })

    it("should include e-commerce specific variables", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        ECOMMERCE_WORKSPACE,
        TEST_CUSTOMER
      )

      expect(variables.sellsProductsAndServices).toBe(true)
      expect(variables.currency).toBeDefined()
    })
  })

  describe("Variable Coverage", () => {
    it("should have all required variables for informational template", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        INFORMATIONAL_WORKSPACE,
        TEST_CUSTOMER
      )

      // Required variables list
      const requiredVars = [
        "workspaceName",
        "customerName",
        "languageUser",
        "toneOfVoice",
        "adminEmail",
        "workspaceUrl",
        "address",
        "hasHumanSupport",
        "hasSalesAgents",
        "faq",
        "frustrationEscalationInstructions",
        "humanSupportInstructions",
      ]

      for (const varName of requiredVars) {
        expect(variables).toHaveProperty(varName)
      }
    })

    it("should handle optional variables gracefully", async () => {
      const variables = await variableResolver.resolve(
        "ROUTER",
        INFORMATIONAL_WORKSPACE,
        TEST_CUSTOMER
      )

      // Optional variables that ALWAYS exist (can be empty string)
      expect(variables).toHaveProperty("botIdentityResponse")
      expect(variables).toHaveProperty("address")
      expect(variables).toHaveProperty("customAiRules")
      
      // Agent variables are TRULY optional (only exist if customer has sales agent)
      // So we just verify they CAN be undefined
      expect(typeof variables.agentName === "string" || variables.agentName === undefined).toBe(true)
    })
  })
})
