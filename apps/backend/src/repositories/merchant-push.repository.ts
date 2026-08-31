/**
 * MerchantPushRepository
 *
 * Data access for a merchant's advertising creatives (title, text, photo,
 * video, location). Reusable across campaigns — campaign creation snapshots
 * the content, so editing a creative never rewrites a scheduled campaign.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation).
 * Soft delete, same reasoning as merchants: history backs invoicing.
 */

import { MerchantPush, PrismaClient } from "@echatbot/database"

export interface CreateMerchantPushData {
  workspaceId: string
  merchantId: string
  title: string
  text: string
  photoUrl?: string | null
  /** Uploaded image (data URI or raw base64) — served publicly for WhatsApp. */
  photoBase64?: string | null
  videoUrl?: string | null
  location?: string | null
  description?: string | null
  isActive?: boolean
}

export type UpdateMerchantPushData = Partial<
  Omit<CreateMerchantPushData, "workspaceId" | "merchantId">
>

export class MerchantPushRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, workspaceId: string): Promise<MerchantPush | null> {
    return this.prisma.merchantPush.findFirst({
      where: { id, workspaceId, deletedAt: null },
    })
  }

  async findAllForMerchant(
    merchantId: string,
    workspaceId: string
  ): Promise<Array<Omit<MerchantPush, "photoBase64">>> {
    // The uploaded photo can be megabytes of base64 — never shipped in
    // listings. The public photo endpoint serves it by id when needed.
    return this.prisma.merchantPush.findMany({
      where: { merchantId, workspaceId, deletedAt: null },
      omit: { photoBase64: true },
      orderBy: { createdAt: "desc" },
    })
  }

  async create(data: CreateMerchantPushData): Promise<MerchantPush> {
    return this.prisma.merchantPush.create({ data })
  }

  async update(
    id: string,
    workspaceId: string,
    data: UpdateMerchantPushData
  ): Promise<MerchantPush | null> {
    const result = await this.prisma.merchantPush.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data,
    })
    if (result.count === 0) return null
    return this.findById(id, workspaceId)
  }

  async softDelete(id: string, workspaceId: string): Promise<boolean> {
    const result = await this.prisma.merchantPush.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    })
    return result.count > 0
  }
}
