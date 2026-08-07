import { prisma } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
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
 * The allowed sites live in the database and change without a deploy, which is
 * why this cannot be part of the static helmet config: helmet builds its header
 * once at startup.
 *
 * The source of truth is Workspace.allowedExternalLinks — the SAME list the
 * widget API already enforces per request (isOriginAllowed in
 * widget-chat.controller.ts). Keeping one list matters: these two checks fail
 * in completely different ways (the CSP blocks the iframe with a console error,
 * the API answers 403 and the widget just never appears), so a site present in
 * one list but not the other produces a bug that looks like two unrelated
 * problems. Entries are stored as bare hosts ("acme.com") and, as in the API
 * check, subdomains of a listed host are accepted too.
 *
 * helmet overwrites Content-Security-Policy unconditionally, so this
 * middleware cannot simply run before it — app.ts skips the helmet CSP for
 * this path and mounts this middleware in its place. Both must stay in sync:
 * if the path stops being excluded there, the header written here is silently
 * replaced and every customer site goes back to being blocked.
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
 * Turns one allow-list entry into the CSP sources that let that site frame the
 * widget. Entries are written as bare hosts ("acme.com"), but a full URL is
 * accepted too and reduced to its host — allowedExternalLinks is also used for
 * other purposes, so values there are not guaranteed to be bare.
 *
 * Two sources come back per entry: the host itself and "*.host", because the
 * API-side check (isOriginAllowed) accepts subdomains of a listed host. Without
 * the wildcard a site listed as "acme.com" would pass the API call and still be
 * refused the iframe when served from "www.acme.com".
 *
 * Anything unparseable is dropped rather than passed through: one invalid
 * source makes the browser reject the entire directive, which would block every
 * correctly-spelled site alongside it.
 */
function toFrameAncestorSources(entry: string): string[] {
  const trimmed = entry.trim()
  if (!trimmed) return []

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    // Host only, no scheme: an entry stored without one must not be pinned to
    // https here, or a customer serving over http silently stays blocked.
    const { host } = new URL(candidate)
    if (!host) return []
    return [host, `*.${host}`]
  } catch {
    return []
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
      select: { allowedExternalLinks: true, websiteUrl: true },
    })

    // Same precedence as isOriginAllowed: the explicit list wins, and
    // websiteUrl stands in only when no list was configured.
    const configuredList = (workspace?.allowedExternalLinks ?? []).filter(Boolean)
    const allowList = configuredList.length
      ? configuredList
      : workspace?.websiteUrl
        ? [workspace.websiteUrl]
        : []

    const configured = allowList.flatMap(toFrameAncestorSources)

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
