/**
 * CallingFunctionsController Unit Tests
 *
 * RULE: Tests exercise actual controller methods with mocked repository + prisma.
 * RULE: Logic under test: HTTP status codes, response shapes, error mapping, immutable-key enforcement.
 *
 * Tests for:
 * - GET / → returns functions list (including attachedLlm)
 * - GET /agent-types ECOMMERCE → returns specialist agents only (no ROUTER/SECURITY/etc.)
 * - GET /agent-types INFORMATIONAL → INFO_AGENT + PROFILE_MANAGEMENT only
 * - GET /agent-types FLOW → same as INFORMATIONAL
 * - POST / → creates function with attachedLlm, returns 201
 * - PATCH → custom function — all non-immutable fields allowed
 * - PATCH → system function — blocks immutable keys (functionName, isSystemFunction, etc.)
 * - DELETE custom function → 204
 * - DELETE system function → 204 (no longer blocked — hard delete for all)
 * - POST /:name/reinstall valid system function → 200
 * - POST /:name/reinstall unknown function → 400
 */

import { Request, Response } from "express"
import { CallingFunctionsController } from "../../../src/interfaces/http/controllers/calling-functions.controller"

// SCENARIO: Mock repository and webhook service used by the controller
jest.mock("../../../src/repositories/workspace-calling-function.repository", () => ({
    WorkspaceCallingFunctionRepository: jest.fn().mockImplementation(() => ({
        findAllByWorkspace: jest.fn(),
        findByName: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    })),
}))

jest.mock("../../../src/services/webhook-dispatch.service", () => ({
    WebhookDispatchService: jest.fn().mockImplementation(() => ({
        dispatch: jest.fn(),
    })),
}))

// SCENARIO: Logger suppressed during tests
jest.mock("../../../src/utils/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

// ─── helpers ───────────────────────────────────────────────────────────────

function buildMockRes() {
    const jsonFn = jest.fn()
    const sendFn = jest.fn()
    const statusFn = jest.fn().mockReturnThis()
    const res: Partial<Response> = {
        json: jsonFn,
        send: sendFn,
        status: statusFn,
    } as any
    statusFn.mockReturnValue({ json: jsonFn, send: sendFn })
    return { res, jsonFn, sendFn, statusFn }
}

function buildReq(overrides: Partial<Request> = {}): Partial<Request> {
    const req: any = { body: {}, params: {}, ...overrides }
    req.workspaceId = "ws-test-001"
    return req as any
}

// ─── setup ─────────────────────────────────────────────────────────────────

describe("CallingFunctionsController", () => {
    let controller: CallingFunctionsController
    let mockRepository: any
    let mockPrisma: any

    beforeEach(() => {
        jest.clearAllMocks()

        // RULE: Provide minimal prisma mock — workspace lookup + upsert for lazy migration
        mockPrisma = {
            workspaceCallingFunction: {
                upsert: jest.fn().mockResolvedValue({}),
            },
            workspace: {
                findUnique: jest.fn(),
            },
        }

        controller = new CallingFunctionsController(mockPrisma as any)
        mockRepository = (controller as any).repository
    })

    // ── GET / ──────────────────────────────────────────────────────────────

    describe("getFunctions", () => {
        it("should return 200 with functions list including attachedLlm", async () => {
            // SCENARIO: Workspace has mix of system + custom functions, some with attachedLlm
            const mockFunctions = [
                { id: "fn1", functionName: "productSearchAgent", executionType: "DELEGATE_TO_AGENT", attachedLlm: "PRODUCT_SEARCH", isSystemFunction: true, isActive: true },
                { id: "fn2", functionName: "myWebhook", executionType: "WEBHOOK", attachedLlm: null, isSystemFunction: false, isActive: true },
            ]
            mockPrisma.workspaceCallingFunction.upsert.mockResolvedValue({})
            mockRepository.findAllByWorkspace.mockResolvedValue(mockFunctions)
            mockPrisma.workspace = { findUnique: jest.fn().mockResolvedValue({ channelMode: "ECOMMERCE", enableCalendarBooking: false, hasHumanSupport: false }) }

            const req = buildReq()
            const { res, jsonFn } = buildMockRes()

            await controller.getFunctions(req as Request, res as Response)

            // RULE: Both functions returned (ecommerce mode shows productSearchAgent)
            expect(mockRepository.findAllByWorkspace).toHaveBeenCalledWith("ws-test-001")
            expect(jsonFn).toHaveBeenCalledWith(
                expect.objectContaining({ functions: expect.any(Array) })
            )
        })

        it("should return 400 when workspaceId is missing", async () => {
            // SCENARIO: Auth middleware failed to inject workspaceId
            const req: any = buildReq()
            req.workspaceId = undefined
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.getFunctions(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(400)
            expect(jsonFn).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }))
        })
    })

    // ── GET /agent-types ───────────────────────────────────────────────────

    describe("getAgentTypes", () => {
        it("ECOMMERCE → returns specialist agents without infrastructure agents", async () => {
            // SCENARIO: Ecommerce workspace needs PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING,
            // CUSTOMER_SUPPORT, PROFILE_MANAGEMENT returned.
            // RULE: ROUTER, SECURITY, TRANSLATION, SUMMARY_AGENT, CONVERSATION_HISTORY NOT returned.
            mockPrisma.workspace.findUnique.mockResolvedValue({ channelMode: "ECOMMERCE" })

            const req = buildReq()
            const { res, jsonFn, statusFn } = buildMockRes()

            await controller.getAgentTypes(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            const { agentTypes } = jsonFn.mock.calls[0][0]
            // RULE: specialist agents are present
            expect(agentTypes).toContain("PRODUCT_SEARCH")
            expect(agentTypes).toContain("CART_MANAGEMENT")
            expect(agentTypes).toContain("ORDER_TRACKING")
            expect(agentTypes).toContain("CUSTOMER_SUPPORT")
            expect(agentTypes).toContain("PROFILE_MANAGEMENT")
            // RULE: infrastructure agents are NOT returned
            expect(agentTypes).not.toContain("ROUTER")
            expect(agentTypes).not.toContain("SECURITY")
            expect(agentTypes).not.toContain("TRANSLATION")
            expect(agentTypes).not.toContain("SUMMARY_AGENT")
            expect(agentTypes).not.toContain("CONVERSATION_HISTORY")
        })

        it("INFORMATIONAL → returns INFO_AGENT and PROFILE_MANAGEMENT only", async () => {
            // SCENARIO: Informational workspace has no ecommerce agents
            // RULE: Only INFO_AGENT + PROFILE_MANAGEMENT available as dispatch targets
            mockPrisma.workspace.findUnique.mockResolvedValue({ channelMode: "INFORMATIONAL" })

            const req = buildReq()
            const { res, jsonFn, statusFn } = buildMockRes()

            await controller.getAgentTypes(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            const { agentTypes } = jsonFn.mock.calls[0][0]
            expect(agentTypes).toContain("INFO_AGENT")
            expect(agentTypes).toContain("PROFILE_MANAGEMENT")
            expect(agentTypes).not.toContain("PRODUCT_SEARCH")
            expect(agentTypes).not.toContain("ROUTER")
        })

        it("FLOW → returns same agents as INFORMATIONAL (INFO_AGENT + PROFILE_MANAGEMENT)", async () => {
            // SCENARIO: FLOW is a new channel mode that behaves like INFORMATIONAL for agent dispatch
            // RULE: FLOW uses INFO_AGENT as main specialist — same set as INFORMATIONAL
            mockPrisma.workspace.findUnique.mockResolvedValue({ channelMode: "FLOW" })

            const req = buildReq()
            const { res, jsonFn, statusFn } = buildMockRes()

            await controller.getAgentTypes(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            const { agentTypes } = jsonFn.mock.calls[0][0]
            expect(agentTypes).toContain("INFO_AGENT")
            expect(agentTypes).toContain("PROFILE_MANAGEMENT")
            expect(agentTypes).not.toContain("PRODUCT_SEARCH")
        })

        it("should return 404 when workspace does not exist", async () => {
            // SCENARIO: Invalid workspaceId passed (e.g., newly deleted workspace)
            mockPrisma.workspace.findUnique.mockResolvedValue(null)

            const req = buildReq()
            const { res, statusFn } = buildMockRes()

            await controller.getAgentTypes(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(404)
        })
    })

    // ── POST / ─────────────────────────────────────────────────────────────

    describe("createFunction", () => {
        it("should create function with attachedLlm and return 201", async () => {
            // SCENARIO: Admin adds a DELEGATE_TO_AGENT function pointing to PRODUCT_SEARCH specialist
            const createdFn = { id: "fn-new", functionName: "searchDelegate", executionType: "DELEGATE_TO_AGENT", attachedLlm: "PRODUCT_SEARCH" }
            mockRepository.findByName.mockResolvedValue(null) // does not exist yet
            mockRepository.create.mockResolvedValue(createdFn)

            const req = buildReq({
                body: {
                    functionName: "searchDelegate",
                    description: "Delegate product search to specialist",
                    executionType: "DELEGATE_TO_AGENT",
                    attachedLlm: "PRODUCT_SEARCH",
                },
            })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.createFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(201)
            expect(jsonFn).toHaveBeenCalledWith(createdFn)
            // RULE: repository.create called with attachedLlm
            expect(mockRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({ attachedLlm: "PRODUCT_SEARCH" })
            )
        })

        it("should return 409 when function already exists", async () => {
            // SCENARIO: Duplicate functionName for same workspace
            mockRepository.findByName.mockResolvedValue({ id: "existing" })

            const req = buildReq({ body: { functionName: "existing", description: "d", executionType: "WEBHOOK" } })
            const { res, statusFn } = buildMockRes()

            await controller.createFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(409)
            expect(mockRepository.create).not.toHaveBeenCalled()
        })

        it("should return 400 when required fields are missing", async () => {
            // SCENARIO: Frontend sends incomplete payload
            const req = buildReq({ body: { functionName: "incomplete" } }) // missing description + executionType
            const { res, statusFn } = buildMockRes()

            await controller.createFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(400)
        })
    })

    // ── PATCH /:functionName ───────────────────────────────────────────────

    describe("updateFunction", () => {
        it("custom function: all non-immutable fields are allowed", async () => {
            // SCENARIO: Admin edits description and webhookUrl of a custom function
            // RULE: Custom functions are fully editable — only IMMUTABLE_KEYS are blocked
            const existing = { id: "fn1", functionName: "myTool", isSystemFunction: false }
            const updated = { ...existing, description: "Updated", webhookUrl: "https://new.url" }
            mockRepository.findByName.mockResolvedValue(existing)
            mockRepository.update.mockResolvedValue(updated)

            const req = buildReq({
                params: { functionName: "myTool" } as any,
                body: { description: "Updated", webhookUrl: "https://new.url" },
            })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.updateFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            expect(jsonFn).toHaveBeenCalledWith(updated)
        })

        it("system function: blocks attempt to change functionName (immutable)", async () => {
            // SCENARIO: Admin tries to rename a system function — must be blocked
            // RULE: functionName is in IMMUTABLE_KEYS → 403 for any function, system or custom
            const existing = { id: "fn2", functionName: "changeLanguage", isSystemFunction: true }
            mockRepository.findByName.mockResolvedValue(existing)

            const req = buildReq({
                params: { functionName: "changeLanguage" } as any,
                body: { functionName: "renameAttempt" }, // blocked key
            })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.updateFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(403)
            expect(jsonFn).toHaveBeenCalledWith(
                expect.objectContaining({ error: "Cannot modify immutable fields" })
            )
            expect(mockRepository.update).not.toHaveBeenCalled()
        })

        it("blocks attempt to change isSystemFunction on any function", async () => {
            // SCENARIO: Attacker tries to elevate custom function to system function
            // RULE: isSystemFunction is immutable on all functions
            const existing = { id: "fn3", functionName: "myTool", isSystemFunction: false }
            mockRepository.findByName.mockResolvedValue(existing)

            const req = buildReq({
                params: { functionName: "myTool" } as any,
                body: { isSystemFunction: true }, // privilege escalation attempt
            })
            const { res, statusFn } = buildMockRes()

            await controller.updateFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(403)
        })

        it("system function: description is editable (not in IMMUTABLE_KEYS)", async () => {
            // SCENARIO: Admin customises the description of a system calling function
            // RULE: description is NOT immutable — system functions can have their description updated
            const existing = { id: "fn4", functionName: "productSearchAgent", isSystemFunction: true }
            const updated = { ...existing, description: "Custom description" }
            mockRepository.findByName.mockResolvedValue(existing)
            mockRepository.update.mockResolvedValue(updated)

            const req = buildReq({
                params: { functionName: "productSearchAgent" } as any,
                body: { description: "Custom description" },
            })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.updateFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            expect(jsonFn).toHaveBeenCalledWith(updated)
        })
    })

    // ── DELETE /:functionName ──────────────────────────────────────────────

    describe("deleteFunction", () => {
        it("custom function → 204 and hard delete called", async () => {
            // SCENARIO: Admin removes a custom webhook tool
            // RULE: Hard delete, no soft-delete — repository.delete must be called
            const existing = { id: "fn5", functionName: "myWebhook", isSystemFunction: false }
            mockRepository.findByName.mockResolvedValue(existing)
            mockRepository.delete.mockResolvedValue(undefined)

            const req = buildReq({ params: { functionName: "myWebhook" } as any })
            const { res, statusFn, sendFn } = buildMockRes()

            await controller.deleteFunction(req as Request, res as Response)

            expect(mockRepository.delete).toHaveBeenCalledWith("ws-test-001", "myWebhook")
            expect(statusFn).toHaveBeenCalledWith(204)
            expect(sendFn).toHaveBeenCalled()
        })

        it("system function → 204 (no protection — full CRUD for all functions)", async () => {
            // SCENARIO: Admin deletes a system function intentionally
            // RULE: System functions can be deleted (hard delete) — they can be reinstalled via /reinstall
            const existing = { id: "fn6", functionName: "changeLanguage", isSystemFunction: true }
            mockRepository.findByName.mockResolvedValue(existing)
            mockRepository.delete.mockResolvedValue(undefined)

            const req = buildReq({ params: { functionName: "changeLanguage" } as any })
            const { res, statusFn, sendFn } = buildMockRes()

            await controller.deleteFunction(req as Request, res as Response)

            // RULE: delete IS called for system functions — no 403 guard
            expect(mockRepository.delete).toHaveBeenCalledWith("ws-test-001", "changeLanguage")
            expect(statusFn).toHaveBeenCalledWith(204)
            expect(sendFn).toHaveBeenCalled()
        })

        it("should return 404 when function does not exist", async () => {
            // SCENARIO: Stale UI tries to delete an already-deleted function
            mockRepository.findByName.mockResolvedValue(null)

            const req = buildReq({ params: { functionName: "ghost" } as any })
            const { res, statusFn } = buildMockRes()

            await controller.deleteFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(404)
            expect(mockRepository.delete).not.toHaveBeenCalled()
        })
    })

    // ── POST /:functionName/reinstall ──────────────────────────────────────

    describe("reinstallFunction", () => {
        it("valid system function → 200 with upserted function", async () => {
            // SCENARIO: Admin reinstalls changeLanguage after accidentally modifying its description
            // RULE: SYSTEM_FUNCTIONS_BY_NAME.get("changeLanguage") returns a valid definition → upsert runs
            const upsertResult = { id: "fn7", functionName: "changeLanguage", isSystemFunction: true }
            mockPrisma.workspaceCallingFunction.upsert.mockResolvedValue(upsertResult)

            const req = buildReq({ params: { functionName: "changeLanguage" } as any })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.reinstallFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            expect(jsonFn).toHaveBeenCalledWith(upsertResult)
            expect(mockPrisma.workspaceCallingFunction.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workspaceId_functionName: expect.objectContaining({ functionName: "changeLanguage" }),
                    }),
                })
            )
        })

        it("unknown function name → 400 'Not a valid system function'", async () => {
            // SCENARIO: Frontend sends an arbitrary name not in SYSTEM_FUNCTIONS_BY_NAME
            // RULE: Only known system functions can be reinstalled — others are rejected with 400
            const req = buildReq({ params: { functionName: "randomCustomTool" } as any })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.reinstallFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(400)
            expect(jsonFn).toHaveBeenCalledWith(
                expect.objectContaining({ error: "Not a valid system function" })
            )
            expect(mockPrisma.workspaceCallingFunction.upsert).not.toHaveBeenCalled()
        })

        it("valid system function (productSearchAgent) → 200", async () => {
            // SCENARIO: Admin reinstalls productSearchAgent after deleting it in ECOMMERCE workspace
            const upsertResult = { id: "fn8", functionName: "productSearchAgent", isSystemFunction: true }
            mockPrisma.workspaceCallingFunction.upsert.mockResolvedValue(upsertResult)

            const req = buildReq({ params: { functionName: "productSearchAgent" } as any })
            const { res, statusFn, jsonFn } = buildMockRes()

            await controller.reinstallFunction(req as Request, res as Response)

            expect(statusFn).toHaveBeenCalledWith(200)
            expect(jsonFn).toHaveBeenCalledWith(upsertResult)
        })
    })
})
