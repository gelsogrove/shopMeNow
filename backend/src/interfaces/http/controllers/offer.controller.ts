import { PrismaClient } from "@prisma/client"
import { Request, Response } from "express"
import { BillingService } from "../../../application/services/billing.service"
import { OfferService } from "../../../application/services/offer.service"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()

/**
 * Gets the workspace ID from request parameters or query
 */
const getWorkspaceId = (req: Request): string | undefined => {
  return req.params.workspaceId || (req.query.workspaceId as string)
}

/**
 * OfferController class
 * Handles HTTP requests related to offers
 */
export class OfferController {
  private offerService: OfferService
  private billingService: BillingService

  constructor() {
    this.offerService = new OfferService()
    this.billingService = new BillingService(prisma)
  }

  /**
   * Get all offers for a workspace
   */
  async getAllOffers(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({
          error: "Workspace ID is required",
          message: "Missing workspaceId parameter",
        })
      }

      const offers = await this.offerService.getAllOffers(workspaceId)
      return res.json(offers)
    } catch (error) {
      logger.error("Error getting offers:", error)
      return res.status(500).json({ error: "Failed to get offers" })
    }
  }

  /**
   * Get active offers
   */
  async getActiveOffers(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req)
      const { categoryId } = req.query

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const offers = await this.offerService.getActiveOffers(
        workspaceId,
        categoryId as string | undefined
      )
      return res.json(offers)
    } catch (error) {
      logger.error("Error getting active offers:", error)
      return res.status(500).json({ error: "Failed to get active offers" })
    }
  }

  /**
   * Get offer by ID
   */
  async getOfferById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const offer = await this.offerService.getOfferById(id, workspaceId)

      if (!offer) {
        return res.status(404).json({ error: "Offer not found" })
      }

      return res.json(offer)
    } catch (error) {
      logger.error(`Error getting offer ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get offer" })
    }
  }

  /**
   * Create a new offer
   */
  async createOffer(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const offerData = { ...req.body, workspaceId }
      const offer = await this.offerService.createOffer(offerData)
      return res.status(201).json(offer)
    } catch (error) {
      logger.error("Error creating offer:", error)
      return res.status(500).json({ error: "Failed to create offer" })
    }
  }

  /**
   * Update an offer
   */
  async updateOffer(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      logger.info(
        `Updating offer ${id} in controller. Request body:`,
        JSON.stringify(req.body)
      )

      // Check if the offer exists before updating it
      const existingOffer = await this.offerService.getOfferById(
        id,
        workspaceId
      )
      if (!existingOffer) {
        return res.status(404).json({ error: "Offer not found" })
      }

      // Ensure the request belongs to the workspace
      const offerData = { ...req.body, workspaceId }

      // 💰 BILLING: Check if offer is being activated (false → true)
      const wasActive = existingOffer.isActive
      const willBeActive =
        offerData.isActive !== undefined ? offerData.isActive : wasActive
      const isBeingActivated = !wasActive && willBeActive

      try {
        const offer = await this.offerService.updateOffer(id, offerData)
        logger.info(`Offer ${id} successfully updated in controller`)

        return res.json(offer)
      } catch (serviceError) {
        logger.error(`Service error updating offer ${id}:`, serviceError)
        return res.status(500).json({
          error: "Failed to update offer",
          message:
            serviceError instanceof Error
              ? serviceError.message
              : "Unknown error",
        })
      }
    } catch (error) {
      logger.error(`Error updating offer ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to update offer" })
    }
  }

  /**
   * Delete an offer
   */
  async deleteOffer(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      // Check if the offer exists before deleting it
      const offer = await this.offerService.getOfferById(id, workspaceId)
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" })
      }

      const result = await this.offerService.deleteOffer(id)
      return res.json({ success: result })
    } catch (error) {
      logger.error(`Error deleting offer ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete offer" })
    }
  }
}
