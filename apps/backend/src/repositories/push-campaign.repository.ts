import { Prisma, PrismaClient, PushCampaignStatus, PushCampaignRecipientStatus } from "@echatbot/database"

export interface CreatePushCampaignInput {
  workspaceId: string
  createdByUserId?: string
  name: string
  templateId?: string
  templateLocale?: string
  bodyPreview?: string
  mediaUrl?: string
  targetTags?: string[]
  sendAt?: Date | null
  costPerMessage?: Prisma.Decimal | number
  throttlePerSecond?: number
  batchSize?: number
  status?: PushCampaignStatus
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
        templateId: data.templateId,
        templateLocale: data.templateLocale,
        bodyPreview: data.bodyPreview,
        mediaUrl: data.mediaUrl,
        targetTags: data.targetTags ?? [],
        sendAt: data.sendAt,
        costPerMessage: data.costPerMessage,
        throttlePerSecond: data.throttlePerSecond,
        batchSize: data.batchSize,
        status: data.status ?? PushCampaignStatus.DRAFT,
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

  async listByWorkspace(workspaceId: string) {
    return this.prisma.pushCampaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        sendAt: true,
        expectedRecipients: true,
        actualSent: true,
        actualFailed: true,
        actualSkipped: true,
        targetTags: true,
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
      where: { id },
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
