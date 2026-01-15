/**
 * Test: Workspace Validation Middleware - Owner Status Check
 * 
 * Verifica che quando un owner è INACTIVE, tutte le operazioni vengono bloccate
 * silenziosamente senza modificare lo stato dei canali.
 */

import { Request, Response, NextFunction } from "express"
import { workspaceValidationMiddleware } from "../../../src/interfaces/http/middlewares/workspace-validation.middleware"
import { prisma } from "../../../src/lib/prisma"
import { UserStatus } from "@echatbot/database"

jest.mock("../../../src/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
  },
}))

describe("workspaceValidationMiddleware - Owner Status Check", () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockRequest = {
      params: { workspaceId: "workspace-123" },
      originalUrl: "/api/workspaces/workspace-123/products",
      method: "GET",
      headers: {},
      query: {},
    }

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    nextFunction = jest.fn()
    process.env.NODE_ENV = "production" // Set to production to avoid debug output
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should block operation silently when owner is INACTIVE", async () => {
    // Mock workspace with INACTIVE owner
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: "workspace-123",
      name: "Test Workspace",
      deletedAt: null,
      ownerId: "owner-1",
      owner: {
        status: UserStatus.INACTIVE, // ❌ Owner disabled
      },
    })

    await workspaceValidationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    // Should return 200 with success message (silent block)
    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Operation completed",
    })

    // Should NOT call next()
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it("should allow operation when owner is ACTIVE", async () => {
    // Mock workspace with ACTIVE owner
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: "workspace-123",
      name: "Test Workspace",
      deletedAt: null,
      ownerId: "owner-1",
      owner: {
        status: UserStatus.ACTIVE, // ✅ Owner active
      },
    })

    await workspaceValidationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    // Should call next() to continue
    expect(nextFunction).toHaveBeenCalled()

    // Should NOT send response
    expect(mockResponse.json).not.toHaveBeenCalled()
  })

  it("should block when workspace is deleted (deletedAt set)", async () => {
    // Mock deleted workspace
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: "workspace-123",
      name: "Test Workspace",
      deletedAt: new Date(), // ❌ Deleted
      ownerId: "owner-1",
      owner: {
        status: UserStatus.ACTIVE,
      },
    })

    await workspaceValidationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    // Should return 403 for deleted workspace
    expect(mockResponse.status).toHaveBeenCalledWith(403)
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: "Workspace is not available",
    })

    // Should NOT call next()
    expect(nextFunction).not.toHaveBeenCalled()
  })

  it("should allow operation when workspace is active and owner is active", async () => {
    // Workspace is active (deletedAt null)
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: "workspace-123",
      name: "Test Workspace",
      deletedAt: null,
      ownerId: "owner-1",
      owner: {
        status: UserStatus.ACTIVE, // ✅ Owner active
      },
    })

    await workspaceValidationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    // Should call next() (admin access allowed)
    expect(nextFunction).toHaveBeenCalled()

    // Should NOT send response
    expect(mockResponse.json).not.toHaveBeenCalled()
  })

  it("should handle workspace not found", async () => {
    // Mock workspace not found
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null)

    await workspaceValidationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    // Should return 404
    expect(mockResponse.status).toHaveBeenCalledWith(404)
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: "Workspace not found",
    })

    // Should NOT call next()
    expect(nextFunction).not.toHaveBeenCalled()
  })
})
