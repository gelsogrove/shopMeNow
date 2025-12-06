import { prisma } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
import * as jwt from "jsonwebtoken"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { AppError } from "../middlewares/error.middleware"
import { asyncHandler } from "./async.middleware"

interface JwtPayload {
  id?: string // Per token nuovi
  userId?: string // Per token legacy
  email?: string
  role: string
  iat?: number
  exp?: number
  workspaces?: any // Per supportare i token esistenti
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// Variabili di ambiente
const isTestEnvironment = process.env.NODE_ENV === "test"
const isIntegrationTest = process.env.INTEGRATION_TEST === "true"

/**
 * Middleware di autenticazione che verifica la presenza e validità del token JWT
 */
const authMiddlewareAsync = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In ambiente di test, verifichiamo la presenza di header speciali
    if (isTestEnvironment && isIntegrationTest) {
      // Headers speciali per i test
      const skipAuth = req.headers["x-test-skip-auth"] === "true"
      const forceAuth = req.headers["x-test-auth"] === "true"

      // Se skip auth è impostato, simuliamo un errore 401 per i test
      if (skipAuth) {
        logger.debug(
          "Test environment: Simulating authentication failure due to x-test-skip-auth header"
        )
        throw new AppError(401, "Authentication required")
      }

      // Se force auth è impostato, simuliamo anche un utente di test
      if (forceAuth) {
        logger.debug(
          "Test environment: Using mock authentication due to x-test-auth header"
        )
        req.user = {
          userId: "test-user-id",
          email: "test@example.com",
          role: "ADMIN",
          workspaces: [
            {
              id: req.headers["x-workspace-id"] || "test-workspace-id",
              role: "OWNER",
            },
          ],
        }
        return next()
      }

      // Se i test stanno verificando un webhook (o altri percorsi pubblici), possiamo saltare l'autenticazione
      if (req.path.includes("/webhook")) {
        logger.debug(
          "Test environment: Skipping authentication for webhook path"
        )
        return next()
      }
    }

    // 🔓 PUBLIC ROUTES: Skip authentication for WhatsApp webhooks (use HMAC signature instead)
    if (
      req.path === "/whatsapp/webhook" ||
      req.path.includes("/whatsapp/webhook")
    ) {
      logger.debug(
        "🔓 Skipping auth for WhatsApp webhook (public endpoint with HMAC validation)"
      )
      return next()
    }

    // 🛡️ PRIORITY: Authorization header FIRST, then cookies
    // This ensures that when frontend clears localStorage and sends new token in header,
    // we use the new token instead of stale cookie from previous session
    let token: string | undefined

    // Check Authorization header FIRST (priority)
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]
      if (token && token.trim() !== "") {
        logger.info("Using token from Authorization header")
      } else {
        token = undefined
      }
    }

    // Fallback to cookies only if no header token
    if (!token && req.cookies?.auth_token) {
      token = req.cookies.auth_token
      logger.info("Using token from cookie (no Authorization header)")
    }

    if (!token) {
      logger.info("No token found in headers or cookies")
      throw new AppError(401, "Authentication required")
    }

    try {
      logger.info(`Verifying token: ${token.substring(0, 10)}...`)
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload
      logger.info("Token decoded successfully:", {
        userId: decoded.userId,
        email: decoded.email,
      })

      // Make sure we have a userId
      if (!decoded.userId && !decoded.id) {
        logger.info("Token doesn't have userId or id field")
        throw new AppError(401, "Invalid token format")
      }

      // Normalize userId field
      if (!decoded.userId && decoded.id) {
        decoded.userId = decoded.id
      }
      
      // Also ensure id is set (some controllers use req.user.id)
      if (!decoded.id && decoded.userId) {
        decoded.id = decoded.userId
      }

      // Verify user exists in database and load workspaces
      try {
        // First check if user exists and is not soft-deleted
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, deletedAt: true },
        })

        if (!user) {
          logger.info(`User ${decoded.userId} not found in database`)
          throw new AppError(401, "User not found")
        }

        // 🚫 SOFT-DELETE CHECK: Block deleted users from accessing the system
        if (user.deletedAt !== null) {
          logger.warn(`🚫 Deleted user attempted access: ${user.email}`, {
            deletedAt: user.deletedAt,
          })
          throw new AppError(403, "Your account has been deleted and cannot be accessed")
        }

        logger.info("User found in database:", user.email)

        // Load user workspaces
        const userWorkspaces = await prisma.userWorkspace.findMany({
          where: { userId: decoded.userId },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        })

        logger.info(`Loaded ${userWorkspaces.length} workspaces for user`)

        // Add workspaces to user object
        decoded.workspaces = userWorkspaces.map((uw) => ({
          id: uw.workspace.id,
          name: uw.workspace.name,
          slug: uw.workspace.slug,
          role: uw.role,
        }))

        logger.debug(
          `Loaded ${userWorkspaces.length} workspaces for user ${decoded.userId}`
        )
      } catch (dbError) {
        logger.error("Error loading user or workspaces:", dbError)
        if (dbError instanceof AppError) {
          throw dbError
        }
        throw new AppError(401, "Database error during authentication")
      }

      req.user = decoded
      return next()
    } catch (error) {
      logger.error("❌ Token verification failed:", error)
      logger.error("   Error name:", error.name)
      logger.error("   Error message:", error.message)
      logger.error("   Token (first 30 chars):", token?.substring(0, 30))
      throw new AppError(401, "Invalid token")
    }
  } catch (error) {
    logger.info("Auth middleware error:", error.message)
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(401, "Authentication failed")
  }
}

// Export the wrapped middleware
export const authMiddleware = asyncHandler(authMiddlewareAsync)
