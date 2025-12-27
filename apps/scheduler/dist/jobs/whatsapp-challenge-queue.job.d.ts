/**
 * WhatsApp Challenge Queue Job
 *
 * Runs every 3 seconds via cron (configured in index.ts)
 * Processes pending messages for workspaces with active channel
 *
 * CRITICAL FEATURES:
 * 1. Lock mechanism: If job is still running, next cron tick is skipped
 * 2. PARALLEL sending: Messages to DIFFERENT customers sent simultaneously
 * 3. Small batches: Max 10 messages per cycle
 * 4. Security check: All messages pass through Security Agent LLM
 *
 * WHY PARALLEL IS SAFE?
 * WhatsApp Cloud API limits:
 * - 80 msg/second GLOBAL throughput (up to 1000 msg/s)
 * - 1 msg per 6 seconds PER PAIR (same sender → same recipient)
 *
 * Since we're sending to DIFFERENT customers, parallel is fine!
 * The 6-second limit only applies to the SAME customer.
 *
 * WHY LOCK?
 * - Cron runs every 3 seconds
 * - If processing takes longer, next tick is skipped
 * - Prevents duplicate processing of same messages
 *
 * HOW TO ENABLE/DISABLE?
 * - Start/stop the Scheduler microservice
 * - Or set workspace.channelStatus = false
 */
export declare function whatsappChallengeQueueJob(): Promise<void>;
//# sourceMappingURL=whatsapp-challenge-queue.job.d.ts.map