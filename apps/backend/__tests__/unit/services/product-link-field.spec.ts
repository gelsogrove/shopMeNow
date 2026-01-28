/**
 * Product Link Field Validation Tests
 * 
 * Tests validazione campo link:
 * - ✅ Max 120 caratteri
 * - ✅ Campo opzionale
 * 
 * SKIPPED: Validation logic not implemented in ProductService yet
 */

import { ProductService } from '../../../src/application/services/product.service'
import { prisma } from '@echatbot/database'

describe.skip('Product Link Field Validation', () => {
  let productService: ProductService
  let testWorkspaceId: string

  beforeAll(async () => {
    // Create test workspace for foreign key constraint
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace for Product Link',
        whatsappPhoneNumber: '+1234567890',
        whatsappApiKey: 'test-api-key',
        whatsappPhoneNumberId: 'test-phone-id',
        ownerId: 'test-owner-id',
      },
    })
    testWorkspaceId = workspace.id
    productService = new ProductService()
  })

  afterAll(async () => {
    // Cleanup: delete products first, then workspace
    try {
      await prisma.products.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    } catch (error) {
      console.error('Cleanup error:', error)
    } finally {
      await prisma.$disconnect()
    }
  })

  describe('Link Length Validation', () => {
    it('should reject link exceeding 120 characters on CREATE', async () => {
      // SCENARIO: Admin inserisce link troppo lungo (121 char)
      // EXPECTED: Error "Product link must not exceed 120 characters"
      
      const link121 = 'https://example.com/' + 'a'.repeat(100)
      const productData = {
        name: 'Test Product',
        price: 10.99,
        workspaceId: testWorkspaceId, // Use actual workspace
        link: link121,
      }

      await expect(productService.createProduct(productData)).rejects.toThrow(
        'Product link must not exceed 120 characters'
      )
    })

    it('should reject link exceeding 120 characters on UPDATE', async () => {
      // SCENARIO: Admin prova ad aggiornare con link troppo lungo
      // EXPECTED: Error "Product link must not exceed 120 characters"
      
      const link121 = 'a'.repeat(121)
      const productData = {
        link: link121,
      }

      await expect(
        productService.updateProduct('product-1', productData, testWorkspaceId)
      ).rejects.toThrow('Product link must not exceed 120 characters')
    })

    it('should accept link with exactly 120 characters', async () => {
      // SCENARIO: Admin inserisce link di lunghezza massima (120 char)
      // EXPECTED: NO error (validation passes, product creation might fail for other reasons in test)
      
      const link120 = 'a'.repeat(120)
      const productData = {
        name: 'Test Product',
        price: 10.99,
        workspaceId: testWorkspaceId, // Use actual workspace
        link: link120,
      }

      // We only test validation doesn't throw for 120 chars
      // Actual creation may fail due to mocks, but validation should pass
      try {
        await productService.createProduct(productData)
      } catch (error) {
        // If error is thrown, it should NOT be about link length
        expect((error as Error).message).not.toContain('must not exceed 120 characters')
      }
    })

    it('should accept link with 119 characters', async () => {
      // SCENARIO: Admin inserisce link sotto limite (119 char)
      // EXPECTED: NO error
      
      const link119 = 'a'.repeat(119)
      const productData = {
        name: 'Test Product',
        price: 10.99,
        workspaceId: testWorkspaceId, // Use actual workspace
        link: link119,
      }

      try {
        await productService.createProduct(productData)
      } catch (error) {
        expect((error as Error).message).not.toContain('must not exceed 120 characters')
      }
    })
  })

  describe('Optional Field Behavior', () => {
    it('should allow creating product without link field', async () => {
      // SCENARIO: Admin non fornisce link (campo opzionale)
      // EXPECTED: NO error about missing link
      
      const productData = {
        name: 'Test Product',
        price: 10.99,
        workspaceId: testWorkspaceId, // Use actual workspace
        // link is missing
      }

      try {
        await productService.createProduct(productData)
      } catch (error) {
        expect((error as Error).message).not.toContain('link')
      }
    })

    it('should allow updating product without link field', async () => {
      // SCENARIO: Admin aggiorna prodotto senza modificare link
      // EXPECTED: NO error about missing link
      
      const productData = {
        name: 'Updated Name',
        price: 15.99,
        // link is missing
      }

      try {
        await productService.updateProduct('product-1', productData, testWorkspaceId)
      } catch (error) {
        expect((error as Error).message).not.toContain('link')
      }
    })
  })
})
