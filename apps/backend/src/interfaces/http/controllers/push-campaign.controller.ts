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
        frequency,
        isActive,
        targetingType,
        targetCustomerIds,
        tagId,
        message,
        templateId,
        templateLocale,
        mediaUrl,
        sendAt,
        throttlePerSecond,
        batchSize,
      } = req.body

      const allowedFrequencies = ["ONCE", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL"]
      const allowedTargeting = ["ALL", "MANUAL", "TAGS"]

      if (!name) {
        return res.status(400).json({ error: "Name is required" })
      }
      if (!message) {
        return res.status(400).json({ error: "Message is required" })
      }
      if (!targetingType) {
        return res.status(400).json({ error: "Targeting type is required" })
      }
      const normalizedFrequency = frequency ? String(frequency).toUpperCase() : undefined
      const normalizedTargeting = normalizeTargetingType(targetingType)
      if (normalizedFrequency && !allowedFrequencies.includes(normalizedFrequency)) {
        return res.status(400).json({ error: "Invalid frequency" })
      }
      if (normalizedTargeting && !allowedTargeting.includes(normalizedTargeting)) {
        return res.status(400).json({ error: "Invalid targeting type" })
      }

      let normalizedSendAt: Date | string | null | undefined = undefined
      if (sendAt === undefined) {
        normalizedSendAt = undefined // let service decide default
      } else if (sendAt === null || sendAt === "") {
        normalizedSendAt = null
      } else {
        const parsed = new Date(sendAt)
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid send date/time" })
        }
        normalizedSendAt = parsed.toISOString()
      }

      const campaign = await service.create({
        workspaceId,
        createdByUserId,
        name,
        frequency: normalizedFrequency as any,
        isActive,
        targetingType: normalizedTargeting as any,
        targetCustomerIds,
        tagId,
        message,
        templateId,
        templateLocale,
        mediaUrl,
        sendAt: normalizedSendAt,
        throttlePerSecond,
        batchSize,
      })

      res.status(201).json(campaign)
    } catch (error) {
      logger.error("[PushCampaignController] create error", error)
      next(error)
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      const enabled = await ensureWhatsappEnabled(workspaceId)
      if (!enabled) {
        return res.status(400).json({
          error: "Push campaigns available only for WhatsApp-enabled workspaces",
        })
      }

      const allowedFrequencies = ["ONCE", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL"]
      const allowedTargeting = ["ALL", "MANUAL", "TAGS"]

      const body = req.body || {}

      if (!body.name) {
        return res.status(400).json({ error: "Name is required" })
      }
      if (!body.message) {
        return res.status(400).json({ error: "Message is required" })
      }
      if (body.targetingType && !allowedTargeting.includes(String(body.targetingType).toUpperCase())) {
        return res.status(400).json({ error: "Invalid targeting type" })
      }
      if (body.frequency && !allowedFrequencies.includes(String(body.frequency).toUpperCase())) {
        return res.status(400).json({ error: "Invalid frequency" })
      }

      // Normalize targeting type and strip accidental quotes (observed "\"MANUAL\"")
      const normalizedTargeting = normalizeTargetingType(body.targetingType)

      const payload: any = {
        ...body,
        name: String(body.name).trim(),
        message: String(body.message).trim(),
        frequency: body.frequency ? String(body.frequency).toUpperCase() : undefined,
        targetingType: normalizedTargeting,
      }

      // Normalize date
      if (body.sendAt === undefined) {
        // leave undefined (no change)
      } else if (body.sendAt === null || body.sendAt === "") {
        payload.sendAt = null
      } else {
        const parsed = new Date(body.sendAt)
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid send date/time" })
        }
        payload.sendAt = parsed
      }

      // Normalize numbers if provided
      if (body.throttlePerSecond !== undefined) {
        payload.throttlePerSecond = Number(body.throttlePerSecond)
      }
      if (body.batchSize !== undefined) {
        payload.batchSize = Number(body.batchSize)
      }

      const campaign = await service.update(workspaceId, id, payload)
      res.json(campaign)
    } catch (error) {
      logger.error("[PushCampaignController] update error", error)
      next(error)
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId, id } = req.params
      await service.delete(workspaceId, id)
      res.status(204).send()
    } catch (error) {
      logger.error("[PushCampaignController] delete error", error)
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
// Utility: normalize targeting type (handles values like "\"MANUAL\"" coming from buggy clients)
function normalizeTargetingType(raw: any): string | undefined {
  if (raw === undefined || raw === null) return undefined

  let val = String(raw).trim()

  // If it's a JSON-stringified string (e.g. "\"MANUAL\"") try to parse
  if (/^".*"$/.test(val) || /^\\?".*\\?"$/.test(val)) {
    try {
      val = JSON.parse(val)
    } catch {
      // ignore parse errors, fall back to stripping quotes
    }
  }

  // Remove any leading/trailing quotes or escaped quotes
  val = val.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "")

  const upper = val.toUpperCase()
  return upper.length ? upper : undefined
}
