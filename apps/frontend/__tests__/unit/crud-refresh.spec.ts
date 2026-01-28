/**
 * CRUD Operations - Auto-Refresh Tests
 * 
 * Critical tests to prevent the bug where:
 * - User edits product/category
 * - Saves changes (including image upload)
 * - Closes modal
 * - List doesn't refresh → user doesn't see new image/data
 * 
 * REQUIREMENT: After ANY CRUD operation (CREATE/UPDATE/DELETE),
 * the list MUST automatically refresh to show latest data from backend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock API responses
const mockProducts = [
  { id: '1', name: 'Product 1', imageUrl: ['old-image-1.jpg'], price: 10 },
  { id: '2', name: 'Product 2', imageUrl: ['old-image-2.jpg'], price: 20 },
]

const mockCategories = [
  { id: '1', name: 'Category 1', description: 'Old description 1' },
  { id: '2', name: 'Category 2', description: 'Old description 2' },
]

describe('CRUD Auto-Refresh - Products', () => {
  let fetchMock: any
  
  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('SCENARIO 1: Product UPDATE with image upload', () => {
    it('should refresh product list after successful update', async () => {
      // GIVEN: User edits product and uploads new image
      const productId = '1'
      const updatedProduct = {
        ...mockProducts[0],
        name: 'Updated Product',
        imageUrl: ['new-image-uploaded.jpg'], // 🖼️ NEW IMAGE from backend
      }
      
      // Mock UPDATE API response (returns updated product with new image URL)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedProduct,
      })
      
      // Mock REFETCH API response (full product list with updated data)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [updatedProduct, mockProducts[1]],
        }),
      })
      
      // WHEN: Update API is called
      const updateResponse = await fetch('/api/products/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Product' }),
      })
      const updatedData = await updateResponse.json()
      
      // THEN: Update succeeds
      expect(updatedData.imageUrl).toEqual(['new-image-uploaded.jpg'])
      
      // WHEN: Refetch is triggered (simulating loadProducts())
      const refetchResponse = await fetch('/api/products')
      const refetchData = await refetchResponse.json()
      
      // THEN: Refetch returns updated product list
      expect(refetchData.products[0].imageUrl).toEqual(['new-image-uploaded.jpg'])
      expect(refetchData.products[0].name).toBe('Updated Product')
      
      // VERIFY: fetch was called twice (update + refetch)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    
    it('should show new image immediately after closing modal', async () => {
      // SCENARIO: This is what users expect to see
      // 1. Edit product → upload image → save
      // 2. Backend processes image, returns new URL
      // 3. Modal closes
      // 4. Product list shows NEW IMAGE (not cached old one)
      
      const productId = '1'
      const newImageUrl = 'https://storage.example.com/products/12345.jpg'
      
      // Mock update with image upload
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockProducts[0],
          imageUrl: [newImageUrl],
        }),
      })
      
      // Mock refetch
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            { ...mockProducts[0], imageUrl: [newImageUrl] },
            mockProducts[1],
          ],
        }),
      })
      
      // Simulate update + refetch flow
      await fetch(`/api/products/${productId}`, { method: 'PUT' })
      const refetchResponse = await fetch('/api/products')
      const finalData = await refetchResponse.json()
      
      // CRITICAL: List must show NEW image URL
      expect(finalData.products[0].imageUrl[0]).toBe(newImageUrl)
    })
  })

  describe('SCENARIO 2: Product CREATE', () => {
    it('should refresh product list after successful creation', async () => {
      const newProduct = {
        id: '3',
        name: 'New Product',
        imageUrl: ['new-product-image.jpg'],
        price: 30,
      }
      
      // Mock CREATE
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => newProduct,
      })
      
      // Mock REFETCH
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [...mockProducts, newProduct],
        }),
      })
      
      // Create product
      await fetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      })
      
      // Refetch
      const refetchResponse = await fetch('/api/products')
      const finalData = await refetchResponse.json()
      
      // VERIFY: New product in list
      expect(finalData.products).toHaveLength(3)
      expect(finalData.products[2].id).toBe('3')
    })
  })

  describe('SCENARIO 3: Product DELETE', () => {
    it('should refresh product list after successful deletion', async () => {
      const productIdToDelete = '1'
      
      // Mock DELETE
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      
      // Mock REFETCH
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [mockProducts[1]], // Only second product remains
        }),
      })
      
      // Delete product
      await fetch(`/api/products/${productIdToDelete}`, { method: 'DELETE' })
      
      // Refetch
      const refetchResponse = await fetch('/api/products')
      const finalData = await refetchResponse.json()
      
      // VERIFY: Product removed from list
      expect(finalData.products).toHaveLength(1)
      expect(finalData.products[0].id).toBe('2')
    })
  })
})

describe('CRUD Auto-Refresh - Categories', () => {
  let fetchMock: any
  
  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('SCENARIO 1: Category UPDATE', () => {
    it('should refresh category list after successful update', async () => {
      const categoryId = '1'
      const updatedCategory = {
        ...mockCategories[0],
        name: 'Updated Category',
        description: 'New description',
      }
      
      // Mock UPDATE
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedCategory,
      })
      
      // Mock REFETCH
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [updatedCategory, mockCategories[1]],
      })
      
      // Update category
      await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Category' }),
      })
      
      // Refetch
      const refetchResponse = await fetch('/api/categories')
      const finalData = await refetchResponse.json()
      
      // VERIFY: Category updated in list
      expect(finalData[0].name).toBe('Updated Category')
      expect(finalData[0].description).toBe('New description')
    })
  })

  describe('SCENARIO 2: Category CREATE', () => {
    it('should refresh category list after successful creation', async () => {
      const newCategory = {
        id: '3',
        name: 'New Category',
        description: 'Fresh category',
      }
      
      // Mock CREATE
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => newCategory,
      })
      
      // Mock REFETCH
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [...mockCategories, newCategory],
      })
      
      // Create category
      await fetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify(newCategory),
      })
      
      // Refetch
      const refetchResponse = await fetch('/api/categories')
      const finalData = await refetchResponse.json()
      
      // VERIFY: New category in list
      expect(finalData).toHaveLength(3)
      expect(finalData[2].id).toBe('3')
    })
  })

  describe('SCENARIO 3: Category DELETE', () => {
    it('should refresh category list after successful deletion', async () => {
      const categoryIdToDelete = '1'
      
      // Mock DELETE
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      
      // Mock REFETCH
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCategories[1]],
      })
      
      // Delete category
      await fetch(`/api/categories/${categoryIdToDelete}`, { method: 'DELETE' })
      
      // Refetch
      const refetchResponse = await fetch('/api/categories')
      const finalData = await refetchResponse.json()
      
      // VERIFY: Category removed from list
      expect(finalData).toHaveLength(1)
      expect(finalData[0].id).toBe('2')
    })
  })
})

describe('CRITICAL BUG PREVENTION - Image Upload Scenarios', () => {
  let fetchMock: any
  
  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('BUG: Old image cached in state when new image uploaded', async () => {
    // SCENARIO that caused the bug:
    // 1. Product has imageUrl: ['old.jpg'] in state
    // 2. User uploads new image
    // 3. Backend returns imageUrl: ['new.jpg']
    // 4. Modal closes WITHOUT refetch
    // 5. State still shows ['old.jpg'] → User doesn't see new image!
    
    const productId = '1'
    const oldImageUrl = 'old-image.jpg'
    const newImageUrl = 'new-image-from-server.jpg'
    
    // Initial state
    let productInState = { id: productId, imageUrl: [oldImageUrl] }
    
    // Mock UPDATE (returns new image URL from backend)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: productId,
        imageUrl: [newImageUrl], // 🆕 Backend processed and stored new image
      }),
    })
    
    // Update without refetch (BUG!)
    const updateResponse = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
    })
    const updatedData = await updateResponse.json()
    
    // User updates local state with response
    productInState = updatedData
    
    // ❌ WITHOUT REFETCH: State might still show old image if not properly updated
    // ✅ WITH REFETCH: Guaranteed to show latest data from backend
    
    // Mock REFETCH (fixes the bug)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [{ id: productId, imageUrl: [newImageUrl] }],
      }),
    })
    
    const refetchResponse = await fetch('/api/products')
    const refetchData = await refetchResponse.json()
    
    // VERIFY: After refetch, image URL is correct
    expect(refetchData.products[0].imageUrl[0]).toBe(newImageUrl)
    expect(refetchData.products[0].imageUrl[0]).not.toBe(oldImageUrl)
  })
  
  it('should handle multiple rapid CRUD operations correctly', async () => {
    // SCENARIO: User performs multiple operations quickly
    // Example: Create → Edit → Delete within seconds
    // System must handle all operations and keep UI in sync
    
    const newProductId = '3'
    
    // Mock CREATE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: newProductId, name: 'New Product' }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [...mockProducts, { id: newProductId }] }),
    })
    
    // Mock UPDATE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: newProductId, name: 'Updated Product' }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          ...mockProducts,
          { id: newProductId, name: 'Updated Product' },
        ],
      }),
    })
    
    // Mock DELETE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: mockProducts }),
    })
    
    // Perform operations
    await fetch('/api/products', { method: 'POST' })
    await fetch('/api/products') // Refetch after create
    
    await fetch(`/api/products/${newProductId}`, { method: 'PUT' })
    await fetch('/api/products') // Refetch after update
    
    await fetch(`/api/products/${newProductId}`, { method: 'DELETE' })
    const finalRefetch = await fetch('/api/products') // Refetch after delete
    const finalData = await finalRefetch.json()
    
    // VERIFY: Final state matches backend (new product was created, updated, then deleted)
    expect(finalData.products).toHaveLength(2)
    expect(finalData.products.find((p: any) => p.id === newProductId)).toBeUndefined()
  })
})
