/**
 * Merchant-campaign resolution — the ONLY bridge between the campaign domain
 * and the merchant domain (Andrea, 2026-09-01: "chi fa che cosa").
 *
 * Responsibility: given a merchant + creative chosen for a campaign, verify
 * they are usable (same workspace, active, package not empty) and produce the
 * content SNAPSHOT the campaign will freeze. Nothing else: quota moves are
 * owned elsewhere (top-up: MerchantRepository.topUpQuota; debit: the
 * push-campaigns scheduler job), and link validation stays with the caller,
 * which validates the snapshot like any other campaign content.
 */

import { PrismaClient } from "@echatbot/database"
import { AppError } from "../../interfaces/http/middlewares/error.middleware"

export interface MerchantCampaignSnapshot {
  /** The frozen message: title (WhatsApp bold), text, optional location/video. */
  message: string
  mediaUrl: string | null
  /** Balance at resolution time — the caller warns when it won't cover the segment. */
  quotaRemaining: number
}

export async function resolveMerchantCampaign(
  prisma: PrismaClient,
  workspaceId: string,
  merchantId: string,
  merchantPushId: string | null | undefined
): Promise<MerchantCampaignSnapshot> {
  const merchant = await prisma.merchant.findFirst({
    where: { id: merchantId, workspaceId, deletedAt: null }, // tenant boundary (rule 2)
    select: { isActive: true, quotaRemaining: true, location: true },
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
  const push = await prisma.merchantPush.findFirst({
    where: { id: merchantPushId, workspaceId, merchantId, deletedAt: null },
  })
  if (!push) throw new AppError(404, "Merchant push not found")
  if (!push.isActive) throw new AppError(400, "Merchant push is not active")

  // Snapshot format is mechanism, not copy: title bold, then the creative's
  // own text/location/video — all tenant-authored. MARKDOWN bold (**…**) on
  // purpose: the queue runs mdToWhatsApp before sending, which converts it to
  // WhatsApp's single-asterisk bold — a single asterisk here would be read as
  // Markdown italic and reach the guest as _corsivo_ (caught by the queue
  // media test, 2026-09-01).
  const parts = [`**${push.title}**`, push.text]
  // Location: the creative's own when set, otherwise the merchant's — the
  // push is usually AT the business, so the anagrafica is the default and
  // the per-push field only overrides it (Andrea, 2026-09-01).
  const location = push.location || merchant.location
  if (location) parts.push(`📍 ${location}`)
  if (push.videoUrl) parts.push(push.videoUrl)

  // Photo: an image uploaded from the admin's computer wins over an external
  // URL — it is served by our own public endpoint so WhatsApp can fetch it.
  const backendUrl =
    process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`
  const mediaUrl = push.photoBase64
    ? `${backendUrl}/api/v1/public/merchant-pushes/${push.id}/photo.jpg`
    : push.photoUrl ?? null

  return {
    message: parts.join("\n\n"),
    mediaUrl,
    quotaRemaining: merchant.quotaRemaining,
  }
}

/**
 * True for URLs our own backend serves (uploaded creative photos): they are
 * platform assets, not external content, so the campaign allow-list check
 * must not reject them (in local dev the backend origin is localhost, which
 * no allow-list would ever contain).
 */
export function isOwnMerchantPushPhotoUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/public/merchant-pushes/")
  } catch {
    return false
  }
}
