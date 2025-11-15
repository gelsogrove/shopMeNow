import { UserRole } from "@prisma/client"
import { NextFunction, Request, Response } from "express"
import { verify } from "jsonwebtoken"
import { prisma } from "../lib/prisma"
import logger from "../utils/logger"
// Types are automatically loaded by TypeScript

// Define our payload type to match what's generated in auth.controller.ts
interface JwtPayload {
  id?: string
  userId?: string
  email: string
  role: UserRole
  workspaces?: Array<{
    id: string
    role: UserRole
  }>
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // First try to get token from cookie
    let token = req.cookies?.auth_token

    // Fallback to Authorization header
    if (!token) {
      const authHeader = req.headers?.authorization
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1]
      }
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Authentication token is required" })
    }

    const decoded = verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as JwtPayload

    // Use either id or userId from the token
    const userId = decoded.id || decoded.userId

    if (!userId) {
      logger.error("No user ID found in token:", decoded)
      return res.status(401).json({ message: "Invalid token format" })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaces: {
          include: {
            workspace: true,
          },
        },
      },
    })

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    // Add user to request object
    req.user = {
      id: user.id, // Include both id and userId for consistency
      userId: user.id,
      email: user.email,
      role: user.role,
      workspaces: user.workspaces.map((w) => ({
        id: w.workspace.id,
        role: w.role,
      })),
    }

    // Get workspaceId from query params or headers
    const workspaceId =
      (req.query?.workspaceId as string) ||
      (req.headers?.["x-workspace-id"] as string) ||
      req.params?.workspaceId

    logger.info("workspaceId extraction in auth middleware:", {
      fromQuery: req.query?.workspaceId,
      fromHeaders: req.headers?.["x-workspace-id"],
      fromParams: req.params?.workspaceId,
      result: workspaceId,
      requestPath: req.path,
      url: req.originalUrl,
    })

    // Store the workspaceId if present
    if (workspaceId) {
      ;(req as any).workspaceId = workspaceId
    }

    next()
  } catch (error) {
    logger.error("Auth middleware error:", error)
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}
