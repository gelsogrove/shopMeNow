/**
 * MessageAttachments — renders the attachments attached to a chat message
 * bubble. Behaviour per attachment type:
 *   • image → thumbnail that opens a fullscreen lightbox (view)
 *   • audio → inline <audio> player (listen) — voice notes both directions
 *   • pdf   → card that DOWNLOADS the file (download)
 * Reuses the shadcn Dialog for the image lightbox. English UI.
 *
 * Alignment (left/right) is decided by the PARENT bubble — this component only
 * renders the media; pass `align` so the thumbnails hug the correct side.
 */

import { Download, FileText } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ChatAttachment, formatBytes, isAudio, isImage } from "./attachment-utils"

interface MessageAttachmentsProps {
  attachments: ChatAttachment[]
  align?: "left" | "right"
}

export function MessageAttachments({ attachments, align = "left" }: MessageAttachmentsProps) {
  const [preview, setPreview] = useState<ChatAttachment | null>(null)

  if (!attachments || attachments.length === 0) return null

  const justify = align === "right" ? "justify-end" : "justify-start"

  return (
    <>
      <div className={`mt-1 flex flex-wrap gap-2 ${justify}`} data-testid="message-attachments">
        {attachments.map((att) =>
          isAudio(att.kind || att.mimeType) ? (
            // 🎤 Voice note → inline audio player (view/listen). Renders for both
            // inbound customer voice notes and outbound bot TTS replies.
            <audio
              key={att.id}
              src={att.url}
              controls
              preload="metadata"
              className="h-10 w-64 max-w-full"
              title={att.filename || "Voice message"}
            >
              <a href={att.url} target="_blank" rel="noreferrer">
                Download audio
              </a>
            </audio>
          ) : isImage(att.kind || att.mimeType) ? (
            // 🖼️ Image → open lightbox (view).
            <button
              key={att.id}
              type="button"
              onClick={() => setPreview(att)}
              className="overflow-hidden rounded-lg border border-gray-200 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green-500"
              title={att.filename || "Image"}
            >
              <img
                src={att.url}
                alt={att.filename || "attachment"}
                className="h-32 w-32 object-cover"
                loading="lazy"
              />
            </button>
          ) : (
            // 📄 PDF → download (anchor with download attribute).
            <a
              key={att.id}
              href={att.url}
              download={att.filename || "document.pdf"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              title={`Download ${att.filename || "document"}`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded bg-red-50 text-red-500">
                <FileText className="h-5 w-5" />
              </span>
              <span className="max-w-[160px]">
                <span className="block truncate text-sm font-medium text-gray-700">
                  {att.filename || "Document.pdf"}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Download className="h-3 w-3" />
                  {att.sizeBytes ? formatBytes(att.sizeBytes) : "Download"}
                </span>
              </span>
            </a>
          )
        )}
      </div>

      {/* Image lightbox (view) */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          {preview && (
            <>
              <DialogTitle className="sr-only">{preview.filename || "Image preview"}</DialogTitle>
              <img
                src={preview.url}
                alt={preview.filename || "preview"}
                className="mx-auto max-h-[80vh] w-auto rounded"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
