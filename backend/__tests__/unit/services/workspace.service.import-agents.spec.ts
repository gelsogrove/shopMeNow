import { PrismaClient } from "@prisma/client"
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals"
import { WorkspaceService } from "../../../src/application/services/workspace.service"
import { WorkspaceProps } from "../../../src/domain/entities/workspace.entity"
import logger from "../../../src/utils/logger"

// Mock logger to avoid console spam during tests
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

/**
 * WorkspaceService - Integration Tests
 * These tests verify the Import Agents feature when creating a new workspace
 * Uses real database to verify actual agent imports
 * 
 * TODO: Move to __tests__/integration/ directory for proper integration test handling
 * Currently skipped because it's an integration test in the unit tests folder
 */
describe.skip("WorkspaceService - Import Agents Feature", () => {
  let prisma: PrismaClient
  let workspaceService: WorkspaceService
  const createdWorkspaceIds: string[] = []

  beforeAll(() => {
    prisma = new PrismaClient()
    workspaceService = new WorkspaceService(prisma)
  })

  afterAll(async () => {
    // Cleanup: Delete all test workspaces and their agents
    for (const workspaceId of createdWorkspaceIds) {
      try {
        await prisma.agentConfig.deleteMany({
          where: { workspaceId },
        })
        await prisma.whatsappSettings.deleteMany({
          where: { workspaceId },
        })
        await prisma.workspace.delete({
          where: { id: workspaceId },
        })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await prisma.$disconnect()
  })

  describe("Workspace Creation with Agent Import", () => {
    it("should create workspace with welcome and wip messages", async () => {
      const uniqueName = "Test Workspace " + Date.now()
      const workspaceData: Partial<WorkspaceProps> = {
        name: uniqueName,
        slug: "test-workspace-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
        language: "en",
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)

      expect(workspace).toBeDefined()
      expect(workspace.id).toBeDefined()
      expect(workspace.name).toBe(workspaceData.name)
      expect(workspace.welcomeMessage).toBeDefined()
      expect(workspace.wipMessage).toBeDefined()

      createdWorkspaceIds.push(workspace.id)
    })

    it("should import exactly 9 agents", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test 9 Agents " + Date.now(),
        slug: "test-9-agents-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)
      const agents = await prisma.agentConfig.findMany({
        where: { workspaceId: workspace.id },
      })

      expect(agents.length).toBe(9)
      createdWorkspaceIds.push(workspace.id)
    })

    it("should import agents with correct types in order", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test Agent Types " + Date.now(),
        slug: "test-types-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)
      const agents = await prisma.agentConfig.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { order: "asc" },
      })

      const expectedTypes = [
        "ROUTER",
        "PRODUCT_SEARCH",
        "CART_MANAGEMENT",
        "ORDER_TRACKING",
        "CUSTOMER_SUPPORT",
        "SUMMARY_AGENT",
        "PROFILE_MANAGEMENT",
        "TRANSLATION",
        "SECURITY",
      ]

      expect(agents.length).toBe(expectedTypes.length)
      expect(agents.map((a) => a.type)).toEqual(expectedTypes)

      createdWorkspaceIds.push(workspace.id)
    })

    it("should populate all required agent fields", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test Agent Fields " + Date.now(),
        slug: "test-fields-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)
      const agents = await prisma.agentConfig.findMany({
        where: { workspaceId: workspace.id },
      })

      // Verify each agent has all required fields populated
      agents.forEach((agent) => {
        expect(agent.name).toBeDefined()
        expect(agent.name.length).toBeGreaterThan(0)
        expect(agent.type).toBeDefined()
        expect(agent.description).toBeDefined()
        expect(agent.systemPrompt).toBeDefined()
        expect(agent.systemPrompt.length).toBeGreaterThan(100) // Loaded from markdown
        expect(agent.model).toBeDefined()
        expect(agent.model.length).toBeGreaterThan(0)
        expect(agent.temperature).toBeGreaterThanOrEqual(0)
        expect(agent.temperature).toBeLessThanOrEqual(1)
        expect(agent.maxTokens).toBeGreaterThan(0)
        expect(agent.order).toBeGreaterThanOrEqual(0)
        expect(agent.isActive).toBe(true)
      })

      createdWorkspaceIds.push(workspace.id)
    })

    it("should set welcomeMessage with 4 languages", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test Welcome " + Date.now(),
        slug: "test-welcome-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)

      expect(workspace.welcomeMessage).toBeDefined()
      expect(typeof workspace.welcomeMessage).toBe("object")

      const welcomeMsg = workspace.welcomeMessage as Record<string, string>
      expect(welcomeMsg.en).toBeDefined()
      expect(welcomeMsg.es).toBeDefined()
      expect(welcomeMsg.it).toBeDefined()
      expect(welcomeMsg.pt).toBeDefined()
      expect(welcomeMsg.en.toLowerCase()).toContain("welcome")

      createdWorkspaceIds.push(workspace.id)
    })

    it("should set wipMessage with 4 languages", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test WIP Message " + Date.now(),
        slug: "test-wip-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)

      expect(workspace.wipMessage).toBeDefined()
      expect(typeof workspace.wipMessage).toBe("object")

      const wipMsg = workspace.wipMessage as Record<string, string>
      expect(wipMsg.en).toBeDefined()
      expect(wipMsg.es).toBeDefined()
      expect(wipMsg.it).toBeDefined()
      expect(wipMsg.pt).toBeDefined()

      createdWorkspaceIds.push(workspace.id)
    })

    it("should load systemPrompt from markdown files", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test Prompts " + Date.now(),
        slug: "test-prompts-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)
      const agents = await prisma.agentConfig.findMany({
        where: { workspaceId: workspace.id },
      })

      // All agents should have prompts loaded from markdown
      agents.forEach((agent) => {
        expect(agent.systemPrompt.length).toBeGreaterThan(100)
        expect(agent.systemPrompt).toMatch(/[a-z]{3,}/i) // Contains words
      })

      createdWorkspaceIds.push(workspace.id)
    })

    it("should set correct agent order", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test Order " + Date.now(),
        slug: "test-order-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)
      const agents = await prisma.agentConfig.findMany({
        where: { workspaceId: workspace.id },
      })

      const routerAgent = agents.find((a) => a.type === "ROUTER")
      const securityAgent = agents.find((a) => a.type === "SECURITY")
      const translationAgent = agents.find((a) => a.type === "TRANSLATION")

      expect(routerAgent?.order).toBe(0) // Entry point
      expect(securityAgent?.order).toBe(99) // Last (Queue only)
      expect(translationAgent?.order).toBe(7) // Routing pipeline

      createdWorkspaceIds.push(workspace.id)
    })

    it("should have all agents isActive=true", async () => {
      const workspaceData: Partial<WorkspaceProps> = {
        name: "Test Active " + Date.now(),
        slug: "test-active-" + Date.now(),
        whatsappPhoneNumber: "+39-" + Date.now(),
      }

      const workspace = await workspaceService.create(workspaceData as WorkspaceProps)
      const agents = await prisma.agentConfig.findMany({
        where: { workspaceId: workspace.id },
      })

      agents.forEach((agent) => {
        expect(agent.isActive).toBe(true)
      })

      createdWorkspaceIds.push(workspace.id)
    })

    it("should prevent duplicate workspace with same slug", async () => {
      const uniqueSlug = "test-unique-" + Date.now()
      const workspaceData1: Partial<WorkspaceProps> = {
        name: "Workspace " + Date.now(),
        slug: uniqueSlug,
        whatsappPhoneNumber: "+39-111111",
      }

      const workspace1 = await workspaceService.create(workspaceData1 as WorkspaceProps)
      createdWorkspaceIds.push(workspace1.id)

      const workspaceData2: Partial<WorkspaceProps> = {
        name: "Duplicate " + Date.now(),
        slug: uniqueSlug, // Same slug
        whatsappPhoneNumber: "+39-222222",
      }

      await expect(workspaceService.create(workspaceData2 as WorkspaceProps)).rejects.toThrow(
        /already exists/i
      )
    })
  })
})
