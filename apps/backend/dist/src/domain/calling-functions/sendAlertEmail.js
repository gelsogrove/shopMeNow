"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlertEmail = sendAlertEmail;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Send alert email to workspace admins when Safety Agent detects dangerous content
 * TODO: Integration with email service
 */
function sendAlertEmail(request) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.warn("[SEND_ALERT_EMAIL] ⚠️ Security alert triggered:", request);
            const { workspaceId, customerId, alertType, messageContent, severity, additionalInfo, } = request;
            // Get workspace and customer details
            const workspace = yield database_1.prisma.workspace.findUnique({
                where: { id: workspaceId },
            });
            const customer = yield database_1.prisma.customers.findUnique({
                where: { id: customerId },
            });
            if (!workspace || !customer) {
                logger_1.default.error("[SEND_ALERT_EMAIL] Workspace or customer not found");
                return {
                    success: false,
                    error: "Workspace or customer not found",
                    message: "Impossibile inviare alert. Dati non trovati.",
                };
            }
            // Create alert ID
            const alertId = `ALERT-${Date.now()}-${severity}`;
            // Format alert email content
            const alertEmailContent = {
                to: workspace.notificationEmail || "admin@echatbot.ai", // Fallback to default admin email
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
        This is an automated alert from eChatbot Security System
      `,
            };
            // TODO: Send email via email service
            // const emailService = new EmailService()
            // await emailService.sendAlert(alertEmailContent)
            // For now, just log the alert
            logger_1.default.warn(`[SEND_ALERT_EMAIL] 📧 Alert email would be sent to: ${alertEmailContent.to}`);
            logger_1.default.warn(`[SEND_ALERT_EMAIL] Alert content:`, alertEmailContent);
            // Log to console for immediate visibility
            console.error("\n" + "=".repeat(80));
            console.error(`🚨 SECURITY ALERT [${severity}]: ${alertType}`);
            console.error("=".repeat(80));
            console.error(`Customer: ${customer.name} (${customer.phone})`);
            console.error(`Message: "${messageContent}"`);
            console.error("=".repeat(80) + "\n");
            return {
                success: true,
                message: "Alert inviato al team di sicurezza. Grazie per la segnalazione.",
                alertId: alertId,
            };
        }
        catch (error) {
            logger_1.default.error("[SEND_ALERT_EMAIL] Error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                message: "Errore nell'invio dell'alert. Il problema è stato registrato.",
            };
        }
        finally {
            yield database_1.prisma.$disconnect();
        }
    });
}
/**
 * Get recommended actions based on alert type and severity
 */
function getRecommendedActions(alertType, severity) {
    const actions = {
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
    };
    const baseActions = actions[alertType] || actions.OTHER;
    if (severity === "CRITICAL" || severity === "HIGH") {
        return [
            "🔴 URGENT ACTION REQUIRED",
            ...baseActions,
            "Notify management immediately",
        ].join("\n- ");
    }
    return "- " + baseActions.join("\n- ");
}
//# sourceMappingURL=sendAlertEmail.js.map