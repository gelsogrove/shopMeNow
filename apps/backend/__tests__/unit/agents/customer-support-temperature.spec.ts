/**
 * CustomerSupportAgentLLM temperature/model sourcing tests
 *
 * Verifies that the agent reads temperature/model from agentConfig (DB)
 * instead of hardcoded defaults, and falls back correctly when missing.
 */

// Mock Prisma
jest.mock("@echatbot/database", () => {
  const agentConfig = { findFirst: jest.fn() }
  const workspace = { findUnique: jest.fn() }
  const prisma = { agentConfig, workspace }

  return {
    prisma,
    PrismaClient: jest.fn(() => prisma),
    AgentType: {
      CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
      INFO_AGENT: "INFO_AGENT",
    },
  }
})

// Mock TemplateLoaderService
jest.mock(
  "../../../src/application/services/template-loader.service",
  () => ({
    TemplateLoaderService: {
      getInstance: jest.fn(() => ({
        loadAndRenderTemplate: jest.fn().mockResolvedValue("SYSTEM PROMPT"),
      })),
    },
  })
)

// Mock MessageRepository used inside handleQuery (dynamic import)
jest.mock("../../../src/repositories/message.repository", () => ({
  MessageRepository: jest.fn(() => ({
    getActiveFaqs: jest.fn().mockResolvedValue("FAQs"),
  })),
}))

// Mock axios for OpenRouter
jest.mock("axios", () => ({
  post: jest.fn(),
}))

// Mock logger to keep tests quiet
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import axios from "axios"
import { CustomerSupportAgentLLM } from "../../../src/application/agents/CustomerSupportAgentLLM"

describe("CustomerSupportAgentLLM - temperature/model from DB", () => {
  let prisma: any

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "test-api-key"

    const db = require("@echatbot/database")
    prisma = db.prisma

    prisma.workspace.findUnique.mockResolvedValue({
      channelMode: 'ECOMMERCE' as any,
      hasHumanSupport: true,
    })
  })

  const buildCtx = () => ({
    workspaceId: "ws-1",
    customerId: "cust-1",
    query: "Hi",
  })

  it("uses agentConfig temperature/model/maxTokens when present", async () => {
    prisma.agentConfig.findFirst.mockResolvedValue({
      type: "CUSTOMER_SUPPORT",
      model: "openai/gpt-4o-mini-2024-09",
      temperature: 0.25,
      maxTokens: 1234,
      isActive: true,
      systemPrompt: "ignored",
    })

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: {
        choices: [{ message: { content: "hello" } }],
        usage: { total_tokens: 10 },
      },
    })

    const agent = new CustomerSupportAgentLLM(prisma)
    await agent.handleQuery(buildCtx())

    expect(axios.post).toHaveBeenCalled()
    const payload = (axios.post as jest.Mock).mock.calls[0][1]
    expect(payload.model).toBe("openai/gpt-4o-mini-2024-09")
    expect(payload.temperature).toBe(0.25)
    expect(payload.max_tokens).toBe(1234)
  })

  it("falls back to defaults when agentConfig is missing", async () => {
    prisma.agentConfig.findFirst.mockResolvedValue(null)

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: {
        choices: [{ message: { content: "hello" } }],
        usage: { total_tokens: 10 },
      },
    })

    const agent = new CustomerSupportAgentLLM(prisma)
    await agent.handleQuery(buildCtx())

    const payload = (axios.post as jest.Mock).mock.calls[0][1]
    expect(payload.model).toBe("gpt-4o-mini")
    expect(payload.temperature).toBe(0.7)
    expect(payload.max_tokens).toBe(2000)
  })
})
