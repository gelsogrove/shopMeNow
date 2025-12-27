/**
 * Job 1: Cleanup Orphaned Files
 * Runs every night at 03:00
 */
export declare function setupOrphanedFilesCleanup(): void;
/**
 * Job 2: Cleanup Temp Files
 * Runs every hour
 */
export declare function setupTempFilesCleanup(): void;
/**
 * Job 3: Cleanup Cancelled Order Invoices
 * Runs every night at 04:00
 */
export declare function setupInvoiceCleanup(): void;
export declare function setupStorageCleanup(): void;
//# sourceMappingURL=storage-cleanup.d.ts.map