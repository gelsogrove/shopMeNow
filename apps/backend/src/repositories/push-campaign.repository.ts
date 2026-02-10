import {
  Prisma,
  PrismaClient,
  PushCampaignStatus,
  PushCampaignRecipientStatus,
  CampaignFrequency,
  CampaignTargetType,
} from "@echatbot/database"

export interface CreatePushCampaignInput {
  workspaceId: string
  createdByUserId?: string
  name: string
  status?: PushCampaignStatus
  frequency?: CampaignFrequency
  isActive?: Boolean
  targetingType?: CampaignTargetType
  targetCustomerIds?: string[]
  tagId?: string | null
  message?: string | null
  sendAt?: Date | null
  nextRunAt?: Date | null
  lastRunAt?: Date | null
  templateId?: string
  templateLocale?: string
  bodyPreview?: string
  mediaUrl?: string
  targetTags?: string[]
  costPerMessage?: Prisma.Decimal | number
  throttlePerSecond?: number
  batchSize?: number
}

export interface UpdatePushCampaignInput {
  name?: string
  status?: PushCampaignStatus
  frequency?: CampaignFrequency
  isActive?: boolean
  targetingType?: CampaignTargetType
  targetCustomerIds?: string[]
  tagId?: string | null
  message?: string | null
  sendAt?: Date | null
  nextRunAt?: Date | null
  lastRunAt?: Date | null
  templateId?: string
  templateLocale?: string
  bodyPreview?: string
  mediaUrl?: string
  throttlePerSecond?: number
  batchSize?: number
}

export interface RecipientCreateInput {
  workspaceId: string
  campaignId?: string // Optional: auto-set by Prisma during nested create
  customerId?: string | null
  phone: string
  status: PushCampaignRecipientStatus
  errorCode?: string | null
  errorMessage?: string | null
  isBlacklisted?: boolean
  isBlocked?: boolean
  isFake?: boolean
  optOutAt?: Date | null
}

export class PushCampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCampaign(
    data: CreatePushCampaignInput,
    recipients: RecipientCreateInput[]
  ) {
    return this.prisma.pushCampaign.create({
      data: {
        workspaceId: data.workspaceId,
        createdByUserId: data.createdByUserId,
        name: data.name,
        status: data.status ?? PushCampaignStatus.DRAFT,
        frequency: data.frequency ?? CampaignFrequency.ONCE,
        isActive: data.isActive !== undefined ? (data.isActive as boolean) : true,
        targetingType: data.targetingType ?? CampaignTargetType.ALL,
        targetCustomerIds: data.targetCustomerIds ?? [],
        tagId: data.tagId,
        message: data.message,
        sendAt: data.sendAt,
        nextRunAt: data.nextRunAt,
        lastRunAt: data.lastRunAt,
        templateId: data.templateId,
        templateLocale: data.templateLocale,
        bodyPreview: data.bodyPreview,
        mediaUrl: data.mediaUrl,
        targetTags: data.targetTags ?? [],
        costPerMessage: data.costPerMessage,
        throttlePerSecond: data.throttlePerSecond,
        batchSize: data.batchSize,
        expectedRecipients: recipients.length,
        recipients: {
          createMany: {
            data: recipients.map((r) => ({
              workspaceId: r.workspaceId,
              customerId: r.customerId,
              phone: r.phone,
              status: r.status,
              errorCode: r.errorCode,
              errorMessage: r.errorMessage,
              isBlacklisted: r.isBlacklisted ?? false,
              isBlocked: r.isBlocked ?? false,
              isFake: r.isFake ?? false,
              optOutAt: r.optOutAt,
            })),
            skipDuplicates: true,
          },
        },
      },
      include: {
        recipients: false,
      },
    })
  }

  async updateCampaign(
    id: string,
    workspaceId: string,
    data: UpdatePushCampaignInput
  ) {
    return this.prisma.pushCampaign.update({
      where: { id, workspaceId },
      data,
    })
  }

  async deleteCampaign(id: string, workspaceId: string) {
    return this.prisma.pushCampaign.delete({
      where: { id, workspaceId },
    })
  }

  async listByWorkspace(workspaceId: string) {
    return this.prisma.pushCampaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        frequency: true,
        isActive: true,
        targetingType: true,
        sendAt: true,
        nextRunAt: true,
        lastRunAt: true,
        expectedRecipients: true,
        actualSent: true,
        actualFailed: true,
        actualSkipped: true,
        billingStatus: true,
        costPerMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async findById(id: string, workspaceId: string) {
    return this.prisma.pushCampaign.findFirst({
      where: { id, workspaceId },
      include: {
        recipients: false,
      },
    })
  }

  async updateStatus(
    id: string,
    workspaceId: string,
    status: PushCampaignStatus,
    sendAt?: Date | null
  ) {
    return this.prisma.pushCampaign.updateMany({
      where: { id, workspaceId },
      data: { status, sendAt },
    })
  }

  async updateCounts(
    id: string,
    workspaceId: string,
    counts: {
      actualSent?: number
      actualFailed?: number
      actualSkipped?: number
    }
  ) {
    return this.prisma.pushCampaign.update({
      where: { id, workspaceId }, // Security: workspace isolation (Rule #2 from CLAUDE.md)
      data: counts,
    })
  }

  async listRecipients(
    campaignId: string,
    workspaceId: string,
    skip = 0,
    take = 50,
    status?: PushCampaignRecipientStatus
  ) {
    return this.prisma.pushCampaignRecipient.findMany({
      where: {
        campaignId,
        workspaceId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    })
  }
}
