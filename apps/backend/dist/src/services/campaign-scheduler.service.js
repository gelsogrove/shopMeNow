"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.CampaignScheduler = void 0;
const cron = __importStar(require("node-cron"));
const campaign_token_service_1 = require("../application/services/campaign-token.service");
const campaign_service_1 = require("../application/services/campaign.service");
const logger_1 = __importDefault(require("../utils/logger"));
const message_sending_service_1 = __importDefault(require("./message-sending.service"));
/**
 * Campaign Scheduler Service
 * Runs daily to check and send scheduled campaign messages
 */
class CampaignScheduler {
    constructor(prisma) {
        this.prisma = prisma;
        this.cronJob = null;
        this.campaignService = new campaign_service_1.CampaignService(prisma);
        this.tokenService = new campaign_token_service_1.CampaignTokenService(prisma);
    }
    /**
     * Start the campaign scheduler
     * Runs every day at 10:00 AM
     */
    start() {
        // Run every day at 10:00 AM
        this.cronJob = cron.schedule("0 10 * * *", () => __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("🚀 [CAMPAIGN SCHEDULER] Starting daily campaign check...");
            yield this.processCampaigns();
        }));
        logger_1.default.info("✅ [CAMPAIGN SCHEDULER] Started - runs daily at 10:00 AM");
    }
    /**
     * Stop the scheduler
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            logger_1.default.info("🛑 [CAMPAIGN SCHEDULER] Stopped");
        }
    }
    /**
     * Main processing logic - check all active campaigns
     */
    processCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeCampaigns = yield this.campaignService.findActiveCampaigns();
                logger_1.default.info(`[CAMPAIGN SCHEDULER] Found ${activeCampaigns.length} active campaigns`);
                for (const campaign of activeCampaigns) {
                    try {
                        yield this.processSingleCampaign(campaign);
                    }
                    catch (error) {
                        logger_1.default.error(`[CAMPAIGN SCHEDULER] Error processing campaign ${campaign.id}:`, error);
                        // Continue with other campaigns
                    }
                }
                logger_1.default.info("✅ [CAMPAIGN SCHEDULER] Daily check completed");
            }
            catch (error) {
                logger_1.default.error("[CAMPAIGN SCHEDULER] Error in processCampaigns:", error);
            }
        });
    }
    /**
     * Process a single campaign
     */
    processSingleCampaign(campaign) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`[CAMPAIGN SCHEDULER] Processing campaign: ${campaign.name}`);
            // Get target customers
            const customers = yield this.getTargetCustomers(campaign);
            logger_1.default.info(`[CAMPAIGN SCHEDULER] Found ${customers.length} target customers for campaign ${campaign.id}`);
            let sentCount = 0;
            for (const customer of customers) {
                try {
                    // Check if customer should receive message based on frequency
                    const shouldSend = yield this.shouldSendToCustomer(campaign, customer.id);
                    if (shouldSend) {
                        yield this.sendCampaignMessage(campaign, customer);
                        sentCount++;
                    }
                }
                catch (error) {
                    logger_1.default.error(`[CAMPAIGN SCHEDULER] Error sending to customer ${customer.id}:`, error);
                    // Continue with other customers
                }
            }
            // Update campaign last run timestamp
            yield this.campaignService.updateLastRun(campaign.id);
            logger_1.default.info(`✅ [CAMPAIGN SCHEDULER] Campaign ${campaign.name}: sent ${sentCount}/${customers.length} messages`);
        });
    }
    /**
     * Get target customers for campaign
     */
    getTargetCustomers(campaign) {
        return __awaiter(this, void 0, void 0, function* () {
            if (campaign.targetType === "ALL") {
                // Get all active, non-blacklisted customers with push notifications consent and GDPR accepted
                return yield this.prisma.customers.findMany({
                    where: {
                        workspaceId: campaign.workspaceId,
                        isActive: true,
                        isBlacklisted: false,
                        push_notifications_consent: true,
                        last_privacy_version_accepted: { not: null },
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        language: true,
                    },
                });
            }
            else {
                // Get only selected customers who are active, not blacklisted, have push notifications consent and GDPR accepted
                return yield this.prisma.customers.findMany({
                    where: {
                        id: { in: campaign.customerIds },
                        workspaceId: campaign.workspaceId,
                        isActive: true,
                        isBlacklisted: false,
                        push_notifications_consent: true,
                        last_privacy_version_accepted: { not: null },
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        language: true,
                    },
                });
            }
        });
    }
    /**
     * Check if customer should receive message based on campaign frequency
     */
    shouldSendToCustomer(campaign, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find last sent message for this campaign + customer
            const lastSent = yield this.prisma.campaignSent.findFirst({
                where: {
                    campaignId: campaign.id,
                    customerId,
                },
                orderBy: { sentAt: "desc" },
            });
            const customer = yield this.prisma.customers.findUnique({
                where: { id: customerId },
                select: { createdAt: true },
            });
            if (!customer) {
                return false;
            }
            // If no previous send, use customer creation date
            const referenceDate = customer.createdAt; // In production: lastSent?.sentAt || customer.createdAt
            const daysSinceReference = this.getDaysSince(referenceDate);
            const requiredDays = this.getFrequencyDays(campaign.frequency);
            return daysSinceReference >= requiredDays;
        });
    }
    /**
     * Get number of days based on campaign frequency
     */
    getFrequencyDays(frequency) {
        const map = {
            ONCE: 999999, // One-time campaign, never reschedule
            WEEKLY: 7,
            BIWEEKLY: 14,
            MONTHLY: 30,
            BIMONTHLY: 60,
            QUARTERLY: 90,
            SEMIANNUAL: 180,
            ANNUAL: 365,
        };
        return map[frequency] || 30;
    }
    /**
     * Calculate days since a date
     */
    getDaysSince(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    /**
     * Send campaign message to customer
     *
     * 🔒 SECURITY: Multi-factor validation (workspaceId + customerId + phoneNumber)
     */
    sendCampaignMessage(campaign, customer) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`[CAMPAIGN SCHEDULER] Sending campaign ${campaign.name} to customer ${customer.id}`);
            // 🔒 SECURITY VALIDATION 1: Customer exists and workspace matches
            const validCustomer = yield this.prisma.customers.findUnique({
                where: { id: customer.id },
                select: {
                    id: true,
                    workspaceId: true,
                    phone: true,
                    name: true,
                    isActive: true,
                    isBlacklisted: true,
                    language: true,
                },
            });
            if (!validCustomer) {
                logger_1.default.error(`[CAMPAIGN SCHEDULER] ❌ Customer ${customer.id} not found`);
                throw new Error(`Customer ${customer.id} not found`);
            }
            // 🔒 SECURITY VALIDATION 2: Workspace ID match (prevent cross-workspace attacks)
            if (validCustomer.workspaceId !== campaign.workspaceId) {
                logger_1.default.error(`[CAMPAIGN SCHEDULER] 🚨 SECURITY ALERT: Workspace mismatch!`, {
                    customerId: customer.id,
                    customerWorkspace: validCustomer.workspaceId,
                    campaignWorkspace: campaign.workspaceId,
                    campaignId: campaign.id,
                });
                throw new Error(`Security violation: Customer ${customer.id} does not belong to workspace ${campaign.workspaceId}`);
            }
            // 🔒 SECURITY VALIDATION 3: Phone number match (prevent spoofing)
            if (validCustomer.phone !== customer.phone) {
                logger_1.default.error(`[CAMPAIGN SCHEDULER] 🚨 SECURITY ALERT: Phone number mismatch!`, {
                    customerId: customer.id,
                    customerPhone: validCustomer.phone,
                    providedPhone: customer.phone,
                });
                throw new Error(`Security violation: Phone number mismatch for customer ${customer.id}`);
            }
            // 🔒 SECURITY VALIDATION 4: Customer status check
            if (!validCustomer.isActive || validCustomer.isBlacklisted) {
                logger_1.default.warn(`[CAMPAIGN SCHEDULER] Skipping customer ${customer.id}: ${!validCustomer.isActive ? "inactive" : "blacklisted"}`);
                return;
            }
            logger_1.default.info(`[CAMPAIGN SCHEDULER] ✅ Security validations passed for customer ${customer.id}`);
            // Replace tokens in message
            const { message: processedMessage, tokensUsed } = yield this.tokenService.replaceTokens(campaign.messagePreview, customer.id, campaign.workspaceId, campaign.id);
            // 📤 Send WhatsApp message via MessageSendingService (with security layer)
            // 🚨 CRITICAL: Token replacement da DB può contenere dati malevoli!
            // Security layer protegge da SQL injection, XSS, phishing links
            const sendResult = yield message_sending_service_1.default.sendMessage({
                phoneNumber: validCustomer.phone, // Use validated phone
                message: processedMessage,
                workspaceId: campaign.workspaceId, // Use validated workspaceId
                customerId: validCustomer.id,
                sendType: "CAMPAIGN", // 🔒 Security layer will be applied automatically
                userLanguage: validCustomer.language || "it",
                metadata: {
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    tokensUsed: tokensUsed.join(", "),
                },
            });
            if (!sendResult.success) {
                logger_1.default.error(`[CAMPAIGN SCHEDULER] ❌ Failed to send WhatsApp message`, {
                    customerId: customer.id,
                    error: sendResult.error,
                    blocked: sendResult.blocked,
                    blockReason: sendResult.blockReason,
                });
                if (sendResult.blocked) {
                    throw new Error(`Message blocked by security: ${sendResult.blockReason}`);
                }
                throw new Error(`WhatsApp send failed: ${sendResult.error}`);
            }
            logger_1.default.info(`[CAMPAIGN SCHEDULER] 📱 WhatsApp message sent successfully`, {
                messageId: sendResult.messageId,
                tokensUsed: tokensUsed.join(", "),
                securityChecked: sendResult.securityChecked,
            });
            // 💾 Track sent message with audit trail
            yield this.prisma.campaignSent.create({
                data: {
                    campaignId: campaign.id,
                    customerId: customer.id,
                    workspaceId: campaign.workspaceId,
                    tokenUsed: tokensUsed.join(","),
                },
            });
            logger_1.default.info(`✅ [CAMPAIGN SCHEDULER] Message sent to ${customer.name} (${customer.phone})`);
        });
    }
}
exports.CampaignScheduler = CampaignScheduler;
//# sourceMappingURL=campaign-scheduler.service.js.map