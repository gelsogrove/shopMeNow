/**
 * Chat attachment validation
 *
 * Pure, side-effect-free validation for chat message attachments (images + PDF).
 * Kept separate from the upload middleware so it can be unit-tested in isolation
 * and reused by both the WhatsApp inbound pipeline and the operator/widget
 * upload endpoint.
 *
 * Limits are our OWN application caps, deliberately kept at or below the WhatsApp
 * Cloud API limits (image 5MB / document 100MB). We cap PDFs at 20MB to bound
 * storage cost and stay under the operator email (Gmail ~25MB) ceiling when an
 * attachment is forwarded in an escalation.
 *
 * See docs/media-attachments-plan.md.
 */

export type AttachmentKind = "IMAGE" | "DOCUMENT"

// MIME whitelist. WhatsApp only accepts jpeg/png for images; we mirror that.
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png"] as const
export const ACCEPTED_DOCUMENT_MIME = ["application/pdf"] as const
export const ACCEPTED_CHAT_MIME: readonly string[] = [
  ...ACCEPTED_IMAGE_MIME,
  ...ACCEPTED_DOCUMENT_MIME,
]

// Extension whitelist (defense in depth alongside MIME + magic-byte sniffing).
const EXTENSION_BY_MIME: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
}

// Per-type size caps (bytes).
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB (WhatsApp image limit)
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024 // 20 MB (our cap; WA allows 100)

// Max attachments per single message (a WhatsApp multi-file "bundle").
export const MAX_ATTACHMENTS_PER_MESSAGE = 5

export interface AttachmentInput {
  mimeType: string
  filename?: string | null
  sizeBytes: number
}

export interface ValidationResult {
  ok: boolean
  kind?: AttachmentKind
  error?: string
}

/** Map a MIME type to our attachment kind, or null if unsupported. */
export function classifyKind(mimeType: string): AttachmentKind | null {
  const m = (mimeType || "").toLowerCase()
  if ((ACCEPTED_IMAGE_MIME as readonly string[]).includes(m)) return "IMAGE"
  if ((ACCEPTED_DOCUMENT_MIME as readonly string[]).includes(m)) return "DOCUMENT"
  return null
}

function extensionOf(filename?: string | null): string {
  if (!filename) return ""
  const i = filename.lastIndexOf(".")
  return i === -1 ? "" : filename.slice(i).toLowerCase()
}

function maxBytesFor(kind: AttachmentKind): number {
  return kind === "IMAGE" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES
}

function humanMB(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`
}

/**
 * Validate a single attachment's declared metadata (MIME, extension, size).
 * Does NOT inspect bytes — pair with sniffMime() once the buffer is available.
 */
export function validateAttachment(input: AttachmentInput): ValidationResult {
  const mime = (input.mimeType || "").toLowerCase()
  const kind = classifyKind(mime)
  if (!kind) {
    return {
      ok: false,
      error: `Unsupported file type "${input.mimeType}". Allowed: JPEG, PNG, PDF.`,
    }
  }

  // Extension must match the declared MIME (when a filename is provided).
  const ext = extensionOf(input.filename)
  if (ext && !EXTENSION_BY_MIME[mime].includes(ext)) {
    return {
      ok: false,
      error: `File extension "${ext}" does not match type "${mime}".`,
    }
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "Invalid file size." }
  }

  const max = maxBytesFor(kind)
  if (input.sizeBytes > max) {
    const label = kind === "IMAGE" ? "Image" : "Document"
    return {
      ok: false,
      error: `${label} too large (${humanMB(input.sizeBytes)}). Maximum is ${humanMB(max)}.`,
    }
  }

  return { ok: true, kind }
}

/** Validate a batch (count cap + each item). Returns the first failure. */
export function validateAttachmentBatch(inputs: AttachmentInput[]): ValidationResult {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: "No attachments provided." }
  }
  if (inputs.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      ok: false,
      error: `Too many attachments (${inputs.length}). Maximum is ${MAX_ATTACHMENTS_PER_MESSAGE} per message.`,
    }
  }
  for (const input of inputs) {
    const r = validateAttachment(input)
    if (!r.ok) return r
  }
  return { ok: true }
}

/**
 * Inspect the leading bytes of a buffer and return the detected MIME, or null.
 * Magic-byte sniffing prevents a renamed/spoofed file (e.g. an executable named
 * "photo.jpg") from passing extension/MIME checks alone.
 */
export function sniffMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png"
  }
  // PDF: 25 50 44 46 ("%PDF")
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf"
  }
  return null
}

/**
 * Confirm that the real content (sniffed from bytes) matches the declared MIME
 * and is in the whitelist. Use this server-side after receiving the buffer.
 */
export function validateContentMatchesDeclared(
  buffer: Buffer,
  declaredMime: string
): ValidationResult {
  const sniffed = sniffMime(buffer)
  if (!sniffed) {
    return { ok: false, error: "File content is not a supported image or PDF." }
  }
  if (sniffed !== (declaredMime || "").toLowerCase()) {
    return {
      ok: false,
      error: `File content (${sniffed}) does not match declared type (${declaredMime}).`,
    }
  }
  const kind = classifyKind(sniffed)
  return kind ? { ok: true, kind } : { ok: false, error: "Unsupported file type." }
}
