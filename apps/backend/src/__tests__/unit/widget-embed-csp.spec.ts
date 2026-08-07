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
    findUnique.mockResolvedValue({ widgetAllowedDomains: [] })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("'self'")
    expect(sources).toContain("https://echatbot.ai")
    expect(sources).toContain("https://www.echatbot.ai")
    expect(next).toHaveBeenCalled()
  })

  it("adds the workspace's configured sites to the platform defaults", async () => {
    findUnique.mockResolvedValue({
      widgetAllowedDomains: ["https://acme.com", "https://shop.acme.com"],
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("https://acme.com")
    expect(sources).toContain("https://shop.acme.com")
    expect(next).toHaveBeenCalled()
  })

  it("upgrades a bare hostname to https, since omitting the scheme is easy to do", async () => {
    findUnique.mockResolvedValue({ widgetAllowedDomains: ["acme.com"] })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    expect(writtenSources(setHeader)).toContain("https://acme.com")
  })

  it("reduces an entry with a path to its origin", async () => {
    // A source carrying a path invalidates the whole directive in the browser,
    // which would block every other site in the list too.
    findUnique.mockResolvedValue({
      widgetAllowedDomains: ["https://acme.com/shop?a=1"],
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("https://acme.com")
    expect(sources.some((s) => s.includes("/shop"))).toBe(false)
  })

  it("drops an unparseable entry instead of emitting it", async () => {
    findUnique.mockResolvedValue({
      widgetAllowedDomains: ["https://acme.com", "not a url at all"],
    })
    const { req, res, next, setHeader } = buildContext("ws-1")

    await widgetEmbedCspMiddleware(req, res, next)

    const sources = writtenSources(setHeader)
    expect(sources).toContain("https://acme.com")
    expect(sources.some((s) => s.includes(" "))).toBe(false)
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
