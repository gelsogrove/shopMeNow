import { Request, Response, NextFunction } from "express"

// Mock the entire module before importing
jest.mock("@prisma/client", () => {
  const mockWorkspace = {
    findUnique: jest.fn(),
  }
  const mockUserWorkspace = {
    findUnique: jest.fn(),
  }
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      workspace: mockWorkspace,
      userWorkspace: mockUserWorkspace,
    })),
    __mockWorkspace: mockWorkspace,
    __mockUserWorkspace: mockUserWorkspace,
  }
})

// Import after mocking
import {
  requireSuperAdmin,
  requireWorkspaceMember,
} from "../../../src/middlewares/workspace-role.middleware"

// Get the mocks from the module
const { __mockWorkspace, __mockUserWorkspace } = jest.requireMock("@prisma/client")

describe("Workspace Role Middleware", () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    jest.clearAllMocks()

    mockReq = {
      params: { workspaceId: "ws-123" },
      body: {},
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockNext = jest.fn()
  })

  describe("requireSuperAdmin", () => {
    it("should allow SUPER_ADMIN (workspace owner) to proceed", async () => {
      ;(mockReq as any).user = { id: "owner-123" }
      ;(mockReq as any).workspaceId = "ws-123"

      __mockWorkspace.findUnique.mockResolvedValue({
        ownerId: "owner-123",
      })

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it("should allow user with SUPER_ADMIN role in UserWorkspace", async () => {
      ;(mockReq as any).user = { id: "user-123" }
      ;(mockReq as any).workspaceId = "ws-123"

      __mockWorkspace.findUnique.mockResolvedValue({
        ownerId: "other-owner",
      })
      __mockUserWorkspace.findUnique.mockResolvedValue({
        role: "SUPER_ADMIN",
      })

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalled()
    })

    it("should block ADMIN with 403", async () => {
      ;(mockReq as any).user = { id: "admin-123" }
      ;(mockReq as any).workspaceId = "ws-123"

      __mockWorkspace.findUnique.mockResolvedValue({
        ownerId: "owner-123",
      })
      __mockUserWorkspace.findUnique.mockResolvedValue({
        role: "ADMIN",
      })

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Only workspace owner can perform this action",
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should return 401 if no user in request", async () => {
      ;(mockReq as any).user = undefined
      ;(mockReq as any).workspaceId = "ws-123"

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
      })
    })

    it("should return 400 if no workspaceId", async () => {
      ;(mockReq as any).user = { id: "user-123" }
      ;(mockReq as any).workspaceId = undefined
      mockReq.params = {}

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Workspace ID is required",
      })
    })

    it("should return 404 if workspace not found", async () => {
      ;(mockReq as any).user = { id: "user-123" }
      ;(mockReq as any).workspaceId = "invalid-ws"

      __mockWorkspace.findUnique.mockResolvedValue(null)

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Not Found",
        message: "Workspace not found",
      })
    })

    it("should get workspaceId from params if not in request", async () => {
      ;(mockReq as any).user = { id: "owner-123" }
      ;(mockReq as any).workspaceId = undefined
      mockReq.params = { workspaceId: "ws-from-params" }

      __mockWorkspace.findUnique.mockResolvedValue({
        ownerId: "owner-123",
      })

      await requireSuperAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe("requireWorkspaceMember", () => {
    it("should allow workspace member to proceed", async () => {
      ;(mockReq as any).user = { id: "member-123" }
      ;(mockReq as any).workspaceId = "ws-123"

      __mockUserWorkspace.findUnique.mockResolvedValue({
        role: "ADMIN",
      })

      await requireWorkspaceMember(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalled()
      expect((mockReq as any).userRole).toBe("ADMIN")
    })

    it("should block non-member with 403", async () => {
      ;(mockReq as any).user = { id: "non-member" }
      ;(mockReq as any).workspaceId = "ws-123"

      __mockUserWorkspace.findUnique.mockResolvedValue(null)

      await requireWorkspaceMember(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "You are not a member of this workspace",
      })
    })

    it("should return 401 if no user in request", async () => {
      ;(mockReq as any).user = undefined
      ;(mockReq as any).workspaceId = "ws-123"

      await requireWorkspaceMember(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(401)
    })

    it("should return 400 if no workspaceId", async () => {
      ;(mockReq as any).user = { id: "user-123" }
      ;(mockReq as any).workspaceId = undefined
      mockReq.params = {}

      await requireWorkspaceMember(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it("should attach userRole to request", async () => {
      ;(mockReq as any).user = { id: "member-123" }
      ;(mockReq as any).workspaceId = "ws-123"

      __mockUserWorkspace.findUnique.mockResolvedValue({
        role: "SUPER_ADMIN",
      })

      await requireWorkspaceMember(
        mockReq as Request,
        mockRes as Response,
        mockNext
      )

      expect((mockReq as any).userRole).toBe("SUPER_ADMIN")
    })
  })
})
