import {
  Prisma,
  PrismaClient,
  PushCampaignStatus,
  PushCampaignRecipientStatus,
  CampaignFrequency,
  CampaignTargetType,
} from "@echatbot/database"
import { AppError } from "../../interfaces/http/middlewares/error.middleware"
import {
  PushCampaignRepository,
  UpdatePushCampaignInput,
} from "../../repositories/push-campaign.repository"
import { CREDIT_MIN_THRESHOLD } from "./workspace-access.service"
import { findUnauthorizedUrls } from "../chat-engine/outbound-link-guard"
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
  // 🏪 Merchant advertising (Andrea, 2026-08-31): campaign bought by a local
  // merchant — content snapshotted from one of their creatives, sends debited
  // from the merchant's push package.
  merchantId?: string | null
  merchantPushId?: string | null
  validFrom?: Date | string | null
  validTo?: Date | string | null
}

export class PushCampaignService {
  private repo: PushCampaignRepository
  constructor(private readonly prisma: PrismaClient) {
    this.repo = new PushCampaignRepository(prisma)
  }

  /**
   * Normalize targeting type coming from controllers/clients.
   * Handles values like "\"MANUAL\"" or "manual" and returns enum-friendly string.
   */
  private normalizeTargetingType(raw?: any): CampaignTargetType | undefined {
    if (raw === undefined || raw === null) return undefined
    let val = String(raw).trim()
    // Remove escape backslashes
    val = val.replace(/\\+/g, "")

    // Try JSON parse if still quoted
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) {
      try {
        val = JSON.parse(val)
      } catch {
        // ignore parsing errors, continue
      }
    }

    // Strip any remaining quotes
    val = val.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "")

    val = val.toUpperCase()
    if (val === "ALL") return CampaignTargetType.ALL
    if (val === "MANUAL") return CampaignTargetType.MANUAL
    if (val === "TAGS") return CampaignTargetType.TAGS
    return undefined
  }

  /**
   * Resolve target customers and build recipient rows according to targeting strategy.
   */
  private async buildRecipients(
    workspaceId: string,
    targetingType: CampaignTargetType,
    manualCustomerIds?: string[] | null,
    tagId?: string | null
  ) {
    let targetCustomerIds: string[] = []

    if (targetingType === CampaignTargetType.ALL) {
      const activeCustomers = await this.prisma.customers.findMany({
        where: {
          workspaceId,
          activeChatbot: true,
          deletedAt: null,
          isBlacklisted: false,
        },
        select: { id: true },
      })
      targetCustomerIds = activeCustomers.map((c) => c.id)
    } else if (targetingType === CampaignTargetType.MANUAL) {
      // Deduplicate IDs to prevent duplicate recipients
      targetCustomerIds = [...new Set(manualCustomerIds || [])]
    } else if (targetingType === CampaignTargetType.TAGS && tagId) {
      const taggedCustomers = await this.prisma.customers.findMany({
        where: {
          workspaceId,
          tags: { has: tagId },
          activeChatbot: true,
          deletedAt: null,
          isBlacklisted: false,
        },
        select: { id: true },
      })
      targetCustomerIds = taggedCustomers.map((c) => c.id)
    }

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

    if (targetCustomerIds.length > 0) {
      const customers = await this.prisma.customers.findMany({
        where: {
          workspaceId,
          id: { in: targetCustomerIds },
          deletedAt: null, // Skip soft-deleted customers
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
            workspaceId,
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
          workspaceId,
          customerId: c.id,
          phone,
          status: PushCampaignRecipientStatus.PENDING,
        })
      }
    }

    return { recipients, targetCustomerIds }
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/\s+/g, "")
  }

  /**
   * Reject campaign content carrying URLs outside the workspace allow-list
   * (workspace.allowedExternalLinks + platform-internal domains).
   *
   * Validated ONCE, at creation/update — the admin gets an immediate,
   * actionable 400 instead of N per-recipient failures at send time. The
   * queue's own fail-closed link guard stays as the last net (the allow-list
   * can change between scheduling and sending). CLAUDE.md §16 iron rule 1:
   * the guarantee is code, not a prompt or a convention.
   */
  private assertLinksAllowed(
    message: string | undefined,
    mediaUrl: string | undefined | null,
    workspaceAllowedDomains: string[]
  ): void {
    const unauthorized = [
      ...findUnauthorizedUrls(message || "", workspaceAllowedDomains),
      ...findUnauthorizedUrls(mediaUrl || "", workspaceAllowedDomains),
    ]
    if (unauthorized.length > 0) {
      throw new AppError(
        400,
        `Campaign content contains unauthorized link(s): ${unauthorized.join(", ")}. ` +
          "Add the domain(s) to the workspace allowed external links first."
      )
    }
  }

  /** Accepts Date | string | null, throws a clean 400 on garbage. */
  private parseDateInput(value: Date | string | null | undefined, label: string): Date | null {
    if (value === undefined || value === null) return null
    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, `Invalid ${label} date/time`)
    }
    return parsed
  }

  /**
   * Resolve a merchant campaign: merchant + creative must exist in THIS
   * workspace, be active, and the package must have quota. Returns the
   * content SNAPSHOT — the campaign freezes the creative's content at
   * creation, so editing the creative never rewrites a scheduled campaign.
   */
  private async resolveMerchantCampaign(
    workspaceId: string,
    merchantId: string,
    merchantPushId: string | null | undefined
  ): Promise<{ message: string; mediaUrl: string | null; quotaRemaining: number }> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, workspaceId, deletedAt: null },
      select: { isActive: true, quotaRemaining: true },
    })
    if (!merchant) throw new AppError(404, "Merchant not found")
    if (!merchant.isActive) throw new AppError(400, "Merchant is not active")
    if (merchant.quotaRemaining <= 0) {
      throw new AppError(
        400,
        "Merchant push quota exhausted — top up the package before scheduling a campaign"
      )
    }
    if (!merchantPushId) {
      throw new AppError(400, "merchantPushId is required for a merchant campaign")
    }
    const push = await this.prisma.merchantPush.findFirst({
      where: { id: merchantPushId, workspaceId, merchantId, deletedAt: null },
    })
    if (!push) throw new AppError(404, "Merchant push not found")
    if (!push.isActive) throw new AppError(400, "Merchant push is not active")

    // Snapshot format is mechanism, not copy: title bold (WhatsApp style),
    // then the creative's own text/location/video — all tenant-authored.
    const parts = [`*${push.title}*`, push.text]
    if (push.location) parts.push(`📍 ${push.location}`)
    if (push.videoUrl) parts.push(push.videoUrl)
    return {
      message: parts.join("\n\n"),
      mediaUrl: push.photoUrl ?? null,
      quotaRemaining: merchant.quotaRemaining,
    }
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
      case CampaignFrequency.BIWEEKLY:
        next.setDate(next.getDate() + 14)
        break
      case CampaignFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1)
        break
      case CampaignFrequency.BIMONTHLY:
        next.setMonth(next.getMonth() + 2)
        break
      case CampaignFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3)
        break
      case CampaignFrequency.SEMIANNUAL:
        next.setMonth(next.getMonth() + 6)
        break
      case CampaignFrequency.ANNUAL:
        next.setFullYear(next.getFullYear() + 1)
        break
      default:
        return null
    }
    return next
  }

  async create(input: CreatePushCampaignDTO) {
    // Extra safety: normalize targeting type here too (in case controller missed)
    input.targetingType = this.normalizeTargetingType(input.targetingType) as any

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { enableWhatsapp: true, ownerId: true, allowedExternalLinks: true },
    })
    if (!workspace) {
      throw new AppError(404, "Workspace not found")
    }
    if (!workspace.enableWhatsapp) {
      throw new AppError(
        400,
        "Push campaigns are available only for WhatsApp-enabled workspaces"
      )
    }
    if (!workspace.ownerId) {
      throw new AppError(500, "Workspace owner not found for credit check")
    }

    // 🏪 Merchant campaign: resolve merchant + creative and SNAPSHOT the
    // content before any validation, so the link check below runs on what
    // will actually be sent.
    let merchantQuotaRemaining: number | null = null
    if (input.merchantId) {
      const snapshot = await this.resolveMerchantCampaign(
        input.workspaceId,
        input.merchantId,
        input.merchantPushId
      )
      input.message = snapshot.message
      input.mediaUrl = snapshot.mediaUrl ?? undefined
      merchantQuotaRemaining = snapshot.quotaRemaining
    } else if (input.merchantPushId) {
      throw new AppError(400, "merchantId is required when merchantPushId is provided")
    }

    // 🪟 Validity window (e.g. winter campaign 01/12 → 31/03)
    const validFrom = this.parseDateInput(input.validFrom, "validFrom")
    const validTo = this.parseDateInput(input.validTo, "validTo")
    if (validFrom && validTo && validTo <= validFrom) {
      throw new AppError(400, "validTo must be after validFrom")
    }

    // Fail fast on external links — before recipients are built or credits touched.
    this.assertLinksAllowed(
      input.message,
      input.mediaUrl,
      (workspace.allowedExternalLinks as string[] | null) || []
    )

    const sendAt = (() => {
      if (input.sendAt === undefined || input.sendAt === null) return new Date()
      if (typeof input.sendAt === "string") {
        const parsed = new Date(input.sendAt)
        if (Number.isNaN(parsed.getTime())) {
          throw new AppError(400, "Invalid send date/time")
        }
        return parsed
      }
      if (input.sendAt instanceof Date) {
        if (Number.isNaN(input.sendAt.getTime())) {
          throw new AppError(400, "Invalid send date/time")
        }
        return input.sendAt
      }
      return new Date()
    })()

    // Default values for push campaigns
    const DEFAULT_COST_PER_MESSAGE = 1.0 // €1.00 per push notification
    const DEFAULT_THROTTLE_PER_SEC = 10  // Max 10 messages per second
    const DEFAULT_BATCH_SIZE = 50        // Process 50 recipients per batch

    const costPerMessage = DEFAULT_COST_PER_MESSAGE
    const throttlePerSecond = Number(input.throttlePerSecond ?? DEFAULT_THROTTLE_PER_SEC)
    const batchSize = Number(input.batchSize ?? DEFAULT_BATCH_SIZE)

    const { recipients, targetCustomerIds } = await this.buildRecipients(
      input.workspaceId,
      input.targetingType,
      input.targetCustomerIds,
      input.tagId
    )

    if (recipients.length === 0) {
      throw new AppError(
        400,
        "No valid recipients found for the selected targeting"
      )
    }

    // Credit check
    const owner = await this.prisma.user.findUnique({
      where: { id: workspace.ownerId },
      select: { creditBalance: true },
    })
    if (!owner) {
      throw new AppError(404, "Owner not found for credit check")
    }

    // 💰 HARD CUTOFF: Block if credit below absolute minimum threshold (-$10)
    if (Number(owner.creditBalance) < CREDIT_MIN_THRESHOLD) {
      throw new AppError(402, "Credit exhausted — cannot create campaign")
    }

    const estimatedCost = new Prisma.Decimal(costPerMessage).mul(recipients.length)
    if (owner.creditBalance.lt(estimatedCost)) {
      throw new AppError(402, "Insufficient credit for campaign")
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
        merchantId: input.merchantId ?? null,
        merchantPushId: input.merchantPushId ?? null,
        validFrom,
        validTo,
      },
      recipients
    )

    // 🏪 Quota warning, not a block (Andrea, 2026-08-31: send what the package
    // covers, then pause): the admin sees upfront that the package won't cover
    // the whole segment.
    if (
      merchantQuotaRemaining !== null &&
      merchantQuotaRemaining < recipients.length
    ) {
      return {
        ...campaign,
        quotaWarning: `Merchant package covers ${merchantQuotaRemaining} of ${recipients.length} recipients — the campaign will pause when the quota runs out.`,
      }
    }

    return campaign
  }

  async update(workspaceId: string, id: string, input: UpdatePushCampaignInput) {
    // Extra safety: normalize targeting type here too
    input.targetingType = this.normalizeTargetingType(input.targetingType) as any

    const existing = await this.repo.findById(id, workspaceId)
    if (!existing) {
      throw new AppError(404, "Campaign not found")
    }

    // 🏪 Re-snapshot when the campaign is (re)pointed at a creative: the new
    // push's content replaces the frozen one, then flows through the same
    // link validation below.
    if (input.merchantPushId !== undefined && input.merchantPushId !== null) {
      const merchantId = input.merchantId ?? (existing as any).merchantId
      if (!merchantId) {
        throw new AppError(400, "merchantId is required when merchantPushId is provided")
      }
      const snapshot = await this.resolveMerchantCampaign(
        workspaceId,
        merchantId,
        input.merchantPushId
      )
      input.merchantId = merchantId
      input.message = snapshot.message
      input.mediaUrl = snapshot.mediaUrl ?? undefined
    }

    // 🪟 Validity window changes keep the from<to invariant against the
    // stored values they merge with.
    if (input.validFrom !== undefined || input.validTo !== undefined) {
      const mergedFrom = this.parseDateInput(
        (input.validFrom !== undefined ? input.validFrom : (existing as any).validFrom) as any,
        "validFrom"
      )
      const mergedTo = this.parseDateInput(
        (input.validTo !== undefined ? input.validTo : (existing as any).validTo) as any,
        "validTo"
      )
      if (mergedFrom && mergedTo && mergedTo <= mergedFrom) {
        throw new AppError(400, "validTo must be after validFrom")
      }
      if (input.validFrom !== undefined) input.validFrom = mergedFrom
      if (input.validTo !== undefined) input.validTo = mergedTo
    }

    // Same link validation as create, when the content is being changed.
    if (input.message !== undefined || input.mediaUrl !== undefined) {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { allowedExternalLinks: true },
      })
      this.assertLinksAllowed(
        input.message ?? existing.message,
        input.mediaUrl ?? (existing as any).mediaUrl,
        (ws?.allowedExternalLinks as string[] | null) || []
      )
    }

    if (input.sendAt !== undefined) {
      if (input.sendAt === null) {
        // keep null
      } else if (typeof input.sendAt === "string") {
        const parsed = new Date(input.sendAt)
        if (Number.isNaN(parsed.getTime())) {
          throw new AppError(400, "Invalid send date/time")
        }
        input.sendAt = parsed
      } else if (input.sendAt instanceof Date) {
        if (Number.isNaN(input.sendAt.getTime())) {
          throw new AppError(400, "Invalid send date/time")
        }
      }
    }

    if (input.frequency && input.sendAt) {
      const sendAtDate =
        typeof input.sendAt === "string" ? new Date(input.sendAt) : input.sendAt
      input.nextRunAt = this.calculateNextRunAt(input.frequency, sendAtDate)
    }

    // If targeting changes OR recipients inputs change we must rebuild recipients to keep counts consistent
    const nextTargetingType = (input.targetingType as CampaignTargetType) || existing.targetingType
    const nextTargetIds = input.targetCustomerIds ?? existing.targetCustomerIds ?? []
    const nextTagId = input.tagId ?? (existing as any).tagId ?? null

    const targetingChanged = input.targetingType && input.targetingType !== existing.targetingType

    const manualListChanged =
      nextTargetingType === CampaignTargetType.MANUAL && input.targetCustomerIds !== undefined

    const manualCountMismatch =
      nextTargetingType === CampaignTargetType.MANUAL &&
      nextTargetIds.length > 0 &&
      nextTargetIds.length !== (existing.targetCustomerIds?.length || existing.expectedRecipients || 0)

    const tagChanged =
      nextTargetingType === CampaignTargetType.TAGS && input.tagId !== undefined

    // For ALL we always refresh snapshot to keep expectedRecipients in sync with current active customers
    const forceAllRebuild = nextTargetingType === CampaignTargetType.ALL

    const shouldRebuildRecipients =
      targetingChanged ||
      manualListChanged ||
      manualCountMismatch ||
      tagChanged ||
      forceAllRebuild ||
      input.targetCustomerIds !== undefined // always rebuild when manual list is provided to drop stale rows

    try {
      if (shouldRebuildRecipients) {
        const { recipients, targetCustomerIds } = await this.buildRecipients(
          workspaceId,
          nextTargetingType,
          nextTargetIds,
          nextTagId
        )

        if (recipients.length === 0) {
          throw new AppError(400, "No valid recipients found for the selected targeting")
        }

        return await this.repo.replaceRecipients(
          id,
          workspaceId,
          {
            ...input,
            expectedRecipients: recipients.length,
            targetCustomerIds,
            targetingType: nextTargetingType, // ensure stored targeting matches rebuild
          },
          recipients
        )
      }

      return await this.repo.updateCampaign(id, workspaceId, input)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(404, "Campaign not found")
        }
        if (error.code === "P2002") {
          throw new AppError(409, "Campaign already exists")
        }
        if (error.code === "P2003") {
          throw new AppError(400, "Invalid reference in campaign update")
        }
      }
      throw error
    }
  }

  async delete(workspaceId: string, id: string) {
    return this.repo.deleteCampaign(id, workspaceId)
  }

  async list(workspaceId: string) {
    const campaigns = await this.repo.listByWorkspace(workspaceId)
    if (campaigns.length === 0) return []

    // Stats and errors are computed per campaign for the latest send only
    const statsMap = new Map<
      string,
      { total: number; pending: number; sent: number; failed: number; skipped: number }
    >()
    const errorMap = new Map<
      string,
      { status: PushCampaignRecipientStatus; code: string | null; count: number }[]
    >()

    for (const c of campaigns) {
      // Show counts based on the current recipient set for the campaign (latest definition)
      const baseWhere = { campaignId: c.id }

      const grouped = await this.prisma.pushCampaignRecipient.groupBy({
        where: baseWhere,
        by: ["status"],
        _count: { _all: true },
      })

      const entry = { total: 0, pending: 0, sent: 0, failed: 0, skipped: 0 }
      for (const row of grouped) {
        entry.total += row._count._all
        if (row.status === PushCampaignRecipientStatus.PENDING) entry.pending += row._count._all
        if (row.status === PushCampaignRecipientStatus.SENT) entry.sent += row._count._all
        if (row.status === PushCampaignRecipientStatus.FAILED) entry.failed += row._count._all
        if (row.status === PushCampaignRecipientStatus.SKIPPED) entry.skipped += row._count._all
      }
      statsMap.set(c.id, entry)

      const errorGroups = await this.prisma.pushCampaignRecipient.groupBy({
        where: {
          ...baseWhere,
          status: { in: [PushCampaignRecipientStatus.FAILED, PushCampaignRecipientStatus.SKIPPED] },
        },
        by: ["status", "errorCode"],
        _count: { _all: true },
      })

      if (errorGroups.length > 0) {
        errorMap.set(
          c.id,
          errorGroups.map((row) => ({
            status: row.status,
            code: row.errorCode,
            count: row._count._all,
          }))
        )
      }
    }

    return campaigns.map((c: any) => {
      const s = statsMap.get(c.id) || {
        total: c.expectedRecipients ?? 0,
        pending: 0,
        sent: c.actualSent ?? 0,
        failed: c.actualFailed ?? 0,
        skipped: c.actualSkipped ?? 0,
      }

      const hasExpired =
        c.status === PushCampaignStatus.SCHEDULED &&
        !!c.sendAt &&
        new Date(c.sendAt).getTime() < Date.now() &&
        (c.actualSent ?? 0) === 0

      return {
        ...c,
        // Keep DB status unchanged, but surface expiration and latest counters for the UI
        isExpired: hasExpired,
        isActive: hasExpired ? false : c.isActive,
        recipientsTotal: s.total,
        recipientsPending: s.pending,
        actualSent: s.sent,
        actualFailed: s.failed,
        actualSkipped: s.skipped,
        errorBreakdown: errorMap.get(c.id) || [],
      }
    })
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

  async performSecurityCheck(workspaceId: string, id: string) {
    const campaign = await this.repo.findById(id, workspaceId)
    if (!campaign) throw new AppError(404, "Campaign not found")

    // Use the SecurityAgent or similar logic
    const { SecurityAgent } = require("../agents/SecurityAgent")
    const securityAgent = new SecurityAgent(this.prisma)

    const result = await securityAgent.process({
      workspaceId,
      message: campaign.message || "",
      customerId: "CAMPAIGN_CHECK", // Dummy ID for campaign-level check
      customerName: "Campaign",
    })

    return result
  }

  async getSentMessages(workspaceId: string, campaignId: string) {
    // Find all WhatsAppQueue entries linked to this campaign that are 'sent' or 'delivered'
    return this.prisma.whatsAppQueue.findMany({
      where: {
        workspaceId,
        pushCampaignId: campaignId,
        status: { in: ["sent", "delivered"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100 messages for the popup
      select: {
        id: true,
        phoneNumber: true,
        messageContent: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
      },
    })
  }
}
