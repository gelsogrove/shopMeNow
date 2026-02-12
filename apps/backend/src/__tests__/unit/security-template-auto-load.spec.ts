/**
 * TEST: Security Template Auto-Load (SPP-1032 Verification)
 * 
 * SCENARIO: When creating a new workspace, Security Agent (02-security.template.md) must be auto-loaded
 * 
 * RULES:
 * - E-commerce workspace → loads ecommerce/07-security.template.md
 * - Informational workspace → loads informational/02-security.template.md
 * - Template content includes [LINK_REGISTRATION] in allowed placeholders
 * - Template allows domains with any path (e.g., echatbot.ai/registration/*)
 * 
 * WHY: Ensure security templates don't block valid registration links
 */

import { prisma } from "@echatbot/database"
import { WorkspaceService } from "../../application/services/workspace.service"

// TODO Andrea: These tests need manual verification until Prisma test environment is fixed
describe.skip("Security Template Auto-Load (SPP-1032)", () => {
  let workspaceService: WorkspaceService
  let testEcommerceWorkspace: any
  let testInformationalWorkspace: any

  beforeAll(async () => {
    workspaceService = new WorkspaceService()
  })

  afterAll(async () => {
    // Cleanup test workspaces
    if (testEcommerceWorkspace) {
      await prisma.workspace.delete({ where: { id: testEcommerceWorkspace.id } })
    }
    if (testInformationalWorkspace) {
      await prisma.workspace.delete({ where: { id: testInformationalWorkspace.id } })
    }
    await prisma.$disconnect()
  })

  it("should auto-create Security Agent when creating e-commerce workspace", async () => {
    // SCENARIO: User creates new e-commerce workspace via platform
    // RULE: System automatically imports 07-security.template.md from ecommerce/ folder

    testEcommerceWorkspace = await workspaceService.create(
      {
        name: "Test E-commerce Workspace",
        slug: "test-ecommerce-auto",
        url: "https://test-ecommerce.echatbot.ai",
        type: "ECOMMERCE",
        sellsProductsAndServices: true, // E-commerce flag
      },
      "test-user-id"
    )

    // Verify Security Agent exists
    const securityAgent = await prisma.agentConfig.findFirst({
      where: {
        workspaceId: testEcommerceWorkspace.id,
        type: "SECURITY",
      },
    })

    expect(securityAgent).toBeDefined()
    expect(securityAgent?.name).toBe("Security Agent")
    expect(securityAgent?.isActive).toBe(true)
    expect(securityAgent?.order).toBe(99) // Security runs last

    // Verify template content includes registration link support
    expect(securityAgent?.systemPrompt).toContain("[LINK_REGISTRATION]")
    expect(securityAgent?.systemPrompt).toContain("ALLOWED EXTERNAL DOMAINS")
    expect(securityAgent?.systemPrompt).toContain("including any path on these domains")
  })

  it("should auto-create Security Agent when creating informational workspace", async () => {
    // SCENARIO: User creates new informational-only workspace (no e-commerce)
    // RULE: System automatically imports 02-security.template.md from informational/ folder

    testInformationalWorkspace = await workspaceService.create(
      {
        name: "Test Informational Workspace",
        slug: "test-informational-auto",
        url: "https://test-info.echatbot.ai",
        type: "INFORMATIONAL",
        sellsProductsAndServices: false, // Info-only flag
      },
      "test-user-id"
    )

    // Verify Security Agent exists
    const securityAgent = await prisma.agentConfig.findFirst({
      where: {
        workspaceId: testInformationalWorkspace.id,
        type: "SECURITY",
      },
    })

    expect(securityAgent).toBeDefined()
    expect(securityAgent?.name).toBe("Security Agent")
    expect(securityAgent?.isActive).toBe(true)
    expect(securityAgent?.order).toBe(99)

    // Verify template content matches informational/02-security.template.md
    expect(securityAgent?.systemPrompt).toContain("[LINK_REGISTRATION]")
    expect(securityAgent?.systemPrompt).toContain("ALLOWED EXTERNAL DOMAINS")
    expect(securityAgent?.systemPrompt).toContain("including any path on these domains")
  })

  it("security template should allow registration links on approved domains", async () => {
    // SCENARIO: Security Agent processes message with registration link
    // RULE: If domain is in allowedExternalLinks, any path on that domain is allowed

    const securityAgent = await prisma.agentConfig.findFirst({
      where: {
        workspaceId: testEcommerceWorkspace.id,
        type: "SECURITY",
      },
    })

    expect(securityAgent?.systemPrompt).toBeDefined()

    // Verify template explains that subpaths are allowed
    const promptContent = securityAgent!.systemPrompt
    expect(promptContent).toContain("If domain is `echatbot.ai`, then `https://echatbot.ai/registration/abc` is ALLOWED")
    expect(promptContent).toContain("check if URL contains the domain name anywhere")

    // Verify token placeholders are explicitly allowed
    expect(promptContent).toMatch(/ALLOW.*LINK_REGISTRATION/)
  })

  it("should create all expected agents for e-commerce workspace", async () => {
    // SCENARIO: E-commerce workspace creation
    // RULE: System creates 12 agents (including SECURITY at order 99)

    const agents = await prisma.agentConfig.findMany({
      where: { workspaceId: testEcommerceWorkspace.id },
      orderBy: { order: "asc" },
    })

    // Verify Security Agent is included
    const securityAgent = agents.find((a) => a.type === "SECURITY")
    expect(securityAgent).toBeDefined()
    expect(securityAgent?.order).toBe(99)

    // Verify other key agents exist
    const routerAgent = agents.find((a) => a.type === "ROUTER")
    const productSearchAgent = agents.find((a) => a.type === "PRODUCT_SEARCH")
    const translationAgent = agents.find((a) => a.type === "TRANSLATION")

    expect(routerAgent).toBeDefined()
    expect(productSearchAgent).toBeDefined()
    expect(translationAgent).toBeDefined()
  })

  it("should create fewer agents for informational workspace (no e-commerce-only agents)", async () => {
    // SCENARIO: Informational workspace creation
    // RULE: System creates only 5 agents (no ROUTER, PRODUCT_SEARCH, CART_MANAGEMENT)

    const agents = await prisma.agentConfig.findMany({
      where: { workspaceId: testInformationalWorkspace.id },
      orderBy: { order: "asc" },
    })

    // Verify Security Agent exists
    const securityAgent = agents.find((a) => a.type === "SECURITY")
    expect(securityAgent).toBeDefined()

    // Verify e-commerce-only agents do NOT exist
    const routerAgent = agents.find((a) => a.type === "ROUTER")
    const productSearchAgent = agents.find((a) => a.type === "PRODUCT_SEARCH")
    const cartAgent = agents.find((a) => a.type === "CART_MANAGEMENT")

    expect(routerAgent).toBeUndefined()
    expect(productSearchAgent).toBeUndefined()
    expect(cartAgent).toBeUndefined()

    // Verify shared agents exist (CUSTOMER_SUPPORT becomes INFO_AGENT)
    const infoAgent = agents.find((a) => a.type === "CUSTOMER_SUPPORT")
    expect(infoAgent).toBeDefined()
    expect(infoAgent?.name).toBe("Info Agent") // Renamed for informational context
  })
})
