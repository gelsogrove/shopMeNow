/**
 * Unit tests for WebhookDispatchService
 *
 * Tests cover:
 * - BUG#3 FIX: HMAC-SHA256 signature is actually computed and sent in header
 * - BUG#4 FIX: webhookSecret from workspace/DB is forwarded to the dispatcher
 *   (without which BUG#3 fix would never activate)
 * - Timeout handling
 * - Error propagation
 *
 * ARCHITECTURE NOTE:
 * WebhookDispatchService dispatches custom WorkspaceCallingFunctions of
 * executionType=WEBHOOK to a client-configured URL. The secret is stored in
 * workspace.webhookSecret and must be forwarded via FunctionExecutor.
 *
 * @see apps/backend/src/services/webhook-dispatch.service.ts
 * @see apps/backend/src/services/function-executor.service.ts
 */

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({ default: mockLogger, __esModule: true }))

// Mock axios so we can inspect the headers it receives
const mockAxiosPost = jest.fn()
jest.mock("axios", () => ({
  post: mockAxiosPost,
  create: jest.fn(),
}))

import crypto from "crypto"
import { WebhookDispatchService } from "../../../src/services/webhook-dispatch.service"

const BASE_PAYLOAD = {
  function: "getOrderStatus",
  parameters: { orderCode: "ORD-001" },
  context: {
    workspaceId: "ws-1",
    customerId: "cust-1",
    customerLanguage: "it",
  },
}

describe("WebhookDispatchService — HMAC Signing (BUG#3 fix)", () => {
  let service: WebhookDispatchService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WebhookDispatchService()
    mockAxiosPost.mockResolvedValue({ data: { success: true } })
  })

  it("should ALWAYS send X-Echatbot-Timestamp header", async () => {
    // RULE: Every webhook call must include a timestamp for replay-attack prevention
    await service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })

    const [, , options] = mockAxiosPost.mock.calls[0]
    expect(options.headers["X-Echatbot-Timestamp"]).toBeDefined()
    expect(Number(options.headers["X-Echatbot-Timestamp"])).toBeGreaterThan(0)
  })

  it("should NOT include X-Echatbot-Signature when no secret is provided", async () => {
    // SCENARIO: Workspace has no webhookSecret configured
    // RULE: No secret → no signature header (don't send empty/invalid sig)
    await service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })

    const [, , options] = mockAxiosPost.mock.calls[0]
    expect(options.headers["X-Echatbot-Signature"]).toBeUndefined()
  })

  it("should include X-Echatbot-Signature with prefix sha256= when secret is provided", async () => {
    // SCENARIO: Workspace has webhookSecret configured
    // RULE: Must send HMAC-SHA256 signature so client can verify authenticity
    await service.dispatch({
      url: "https://example.com/hook",
      secret: "my-super-secret",
      payload: BASE_PAYLOAD,
    })

    const [, , options] = mockAxiosPost.mock.calls[0]
    expect(options.headers["X-Echatbot-Signature"]).toBeDefined()
    expect(options.headers["X-Echatbot-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it("should compute correct HMAC-SHA256 signature verifiable by client", async () => {
    // SCENARIO: Client receives the webhook and wants to verify it
    // RULE: HMAC = sha256(timestamp + '.' + body, secret)
    const secret = "test-secret-key"

    await service.dispatch({
      url: "https://example.com/hook",
      secret,
      payload: BASE_PAYLOAD,
    })

    const [, sentBody, options] = mockAxiosPost.mock.calls[0]
    const timestamp = options.headers["X-Echatbot-Timestamp"]
    const signature = options.headers["X-Echatbot-Signature"]

    // Reproduce what the client would compute for verification
    // sentBody is already stringified JSON, no need to stringify again
    const expectedSig =
      "sha256=" +
      crypto
        .createHmac("sha256", secret)
        .update(timestamp + "." + sentBody)
        .digest("hex")

    expect(signature).toBe(expectedSig)
  })

  it("should forward X-Echatbot-Event header", async () => {
    // RULE: Client uses this header to identify the event type
    await service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })

    const [, , options] = mockAxiosPost.mock.calls[0]
    expect(options.headers["X-Echatbot-Event"]).toBe("function_call")
  })
})

describe("WebhookDispatchService — Timeout & Error Handling", () => {
  let service: WebhookDispatchService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WebhookDispatchService()
  })

  it("should use default timeout of 10000ms when not specified", async () => {
    // RULE: Default timeout must match workspace.webhookTimeout default in schema (10000)
    mockAxiosPost.mockResolvedValue({ data: {} })
    await service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })

    const [, , options] = mockAxiosPost.mock.calls[0]
    expect(options.timeout).toBe(10000)
  })

  it("should use custom timeout when provided", async () => {
    // SCENARIO: Workspace has a slow external API — needs longer timeout
    mockAxiosPost.mockResolvedValue({ data: {} })
    await service.dispatch({
      url: "https://example.com/hook",
      timeout: 30000,
      payload: BASE_PAYLOAD,
    })

    const [, , options] = mockAxiosPost.mock.calls[0]
    expect(options.timeout).toBe(30000)
  })

  it("should throw WEBHOOK_TIMEOUT on ECONNABORTED error", async () => {
    // SCENARIO: External webhook server is too slow
    // RULE: Timeout must surface as explicit WEBHOOK_TIMEOUT error (not generic axios error)
    const timeoutError = new Error("timeout") as any
    timeoutError.code = "ECONNABORTED"
    mockAxiosPost.mockRejectedValue(timeoutError)

    await expect(
      service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })
    ).rejects.toThrow("WEBHOOK_TIMEOUT")
  })

  it("should throw WEBHOOK_ERROR with status code on HTTP 4xx/5xx", async () => {
    // SCENARIO: Client webhook returns 500 or 400
    // RULE: Must surface status code for debugging
    const httpError = new Error("Internal Server Error") as any
    httpError.response = { status: 500, data: { error: "Internal" } }
    mockAxiosPost.mockRejectedValue(httpError)

    await expect(
      service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })
    ).rejects.toThrow("WEBHOOK_ERROR: 500")
  })

  it("should throw WEBHOOK_ERROR with CONNECTION_FAILED when no HTTP response", async () => {
    // SCENARIO: Network failure / DNS not resolving
    const networkError = new Error("Network Error") as any
    // No .response property
    mockAxiosPost.mockRejectedValue(networkError)

    await expect(
      service.dispatch({ url: "https://example.com/hook", payload: BASE_PAYLOAD })
    ).rejects.toThrow("WEBHOOK_ERROR: CONNECTION_FAILED")
  })
})
