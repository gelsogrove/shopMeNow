"use strict";
/**
 * ManageNotifications - LLM-Callable Function
 *
 * Gestisce la sottoscrizione/cancellazione alle notifiche push via WhatsApp.
 * Utilizzata quando l'utente scrive: "SUBSCRIBE", "UNSUBSCRIBE"
 *
 * IMPORTANTE:
 * - Keywords SUBSCRIBE/UNSUBSCRIBE non vengono mai tradotte (sempre uppercase)
 * - Il messaggio di invito viene mostrato SOLO se push_notifications_consent = false
 * - Utenti già iscritti NON vedono mai suggerimenti di disiscriversi nel chatbot
 * - Link UNSUBSCRIBE appare SOLO nei messaggi push schedulati (campagne marketing)
 *
 * @see docs/prompt_agent.md - Priority 4.5: Definizione della calling function
 */
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
exports.manageNotifications = manageNotifications;
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("@echatbot/database");
/**
 * Manages push notification subscription for customer
 *
 * @param request - Request with action (SUBSCRIBE/UNSUBSCRIBE)
 * @returns Result with confirmation message and current status
 */
function manageNotifications(request) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.info("🔔 ManageNotifications called with:", {
                action: request.action,
                customerId: request.customerId,
                workspaceId: request.workspaceId,
            });
            // Validate action
            if (request.action !== "SUBSCRIBE" && request.action !== "UNSUBSCRIBE") {
                return {
                    success: false,
                    action: request.action,
                    message: "Invalid action. Use SUBSCRIBE or UNSUBSCRIBE.",
                    currentStatus: false,
                    timestamp: new Date().toISOString(),
                    error: "Invalid action parameter",
                };
            }
            // Import Prisma to update customer
            try {
                // Find customer by ID and workspace (security validation)
                const customer = yield database_1.prisma.customers.findFirst({
                    where: {
                        id: request.customerId,
                        workspaceId: request.workspaceId,
                    },
                });
                if (!customer) {
                    logger_1.default.error("❌ Customer not found:", {
                        customerId: request.customerId,
                        workspaceId: request.workspaceId,
                    });
                    return {
                        success: false,
                        action: request.action,
                        message: "Customer not found or workspace mismatch.",
                        currentStatus: false,
                        timestamp: new Date().toISOString(),
                        error: "Customer not found",
                    };
                }
                // Check current status
                const currentStatus = customer.push_notifications_consent || false;
                const desiredStatus = request.action === "SUBSCRIBE";
                // If already in desired state, inform user
                if (currentStatus === desiredStatus) {
                    const alreadyMessage = request.action === "SUBSCRIBE"
                        ? "✅ You are already subscribed to push notifications! You will receive exclusive offers and updates."
                        : "✅ You are already unsubscribed from push notifications.";
                    logger_1.default.info("ℹ️ Customer already in desired state:", {
                        customerId: request.customerId,
                        action: request.action,
                        currentStatus,
                    });
                    return {
                        success: true,
                        action: request.action,
                        message: alreadyMessage,
                        currentStatus,
                        timestamp: new Date().toISOString(),
                    };
                }
                // Update customer subscription status
                const updatedCustomer = yield database_1.prisma.customers.update({
                    where: { id: request.customerId },
                    data: {
                        push_notifications_consent: desiredStatus,
                        push_notifications_consent_at: new Date(), // GDPR compliance timestamp
                    },
                });
                const successMessage = request.action === "SUBSCRIBE"
                    ? "✅ Perfect! You are now subscribed to push notifications. 🎉\n\nYou will receive exclusive offers, product updates, and special promotions directly via WhatsApp.\n\nYou can unsubscribe anytime by replying UNSUBSCRIBE."
                    : "✅ Done! You have been unsubscribed from push notifications.\n\nYou will no longer receive promotional messages. You can resubscribe anytime by replying SUBSCRIBE.";
                logger_1.default.info("✅ Notification subscription updated:", {
                    customerId: request.customerId,
                    action: request.action,
                    oldStatus: currentStatus,
                    newStatus: desiredStatus,
                    timestamp: updatedCustomer.push_notifications_consent_at,
                });
                return {
                    success: true,
                    action: request.action,
                    message: successMessage,
                    currentStatus: desiredStatus,
                    timestamp: new Date().toISOString(),
                };
            }
            finally {
                yield database_1.prisma.$disconnect();
            }
        }
        catch (error) {
            logger_1.default.error("❌ ManageNotifications error:", error);
            return {
                success: false,
                action: request.action,
                message: "An error occurred while updating your notification preferences. Please try again later.",
                currentStatus: false,
                timestamp: new Date().toISOString(),
                error: error.message,
            };
        }
    });
}
//# sourceMappingURL=manageNotifications.js.map