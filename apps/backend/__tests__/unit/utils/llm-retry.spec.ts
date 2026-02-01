/**
 * Unit tests for LLM retry utility
 * 
 * Tests the withRetry function for correct retry behavior.
 */

// Mock logger BEFORE importing the module under test
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Must mock as default export since logger uses `export default`
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: mockLogger,
}))

// Import AFTER mock is set up
import { withRetry, createRetryWrapper } from "../../../src/utils/llm-retry"

describe("withRetry", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("successful calls", () => {
    it("should return result on first success", async () => {
      const fn = jest.fn().mockResolvedValue("success")
      
      const result = await withRetry(fn, { maxRetries: 3 })
      
      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("retry behavior", () => {
    it("should retry on retryable error and succeed", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ response: { status: 429 } }) // Rate limit
        .mockResolvedValue("success")
      
      const result = await withRetry(fn, { 
        maxRetries: 3, 
        initialDelayMs: 10 // Fast for tests
      })
      
      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("should retry multiple times before success", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockResolvedValue("success")
      
      const result = await withRetry(fn, { 
        maxRetries: 3, 
        initialDelayMs: 10 
      })
      
      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it("should throw after max retries exhausted", async () => {
      const error = { response: { status: 500 }, message: "Server error" }
      const fn = jest.fn().mockRejectedValue(error)
      
      await expect(withRetry(fn, { 
        maxRetries: 2, 
        initialDelayMs: 10 
      })).rejects.toEqual(error)
      
      expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe("non-retryable errors", () => {
    it("should not retry on 400 Bad Request", async () => {
      const error = { response: { status: 400 }, message: "Bad request" }
      const fn = jest.fn().mockRejectedValue(error)
      
      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error)
      
      expect(fn).toHaveBeenCalledTimes(1) // No retries
    })

    it("should not retry on 401 Unauthorized", async () => {
      const error = { response: { status: 401 }, message: "Unauthorized" }
      const fn = jest.fn().mockRejectedValue(error)
      
      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error)
      
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should not retry on 404 Not Found", async () => {
      const error = { response: { status: 404 }, message: "Not found" }
      const fn = jest.fn().mockRejectedValue(error)
      
      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error)
      
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("retryable status codes", () => {
    it.each([429, 500, 502, 503, 504])(
      "should retry on status code %i",
      async (statusCode) => {
        const fn = jest.fn()
          .mockRejectedValueOnce({ response: { status: statusCode } })
          .mockResolvedValue("success")
        
        const result = await withRetry(fn, { 
          maxRetries: 1, 
          initialDelayMs: 10 
        })
        
        expect(result).toBe("success")
        expect(fn).toHaveBeenCalledTimes(2)
      }
    )
  })

  describe("network errors", () => {
    it("should retry on connection reset", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ code: "ECONNRESET" })
        .mockResolvedValue("success")
      
      const result = await withRetry(fn, { 
        maxRetries: 1, 
        initialDelayMs: 10 
      })
      
      expect(result).toBe("success")
    })

    it("should retry on timeout", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ code: "ETIMEDOUT" })
        .mockResolvedValue("success")
      
      const result = await withRetry(fn, { 
        maxRetries: 1, 
        initialDelayMs: 10 
      })
      
      expect(result).toBe("success")
    })
  })

  describe("custom isRetryable function", () => {
    it("should use custom retryable check", async () => {
      const customError = { customCode: "RETRY_ME" }
      const fn = jest.fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValue("success")
      
      const result = await withRetry(fn, {
        maxRetries: 1,
        initialDelayMs: 10,
        isRetryable: (err) => err.customCode === "RETRY_ME",
      })
      
      expect(result).toBe("success")
    })
  })
})

describe("createRetryWrapper", () => {
  it("should create a pre-configured retry wrapper", async () => {
    const wrapper = createRetryWrapper({ 
      maxRetries: 2, 
      initialDelayMs: 10,
      operationName: "TestOperation" 
    })
    
    const fn = jest.fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValue("success")
    
    const result = await wrapper(fn)
    
    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("should allow override options", async () => {
    const wrapper = createRetryWrapper({ maxRetries: 1, initialDelayMs: 10 })
    
    const fn = jest.fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValue("success")
    
    // Override to allow more retries
    const result = await wrapper(fn, { maxRetries: 2 })
    
    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
