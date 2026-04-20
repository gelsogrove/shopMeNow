/**
 * Unit tests for changeLanguage calling function
 *
 * WHAT: Verifies that language changes only happen on explicit user requests.
 * WHY: The LLM must NOT switch language just because it sees a foreign word,
 *      city name, or technical term in an otherwise unrelated message.
 *      explicitRequest=true is required or the function returns an error.
 *
 * @see apps/backend/src/domain/calling-functions/changeLanguage.ts
 */

// Mock logger FIRST
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({
  default: mockLogger,
  __esModule: true,
}))

// Mock Prisma
const mockCustomerFindFirst = jest.fn()
const mockCustomerUpdate = jest.fn()
const mockDisconnect = jest.fn()

jest.mock("@echatbot/database", () => ({
  prisma: {
    customers: {
      findFirst: mockCustomerFindFirst,
      update: mockCustomerUpdate,
    },
    $disconnect: mockDisconnect,
  },
}))

import { changeLanguage } from "../../../src/domain/calling-functions/changeLanguage"

const BASE_REQUEST = {
  workspaceId: "workspace-123",
  customerId: "customer-456",
  language: "en",
}

describe("changeLanguage › explicitRequest guard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should reject when explicitRequest is missing (undefined)", async () => {
    // SCENARIO: LLM calls changeLanguage because it saw an English word in a Spanish sentence
    // RULE: explicitRequest must be explicitly true — missing = rejected, no DB write
    const result = await changeLanguage({ ...BASE_REQUEST })

    expect(result.success).toBe(false)
    expect(result.error).toBe("NOT_EXPLICIT_REQUEST")
    expect(mockCustomerFindFirst).not.toHaveBeenCalled()
    expect(mockCustomerUpdate).not.toHaveBeenCalled()
  })

  it("should reject when explicitRequest is false", async () => {
    // SCENARIO: LLM sets explicitRequest=false (or code path that infers it's not explicit)
    // RULE: false is not acceptable — must be true
    const result = await changeLanguage({ ...BASE_REQUEST, explicitRequest: false })

    expect(result.success).toBe(false)
    expect(result.error).toBe("NOT_EXPLICIT_REQUEST")
    expect(mockCustomerUpdate).not.toHaveBeenCalled()
  })

  it("should proceed when explicitRequest is true", async () => {
    // SCENARIO: User writes "Can we speak in English?" — clear explicit request
    // RULE: explicitRequest=true → proceed with DB update
    mockCustomerFindFirst.mockResolvedValue({ id: "customer-456", language: "es" })
    mockCustomerUpdate.mockResolvedValue({ id: "customer-456", language: "en" })

    const result = await changeLanguage({ ...BASE_REQUEST, explicitRequest: true })

    expect(result.success).toBe(true)
    expect(result.newLanguage).toBe("en")
    expect(result.previousLanguage).toBe("es")
    expect(mockCustomerUpdate).toHaveBeenCalledWith({
      where: { id: "customer-456" },
      data: { language: "en" },
    })
  })
})

describe("changeLanguage › parameter validation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should reject when required params are missing", async () => {
    // RULE: workspaceId, customerId, language are all required
    const result = await changeLanguage({ workspaceId: "", customerId: "", language: "" })

    expect(result.success).toBe(false)
    expect(result.error).toBe("workspaceId, customerId, and language are required")
  })

  it("should reject unsupported language codes", async () => {
    // SCENARIO: LLM hallucinates a language code like "de" or "fr"
    // RULE: Only it/en/es/pt are supported
    const result = await changeLanguage({ ...BASE_REQUEST, language: "de", explicitRequest: true })

    expect(result.success).toBe(false)
    expect(result.error).toBe("UNSUPPORTED_LANGUAGE")
  })

  it("should return success without DB write when language is already set", async () => {
    // SCENARIO: Customer already speaks English, asks to speak English again
    // RULE: No-op — same language → success without update
    mockCustomerFindFirst.mockResolvedValue({ id: "customer-456", language: "en" })

    const result = await changeLanguage({ ...BASE_REQUEST, explicitRequest: true })

    expect(result.success).toBe(true)
    expect(mockCustomerUpdate).not.toHaveBeenCalled()
  })

  it("should return error when customer not found", async () => {
    // RULE: Workspace isolation — customer must belong to workspaceId
    mockCustomerFindFirst.mockResolvedValue(null)

    const result = await changeLanguage({ ...BASE_REQUEST, explicitRequest: true })

    expect(result.success).toBe(false)
    expect(result.error).toBe("CUSTOMER_NOT_FOUND")
  })
})
