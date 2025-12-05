/**
 * Agent Configuration - Owner Only Access Tests
 * 
 * SECURITY: Only workspace owner (ownerId) can view/edit agent configuration.
 * Team members with ADMIN, MEMBER, or even SUPER_ADMIN role (but not owner) cannot access.
 * 
 * This is stricter than other SUPER_ADMIN checks because AI prompts are sensitive.
 */

import { Request, Response, NextFunction } from "express"

// Mock prisma before imports
const mockFindUnique = jest.fn()

jest.mock("@echatbot/database", () => ({

  prisma: {
    workspace: { findUnique: mockFindUnique },
    userWorkspace: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  },
}))

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Import after mocking
import { requireOwner } from "../../../src/middlewares/workspace-role.middleware"

describe("Agent Configuration - Owner Only Access", () => {
  const WORKSPACE_ID = "workspace-123"
  const OWNER_USER_ID = "owner-user-456"
  const TEAM_MEMBER_ID = "team-member-789"
  const SUPER_ADMIN_ID = "super-admin-101" // Has SUPER_ADMIN role but NOT owner

  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockNext = jest.fn()
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    
    // Default workspace with owner
    mockFindUnique.mockResolvedValue({
      ownerId: OWNER_USER_ID,
    })
  })

  describe("requireOwner middleware", () => {
    it("should ALLOW access when user is the workspace owner (ownerId)", async () => {
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      ;(mockReq as any).user = { id: OWNER_USER_ID }
      ;(mockReq as any).workspaceId = WORKSPACE_ID

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it("should DENY access when user is a team member (not owner)", async () => {
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      ;(mockReq as any).user = { id: TEAM_MEMBER_ID }
      ;(mockReq as any).workspaceId = WORKSPACE_ID

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Only workspace owner can access agent configuration",
      })
    })

    it("should DENY access when user has SUPER_ADMIN role but is NOT owner", async () => {
      // This is the key test: SUPER_ADMIN role is NOT enough for agent config
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      ;(mockReq as any).user = { id: SUPER_ADMIN_ID }
      ;(mockReq as any).workspaceId = WORKSPACE_ID

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Only workspace owner can access agent configuration",
      })
    })

    it("should return 401 when no user is authenticated", async () => {
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      // No user attached

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
      })
    })

    it("should return 400 when workspaceId is missing", async () => {
      mockReq = {
        params: {},
      } as any
      ;(mockReq as any).user = { id: OWNER_USER_ID }
      // No workspaceId

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Workspace ID is required",
      })
    })

    it("should return 404 when workspace does not exist", async () => {
      mockFindUnique.mockResolvedValue(null)
      
      mockReq = {
        params: { workspaceId: "non-existent-workspace" },
      } as any
      ;(mockReq as any).user = { id: OWNER_USER_ID }
      ;(mockReq as any).workspaceId = "non-existent-workspace"

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Not Found",
        message: "Workspace not found",
      })
    })
  })

  describe("Agent Config Access Scenarios", () => {
    it("scenario: Owner creates workspace and can see agent config", async () => {
      // Owner (who created the workspace) should have full access
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      ;(mockReq as any).user = { id: OWNER_USER_ID }
      ;(mockReq as any).workspaceId = WORKSPACE_ID

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).toHaveBeenCalled()
    })

    it("scenario: Invited team member cannot see agent config", async () => {
      // Team member invited to workspace should NOT see agent config
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      ;(mockReq as any).user = { id: "invited-member-xyz" }
      ;(mockReq as any).workspaceId = WORKSPACE_ID

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })

    it("scenario: Admin role member cannot see agent config", async () => {
      // Even ADMIN role is not enough - only ownerId
      mockReq = {
        params: { workspaceId: WORKSPACE_ID },
      } as any
      ;(mockReq as any).user = { id: "admin-role-user" }
      ;(mockReq as any).workspaceId = WORKSPACE_ID

      await requireOwner(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })
  })
})
