/**
 * Unused Images Cleanup Job
 * Runs daily at 23:02
 * Deletes orphaned images not referenced in the database
 * Covers: products, services, suppliers, users, channels (logos)
 *
 * ⚙️ BEHAVIOR:
 * - Production (CLOUDINARY_URL set): Deletes from Cloudinary
 * - Development (local): Deletes from uploads/ folder
 */
export declare function unusedImagesCleanupJob(): Promise<void>;
//# sourceMappingURL=unused-images-cleanup.job.d.ts.map