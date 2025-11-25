import { PrismaClient } from "@prisma/client"
import { NextFunction, Request, Response } from "express"
import * as jwt from "jsonwebtoken"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { AppError } from "../middlewares/error.middleware"
import { asyncHandler } from "./async.middleware"

const prisma = new PrismaClient()

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

    // Check for token in cookies
    let token = req.cookies?.auth_token

    // Fallback to Authorization header for backward compatibility
    if (!token) {
      logger.info("No token in cookies, checking headers")
      const authHeader = req.headers.authorization
      if (!authHeader) {
        logger.info("No authorization header")
        throw new AppError(401, "Authentication required")
      }

      if (!authHeader.startsWith("Bearer ")) {
        logger.info("Authorization header doesn't start with 'Bearer '")
        throw new AppError(401, "Invalid authorization format")
      }

      token = authHeader.split(" ")[1]

      // Check if token is empty after 'Bearer '
      if (!token || token.trim() === "") {
        logger.info("Empty token in authorization header")
        throw new AppError(401, "Empty authorization token")
      }
    }

    if (!token) {
      logger.info("No token found in cookies or headers")
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

      // Verify user exists in database and load workspaces
      try {
        // First check if user exists
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true },
        })

        if (!user) {
          logger.info(`User ${decoded.userId} not found in database`)
          throw new AppError(401, "User not found")
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
