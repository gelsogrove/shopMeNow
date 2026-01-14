/**
 * Standardized Error Formatter for Widget API
 * 
 * Ensures consistent error responses across all widget endpoints
 * Follows HTTP status codes and includes retry information
 */

import { Response } from "express"
import logger from "../../../utils/logger"

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface StandardError {
  code: string // Machine-readable error code
  message: string // Human-readable message
  statusCode: number // HTTP status code
  details?: Record<string, any> // Additional context
  retryAfter?: number // Milliseconds to wait before retry
}

export class WidgetApiError extends Error implements StandardError {
  code: string
  message: string
  statusCode: number
  details?: Record<string, any>
  retryAfter?: number

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, any>,
    retryAfter?: number
  ) {
    super(message)
    this.code = code
    this.message = message
    this.statusCode = statusCode
    this.details = details
    this.retryAfter = retryAfter
    this.name = "WidgetApiError"
  }
}

// ============================================================================
// PREDEFINED ERRORS
// ============================================================================

export const WIDGET_ERRORS = {
  // 400 Bad Request
  INVALID_VISITOR_ID: new WidgetApiError(
    "INVALID_VISITOR_ID",
    "Invalid visitor ID format. Expected: visitor_{timestamp}_{hash}",
    400
  ),
  INVALID_MESSAGE: new WidgetApiError(
    "INVALID_MESSAGE",
    "Message cannot be empty or exceed 5000 characters",
    400
  ),
  INVALID_WORKSPACE_ID: new WidgetApiError(
    "INVALID_WORKSPACE_ID",
    "Invalid or missing workspace ID",
    400
  ),

  // 401 Unauthorized
  UNAUTHORIZED: new WidgetApiError(
    "UNAUTHORIZED",
    "Unauthorized access. Valid session required.",
    401
  ),

  // 403 Forbidden
  WORKSPACE_DISABLED: new WidgetApiError(
    "WORKSPACE_DISABLED",
    "This workspace is currently disabled",
    403
  ),
  WIDGET_DISABLED: new WidgetApiError(
    "WIDGET_DISABLED",
    "Widget is disabled for this workspace",
    403
  ),
  CHAT_BLOCKED: new WidgetApiError(
    "CHAT_BLOCKED",
    "Chat is temporarily unavailable. Please try again later.",
    403,
    undefined,
    3600000 // 1 hour
  ),

  // 429 Too Many Requests
  RATE_LIMITED: (retryAfter: number = 60000) =>
    new WidgetApiError(
      "RATE_LIMITED",
      `Too many requests. Please try again after ${Math.ceil(retryAfter / 1000)} seconds.`,
      429,
      { limit: 10, window: "1 minute" },
      retryAfter
    ),

  // 400 Business Rule Violations
  MAINTENANCE_MODE: new WidgetApiError(
    "MAINTENANCE_MODE",
    "Service is under maintenance. Please try again later.",
    403,
    undefined,
    1800000 // 30 minutes
  ),
  OUTSIDE_BUSINESS_HOURS: new WidgetApiError(
    "OUTSIDE_BUSINESS_HOURS",
    "Chat is only available during business hours",
    403
  ),
  CONTENT_UNSAFE: new WidgetApiError(
    "CONTENT_UNSAFE",
    "Your message contains unsafe content and cannot be processed",
    400,
    { reason: "Content safety check failed" }
  ),
  SPAM_DETECTED: new WidgetApiError(
    "SPAM_DETECTED",
    "Duplicate or spam message detected",
    400,
    { reason: "Anti-spam filter triggered" }
  ),

  // 404 Not Found
  MESSAGE_NOT_FOUND: new WidgetApiError(
    "MESSAGE_NOT_FOUND",
    "Message not found or has expired",
    404
  ),
  SESSION_NOT_FOUND: new WidgetApiError(
    "SESSION_NOT_FOUND",
    "Session not found or has expired",
    404
  ),

  // 408 Request Timeout
  POLLING_TIMEOUT: new WidgetApiError(
    "POLLING_TIMEOUT",
    "Response generation timed out. Message processing was cancelled.",
    408
  ),

  // 500 Internal Server Error
  INTERNAL_ERROR: new WidgetApiError(
    "INTERNAL_ERROR",
    "An internal server error occurred. Please try again later.",
    500
  ),
  LLM_ERROR: new WidgetApiError(
    "LLM_ERROR",
    "AI model error. Please try again later.",
    503,
    undefined,
    5000
  ),

  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: new WidgetApiError(
    "SERVICE_UNAVAILABLE",
    "Service is temporarily unavailable. Please try again later.",
    503,
    undefined,
    30000 // 30 seconds
  ),
}

// ============================================================================
// ERROR FORMATTER
// ============================================================================

/**
 * Format and send error response
 * Ensures consistent structure across all widget endpoints
 */
export function formatErrorResponse(
  res: Response,
  error: StandardError | WidgetApiError | Error
): Response {
  let statusCode = 500
  let code = "INTERNAL_ERROR"
  let message = "An unexpected error occurred"
  let details: Record<string, any> | undefined
  let retryAfter: number | undefined

  // Handle WidgetApiError
  if (error instanceof WidgetApiError) {
    statusCode = error.statusCode
    code = error.code
    message = error.message
    details = error.details
    retryAfter = error.retryAfter
  }
  // Handle StandardError interface
  else if ("statusCode" in error && "code" in error) {
    const stdError = error as StandardError
    statusCode = stdError.statusCode
    code = stdError.code
    message = stdError.message
    details = stdError.details
    retryAfter = stdError.retryAfter
  }
  // Handle Zod validation errors
  else if ("issues" in error) {
    statusCode = 400
    code = "VALIDATION_ERROR"
    message = "Request validation failed"
    const issues = (error as any).issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))
    details = { validation_errors: issues }
  }
  // Log unexpected errors
  else {
    logger.error("Unexpected error in widget API:", error)
  }

  // Add retry-after header if applicable
  if (retryAfter) {
    res.set("Retry-After", Math.ceil(retryAfter / 1000).toString())
  }

  // Build response
  const response: Record<string, any> = {
    error: code,
    message: message,
  }

  if (details) {
    response.details = details
  }

  if (retryAfter) {
    response.retryAfter = retryAfter
  }

  // Log error (redact sensitive info)
  const logData = { ...response }
  if (logData.details?.message) {
    delete logData.details.message
  }
  logger.warn(`Widget API Error [${code}]:`, logData)

  return res.status(statusCode).json(response)
}

// ============================================================================
// ERROR CATCHING MIDDLEWARE
// ============================================================================

/**
 * Express middleware to catch and format errors
 * Should be the last middleware in the stack
 */
export function widgetErrorMiddleware(
  err: any,
  _req: any,
  res: Response,
  _next: any
) {
  if (res.headersSent) {
    return _next(err)
  }

  formatErrorResponse(res, err)
}

// ============================================================================
// SECURITY ERROR HELPERS
// ============================================================================

export function createRateLimitError(retryAfterMs: number): WidgetApiError {
  return WIDGET_ERRORS.RATE_LIMITED(retryAfterMs)
}

export function createValidationError(
  field: string,
  message: string
): WidgetApiError {
  return new WidgetApiError(
    "VALIDATION_ERROR",
    `Validation error in ${field}: ${message}`,
    400,
    { field, message }
  )
}

export function createSecurityError(
  code: string,
  message: string,
  retryAfter?: number
): WidgetApiError {
  return new WidgetApiError(code, message, 403, {}, retryAfter)
}
