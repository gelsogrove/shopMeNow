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
  // 🏪 Merchant advertising (Andrea, 2026-08-31)
  merchantId?: string | null
  merchantPushId?: string | null
  validFrom?: Date | null
  validTo?: Date | null
  // Daily send window, hours in the workspace timezone (default 8→19)
  sendWindowStart?: number
  sendWindowEnd?: number
  /** Uploaded image for FREE-message campaigns (data URI or raw base64). */
  mediaBase64?: string | null
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
  // 🏪 Merchant advertising (Andrea, 2026-08-31)
  merchantId?: string | null
  merchantPushId?: string | null
  validFrom?: Date | null
  validTo?: Date | null
  // Daily send window, hours in the workspace timezone (default 8→19)
  sendWindowStart?: number
  sendWindowEnd?: number
  /** Uploaded image for FREE-message campaigns (data URI or raw base64). */
  mediaBase64?: string | null
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
        merchantId: data.merchantId,
        merchantPushId: data.merchantPushId,
        validFrom: data.validFrom,
        validTo: data.validTo,
        sendWindowStart: data.sendWindowStart,
        sendWindowEnd: data.sendWindowEnd,
        mediaBase64: data.mediaBase64,
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

  /**
   * Replace recipients and update campaign counts in a single transaction.
   */
  async replaceRecipients(
    id: string,
    workspaceId: string,
    updateData: UpdatePushCampaignInput & { expectedRecipients: number },
    recipients: RecipientCreateInput[]
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.pushCampaignRecipient.deleteMany({
        where: { campaignId: id, workspaceId },
      })

      await tx.pushCampaignRecipient.createMany({
        data: recipients.map((r) => ({
          campaignId: id,
          workspaceId,
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
      })

      return tx.pushCampaign.update({
        where: { id, workspaceId },
        data: updateData,
      })
    })
  }

  /**
   * Soft delete: the campaign stops appearing anywhere and the scheduler
   * never picks it up again, but PushCampaignRecipient rows survive — they
   * are the audit trail behind billing and the merchant's own quota ledger
   * (Andrea, 2026-09-12: "se si cancella la campagna la storia non si
   * cancella"). This is the only delete exposed on the normal campaign list.
   */
  async deleteCampaign(id: string, workspaceId: string) {
    return this.prisma.pushCampaign.update({
      where: { id, workspaceId },
      data: { deletedAt: new Date() },
    })
  }

  /**
   * Hard delete: a REAL row removal, cascading to every PushCampaignRecipient
   * and WhatsAppQueue row. Reserved for backoffice cleanup of campaigns that
   * never sent anything — a draft created by mistake, never scheduled. Guarded
   * in the service layer (never here alone) so it can never touch a campaign
   * with actualSent > 0: real sends move money (merchant quota, billing) and
   * must never be erasable, soft-deleted or not (Andrea, 2026-09-12).
   */
  async hardDeleteCampaign(id: string, workspaceId: string) {
    return this.prisma.pushCampaign.delete({
      where: { id, workspaceId },
    })
  }

  async listByWorkspace(workspaceId: string) {
    return this.prisma.pushCampaign.findMany({
      where: { workspaceId, deletedAt: null },
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
        lastError: true,
        // 🏪 Merchant campaign context for the list cards: whose campaign it
        // is, which creative, and the validity window — the at-a-glance facts
        // the Pro Loco reads before anything else (Andrea, 2026-08-31).
        merchantId: true,
        merchantPushId: true,
        validFrom: true,
        validTo: true,
        sendWindowStart: true,
        sendWindowEnd: true,
        merchant: { select: { name: true, quotaRemaining: true } },
        merchantPush: { select: { title: true } },
      },
    })
  }

  /**
   * The backoffice "trash": soft-deleted campaigns, so an admin can either
   * restore one or hard-delete it (only when it never sent anything — see
   * hardDeleteCampaign). Never merged into listByWorkspace, so a deleted
   * campaign can't accidentally resurface where the scheduler or the normal
   * list would treat it as live.
   */
  async listDeleted(workspaceId: string) {
    return this.prisma.pushCampaign.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        actualSent: true,
        actualFailed: true,
        actualSkipped: true,
        deletedAt: true,
        merchant: { select: { name: true } },
      },
    })
  }

  /** Undo a soft delete — the campaign is not gone, it was hidden. */
  async restoreCampaign(id: string, workspaceId: string) {
    return this.prisma.pushCampaign.update({
      where: { id, workspaceId },
      data: { deletedAt: null },
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
      data: {
        status,
        sendAt,
        // Re-arm the scheduler pickup on SCHEDULED: the job selects
        // `(sendAt<=now AND lastRunAt null) OR nextRunAt<=now`, so a campaign
        // paused MID-run (lastRunAt set, nextRunAt null for ONCE) would never
        // be picked again after a resume (found 2026-09-01 tracing Andrea's
        // target flow: "si ferma... e riparte"). nextRunAt = sendAt when a
        // schedule provides one, otherwise now.
        ...(status === PushCampaignStatus.SCHEDULED
          ? { nextRunAt: sendAt ?? new Date() }
          : {}),
      },
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
