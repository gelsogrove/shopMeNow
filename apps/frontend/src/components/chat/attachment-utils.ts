/**
 * Chat attachment — client-side helpers.
 *
 * Mirrors the backend caps (chat-attachment.validation.ts) so the UI can reject
 * bad files immediately, before any upload. The backend re-validates regardless
 * (never trust the client). All user-facing text is English (UI rule #15).
 */

export type AttachmentKind = "IMAGE" | "DOCUMENT" | "AUDIO"

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "application/pdf"]
export const ACCEPTED_ACCEPT_ATTR = "image/jpeg,image/png,application/pdf"

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024 // 20 MB
export const MAX_ATTACHMENTS = 5

export interface ChatAttachment {
  id: string
  url: string
  kind: AttachmentKind
  mimeType: string
  filename?: string | null
  sizeBytes?: number
}

export function kindOf(mime: string): AttachmentKind | null {
  if (mime === "image/jpeg" || mime === "image/png") return "IMAGE"
  if (mime === "application/pdf") return "DOCUMENT"
  return null
}

export function isImage(mimeOrKind: string): boolean {
  return mimeOrKind === "IMAGE" || mimeOrKind.startsWith("image/")
}

export function isAudio(mimeOrKind: string): boolean {
  return mimeOrKind === "AUDIO" || mimeOrKind.startsWith("audio/")
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/** Validate one File against type + per-type size. Returns an error string or null. */
export function validateFile(file: File): string | null {
  const kind = kindOf(file.type)
  if (!kind) return `"${file.name}": unsupported type. Allowed: JPEG, PNG, PDF.`
  const max = kind === "IMAGE" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES
  if (file.size > max) {
    const label = kind === "IMAGE" ? "Image" : "Document"
    return `"${file.name}": ${label.toLowerCase()} too large (max ${formatBytes(max)}).`
  }
  return null
}

/**
 * Validate a candidate selection against the existing one. Returns the accepted
 * files plus a list of human-readable errors for the rejected ones.
 */
export function validateSelection(
  incoming: File[],
  existingCount: number
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = []
  const errors: string[] = []
  let count = existingCount

  for (const file of incoming) {
    if (count >= MAX_ATTACHMENTS) {
      errors.push(`Maximum ${MAX_ATTACHMENTS} files per message.`)
      break
    }
    const err = validateFile(file)
    if (err) {
      errors.push(err)
      continue
    }
    accepted.push(file)
    count += 1
  }
  return { accepted, errors }
}
