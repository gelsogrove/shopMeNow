/**
 * Registration Gate Tests - CartManagementAgentLLM & OrderTrackingAgentLLM
 *
 * SCENARIO: A customer who is NOT registered (isActive = false) tries to:
 *   - Add items to cart
 *   - View/track orders
 *
 * RULE: Both agents MUST block the action and return a response containing
 * [LINK_REGISTRATION] so the LinkReplacementService can inject the real link.
 *
 * WHY: The registration gate ensures that protected business actions (cart, orders)
 * are only available to registered customers. Unregistered users get a natural
 * message with a registration link.
 *
 * ARCHITECTURE:
 * - Gate runs BEFORE any LLM call (no tokens wasted)
 * - Gate loads isActive from DB if not pre-loaded by the Router
 * - When pre-loaded by Router (customerIsRegistered param), no extra DB query
 * - [LINK_REGISTRATION] token is later replaced by LinkReplacementService
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals"

// ============================================================
// MOCKS — must be declared before imports
// ============================================================

jest.mock("@echatbot/database", () => ({
  PrismaClient: jest.fn(),
  AgentType: { CART_MANAGEMENT: "CART_MANAGEMENT", ORDER_TRACKING: "ORDER_TRACKING" },
}))

jest.mock("axios", () => ({
  default: { post: jest.fn() },
  post: jest.fn(),
}))

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

jest.mock("../../../src/application/services/template-loader.service", () => ({
  TemplateLoaderService: {
    getInstance: jest.fn().mockReturnValue({
      loadAndRenderTemplate: jest.fn().mockResolvedValue("mock system prompt"),
    }),
  },
}))

jest.mock("../../../src/services/system-context.service", () => ({
  getSystemContextService: jest.fn().mockReturnValue({}),
}))

jest.mock("../../../src/services/prompt-processor.service", () => ({
  PromptProcessorService: jest.fn().mockImplementation(() => ({
    preProcessPrompt: jest.fn().mockResolvedValue("mock processed prompt"),
  })),
}))

jest.mock("../../../src/repositories/agent-config.repository", () => ({
  AgentConfigRepository: jest.fn().mockImplementation(() => ({
    findByWorkspaceAndType: jest.fn().mockResolvedValue(null),
  })),
}))

jest.mock("../../../src/repositories/cart.repository", () => ({
  CartRepository: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/repositories/product.repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/repositories/service.repository", () => ({
  ServiceRepository: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/repositories/order.repository", () => ({
  OrderRepository: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/application/agents/CartManagementAgent", () => ({
  CartManagementAgent: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/services/calling-functions.service", () => ({
  CallingFunctionsService: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/application/services/link-generator.service", () => ({
  LinkGeneratorService: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("@shared/pricing", () => ({
  DEFAULT_ROUNDING_STEP: 0.05,
  formatRoundedCurrency: jest.fn().mockReturnValue("€0.00"),
  smartRoundPrice: jest.fn().mockReturnValue(0),
}))

jest.mock("../../../src/config", () => ({
  config: { openRouterApiKey: "test-key" },
}))

// ============================================================
// Static imports (after all mocks)
// ============================================================

import { CartManagementAgentLLM } from "../../../src/application/agents/CartManagementAgentLLM"
import { OrderTrackingAgentLLM } from "../../../src/application/agents/OrderTrackingAgentLLM"

// ============================================================
// TESTS
// ============================================================

const WORKSPACE_ID = "workspace-test-123"
const CUSTOMER_ID = "customer-test-456"

/**
 * Build a minimal Prisma mock with just what the gate needs
 */
function buildPrismaMock(isActive: boolean | null) {
  return {
    customers: {
      findUnique: jest.fn().mockResolvedValue(isActive !== null ? { isActive } : null),
    },
    workspace: {
      findUnique: jest.fn().mockResolvedValue({ name: "Test Workspace" }),
    },
  } as any
}

describe("Registration Gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "test-api-key"
  })

  // ============================================================
  // CartManagementAgentLLM
  // ============================================================
  describe("CartManagementAgentLLM", () => {
    it("should block cart access when customerIsRegistered=false is passed directly", async () => {
      // SCENARIO: Router pre-loads customerIsActive=false and passes it to the agent
      // RULE: Agent must block immediately WITHOUT making a DB query
      // WHY: Avoid redundant DB calls when Router already loaded the status

      const prismaMock = buildPrismaMock(true) // DB says active, but we override with pre-loaded=false
      const agent = new CartManagementAgentLLM(prismaMock)

      const response = await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        query: "aggiungi 2 mozzarelle al carrello",
        customerIsRegistered: false, // Pre-loaded: NOT registered
      })

      // MUST return a registration prompt
      expect(response.success).toBe(true)
      expect(response.output).toContain("[LINK_REGISTRATION]")
      expect(response.tokensUsed).toBe(0) // No LLM call
      expect(response.functionCalls).toHaveLength(0)

      // DB should NOT be queried (value was pre-loaded)
      expect(prismaMock.customers.findUnique).not.toHaveBeenCalled()
    })

    it("should block cart access when DB returns isActive=false", async () => {
      // SCENARIO: customerIsRegistered not passed, agent loads from DB
      // DB returns isActive=false (customer exists but not registered)
      // RULE: Agent must block and return registration message

      const prismaMock = buildPrismaMock(false)
      const agent = new CartManagementAgentLLM(prismaMock)

      const response = await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        query: "voglio comprare qualcosa",
        // customerIsRegistered NOT passed → agent loads from DB
      })

      expect(response.success).toBe(true)
      expect(response.output).toContain("[LINK_REGISTRATION]")
      expect(response.tokensUsed).toBe(0)
      expect(response.functionCalls).toHaveLength(0)
    })

    it("should block cart access when customer does not exist in DB", async () => {
      // SCENARIO: Customer not found in DB (null response)
      // RULE: Unknown customer = not registered → block with registration link
      // WHY: Safety-first — if we cannot verify registration, deny access

      const prismaMock = buildPrismaMock(null) // null = customer not found
      const agent = new CartManagementAgentLLM(prismaMock)

      const response = await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: "unknown-customer",
        query: "aggiungi prodotto al carrello",
      })

      expect(response.success).toBe(true)
      expect(response.output).toContain("[LINK_REGISTRATION]")
      expect(response.tokensUsed).toBe(0)
    })

    it("should NOT query DB when customerIsRegistered is explicitly provided", async () => {
      // SCENARIO: Router passes customerIsRegistered=false
      // RULE: Agent respects the pre-loaded value and skips DB query
      // WHY: Performance — Router already paid the DB cost

      const prismaMock = buildPrismaMock(true)
      const agent = new CartManagementAgentLLM(prismaMock)

      await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        query: "test",
        customerIsRegistered: false,
      })

      expect(prismaMock.customers.findUnique).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // OrderTrackingAgentLLM
  // ============================================================
  describe("OrderTrackingAgentLLM", () => {
    it("should block order tracking when customerIsRegistered=false is passed directly", async () => {
      // SCENARIO: Unregistered user asks to see their orders
      // RULE: Cannot track orders without registering first
      // WHY: Order history is tied to a registered account

      const prismaMock = buildPrismaMock(true)
      const agent = new OrderTrackingAgentLLM(prismaMock)

      const response = await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        query: "dove è il mio ordine?",
        customerIsRegistered: false, // Pre-loaded: NOT registered
      })

      expect(response.success).toBe(true)
      expect(response.output).toContain("[LINK_REGISTRATION]")
      expect(response.tokensUsed).toBe(0)
      expect(response.functionCalls).toHaveLength(0)

      // DB should NOT be queried (value was pre-loaded)
      expect(prismaMock.customers.findUnique).not.toHaveBeenCalled()
    })

    it("should block order tracking when DB returns isActive=false", async () => {
      // SCENARIO: customerIsRegistered not pre-loaded, agent fetches from DB
      // RULE: isActive=false → not registered → block

      const prismaMock = buildPrismaMock(false)
      const agent = new OrderTrackingAgentLLM(prismaMock)

      const response = await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        query: "mostrami i miei ordini",
      })

      expect(response.success).toBe(true)
      expect(response.output).toContain("[LINK_REGISTRATION]")
      expect(response.tokensUsed).toBe(0)
      expect(response.functionCalls).toHaveLength(0)
    })

    it("should block when customer is not found in DB", async () => {
      // SCENARIO: Customer ID not found in DB
      // RULE: Unknown = not registered → deny and give registration link

      const prismaMock = buildPrismaMock(null)
      const agent = new OrderTrackingAgentLLM(prismaMock)

      const response = await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: "ghost-customer",
        query: "storico ordini",
      })

      expect(response.success).toBe(true)
      expect(response.output).toContain("[LINK_REGISTRATION]")
    })

    it("should NOT query DB when customerIsRegistered is explicitly provided", async () => {
      // SCENARIO: Router pre-loads customerIsRegistered=false
      // RULE: Skip DB query, trust the pre-loaded value

      const prismaMock = buildPrismaMock(true)
      const agent = new OrderTrackingAgentLLM(prismaMock)

      await agent.handleQuery({
        workspaceId: WORKSPACE_ID,
        customerId: CUSTOMER_ID,
        query: "test",
        customerIsRegistered: false,
      })

      expect(prismaMock.customers.findUnique).not.toHaveBeenCalled()
    })
  })
})
