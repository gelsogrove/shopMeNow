/**
 * Widget API Validation Schemas
 * Zod schemas for request validation
 */

import { z } from "zod"

// ============================================================================
// 🆔 VISITOR ID SCHEMA
// ============================================================================
// Format: visitor_1726262000000_a7k2m9x1
// - Prefix: "visitor_"
// - Timestamp: Unix milliseconds (13 digits)
// - Random hash: 6-10 alphanumeric characters

export const VISITOR_ID_SCHEMA = z
  .string()
  .regex(
    /^visitor_\d{13}_[a-zA-Z0-9]{6,10}$/,
    "Invalid visitor ID format. Expected: visitor_{timestamp}_{hash}"
  )
  .describe("Unique visitor identifier (format: visitor_1726262000000_abc123)")

export const SESSION_ID_SCHEMA = z
  .string()
  .uuid("Invalid session ID format. Expected UUID")
  .nullable()
  .optional()
  .describe("Optional session ID for continuity")

// ============================================================================
// 📨 WIDGET CHAT MESSAGE SCHEMA
// ============================================================================

export const WIDGET_MESSAGE_SCHEMA = z
  .object({
    visitorId: VISITOR_ID_SCHEMA,
    message: z
      .string()
      .min(1, "Message cannot be empty")
      .max(5000, "Message must be less than 5000 characters")
      .trim()
      .describe("Customer message text"),
    phoneNumber: z
      .string()
      .regex(/^\+\d{1,4}\d{6,14}$/, "Invalid phone number format. Expected: +[country_code][number]")
      .optional()
      .describe("Optional phone number with country code (e.g., +39 899 1234567) - used to detect customer language"),
    language: z.string().optional().describe("Optional visitor language"),
    sessionId: SESSION_ID_SCHEMA,
    isPlayground: z.boolean().optional().describe("If true, skip billing/queue and just respond"),
  })
  .strict() // Reject unknown properties
  .describe("Widget chat message")

export type WidgetMessageInput = z.infer<typeof WIDGET_MESSAGE_SCHEMA>

// ============================================================================
// 🔄 WIDGET POLLING SCHEMA
// ============================================================================

export const POLLING_RESPONSE_SCHEMA = z.enum([
  "pending",
  "ready",
  "blocked",
  "error",
])

export const WIDGET_POLLING_SCHEMA = z
  .object({
    status: POLLING_RESPONSE_SCHEMA.describe("Message processing status"),
    message: z
      .string()
      .nullable()
      .describe("Response text if ready, null otherwise"),
    retryAfter: z
      .number()
      .positive()
      .nullable()
      .describe("Milliseconds to wait before next poll (null if ready)"),
    isComplete: z
      .boolean()
      .describe("True if processing is complete (ready or error)"),
  })
  .describe("Polling response")

export type WidgetPollingResponse = z.infer<typeof WIDGET_POLLING_SCHEMA>

// ============================================================================
// ✅ WIDGET SEND MESSAGE RESPONSE SCHEMA
// ============================================================================

export const WIDGET_SEND_RESPONSE_SCHEMA = z
  .object({
    success: z.boolean().describe("Whether message was accepted"),
    messageId: z
      .string()
      .uuid()
      .describe("Unique message identifier for polling"),
    status: z
      .enum(["pending", "sent", "error"])
      .describe("Current message status"),
    retryAfter: z
      .number()
      .positive()
      .optional()
      .describe("Milliseconds to wait before retrying (if error)"),
  })
  .describe("Response after sending widget message")

export type WidgetSendResponse = z.infer<typeof WIDGET_SEND_RESPONSE_SCHEMA>

// ============================================================================
// 🚨 ERROR RESPONSE SCHEMA
// ============================================================================

export const ERROR_RESPONSE_SCHEMA = z
  .object({
    error: z.string().describe("Error code (e.g., 'RATE_LIMITED', 'INVALID_INPUT')"),
    message: z.string().describe("Human-readable error message"),
    details: z
      .record(z.string(), z.any())
      .optional()
      .describe("Additional error details"),
    retryAfter: z
      .number()
      .optional()
      .describe("Milliseconds to wait before retrying (for rate limits)"),
  })
  .describe("Error response")

export type ErrorResponse = z.infer<typeof ERROR_RESPONSE_SCHEMA>

// ============================================================================
// 🔐 SECURITY CHECK RESULTS
// ============================================================================

export const SECURITY_CHECK_RESULT_SCHEMA = z.object({
  step: z.enum([
    "RATE_LIMIT",
    "CONTENT_SAFETY",
    "BUSINESS_RULES",
    "CHANNEL_VALIDATION",
    "ANTI_SPAM",
  ]),
  passed: z.boolean(),
  reason: z.string().optional(),
  retryAfter: z.number().optional(),
})

export type SecurityCheckResult = z.infer<typeof SECURITY_CHECK_RESULT_SCHEMA>
