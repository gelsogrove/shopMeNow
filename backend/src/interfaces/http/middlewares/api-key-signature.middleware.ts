/**
 * 🔒 API KEY + HMAC SIGNATURE AUTHENTICATION
 *
 * BLINDATURA TOTALE per sendMessage API:
 *
 * Ogni richiesta DEVE avere:
 * 1. X-Api-Key: chiave univoca per workspace
 * 2. X-Signature: HMAC SHA256 di (timestamp + body)
 * 3. X-Timestamp: timestamp richiesta (max 5 min differenza)
 *
 * Previene:
 * - Replay attacks (timestamp validation)
 * - Man-in-the-middle (HMAC signature)
 * - API key leakage (signature diversa ogni volta)
 * - Unauthorized access (API key required)
 *
 * @author Andrea Gelso
 * @date 2025-01-13
 */

import { PrismaClient } from "@prisma/client"
import crypto from "crypto"
import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()

// Configuration
const SIGNATURE_MAX_AGE = 5 * 60 * 1000 // 5 minutes
const SIGNATURE_ALGORITHM = "sha256"

/**
 * Generate API Key for workspace
 * Should be called when creating workspace or manually by admin
 */
export async function generateApiKey(workspaceId: string): Promise<string> {
  // Generate cryptographically secure random key
  const apiKey = crypto.randomBytes(32).toString("hex")
  const apiSecret = crypto.randomBytes(32).toString("hex")

  // Save to database
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      apiKey: apiKey,
      apiSecret: apiSecret, // ⚠️ NEVER expose this to client!
    },
  })

  logger.info(`🔑 Generated API key for workspace ${workspaceId}`)

  return apiKey // Return only API key, NOT secret
}

/**
 * Generate HMAC signature for request
 *
 * Client-side function (also used in tests)
 */
export function generateSignature(
  apiSecret: string,
  timestamp: string,
  method: string,
  path: string,
  body: any
): string {
  // Concatenate all request data
  const payload = `${timestamp}:${method}:${path}:${JSON.stringify(body)}`

  // Generate HMAC SHA256 signature
  const hmac = crypto.createHmac(SIGNATURE_ALGORITHM, apiSecret)
  hmac.update(payload)
  const signature = hmac.digest("hex")

  return signature
}

/**
 * Verify HMAC signature
 */
function verifySignature(
  apiSecret: string,
  timestamp: string,
  method: string,
  path: string,
  body: any,
  providedSignature: string
): boolean {
  // Generate expected signature
  const expectedSignature = generateSignature(
    apiSecret,
    timestamp,
    method,
    path,
    body
  )

  // Constant-time comparison (prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  )
}

/**
 * Middleware: Verify API Key + HMAC Signature
 *
 * MUST be applied to ALL sendMessage endpoints
 */
export async function apiKeySignatureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract headers
    const apiKey = req.headers["x-api-key"] as string
    const signature = req.headers["x-signature"] as string
    const timestamp = req.headers["x-timestamp"] as string

    // VALIDATION 1: All headers present
    if (!apiKey || !signature || !timestamp) {
      logger.warn("🚨 [API-AUTH] Missing authentication headers", {
        ip: req.ip,
        path: req.path,
        hasApiKey: !!apiKey,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      })

      res.status(401).json({
        error: "Authentication required",
        message: "Missing X-Api-Key, X-Signature, or X-Timestamp headers",
        required: {
          "X-Api-Key": "Your workspace API key",
          "X-Signature": "HMAC SHA256 signature",
          "X-Timestamp": "Current timestamp (ISO 8601)",
        },
      })
      return
    }

    // VALIDATION 2: Timestamp not too old (prevent replay attacks)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()
    const timeDiff = Math.abs(now - requestTime)

    if (timeDiff > SIGNATURE_MAX_AGE) {
      logger.warn("🚨 [API-AUTH] Timestamp too old - possible replay attack", {
        ip: req.ip,
        path: req.path,
        timestamp: timestamp,
        timeDiff: timeDiff / 1000, // seconds
        maxAge: SIGNATURE_MAX_AGE / 1000,
      })

      res.status(401).json({
        error: "Request expired",
        message: `Timestamp too old (max ${SIGNATURE_MAX_AGE / 1000} seconds)`,
        timeDiff: timeDiff / 1000,
        maxAge: SIGNATURE_MAX_AGE / 1000,
      })
      return
    }

    // VALIDATION 3: Get workspace by API key
    const workspace = await prisma.workspace.findFirst({
      where: { apiKey: apiKey },
      select: {
        id: true,
        name: true,
        apiKey: true,
        apiSecret: true,
        isActive: true,
      },
    })

    if (!workspace) {
      logger.warn("🚨 [API-AUTH] Invalid API key", {
        ip: req.ip,
        path: req.path,
        apiKey: apiKey.substring(0, 10) + "...", // Only first 10 chars
      })

      res.status(401).json({
        error: "Invalid API key",
        message: "API key not found or invalid",
      })
      return
    }

    // VALIDATION 4: Workspace active
    if (!workspace.isActive) {
      logger.warn("🚨 [API-AUTH] Workspace suspended", {
        ip: req.ip,
        path: req.path,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      })

      res.status(403).json({
        error: "Workspace suspended",
        message: "Your workspace has been suspended. Contact support.",
      })
      return
    }

    // VALIDATION 5: Verify HMAC signature
    const isValidSignature = verifySignature(
      workspace.apiSecret,
      timestamp,
      req.method,
      req.path,
      req.body,
      signature
    )

    if (!isValidSignature) {
      logger.error(
        "🚨 [API-AUTH] Invalid HMAC signature - possible tampering",
        {
          ip: req.ip,
          path: req.path,
          workspaceId: workspace.id,
          method: req.method,
          timestamp: timestamp,
          providedSignature: signature.substring(0, 10) + "...",
        }
      )

      res.status(401).json({
        error: "Invalid signature",
        message: "HMAC signature verification failed",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                expectedPayload: `${timestamp}:${req.method}:${req.path}:${JSON.stringify(req.body)}`,
                algorithm: SIGNATURE_ALGORITHM,
              }
            : undefined,
      })
      return
    }

    // ✅ ALL VALIDATIONS PASSED

    logger.info("🔒 [API-AUTH] ✅ Authentication successful", {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      path: req.path,
      method: req.method,
    })

    // Inject workspace into request for downstream handlers
    ;(req as any).authenticatedWorkspace = {
      id: workspace.id,
      name: workspace.name,
    }

    next()
  } catch (error: any) {
    logger.error("🚨 [API-AUTH] Error verifying authentication:", {
      error: error.message,
      stack: error.stack,
      path: req.path,
    })

    res.status(500).json({
      error: "Authentication error",
      message: "Internal error during authentication",
    })
  }
}

/**
 * Generate signature example for documentation
 */
export function getSignatureExample(
  apiSecret: string,
  workspaceId: string,
  customerId: string,
  phoneNumber: string,
  message: string
): {
  headers: Record<string, string>
  body: any
  signature: string
} {
  const timestamp = new Date().toISOString()
  const method = "POST"
  const path = "/api/whatsapp/send"
  const body = {
    workspaceId,
    customerId,
    phoneNumber,
    message,
  }

  const signature = generateSignature(apiSecret, timestamp, method, path, body)

  return {
    headers: {
      "X-Api-Key": "[YOUR_API_KEY]",
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      "Content-Type": "application/json",
    },
    body,
    signature,
  }
}

/**
 * Rotate API keys (security best practice - every 90 days)
 */
export async function rotateApiKey(
  workspaceId: string
): Promise<{ oldKey: string; newKey: string }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { apiKey: true },
  })

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const oldKey = workspace.apiKey
  const newKey = await generateApiKey(workspaceId)

  logger.info(`🔑 Rotated API key for workspace ${workspaceId}`)

  return { oldKey: oldKey || "", newKey }
}
