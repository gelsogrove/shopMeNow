import { NextFunction, Request, Response } from "express"
import logger from "../utils/logger"

/**
 * Middleware to validate workspace operations
 * Ensures sessionId and workspaceId are present and valid
 */
export const validateWorkspaceOperation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Validate sessionId (mandatory for workspace operations)
    const sessionId = req.headers["x-session-id"] as string

    if (!sessionId || sessionId.trim() === "") {
      logger.warn("Workspace operation rejected: missing sessionId")
      res.status(401).json({
        error: "Unauthorized",
        message: "Session ID is required for workspace operations",
      })
      return
    }

    // 2. Validate workspaceId (from route params or body)
    const workspaceId = req.params.id || req.body.id

    if (!workspaceId || workspaceId.trim() === "") {
      logger.warn("Workspace operation rejected: missing workspaceId")
      res.status(400).json({
        error: "Bad Request",
        message: "Workspace ID is required",
      })
      return
    }

    // 3. Attach to request for downstream use
    ;(req as any).sessionId = sessionId
    ;(req as any).workspaceId = workspaceId

    logger.info(
      `✅ Workspace validation passed - workspaceId: ${workspaceId.substring(0, 8)}..., sessionId: ${sessionId.substring(0, 8)}...`
    )

    next()
  } catch (error) {
    logger.error("Error in workspace validation middleware:", error)
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to validate workspace operation",
    })
    return
  }
}

/**
 * Middleware to validate workspace update data
 * Validates email format, phone number format, and required fields
 */
export const validateWorkspaceUpdateData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { adminEmail, whatsappPhoneNumber, name, url } = req.body

    const errors: string[] = []

    // 1. Validate adminEmail format (if provided)
    if (adminEmail !== undefined && adminEmail !== null) {
      if (typeof adminEmail !== "string" || adminEmail.trim() === "") {
        errors.push("Admin email cannot be empty")
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        errors.push("Admin email must be a valid email address")
      }
    }

    // 2. Validate whatsappPhoneNumber format (if provided)
    if (
      whatsappPhoneNumber !== undefined &&
      whatsappPhoneNumber !== null &&
      whatsappPhoneNumber !== ""
    ) {
      // Remove spaces and check format: should start with + and contain only digits
      const cleanPhone = whatsappPhoneNumber.replace(/\s/g, "")
      if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
        errors.push(
          "WhatsApp phone number must be in international format (e.g., +1234567890) with 10-15 digits"
        )
      }
    }

    // 3. Validate name (if provided)
    if (name !== undefined && name !== null) {
      if (typeof name !== "string" || name.trim() === "") {
        errors.push("Workspace name cannot be empty")
      } else if (name.length < 2 || name.length > 100) {
        errors.push("Workspace name must be between 2 and 100 characters")
      }
    }

    // 4. Validate URL format (if provided)
    if (url !== undefined && url !== null && url !== "") {
      try {
        new URL(url)
      } catch {
        errors.push(
          "Workspace URL must be a valid URL (e.g., http://localhost:3000)"
        )
      }
    }

    // 5. Validate boolean fields (if provided)
    if (
      req.body.isActive !== undefined &&
      typeof req.body.isActive !== "boolean"
    ) {
      errors.push("isActive must be a boolean value")
    }

    if (
      req.body.debugMode !== undefined &&
      typeof req.body.debugMode !== "boolean"
    ) {
      errors.push("debugMode must be a boolean value")
    }

    // 6. If errors found, return bad request
    if (errors.length > 0) {
      logger.warn(`Workspace update validation failed: ${errors.join(", ")}`)
      res.status(400).json({
        error: "Validation Error",
        message: "Invalid workspace data",
        details: errors,
      })
      return
    }

    logger.info("✅ Workspace update data validation passed")
    next()
  } catch (error) {
    logger.error("Error in workspace update validation middleware:", error)
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to validate workspace update data",
    })
    return
  }
}
