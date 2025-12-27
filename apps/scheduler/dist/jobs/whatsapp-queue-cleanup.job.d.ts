/**
 * WhatsApp Queue Cleanup Job
 * Runs daily at 23:05
 * Deletes WhatsApp queue messages with status 'error' older than 7 days
 *
 * Purpose: Keep the queue table clean by removing old error messages
 * that are no longer relevant for debugging or retry
 */
export declare function whatsappQueueCleanupJob(): Promise<void>;
//# sourceMappingURL=whatsapp-queue-cleanup.job.d.ts.map