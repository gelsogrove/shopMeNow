import { prisma } from '../config/database'
import logger from '../utils/logger'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Unused Images Cleanup Job
 * Runs daily at 23:02
 * Deletes orphaned images not referenced in the database
 */
export async function unusedImagesCleanupJob(): Promise<void> {
  const uploadsDir = path.join(__dirname, '..', '..', '..', 'backend', 'uploads')
  const productImagesDir = path.join(uploadsDir, 'products')

  let totalDeleted = 0

  // Get all image URLs from products
  const products = await prisma.products.findMany({
    select: { imageUrl: true },
  })

  // Extract filenames from URLs
  const usedImages = new Set<string>()
  
  for (const product of products) {
    if (product.imageUrl && product.imageUrl.length > 0) {
      for (const url of product.imageUrl) {
        const filename = path.basename(url)
        usedImages.add(filename)
      }
    }
  }

  logger.info(`Found ${usedImages.size} images referenced in database`)

  // Check product images directory
  if (fs.existsSync(productImagesDir)) {
    const files = fs.readdirSync(productImagesDir)
    
    for (const file of files) {
      if (!usedImages.has(file)) {
        const filePath = path.join(productImagesDir, file)
        try {
          fs.unlinkSync(filePath)
          totalDeleted++
          logger.info(`Deleted orphan image: ${file}`)
        } catch (error) {
          logger.error(`Failed to delete ${file}:`, error)
        }
      }
    }
  } else {
    logger.info(`Product images directory not found: ${productImagesDir}`)
  }

  logger.info(`Total orphan files deleted: ${totalDeleted}`)
}
