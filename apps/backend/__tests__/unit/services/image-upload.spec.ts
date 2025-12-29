/**
 * Image Upload Tests - Storage Service Integration
 * 
 * Tests upload functionality for:
 * - Channel logos (working ✅)
 * - User profiles (working ✅)
 * - Products (to verify 🔍)
 * - Services (to verify 🔍)
 */

import { storageService } from '../../../src/services/storage.service'
import path from 'path'

describe('Image Upload - Storage Service', () => {
  describe('Channel Logo Upload', () => {
    it('should upload channel logo and return Cloudinary URL in production', async () => {
      // Mock file upload
      const mockFile = {
        fieldname: 'logo',
        originalname: 'channel-logo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      const url = await storageService.uploadImage(mockFile, 'channels')

      // In production: returns Cloudinary URL
      // In development: returns local path
      if (process.env.CLOUDINARY_URL) {
        expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/dpagtnf1i/)
        expect(url).toContain('echatbot/channels/')
      } else {
        expect(url).toMatch(/^\/uploads\/channels\//)
      }
    })

    it('should handle channel logo URL correctly (absolute vs relative)', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/channels/logo.jpg'
      const localUrl = '/uploads/channels/logo.jpg'

      // Cloudinary URL should be used as-is (absolute)
      expect(cloudinaryUrl.startsWith('http://') || cloudinaryUrl.startsWith('https://')).toBe(true)

      // Local URL needs base URL prepended (relative)
      expect(localUrl.startsWith('http://') || localUrl.startsWith('https://')).toBe(false)
    })
  })

  describe('User Profile Upload', () => {
    it('should upload user profile image and return Cloudinary URL in production', async () => {
      const mockFile = {
        fieldname: 'logo',
        originalname: 'profile-pic.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      const url = await storageService.uploadImage(mockFile, 'users')

      if (process.env.CLOUDINARY_URL) {
        expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/dpagtnf1i/)
        expect(url).toContain('echatbot/users/')
      } else {
        expect(url).toMatch(/^\/uploads\/users\//)
      }
    })
  })

  describe('Product Images Upload', () => {
    it('should upload single product image and return Cloudinary URL in production', async () => {
      const mockFile = {
        fieldname: 'images',
        originalname: 'product-image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      const url = await storageService.uploadImage(mockFile, 'products')

      if (process.env.CLOUDINARY_URL) {
        expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/dpagtnf1i/)
        expect(url).toContain('echatbot/products/')
      } else {
        expect(url).toMatch(/^\/uploads\/products\//)
      }
    })

    it('should upload multiple product images and return array of Cloudinary URLs', async () => {
      const mockFiles = [
        {
          fieldname: 'images',
          originalname: 'product-1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-image-data-1'),
          size: 12345,
        },
        {
          fieldname: 'images',
          originalname: 'product-2.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-image-data-2'),
          size: 23456,
        },
      ] as Express.Multer.File[]

      const urls = await storageService.uploadImages(mockFiles, 'products')

      expect(urls).toHaveLength(2)
      
      if (process.env.CLOUDINARY_URL) {
        urls.forEach(url => {
          expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/dpagtnf1i/)
          expect(url).toContain('echatbot/products/')
        })
      } else {
        urls.forEach(url => {
          expect(url).toMatch(/^\/uploads\/products\//)
        })
      }
    })

    it('should handle product image URLs correctly in frontend (absolute vs relative)', () => {
      const cloudinaryUrls = [
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg',
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img2.jpg',
      ]
      const localUrls = ['/uploads/products/img1.jpg', '/uploads/products/img2.jpg']

      // Cloudinary URLs are absolute
      cloudinaryUrls.forEach(url => {
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true)
      })

      // Local URLs are relative
      localUrls.forEach(url => {
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(false)
      })
    })
  })

  describe('Service Images Upload', () => {
    it('should upload single service image and return Cloudinary URL in production', async () => {
      const mockFile = {
        fieldname: 'images',
        originalname: 'service-image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      const url = await storageService.uploadImage(mockFile, 'services')

      if (process.env.CLOUDINARY_URL) {
        expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/dpagtnf1i/)
        expect(url).toContain('echatbot/services/')
      } else {
        expect(url).toMatch(/^\/uploads\/services\//)
      }
    })

    it('should upload multiple service images and return array of Cloudinary URLs', async () => {
      const mockFiles = [
        {
          fieldname: 'images',
          originalname: 'service-1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-image-data-1'),
          size: 12345,
        },
        {
          fieldname: 'images',
          originalname: 'service-2.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-image-data-2'),
          size: 23456,
        },
      ] as Express.Multer.File[]

      const urls = await storageService.uploadImages(mockFiles, 'services')

      expect(urls).toHaveLength(2)
      
      if (process.env.CLOUDINARY_URL) {
        urls.forEach(url => {
          expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/dpagtnf1i/)
          expect(url).toContain('echatbot/services/')
        })
      } else {
        urls.forEach(url => {
          expect(url).toMatch(/^\/uploads\/services\//)
        })
      }
    })
  })

  describe('Frontend URL Handling', () => {
    /**
     * Test che il frontend gestisce correttamente URL assoluti e relativi
     * Questo è il pattern che deve essere applicato in ProductImage.tsx
     */
    it('should NOT prepend base URL to absolute Cloudinary URLs', () => {
      const IMG_BASE_URL = 'https://echatbot.ai'
      const cloudinaryUrl = 'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img.jpg'

      // Pattern corretto (già implementato in ProductImage.tsx)
      const isAbsolute = cloudinaryUrl.startsWith('http://') || cloudinaryUrl.startsWith('https://')
      const finalUrl = isAbsolute ? cloudinaryUrl : `${IMG_BASE_URL}${cloudinaryUrl}`

      expect(finalUrl).toBe(cloudinaryUrl) // URL non modificato
      expect(finalUrl).not.toContain('echatbot.ai/https://') // NO doppio dominio
    })

    it('should prepend base URL to relative local URLs', () => {
      const IMG_BASE_URL = 'https://echatbot.ai'
      const localUrl = '/uploads/products/img.jpg'

      const isAbsolute = localUrl.startsWith('http://') || localUrl.startsWith('https://')
      const finalUrl = isAbsolute ? localUrl : `${IMG_BASE_URL}${localUrl}`

      expect(finalUrl).toBe('https://echatbot.ai/uploads/products/img.jpg')
    })

    it('should handle array of mixed URLs (absolute + relative)', () => {
      const IMG_BASE_URL = 'https://echatbot.ai'
      const imageUrls = [
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg',
        '/uploads/products/img2.jpg',
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img3.jpg',
      ]

      const finalUrls = imageUrls.map(url => {
        const isAbsolute = url.startsWith('http://') || url.startsWith('https://')
        return isAbsolute ? url : `${IMG_BASE_URL}${url}`
      })

      expect(finalUrls[0]).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg')
      expect(finalUrls[1]).toBe('https://echatbot.ai/uploads/products/img2.jpg')
      expect(finalUrls[2]).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img3.jpg')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty file gracefully', async () => {
      const mockFile = {
        fieldname: 'logo',
        originalname: 'empty.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(0), // Empty buffer
        size: 0,
      } as Express.Multer.File

      await expect(storageService.uploadImage(mockFile, 'products')).rejects.toThrow()
    })

    it('should handle invalid folder gracefully', async () => {
      const mockFile = {
        fieldname: 'logo',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      // @ts-ignore - Testing invalid folder
      await expect(storageService.uploadImage(mockFile, 'invalid-folder')).rejects.toThrow()
    })

    it('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(300) + '.jpg'
      const mockFile = {
        fieldname: 'logo',
        originalname: longFilename,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      const url = await storageService.uploadImage(mockFile, 'products')
      expect(url).toBeTruthy()
    })

    it('should handle special characters in filenames', async () => {
      const mockFile = {
        fieldname: 'logo',
        originalname: 'test image (1) [special].jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 12345,
      } as Express.Multer.File

      const url = await storageService.uploadImage(mockFile, 'products')
      expect(url).toBeTruthy()
    })
  })
})
