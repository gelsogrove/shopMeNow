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
type Folder = 'products' | 'services' | 'users' | 'channels' | 'workspaces'
type StorageCategory = 'public' | 'private'

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
        // Parse CLOUDINARY_URL: cloudinary://api_key:api_secret@cloud_name
        const cloudinaryUrl = process.env.CLOUDINARY_URL
        const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/)
        
        if (!match) {
          logger.error('❌ Invalid CLOUDINARY_URL format - falling back to local storage')
          this.storageType = 'local'
        } else {
          const [, api_key, api_secret, cloud_name] = match
          cloudinary.config({ cloud_name, api_key, api_secret })
          logger.info(`✅ Cloudinary configured: ${cloud_name}`)
        }
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
   * @param isPublic Whether file should be publicly accessible (default: true)
   * @returns Public URL of uploaded image
   */
  async uploadImage(file: Express.Multer.File, folder: Folder, isPublic: boolean = true): Promise<string> {
    if (this.storageType === 'cloudinary') {
      return this.uploadToCloudinary(file, folder)
    } else {
      return this.uploadToLocal(file, folder, isPublic)
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

  /**
   * List all images in a folder
   * @param folder Folder name (products, services, users, channels)
   * @returns Array of image objects with url and publicId
   */
  async listImages(folder: Folder): Promise<Array<{ url: string; publicId: string }>> {
    if (this.storageType === 'cloudinary') {
      return this.listFromCloudinary(folder)
    } else {
      return this.listFromLocal(folder)
    }
  }

  // ==================== LEGACY COMPATIBILITY METHODS (for InvoiceService) ====================
  
  /**
   * Upload raw buffer (for PDFs, etc.)
   * @deprecated Use uploadImage() for images, this is for PDF/documents only
   */
  async upload(buffer: Buffer, options: { filename: string; folder: string; contentType: string; isPublic?: boolean }): Promise<{ url: string; key: string }> {
    if (this.storageType === 'cloudinary') {
      // For Cloudinary: save buffer to temp file, upload, then delete
      const tempPath = path.join(this.localUploadDir, `temp_${Date.now()}_${options.filename}`)
      fs.writeFileSync(tempPath, buffer)
      
      try {
        const result = await cloudinary.uploader.upload(tempPath, {
          folder: `echatbot/${options.folder}`,
          resource_type: 'raw', // For non-image files like PDF
          public_id: path.parse(options.filename).name,
          use_filename: true,
        })
        
        fs.unlinkSync(tempPath) // Cleanup temp file
        
        logger.info(`☁️ Uploaded buffer to Cloudinary: ${result.secure_url}`)
        return { url: result.secure_url, key: result.public_id }
      } catch (error) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
        throw error
      }
    } else {
      // Local: save buffer directly
      const folderPath = path.join(this.localUploadDir, options.folder)
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true })
      }
      
      const filePath = path.join(folderPath, options.filename)
      fs.writeFileSync(filePath, buffer)
      
      const url = `/uploads/${options.folder}/${options.filename}`
      logger.info(`💾 Uploaded buffer to local: ${url}`)
      return { url, key: url }
    }
  }

  /**
   * Get file as buffer
   * @deprecated Legacy method for InvoiceService
   */
  async get(key: string): Promise<Buffer> {
    if (this.storageType === 'cloudinary') {
      // Download from Cloudinary URL
      const response = await fetch(key)
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } else {
      // Read from local filesystem
      const filePath = key.startsWith('/') ? path.join(this.localUploadDir, key.replace('/uploads/', '')) : key
      return fs.readFileSync(filePath)
    }
  }

  /**
   * Get signed/public URL for file
   * @deprecated Legacy method for InvoiceService
   */
  async getUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.storageType === 'cloudinary') {
      // Cloudinary URLs are already accessible, just return them
      // For private files, would use cloudinary.utils.private_download_url() but PDF are already secure URLs
      return key
    } else {
      // For local, return the URL directly (handled by Express static middleware)
      return key.startsWith('/') ? key : `/uploads/${key}`
    }
  }

  /**
   * Delete file by key
   * @deprecated Use deleteImage() instead, this is for backwards compat
   */
  async delete(key: string): Promise<void> {
    await this.deleteImage(key)
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

  private uploadToLocal(file: Express.Multer.File, folder: Folder, isPublic: boolean = true): string {
    try {
      // Determine storage category (public/private)
      const category: StorageCategory = isPublic ? 'public' : 'private'
      const folderPath = path.join(this.localUploadDir, category, folder)
      
      // Generate unique filename (sanitize: remove spaces and special chars)
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 8)
      const ext = path.extname(file.originalname)
      const baseName = path.parse(file.originalname).name
        .replace(/\s+/g, '_')  // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9_-]/g, '')  // Remove special characters except underscore and dash
        .substring(0, 50)  // Limit length to 50 chars
      const filename = `${baseName}_${timestamp}_${randomString}${ext}`

      // Move file to destination
      const destPath = path.join(folderPath, filename)
      fs.renameSync(file.path, destPath)

      // Return relative URL (public served by Express static, private served by authenticated endpoint)
      const relativeUrl = `/uploads/${category}/${folder}/${filename}`
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

  private async listFromCloudinary(folder: Folder): Promise<Array<{ url: string; publicId: string }>> {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: `echatbot/${folder}`,
        max_results: 500,
      })

      return result.resources.map((resource: any) => ({
        url: resource.secure_url,
        publicId: resource.public_id,
      }))
    } catch (error) {
      logger.error(`❌ Cloudinary list failed for folder ${folder}:`, error)
      return []
    }
  }

  private async listFromLocal(folder: Folder): Promise<Array<{ url: string; publicId: string }>> {
    try {
      const folderPath = path.join(this.localUploadDir, folder)
      
      if (!fs.existsSync(folderPath)) {
        return []
      }

      const files = fs.readdirSync(folderPath)
      
      return files
        .filter(file => !file.startsWith('.')) // Skip hidden files
        .map(file => ({
          url: `/uploads/${folder}/${file}`,
          publicId: file,
        }))
    } catch (error) {
      logger.error(`❌ Local list failed for folder ${folder}:`, error)
      return []
    }
  }

  private ensureLocalDirectories(): void {
    const folders: Folder[] = ['products', 'services', 'users', 'channels', 'workspaces']
    const categories: StorageCategory[] = ['public', 'private']
    
    // Create public and private subdirectories for each folder
    categories.forEach(category => {
      folders.forEach(folder => {
        const folderPath = path.join(this.localUploadDir, category, folder)
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true })
        }
      })
    })
    
    // Special folder for private documents (invoices, etc.)
    const privateDocsPath = path.join(this.localUploadDir, 'private', 'documents')
    if (!fs.existsSync(privateDocsPath)) {
      fs.mkdirSync(privateDocsPath, { recursive: true })
    }
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
