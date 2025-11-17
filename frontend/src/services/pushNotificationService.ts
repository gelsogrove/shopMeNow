import { logger } from "@/lib/logger"
import { api } from "./api"

/**
 * System notification types matching backend enum
 */
export enum SystemNotificationType {
  CHATBOT_REACTIVATED = "CHATBOT_REACTIVATED",
  ACCOUNT_ACTIVATED = "ACCOUNT_ACTIVATED",
  DISCOUNT_CHANGED = "DISCOUNT_CHANGED",
}

/**
 * Template data for different notification types
 */
export interface NotificationTemplateData {
  discountPercentage?: number
  [key: string]: any
}

/**
 * Request payload for system notification
 */
export interface SystemNotificationRequest {
  type: SystemNotificationType
  customerIds: string[]
  templateData?: NotificationTemplateData
}

/**
 * Response from system notification endpoint
 */
export interface SystemNotificationResponse {
  success: boolean
  sent: number
  failed: number
  errors: string[]
}

/**
 * 📱 Push Notification Service
 *
 * Centralized service for sending system notifications to customers.
 * All system notifications go through unified endpoint with different types.
 *
 * @author Andrea Gelso
 */
export const pushNotificationService = {
  /**
   * Send system notification to customers
   *
   * @param workspaceId - Workspace UUID
   * @param request - Notification request with type, customerIds, and optional template data
   * @returns Promise with notification results
   *
   * @example
   * ```ts
   * // Chatbot reactivation
   * await pushNotificationService.sendNotification(workspaceId, {
   *   type: SystemNotificationType.CHATBOT_REACTIVATED,
   *   customerIds: ["customer-uuid"]
   * })
   *
   * // Discount change
   * await pushNotificationService.sendNotification(workspaceId, {
   *   type: SystemNotificationType.DISCOUNT_CHANGED,
   *   customerIds: ["customer-uuid"],
   *   templateData: { discountPercentage: 15 }
   * })
   * ```
   */
  async sendNotification(
    workspaceId: string,
    request: SystemNotificationRequest
  ): Promise<SystemNotificationResponse> {
    try {
      logger.info(
        `[PushNotificationService] Sending ${request.type} to ${request.customerIds.length} customer(s)`,
        { workspaceId, ...request }
      )

      const response = await api.post<SystemNotificationResponse>(
        `/workspaces/${workspaceId}/push/system-notification`,
        request
      )

      logger.info(
        `[PushNotificationService] ✅ Sent: ${response.data.sent}, Failed: ${response.data.failed}`
      )

      return response.data
    } catch (error) {
      logger.error(
        "[PushNotificationService] ❌ Error sending notification:",
        error
      )
      throw error
    }
  },

  /**
   * Send chatbot reactivation notification
   *
   * @param workspaceId - Workspace UUID
   * @param customerIds - Array of customer UUIDs
   */
  async sendChatbotReactivation(
    workspaceId: string,
    customerIds: string[]
  ): Promise<SystemNotificationResponse> {
    return this.sendNotification(workspaceId, {
      type: SystemNotificationType.CHATBOT_REACTIVATED,
      customerIds,
    })
  },

  /**
   * Send account activation notification
   *
   * @param workspaceId - Workspace UUID
   * @param customerIds - Array of customer UUIDs
   */
  async sendAccountActivation(
    workspaceId: string,
    customerIds: string[]
  ): Promise<SystemNotificationResponse> {
    return this.sendNotification(workspaceId, {
      type: SystemNotificationType.ACCOUNT_ACTIVATED,
      customerIds,
    })
  },

  /**
   * Send discount change notification
   *
   * @param workspaceId - Workspace UUID
   * @param customerIds - Array of customer UUIDs
   * @param discountPercentage - New discount percentage
   */
  async sendDiscountChange(
    workspaceId: string,
    customerIds: string[],
    discountPercentage: number
  ): Promise<SystemNotificationResponse> {
    return this.sendNotification(workspaceId, {
      type: SystemNotificationType.DISCOUNT_CHANGED,
      customerIds,
      templateData: { discountPercentage },
    })
  },
}
