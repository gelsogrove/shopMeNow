import { Request, Response, NextFunction } from "express"
import { PrismaClient } from "@prisma/client"
import { CampaignService } from "../../../application/services/campaign.service"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()

/**
 * Controller for WhatsApp marketing campaigns
 */
export class CampaignController {
  private campaignService: CampaignService

  constructor() {
    this.campaignService = new CampaignService(prisma)
  }

  /**
   * Get all campaigns for a workspace
   */
  async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params

      const campaigns = await this.campaignService.findAllByWorkspace(workspaceId)

      res.json({ data: campaigns })
    } catch (error) {
      logger.error("Error getting campaigns:", error)
      next(error)
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params

      const campaign = await this.campaignService.findById(id, workspaceId)

      if (!campaign) {
        return res.status(404).json({ error: "Campagna non trovata" })
      }

      res.json(campaign)
    } catch (error) {
      logger.error("Error getting campaign:", error)
      next(error)
    }
  }

  /**
   * Create a new campaign
   */
  async createCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const {
        name,
        messagePreview,
        frequency,
        targetType,
        customerIds,
        templateName,
        templateParams,
        isActive,
      } = req.body

      // Validation
      if (!name || !messagePreview || !frequency || !targetType) {
        return res.status(400).json({
          error: "Campi obbligatori mancanti",
          message: "Nome, messaggio, frequenza e tipo destinatari sono obbligatori",
        })
      }

      // If targetType is SELECTED, customerIds must be provided
      if (targetType === "SELECTED" && (!customerIds || customerIds.length === 0)) {
        return res.status(400).json({
          error: "Destinatari mancanti",
          message:
            "Se selezioni 'Solo clienti specifici', devi fornire almeno un cliente",
        })
      }

      const campaign = await this.campaignService.create({
        workspaceId,
        name,
        messagePreview,
        frequency,
        targetType,
        customerIds: customerIds || [],
        templateName,
        templateParams,
        isActive,
      })

      res.status(201).json(campaign)
    } catch (error) {
      logger.error("Error creating campaign:", error)
      next(error)
    }
  }

  /**
   * Update a campaign
   */
  async updateCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const {
        name,
        messagePreview,
        frequency,
        targetType,
        customerIds,
        templateName,
        templateParams,
        isActive,
      } = req.body

      const campaign = await this.campaignService.update(id, workspaceId, {
        name,
        messagePreview,
        frequency,
        targetType,
        customerIds,
        templateName,
        templateParams,
        isActive,
      })

      if (!campaign) {
        return res.status(404).json({ error: "Campagna non trovata" })
      }

      res.json(campaign)
    } catch (error) {
      logger.error("Error updating campaign:", error)
      next(error)
    }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params

      const success = await this.campaignService.delete(id, workspaceId)

      if (!success) {
        return res.status(404).json({ error: "Campagna non trovata" })
      }

      res.status(204).send()
    } catch (error) {
      logger.error("Error deleting campaign:", error)
      next(error)
    }
  }

  /**
   * Toggle campaign active status
   */
  async toggleCampaignActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params

      const campaign = await this.campaignService.toggleActive(id, workspaceId)

      if (!campaign) {
        return res.status(404).json({ error: "Campagna non trovata" })
      }

      res.json({
        message: campaign.isActive ? "Campagna attivata" : "Campagna disattivata",
        campaign,
      })
    } catch (error) {
      logger.error("Error toggling campaign active status:", error)
      next(error)
    }
  }
}
