/**
 * Tests for the flow-builder graph service (flow-graph.service.ts).
 *
 * WHAT: deleteFlow / duplicateFlow / saveFlowGraph — the write operations
 * behind the Flows list and the flow editor's Save button.
 *
 * WHY these cases:
 * - deleteFlow guards the seeded system flows (isProtected, e.g. the
 *   "Human operator flow" fallback): the ONLY thing standing between the
 *   trash icon and losing the escalation path is the 'protected' branch,
 *   so it is pinned here to survive refactors.
 * - deleteFlow must scope by workspaceId (multi-tenant isolation, CLAUDE.md
 *   rule 2): a flowId from another workspace must read as not_found, never
 *   as deletable.
 * - saveFlowGraph must REJECT an invalid graph without touching the DB
 *   (specs/flow-compiler "Invalid graph save is rejected") — persisting a
 *   half-valid graph would corrupt the compiled prompt retrieval reads.
 * - duplicateFlow of an unknown/foreign flow returns null instead of
 *   creating an orphan copy.
 */

const mockPrisma = {
  flow: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  flowNode: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  flowEdge: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  flowNodeAttachment: {
    createMany: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(),
}))

import {
  deleteFlow,
  duplicateFlow,
  saveFlowGraph,
} from "../../src/application/flow-builder/flow-graph.service"

const WORKSPACE_ID = "ws-1"
const FLOW_ID = "flow-1"

describe("flow-graph.service", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("deleteFlow", () => {
    it("returns 'protected' and does NOT delete when the flow is a seeded system flow", async () => {
      // The human-operator fallback flow ships with isProtected=true — deleting
      // it would silently remove the workspace's escalation path.
      mockPrisma.flow.findFirst.mockResolvedValue({
        id: FLOW_ID,
        workspaceId: WORKSPACE_ID,
        isProtected: true,
      })

      const result = await deleteFlow(WORKSPACE_ID, FLOW_ID)

      expect(result).toBe("protected")
      expect(mockPrisma.flow.delete).not.toHaveBeenCalled()
    })

    it("deletes and returns 'deleted' for a normal (unprotected) flow", async () => {
      mockPrisma.flow.findFirst.mockResolvedValue({
        id: FLOW_ID,
        workspaceId: WORKSPACE_ID,
        isProtected: false,
      })
      mockPrisma.flow.delete.mockResolvedValue({ id: FLOW_ID })

      const result = await deleteFlow(WORKSPACE_ID, FLOW_ID)

      expect(result).toBe("deleted")
      expect(mockPrisma.flow.delete).toHaveBeenCalledWith({ where: { id: FLOW_ID } })
    })

    it("returns 'not_found' when the flow does not exist in THIS workspace (isolation)", async () => {
      // The lookup itself must carry the workspaceId filter — a valid flowId
      // belonging to another tenant has to behave exactly like a missing one.
      mockPrisma.flow.findFirst.mockResolvedValue(null)

      const result = await deleteFlow(WORKSPACE_ID, "someone-elses-flow")

      expect(result).toBe("not_found")
      expect(mockPrisma.flow.findFirst).toHaveBeenCalledWith({
        where: { id: "someone-elses-flow", workspaceId: WORKSPACE_ID },
      })
      expect(mockPrisma.flow.delete).not.toHaveBeenCalled()
    })
  })

  describe("duplicateFlow", () => {
    it("returns null (no copy created) when the source flow is not in this workspace", async () => {
      mockPrisma.flow.findFirst.mockResolvedValue(null)

      const result = await duplicateFlow(WORKSPACE_ID, "foreign-flow", "Copy title")

      expect(result).toBeNull()
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe("saveFlowGraph", () => {
    const embeddingProvider = { embed: jest.fn() }

    it("returns ok:false without saving when the flow does not exist in this workspace", async () => {
      mockPrisma.flow.findFirst.mockResolvedValue(null)

      const result = await saveFlowGraph(
        WORKSPACE_ID,
        FLOW_ID,
        { title: "T", nodes: [], edges: [] },
        embeddingProvider as any,
      )

      expect(result.ok).toBe(false)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it("rejects an INVALID graph (empty = no root node) and never writes to the DB", async () => {
      // "Invalid graph save is rejected": the previous valid compiled prompt
      // must survive untouched, so retrieval keeps working mid-edit.
      mockPrisma.flow.findFirst.mockResolvedValue({
        id: FLOW_ID,
        workspaceId: WORKSPACE_ID,
        flowCategoryId: null,
        description: "old description",
        retrievalDocument: "old doc",
        embedding: [0.1],
      })

      const result = await saveFlowGraph(
        WORKSPACE_ID,
        FLOW_ID,
        { title: "T", nodes: [], edges: [] },
        embeddingProvider as any,
      )

      expect(result.ok).toBe(false)
      expect(result.validationReport && result.validationReport.length).toBeGreaterThan(0)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      expect(mockPrisma.flow.update).not.toHaveBeenCalled()
    })
  })
})
