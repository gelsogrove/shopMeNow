import { prisma } from '../config/database'
import logger from '../utils/logger'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Unused Images Cleanup Job
 * Runs daily at 23:02
 * Deletes orphaned images not referenced in the database
 * Covers: products, services, suppliers, users (logos)
 */
export async function unusedImagesCleanupJob(): Promise<void> {
  const uploadsDir = path.join(__dirname, '..', '..', '..', 'backend', 'uploads')
  
  let totalDeleted = 0

  // ═══════════════════════════════════════════════════════════════
  // 1. PRODUCT IMAGES CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const productImagesDir = path.join(uploadsDir, 'products')
  const products = await prisma.products.findMany({
    select: { imageUrl: true },
  })

  const usedProductImages = new Set<string>()
  for (const product of products) {
    if (product.imageUrl && product.imageUrl.length > 0) {
      for (const url of product.imageUrl) {
        const filename = path.basename(url)
        usedProductImages.add(filename)
      }
    }
  }

  logger.info(`[Products] Found ${usedProductImages.size} images referenced in database`)
  totalDeleted += cleanupDirectory(productImagesDir, usedProductImages, 'products')

  // ═══════════════════════════════════════════════════════════════
  // 2. SERVICE IMAGES CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const serviceImagesDir = path.join(uploadsDir, 'services')
  const services = await prisma.services.findMany({
    select: { imageUrl: true },
  })

  const usedServiceImages = new Set<string>()
  for (const service of services) {
    if (service.imageUrl && service.imageUrl.length > 0) {
      for (const url of service.imageUrl) {
        const filename = path.basename(url)
        usedServiceImages.add(filename)
      }
    }
  }

  logger.info(`[Services] Found ${usedServiceImages.size} images referenced in database`)
  totalDeleted += cleanupDirectory(serviceImagesDir, usedServiceImages, 'services')

  // ═══════════════════════════════════════════════════════════════
  // 3. SUPPLIER LOGOS CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const supplierImagesDir = path.join(uploadsDir, 'suppliers')
  const suppliers = await prisma.suppliers.findMany({
    select: { logoUrl: true },
  })

  const usedSupplierImages = new Set<string>()
  for (const supplier of suppliers) {
    if (supplier.logoUrl) {
      const filename = path.basename(supplier.logoUrl)
      usedSupplierImages.add(filename)
    }
  }

  logger.info(`[Suppliers] Found ${usedSupplierImages.size} logos referenced in database`)
  totalDeleted += cleanupDirectory(supplierImagesDir, usedSupplierImages, 'suppliers')

  // ═══════════════════════════════════════════════════════════════
  // 4. USER LOGOS CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const userImagesDir = path.join(uploadsDir, 'users')
  const users = await prisma.user.findMany({
    select: { logo: true },
  })

  const usedUserLogos = new Set<string>()
  for (const user of users) {
    if (user.logo) {
      const filename = path.basename(user.logo)
      usedUserLogos.add(filename)
    }
  }

  logger.info(`[Users] Found ${usedUserLogos.size} logos referenced in database`)
  totalDeleted += cleanupDirectory(userImagesDir, usedUserLogos, 'users')

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  logger.info(`✅ [Unused Images Cleanup] Total orphan files deleted: ${totalDeleted}`)
}

/**
 * Helper function to cleanup a directory
 * @param dir - Directory path to clean
 * @param usedImages - Set of filenames that are in use
 * @param label - Label for logging
 * @returns Number of deleted files
 */
function cleanupDirectory(dir: string, usedImages: Set<string>, label: string): number {
  let deleted = 0

  if (!fs.existsSync(dir)) {
    logger.info(`[${label}] Directory not found: ${dir}`)
    return 0
  }

  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    // Skip hidden files and directories
    if (file.startsWith('.')) continue
    
    const filePath = path.join(dir, file)
    
    // Skip directories
    if (fs.statSync(filePath).isDirectory()) continue
    
    if (!usedImages.has(file)) {
      try {
        fs.unlinkSync(filePath)
        deleted++
        logger.info(`[${label}] Deleted orphan image: ${file}`)
      } catch (error) {
        logger.error(`[${label}] Failed to delete ${file}:`, error)
      }
    }
  }

  logger.info(`[${label}] Deleted ${deleted} orphan files`)
  return deleted
}
