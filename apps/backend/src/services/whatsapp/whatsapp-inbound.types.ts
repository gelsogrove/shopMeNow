/**
 * Shared inbound-message contract (provider-agnostic webhook pipeline)
 *
 * GOAL: switching WhatsApp provider (Meta / UltraMsg / Wasender) must yield the
 * SAME result. To achieve that, every provider webhook controller does only two
 * provider-specific things — verify its signature and PARSE its raw payload into
 * a `NormalizedInboundMessage` — then hands that object to the single shared
 * `WhatsAppInboundPipeline.process()`. The pipeline runs all agnostic steps
 * (dedup, billing, security, rate limit, custom-ecolaundry / chatEngine, media,
 * typing, direct send) identically regardless of provider.
 *
 * This file is the seam. It defines the data crossing the parse → process
 * boundary, plus the result the pipeline returns to the controller (which then
 * writes the HTTP response — the pipeline never touches `res`).
 *
 * See docs/memory-bank/PRD.md and the per-provider extract helpers
 * (webhook-media.extract.ts, webhook-reaction.extract.ts).
 */

import { ExtractedMedia } from "../webhook-media.extract"
import { ExtractedReaction } from "../webhook-reaction.extract"

/** Which provider parsed the inbound payload (drives outbound send via factory). */
export type WhatsAppProviderKind = "meta" | "ultramsg" | "wasender"

/**
 * The normalized result of a provider's PARSE stage — everything the shared
 * pipeline needs and nothing provider-specific. Each controller builds one of
 * these from its own payload shape, then calls the pipeline.
 */
export interface NormalizedInboundMessage {
  /** Provider that produced this message (for logging + outbound parity). */
  provider: WhatsAppProviderKind

  /**
   * Workspace resolution input. Meta/UltraMsg resolve via `webhookId`; Wasender
   * already knows its `workspaceId` from the route. Exactly one is required —
   * the pipeline loads the workspace from whichever is present.
   */
  webhookId?: string
  workspaceId?: string

  /** Sender phone, normalized to E.164 (leading +). */
  phoneNumber: string
  /** All phone format variants for fuzzy customer lookup. */
  phoneVariants: string[]

  /** Provider message id (Meta wamid / UltraMsg id / Wasender key.id). Dedup key. */
  messageId: string

  /** Inbound text body (already provider-decoded; may be empty for media/reaction). */
  messageText: string

  /** Unix ms timestamp of the inbound message, when the provider supplies it (Meta). */
  messageTimestamp?: number

  /** Contact display name when the provider supplies it (Meta contacts profile). */
  contactName?: string

  /** Inbound media reference (image/document) or null. */
  inboundMedia: ExtractedMedia | null

  /** Inbound reaction (emoji + reacted-to id) or null. */
  inboundReaction: ExtractedReaction | null

  /**
   * Playground/test invocation — skip signature, billing, security and ignore
   * DB language. Real provider webhooks set this false.
   */
  isPlayground: boolean

  /**
   * Provider session/instance id already verified by the controller's signature
   * step (UltraMsg instanceId, Wasender sessionId). Informational for logging.
   */
  providerSessionId?: string
}

/**
 * What the shared pipeline returns. The controller translates this into the
 * HTTP response: `res.status(statusCode).json(body ?? { status, code })`.
 * The pipeline NEVER writes to `res` itself — it stays transport-agnostic so the
 * same logic is reusable (webhook, playground, future channels).
 */
export interface PipelineResult {
  /** HTTP status the controller should send (200, 402, 403, 404, 409, 410, 429, 500). */
  statusCode: number
  /** Short machine status: "processed" | "duplicate" | "blocked" | "rate_limited" | ... */
  status: string
  /** Optional machine-readable code (e.g. "INSUFFICIENT_CREDIT", "CHANNEL_DISABLED"). */
  code?: string
  /** Full JSON body to return; when omitted the controller sends { status, code }. */
  body?: Record<string, unknown>
}
