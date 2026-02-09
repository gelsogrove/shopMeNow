import {
  Prisma,
  PrismaClient,
  PushCampaignStatus,
  PushCampaignRecipientStatus,
  CampaignFrequency,
  CampaignTargetType,
} from "@echatbot/database"
import {
  PushCampaignRepository,
  UpdatePushCampaignInput,
} from "../../repositories/push-campaign.repository"
import { platformConfigService } from "../../services/platform-config.service"
import logger from "../../utils/logger"

export interface CreatePushCampaignDTO {
  workspaceId: string
  createdByUserId?: string
  name: string
  frequency?: CampaignFrequency
  isActive?: boolean
  targetingType: CampaignTargetType
  targetCustomerIds?: string[]
  tagId?: string
  message: string
  templateId?: string
  templateLocale?: string
  mediaUrl?: string
  sendAt?: Date | string | null
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

  private calculateNextRunAt(
    frequency: CampaignFrequency,
    lastRun: Date = new Date()
  ): Date | null {
    if (frequency === CampaignFrequency.ONCE) return null
    const next = new Date(lastRun)
    switch (frequency) {
      case CampaignFrequency.WEEKLY:
        next.setDate(next.getDate() + 7)
        break
      case CampaignFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1)
        break
      case CampaignFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3)
        break
      case CampaignFrequency.SEMIANNUAL:
        next.setMonth(next.getMonth() + 6)
        break
      default:
        return null
    }
    return next
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
      typeof input.sendAt === "string" ? new Date(input.sendAt) : input.sendAt ?? new Date()

    // Read cost/throttle defaults
    const costItem = await platformConfigService.getPrice("PUSH_CAMPAIGN").catch(() => null)
    const limitThrottle = await platformConfigService
      .getLimit("PUSH_THROTTLE_PER_SEC")
      .catch(() => null)
    const limitBatch = await platformConfigService.getLimit("PUSH_BATCH_SIZE").catch(() => null)

    const costPerMessage = typeof costItem === "number" ? costItem : 1
    const throttlePerSecond = Number(input.throttlePerSecond ?? limitThrottle ?? 10)
    const batchSize = Number(input.batchSize ?? limitBatch ?? 50)

    // Build recipients list based on targeting
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

    let targetCustomerIds: string[] = []

    if (input.targetingType === CampaignTargetType.ALL) {
      const activeCustomers = await this.prisma.customers.findMany({
        where: {
          workspaceId: input.workspaceId,
          activeChatbot: true,
          deletedAt: null,
          isBlacklisted: false,
        },
        select: { id: true },
      })
      targetCustomerIds = activeCustomers.map((c) => c.id)
    } else if (input.targetingType === CampaignTargetType.MANUAL) {
      targetCustomerIds = input.targetCustomerIds || []
    } else if (input.targetingType === CampaignTargetType.TAGS && input.tagId) {
      const taggedCustomers = await this.prisma.customers.findMany({
        where: {
          workspaceId: input.workspaceId,
          tags: { has: input.tagId },
          activeChatbot: true,
          deletedAt: null,
          isBlacklisted: false,
        },
        select: { id: true },
      })
      targetCustomerIds = taggedCustomers.map((c) => c.id)
    }

    if (targetCustomerIds.length > 0) {
      const customers = await this.prisma.customers.findMany({
        where: {
          workspaceId: input.workspaceId,
          id: { in: targetCustomerIds },
        },
        select: {
          id: true,
          phone: true,
          isBlacklisted: true,
          activeChatbot: true,
          push_notifications_consent: true,
          push_notifications_consent_at: true,
        },
      })

      for (const c of customers) {
        const phone = c.phone ? this.sanitizePhone(c.phone) : ""
        if (!phone) continue

        // Rule: Must be not blacklisted, chatbot active, and have consent
        if (c.isBlacklisted || !c.activeChatbot || !c.push_notifications_consent) {
          recipients.push({
            workspaceId: input.workspaceId,
            customerId: c.id,
            phone,
            status: PushCampaignRecipientStatus.SKIPPED,
            errorCode: c.isBlacklisted
              ? "BLACKLISTED"
              : !c.activeChatbot
                ? "CHATBOT_INACTIVE"
                : "OPT_OUT",
            errorMessage: c.isBlacklisted
              ? "Customer is blacklisted"
              : !c.activeChatbot
                ? "Chatbot is inactive for this customer"
                : "Marketing opt-in missing",
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

    if (recipients.length === 0) {
      throw new Error("No valid recipients found for the selected targeting")
    }

    // Credit check
    const owner = await this.prisma.user.findUnique({
      where: { id: workspace.ownerId },
      select: { creditBalance: true },
    })
    if (!owner) throw new Error("Owner not found for credit check")

    const estimatedCost = new Prisma.Decimal(costPerMessage).mul(recipients.length)
    if (owner.creditBalance.lt(estimatedCost)) {
      throw new Error("Insufficient credit for campaign")
    }

    const nextRunAt = this.calculateNextRunAt(input.frequency ?? CampaignFrequency.ONCE, sendAt)

    const campaign = await this.repo.createCampaign(
      {
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        name: input.name,
        frequency: input.frequency,
        isActive: input.isActive,
        targetingType: input.targetingType,
        targetCustomerIds: targetCustomerIds,
        tagId: input.tagId,
        message: input.message,
        sendAt: sendAt,
        nextRunAt: nextRunAt,
        templateId: input.templateId,
        templateLocale: input.templateLocale,
        mediaUrl: input.mediaUrl,
        costPerMessage: new Prisma.Decimal(costPerMessage),
        throttlePerSecond,
        batchSize,
        status: PushCampaignStatus.SCHEDULED,
      },
      recipients
    )

    return campaign
  }

  async update(workspaceId: string, id: string, input: UpdatePushCampaignInput) {
    if (input.frequency && input.sendAt) {
      const sendAtDate =
        typeof input.sendAt === "string" ? new Date(input.sendAt) : input.sendAt
      input.nextRunAt = this.calculateNextRunAt(input.frequency, sendAtDate)
    }
    return this.repo.updateCampaign(id, workspaceId, input)
  }

  async delete(workspaceId: string, id: string) {
    return this.repo.deleteCampaign(id, workspaceId)
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
