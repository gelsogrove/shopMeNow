import { PrismaClient } from "@prisma/client"
import logger from "../../utils/logger"

const prisma = new PrismaClient()

export type AlertType =
  | "INAPPROPRIATE_CONTENT"
  | "SCAM_ATTEMPT"
  | "HARASSMENT"
  | "SPAM"
  | "OTHER"

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface SendAlertEmailRequest {
  workspaceId: string
  customerId: string
  alertType: AlertType
  messageContent: string
  severity: AlertSeverity
  additionalInfo?: string
}

export interface SendAlertEmailResponse {
  success: boolean
  message?: string
  alertId?: string
  error?: string
}

/**
 * Send alert email to workspace admins when Safety Agent detects dangerous content
 * TODO: Integration with email service
 */
export async function sendAlertEmail(
  request: SendAlertEmailRequest
): Promise<SendAlertEmailResponse> {
  try {
    logger.warn("[SEND_ALERT_EMAIL] ⚠️ Security alert triggered:", request)

    const {
      workspaceId,
      customerId,
      alertType,
      messageContent,
      severity,
      additionalInfo,
    } = request

    // Get workspace and customer details
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    })

    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    })

    if (!workspace || !customer) {
      logger.error("[SEND_ALERT_EMAIL] Workspace or customer not found")
      return {
        success: false,
        error: "Workspace or customer not found",
        message: "Impossibile inviare alert. Dati non trovati.",
      }
    }

    // Create alert ID
    const alertId = `ALERT-${Date.now()}-${severity}`

    // Format alert email content
    const alertEmailContent = {
      to: workspace.notificationEmail || "admin@shopme.com", // Fallback to default admin email
      subject: `🚨 Security Alert [${severity}]: ${alertType}`,
      body: `
        Security Alert Report
        =====================
        
        Alert ID: ${alertId}
        Severity: ${severity}
        Type: ${alertType}
        Timestamp: ${new Date().toISOString()}
        
        Workspace Details:
        ------------------
        Name: ${workspace.name}
        ID: ${workspace.id}
        
        Customer Details:
        -----------------
        Name: ${customer.name}
        Phone: ${customer.phone}
        ID: ${customer.id}
        
        Message Content:
        ----------------
        "${messageContent}"
        
        ${additionalInfo ? `Additional Info:\n${additionalInfo}` : ""}
        
        Recommended Actions:
        --------------------
        ${getRecommendedActions(alertType, severity)}
        
        ---
        This is an automated alert from ShopME Security System
      `,
    }

    // TODO: Send email via email service
    // const emailService = new EmailService()
    // await emailService.sendAlert(alertEmailContent)

    // For now, just log the alert
    logger.warn(
      `[SEND_ALERT_EMAIL] 📧 Alert email would be sent to: ${alertEmailContent.to}`
    )
    logger.warn(`[SEND_ALERT_EMAIL] Alert content:`, alertEmailContent)

    // Log to console for immediate visibility
    console.error("\n" + "=".repeat(80))
    console.error(`🚨 SECURITY ALERT [${severity}]: ${alertType}`)
    console.error("=".repeat(80))
    console.error(`Customer: ${customer.name} (${customer.phone})`)
    console.error(`Message: "${messageContent}"`)
    console.error("=".repeat(80) + "\n")

    return {
      success: true,
      message:
        "Alert inviato al team di sicurezza. Grazie per la segnalazione.",
      alertId: alertId,
    }
  } catch (error) {
    logger.error("[SEND_ALERT_EMAIL] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Errore nell'invio dell'alert. Il problema è stato registrato.",
    }
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Get recommended actions based on alert type and severity
 */
function getRecommendedActions(
  alertType: AlertType,
  severity: AlertSeverity
): string {
  const actions: { [key: string]: string[] } = {
    INAPPROPRIATE_CONTENT: [
      "Review conversation history",
      "Warn customer if first offense",
      "Suspend account if repeated offense",
    ],
    SCAM_ATTEMPT: [
      "IMMEDIATE: Block customer account",
      "Report to authorities if necessary",
      "Review payment attempts",
    ],
    HARASSMENT: [
      "Block customer immediately",
      "Document all interactions",
      "Consider legal action if severe",
    ],
    SPAM: [
      "Flag account for review",
      "Apply rate limiting",
      "Block if automated bot detected",
    ],
    OTHER: [
      "Manual review required",
      "Document incident",
      "Take appropriate action",
    ],
  }

  const baseActions = actions[alertType] || actions.OTHER

  if (severity === "CRITICAL" || severity === "HIGH") {
    return [
      "🔴 URGENT ACTION REQUIRED",
      ...baseActions,
      "Notify management immediately",
    ].join("\n- ")
  }

  return "- " + baseActions.join("\n- ")
}
