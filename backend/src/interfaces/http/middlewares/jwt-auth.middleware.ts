import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import logger from "../../../utils/logger"

interface JWTPayload {
  clientId: string
  workspaceId: string
  scope: string
  orderCode?: string
  iat?: number
  exp?: number
}

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens from query params or Authorization header
 * Uses proper JWT signature verification with JWT_SECRET
 */
export const jwtAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Token is required"
      })
      return
    }

    // Verify JWT token with proper signature validation
    const payload = await verifyJWTToken(token)
    
    if (!payload) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token"
      })
      return
    }

    // Add payload to request for use in controllers
    ;(req as any).jwtPayload = payload
    
    next()
  } catch (error) {
    logger.error("[JWT-AUTH] Middleware error:", error)
    res.status(500).json({
      success: false,
      error: "Authentication error"
    })
  }
}

/**
 * Verify JWT token with signature validation
 * Uses JWT_SECRET from environment for verification
 * 
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
async function verifyJWTToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET
    
    if (!secret) {
      logger.error("[JWT-AUTH] JWT_SECRET not configured")
      return null
    }

    // Verify JWT with signature validation
    const decoded = jwt.verify(token, secret) as JWTPayload
    
    // Additional validation: ensure required fields exist
    if (!decoded.clientId || !decoded.workspaceId || !decoded.scope) {
      logger.error("[JWT-AUTH] Token missing required fields")
      return null
    }
    
    return decoded
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn("[JWT-AUTH] Token expired")
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn("[JWT-AUTH] Invalid token signature")
    } else {
      logger.error("[JWT-AUTH] Token verification error:", error)
    }
    return null
  }
}
