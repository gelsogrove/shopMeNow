"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignSendJob = campaignSendJob;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
const translation_service_1 = require("../services/translation.service");
/**
 * Campaign Send Job
 * Runs daily at 10:00 AM
 * Checks active campaigns and queues messages for eligible customers
 *
 * FLOW:
 * 1. Find active campaigns
 * 2. For each campaign, check if it's time to send based on frequency
 * 3. Get eligible customers (not blacklisted, active, with consent)
 * 4. Queue messages to WhatsAppQueue (processed by whatsapp-challenge-queue.job)
 */
async function campaignSendJob() {
    logger_1.default.info('🚀 [CAMPAIGN] Starting daily campaign check...');
    // Find all active campaigns
    const activeCampaigns = await database_1.prisma.campaign.findMany({
        where: {
            isActive: true,
        },
        include: {
            workspace: {
                select: {
                    id: true,
                    name: true,
                    channelStatus: true,
                },
            },
        },
    });
    logger_1.default.info(`[CAMPAIGN] Found ${activeCampaigns.length} active campaigns`);
    let totalMessagesSent = 0;
    let totalCampaignsProcessed = 0;
    for (const campaign of activeCampaigns) {
        try {
            // Skip if workspace channel is not active
            if (!campaign.workspace.channelStatus) {
                logger_1.default.info(`[CAMPAIGN] Skipping campaign ${campaign.name} - workspace channel inactive`);
                continue;
            }
            // Check if campaign should run based on frequency
            const shouldRun = await shouldCampaignRun(campaign);
            if (!shouldRun) {
                logger_1.default.info(`[CAMPAIGN] Skipping campaign ${campaign.name} - not time yet`);
                continue;
            }
            // Get target customers
            const customers = await getTargetCustomers(campaign);
            logger_1.default.info(`[CAMPAIGN] Campaign ${campaign.name}: ${customers.length} eligible customers`);
            if (customers.length === 0) {
                continue;
            }
            // Queue messages for each customer
            let messagesQueued = 0;
            for (const customer of customers) {
                try {
                    // Check if already sent to this customer for this campaign today
                    const alreadySent = await checkAlreadySent(campaign.id, customer.id);
                    if (alreadySent) {
                        continue;
                    }
                    // Queue message
                    await queueCampaignMessage(campaign, customer);
                    messagesQueued++;
                }
                catch (error) {
                    logger_1.default.error(`[CAMPAIGN] Error queueing message for customer ${customer.id}:`, error);
                }
            }
            // Update campaign last run timestamp
            await database_1.prisma.campaign.update({
                where: { id: campaign.id },
                data: { lastRunAt: new Date() },
            });
            totalMessagesSent += messagesQueued;
            totalCampaignsProcessed++;
            logger_1.default.info(`✅ [CAMPAIGN] Campaign ${campaign.name}: ${messagesQueued} messages queued`);
        }
        catch (error) {
            logger_1.default.error(`[CAMPAIGN] Error processing campaign ${campaign.id}:`, error);
        }
    }
    logger_1.default.info(`✅ [CAMPAIGN] Daily check completed: ${totalCampaignsProcessed} campaigns, ${totalMessagesSent} messages queued`);
}
/**
 * Check if campaign should run based on frequency and last run
 */
async function shouldCampaignRun(campaign) {
    const now = new Date();
    const lastRun = campaign.lastRunAt;
    // If never run, run now
    if (!lastRun) {
        return true;
    }
    const daysSinceLastRun = getDaysSince(lastRun);
    const requiredDays = getFrequencyDays(campaign.frequency);
    return daysSinceLastRun >= requiredDays;
}
/**
 * Get target customers for campaign
 */
async function getTargetCustomers(campaign) {
    const baseWhere = {
        workspaceId: campaign.workspaceId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: true,
        last_privacy_version_accepted: { not: null },
    };
    if (campaign.targetType === 'ALL') {
        return await database_1.prisma.customers.findMany({
            where: baseWhere,
            select: {
                id: true,
                name: true,
                phone: true,
                language: true,
            },
        });
    }
    else {
        // SELECTED - only specific customers
        return await database_1.prisma.customers.findMany({
            where: {
                ...baseWhere,
                id: { in: campaign.customerIds || [] },
            },
            select: {
                id: true,
                name: true,
                phone: true,
                language: true,
            },
        });
    }
}
/**
 * Check if message was already sent to customer for this campaign
 */
async function checkAlreadySent(campaignId, customerId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await database_1.prisma.campaignSent.findFirst({
        where: {
            campaignId,
            customerId,
            sentAt: { gte: today },
        },
    });
    return !!existing;
}
/**
 * Queue campaign message to WhatsApp Queue
 * 🌍 AI Translation: Message is automatically translated to customer's language
 */
async function queueCampaignMessage(campaign, customer) {
    // Process message - replace {{nome}} with customer name
    let message = campaign.messagePreview;
    message = message.replace(/\{\{nome\}\}/gi, customer.name || 'Cliente');
    // 🌍 AI Translation: Translate to customer's preferred language
    const customerLanguage = customer.language || 'IT';
    const translatedMessage = await translation_service_1.translationService.translateMessage(message, customerLanguage);
    logger_1.default.info(`[CAMPAIGN] 🌍 Message translated to ${customerLanguage} for ${customer.name}`);
    // Add to WhatsApp Queue with translated message
    await database_1.prisma.whatsAppQueue.create({
        data: {
            workspaceId: campaign.workspaceId,
            customerId: customer.id,
            phoneNumber: customer.phone,
            messageContent: translatedMessage,
            status: 'pending',
        },
    });
    // Track in CampaignSent
    await database_1.prisma.campaignSent.create({
        data: {
            campaignId: campaign.id,
            customerId: customer.id,
            workspaceId: campaign.workspaceId,
        },
    });
    logger_1.default.info(`[CAMPAIGN] ✅ Queued message for ${customer.name} (${customer.phone}) in ${customerLanguage}`);
}
/**
 * Get number of days based on campaign frequency
 */
function getFrequencyDays(frequency) {
    const map = {
        ONCE: 999999,
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
function getDaysSince(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
//# sourceMappingURL=campaign-send.job.js.map