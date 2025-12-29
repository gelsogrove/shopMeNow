/**
 * Storage Service - Unified file upload/delete interface
 * 
 * Automatically switches between:
 * - LOCAL filesystem (development)
 * - CLOUDINARY (production/Heroku)
 * 
 * Usage:
 *   const url = await storageService.uploadImage(file, 'products')
 *   await storageService.deleteImage(url)
 */

import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'
import logger from '../utils/logger'

// Storage types
type StorageType = 'local' | 'cloudinary'
type Folder = 'products' | 'services' | 'suppliers' | 'users' | 'channels'

class StorageService {
  private storageType: StorageType
  private localUploadDir: string

  constructor() {
    // Determine storage type based on environment
    const useCloudinary = process.env.CLOUDINARY_URL || process.env.NODE_ENV === 'production'
    this.storageType = useCloudinary ? 'cloudinary' : 'local'
    this.localUploadDir = path.join(__dirname, '../../uploads')

    // Configure Cloudinary if credentials exist
    if (this.storageType === 'cloudinary') {
      if (!process.env.CLOUDINARY_URL) {
        logger.warn('⚠️ CLOUDINARY_URL not set - falling back to local storage')
        this.storageType = 'local'
      } else {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        })
        logger.info('✅ Cloudinary configured')
      }
    }

    // Ensure local upload directories exist
    if (this.storageType === 'local') {
      this.ensureLocalDirectories()
      logger.info('✅ Local storage configured')
    }

    logger.info(`📦 Storage Service initialized: ${this.storageType.toUpperCase()}`)
  }

  /**
   * Upload image to storage
   * @param file Express.Multer.File object
   * @param folder Folder name (products, services, etc.)
   * @returns Public URL of uploaded image
   */
  async uploadImage(file: Express.Multer.File, folder: Folder): Promise<string> {
    if (this.storageType === 'cloudinary') {
      return this.uploadToCloudinary(file, folder)
    } else {
      return this.uploadToLocal(file, folder)
    }
  }

  /**
   * Delete image from storage
   * @param imageUrl Full URL or path to image
   */
  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return

    if (this.storageType === 'cloudinary') {
      await this.deleteFromCloudinary(imageUrl)
    } else {
      await this.deleteFromLocal(imageUrl)
    }
  }

  /**
   * Upload multiple images (array of files)
   */
  async uploadImages(files: Express.Multer.File[], folder: Folder): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadImage(file, folder))
    return Promise.all(uploadPromises)
  }

  /**
   * Delete multiple images (array of URLs)
   */
  async deleteImages(imageUrls: string[]): Promise<void> {
    const deletePromises = imageUrls.map(url => this.deleteImage(url))
    await Promise.all(deletePromises)
  }

  // ==================== CLOUDINARY METHODS ====================

  private async uploadToCloudinary(file: Express.Multer.File, folder: Folder): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `echatbot/${folder}`,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
      })

      // Delete temp file after upload
      fs.unlinkSync(file.path)

      logger.info(`☁️ Uploaded to Cloudinary: ${result.secure_url}`)
      return result.secure_url
    } catch (error) {
      logger.error('❌ Cloudinary upload failed:', error)
      throw new Error(`Failed to upload to Cloudinary: ${error.message}`)
    }
  }

  private async deleteFromCloudinary(imageUrl: string): Promise<void> {
    try {
      // Extract public_id from Cloudinary URL
      // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/echatbot/products/image.jpg
      // public_id: echatbot/products/image
      const matches = imageUrl.match(/\/([^/]+\/[^/]+\/[^/.]+)\.[^.]+$/)
      if (!matches) {
        logger.warn(`⚠️ Could not extract public_id from: ${imageUrl}`)
        return
      }

      const publicId = matches[1]
      await cloudinary.uploader.destroy(publicId)
      logger.info(`🗑️ Deleted from Cloudinary: ${publicId}`)
    } catch (error) {
      logger.error('❌ Cloudinary delete failed:', error)
      // Don't throw - image might already be deleted
    }
  }

  // ==================== LOCAL FILESYSTEM METHODS ====================

  private uploadToLocal(file: Express.Multer.File, folder: Folder): string {
    try {
      const folderPath = path.join(this.localUploadDir, folder)
      
      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 8)
      const ext = path.extname(file.originalname)
      const filename = `${path.parse(file.originalname).name}_${timestamp}_${randomString}${ext}`

      // Move file to destination
      const destPath = path.join(folderPath, filename)
      fs.renameSync(file.path, destPath)

      // Return relative URL (served by Express static middleware)
      const relativeUrl = `/uploads/${folder}/${filename}`
      logger.info(`💾 Uploaded to local: ${relativeUrl}`)
      return relativeUrl
    } catch (error) {
      logger.error('❌ Local upload failed:', error)
      throw new Error(`Failed to upload locally: ${error.message}`)
    }
  }

  private async deleteFromLocal(imageUrl: string): Promise<void> {
    try {
      // Convert URL to file path
      // Example: /uploads/products/image.jpg → /path/to/backend/uploads/products/image.jpg
      const relativePath = imageUrl.replace(/^\/uploads\//, '')
      const filePath = path.join(this.localUploadDir, relativePath)

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logger.info(`🗑️ Deleted from local: ${filePath}`)
      }
    } catch (error) {
      logger.error('❌ Local delete failed:', error)
      // Don't throw - file might already be deleted
    }
  }

  private ensureLocalDirectories(): void {
    const folders: Folder[] = ['products', 'services', 'suppliers', 'users', 'channels']
    folders.forEach(folder => {
      const folderPath = path.join(this.localUploadDir, folder)
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true })
      }
    })
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get storage type (local or cloudinary)
   */
  getStorageType(): StorageType {
    return this.storageType
  }

  /**
   * Check if running on Cloudinary
   */
  isCloudinary(): boolean {
    return this.storageType === 'cloudinary'
  }
}

// Export singleton instance
export const storageService = new StorageService()
