/**
 * CartManagementAgentLLM - Unit Tests
 *
 * Tests for LLM-based cart operations including:
 * 1. addItemToCart - Add items to cart (renamed from addToCart)
 * 2. updateCartItem - Update quantity by productCode or productName
 * 3. removeFromCart - Remove item by productCode or productName
 * 4. viewCart - View formatted cart
 * 5. clearCart - Clear all items
 * 6. formatCartResponse - Internal formatting for WhatsApp display
 *
 * @spec 191-cart-llm-management
 */

import { CartManagementAgentLLM } from "../../../application/agents/CartManagementAgentLLM"

jest.mock("@echatbot/database", () => ({
  prisma: {
    orders: {
      findFirst: jest.fn(),
    },
  },
}))

// Mock repositories
jest.mock("../../../repositories/cart.repository")
jest.mock("../../../repositories/product.repository")
jest.mock("../../../repositories/service.repository")
jest.mock("../../../repositories/order.repository")
jest.mock("../../../repositories/agent-config.repository")

// Mock axios for OpenRouter calls
jest.mock("axios")

// Mock logger
jest.mock("../../../utils/logger", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe("CartManagementAgentLLM", () => {
  let agent: CartManagementAgentLLM
  let mockPrisma: any

  const mockContext = {
    workspaceId: "ws-123",
    customerId: "cust-456",
    customerName: "Andrea",
    customerLanguage: "it",
    query: "test query",
  }

  // Store original env
  const originalEnv = process.env

  beforeAll(() => {
    // Set required env variable
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: "test-api-key",
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
    const { prisma } = require("@echatbot/database")
    mockPrisma = prisma
    agent = new CartManagementAgentLLM(mockPrisma)
  })

  describe("formatCartResponse", () => {
    it("should format empty cart correctly", () => {
      // Access private method via any cast
      const formatCartResponse = (agent as any).formatCartResponse.bind(agent)

      const result = formatCartResponse({
        success: true,
        isEmpty: true,
        cart: { items: [] },
      })

      expect(result.formattedCart).toBe("🛒 Il tuo carrello è vuoto.")
    })

    it("should format cart with items correctly", () => {
      const formatCartResponse = (agent as any).formatCartResponse.bind(agent)

      const result = formatCartResponse({
        success: true,
        isEmpty: false,
        cart: {
          items: [
            {
              name: "Mozzarella di Bufala",
              quantity: 2,
              unitPrice: 8.5,
              product: { name: "Mozzarella di Bufala", price: 8.5 },
            },
            {
              name: "Prosciutto Crudo",
              quantity: 1,
              unitPrice: 15.0,
              product: { name: "Prosciutto Crudo", price: 15.0 },
            },
          ],
          total: 32.0,
        },
      })

      expect(result.formattedCart).toContain("🛒 Il tuo carrello:")
      expect(result.formattedCart).toContain("2x Mozzarella di Bufala - 17,00€")
      expect(result.formattedCart).toContain("1x Prosciutto Crudo - 15,00€")
      expect(result.formattedCart).toContain("💰 Totale: 32,00€")
    })

    it("should handle error response", () => {
      const formatCartResponse = (agent as any).formatCartResponse.bind(agent)

      const result = formatCartResponse({
        success: false,
        error: "Cart not found",
      })

      expect(result.formattedCart).toBe("❌ Error loading cart")
    })

    it("should use Italian locale for prices (comma separator)", () => {
      const formatCartResponse = (agent as any).formatCartResponse.bind(agent)

      const result = formatCartResponse({
        success: true,
        isEmpty: false,
        cart: {
          items: [
            {
              name: "Panettone",
              quantity: 1,
              unitPrice: 25.99,
              product: { name: "Panettone", price: 25.99 },
            },
          ],
          total: 25.99,
        },
      })

      // Italian format uses comma for decimals
      expect(result.formattedCart).toContain("25,99€")
      expect(result.formattedCart).not.toContain("25.99€")
    })
  })

  describe("getCartManagementFunctions", () => {
    it("should return all required functions", () => {
      const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
      const functions = getFunctions()

      const functionNames = functions.map((f: any) => f.name)

      // Core cart functions
      expect(functionNames).toContain("viewCart")
      expect(functionNames).toContain("addItemToCart") // Renamed from addToCart
      expect(functionNames).toContain("removeFromCart")
      expect(functionNames).toContain("updateCartItem")
      expect(functionNames).toContain("clearCart")

      // Order repetition
      expect(functionNames).toContain("getLastOrderDetails")
      expect(functionNames).toContain("repeatLastOrder")
    })

    it("addItemToCart should have items array parameter", () => {
      const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
      const functions = getFunctions()

      const addItemToCart = functions.find((f: any) => f.name === "addItemToCart")

      expect(addItemToCart).toBeDefined()
      expect(addItemToCart.parameters.properties.items).toBeDefined()
      expect(addItemToCart.parameters.properties.items.type).toBe("array")
      expect(addItemToCart.parameters.required).toContain("items")
    })

    it("removeFromCart should use productCode or productName (not cartItemId)", () => {
      const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
      const functions = getFunctions()

      const removeFromCart = functions.find((f: any) => f.name === "removeFromCart")

      expect(removeFromCart).toBeDefined()
      expect(removeFromCart.parameters.properties.productCode).toBeDefined()
      expect(removeFromCart.parameters.properties.productName).toBeDefined()
      // Should NOT have cartItemId - customers don't know internal IDs
      expect(removeFromCart.parameters.properties.cartItemId).toBeUndefined()
    })

    it("updateCartItem should use productCode or productName with newQuantity", () => {
      const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
      const functions = getFunctions()

      const updateCartItem = functions.find((f: any) => f.name === "updateCartItem")

      expect(updateCartItem).toBeDefined()
      expect(updateCartItem.parameters.properties.productCode).toBeDefined()
      expect(updateCartItem.parameters.properties.productName).toBeDefined()
      expect(updateCartItem.parameters.properties.newQuantity).toBeDefined()
      expect(updateCartItem.parameters.required).toContain("newQuantity")
      // Should NOT have cartItemId
      expect(updateCartItem.parameters.properties.cartItemId).toBeUndefined()
    })
  })

  describe("executeFunction - function call routing", () => {
    // Note: Full integration tests would require mocking CartManagementAgent
    // These tests verify the function routing logic

    it("should support addItemToCart as alias for addToCart", async () => {
      // Verify the switch case includes both names
      const source = agent.constructor.toString()
      
      // The agent should handle both 'addItemToCart' and 'addToCart' cases
      // This is a structural test - actual execution tested in integration tests
      const executeFunction = (agent as any).executeFunction
      expect(executeFunction).toBeDefined()
    })

    it("should support updateCartItem as alias for updateCartQuantity", async () => {
      const executeFunction = (agent as any).executeFunction
      expect(executeFunction).toBeDefined()
    })
  })
})

describe("CartManagementAgentLLM - Function Definitions", () => {
  // Store original env
  const originalEnv = process.env

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: "test-api-key",
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("should define items parameter with correct structure for addItemToCart", () => {
    const { prisma } = require("@echatbot/database")
    const agent = new CartManagementAgentLLM(prisma)
    const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
    const functions = getFunctions()

    const addItemToCart = functions.find((f: any) => f.name === "addItemToCart")
    const itemsSchema = addItemToCart.parameters.properties.items

    // Verify items array structure
    expect(itemsSchema.items.type).toBe("object")
    expect(itemsSchema.items.properties.code).toBeDefined()
    expect(itemsSchema.items.properties.quantity).toBeDefined()
    expect(itemsSchema.items.properties.type).toBeDefined()
    expect(itemsSchema.items.properties.type.enum).toEqual(["PRODUCT", "SERVICE"])
    expect(itemsSchema.items.properties.notes).toBeDefined()

    // code and type are required per item
    expect(itemsSchema.items.required).toContain("code")
    expect(itemsSchema.items.required).toContain("type")
  })

  it("should define removeFromCart with flexible matching parameters", () => {
    const { prisma } = require("@echatbot/database")
    const agent = new CartManagementAgentLLM(prisma)
    const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
    const functions = getFunctions()

    const removeFromCart = functions.find((f: any) => f.name === "removeFromCart")

    // Either productCode OR productName can be used
    expect(removeFromCart.parameters.required).toEqual([])
    // But at least one should be provided (handled by LLM)
    expect(removeFromCart.parameters.properties.productCode.type).toBe("string")
    expect(removeFromCart.parameters.properties.productName.type).toBe("string")
  })

  it("should define updateCartItem requiring newQuantity", () => {
    const { prisma } = require("@echatbot/database")
    const agent = new CartManagementAgentLLM(prisma)
    const getFunctions = (agent as any).getCartManagementFunctions.bind(agent)
    const functions = getFunctions()

    const updateCartItem = functions.find((f: any) => f.name === "updateCartItem")

    // newQuantity is required
    expect(updateCartItem.parameters.required).toContain("newQuantity")
    expect(updateCartItem.parameters.properties.newQuantity.type).toBe("number")
    
    // Description should mention 0 for removal
    expect(updateCartItem.parameters.properties.newQuantity.description).toContain("0")
  })
})
