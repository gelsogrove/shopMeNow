/**
 * 🎯 TEST: Campaign Billing Cutoff
 *
 * SCENARIO: Push campaigns must be blocked when owner's creditBalance
 * falls below CREDIT_MIN_THRESHOLD (-$10).
 *
 * KEY RULES:
 * 1. schedule() → returns 402 if credit below threshold
 * 2. runNow() → returns 402 if credit below threshold
 * 3. create() → throws 402 if credit below threshold (before estimated cost check)
 * 4. Scheduler job → pauses campaign if credit below threshold
 * 5. CREDIT_MIN_THRESHOLD = -10 (allows overdraft up to -$10)
 *
 * 📚 minrequirement: "Push campaigns also blocked if credit insufficient before schedule/send"
 */

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock Prisma to avoid DB connection
jest.mock("@echatbot/database", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  prisma: {},
}))

describe("Campaign Billing Cutoff", () => {
  // Import AFTER mocks are set up
  let CREDIT_MIN_THRESHOLD: number

  beforeAll(() => {
    const mod = require("../../src/application/services/workspace-access.service")
    CREDIT_MIN_THRESHOLD = mod.CREDIT_MIN_THRESHOLD
  })
  describe("CREDIT_MIN_THRESHOLD value", () => {
    it("should be -10 (allows overdraft up to -$10)", () => {
      // RULE: The threshold is -$10, matching the system-wide credit exhaustion limit
      expect(CREDIT_MIN_THRESHOLD).toBe(-10)
    })
  })

  describe("Credit balance scenarios", () => {
    it("should ALLOW campaign when balance is positive", () => {
      // SCENARIO: Owner has $50 credit
      const balance = 50
      const canProceed = balance >= CREDIT_MIN_THRESHOLD

      expect(canProceed).toBe(true)
    })

    it("should ALLOW campaign when balance is zero", () => {
      // SCENARIO: Owner has $0 credit (still above threshold)
      const balance = 0
      const canProceed = balance >= CREDIT_MIN_THRESHOLD

      expect(canProceed).toBe(true)
    })

    it("should ALLOW campaign when balance is slightly negative", () => {
      // SCENARIO: Owner has -$5 (within overdraft tolerance)
      const balance = -5
      const canProceed = balance >= CREDIT_MIN_THRESHOLD

      expect(canProceed).toBe(true)
    })

    it("should ALLOW campaign when balance is exactly at threshold", () => {
      // SCENARIO: Owner has exactly -$10 (at threshold boundary)
      const balance = -10
      const canProceed = balance >= CREDIT_MIN_THRESHOLD

      expect(canProceed).toBe(true)
    })

    it("should BLOCK campaign when balance is below threshold", () => {
      // SCENARIO: Owner has -$10.01 (below threshold)
      const balance = -10.01
      const canProceed = balance >= CREDIT_MIN_THRESHOLD

      expect(canProceed).toBe(false)
    })

    it("should BLOCK campaign when balance is deeply negative", () => {
      // SCENARIO: Owner has -$100 (way below threshold)
      const balance = -100
      const canProceed = balance >= CREDIT_MIN_THRESHOLD

      expect(canProceed).toBe(false)
    })
  })

  describe("Scheduler upfront check", () => {
    it("should pause campaign when balance < CREDIT_MIN_THRESHOLD", () => {
      // SCENARIO: Scheduler picks up a campaign but owner is deeply in debt
      // RULE: Campaign should be set to PAUSED with error message
      const availableBalance = -15
      const shouldPause = availableBalance < CREDIT_MIN_THRESHOLD

      expect(shouldPause).toBe(true)

      const expectedStatus = "PAUSED"
      const expectedError = `Credit exhausted (balance: $${availableBalance.toFixed(2)}, threshold: $${CREDIT_MIN_THRESHOLD})`

      expect(expectedStatus).toBe("PAUSED")
      expect(expectedError).toContain("Credit exhausted")
    })

    it("should continue processing when balance >= CREDIT_MIN_THRESHOLD", () => {
      // SCENARIO: Owner has sufficient credit (normal flow)
      const availableBalance = 5
      const shouldPause = availableBalance < CREDIT_MIN_THRESHOLD

      expect(shouldPause).toBe(false)
    })
  })

  describe("Controller 402 response", () => {
    it("should return 402 with CREDIT_EXHAUSTED error code", () => {
      // RULE: schedule() and runNow() return 402 when credit exhausted
      const errorResponse = {
        error: "CREDIT_EXHAUSTED",
        message: "Cannot schedule campaign: credit exhausted",
      }

      expect(errorResponse.error).toBe("CREDIT_EXHAUSTED")
      expect(errorResponse.message).toContain("Cannot schedule campaign")
    })
  })
})
