/**
 * handlePushNotifications - LLM-Callable Function (Router Alias)
 *
 * Alias for manageNotifications - used by Router Agent for function calling.
 * Router calls "handlePushNotifications", which delegates to manageNotifications.
 *
 * Why separate name?
 * - Router Agent expects "handlePushNotifications" in function calling schema
 * - Internal implementation uses "manageNotifications" for consistency
 * - This file acts as bridge/adapter between Router and domain logic
 *
 * Use cases:
 * - "Non voglio più ricevere notifiche"
 * - "Voglio iscrivermi alle offerte"
 * - "Come faccio a disabilitare le push?"
 *
 * @see manageNotifications.ts - Core implementation
 * @see docs/architecture/multi-agent-flow.md - Router function calling
 */

import {
  manageNotifications,
  ManageNotificationsRequest,
  ManageNotificationsResult,
} from "./manageNotifications"

export interface HandlePushNotificationsRequest {
  action: "enable" | "disable" | "status" // User-friendly names
  customerId: string
  workspaceId: string
}

export interface HandlePushNotificationsResult {
  success: boolean
  action: "enable" | "disable" | "status"
  message: string
  currentStatus: boolean
  timestamp: string
  error?: string
}

/**
 * Handle push notification subscription (Router-facing function)
 *
 * Maps user-friendly actions (enable/disable/status) to SUBSCRIBE/UNSUBSCRIBE
 * and delegates to manageNotifications core implementation.
 *
 * @param request - Request with action (enable/disable/status)
 * @returns Result with confirmation message and current status
 */
export async function handlePushNotifications(
  request: HandlePushNotificationsRequest
): Promise<HandlePushNotificationsResult> {
  // Map user-friendly actions to internal actions
  let internalAction: "SUBSCRIBE" | "UNSUBSCRIBE"

  if (request.action === "enable") {
    internalAction = "SUBSCRIBE"
  } else if (request.action === "disable") {
    internalAction = "UNSUBSCRIBE"
  } else if (request.action === "status") {
    // Special case: just return current status without changing
    const { prisma } = require("@echatbot/database")
    const customer = await prisma.customers.findFirst({
      where: {
        id: request.customerId,
        workspaceId: request.workspaceId,
      },
      select: {
        push_notifications_consent: true,
      },
    })

    if (!customer) {
      return {
        success: false,
        action: "status",
        message: "Customer not found.",
        currentStatus: false,
        timestamp: new Date().toISOString(),
        error: "Customer not found",
      }
    }

    const isEnabled = customer.push_notifications_consent || false
    return {
      success: true,
      action: "status",
      message: isEnabled
        ? "✅ You are currently subscribed to push notifications."
        : "❌ You are currently NOT subscribed to push notifications.",
      currentStatus: isEnabled,
      timestamp: new Date().toISOString(),
    }
  } else {
    return {
      success: false,
      action: request.action,
      message: "Invalid action. Use 'enable', 'disable', or 'status'.",
      currentStatus: false,
      timestamp: new Date().toISOString(),
      error: "Invalid action parameter",
    }
  }

  // Delegate to manageNotifications core function
  const internalRequest: ManageNotificationsRequest = {
    action: internalAction,
    customerId: request.customerId,
    workspaceId: request.workspaceId,
  }

  const result: ManageNotificationsResult = await manageNotifications(internalRequest)

  // Map result back to user-friendly format
  return {
    success: result.success,
    action: result.action === "SUBSCRIBE" ? "enable" : "disable",
    message: result.message,
    currentStatus: result.currentStatus,
    timestamp: result.timestamp,
    error: result.error,
  }
}
