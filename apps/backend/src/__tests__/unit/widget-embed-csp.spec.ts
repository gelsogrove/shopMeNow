/**
 * Unit tests for widgetEmbedCspMiddleware.
 *
 * WHAT this covers: the frame-ancestors header the /widget-embed page answers
 * with, which is the single thing deciding whether a customer site can iframe
 * the widget at all.
 *
 * WHY it matters: the failure is silent from the server's point of view — the
 * page renders, 200 OK, and only the visitor's browser refuses to display the
 * frame. Nothing in the backend logs says "blocked", so a regression here is
 * invisible until a customer reports the widget missing on their site.
 */

import { NextFunction, Request, Response } from "express"

// The middleware reads the workspace row; the query itself is not under test,
// only what the middleware does with the result.
jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
  },
}))

// Silence the error path's logging without losing the ability to assert on it.
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { widgetEmbedCspMiddleware } from "../../middlewares/widget-embed-csp.middleware"

const findUnique = prisma.workspace.findUnique as jest.Mock

/** Minimal req/res doubles: the middleware only touches query + setHeader. */
function buildContext(workspaceId?: string) {
  const req = { query: workspaceId ? { workspaceId } : {} } as unknown as Request
  const setHeader = jest.fn()
  const res = { setHeader } as unknown as Response
  const next = jest.fn() as unknown as NextFunction
  return { req, res, next, setHeader }
}

/** Reads back the frame-ancestors sources the middleware wrote. */
function writtenSources(setHeader: jest.Mock): string[] {
  const call = setHeader.mock.calls.find(
    ([name]) => name === "Content-Security-Policy"
  )
  if (!call) return []
  return String(call[1]).replace("frame-ancestors ", "").split(" ")
}

describe("widgetEmbedCspMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("always allows the platform's own origins so the /demo pages keep working", async () => {
    findUnique.mockResolvedValue({ allowedExternalLinks: [], websiteUrl: null })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("'self'")
    expect(sources).toContain("https://echatbot.ai")
    expect(sources).toContain("https://www.echatbot.ai")
    expect(next).toHaveBeenCalled()
  })

  it("emits a bare host, so a customer serving over http is not left blocked", async () => {
    // allowedExternalLinks stores hosts without a scheme. Pinning them to https
    // here would silently block any site that is not on TLS yet.
    findUnique.mockResolvedValue({
      allowedExternalLinks: ["acme.com"],
      websiteUrl: null,
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("acme.com")
    expect(next).toHaveBeenCalled()
  })

  it("also allows subdomains, matching what the widget API accepts", async () => {
    // isOriginAllowed treats "www.acme.com" as covered by "acme.com"; without
    // the wildcard the API call would pass and the iframe would still be
    // refused — the exact split-brain this middleware exists to avoid.
    findUnique.mockResolvedValue({
      allowedExternalLinks: ["acme.com"],
      websiteUrl: null,
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    expect(writtenSources(setHeader)).toContain("*.acme.com")
  })

  it("reduces an entry written as a full URL to its host", async () => {
    // A source carrying a scheme+path invalidates the whole directive in the
    // browser, which would block every other site in the list too.
    findUnique.mockResolvedValue({
      allowedExternalLinks: ["https://acme.com/shop?a=1"],
      websiteUrl: null,
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("acme.com")
    expect(sources.some((s) => s.includes("/shop"))).toBe(false)
  })

  it("drops an unparseable entry instead of emitting it", async () => {
    findUnique.mockResolvedValue({
      allowedExternalLinks: ["acme.com", "not a url at all"],
      websiteUrl: null,
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("acme.com")
    expect(sources.some((s) => s.includes(" "))).toBe(false)
  })

  it("falls back to websiteUrl only when no list is configured", async () => {
    // Same precedence as isOriginAllowed: an explicit list wins outright, so a
    // workspace that listed domains does not silently regain its own site.
    findUnique.mockResolvedValue({
      allowedExternalLinks: [],
      websiteUrl: "https://acme.com/it/",
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    expect(writtenSources(setHeader)).toContain("acme.com")
  })

  it("ignores websiteUrl once a list exists", async () => {
    findUnique.mockResolvedValue({
      allowedExternalLinks: ["listed.com"],
      websiteUrl: "https://fallback.com",
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("listed.com")
    expect(sources).not.toContain("fallback.com")
  })

  it("falls back to the platform origins when no workspace is given", async () => {
    const { req, res, next, setHeader } = buildContext(undefined)

    await widgetEmbedCspMiddleware(req, res, next)

    expect(writtenSources(setHeader)).toContain("'self'")
    expect(findUnique).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it("still serves the page when the lookup fails", async () => {
    // Losing the header means the browser applies its permissive default; that
    // is preferable to a 500 that takes the widget down for everyone.
    findUnique.mockRejectedValue(new Error("db down"))
    const { req, res, next } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    expect(logger.error).toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})
