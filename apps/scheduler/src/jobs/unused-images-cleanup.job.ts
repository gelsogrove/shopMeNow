import { prisma } from '../config/database'
import logger from '../utils/logger'
import * as fs from 'fs'
import * as path from 'path'
import { v2 as cloudinary } from 'cloudinary'

/**
 * Unused Images Cleanup Job
 * Runs daily at 23:05
 * Deletes orphaned images not referenced in the database
 * Covers: products, services, users, channels (logos)
 * Also cleans temp files and cancelled order invoices (local filesystem)
 * 
 * ⚙️ BEHAVIOR:
 * - Production (CLOUDINARY_URL set): Deletes from Cloudinary
 * - Development (local): Deletes from uploads/ folder
 */
export async function unusedImagesCleanupJob(): Promise<void> {
  const uploadsDir = path.join(__dirname, '..', '..', '..', 'backend', 'uploads')
  const isProduction = !!process.env.CLOUDINARY_URL
  
  logger.info(`🧹 [Storage Cleanup] Starting cleanup (${isProduction ? 'CLOUDINARY' : 'LOCAL'})`)

  const usedFilenames = new Set<string>()
  const addFilename = (value?: string | null) => {
    if (!value) return
    const filename = path.basename(value)
    if (filename) usedFilenames.add(filename)
  }
  const addFilenames = (values?: string[] | null) => {
    if (!values || values.length === 0) return
    values.forEach((value) => addFilename(value))
  }
  
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
    select: { imageUrl: true, imageKey: true },
  })

  for (const product of products) {
    addFilenames(product.imageUrl)
    addFilename(product.imageKey)
  }

  logger.info(`[Products] Found ${usedFilenames.size} images referenced in database`)
  totalDeleted += await cleanupDirectory(productImagesDir, usedFilenames, 'products', 'products')

  // ═══════════════════════════════════════════════════════════════
  // 2. SERVICE IMAGES CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const serviceImagesDir = path.join(uploadsDir, 'services')
  const services = await prisma.services.findMany({
    select: { imageUrl: true, imageKey: true },
  })

  for (const service of services) {
    addFilenames(service.imageUrl)
    addFilename(service.imageKey)
  }

  logger.info(`[Services] Found ${usedFilenames.size} images referenced in database`)
  totalDeleted += await cleanupDirectory(serviceImagesDir, usedFilenames, 'services', 'services')

  // ═══════════════════════════════════════════════════════════════
  // 3. USER LOGOS CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const userImagesDir = path.join(uploadsDir, 'users')
  const users = await prisma.user.findMany({
    select: { logo: true },
  })

  for (const user of users) {
    addFilename(user.logo)
  }

  // IMPORTANT: Also protect workspace logos (widget logos are saved in 'users' folder)
  const workspaceLogos = await prisma.workspace.findMany({
    select: { 
      logoUrl: true, 
      logoKey: true,
      widgetLogoUrl: true,
      widgetLogoKey: true
    },
  })

  for (const workspace of workspaceLogos) {
    addFilename(workspace.logoUrl)
    addFilename(workspace.logoKey)
    addFilename(workspace.widgetLogoUrl)
    addFilename(workspace.widgetLogoKey)
  }

  logger.info(`[Users] Found ${usedFilenames.size} logos referenced in database (users + workspace widgets)`)
  totalDeleted += await cleanupDirectory(userImagesDir, usedFilenames, 'users', 'users')

  // ═══════════════════════════════════════════════════════════════
  // 4. CHANNEL LOGOS CLEANUP
  // ═══════════════════════════════════════════════════════════════
  const channelImagesDir = path.join(uploadsDir, 'channels')
  const workspaces = await prisma.workspace.findMany({
    select: { logoUrl: true, logoKey: true },
  })

  for (const workspace of workspaces) {
    addFilename(workspace.logoUrl)
    addFilename(workspace.logoKey)
  }

  logger.info(`[Channels] Found ${usedFilenames.size} logos referenced in database`)
  totalDeleted += await cleanupDirectory(channelImagesDir, usedFilenames, 'channels', 'channels')

  // ═══════════════════════════════════════════════════════════════
  // 5. TEMP FILES CLEANUP (LOCAL ONLY)
  // ═══════════════════════════════════════════════════════════════
  if (!isProduction) {
    const tempDir = path.join(uploadsDir, 'temp')
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    let deletedTemp = 0

    if (fs.existsSync(tempDir)) {
      const items = fs.readdirSync(tempDir, { withFileTypes: true })
      for (const item of items) {
        if (!item.isFile()) continue
        const filename = item.name
        const timestamp = parseInt(filename.split('-')[0], 10)
        if (Number.isNaN(timestamp)) continue
        if (now - timestamp > maxAge) {
          fs.unlinkSync(path.join(tempDir, filename))
          deletedTemp++
        }
      }
    }

    if (deletedTemp > 0) {
      logger.info(`🧹 [Temp Files] Deleted ${deletedTemp} old temp files`)
    }
  } else {
    logger.info('🧹 [Temp Files] Skipped in Cloudinary mode')
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. CANCELLED INVOICE CLEANUP (LOCAL ONLY)
  // ═══════════════════════════════════════════════════════════════
  if (!isProduction) {
    const cancelledOrders = await prisma.orders.findMany({
      where: {
        status: 'CANCELLED',
        invoiceKey: { not: null },
      },
      select: { id: true, orderCode: true, invoiceKey: true },
    })

    let deletedInvoices = 0
    for (const order of cancelledOrders) {
      if (!order.invoiceKey) continue
      const invoicePath = path.join(uploadsDir, order.invoiceKey)
      if (fs.existsSync(invoicePath)) {
        fs.unlinkSync(invoicePath)
      }
      await prisma.orders.update({
        where: { id: order.id },
        data: { invoiceUrl: null, invoiceKey: null },
      })
      deletedInvoices++
    }

    if (deletedInvoices > 0) {
      logger.info(`🧹 [Invoices] Deleted ${deletedInvoices} cancelled order invoices`)
    }
  } else {
    logger.info('🧹 [Invoices] Skipped in Cloudinary mode')
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  logger.info(`✅ [Storage Cleanup] Total orphan files deleted: ${totalDeleted}`)
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
