/**
 * 🧪 Calling Functions - Separated Integration Tests
 *
 * Each test is in its own describe block so you can run them individually:
 *
 * npm run test:integration -- --testNamePattern="CF: searchProduct"
 * npm run test:integration -- --testNamePattern="CF: repeatOrder"
 * npm run test:integration -- --testNamePattern="CF: addProduct"
 * etc.
 *
 * This saves money by only calling the LLM for the specific test you want to run!
 */

// USE REQUIRE INSTEAD OF IMPORT TO AVOID TS-JEST ISSUES
const { PrismaClient } = require("@prisma/client")
const { LLMService } = require("../../services/llm.service")

console.log("🚀 MODULE LOAD: PrismaClient =", typeof PrismaClient)
console.log("🚀 MODULE LOAD: LLMService =", typeof LLMService)

// Initialize services - DO NOT INIT HERE, INIT IN BEFOREALL
let prisma: any
let llmService: any

// Shared config
const TEST_CONFIG = {
  workspaceId: "",
  customerPhone: "+34666777888",
  customerId: "",
  model: "openai/gpt-4o-mini",
  language: "it",
  sessionId: "test-session",
  maxTokens: 5000,
}

// Helper to call LLM

// Setup function
async function setupTest() {
  console.log("🔍 Prisma type:", typeof prisma)
  console.log("🔍 Prisma keys:", Object.keys(prisma || {}).slice(0, 50))
  console.log("🔍 Has workspace?:", "workspace" in prisma)
  console.log("🔍 workspace type:", typeof (prisma as any).workspace)
  console.log("🔍 workspace value:", (prisma as any).workspace)

  const workspace = await prisma.workspace.findFirst()
  if (!workspace) throw new Error("No workspace! Run: npm run seed")
  TEST_CONFIG.workspaceId = workspace.id

  const customer = await prisma.customers.findFirst({
    where: {
      phone: TEST_CONFIG.customerPhone,
      workspaceId: TEST_CONFIG.workspaceId,
    },
  })
  if (!customer)
    throw new Error(
      `Customer ${TEST_CONFIG.customerPhone} not found! Run: npm run seed`
    )

  if (!customer.activeChatbot || customer.isBlacklisted) {
    await prisma.customers.update({
      where: { id: customer.id },
      data: { activeChatbot: true, isBlacklisted: false },
    })
  }

  TEST_CONFIG.customerId = customer.id
}

// Helper to call LLM
async function callLLM(userQuery: string) {
  const result = await llmService.handleMessage({
    chatInput: userQuery,
    phone: TEST_CONFIG.customerPhone,
    workspaceId: TEST_CONFIG.workspaceId,
    customerid: TEST_CONFIG.customerId,
    language: TEST_CONFIG.language,
    sessionId: TEST_CONFIG.sessionId,
    maxTokens: TEST_CONFIG.maxTokens,
    model: TEST_CONFIG.model,
    messages: [],
    prompt: "",
  })

  let functionCalled = null
  let functionArgs = null

  if (result.debugInfo) {
    const debugData =
      typeof result.debugInfo === "string"
        ? JSON.parse(result.debugInfo)
        : result.debugInfo

    if (debugData.functionCalls && Array.isArray(debugData.functionCalls)) {
      const firstCall = debugData.functionCalls[0]
      if (firstCall) {
        functionCalled = firstCall.name || null
        functionArgs = firstCall.arguments || null
      }
    }
  }

  return {
    response: result.output || result.response || "",
    functionCalled,
    functionArgs,
    success: result.success,
  }
}

// ============================================================================
// MAIN WRAPPER - All tests share same setup
// ============================================================================
describe("🧪 Calling Functions - All Tests", () => {
  // Global setup/teardown
  beforeAll(async () => {
    // Initialize Prisma and LLM service HERE
    prisma = new PrismaClient()
    llmService = new LLMService()

    console.log("✅ Prisma initialized:", typeof prisma)
    console.log("✅ Has workspace?:", "workspace" in prisma)

    // Setup customer
    const workspace = await prisma.workspace.findFirst()
    if (!workspace) throw new Error("No workspace! Run: npm run seed")
    TEST_CONFIG.workspaceId = workspace.id

    const customer = await prisma.customers.findFirst({
      where: {
        phone: TEST_CONFIG.customerPhone,
        workspaceId: TEST_CONFIG.workspaceId,
      },
    })
    if (!customer)
      throw new Error(
        `Customer ${TEST_CONFIG.customerPhone} not found! Run: npm run seed`
      )

    if (!customer.activeChatbot || customer.isBlacklisted) {
      await prisma.customers.update({
        where: { id: customer.id },
        data: { activeChatbot: true, isBlacklisted: false },
      })
    }

    TEST_CONFIG.customerId = customer.id
    console.log("✅ Test setup complete!")
  }, 10000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ============================================================================
  // 🔍 TEST: searchProduct
  // ============================================================================
  describe("🔍 CF: searchProduct", () => {
    it("should call searchProduct for 'avete la mozzarella di bufala?'", async () => {
      const result = await callLLM("avete la mozzarella di bufala?")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
      })

      expect(result.functionCalled).toBe("searchProduct")
      expect(result.success).toBe(true)
    }, 30000)
  })

  // ============================================================================
  // 🔄 TEST: repeatOrder
  // ============================================================================
  describe("🔄 CF: repeatOrder", () => {
    it("should call repeatOrder (or ask confirmation)", async () => {
      const result = await callLLM("voglio rifare l'ultimo ordine")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
      })

      const calledRepeatOrder = result.functionCalled === "repeatOrder"
      const asksConfirmation =
        result.response.toLowerCase().includes("conferma") ||
        result.response.toLowerCase().includes("sicuro") ||
        result.response.toLowerCase().includes("vuoi")

      expect(calledRepeatOrder || asksConfirmation).toBe(true)
    }, 30000)
  })

  // ============================================================================
  // 🛒 TEST: addProduct
  // ============================================================================
  describe("🛒 CF: addProduct", () => {
    it("should ask confirmation before adding product", async () => {
      const result = await callLLM(
        "voglio aggiungere il panettone nel carrello"
      )

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
      })

      const asksConfirmation =
        result.response.toLowerCase().includes("quant") ||
        result.response.toLowerCase().includes("conferma") ||
        result.response.toLowerCase().includes("sicuro")

      expect(result.functionCalled).not.toBe("addProduct")
      expect(asksConfirmation).toBe(true)
    }, 30000)
  })

  // ============================================================================
  // ❓ TEST: who-are-you (No Function)
  // ============================================================================
  describe("❓ CF: who-are-you", () => {
    it("should NOT call any function for 'chi sei?'", async () => {
      const result = await callLLM("chi sei?")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
      })

      expect(result.functionCalled).toBeNull()
      expect(result.success).toBe(true)
      expect(result.response.length).toBeGreaterThan(0)
    }, 30000)
  })

  // ============================================================================
  // 📞 TEST: ContactOperator
  // ============================================================================
  describe("📞 CF: ContactOperator", () => {
    it("should call ContactOperator for 'voglio parlare con un operatore'", async () => {
      const result = await callLLM("voglio parlare con un operatore")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
      })

      expect(result.functionCalled).toBe("ContactOperator")
      expect(result.success).toBe(true)
    }, 30000)
  })

  // ============================================================================
  // 🔗 TEST: GetLinkOrderByCode
  // ============================================================================
  describe("🔗 CF: GetLinkOrderByCode", () => {
    it("should return order link for 'dammi ultimo ordine'", async () => {
      const result = await callLLM("dammi ultimo ordine")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        hasLink: result.response.includes("http"),
      })

      const hasLink =
        result.response.includes("http://") ||
        result.response.includes("https://")

      expect(hasLink).toBe(true)
    }, 30000)
  })

  // ============================================================================
  // ⚠️ TEST: Ambiguity (Priority)
  // ============================================================================
  describe("⚠️ CF: Ambiguity", () => {
    it("should prioritize ContactOperator (PRIORITY 1) over other functions", async () => {
      const result = await callLLM("sono stufo, dammi ultimo ordine")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
      })

      // "sono stufo" → ContactOperator PRIORITY 1
      // "dammi ultimo ordine" → GetLinkOrderByCode PRIORITY 2
      // PRIORITY 1 should WIN
      expect(result.functionCalled).toBe("ContactOperator")
    }, 30000)
  })

  // ============================================================================
  // 🛒 TEST: Token Carrello
  // ============================================================================
  describe("🛒 CF: Token Carrello", () => {
    it("should return [LINK_CHECKOUT_WITH_TOKEN] for 'mostra carrello'", async () => {
      const result = await callLLM("mostra carrello")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        hasToken: result.response.includes("[LINK_CHECKOUT_WITH_TOKEN]"),
      })

      expect(result.response).toContain("[LINK_CHECKOUT_WITH_TOKEN]")
      expect(result.functionCalled).toBeNull()
    }, 30000)
  })

  // ============================================================================
  // 🔗 TEST: Token Lista Ordini
  // ============================================================================
  describe("🔗 CF: Token Lista Ordini", () => {
    it("should return [LINK_ORDERS_WITH_TOKEN] for 'dammi la lista degli ordini'", async () => {
      const result = await callLLM("dammi la lista degli ordini")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        hasToken: result.response.includes("[LINK_ORDERS_WITH_TOKEN]"),
      })

      expect(result.response).toContain("[LINK_ORDERS_WITH_TOKEN]")
      expect(result.functionCalled).toBeNull()
    }, 30000)
  })

  // ============================================================================
  // 👤 TEST: Token Indirizzo
  // ============================================================================
  describe("👤 CF: Token Indirizzo", () => {
    it("should return [LINK_PROFILE_WITH_TOKEN] for 'voglio cambiare indirizzo'", async () => {
      const result = await callLLM("voglio cambiare indirizzo di spedizione")

      console.log("📊 Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        hasToken: result.response.includes("[LINK_PROFILE_WITH_TOKEN]"),
      })

      expect(result.response).toContain("[LINK_PROFILE_WITH_TOKEN]")
      expect(result.functionCalled).toBeNull()
    }, 30000)
  })
}) // End of main wrapper
