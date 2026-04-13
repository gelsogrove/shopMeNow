/**
 * ProfileManagementAgentLLM - Unit Tests
 *
 * Tests for profile management agent including:
 * 1. executeFunction("getProfileLink") - correct field mapping from CallingFunctionsService
 * 2. getProfileLink function result passes [LINK_PROFILE_WITH_TOKEN] token
 * 3. Info-agent template includes [LINK_PROFILE_WITH_TOKEN] instructions
 * 4. profileManagementAgent available for informational workspaces
 *
 * @requirement RULE-1: Database-First Architecture (no hardcoded fallbacks)
 * @requirement RULE-2: Workspace isolation
 * @requirement Profile link must return [LINK_PROFILE_WITH_TOKEN], never [LINK_REGISTRATION]
 *
 * ROOT CAUSE BUG:
 * ProfileManagementAgentLLM.executeFunction("getProfileLink") was reading
 * result.token, result.link, result.expiresAt (all undefined) instead of
 * result.data.profileLink, result.data.shortLink, result.data.expiresAt.
 * It also hardcoded "Profile link generated successfully" instead of
 * using result.message which contains "[LINK_PROFILE_WITH_TOKEN]".
 * This caused the LLM to not include [LINK_PROFILE_WITH_TOKEN] in its response,
 * leading to registration links being shown instead of profile links.
 */

// Logger is mocked globally in jest.setup.js - no local mock needed

// Mock Prisma
const mockPrisma = {
  agentConfig: {
    findFirst: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  customers: {
    findUnique: jest.fn(),
  },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}))

// Mock CallingFunctionsService
const mockGetProfileLink = jest.fn()
jest.mock("../../../services/calling-functions.service", () => ({
  CallingFunctionsService: jest.fn().mockImplementation(() => ({
    getProfileLink: mockGetProfileLink,
  })),
}))

// Mock manageNotifications
const mockManageNotifications = jest.fn()
jest.mock("../../../domain/calling-functions/manageNotifications", () => ({
  manageNotifications: mockManageNotifications,
}))

// Mock prompt processor
jest.mock("../../../services/prompt-processor.service", () => ({
  PromptProcessorService: jest.fn().mockImplementation(() => ({
    preProcessPrompt: jest.fn().mockResolvedValue("processed prompt"),
  })),
}))

// Mock PromptProcessorService static method
const PromptProcessorServiceClass = require("../../../services/prompt-processor.service").PromptProcessorService
PromptProcessorServiceClass.wrapUserInput = jest.fn((msg: string) => msg)

// Mock axios for LLM calls
jest.mock("axios", () => ({
  post: jest.fn(),
}))

import { ProfileManagementAgentLLM } from "../../../application/agents/ProfileManagementAgentLLM"
import axios from "axios"

// Import for template and function routing tests
import * as fs from "fs"
import * as path from "path"

const MOCK_WORKSPACE_ID = "workspace-123"
const MOCK_CUSTOMER_ID = "customer-456"

describe("ProfileManagementAgentLLM", () => {
  let agent: ProfileManagementAgentLLM

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "test-api-key"
    agent = new ProfileManagementAgentLLM(mockPrisma as any)
  })

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY
  })

  describe("executeFunction - getProfileLink", () => {
    // SCENARIO: Customer asks to see their profile via the Profile Management Agent
    // RULE: executeFunction must correctly map CallingFunctionsService response fields
    // BUG FIX: Was reading result.token/link/expiresAt (undefined) instead of result.data.*

    it("should return [LINK_PROFILE_WITH_TOKEN] in message from CallingFunctionsService result", async () => {
      // SCENARIO: CallingFunctionsService.getProfileLink returns standard response with data nested
      // RULE: The message field MUST contain [LINK_PROFILE_WITH_TOKEN] so LLM includes it in response
      mockGetProfileLink.mockResolvedValue({
        success: true,
        message: "[LINK_PROFILE_WITH_TOKEN]",
        timestamp: new Date().toISOString(),
        data: {
          profileLink: "https://www.echatbot.ai/customer-profile?token=abc123",
          shortLink: "https://www.echatbot.ai/s/XyZ",
          expiresAt: "2025-01-16T12:00:00.000Z",
        },
      })

      // Access private method via prototype
      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      // RULE: message MUST contain [LINK_PROFILE_WITH_TOKEN], not hardcoded text
      expect(result.message).toBe("[LINK_PROFILE_WITH_TOKEN]")
      expect(result.message).not.toBe("Profile link generated successfully")
    })

    it("should correctly map profileLink from result.data.profileLink", async () => {
      // SCENARIO: CallingFunctionsService returns profile URL in data.profileLink
      // RULE: executeFunction must read from result.data, not from result root level
      const expectedProfileLink = "https://www.echatbot.ai/customer-profile?token=abc123"

      mockGetProfileLink.mockResolvedValue({
        success: true,
        message: "[LINK_PROFILE_WITH_TOKEN]",
        timestamp: new Date().toISOString(),
        data: {
          profileLink: expectedProfileLink,
          shortLink: "https://www.echatbot.ai/s/XyZ",
          expiresAt: "2025-01-16T12:00:00.000Z",
        },
      })

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      // RULE: profileLink must come from result.data.profileLink
      expect(result.profileLink).toBe(expectedProfileLink)
      // RULE: Old field 'token' should NOT be in the result (it was reading undefined before)
      expect(result.token).toBeUndefined()
    })

    it("should correctly map shortLink from result.data.shortLink", async () => {
      // SCENARIO: Short URL generated by URL shortener
      // RULE: shortLink must come from result.data.shortLink, not result.link
      const expectedShortLink = "https://www.echatbot.ai/s/AbCdEf"

      mockGetProfileLink.mockResolvedValue({
        success: true,
        message: "[LINK_PROFILE_WITH_TOKEN]",
        timestamp: new Date().toISOString(),
        data: {
          profileLink: "https://www.echatbot.ai/customer-profile?token=abc123",
          shortLink: expectedShortLink,
          expiresAt: "2025-01-16T12:00:00.000Z",
        },
      })

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      // RULE: shortLink from result.data.shortLink
      expect(result.shortLink).toBe(expectedShortLink)
      // RULE: Old field 'link' should NOT be in the result
      expect(result.link).toBeUndefined()
    })

    it("should correctly map expiresAt from result.data.expiresAt", async () => {
      // SCENARIO: Token expiration comes from CallingFunctionsService nested data
      // RULE: expiresAt must come from result.data.expiresAt
      const expectedExpiresAt = "2025-01-16T12:00:00.000Z"

      mockGetProfileLink.mockResolvedValue({
        success: true,
        message: "[LINK_PROFILE_WITH_TOKEN]",
        timestamp: new Date().toISOString(),
        data: {
          profileLink: "https://www.echatbot.ai/customer-profile?token=abc123",
          shortLink: "https://www.echatbot.ai/s/XyZ",
          expiresAt: expectedExpiresAt,
        },
      })

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      // RULE: expiresAt from result.data.expiresAt
      expect(result.expiresAt).toBe(expectedExpiresAt)
    })

    it("should pass success flag from CallingFunctionsService result", async () => {
      // SCENARIO: CallingFunctionsService returns success: true
      // RULE: success should be passed through from result, not hardcoded
      mockGetProfileLink.mockResolvedValue({
        success: true,
        message: "[LINK_PROFILE_WITH_TOKEN]",
        timestamp: new Date().toISOString(),
        data: {
          profileLink: "https://www.echatbot.ai/customer-profile?token=abc123",
          shortLink: "https://www.echatbot.ai/s/XyZ",
          expiresAt: "2025-01-16T12:00:00.000Z",
        },
      })

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      expect(result.success).toBe(true)
    })

    it("should handle CallingFunctionsService failure gracefully", async () => {
      // SCENARIO: CallingFunctionsService fails (e.g., customer not found)
      // RULE: Error should be caught and returned with success: false
      mockGetProfileLink.mockResolvedValue({
        success: false,
        message: "Customer not found or workspace mismatch.",
        timestamp: new Date().toISOString(),
      })

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      expect(result.success).toBe(false)
    })

    it("should fallback to [LINK_PROFILE_WITH_TOKEN] if result.message is undefined", async () => {
      // SCENARIO: Edge case where CallingFunctionsService doesn't set message
      // RULE: Always fallback to [LINK_PROFILE_WITH_TOKEN] token - NEVER hardcoded text
      mockGetProfileLink.mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          profileLink: "https://www.echatbot.ai/customer-profile?token=abc123",
          shortLink: "https://www.echatbot.ai/s/XyZ",
          expiresAt: "2025-01-16T12:00:00.000Z",
        },
      })

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      // RULE: Fallback should be the token placeholder, not "Profile link generated successfully"
      expect(result.message).toBe("[LINK_PROFILE_WITH_TOKEN]")
    })

    it("should handle exception in CallingFunctionsService", async () => {
      // SCENARIO: CallingFunctionsService throws an error (e.g., DB connection issue)
      // RULE: Error should be caught and returned with success: false
      mockGetProfileLink.mockRejectedValue(new Error("Database connection failed"))

      const result = await (agent as any).executeFunction(
        "getProfileLink",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe("Function execution failed")
    })
  })

  describe("executeFunction - handlePushNotifications", () => {
    it("should call manageNotifications with SUBSCRIBE for value=true", async () => {
      // SCENARIO: Customer wants to enable push notifications
      // RULE: action should be "SUBSCRIBE" when value is true
      mockManageNotifications.mockResolvedValue({
        success: true,
        message: "Notifications enabled",
        currentStatus: true,
      })

      const result = await (agent as any).executeFunction(
        "handlePushNotifications",
        { value: true },
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      expect(mockManageNotifications).toHaveBeenCalledWith({
        action: "SUBSCRIBE",
        customerId: MOCK_CUSTOMER_ID,
        workspaceId: MOCK_WORKSPACE_ID,
      })
      expect(result.success).toBe(true)
    })

    it("should call manageNotifications with UNSUBSCRIBE for value=false", async () => {
      // SCENARIO: Customer wants to disable push notifications
      // RULE: action should be "UNSUBSCRIBE" when value is false
      mockManageNotifications.mockResolvedValue({
        success: true,
        message: "Notifications disabled",
        currentStatus: false,
      })

      const result = await (agent as any).executeFunction(
        "handlePushNotifications",
        { value: false },
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      expect(mockManageNotifications).toHaveBeenCalledWith({
        action: "UNSUBSCRIBE",
        customerId: MOCK_CUSTOMER_ID,
        workspaceId: MOCK_WORKSPACE_ID,
      })
    })
  })

  describe("executeFunction - unknown function", () => {
    it("should return error for unknown function names", async () => {
      // SCENARIO: LLM calls a function that doesn't exist
      // RULE: Should return success: false with descriptive message
      const result = await (agent as any).executeFunction(
        "unknownFunction",
        {},
        {
          customerId: MOCK_CUSTOMER_ID,
          workspaceId: MOCK_WORKSPACE_ID,
        }
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain("Unknown function")
    })
  })
})

describe("Info-Agent Template - Profile Link Instructions", () => {
  // SCENARIO: Informational workspace template must know about [LINK_PROFILE_WITH_TOKEN]
  // ROOT CAUSE: Template only mentioned [LINK_REGISTRATION], causing LLM to use wrong link type

  it("should contain [LINK_PROFILE_WITH_TOKEN] instructions in info-agent template", () => {
    // RULE: Info-agent template MUST mention [LINK_PROFILE_WITH_TOKEN] so LLM knows about it
    const templatePath = path.resolve(
      __dirname,
      "../../../templates/informational/01-info-agent.template.md"
    )
    const templateContent = fs.readFileSync(templatePath, "utf-8")

    expect(templateContent).toContain("[LINK_PROFILE_WITH_TOKEN]")
  })

  it("should contain instructions to use profileManagementAgent for profile requests", () => {
    // RULE: Template should instruct LLM to delegate to profileManagementAgent
    const templatePath = path.resolve(
      __dirname,
      "../../../templates/informational/01-info-agent.template.md"
    )
    const templateContent = fs.readFileSync(templatePath, "utf-8")

    expect(templateContent).toContain("profileManagementAgent")
  })

  it("should distinguish [LINK_PROFILE_WITH_TOKEN] from [LINK_REGISTRATION]", () => {
    // RULE: Template must clearly explain the difference between profile and registration links
    // [LINK_PROFILE_WITH_TOKEN] = view/edit existing profile
    // [LINK_REGISTRATION] = register for the first time
    const templatePath = path.resolve(
      __dirname,
      "../../../templates/informational/01-info-agent.template.md"
    )
    const templateContent = fs.readFileSync(templatePath, "utf-8")

    // Both token types should be mentioned
    expect(templateContent).toContain("[LINK_PROFILE_WITH_TOKEN]")
    expect(templateContent).toContain("[LINK_REGISTRATION]")

    // Should have profile management section
    expect(templateContent).toMatch(/profile/i)
  })

  it("should instruct NOT to use [LINK_REGISTRATION] for profile viewing", () => {
    // RULE: Template must explicitly say NOT to use registration link for profile requests
    const templatePath = path.resolve(
      __dirname,
      "../../../templates/informational/01-info-agent.template.md"
    )
    const templateContent = fs.readFileSync(templatePath, "utf-8")

    // Should have an instruction about NOT using registration for profile
    expect(templateContent).toMatch(/NEVER.*\[LINK_REGISTRATION\].*profile/i)
  })
})

describe("Router Functions - Profile Management for Informational Workspaces", () => {
  // SCENARIO: profileManagementAgent must be available for informational workspaces
  // RULE: getFunctionsForRouter should include profileManagementAgent even when channelMode=false

  it("should include profileManagementAgent for informational workspaces", () => {
    // RULE: Profile management is NOT an e-commerce-only feature
    const { getFunctionsForRouter } = require("../../../config/agent-functions")

    const functions = getFunctionsForRouter({ channelMode: 'INFORMATIONAL' as any })
    const functionNames = functions.map((fn: any) => fn.function.name)

    expect(functionNames).toContain("profileManagementAgent")
  })

  it("should exclude e-commerce-only agents for informational workspaces", () => {
    // RULE: productSearchAgent, cartManagementAgent, orderTrackingAgent are e-commerce only
    const { getFunctionsForRouter } = require("../../../config/agent-functions")

    const functions = getFunctionsForRouter({ channelMode: 'INFORMATIONAL' as any })
    const functionNames = functions.map((fn: any) => fn.function.name)

    expect(functionNames).not.toContain("productSearchAgent")
    expect(functionNames).not.toContain("cartManagementAgent")
    expect(functionNames).not.toContain("orderTrackingAgent")
  })

  it("should include customerSupportAgent for informational workspaces", () => {
    // RULE: Customer support is available for all workspace types
    const { getFunctionsForRouter } = require("../../../config/agent-functions")

    const functions = getFunctionsForRouter({ channelMode: 'INFORMATIONAL' as any })
    const functionNames = functions.map((fn: any) => fn.function.name)

    expect(functionNames).toContain("customerSupportAgent")
  })
})

describe("PROFILE_MANAGEMENT_FUNCTIONS - getProfileLink definition", () => {
  // SCENARIO: getProfileLink function description must instruct LLM to output [LINK_PROFILE_WITH_TOKEN]
  // RULE: Function description is the instructor for the LLM on how to respond after calling the function

  it("should have getProfileLink in PROFILE_MANAGEMENT_FUNCTIONS", () => {
    const { PROFILE_MANAGEMENT_FUNCTIONS } = require("../../../config/agent-functions.config")

    const functionNames = PROFILE_MANAGEMENT_FUNCTIONS.map((fn: any) => fn.function.name)
    expect(functionNames).toContain("getProfileLink")
  })

  it("should instruct LLM to output [LINK_PROFILE_WITH_TOKEN] after calling getProfileLink", () => {
    // RULE: Description must tell LLM to show [LINK_PROFILE_WITH_TOKEN] token in response
    const { PROFILE_MANAGEMENT_FUNCTIONS } = require("../../../config/agent-functions.config")

    const getProfileLinkFn = PROFILE_MANAGEMENT_FUNCTIONS.find(
      (fn: any) => fn.function.name === "getProfileLink"
    )

    expect(getProfileLinkFn).toBeDefined()
    expect(getProfileLinkFn.function.description).toContain("[LINK_PROFILE_WITH_TOKEN]")
  })

  it("should have contactOperator in PROFILE_MANAGEMENT_FUNCTIONS", () => {
    const { PROFILE_MANAGEMENT_FUNCTIONS } = require("../../../config/agent-functions.config")

    const functionNames = PROFILE_MANAGEMENT_FUNCTIONS.map((fn: any) => fn.function.name)
    expect(functionNames).toContain("contactOperator")
  })
})
