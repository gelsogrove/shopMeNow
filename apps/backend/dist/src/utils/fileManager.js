"use strict";
/**
 * File Manager Utility
 *
 * Handles file operations including deletion of unused image files
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImageFile = deleteImageFile;
exports.deleteMultipleImageFiles = deleteMultipleImageFiles;
exports.findRemovedImages = findRemovedImages;
exports.cleanupRemovedImages = cleanupRemovedImages;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Delete a single image file from the filesystem
 * @param filePath - Relative path to the file (e.g., "/uploads/products/image.jpg")
 * @returns true if deleted successfully, false otherwise
 */
function deleteImageFile(filePath) {
    try {
        // Convert relative path to absolute path
        const absolutePath = path_1.default.join(__dirname, "../../", filePath);
        // Check if file exists
        if (!fs_1.default.existsSync(absolutePath)) {
            logger_1.default.warn(`File not found for deletion: ${absolutePath}`);
            return false;
        }
        // Delete the file
        fs_1.default.unlinkSync(absolutePath);
        logger_1.default.info(`Successfully deleted file: ${filePath}`);
        return true;
    }
    catch (error) {
        logger_1.default.error(`Error deleting file ${filePath}:`, error);
        return false;
    }
}
/**
 * Delete multiple image files from the filesystem
 * @param filePaths - Array of relative paths to delete
 * @returns Number of files successfully deleted
 */
function deleteMultipleImageFiles(filePaths) {
    let deletedCount = 0;
    for (const filePath of filePaths) {
        if (deleteImageFile(filePath)) {
            deletedCount++;
        }
    }
    logger_1.default.info(`Deleted ${deletedCount} out of ${filePaths.length} files`);
    return deletedCount;
}
/**
 * Find images that were removed (present in old array but not in new array)
 * @param oldImageUrls - Previous image URLs
 * @param newImageUrls - New image URLs
 * @returns Array of image URLs that were removed
 */
function findRemovedImages(oldImageUrls, newImageUrls) {
    const removedImages = oldImageUrls.filter((oldUrl) => !newImageUrls.includes(oldUrl));
    logger_1.default.info(`Found ${removedImages.length} images to delete`, {
        oldCount: oldImageUrls.length,
        newCount: newImageUrls.length,
        removed: removedImages,
    });
    return removedImages;
}
/**
 * Clean up removed images from the filesystem
 * @param oldImageUrls - Previous image URLs
 * @param newImageUrls - New image URLs
 * @returns Number of files successfully deleted
 */
function cleanupRemovedImages(oldImageUrls, newImageUrls) {
    const removedImages = findRemovedImages(oldImageUrls, newImageUrls);
    if (removedImages.length === 0) {
        logger_1.default.info("No images to clean up");
        return 0;
    }
    return deleteMultipleImageFiles(removedImages);
}
//# sourceMappingURL=fileManager.js.map