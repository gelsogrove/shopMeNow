import {
  Prisma,
  PrismaClient,
  PushCampaignStatus,
  PushCampaignRecipientStatus,
} from "@echatbot/database"
import { PushCampaignRepository } from "../../repositories/push-campaign.repository"
import { platformConfigService } from "../../services/platform-config.service"
import logger from "../../utils/logger"

export interface CreatePushCampaignDTO {
  workspaceId: string
  createdByUserId?: string
  name: string
  templateId?: string
  templateLocale?: string
  bodyPreview?: string
  mediaUrl?: string
  sendAt?: Date | string | null
  recipients: {
    customerIds?: string[]
    phones?: string[]
  }
  throttlePerSecond?: number
  batchSize?: number
}

export class PushCampaignService {
  private repo: PushCampaignRepository
  constructor(private readonly prisma: PrismaClient) {
    this.repo = new PushCampaignRepository(prisma)
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/\s+/g, "")
  }

  async create(input: CreatePushCampaignDTO) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { enableWhatsapp: true, ownerId: true },
    })
    if (!workspace || !workspace.enableWhatsapp) {
      throw new Error("Push campaigns are available only for WhatsApp-enabled workspaces")
    }
    if (!workspace.ownerId) {
      throw new Error("Workspace owner not found for credit check")
    }

    const sendAt =
      typeof input.sendAt === "string"
        ? new Date(input.sendAt)
        : input.sendAt ?? null

    // Read cost/throttle defaults
    const costItem = await platformConfigService.getPrice("PUSH_CAMPAIGN").catch(() => null)
    const limitThrottle = await platformConfigService
      .getLimit("PUSH_THROTTLE_PER_SEC")
      .catch(() => null)
    const limitBatch = await platformConfigService
      .getLimit("PUSH_BATCH_SIZE")
      .catch(() => null)

    const costPerMessage = typeof costItem === "number" ? costItem : 1

    const throttlePerSecond = Number(
      input.throttlePerSecond ?? limitThrottle ?? 10
    )
    const batchSize = Number(input.batchSize ?? limitBatch ?? 50)

    // Build recipients
    const recipients: Array<{
      workspaceId: string
      customerId?: string
      phone: string
      status: PushCampaignRecipientStatus
      errorCode?: string
      errorMessage?: string
      isBlacklisted?: boolean
      optOutAt?: Date | null
    }> = []

    const customerIds = input.recipients.customerIds || []
    if (customerIds.length > 0) {
      const customers = await this.prisma.customers.findMany({
        where: {
          workspaceId: input.workspaceId,
          id: { in: customerIds },
        },
        select: {
          id: true,
          phone: true,
          isBlacklisted: true,
          push_notifications_consent: true,
          push_notifications_consent_at: true,
        },
      })

      for (const c of customers) {
        const phone = c.phone ? this.sanitizePhone(c.phone) : ""
        if (!phone) {
          continue
        }
        if (c.isBlacklisted) {
          recipients.push({
            workspaceId: input.workspaceId,
            customerId: c.id,
            phone,
            status: PushCampaignRecipientStatus.SKIPPED,
            errorCode: "BLACKLISTED",
            errorMessage: "Customer is blacklisted",
            isBlacklisted: true,
          })
          continue
        }
        if (!c.push_notifications_consent) {
          recipients.push({
            workspaceId: input.workspaceId,
            customerId: c.id,
            phone,
            status: PushCampaignRecipientStatus.SKIPPED,
            errorCode: "OPT_OUT",
            errorMessage: "Marketing opt-in missing",
            optOutAt: c.push_notifications_consent_at ?? undefined,
          })
          continue
        }
        recipients.push({
          workspaceId: input.workspaceId,
          customerId: c.id,
          phone,
          status: PushCampaignRecipientStatus.PENDING,
        })
      }
    }

    const phones = input.recipients.phones || []
    if (phones.length > 0) {
      // For now we support only known customers (customerId required for WhatsAppQueue)
      throw new Error("Custom phone lists are not supported yet. Please select existing customers.")
    }

    if (recipients.length === 0) {
      throw new Error("No valid recipients provided")
    }

    // Credit check on owner
    const owner = await this.prisma.user.findUnique({
      where: { id: workspace.ownerId },
      select: { creditBalance: true },
    })
    if (!owner) {
      throw new Error("Owner not found for credit check")
    }
    const estimatedCost = new Prisma.Decimal(costPerMessage).mul(recipients.length)
    if (owner.creditBalance.lt(estimatedCost)) {
      throw new Error("Insufficient credit for campaign")
    }

    const initialStatus =
      sendAt && sendAt > new Date()
        ? PushCampaignStatus.SCHEDULED
        : PushCampaignStatus.SCHEDULED // run-now handled by worker picking immediately

    const campaign = await this.repo.createCampaign(
      {
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        name: input.name,
        templateId: input.templateId,
        templateLocale: input.templateLocale,
        bodyPreview: input.bodyPreview,
        mediaUrl: input.mediaUrl,
        sendAt: sendAt,
        costPerMessage: new Prisma.Decimal(costPerMessage),
        throttlePerSecond,
        batchSize,
        status: initialStatus,
      },
      recipients
    )

    return campaign
  }

  async list(workspaceId: string) {
    return this.repo.listByWorkspace(workspaceId)
  }

  async get(workspaceId: string, id: string) {
    return this.repo.findById(id, workspaceId)
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: PushCampaignStatus,
    sendAt?: Date | null
  ) {
    const result = await this.repo.updateStatus(id, workspaceId, status, sendAt)
    return result.count > 0
  }

  async listRecipients(
    workspaceId: string,
    campaignId: string,
    skip = 0,
    take = 50,
    status?: PushCampaignRecipientStatus
  ) {
    return this.repo.listRecipients(campaignId, workspaceId, skip, take, status)
  }
}
