import { Request, Response } from "express"
import { SupplierService } from "../../../application/services/supplier.service"
import logger from "../../../utils/logger"

export class SupplierController {
  private supplierService: SupplierService

  constructor() {
    this.supplierService = new SupplierService()
  }

  async getSuppliers(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId

      const suppliers = await this.supplierService.getAllSuppliers(workspaceId)

      return res.json(suppliers)
    } catch (error) {
      logger.error("Error fetching suppliers:", error)
      return res.status(500).json({
        error: "Failed to fetch suppliers",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  async getSupplierById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      const supplier = await this.supplierService.getSupplierById(
        id,
        workspaceId
      )

      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" })
      }

      return res.json(supplier)
    } catch (error) {
      logger.error("Error fetching supplier:", error)
      return res.status(500).json({
        error: "Failed to fetch supplier",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  async createSupplier(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      
      // DEBUG: Log everything about the request
      logger.info('=== CREATE SUPPLIER DEBUG ===')
      logger.info('req.body:', req.body)
      logger.info('req.file:', req.file)
      logger.info('workspaceId:', workspaceId)
      
      const {
        companyName,
        description,
        website,
        phone,
        email,
        contactName,
        region,
        country,
      } = req.body

      if (!companyName) {
        return res.status(400).json({ error: "Company name is required" })
      }

      // Handle logo upload
      let logoUrl: string | undefined
      if (req.file) {
        logoUrl = `/uploads/suppliers/${req.file.filename}`
        logger.info(`✅ Logo uploaded: ${logoUrl}`)
      } else {
        logger.warn('⚠️ No file received in req.file')
      }

      const supplierData = {
        companyName,
        description,
        website,
        phone,
        email,
        contactName,
        region,
        country,
        logoUrl,
        workspaceId,
      }
      
      logger.info('Supplier data to create:', supplierData)

      const supplier = await this.supplierService.createSupplier(supplierData)

      logger.info(`✅ Supplier created: ${supplier.companyName}, ID: ${supplier.id}, logoUrl: ${supplier.logoUrl}`)

      return res.status(201).json(supplier)
    } catch (error) {
      logger.error("Error creating supplier:", error)
      return res.status(500).json({
        error: "Failed to create supplier",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  async updateSupplier(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId
      const {
        companyName,
        description,
        website,
        phone,
        email,
        contactName,
        region,
        country,
        existingLogoUrl,
        isActive,
      } = req.body

      // Handle logo upload
      let logoUrl: string | undefined = existingLogoUrl
      if (req.file) {
        logoUrl = `/uploads/suppliers/${req.file.filename}`
        logger.info(`New logo uploaded: ${logoUrl}`)
      }

      const supplier = await this.supplierService.updateSupplier(
        id,
        workspaceId,
        {
          companyName,
          description,
          website,
          phone,
          email,
          contactName,
          region,
          country,
          logoUrl,
          isActive,
        }
      )

      logger.info(`✅ Supplier updated: ${supplier.companyName}`)

      return res.json(supplier)
    } catch (error) {
      logger.error("Error updating supplier:", error)
      return res.status(500).json({
        error: "Failed to update supplier",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  async deleteSupplier(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      // Check if supplier has products
      const supplier = await this.supplierService.getSupplierById(id, workspaceId)
      
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" })
      }

      // Count products linked to this supplier (safely)
      const productCount = (supplier as any)._count?.products || 0
      
      if (productCount > 0) {
        logger.warn(`❌ Cannot delete supplier ${supplier.companyName} - has ${productCount} products`)
        return res.status(400).json({ 
          error: "Cannot delete supplier",
          message: `This supplier has ${productCount} product(s) linked. Remove the products first or assign them to another supplier.`
        })
      }

      // Delete logo file if exists
      if (supplier.logoUrl) {
        const fs = require('fs')
        const path = require('path')
        const filePath = path.join(process.cwd(), 'uploads', 'suppliers', path.basename(supplier.logoUrl))
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          logger.info(`🗑️ Deleted logo file: ${filePath}`)
        }
      }

      const deletedSupplier = await this.supplierService.deleteSupplier(
        id,
        workspaceId
      )

      logger.info(`✅ Supplier deleted: ${deletedSupplier.companyName}`)

      return res.json({ message: "Supplier deleted successfully", supplier: deletedSupplier })
    } catch (error) {
      logger.error("Error deleting supplier:", error)
      return res.status(500).json({
        error: "Failed to delete supplier",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
