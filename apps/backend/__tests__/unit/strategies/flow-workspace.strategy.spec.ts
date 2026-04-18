/**
 * E4 — FlowWorkspaceStrategy Unit Tests
 *
 * Tests the 3-path routing logic:
 *   Path A: Active flowState → FlowEngineService (deterministic, 0 LLM tokens)
 *   Path B: flowKey set, no active flow → FlowAgentLLM (Sub-LLM for machine)
 *   Path C: No flowKey → Router FlowAgentLLM (gathers locale/machine/number)
 *
 * Also verifies post-processing: TranslationAgent, contactOperator, context saving.
 */

import { ChannelMode } from "@echatbot/database"

// ── Mock modules BEFORE importing the class under test ──────────────────────

// MOCK: FlowAgentLLM
const mockHandleQuery = jest.fn()
jest.mock("../../../src/application/agents/FlowAgentLLM", () => ({
  FlowAgentLLM: jest.fn().mockImplementation(() => ({
    handleQuery: mockHandleQuery,
  })),
}))

// MOCK: FlowEngineService
const mockHandleMessage = jest.fn()
const mockStartFlow = jest.fn()
jest.mock("../../../src/application/services/flow-engine.service", () => ({
  FlowEngineService: jest.fn().mockImplementation(() => ({
    handleMessage: mockHandleMessage,
    startFlow: mockStartFlow,
  })),
}))

// MOCK: FlowNodeConfigRepository
const mockFindByFlowKey = jest.fn()
jest.mock("../../../src/repositories/flow-node-config.repository", () => ({
  FlowNodeConfigRepository: jest.fn().mockImplementation(() => ({
    findByFlowKey: mockFindByFlowKey,
  })),
}))

// MOCK: TranslationAgent
const mockTranslationProcess = jest.fn()
jest.mock("../../../src/application/agents/TranslationAgent", () => ({
  TranslationAgent: jest.fn().mockImplementation(() => ({
    process: mockTranslationProcess,
  })),
}))

// MOCK: SecurityAgent
const mockSecurityProcess = jest.fn()
jest.mock("../../../src/application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({
    process: mockSecurityProcess,
  })),
}))

// MOCK: LinkReplacementService
const mockReplaceTokens = jest.fn()
jest.mock("../../../src/application/services/link-replacement.service", () => ({
  LinkReplacementService: jest.fn().mockImplementation(() => ({
    replaceTokens: mockReplaceTokens,
  })),
}))

// MOCK: contactOperator (standalone function)
const mockContactOperator = jest.fn()
jest.mock("../../../src/domain/calling-functions/contactOperator", () => ({
  contactOperator: mockContactOperator,
}))

// MOCK: logger
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import { FlowWorkspaceStrategy } from "../../../src/strategies/flow-workspace.strategy"
import type { RoutingContext } from "../../../src/strategies/routing-strategy.interface"

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal PrismaClient mock scoped per test */
function createPrismaMock(overrides: Record<string, any> = {}) {
  return {
    customers: {
      findFirst: jest.fn().mockResolvedValue({
        id: "cust-1",
        name: "Mario Rossi",
        email: "mario@test.com",
        phone: "+34600111222",
        isActive: true,
        language: "es",
      }),
    },
    chatSession: {
      findFirst: jest.fn().mockResolvedValue({
        id: "session-1",
        context: {},
        escalatedAt: null,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as any
}

/** Standard FLOW workspace object */
function createFlowWorkspace(overrides: Record<string, any> = {}) {
  return {
    id: "ws-flow-1",
    name: "Ecolaundry",
    slug: "ecolaundry",
    channelMode: ChannelMode.FLOW,
    language: "ESP",
    sessionResetTimeout: 3600,
    chatbotName: "Sofia",
    ...overrides,
  } as any
}

/** Standard routing context */
function createContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return {
    workspaceId: "ws-flow-1",
    customerId: "cust-1",
    message: "la lavadora no arranca",
    conversationId: "conv-1",
    channel: "whatsapp",
    customerName: "Mario Rossi",
    customerLanguage: "es",
    ...overrides,
  }
}

/** Standard FlowNodeConfig from DB */
const MOCK_FLOW_CONFIG = {
  id: "fnc-1",
  workspaceId: "ws-flow-1",
  flowKey: "lavatrice_hs60xx",
  flowLabel: "Washer HS-60XX",
  systemPrompt: "You are Sofia...",
  model: "openai/gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 2048,
  availableFunctions: ["startFlow", "contactOperator"],
  flows: {
    non_parte: {
      step_0: {
        type: "CHOICE",
        prompt: "What do you see?",
        transitions: { "1": "non_parte.caso_sel" },
      },
      caso_sel: {
        type: "INFO",
        prompt: "SEL means select program.",
        isTerminal: true,
      },
    },
  },
  isActive: true,
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()

  // DEFAULTS: translation passes through, link replacement passes through
  mockTranslationProcess.mockResolvedValue({
    translated: false,
    originalLanguage: "en",
    targetLanguage: "es",
    message: "TRANSLATED: response",
    tokensUsed: 10,
    executionTimeMs: 50,
  })

  mockSecurityProcess.mockResolvedValue({
    safe: true,
    message: "safe response",
    tokensUsed: 5,
  })

  mockReplaceTokens.mockResolvedValue({
    success: true,
    response: null, // null = no replacement done, use original
  })

  mockContactOperator.mockResolvedValue({
    success: true,
    message: "Operator contacted",
    timestamp: new Date().toISOString(),
  })
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe("FlowWorkspaceStrategy", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // T1: canHandle — checks channelMode
  // ─────────────────────────────────────────────────────────────────────────
  describe("canHandle", () => {
    // SCENARIO: Strategy selector checks each workspace to find the right strategy
    // RULE: Only FLOW workspaces should be handled by FlowWorkspaceStrategy
    it("returns true for FLOW workspace, false for ECOMMERCE and INFORMATIONAL", () => {
      const prisma = createPrismaMock()
      const strategy = new FlowWorkspaceStrategy(prisma)

      expect(strategy.canHandle(createFlowWorkspace())).toBe(true)
      expect(strategy.canHandle(createFlowWorkspace({ channelMode: ChannelMode.ECOMMERCE }))).toBe(false)
      expect(strategy.canHandle(createFlowWorkspace({ channelMode: ChannelMode.INFORMATIONAL }))).toBe(false)
    })
  })

  describe("route", () => {
    // ───────────────────────────────────────────────────────────────────────
    // T2: flowState ACTIVE → routes to FlowEngine, NOT FlowAgentLLM
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: Customer is mid-flow (e.g., step_0 → replied "1")
    // RULE: Active flow goes to deterministic FlowEngine (0 LLM tokens)
    it("flowState ACTIVE → routes to FlowEngine, NOT FlowAgentLLM", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: {
              flowKey: "lavatrice_hs60xx",
              flowState: {
                flowId: "non_parte",
                flowStatus: "ACTIVE",
                currentNodeId: "non_parte.step_0",
                interruptCount: 0,
              },
            },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "1" })

      mockFindByFlowKey.mockResolvedValue(MOCK_FLOW_CONFIG)
      mockHandleMessage.mockReturnValue({
        responseText: "SEL means select program.",
        nextNodeId: "non_parte.caso_sel",
        flowStatus: "COMPLETED",
        shouldCallOperator: false,
      })

      await strategy.route(context, workspace)

      // ASSERT: FlowEngine used, FlowAgentLLM NOT used
      expect(mockHandleMessage).toHaveBeenCalled()
      expect(mockHandleQuery).not.toHaveBeenCalled()
    })

    // ───────────────────────────────────────────────────────────────────────
    // T3: No active flow + flowKey present → routes to FlowAgentLLM
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: Customer assigned to machine but no flow started yet, types free text
    // RULE: FlowAgentLLM handles → LLM decides whether to startFlow or respond
    it("No active flow + flowKey present → routes to FlowAgentLLM", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: { flowKey: "lavatrice_hs60xx" },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "la lavadora no arranca" })

      mockHandleQuery.mockResolvedValue({
        success: true,
        output: "I'll help you! Which display state do you see?",
        chatContext: { flowKey: "lavatrice_hs60xx" },
        tokensUsed: 150,
        executionTimeMs: 800,
        functionCalls: [],
        shouldCallOperator: false,
      })

      await strategy.route(context, workspace)

      // ASSERT: FlowAgentLLM used, FlowEngine NOT used
      expect(mockHandleQuery).toHaveBeenCalled()
      expect(mockHandleMessage).not.toHaveBeenCalled()
    })

    // ───────────────────────────────────────────────────────────────────────
    // T4: FlowEngine output → TranslationAgent called
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: FlowEngine produces English response, customer speaks Spanish
    // RULE: TranslationAgent MUST translate EVERY response, regardless of path
    it("FlowEngine output → TranslationAgent called with response", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: {
              flowKey: "lavatrice_hs60xx",
              flowState: {
                flowId: "non_parte",
                flowStatus: "ACTIVE",
                currentNodeId: "non_parte.step_0",
                interruptCount: 0,
              },
            },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "1" })

      mockFindByFlowKey.mockResolvedValue(MOCK_FLOW_CONFIG)
      mockHandleMessage.mockReturnValue({
        responseText: "SEL means select program.",
        nextNodeId: "non_parte.caso_sel",
        flowStatus: "COMPLETED",
        shouldCallOperator: false,
      })

      await strategy.route(context, workspace)

      // ASSERT: TranslationAgent called with the FlowEngine response
      expect(mockTranslationProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-flow-1",
          message: expect.any(String),
        })
      )
    })

    // ───────────────────────────────────────────────────────────────────────
    // T5: FlowAgentLLM output → TranslationAgent called
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: LLM returns English response, customer speaks Spanish
    // RULE: TranslationAgent runs on FlowAgentLLM output too
    it("FlowAgentLLM output → TranslationAgent called", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: { flowKey: "lavatrice_hs60xx" },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "ayúdame" })

      mockHandleQuery.mockResolvedValue({
        success: true,
        output: "I can help you. What's on the display?",
        chatContext: { flowKey: "lavatrice_hs60xx" },
        tokensUsed: 100,
        executionTimeMs: 600,
        functionCalls: [],
        shouldCallOperator: false,
      })

      await strategy.route(context, workspace)

      // ASSERT: Translation called on LLM output
      expect(mockTranslationProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-flow-1",
          message: expect.any(String),
        })
      )
    })

    // ───────────────────────────────────────────────────────────────────────
    // T6: shouldCallOperator → contactOperator() called
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: FlowEngine reaches handle_escalate node (shouldCallOperator=true)
    // RULE: contactOperator() is called with correct workspace/customer data
    it("shouldCallOperator → contactOperator() called", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: {
              flowKey: "lavatrice_hs60xx",
              flowState: {
                flowId: "non_parte",
                flowStatus: "ACTIVE",
                currentNodeId: "non_parte.ask_resolved",
                interruptCount: 0,
              },
            },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "no" })

      mockFindByFlowKey.mockResolvedValue(MOCK_FLOW_CONFIG)
      mockHandleMessage.mockReturnValue({
        responseText: "I'm contacting an operator.",
        nextNodeId: "non_parte.handle_escalate",
        flowStatus: "ESCALATED",
        shouldCallOperator: true,
      })

      await strategy.route(context, workspace)

      // ASSERT: contactOperator called with request object
      expect(mockContactOperator).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+34600111222",
          workspaceId: "ws-flow-1",
          customerId: "cust-1",
          reason: "Flow escalation",
          channel: "whatsapp",
        })
      )
    })

    // ───────────────────────────────────────────────────────────────────────
    // T7: ChatSession.context saved after every message
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: After any path processes a message, updated context must be persisted
    // RULE: ChatSession.update() is always called with the updated context
    it("ChatSession.context saved after every message", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: { flowKey: "lavatrice_hs60xx" },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "the machine won't start" })

      mockHandleQuery.mockResolvedValue({
        success: true,
        output: "I'll guide you.",
        chatContext: { flowKey: "lavatrice_hs60xx", lastInteraction: "guided" },
        tokensUsed: 80,
        executionTimeMs: 500,
        functionCalls: [],
        shouldCallOperator: false,
      })

      await strategy.route(context, workspace)

      // ASSERT: ChatSession updated with context from FlowAgentLLM
      expect(prisma.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-1" },
          data: expect.objectContaining({
            context: expect.any(Object),
          }),
        })
      )
    })

    // ───────────────────────────────────────────────────────────────────────
    // T8: FlowEngine throws → strategy catches and returns readable error
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: FlowNodeConfig exists but flows JSON is corrupt → FlowEngine throws
    // RULE: Strategy catches, logs error, re-throws (handled by caller)
    it("FlowEngine throws → strategy propagates error", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: {
              flowKey: "lavatrice_hs60xx",
              flowState: {
                flowId: "non_parte",
                flowStatus: "ACTIVE",
                currentNodeId: "non_parte.step_0",
                interruptCount: 0,
              },
            },
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "1" })

      // Config found but FlowEngine throws on corrupt flows
      mockFindByFlowKey.mockResolvedValue(MOCK_FLOW_CONFIG)
      mockHandleMessage.mockImplementation(() => {
        throw new Error("Invalid node reference: non_parte.broken_node")
      })

      // ASSERT: Strategy propagates the error
      await expect(strategy.route(context, workspace)).rejects.toThrow(
        "Invalid node reference"
      )
    })

    // ───────────────────────────────────────────────────────────────────────
    // T9: No flowKey → calls Router FlowAgentLLM (PATH C)
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: Customer writes to FLOW workspace without any assigned machine
    // RULE: Strategy calls Router FlowAgentLLM (flowKey="router") to gather
    //       locale → machine type → machine number → assignMachine()
    it("No flowKey in context → calls Router FlowAgentLLM (PATH C)", async () => {
      const MOCK_ROUTER_CONFIG = {
        id: "fnc-router",
        workspaceId: "ws-flow-1",
        flowKey: "router",
        flowLabel: "Router",
        systemPrompt: "You are the Ecolaundry router assistant...",
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 1024,
        availableFunctions: ["assignMachine"],
        flows: { "lavatrice_hs60xx": {}, "asciugatrice_ed340": {} },
        isActive: true,
      }

      // Router config exists in this workspace
      mockFindByFlowKey.mockResolvedValue(MOCK_ROUTER_CONFIG)

      // Router LLM responds with a welcome + first question
      mockHandleQuery.mockResolvedValue({
        success: true,
        output: "¡Hola! Soy el asistente de Ecolaundry, ¿cómo puedo ayudarte hoy?",
        chatContext: {}, // no flowKey yet (user just greeted)
        tokensUsed: 30,
        executionTimeMs: 200,
        functionCalls: [],
        shouldCallOperator: false,
      })

      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: {}, // No flowKey!
            escalatedAt: null,
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "ciao" })

      const result = await strategy.route(context, workspace)

      // ASSERT: Response is defined (from Router LLM)
      expect(result.response).toBeDefined()
      // ASSERT: Router LLM was called with flowKey="router" (PATH C behaviour)
      expect(mockHandleQuery).toHaveBeenCalledWith(
        expect.objectContaining({ flowKey: "router", message: "ciao" })
      )
      // ASSERT: FlowEngineService NOT called (no active flow to process)
      expect(mockHandleMessage).not.toHaveBeenCalled()
    })
  })
})
