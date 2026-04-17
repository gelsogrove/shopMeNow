/**
 * E3 — FlowAgentLLM Unit Tests
 *
 * Tests `FlowAgentLLM.handleQuery()` with mocked prisma, axios, and services.
 *
 * KEY INVARIANTS UNDER TEST:
 * 1. systemPrompt ALWAYS comes from FlowNodeConfig in DB — never hardcoded
 * 2. model/temperature ALWAYS come from FlowNodeConfig — not from env defaults
 * 3. Tool enum is built server-side from Object.keys(config.flows) — never hardcoded
 * 4. contactOperator tool is absent unless "contactOperator" is in availableFunctions
 * 5. startFlow tool_call → FlowEngineService.startFlow() → step_0 prompt returned directly
 * 6. Config not found → throws descriptive error (no silent fallback)
 * 7. workspaceId is passed to every DB query (isolation)
 * 8. History loaded from ConversationManager (scoped to conversationId + workspaceId)
 */

import { FlowAgentLLM, FlowAgentContext } from "../../../src/application/agents/FlowAgentLLM"

// ─── Mock PromptProcessorService — passthrough ──────────────────────────────
jest.mock("../../../src/services/prompt-processor.service", () => ({
  PromptProcessorService: jest.fn().mockImplementation(() => ({
    processWithVariables: jest.fn((template: string) => template),
  })),
}))

// ─── Mock PromptVariableBuilder — returns empty vars ─────────────────────────
jest.mock("../../../src/application/services/prompt-variable-builder.service", () => ({
  PromptVariableBuilder: { build: jest.fn().mockReturnValue({}) },
}))

// ─── Mock prisma ──────────────────────────────────────────────────────────────
const mockPrisma = {
  workspace: { findUnique: jest.fn().mockResolvedValue({ id: "ws-test-1", name: "Test" }) },
  customers: { findFirst: jest.fn().mockResolvedValue({ id: "cust-1", name: "Test Customer" }) },
  fAQ: { findMany: jest.fn().mockResolvedValue([]) },
}
jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

// ─── Mock axios ───────────────────────────────────────────────────────────────
jest.mock("axios")
import axios from "axios"
const mockedAxios = axios as jest.Mocked<typeof axios>

// ─── Mock withOpenRouterRetry — just calls the fn ────────────────────────────
jest.mock("../../../src/utils/llm-retry", () => ({
  withOpenRouterRetry: jest.fn((fn: () => Promise<unknown>) => fn()),
}))

// ─── Mock ConversationManager ─────────────────────────────────────────────────
const mockLoadHistory = jest.fn().mockResolvedValue([])
jest.mock("../../../src/services/conversation-manager.service", () => ({
  ConversationManager: jest.fn().mockImplementation(() => ({
    loadHistory: mockLoadHistory,
  })),
}))

// ─── Mock FlowNodeConfigRepository ───────────────────────────────────────────
const mockFindByFlowKey = jest.fn()
jest.mock("../../../src/repositories/flow-node-config.repository", () => ({
  FlowNodeConfigRepository: jest.fn().mockImplementation(() => ({
    findByFlowKey: mockFindByFlowKey,
  })),
}))

// ─── Test helpers ─────────────────────────────────────────────────────────────
const WORKSPACE_ID = "ws-test-1"
const CUSTOMER_ID = "cust-1"
const CONV_ID = "conv-1"
const FLOW_KEY = "hs60xx"

function makeFlowConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: "cfg-1",
    workspaceId: WORKSPACE_ID,
    flowKey: FLOW_KEY,
    flowLabel: "Washing Machine HS-60XX",
    systemPrompt: "You are a washing machine troubleshooter.",
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    availableFunctions: ["contactOperator"],
    flows: {
      non_parte: {
        step_0: { type: "CHOICE", prompt: "What error do you see on the display?" },
      },
      no_centrifuga: {
        step_0: { type: "CHOICE", prompt: "Is the drum spinning?" },
      },
    },
    isActive: true,
    ...overrides,
  }
}

function makeContext(overrides: Partial<FlowAgentContext> = {}): FlowAgentContext {
  return {
    workspaceId: WORKSPACE_ID,
    customerId: CUSTOMER_ID,
    conversationId: CONV_ID,
    flowKey: FLOW_KEY,
    message: "My machine is not starting",
    chatContext: {},
    customerLanguage: "en",
    ...overrides,
  }
}

function makeLLMResponse(content: string | null = "Let me help you.", toolCalls: unknown[] = []) {
  return {
    data: {
      choices: [
        {
          message: {
            content,
            tool_calls: toolCalls,
          },
        },
      ],
      usage: { total_tokens: 42 },
    },
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks()
  process.env.OPENROUTER_API_KEY = "test-key"
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("E3 - FlowAgentLLM.handleQuery", () => {
  it("T1: tool enum built from Object.keys(flows) — not hardcoded", async () => {
    // RULE: Tool enum = DB flows keys. Admin adds/removes flows → tools update automatically.
    // NEVER hardcode flow IDs in agent code.
    mockFindByFlowKey.mockResolvedValue(makeFlowConfig())
    mockedAxios.post.mockResolvedValue(makeLLMResponse())

    const agent = new FlowAgentLLM(mockPrisma as any)
    await agent.handleQuery(makeContext())

    const callBody = mockedAxios.post.mock.calls[0][1] as any
    const startFlowTool = callBody.tools.find((t: any) => t.function.name === "startFlow")
    expect(startFlowTool).toBeDefined()
    // Enum must exactly match the DB flow keys
    expect(startFlowTool.function.parameters.properties.flowId.enum).toEqual(
      expect.arrayContaining(["non_parte", "no_centrifuga"])
    )
    expect(startFlowTool.function.parameters.properties.flowId.enum).toHaveLength(2)
  })

  it("T2: contactOperator tool absent when not in availableFunctions", async () => {
    // RULE: Tool list is filtered by config.availableFunctions.
    // If admin removes 'contactOperator' from DB config, the tool disappears from LLM call.
    mockFindByFlowKey.mockResolvedValue(
      makeFlowConfig({ availableFunctions: [] }) // no contactOperator
    )
    mockedAxios.post.mockResolvedValue(makeLLMResponse())

    const agent = new FlowAgentLLM(mockPrisma as any)
    await agent.handleQuery(makeContext())

    const callBody = mockedAxios.post.mock.calls[0][1] as any
    const contactTool = callBody.tools?.find((t: any) => t.function.name === "contactOperator")
    expect(contactTool).toBeUndefined()
  })

  it("T3: systemPrompt comes from FlowNodeConfig in DB — not hardcoded", async () => {
    // RULE: DB-first architecture. FlowAgentLLM MUST use config.systemPrompt
    // from the database record. Any hardcoded fallback is FORBIDDEN.
    const customPrompt = "CUSTOM: You are a specific machine assistant for model X-9000."
    mockFindByFlowKey.mockResolvedValue(makeFlowConfig({ systemPrompt: customPrompt }))
    mockedAxios.post.mockResolvedValue(makeLLMResponse())

    const agent = new FlowAgentLLM(mockPrisma as any)
    await agent.handleQuery(makeContext())

    const callBody = mockedAxios.post.mock.calls[0][1] as any
    const systemMessage = callBody.messages.find((m: any) => m.role === "system")
    expect(systemMessage?.content).toBe(customPrompt)
  })

  it("T4: model and temperature come from FlowNodeConfig — not from env defaults", async () => {
    // RULE: Each machine can have different LLM settings (e.g., dryer uses GPT-4, washer gpt-4o-mini).
    // Never hardcode model/temperature in agent code.
    mockFindByFlowKey.mockResolvedValue(
      makeFlowConfig({ model: "openai/gpt-4o", temperature: 0.1 })
    )
    mockedAxios.post.mockResolvedValue(makeLLMResponse())

    const agent = new FlowAgentLLM(mockPrisma as any)
    await agent.handleQuery(makeContext())

    const callBody = mockedAxios.post.mock.calls[0][1] as any
    expect(callBody.model).toBe("openai/gpt-4o")
    expect(callBody.temperature).toBe(0.1)
  })

  it("T5: config not found → throws descriptive error (no silent fallback)", async () => {
    // RULE: DB-first — if config missing, throw. NEVER invent defaults.
    // The error message must include workspaceId and flowKey to aid debugging.
    mockFindByFlowKey.mockResolvedValue(null)

    const agent = new FlowAgentLLM(mockPrisma as any)
    await expect(agent.handleQuery(makeContext())).rejects.toThrow(
      /FlowNodeConfig not found.*hs60xx.*ws-test-1/
    )
  })

  it("T6: history loaded from ConversationManager scoped to workspaceId+conversationId", async () => {
    // RULE: Conversation history MUST be scoped (workspaceId+conversationId).
    // This enforces isolation — one workspace cannot see another's history.
    mockFindByFlowKey.mockResolvedValue(makeFlowConfig())
    mockedAxios.post.mockResolvedValue(makeLLMResponse())

    const agent = new FlowAgentLLM(mockPrisma as any)
    await agent.handleQuery(makeContext())

    expect(mockLoadHistory).toHaveBeenCalledWith(WORKSPACE_ID, CONV_ID)
    expect(mockLoadHistory).toHaveBeenCalledTimes(1)
  })

  it("T7: startFlow tool_call → FlowEngineService.startFlow() → step_0 prompt as response", async () => {
    // RULE: When LLM calls startFlow, FlowEngineService runs deterministically.
    // step_0.prompt IS the response — no second LLM call is made.
    // chatContext.flowState must be updated with the new flow state.
    mockFindByFlowKey.mockResolvedValue(makeFlowConfig())
    mockedAxios.post.mockResolvedValue(
      makeLLMResponse(null, [
        {
          id: "call_1",
          type: "function",
          function: {
            name: "startFlow",
            arguments: JSON.stringify({ flowId: "non_parte" }),
          },
        },
      ])
    )

    const agent = new FlowAgentLLM(mockPrisma as any)
    const result = await agent.handleQuery(makeContext())

    // Output must be the step_0 prompt from the flow definition
    expect(result.output).toBe("What error do you see on the display?")
    // flowState must be ACTIVE and pointing to the first node
    expect(result.chatContext.flowState?.flowStatus).toBe("ACTIVE")
    expect(result.chatContext.flowState?.flowId).toBe("non_parte")
    // Verify it was recorded as a function call
    const startFlowCall = result.functionCalls.find((c) => c.name === "startFlow")
    expect(startFlowCall).toBeDefined()
    expect(startFlowCall?.arguments).toEqual({ flowId: "non_parte" })
  })

  it("T8: workspaceId passed to findByFlowKey for workspace isolation", async () => {
    // RULE: EVERY DB query MUST receive workspaceId.
    // This is critical for multi-tenant security.
    mockFindByFlowKey.mockResolvedValue(makeFlowConfig())
    mockedAxios.post.mockResolvedValue(makeLLMResponse())

    const agent = new FlowAgentLLM(mockPrisma as any)
    await agent.handleQuery(makeContext({ workspaceId: "ws-specific-99" }))

    expect(mockFindByFlowKey).toHaveBeenCalledWith("ws-specific-99", FLOW_KEY)
  })
})
