/**
 * Inbound media ingestion
 *
 * Orchestrates: download (via the active WhatsApp provider) → validate bytes
 * (magic-byte sniff + per-type size cap) → upload to our own storage (private
 * chat-attachments folder) → persist a MessageAttachment row.
 *
 * DESIGN: collaborators are injected (downloader / storage / repository) so this
 * is unit-testable without the network, Cloudinary, or the generated Prisma
 * client, and so the WhatsApp webhook can wire in the real implementations.
 *
 * FAIL-SAFE: every path returns a result object; this function never throws.
 * A media failure must never break the text-message pipeline (plan §4, §11).
 *
 * SECURITY: we trust the BYTES, not the provider's declared content-type. The
 * true MIME is sniffed from the buffer; a spoofed/oversized file is rejected
 * before it ever reaches storage. (plan §11)
 *
 * See docs/media-attachments-plan.md.
 */

import {
  InboundMediaRef,
  InboundMediaResult,
} from "./whatsapp/whatsapp-provider.interface"
import {
  AttachmentKind,
  MAX_ATTACHMENTS_PER_MESSAGE,
  classifyKind,
  sniffMime,
  validateAttachment,
} from "./chat-attachment.validation"

// ── Injected collaborators ────────────────────────────────────────────────────

export interface MediaDownloader {
  downloadInboundMedia?(ref: InboundMediaRef): Promise<InboundMediaResult>
}

export interface AttachmentStorage {
  upload(
    buffer: Buffer,
    options: {
      filename: string
      folder: string
      contentType: string
      isPublic?: boolean
    }
  ): Promise<{ url: string; key: string }>
}

export interface NewAttachmentRow {
  conversationMessageId: string
  workspaceId: string
  kind: AttachmentKind
  url: string
  storageKey: string
  mimeType: string
  filename?: string | null
  sizeBytes: number
  waMediaId?: string | null
}

export interface AttachmentRepository {
  create(row: NewAttachmentRow): Promise<{ id: string }>
}

export interface IngestDeps {
  provider: MediaDownloader
  storage: AttachmentStorage
  repository: AttachmentRepository
  logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void }
}

// ── Input / output ──────────────────────────────────────────────────────────

export interface IngestInput {
  workspaceId: string
  chatSessionId: string
  conversationMessageId: string
  ref: InboundMediaRef
  /** Optional filename hint from the webhook (documents usually carry one). */
  filename?: string | null
  /** WhatsApp media id, for audit / potential re-download within 14 days. */
  waMediaId?: string | null
}

export interface IngestResult {
  ok: boolean
  error?: string
  attachment?: {
    id: string
    url: string
    storageKey: string
    kind: AttachmentKind
    mimeType: string
    sizeBytes: number
    filename?: string | null
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
}

/**
 * Ingest one inbound media item. Returns { ok:false, error } on any problem
 * (unsupported provider, bad/oversized/spoofed file, download/upload failure)
 * without throwing.
 */
export async function ingestInboundMedia(
  deps: IngestDeps,
  input: IngestInput
): Promise<IngestResult> {
  const log = deps.logger
  try {
    if (typeof deps.provider.downloadInboundMedia !== "function") {
      return { ok: false, error: "provider_does_not_support_media_download" }
    }
    if (!input.ref?.mediaId && !input.ref?.mediaUrl) {
      return { ok: false, error: "missing_media_reference" }
    }

    // 1. Download bytes from the provider.
    const downloaded = await deps.provider.downloadInboundMedia(input.ref)
    const buffer = downloaded.buffer
    if (!buffer || buffer.length === 0) {
      return { ok: false, error: "empty_media" }
    }

    // 2. Trust the bytes: sniff the true MIME, ignore the declared one.
    const trueMime = sniffMime(buffer)
    if (!trueMime) {
      log?.warn?.("[inbound-media] rejected: content is not a supported image/PDF")
      return { ok: false, error: "unsupported_content" }
    }

    // 3. Validate type + size against our caps.
    const validation = validateAttachment({
      mimeType: trueMime,
      filename: input.filename,
      sizeBytes: buffer.length,
    })
    if (!validation.ok || !validation.kind) {
      log?.warn?.(`[inbound-media] rejected: ${validation.error}`)
      return { ok: false, error: validation.error || "validation_failed" }
    }
    const kind = validation.kind

    // 4. Upload to our private chat-attachments folder, scoped per workspace +
    //    session so the whole folder can be deleted by prefix on cleanup.
    const folder = `chat-attachments/${input.workspaceId}/${input.chatSessionId}`
    const ext = EXT_BY_MIME[trueMime] || "bin"
    const rand = Math.random().toString(36).slice(2, 8)
    const storageFilename = `${Date.now()}_${rand}.${ext}`

    const uploaded = await deps.storage.upload(buffer, {
      filename: storageFilename,
      folder,
      contentType: trueMime,
      // v1: public but with an unguessable random key, so the URL is fetchable
      // both by the operator UI and (for replies) by the provider. Production
      // hardening = authenticated/signed URLs (plan §11). Customer media is PII.
      isPublic: true,
    })

    // 5. Persist the attachment row (DB cascade removes it with the message;
    //    the binary is removed via storageKey by the lifecycle service).
    const saved = await deps.repository.create({
      conversationMessageId: input.conversationMessageId,
      workspaceId: input.workspaceId,
      kind,
      url: uploaded.url,
      storageKey: uploaded.key,
      mimeType: trueMime,
      filename: input.filename ?? null,
      sizeBytes: buffer.length,
      waMediaId: input.waMediaId ?? null,
    })

    log?.info?.("[inbound-media] ingested", {
      conversationMessageId: input.conversationMessageId,
      kind,
      mimeType: trueMime,
      sizeBytes: buffer.length,
    })

    return {
      ok: true,
      attachment: {
        id: saved.id,
        url: uploaded.url,
        storageKey: uploaded.key,
        kind,
        mimeType: trueMime,
        sizeBytes: buffer.length,
        filename: input.filename ?? null,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log?.error?.(`[inbound-media] ingestion failed: ${msg}`)
    return { ok: false, error: msg }
  }
}

/**
 * Ingest a bundle of inbound media (a WhatsApp multi-file burst grouped into one
 * logical turn). Enforces the per-message count cap and ingests each item
 * independently — one failure does not abort the others.
 */
export async function ingestInboundMediaBundle(
  deps: IngestDeps,
  inputs: IngestInput[]
): Promise<IngestResult[]> {
  const capped = inputs.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
  if (inputs.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    deps.logger?.warn?.(
      `[inbound-media] bundle truncated ${inputs.length} → ${MAX_ATTACHMENTS_PER_MESSAGE}`
    )
  }
  const results: IngestResult[] = []
  for (const input of capped) {
    results.push(await ingestInboundMedia(deps, input))
  }
  return results
}
