/**
 * One-time cleanup script: Remove all existing order invoices
 * 
 * This script:
 * 1. Deletes invoice files from Cloudinary (production)
 * 2. Deletes invoice files from local storage (development)
 * 3. Clears invoiceUrl, invoiceKey, invoiceDate from orders table
 * 
 * Run with: npx ts-node scripts/cleanup-existing-invoices.ts
 */

import { prisma } from '@echatbot/database'
import { v2 as cloudinary } from 'cloudinary'
import * as fs from 'fs'
import * as path from 'path'

const isProduction = !!process.env.CLOUDINARY_URL

async function cleanupExistingInvoices() {
  console.log('🧹 Starting invoice cleanup...')
  console.log(`📦 Environment: ${isProduction ? 'PRODUCTION (Cloudinary)' : 'DEVELOPMENT (Local)'}`)
  
  // Configure Cloudinary if in production
  if (isProduction) {
    const cloudinaryUrl = process.env.CLOUDINARY_URL!
    const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/)
    
    if (!match) {
      console.error('❌ Invalid CLOUDINARY_URL format')
      process.exit(1)
    }
    
    const [, api_key, api_secret, cloud_name] = match
    cloudinary.config({ cloud_name, api_key, api_secret })
    console.log(`✅ Cloudinary configured: ${cloud_name}`)
  }
  
  // 1. Find all orders with invoices
  const ordersWithInvoices = await prisma.orders.findMany({
    where: {
      OR: [
        { invoiceUrl: { not: null } },
        { invoiceKey: { not: null } },
      ],
    },
    select: {
      id: true,
      orderCode: true,
      invoiceKey: true,
      invoiceUrl: true,
      workspaceId: true,
    },
  })
  
  console.log(`📋 Found ${ordersWithInvoices.length} orders with invoices`)
  
  if (ordersWithInvoices.length === 0) {
    console.log('✅ No invoices to cleanup')
    await prisma.$disconnect()
    return
  }
  
  let deletedFiles = 0
  let errors = 0
  
  // 2. Delete invoice files
  for (const order of ordersWithInvoices) {
    try {
      if (order.invoiceKey) {
        if (isProduction) {
          // Delete from Cloudinary
          // Extract public_id from key: invoices/{workspaceId}/{filename}.pdf
          const publicId = order.invoiceKey.replace(/\.[^/.]+$/, '') // Remove extension
          const fullPublicId = `echatbot/${publicId}` // Add prefix
          
          try {
            await cloudinary.uploader.destroy(fullPublicId)
            console.log(`☁️  Deleted from Cloudinary: ${order.orderCode} (${fullPublicId})`)
            deletedFiles++
          } catch (err: any) {
            // If file doesn't exist in Cloudinary, it's OK (might have been deleted manually)
            if (err.http_code === 404) {
              console.log(`⚠️  File not found in Cloudinary (already deleted?): ${order.orderCode}`)
            } else {
              throw err
            }
          }
        } else {
          // Delete from local filesystem
          const uploadsDir = path.join(__dirname, '..', 'uploads')
          const filePath = path.join(uploadsDir, order.invoiceKey)
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            console.log(`🗑️  Deleted local file: ${order.orderCode}`)
            deletedFiles++
          } else {
            console.log(`⚠️  Local file not found: ${order.orderCode}`)
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error deleting invoice for ${order.orderCode}:`, error)
      errors++
    }
  }
  
  // 3. Clear database references
  const result = await prisma.orders.updateMany({
    where: {
      OR: [
        { invoiceUrl: { not: null } },
        { invoiceKey: { not: null } },
      ],
    },
    data: {
      invoiceUrl: null,
      invoiceKey: null,
      invoiceDate: null,
    },
  })
  
  console.log('\n📊 Cleanup Summary:')
  console.log(`   Files deleted: ${deletedFiles}`)
  console.log(`   DB records cleared: ${result.count}`)
  console.log(`   Errors: ${errors}`)
  console.log('\n✅ Invoice cleanup complete!')
  console.log('💡 Invoices are now generated on-demand (no storage)')
  
  await prisma.$disconnect()
}

// Run cleanup
cleanupExistingInvoices()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
