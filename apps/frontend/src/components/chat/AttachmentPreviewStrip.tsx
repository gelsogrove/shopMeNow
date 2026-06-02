/**
 * AttachmentPreviewStrip — staged files shown above the composer before sending.
 *
 * Image files render as a thumbnail (object URL); PDFs render as a labelled
 * chip. Each item has a remove (✕) control. Object URLs are revoked on unmount
 * to avoid memory leaks. English UI.
 */

import { FileText, X } from "lucide-react"
import { useEffect, useMemo } from "react"
import { formatBytes, kindOf } from "./attachment-utils"

interface AttachmentPreviewStripProps {
  files: File[]
  onRemove: (index: number) => void
}

export function AttachmentPreviewStrip({ files, onRemove }: AttachmentPreviewStripProps) {
  // Build object URLs once per file list; revoke them when the list changes.
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        kind: kindOf(file.type),
        objectUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [files]
  )

  useEffect(() => {
    return () => {
      previews.forEach((p) => p.objectUrl && URL.revokeObjectURL(p.objectUrl))
    }
  }, [previews])

  if (files.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-2" data-testid="attachment-preview-strip">
      {previews.map((p, i) => (
        <div
          key={`${p.file.name}-${i}`}
          className="relative flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5 pr-6"
        >
          {p.kind === "IMAGE" && p.objectUrl ? (
            <img
              src={p.objectUrl}
              alt={p.file.name}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-red-50 text-red-500">
              <FileText className="h-6 w-6" />
            </div>
          )}
          <div className="max-w-[120px]">
            <p className="truncate text-xs font-medium text-gray-700">{p.file.name}</p>
            <p className="text-[10px] text-gray-400">{formatBytes(p.file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-gray-400 shadow hover:text-red-500"
            aria-label={`Remove ${p.file.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
