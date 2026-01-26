import { prisma } from '../config/database'
import logger from '../utils/logger'

export interface WorkspaceWhatsAppConfig {
  workspaceId: string
  phoneNumber: string
  apiKey: string
  phoneNumberId?: string | null
  verifyToken?: string | null
  webhookUrl?: string | null
  adminEmail?: string | null
}

/**
 * Load WhatsApp credentials/settings for a workspace from DB.
 * Prefers whatsapp_settings, falls back to workspace columns.
 */
export async function getWorkspaceWhatsAppConfig(
  workspaceId: string
): Promise<WorkspaceWhatsAppConfig | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      whatsappPhoneNumber: true,
      whatsappApiKey: true,
      whatsappPhoneNumberId: true,
      whatsappVerifyToken: true,
      webhookUrl: true,
      whatsappSettings: {
        select: {
          phoneNumber: true,
          apiKey: true,
          webhookUrl: true,
          adminEmail: true,
        },
      },
    },
  })

  if (!workspace) {
    logger.warn(`[WhatsApp Config] Workspace ${workspaceId} not found`)
    return null
  }

  const phoneNumber =
    workspace.whatsappSettings?.phoneNumber || workspace.whatsappPhoneNumber
  const apiKey = workspace.whatsappSettings?.apiKey || workspace.whatsappApiKey
  const webhookUrl =
    workspace.whatsappSettings?.webhookUrl || workspace.webhookUrl
  const adminEmail = workspace.whatsappSettings?.adminEmail

  if (!phoneNumber || !apiKey) {
    logger.warn(
      `[WhatsApp Config] Missing phone/apiKey for workspace ${workspaceId}`
    )
    return null
  }

  return {
    workspaceId,
    phoneNumber,
    apiKey,
    phoneNumberId: workspace.whatsappPhoneNumberId,
    verifyToken: workspace.whatsappVerifyToken,
    webhookUrl,
    adminEmail,
  }
}
