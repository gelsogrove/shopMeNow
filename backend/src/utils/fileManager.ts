/**
 * File Manager Utility
 *
 * Handles file operations including deletion of unused image files
 */

import fs from "fs"
import path from "path"
import logger from "./logger"

/**
 * Delete a single image file from the filesystem
 * @param filePath - Relative path to the file (e.g., "/uploads/products/image.jpg")
 * @returns true if deleted successfully, false otherwise
 */
export function deleteImageFile(filePath: string): boolean {
  try {
    // Convert relative path to absolute path
    const absolutePath = path.join(__dirname, "../../", filePath)

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      logger.warn(`File not found for deletion: ${absolutePath}`)
      return false
    }

    // Delete the file
    fs.unlinkSync(absolutePath)
    logger.info(`Successfully deleted file: ${filePath}`)
    return true
  } catch (error) {
    logger.error(`Error deleting file ${filePath}:`, error)
    return false
  }
}

/**
 * Delete multiple image files from the filesystem
 * @param filePaths - Array of relative paths to delete
 * @returns Number of files successfully deleted
 */
export function deleteMultipleImageFiles(filePaths: string[]): number {
  let deletedCount = 0

  for (const filePath of filePaths) {
    if (deleteImageFile(filePath)) {
      deletedCount++
    }
  }

  logger.info(`Deleted ${deletedCount} out of ${filePaths.length} files`)
  return deletedCount
}

/**
 * Find images that were removed (present in old array but not in new array)
 * @param oldImageUrls - Previous image URLs
 * @param newImageUrls - New image URLs
 * @returns Array of image URLs that were removed
 */
export function findRemovedImages(
  oldImageUrls: string[],
  newImageUrls: string[]
): string[] {
  const removedImages = oldImageUrls.filter(
    (oldUrl) => !newImageUrls.includes(oldUrl)
  )

  logger.info(`Found ${removedImages.length} images to delete`, {
    oldCount: oldImageUrls.length,
    newCount: newImageUrls.length,
    removed: removedImages,
  })

  return removedImages
}

/**
 * Clean up removed images from the filesystem
 * @param oldImageUrls - Previous image URLs
 * @param newImageUrls - New image URLs
 * @returns Number of files successfully deleted
 */
export function cleanupRemovedImages(
  oldImageUrls: string[],
  newImageUrls: string[]
): number {
  const removedImages = findRemovedImages(oldImageUrls, newImageUrls)

  if (removedImages.length === 0) {
    logger.info("No images to clean up")
    return 0
  }

  return deleteMultipleImageFiles(removedImages)
}
