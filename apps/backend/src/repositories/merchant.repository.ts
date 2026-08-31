/**
 * MerchantRepository
 *
 * Data access for merchants (esercenti) — the local businesses a workspace
 * owner (e.g. a Pro Loco) resells push packages to. NOT the chatbot's
 * customers: merchants BUY visibility, customers receive messages.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation).
 * Deletion is SOFT (deletedAt): a merchant's send history backs the owner's
 * invoicing and must never vanish.
 */

import { Merchant, MerchantQuotaTopup, PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

export interface CreateMerchantData {
  workspaceId: string
  name: string
  description?: string | null
  location?: string | null
  billingName?: string | null
  vatNumber?: string | null
  taxCode?: string | null
  sdiCode?: string | null
  pec?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingZip?: string | null
  billingProvince?: string | null
  billingCountry?: string | null
  isActive?: boolean
}

export type UpdateMerchantData = Partial<Omit<CreateMerchantData, "workspaceId">>

/** One row of the merchant's monthly send report ("this month you sent X"). */
export interface MerchantMonthlySent {
  month: string // "2026-08"
  sent: number
}

export class MerchantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, workspaceId: string): Promise<Merchant | null> {
    return this.prisma.merchant.findFirst({
      where: { id, workspaceId, deletedAt: null },
    })
  }

  async findAll(workspaceId: string): Promise<Merchant[]> {
    return this.prisma.merchant.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { name: "asc" },
    })
  }

  async create(data: CreateMerchantData): Promise<Merchant> {
    return this.prisma.merchant.create({ data })
  }

  async update(
    id: string,
    workspaceId: string,
    data: UpdateMerchantData
  ): Promise<Merchant | null> {
    // updateMany + re-read instead of update: the where must carry the
    // workspaceId filter (rule 2) and update() only accepts unique fields.
    const result = await this.prisma.merchant.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data,
    })
    if (result.count === 0) return null
    return this.findById(id, workspaceId)
  }

  async softDelete(id: string, workspaceId: string): Promise<boolean> {
    const result = await this.prisma.merchant.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    })
    return result.count > 0
  }

  /**
   * Sell a push package: increment the balance AND write the audit row in one
   * transaction — quotaRemaining must always equal topups − debited sends.
   */
  async topUpQuota(params: {
    id: string
    workspaceId: string
    amount: number
    note?: string | null
    createdByUserId?: string | null
  }): Promise<Merchant | null> {
    const { id, workspaceId, amount, note, createdByUserId } = params
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.merchant.updateMany({
          where: { id, workspaceId, deletedAt: null },
          data: { quotaRemaining: { increment: amount } },
        })
        if (updated.count === 0) return null
        await tx.merchantQuotaTopup.create({
          data: { workspaceId, merchantId: id, amount, note, createdByUserId },
        })
        // 🔁 The target flow end-to-end (Andrea, 2026-09-01): a campaign that
        // paused because the package ran out RESUMES by itself when the
        // merchant buys more pushes — the Pro Loco tops up and everything
        // moves again, no forgotten Resume click. Only quota-paused campaigns
        // are touched (credit- or manually-paused ones keep their state), and
        // nextRunAt is re-armed so the scheduler picks them up.
        await tx.pushCampaign.updateMany({
          where: {
            workspaceId,
            merchantId: id,
            status: "PAUSED",
            lastError: { contains: "quota exhausted" },
          },
          data: { status: "SCHEDULED", nextRunAt: new Date(), lastError: null },
        })
        return tx.merchant.findFirst({ where: { id, workspaceId } })
      })
    } catch (error) {
      logger.error("[MerchantRepository] topUpQuota failed", {
        merchantId: id,
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async listTopups(
    id: string,
    workspaceId: string
  ): Promise<MerchantQuotaTopup[]> {
    return this.prisma.merchantQuotaTopup.findMany({
      where: { merchantId: id, workspaceId },
      orderBy: { createdAt: "desc" },
    })
  }

  /**
   * Sent messages per month for this merchant's campaigns — the numbers the
   * owner invoices on. Derived from PushCampaignRecipient (status SENT), the
   * same rows the platform already bills, so the report can never disagree
   * with what was actually charged.
   */
  async monthlySent(
    id: string,
    workspaceId: string
  ): Promise<MerchantMonthlySent[]> {
    const rows = await this.prisma.$queryRaw<Array<{ month: Date; sent: bigint }>>`
      SELECT date_trunc('month', COALESCE(r."sentAt", r."updatedAt")) AS month,
             COUNT(*) AS sent
      FROM "push_campaign_recipients" r
      JOIN "push_campaigns" c ON c."id" = r."campaignId"
      WHERE r."workspaceId" = ${workspaceId}
        AND c."workspaceId" = ${workspaceId}
        AND c."merchantId" = ${id}
        AND r."status" = 'SENT'
      GROUP BY 1
      ORDER BY 1 DESC
    `
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      sent: Number(r.sent),
    }))
  }
}
