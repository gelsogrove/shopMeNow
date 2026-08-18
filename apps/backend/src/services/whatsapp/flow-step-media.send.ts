// 📎 Flow-step media delivery on WhatsApp — ONE definition for every inbound
// path (UltraMsg webhook, Meta/Wasender via whatsapp-inbound.pipeline).
//
// The media are flow builder Assets (url/type/title), deterministic node data
// the LLM never sees. Images/videos/documents go out as native WhatsApp media
// (documents carry a filename so the customer's chat shows the real name, not
// "Untitled"); Asset type "link" stays a titled text line — a link is not a
// file. Fail-safe per item: one failed media never blocks the others or the
// reply that already went out.

import logger from "../../utils/logger"
import { WhatsAppDirectSendService } from "../whatsapp-direct-send.service"

export interface FlowStepMedia {
  url: string
  type: string
  title: string
}

export async function sendFlowStepMedia(
  directSend: WhatsAppDirectSendService,
  params: {
    workspaceId: string
    customerId: string
    phoneNumber: string
    media: FlowStepMedia[]
  }
): Promise<void> {
  const { workspaceId, customerId, phoneNumber, media } = params

  for (const item of media) {
    try {
      if (item.type === "image" || item.type === "video" || item.type === "document") {
        const urlExt = new URL(item.url).pathname.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ""
        await directSend.sendMedia({
          workspaceId,
          customerId,
          phoneNumber,
          mediaUrl: item.url,
          caption: item.title,
          mediaType: item.type,
          ...(item.type === "document"
            ? {
                filename:
                  urlExt && !item.title.toLowerCase().endsWith(urlExt.toLowerCase())
                    ? `${item.title}${urlExt}`
                    : item.title,
              }
            : {}),
          skipSecurityCheck: true,
        })
      } else {
        await directSend.send({
          workspaceId,
          customerId,
          phoneNumber,
          messageContent: `${item.title}: ${item.url}`,
          skipSecurityCheck: true,
        })
      }
    } catch (mediaError) {
      logger.error("[FLOW-STEP-MEDIA] ❌ Failed to send flow-step media", {
        error: mediaError instanceof Error ? mediaError.message : String(mediaError),
        url: item.url,
        workspaceId,
      })
    }
  }
}
