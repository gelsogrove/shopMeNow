import { prisma } from '../config/database'
import logger from '../utils/logger'
import * as fs from 'fs'
import * as path from 'path'
import { v2 as cloudinary } from 'cloudinary'

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
export async function unusedImagesCleanupJob(): Promise<void> {
  const uploadsDir = path.join(__dirname, '..', '..', '..', 'backend', 'uploads')
  const isProduction = !!process.env.CLOUDINARY_URL
  
  logger.info(`🧹 [Unused Images Cleanup] Starting cleanup (${isProduction ? 'CLOUDINARY' : 'LOCAL'})`)
  
  // Configure Cloudinary if in production
  if (isProduction) {
    const cloudinaryUrl = process.env.CLOUDINARY_URL!
    const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/)
    
    if (!match) {
      logger.error('❌ Invalid CLOUDINARY_URL format - skipping cleanup')
      return
    }
    
    const [, api_key, api_secret, cloud_name] = match
    cloudinary.config({ cloud_name, api_key, api_secret })
    logger.info(`✅ Cloudinary configured: ${cloud_name}`)
  }
  
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
  totalDeleted += await cleanupDirectory(productImagesDir, usedProductImages, 'products', 'products')

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
  totalDeleted += await cleanupDirectory(serviceImagesDir, usedServiceImages, 'services', 'services')

  // ═══════════════════════════════════════════════════════════════
  // 3. USER LOGOS CLEANUP
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
  totalDeleted += await cleanupDirectory(userImagesDir, usedUserLogos, 'users', 'users')

  // ═══════════════════════════════════════════════════════════════
  // 4. CHANNEL LOGOS CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const channelImagesDir = path.join(uploadsDir, 'channels')
  const workspaces = await prisma.workspace.findMany({
    select: { logoUrl: true },
  })

  const usedChannelLogos = new Set<string>()
  for (const workspace of workspaces) {
    if (workspace.logoUrl) {
      const filename = path.basename(workspace.logoUrl)
      usedChannelLogos.add(filename)
    }
  }

  logger.info(`[Channels] Found ${usedChannelLogos.size} logos referenced in database`)
  totalDeleted += await cleanupDirectory(channelImagesDir, usedChannelLogos, 'channels', 'channels')

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  logger.info(`✅ [Unused Images Cleanup] Total orphan files deleted: ${totalDeleted}`)
}

/**
 * Helper function to cleanup a directory
 * @param dir - Directory path to clean (local)
 * @param usedImages - Set of filenames that are in use
 * @param label - Label for logging
 * @param cloudinaryFolder - Cloudinary folder name (products, services, users, channels)
 * @returns Number of deleted files
 */
async function cleanupDirectory(
  dir: string, 
  usedImages: Set<string>, 
  label: string,
  cloudinaryFolder: string
): Promise<number> {
  const isProduction = !!process.env.CLOUDINARY_URL
  let deleted = 0

  if (!isProduction) {
    // LOCAL MODE: Delete from filesystem
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
          logger.info(`[${label}] 🗑️ Deleted local orphan: ${file}`)
        } catch (error) {
          logger.error(`[${label}] Failed to delete ${file}:`, error)
        }
      }
    }
  } else {
    // PRODUCTION MODE: Delete from Cloudinary
    try {
      // List all images in Cloudinary folder
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: `echatbot/${cloudinaryFolder}`,
        max_results: 500,
      })
      
      for (const resource of result.resources) {
        const filename = path.basename(resource.secure_url)
        
        if (!usedImages.has(filename)) {
          try {
            await cloudinary.uploader.destroy(resource.public_id)
            deleted++
            logger.info(`[${label}] ☁️ Deleted Cloudinary orphan: ${filename} (${resource.public_id})`)
          } catch (error) {
            logger.error(`[${label}] Failed to delete ${filename} from Cloudinary:`, error)
          }
        }
      }
    } catch (error) {
      logger.error(`[${label}] Failed to list Cloudinary images:`, error)
      return 0
    }
  }

  logger.info(`[${label}] Deleted ${deleted} orphan files`)
  return deleted
}
