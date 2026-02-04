import { NextFunction, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"
import { PushCampaignService } from "../../../application/services/push-campaign.service"
import { PushCampaignStatus, PushCampaignRecipientStatus } from "@echatbot/database"

const service = new PushCampaignService(prisma)

async function ensureWhatsappEnabled(workspaceId: string): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { enableWhatsapp: true },
  })
  return !!ws?.enableWhatsapp
}

export class PushCampaignController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const enabled = await ensureWhatsappEnabled(workspaceId)
      if (!enabled) {
        return res.status(400).json({ error: "Push campaigns available only for WhatsApp-enabled workspaces" })
      }
      const campaigns = await service.list(workspaceId)
      res.json({ data: campaigns })
    } catch (error) {
      logger.error("[PushCampaignController] list error", error)
      next(error)
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const enabled = await ensureWhatsappEnabled(workspaceId)
      if (!enabled) {
        return res.status(400).json({ error: "Push campaigns available only for WhatsApp-enabled workspaces" })
      }
      const campaign = await service.get(workspaceId, id)
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" })
      }
      res.json(campaign)
    } catch (error) {
      logger.error("[PushCampaignController] get error", error)
      next(error)
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const createdByUserId = (req.user as any)?.userId
      const {
        name,
        templateId,
        templateLocale,
        bodyPreview,
        mediaUrl,
        sendAt,
        recipients,
        throttlePerSecond,
        batchSize,
      } = req.body

      if (!name) {
        return res.status(400).json({ error: "Name is required" })
      }
      const hasCustomerIds =
        Array.isArray(recipients?.customerIds) && recipients.customerIds.length > 0
      const hasPhones =
        Array.isArray(recipients?.phones) && recipients.phones.length > 0
      const hasTags =
        Array.isArray(recipients?.tags)
          ? recipients.tags.length > 0
          : typeof recipients?.tags === "string"
            ? recipients.tags.trim().length > 0
            : false

      if (!recipients || (!hasCustomerIds && !hasPhones && !hasTags)) {
        return res
          .status(400)
          .json({ error: "At least one recipient list (customerIds, tags, or phones) is required" })
      }
      if (hasPhones) {
        return res
          .status(400)
          .json({ error: "Custom phone lists are not supported yet. Select existing customers." })
      }

      const campaign = await service.create({
        workspaceId,
        createdByUserId,
        name,
        templateId,
        templateLocale,
        bodyPreview,
        mediaUrl,
        sendAt,
        recipients,
        throttlePerSecond,
        batchSize,
      })

      res.status(201).json(campaign)
    } catch (error) {
      logger.error("[PushCampaignController] create error", error)
      next(error)
    }
  }

  async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const { sendAt } = req.body
      const date = sendAt ? new Date(sendAt) : new Date()
      const ok = await service.updateStatus(workspaceId, id, PushCampaignStatus.SCHEDULED, date)
      if (!ok) return res.status(404).json({ error: "Campaign not found" })
      res.json({ message: "Campaign scheduled", sendAt: date })
    } catch (error) {
      logger.error("[PushCampaignController] schedule error", error)
      next(error)
    }
  }

  async runNow(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const now = new Date()
      const ok = await service.updateStatus(workspaceId, id, PushCampaignStatus.SCHEDULED, now)
      if (!ok) return res.status(404).json({ error: "Campaign not found" })
      res.json({ message: "Campaign queued for immediate run", sendAt: now })
    } catch (error) {
      logger.error("[PushCampaignController] runNow error", error)
      next(error)
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const ok = await service.updateStatus(workspaceId, id, PushCampaignStatus.PAUSED)
      if (!ok) return res.status(404).json({ error: "Campaign not found" })
      res.json({ message: "Campaign paused" })
    } catch (error) {
      logger.error("[PushCampaignController] pause error", error)
      next(error)
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const ok = await service.updateStatus(workspaceId, id, PushCampaignStatus.SCHEDULED)
      if (!ok) return res.status(404).json({ error: "Campaign not found" })
      res.json({ message: "Campaign resumed" })
    } catch (error) {
      logger.error("[PushCampaignController] resume error", error)
      next(error)
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const ok = await service.updateStatus(workspaceId, id, PushCampaignStatus.CANCELLED)
      if (!ok) return res.status(404).json({ error: "Campaign not found" })
      res.json({ message: "Campaign cancelled" })
    } catch (error) {
      logger.error("[PushCampaignController] cancel error", error)
      next(error)
    }
  }

  async recipients(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const enabled = await ensureWhatsappEnabled(workspaceId)
      if (!enabled) {
        return res.status(400).json({ error: "Push campaigns available only for WhatsApp-enabled workspaces" })
      }
      const { skip = 0, take = 50, status } = req.query
      const recipients = await service.listRecipients(
        workspaceId,
        id,
        Number(skip),
        Number(take),
        status ? (status as PushCampaignRecipientStatus) : undefined
      )
      res.json({ data: recipients })
    } catch (error) {
      logger.error("[PushCampaignController] recipients error", error)
      next(error)
    }
  }
}
