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
export declare function campaignSendJob(): Promise<void>;
//# sourceMappingURL=campaign-send.job.d.ts.map