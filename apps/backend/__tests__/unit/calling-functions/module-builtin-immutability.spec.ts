/**
 * Module built-ins: what an admin may change, and what the API refuses
 *
 * Andrea 2026-08-24. A built-in is two halves — a row that DECLARES the tool
 * and a branch in the module's code that EXECUTES it. The Settings UI owns the
 * first half; the module owns the second. These tests pin the seam.
 *
 * Editable: `description`, `responseInstructions`, `isActive`. That is the
 * whole point of moving them into the database.
 *
 * Refused: `parameters` and `executionType`, because the handler reads its
 * arguments by name — dropping `asked` from save_stay's schema turns the intake
 * into a loop that asks the same question every turn, with nothing on screen
 * saying why. And DELETE, because switching a tool off achieves the same thing
 * reversibly (Andrea's call: "solo disattivare").
 *
 * The failures these guard against are all SILENT: the chatbot keeps replying,
 * just less capably. That is why they are refused at the API rather than
 * merely discouraged in the UI.
 */

const mockFindByName = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()
const mockCreate = jest.fn()
const mockWorkspaceFindUnique = jest.fn()

jest.mock("@echatbot/database", () => ({ PrismaClient: jest.fn() }))

jest.mock("../../../src/repositories/workspace-calling-function.repository", () => ({
  WorkspaceCallingFunctionRepository: jest.fn().mockImplementation(() => ({
    findByName: mockFindByName,
    update: mockUpdate,
    delete: mockDelete,
    create: mockCreate,
    findAllByWorkspace: jest.fn().mockResolvedValue([]),
  })),
}))

jest.mock("../../../src/services/webhook-dispatch.service", () => ({
  WebhookDispatchService: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../src/application/services/flow-sync.service", () => ({
  FlowSyncService: jest.fn().mockImplementation(() => ({
    addDelegateToRouter: jest.fn(),
    cleanupOrphanedReferences: jest.fn(),
  })),
}))

const WORKSPACE_ID = "ws-sappada"

function buildRes() {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res
}

function buildReq(overrides: Record<string, any> = {}) {
  return { workspaceId: WORKSPACE_ID, params: {}, body: {}, ...overrides } as any
}

describe("module built-in immutability", () => {
  let controller: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockWorkspaceFindUnique.mockResolvedValue({ customChatbotId: "demosappada" })
    mockUpdate.mockResolvedValue({ functionName: "save_stay" })
    mockDelete.mockResolvedValue(undefined)
    mockCreate.mockResolvedValue({ functionName: "myTool" })

    const {
      CallingFunctionsController,
    } = require("../../../src/interfaces/http/controllers/calling-functions.controller")
    controller = new CallingFunctionsController({
      workspace: { findUnique: mockWorkspaceFindUnique },
      workspaceCallingFunction: { upsert: jest.fn().mockResolvedValue({}) },
    })
  })

  describe("editing a built-in", () => {
    beforeEach(() => {
      mockFindByName.mockResolvedValue({ functionName: "save_stay", isSystemFunction: true })
    })

    it("allows the description to be rewritten", async () => {
      // This is the capability Andrea asked for: the text that tells the model
      // when to call the tool is the tenant's to tune.
      const res = buildRes()
      await controller.updateFunction(
        buildReq({ params: { functionName: "save_stay" }, body: { description: "New wording" } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
      expect(mockUpdate).toHaveBeenCalled()
    })

    it("allows the tool to be switched off", async () => {
      const res = buildRes()
      await controller.updateFunction(
        buildReq({ params: { functionName: "save_stay" }, body: { isActive: false } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it("refuses a change to the parameters schema", async () => {
      // The handler reads args.adults, args.asked, ~12 names. An edited schema
      // breaks it without any error being raised anywhere.
      const res = buildRes()
      await controller.updateFunction(
        buildReq({
          params: { functionName: "save_stay" },
          body: { parameters: { type: "object", properties: {} } },
        }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("parameters") })
      )
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("refuses a change to the execution type", async () => {
      // executionType is what routes the call back into the module at all.
      const res = buildRes()
      await controller.updateFunction(
        buildReq({ params: { functionName: "save_stay" }, body: { executionType: "WEBHOOK" } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(403)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("refuses a rename, as it does for every function", async () => {
      const res = buildRes()
      await controller.updateFunction(
        buildReq({ params: { functionName: "save_stay" }, body: { functionName: "salva_soggiorno" } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(403)
    })
  })

  describe("editing a tenant's own tool is unaffected", () => {
    it("still allows parameters to be edited on a custom tool", async () => {
      // The new guard must not leak onto rows the tenant created — those have
      // no handler in the module and their schema is theirs to change.
      mockFindByName.mockResolvedValue({ functionName: "myTool", isSystemFunction: false })

      const res = buildRes()
      await controller.updateFunction(
        buildReq({
          params: { functionName: "myTool" },
          body: { parameters: { type: "object", properties: {} } },
        }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe("deleting", () => {
    it("refuses to delete a built-in", async () => {
      mockFindByName.mockResolvedValue({ functionName: "save_stay", isSystemFunction: true })

      const res = buildRes()
      await controller.deleteFunction(buildReq({ params: { functionName: "save_stay" } }), res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it("still deletes a tenant's own tool", async () => {
      mockFindByName.mockResolvedValue({ functionName: "myTool", isSystemFunction: false })

      const res = buildRes()
      await controller.deleteFunction(buildReq({ params: { functionName: "myTool" } }), res)

      expect(mockDelete).toHaveBeenCalledWith(WORKSPACE_ID, "myTool")
    })
  })

  describe("creating", () => {
    it("refuses a name the module already dispatches", async () => {
      // The module matches on the name BEFORE reaching tenant tools, so a
      // webhook called save_stay would look installed and never fire.
      mockFindByName.mockResolvedValue(null)

      const res = buildRes()
      await controller.createFunction(
        buildReq({
          body: { functionName: "save_stay", description: "mine", executionType: "WEBHOOK" },
        }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(409)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it("allows any other name", async () => {
      mockFindByName.mockResolvedValue(null)

      const res = buildRes()
      await controller.createFunction(
        buildReq({
          body: { functionName: "checkStock", description: "mine", executionType: "WEBHOOK" },
        }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(201)
      expect(mockCreate).toHaveBeenCalled()
    })
  })

  describe("workspaces without a module", () => {
    it("applies none of these restrictions", async () => {
      // A workspace with no custom chatbot has no built-ins, so nothing here
      // should narrow what its admin can do.
      mockWorkspaceFindUnique.mockResolvedValue({ customChatbotId: null })
      mockFindByName.mockResolvedValue({ functionName: "save_stay", isSystemFunction: true })

      const res = buildRes()
      await controller.updateFunction(
        buildReq({
          params: { functionName: "save_stay" },
          body: { parameters: { type: "object" } },
        }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(200)
    })
  })
})
