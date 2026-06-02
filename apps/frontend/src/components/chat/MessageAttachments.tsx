/**
 * MessageAttachments — renders the attachments attached to a chat message
 * bubble. Images show as thumbnails that open a fullscreen lightbox; PDFs show
 * as a card that opens an inline viewer. Reuses the shadcn Dialog (same pattern
 * as the existing YouTubePlayerModal). English UI.
 *
 * Alignment (left/right) is decided by the PARENT bubble — this component only
 * renders the media; pass `align` so the thumbnails hug the correct side.
 */

import { Download, FileText } from "lucide-react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChatAttachment, formatBytes, isImage } from "./attachment-utils"

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
          isImage(att.kind || att.mimeType) ? (
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
            <button
              key={att.id}
              type="button"
              onClick={() => setPreview(att)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              title={att.filename || "Document"}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded bg-red-50 text-red-500">
                <FileText className="h-5 w-5" />
              </span>
              <span className="max-w-[160px]">
                <span className="block truncate text-sm font-medium text-gray-700">
                  {att.filename || "Document.pdf"}
                </span>
                {att.sizeBytes ? (
                  <span className="block text-xs text-gray-400">{formatBytes(att.sizeBytes)}</span>
                ) : null}
              </span>
            </button>
          )
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          {preview && isImage(preview.kind || preview.mimeType) ? (
            <>
              <DialogTitle className="sr-only">{preview.filename || "Image preview"}</DialogTitle>
              <img
                src={preview.url}
                alt={preview.filename || "preview"}
                className="mx-auto max-h-[80vh] w-auto rounded"
              />
            </>
          ) : preview ? (
            <>
              <DialogTitle className="flex items-center justify-between px-2 text-sm">
                <span className="truncate">{preview.filename || "Document.pdf"}</span>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-green-600 hover:underline"
                >
                  <Download className="h-4 w-4" /> Open
                </a>
              </DialogTitle>
              {/* PDFs uploaded to Cloudinary as `raw` are served with
                  content-type application/octet-stream, which browsers refuse
                  to render inline in an <iframe> (you get the broken-document
                  icon). Embedding through Google's document viewer renders the
                  PDF regardless of the origin content-type. If that ever fails,
                  the "Open" link above still downloads/opens the file directly. */}
              <iframe
                title={preview.filename || "PDF preview"}
                src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
                  preview.url
                )}`}
                className="h-[80vh] w-full rounded border-0"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
