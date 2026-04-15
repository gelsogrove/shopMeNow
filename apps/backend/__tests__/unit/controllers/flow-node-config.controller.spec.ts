/**
 * FlowNodeConfigController Unit Tests
 *
 * RULE: Tests exercise actual controller methods with mocked repository.
 * RULE: Logic under test: HTTP status codes, response shapes, workspace isolation, error handling.
 *
 * Tests for E5 (master plan):
 * - T1: GET /flow-configs → returns configs filtered by workspaceId
 * - T2: GET /flow-configs/:id with wrong workspace → 404
 * - T3: POST /flow-configs with duplicate flowKey → 409
 * - T4: POST /flow-configs with valid data → 201
 * - T5: PUT /flow-configs/:id → updates successfully
 * - T6: DELETE /flow-configs/:id not found → 404
 * - T7: GET /flow-configs with no workspaceId → 500 (defensive)
 */

import { Request, Response } from "express"
import { FlowNodeConfigController } from "../../../src/interfaces/http/controllers/flow-node-config.controller"

// SCENARIO: Mock repository used by the controller
jest.mock("../../../src/repositories/flow-node-config.repository", () => ({
  FlowNodeConfigRepository: jest.fn().mockImplementation(() => ({
    findAllByWorkspace: jest.fn(),
    findById: jest.fn(),
    findByFlowKey: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
  const statusFn = jest.fn().mockReturnThis()
  const res: Partial<Response> = {
    json: jsonFn,
    status: statusFn,
  } as any
  statusFn.mockReturnValue({ json: jsonFn })
  return { res, jsonFn, statusFn }
}

function buildReq(overrides: Record<string, any> = {}): Partial<Request> {
  const req: any = { body: {}, params: {}, ...overrides }
  req.workspaceId = overrides.workspaceId ?? "ws-flow-001"
  return req as any
}

// ─── setup ─────────────────────────────────────────────────────────────────

describe("FlowNodeConfigController", () => {
  let controller: FlowNodeConfigController
  let mockRepository: any
  let mockPrisma: any

  beforeEach(() => {
    jest.clearAllMocks()

    // RULE: Minimal prisma mock — controller delegates everything to repository
    mockPrisma = {}

    controller = new FlowNodeConfigController(mockPrisma as any)
    mockRepository = (controller as any).repository
  })

  // ── T1: GET /flow-configs → returns configs filtered by workspaceId ──

  describe("getAll", () => {
    it("should return 200 with configs filtered by workspaceId", async () => {
      // SCENARIO: Workspace has 2 flow configs (washer + dryer)
      const mockConfigs = [
        { id: "fc-1", workspaceId: "ws-flow-001", flowKey: "washer_hs60xx", flowLabel: "Washer HS-60XX" },
        { id: "fc-2", workspaceId: "ws-flow-001", flowKey: "dryer_ed340", flowLabel: "Dryer ED-340" },
      ]
      mockRepository.findAllByWorkspace.mockResolvedValue(mockConfigs)

      const req = buildReq()
      const { res, jsonFn } = buildMockRes()

      await controller.getAll(req as Request, res as Response)

      // RULE: Repository called with correct workspaceId
      expect(mockRepository.findAllByWorkspace).toHaveBeenCalledWith("ws-flow-001")
      // RULE: Response contains both configs
      expect(jsonFn).toHaveBeenCalledWith(mockConfigs)
    })
  })

  // ── T2: GET /flow-configs/:id with wrong workspace → 404 ──

  describe("getById", () => {
    it("should return 404 when config not found for workspace", async () => {
      // SCENARIO: Config exists but belongs to different workspace → repository returns null
      mockRepository.findById.mockResolvedValue(null)

      const req = buildReq({ params: { id: "fc-999" }, workspaceId: "ws-other" })
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.getById(req as Request, res as Response)

      // RULE: Repository filters by workspaceId, returning null for cross-workspace access
      expect(mockRepository.findById).toHaveBeenCalledWith("ws-other", "fc-999")
      expect(statusFn).toHaveBeenCalledWith(404)
      expect(jsonFn).toHaveBeenCalledWith({ error: "Flow config not found" })
    })

    it("should return 200 with config when found", async () => {
      // SCENARIO: Config exists in this workspace
      const mockConfig = { id: "fc-1", workspaceId: "ws-flow-001", flowKey: "washer_hs60xx", flowLabel: "Washer HS-60XX" }
      mockRepository.findById.mockResolvedValue(mockConfig)

      const req = buildReq({ params: { id: "fc-1" } })
      const { res, jsonFn } = buildMockRes()

      await controller.getById(req as Request, res as Response)

      expect(jsonFn).toHaveBeenCalledWith(mockConfig)
    })
  })

  // ── T3: POST /flow-configs with duplicate flowKey → 409 ──

  describe("create", () => {
    it("should return 409 when flowKey already exists (P2002)", async () => {
      // SCENARIO: Attempt to create config with duplicate flowKey in same workspace
      const prismaError = new Error("Unique constraint failed")
      ;(prismaError as any).code = "P2002"
      mockRepository.create.mockRejectedValue(prismaError)

      const req = buildReq({
        body: { flowKey: "washer_hs60xx", flowLabel: "Duplicate Washer" },
      })
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.create(req as Request, res as Response)

      // RULE: P2002 error maps to 409 Conflict
      expect(statusFn).toHaveBeenCalledWith(409)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("already exists") })
      )
    })

    // ── T4: POST /flow-configs with valid data → 201 ──

    it("should return 201 with created config for valid data", async () => {
      // SCENARIO: Create new flow config with all fields
      const newConfig = {
        id: "fc-new",
        workspaceId: "ws-flow-001",
        flowKey: "dryer_new",
        flowLabel: "New Dryer",
        systemPrompt: "You are a dryer assistant",
        isActive: true,
      }
      mockRepository.create.mockResolvedValue(newConfig)

      const req = buildReq({
        body: {
          flowKey: "dryer_new",
          flowLabel: "New Dryer",
          systemPrompt: "You are a dryer assistant",
          isActive: true,
        },
      })
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.create(req as Request, res as Response)

      // RULE: Repository receives workspaceId + body data
      expect(mockRepository.create).toHaveBeenCalledWith(
        "ws-flow-001",
        expect.objectContaining({
          flowKey: "dryer_new",
          flowLabel: "New Dryer",
          systemPrompt: "You are a dryer assistant",
          isActive: true,
        })
      )
      // RULE: 201 Created with config in response
      expect(statusFn).toHaveBeenCalledWith(201)
      expect(jsonFn).toHaveBeenCalledWith(newConfig)
    })

    it("should return 400 when flowKey or flowLabel missing", async () => {
      // SCENARIO: Missing required fields
      const req = buildReq({ body: { flowLabel: "Only label" } })
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.create(req as Request, res as Response)

      // RULE: Validation rejects before calling repository
      expect(statusFn).toHaveBeenCalledWith(400)
      expect(mockRepository.create).not.toHaveBeenCalled()
    })
  })

  // ── T5: PUT /flow-configs/:id → updates successfully ──

  describe("update", () => {
    it("should return 200 with updated config", async () => {
      // SCENARIO: Update flowLabel and systemPrompt
      const updatedConfig = {
        id: "fc-1",
        workspaceId: "ws-flow-001",
        flowKey: "washer_hs60xx",
        flowLabel: "Updated Washer",
        systemPrompt: "Updated prompt",
      }
      mockRepository.update.mockResolvedValue(updatedConfig)

      const req = buildReq({
        params: { id: "fc-1" },
        body: { flowLabel: "Updated Washer", systemPrompt: "Updated prompt" },
      })
      const { res, jsonFn } = buildMockRes()

      await controller.update(req as Request, res as Response)

      // RULE: Repository receives workspaceId, id, and update data
      expect(mockRepository.update).toHaveBeenCalledWith(
        "ws-flow-001",
        "fc-1",
        expect.objectContaining({
          flowLabel: "Updated Washer",
          systemPrompt: "Updated prompt",
        })
      )
      expect(jsonFn).toHaveBeenCalledWith(updatedConfig)
    })

    it("should return 404 when config not found for update", async () => {
      // SCENARIO: Config doesn't exist or belongs to different workspace
      mockRepository.update.mockRejectedValue(new Error("Flow config not found"))

      const req = buildReq({ params: { id: "fc-ghost" }, body: { flowLabel: "Ghost" } })
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.update(req as Request, res as Response)

      expect(statusFn).toHaveBeenCalledWith(404)
      expect(jsonFn).toHaveBeenCalledWith({ error: "Flow config not found" })
    })
  })

  // ── T6: DELETE /flow-configs/:id not found → 404 ──

  describe("delete", () => {
    it("should return 404 when config not found for delete", async () => {
      // SCENARIO: Attempt to delete config that doesn't exist in this workspace
      mockRepository.delete.mockRejectedValue(new Error("Flow config not found"))

      const req = buildReq({ params: { id: "fc-nope" } })
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.delete(req as Request, res as Response)

      expect(statusFn).toHaveBeenCalledWith(404)
      expect(jsonFn).toHaveBeenCalledWith({ error: "Flow config not found" })
    })

    it("should return 200 when config deleted successfully", async () => {
      // SCENARIO: Config exists and is deleted
      mockRepository.delete.mockResolvedValue({})

      const req = buildReq({ params: { id: "fc-1" } })
      const { res, jsonFn } = buildMockRes()

      await controller.delete(req as Request, res as Response)

      expect(mockRepository.delete).toHaveBeenCalledWith("ws-flow-001", "fc-1")
      expect(jsonFn).toHaveBeenCalledWith({ message: "Flow config deleted successfully" })
    })
  })

  // ── T7: Defensive — repository error → 500 ──

  describe("error handling", () => {
    it("should return 500 when repository throws unexpected error", async () => {
      // SCENARIO: Database connection failure or other unexpected error
      mockRepository.findAllByWorkspace.mockRejectedValue(new Error("Connection refused"))

      const req = buildReq()
      const { res, jsonFn, statusFn } = buildMockRes()

      await controller.getAll(req as Request, res as Response)

      expect(statusFn).toHaveBeenCalledWith(500)
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Failed to get flow configs",
          message: "Connection refused",
        })
      )
    })
  })
})
