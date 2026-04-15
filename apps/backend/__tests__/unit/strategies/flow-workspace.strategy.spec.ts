/**
 * E4 — FlowWorkspaceStrategy Unit Tests
 *
 * Tests the 3-path routing logic:
 *   Path A: QR code → load FlowNodeConfig, save context, return welcome
 *   Path B: Active flowState → FlowEngineService (deterministic, 0 LLM tokens)
 *   Path C: No active flow → FlowAgentLLM (LLM decides startFlow/contactOperator/text)
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
    // T2: QR code message → loads FlowNodeConfig, saves flowKey to context
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: Customer scans QR code on machine #3 labeled "lavatrice_hs60xx"
    // RULE: Strategy extracts flowKey + flowNumber, loads config from DB, saves to session context
    it("QR message → loads FlowNodeConfig, saves flowKey to context", async () => {
      const prisma = createPrismaMock()
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "START_FLOW_3_lavatrice_hs60xx" })

      mockFindByFlowKey.mockResolvedValue(MOCK_FLOW_CONFIG)

      const result = await strategy.route(context, workspace)

      // ASSERT: FlowNodeConfig loaded by (workspaceId, flowKey)
      expect(mockFindByFlowKey).toHaveBeenCalledWith("ws-flow-1", "lavatrice_hs60xx")

      // ASSERT: Context saved with flowKey + flowNumber
      expect(prisma.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              flowKey: "lavatrice_hs60xx",
              flowNumber: "3",
            }),
          }),
        })
      )

      // ASSERT: Welcome message includes flowLabel and machine number
      expect(result.response).toBeDefined()
    })

    // ───────────────────────────────────────────────────────────────────────
    // T3: QR with unknown flowKey → returns error message
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: QR code has a flowKey that doesn't exist in the database
    // RULE: Strategy returns a user-friendly error, does NOT crash
    it("QR with unknown flowKey → returns error message (does not throw)", async () => {
      const prisma = createPrismaMock()
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "START_FLOW_1_unknown_machine" })

      mockFindByFlowKey.mockResolvedValue(null) // Config not found

      // Make translation pass through for this test
      mockTranslationProcess.mockImplementation(async (opts: any) => ({
        translated: false,
        originalLanguage: "en",
        targetLanguage: "es",
        message: opts.message, // Pass through original
        tokensUsed: 0,
      }))

      const result = await strategy.route(context, workspace)

      // ASSERT: Returns readable error containing the unknown flowKey
      expect(result.response).toContain("unknown_machine")
      // ASSERT: FlowAgentLLM was NOT called
      expect(mockHandleQuery).not.toHaveBeenCalled()
    })

    // ───────────────────────────────────────────────────────────────────────
    // T4: flowState ACTIVE → routes to FlowEngine, NOT FlowAgentLLM
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
    // T5: No active flow + flowKey present → routes to FlowAgentLLM
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: Customer scanned QR earlier but no flow started yet, types free text
    // RULE: FlowAgentLLM handles → LLM decides whether to startFlow or respond
    it("No active flow + flowKey present → routes to FlowAgentLLM", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: { flowKey: "lavatrice_hs60xx" },
            escalatedAt: null,
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
    // T6: FlowEngine output → TranslationAgent called
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
    // T7: FlowAgentLLM output → TranslationAgent called
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
    // T8: shouldCallOperator → contactOperator() called
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
    // T9: ChatSession.context saved after every message
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
    // T10: FlowEngine throws → strategy catches and returns readable error
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
    // T11: No flowKey in context + no QR → returns "scan QR first" hint
    // ───────────────────────────────────────────────────────────────────────
    // SCENARIO: Customer writes to FLOW workspace without scanning QR first
    // RULE: Strategy returns a helpful message asking them to scan the QR code
    it("No flowKey in context + no QR → returns 'scan QR' hint", async () => {
      const prisma = createPrismaMock({
        chatSession: {
          findFirst: jest.fn().mockResolvedValue({
            id: "session-1",
            context: {}, // No flowKey!
            escalatedAt: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const strategy = new FlowWorkspaceStrategy(prisma)
      const workspace = createFlowWorkspace()
      const context = createContext({ message: "help me" })

      const result = await strategy.route(context, workspace)

      // ASSERT: Hint to scan QR
      expect(result.response).toBeDefined()
      // ASSERT: No FlowEngine or FlowAgentLLM called
      expect(mockHandleMessage).not.toHaveBeenCalled()
      expect(mockHandleQuery).not.toHaveBeenCalled()
    })
  })
})
