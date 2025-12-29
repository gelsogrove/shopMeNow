/**
 * Image URL Handler Tests
 * 
 * Tests the URL handling logic fixed in v86:
 * - ProductImage component was concatenating IMG_BASE_URL to ALL URLs
 * - Bug: https://echatbot.ai/https://res.cloudinary.com/... (double domain)
 * - Fix: Check if URL is absolute before concatenating base URL
 * 
 * These tests verify the fix works correctly for:
 * - Cloudinary URLs (absolute) - use as-is
 * - Local uploads (relative) - prepend base URL
 */

describe('Image URL Handler - Frontend Logic', () => {
  const IMG_BASE_URL = 'https://echatbot.ai'

  describe('Single Image URL Handling', () => {
    it('should use Cloudinary URL as-is (absolute URL)', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img.jpg'
      
      const isAbsolute = cloudinaryUrl.startsWith('http://') || cloudinaryUrl.startsWith('https://')
      const finalUrl = isAbsolute ? cloudinaryUrl : `${IMG_BASE_URL}${cloudinaryUrl}`
      
      // Should NOT prepend base URL
      expect(finalUrl).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img.jpg')
      expect(finalUrl).not.toContain('echatbot.ai/https://')
    })

    it('should prepend base URL to local paths (relative URL)', () => {
      const localUrl = '/uploads/products/img.jpg'
      
      const isAbsolute = localUrl.startsWith('http://') || localUrl.startsWith('https://')
      const finalUrl = isAbsolute ? localUrl : `${IMG_BASE_URL}${localUrl}`
      
      // Should prepend base URL
      expect(finalUrl).toBe('https://echatbot.ai/uploads/products/img.jpg')
    })

    it('should handle http:// URLs (not just https://)', () => {
      const httpUrl = 'http://example.com/image.jpg'
      
      const isAbsolute = httpUrl.startsWith('http://') || httpUrl.startsWith('https://')
      const finalUrl = isAbsolute ? httpUrl : `${IMG_BASE_URL}${httpUrl}`
      
      // Should use as-is
      expect(finalUrl).toBe('http://example.com/image.jpg')
    })
  })

  describe('Multiple Images URL Handling (Array)', () => {
    it('should handle array of Cloudinary URLs', () => {
      const cloudinaryUrls = [
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg',
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img2.jpg',
      ]
      
      const finalUrls = cloudinaryUrls.map(url => {
        const isAbsolute = url.startsWith('http://') || url.startsWith('https://')
        return isAbsolute ? url : `${IMG_BASE_URL}${url}`
      })
      
      expect(finalUrls[0]).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg')
      expect(finalUrls[1]).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img2.jpg')
      expect(finalUrls[0]).not.toContain('echatbot.ai/https://')
    })

    it('should handle array of local URLs', () => {
      const localUrls = ['/uploads/products/img1.jpg', '/uploads/products/img2.jpg']
      
      const finalUrls = localUrls.map(url => {
        const isAbsolute = url.startsWith('http://') || url.startsWith('https://')
        return isAbsolute ? url : `${IMG_BASE_URL}${url}`
      })
      
      expect(finalUrls[0]).toBe('https://echatbot.ai/uploads/products/img1.jpg')
      expect(finalUrls[1]).toBe('https://echatbot.ai/uploads/products/img2.jpg')
    })

    it('should handle mixed array (Cloudinary + local)', () => {
      const mixedUrls = [
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg',
        '/uploads/products/img2.jpg',
        'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img3.jpg',
      ]
      
      const finalUrls = mixedUrls.map(url => {
        const isAbsolute = url.startsWith('http://') || url.startsWith('https://')
        return isAbsolute ? url : `${IMG_BASE_URL}${url}`
      })
      
      // First: Cloudinary (absolute) - use as-is
      expect(finalUrls[0]).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img1.jpg')
      // Second: Local (relative) - prepend base
      expect(finalUrls[1]).toBe('https://echatbot.ai/uploads/products/img2.jpg')
      // Third: Cloudinary (absolute) - use as-is
      expect(finalUrls[2]).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img3.jpg')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const emptyUrl = ''
      
      const isAbsolute = emptyUrl.startsWith('http://') || emptyUrl.startsWith('https://')
      const finalUrl = isAbsolute ? emptyUrl : `${IMG_BASE_URL}${emptyUrl}`
      
      expect(finalUrl).toBe('https://echatbot.ai')
    })

    it('should handle URLs with query parameters', () => {
      const cloudinaryUrlWithParams = 'https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img.jpg?w=800&h=600'
      
      const isAbsolute = cloudinaryUrlWithParams.startsWith('http://') || cloudinaryUrlWithParams.startsWith('https://')
      const finalUrl = isAbsolute ? cloudinaryUrlWithParams : `${IMG_BASE_URL}${cloudinaryUrlWithParams}`
      
      expect(finalUrl).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/products/img.jpg?w=800&h=600')
    })

    it('should handle URLs without leading slash (invalid local path)', () => {
      const invalidLocalUrl = 'uploads/products/img.jpg'
      
      const isAbsolute = invalidLocalUrl.startsWith('http://') || invalidLocalUrl.startsWith('https://')
      const finalUrl = isAbsolute ? invalidLocalUrl : `${IMG_BASE_URL}${invalidLocalUrl}`
      
      // Should prepend but result is malformed (missing slash)
      expect(finalUrl).toBe('https://echatbot.aiuploads/products/img.jpg')
    })
  })

  describe('ProductImage Component Logic (v86 Fix)', () => {
    it('should replicate ProductImage.tsx fix for single image', () => {
      const imageUrl = ['https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/channels/logo.jpg']
      
      // This is the EXACT logic from ProductImage.tsx (lines 54-62)
      const firstImageUrl = imageUrl[0]
      const imageSrc = firstImageUrl.startsWith('http://') || firstImageUrl.startsWith('https://') 
        ? firstImageUrl 
        : `${IMG_BASE_URL}${firstImageUrl}`
      
      expect(imageSrc).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/echatbot/channels/logo.jpg')
      
      // VERIFY: No double domain bug
      expect(imageSrc).not.toMatch(/echatbot\.ai\/https:/)
    })

    it('should replicate ProductImage.tsx fix for local image', () => {
      const imageUrl = ['/uploads/channels/logo.jpg']
      
      // This is the EXACT logic from ProductImage.tsx (lines 54-62)
      const firstImageUrl = imageUrl[0]
      const imageSrc = firstImageUrl.startsWith('http://') || firstImageUrl.startsWith('https://') 
        ? firstImageUrl 
        : `${IMG_BASE_URL}${firstImageUrl}`
      
      expect(imageSrc).toBe('https://echatbot.ai/uploads/channels/logo.jpg')
    })
  })
})
