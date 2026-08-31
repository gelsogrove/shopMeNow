/**
 * MerchantService
 *
 * Business rules for the merchant-advertising domain (Andrea, 2026-08-31):
 * the workspace owner (e.g. a Pro Loco) resells push packages to local
 * merchants. This service owns the rules the repositories must not know:
 *
 * - creative content may only carry links in the workspace allow-list
 *   (findUnauthorizedUrls — CLAUDE.md §16 iron rule 1: the guarantee against
 *   external content is deterministic code, validated ONCE at save time; the
 *   queue's fail-closed guard remains the last net at send time);
 * - a quota top-up must be a positive integer and is written atomically with
 *   its audit row;
 * - stats aggregate balance + topups + monthly sent counts — the numbers the
 *   owner invoices on (prices stay OUTSIDE the system by design).
 */

import { PrismaClient } from "@echatbot/database"
import { AppError } from "../../interfaces/http/middlewares/error.middleware"
import {
  CreateMerchantData,
  MerchantRepository,
  UpdateMerchantData,
} from "../../repositories/merchant.repository"
import {
  CreateMerchantPushData,
  MerchantPushRepository,
  UpdateMerchantPushData,
} from "../../repositories/merchant-push.repository"
import { findUnauthorizedUrls } from "../chat-engine/outbound-link-guard"

export class MerchantService {
  private merchants: MerchantRepository
  private pushes: MerchantPushRepository

  constructor(private readonly prisma: PrismaClient) {
    this.merchants = new MerchantRepository(prisma)
    this.pushes = new MerchantPushRepository(prisma)
  }

  // ── Merchants ──────────────────────────────────────────────────────────

  async list(workspaceId: string) {
    return this.merchants.findAll(workspaceId)
  }

  async getById(id: string, workspaceId: string) {
    const merchant = await this.merchants.findById(id, workspaceId)
    if (!merchant) throw new AppError(404, "Merchant not found")
    return merchant
  }

  async create(data: CreateMerchantData) {
    if (!data.name?.trim()) throw new AppError(400, "Merchant name is required")
    return this.merchants.create({ ...data, name: data.name.trim() })
  }

  async update(id: string, workspaceId: string, data: UpdateMerchantData) {
    if (data.name !== undefined && !data.name?.trim()) {
      throw new AppError(400, "Merchant name cannot be empty")
    }
    const updated = await this.merchants.update(id, workspaceId, data)
    if (!updated) throw new AppError(404, "Merchant not found")
    return updated
  }

  async delete(id: string, workspaceId: string) {
    const deleted = await this.merchants.softDelete(id, workspaceId)
    if (!deleted) throw new AppError(404, "Merchant not found")
  }

  // ── Quota ──────────────────────────────────────────────────────────────

  async topUpQuota(params: {
    id: string
    workspaceId: string
    amount: number
    note?: string | null
    createdByUserId?: string | null
  }) {
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new AppError(400, "Top-up amount must be a positive integer")
    }
    const merchant = await this.merchants.topUpQuota(params)
    if (!merchant) throw new AppError(404, "Merchant not found")
    return merchant
  }

  /**
   * The invoicing view: current balance, every package sold, and sent counts
   * per month. Quantities only — the price of a package lives outside the
   * system (Andrea, 2026-08-31).
   */
  async stats(id: string, workspaceId: string) {
    const merchant = await this.getById(id, workspaceId)
    const [topups, monthlySent] = await Promise.all([
      this.merchants.listTopups(id, workspaceId),
      this.merchants.monthlySent(id, workspaceId),
    ])
    const totalPurchased = topups.reduce((sum, t) => sum + t.amount, 0)
    const totalSent = monthlySent.reduce((sum, m) => sum + m.sent, 0)
    return {
      merchantId: merchant.id,
      name: merchant.name,
      isActive: merchant.isActive,
      quotaRemaining: merchant.quotaRemaining,
      totalPurchased,
      totalSent,
      topups,
      monthlySent,
    }
  }

  // ── Creatives (pushes) ─────────────────────────────────────────────────

  async listPushes(merchantId: string, workspaceId: string) {
    await this.getById(merchantId, workspaceId) // 404 on foreign/unknown merchant
    return this.pushes.findAllForMerchant(merchantId, workspaceId)
  }

  async createPush(data: CreateMerchantPushData) {
    if (!data.title?.trim()) throw new AppError(400, "Push title is required")
    if (!data.text?.trim()) throw new AppError(400, "Push text is required")
    this.assertPhotoSize(data.photoBase64)
    await this.getById(data.merchantId, data.workspaceId)
    await this.assertPushLinksAllowed(data.workspaceId, data)
    return this.pushes.create({
      ...data,
      title: data.title.trim(),
      text: data.text.trim(),
    })
  }

  async updatePush(
    id: string,
    workspaceId: string,
    data: UpdateMerchantPushData
  ) {
    if (data.title !== undefined && !data.title?.trim()) {
      throw new AppError(400, "Push title cannot be empty")
    }
    if (data.text !== undefined && !data.text?.trim()) {
      throw new AppError(400, "Push text cannot be empty")
    }
    this.assertPhotoSize(data.photoBase64)
    const existing = await this.pushes.findById(id, workspaceId)
    if (!existing) throw new AppError(404, "Push not found")
    // Validate the RESULTING content, not just the changed fields: a new text
    // must be checked together with the photo/video URLs it will ship with.
    await this.assertPushLinksAllowed(workspaceId, {
      text: data.text ?? existing.text,
      photoUrl: data.photoUrl !== undefined ? data.photoUrl : existing.photoUrl,
      videoUrl: data.videoUrl !== undefined ? data.videoUrl : existing.videoUrl,
      description:
        data.description !== undefined ? data.description : existing.description,
    })
    const updated = await this.pushes.update(id, workspaceId, data)
    if (!updated) throw new AppError(404, "Push not found")
    return updated
  }

  async deletePush(id: string, workspaceId: string) {
    const deleted = await this.pushes.softDelete(id, workspaceId)
    if (!deleted) throw new AppError(404, "Push not found")
  }

  /**
   * Cap the uploaded creative photo at ~4MB decoded (WhatsApp providers cap
   * image size around 5MB; base64 inflates by ~4/3). A clear 400 beats a
   * silently truncated row or a provider rejection at send time.
   */
  private assertPhotoSize(photoBase64: string | null | undefined): void {
    if (!photoBase64) return
    const APPROX_MAX_BASE64_CHARS = 5_600_000 // ≈ 4MB decoded
    if (photoBase64.length > APPROX_MAX_BASE64_CHARS) {
      throw new AppError(400, "Photo is too large — maximum 4MB")
    }
  }

  /**
   * Reject creative content carrying URLs outside the workspace allow-list.
   * The admin gets one actionable 400 naming the offending links, instead of
   * silent blocks at send time.
   */
  private async assertPushLinksAllowed(
    workspaceId: string,
    content: {
      text?: string | null
      photoUrl?: string | null
      videoUrl?: string | null
      description?: string | null
    }
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { allowedExternalLinks: true },
    })
    const allowed = (workspace?.allowedExternalLinks as string[] | null) || []
    const unauthorized = [
      ...findUnauthorizedUrls(content.text || "", allowed),
      ...findUnauthorizedUrls(content.description || "", allowed),
      ...findUnauthorizedUrls(content.photoUrl || "", allowed),
      ...findUnauthorizedUrls(content.videoUrl || "", allowed),
    ]
    if (unauthorized.length > 0) {
      throw new AppError(
        400,
        `Push content contains unauthorized link(s): ${unauthorized.join(", ")}. ` +
          "Add the domain(s) to the workspace allowed external links first."
      )
    }
  }
}
