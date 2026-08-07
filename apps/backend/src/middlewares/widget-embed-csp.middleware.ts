import { NextFunction, Request, Response } from "express"
import { prisma } from "../lib/prisma"
import logger from "../utils/logger"

/**
 * Per-request CSP for the embeddable widget page (/widget-embed).
 *
 * The widget script running on a customer site loads /widget-embed inside an
 * iframe. The browser only allows that when the page answers with a
 * frame-ancestors directive naming the embedding site — and the static CSP
 * configured on helmet lists echatbot.ai domains only, so every customer site
 * is blocked.
 *
 * The allowed sites live in the database (Workspace.widgetAllowedDomains) and
 * change without a deploy, which is why this cannot be part of the static
 * helmet config: helmet builds its header once at startup. This middleware
 * runs first, resolves the workspace from the query string, and writes the
 * header itself; the helmet CSP that runs afterwards leaves an existing
 * Content-Security-Policy header alone.
 *
 * A workspace with no domains configured stays embeddable from echatbot.ai
 * itself only — the same behaviour as before the column existed.
 */

// Origins that may always embed the widget: the platform's own pages, which is
// what makes the /demo/<slug> showcase pages work.
const PLATFORM_FRAME_ANCESTORS = [
  "'self'",
  "https://echatbot.ai",
  "https://www.echatbot.ai",
]

/**
 * Reduces a configured entry to a CSP source expression. Values are stored as
 * origins ("https://acme.com"), but a bare hostname ("acme.com") is accepted
 * too and normalised to https — writing the scheme is easy to forget and the
 * mistake would silently keep the customer blocked.
 *
 * Anything that is not a parseable origin is dropped rather than passed
 * through: an invalid source would make the browser reject the whole
 * directive, blocking even the origins that were spelled correctly.
 */
function toFrameAncestorSource(entry: string): string | null {
  const trimmed = entry.trim()
  if (!trimmed) return null

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    // Origin only — CSP frame-ancestors matches on scheme/host/port and a path
    // would invalidate the source.
    return url.origin
  } catch {
    return null
  }
}

export async function widgetEmbedCspMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workspaceId =
    typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined

  if (!workspaceId) {
    // No workspace to resolve: fall through to the platform default rather
    // than leaving the page with no frame-ancestors at all.
    res.setHeader(
      "Content-Security-Policy",
      `frame-ancestors ${PLATFORM_FRAME_ANCESTORS.join(" ")}`
    )
    next()
    return
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { widgetAllowedDomains: true },
    })

    const configured = (workspace?.widgetAllowedDomains ?? [])
      .map(toFrameAncestorSource)
      .filter((source): source is string => source !== null)

    const sources = [...PLATFORM_FRAME_ANCESTORS, ...configured]

    res.setHeader(
      "Content-Security-Policy",
      `frame-ancestors ${[...new Set(sources)].join(" ")}`
    )
  } catch (error) {
    // Never fail the page over this: without the header the browser applies
    // its default (allow), so the widget still renders while the error is
    // surfaced in the logs.
    logger.error(
      `[WIDGET-EMBED-CSP] Failed to resolve allowed domains for workspace ${workspaceId}:`,
      error
    )
  }

  next()
}
