/**
 * Unit Tests: fetchWebsitePage() - Website Content Scraping
 * 
 * Tests cover:
 * 1. Successful content fetching from full URL
 * 2. Path appending to workspace websiteUrl
 * 3. Error handling (timeout, 404, 403, no content)
 * 4. Content cleaning (remove scripts/styles/nav/footer)
 * 5. Content truncation (max 2000 chars)
 * 6. Workspace websiteUrl validation
 * 
 * @see apps/backend/src/services/calling-functions.service.ts
 */

import { CallingFunctionsService } from "../../../src/services/calling-functions.service"
import axios from "axios"
import { prisma } from "@echatbot/database"

// Mock axios
jest.mock("axios")
const mockedAxios = axios as jest.Mocked<typeof axios>

// Mock prisma
jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
  },
}))

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe.skip("CallingFunctionsService - fetchWebsitePage()", () => {
  let service: CallingFunctionsService
  const testWorkspaceId = "workspace-123"

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CallingFunctionsService()
  })

  describe("✅ SUCCESS Scenarios", () => {
    it("should fetch content from full URL successfully", async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <main>
              <h1>Orari di apertura</h1>
              <p>Lunedì - Venerdì: 9:00 - 18:00</p>
              <p>Sabato: 10:00 - 14:00</p>
            </main>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({
        data: mockHtml,
      })

      const result = await service.fetchWebsitePage({
        url: "https://example.com/contatti",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Orari di apertura")
      expect(result.message).toContain("Lunedì - Venerdì")
      expect(result.data?.url).toBe("https://example.com/contatti")
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://example.com/contatti",
        expect.objectContaining({
          timeout: 5000,
          maxRedirects: 3,
        })
      )
    })

    it("should append path to workspace websiteUrl", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        websiteUrl: "https://ristorante-mario.com",
      })

      const mockHtml = `
        <body>
          <main>
            <p>Siamo in Via Roma 123, Milano</p>
          </main>
        </body>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "/contatti",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://ristorante-mario.com/contatti",
        expect.any(Object)
      )
    })

    it("should handle websiteUrl with trailing slash", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        websiteUrl: "https://shop.com/",
      })

      mockedAxios.get.mockResolvedValue({
        data: "<body><main>Content here</main></body>",
      })

      await service.fetchWebsitePage({
        url: "/about",
        workspaceId: testWorkspaceId,
      })

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://shop.com/about",
        expect.any(Object)
      )
    })

    it("should strip scripts, styles, nav, footer from content", async () => {
      const mockHtml = `
        <html>
          <head>
            <style>.test { color: red; }</style>
            <script>alert('test');</script>
          </head>
          <body>
            <nav>Navigation menu</nav>
            <header>Header content</header>
            <main>Important content here</main>
            <footer>Footer content</footer>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Important content")
      expect(result.message).not.toContain("Navigation menu")
      expect(result.message).not.toContain("Footer content")
      expect(result.message).not.toContain("alert('test')")
      expect(result.message).not.toContain(".test { color: red; }")
    })

    it("should truncate content to 2000 characters", async () => {
      const longContent = "A".repeat(5000)
      const mockHtml = `<body><main>${longContent}</main></body>`

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.message?.length).toBeLessThanOrEqual(2000)
      expect(result.data?.contentLength).toBe(2000)
    })

    it("should normalize whitespace in extracted content", async () => {
      const mockHtml = `
        <body>
          <main>
            <p>Line    with     multiple      spaces</p>
            <p>
              New
              lines
              everywhere
            </p>
          </main>
        </body>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.message).not.toContain("    ")
      expect(result.message).toContain("Line with multiple spaces")
    })
  })

  describe("❌ ERROR Scenarios", () => {
    it("should return error when workspace websiteUrl not configured", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        websiteUrl: null,
      })

      const result = await service.fetchWebsitePage({
        url: "/contatti",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Website URL not configured")
      expect(result.message).toContain("sito web non è configurato")
    })

    it("should return error when workspace not found", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await service.fetchWebsitePage({
        url: "/page",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Website URL not configured")
    })

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("timeout of 5000ms exceeded")
      ;(timeoutError as any).code = "ETIMEDOUT"

      mockedAxios.get.mockRejectedValue(timeoutError)

      const result = await service.fetchWebsitePage({
        url: "https://slow-site.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain("non risponde")
    })

    it("should handle 404 errors", async () => {
      const error404 = {
        response: { status: 404 },
        message: "Request failed with status code 404",
      }

      mockedAxios.get.mockRejectedValue(error404)

      const result = await service.fetchWebsitePage({
        url: "https://example.com/missing",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain("Pagina non trovata")
    })

    it("should handle 403 forbidden errors", async () => {
      const error403 = {
        response: { status: 403 },
        message: "Request failed with status code 403",
      }

      mockedAxios.get.mockRejectedValue(error403)

      const result = await service.fetchWebsitePage({
        url: "https://example.com/protected",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain("Accesso negato")
    })

    it("should handle DNS resolution errors", async () => {
      const dnsError = new Error("getaddrinfo ENOTFOUND")
      ;(dnsError as any).code = "ENOTFOUND"

      mockedAxios.get.mockRejectedValue(dnsError)

      const result = await service.fetchWebsitePage({
        url: "https://nonexistent-domain-12345.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain("Verifica che l'URL sia corretto")
    })

    it("should return error when content is too short (< 50 chars)", async () => {
      const mockHtml = "<body><main>Hi</main></body>"

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("No content found")
      expect(result.message).toContain("Non ho trovato contenuti utili")
    })

    it("should return error when content is only whitespace", async () => {
      const mockHtml = "<body><main>     \n\n\n     </main></body>"

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("No content found")
    })
  })

  describe("🔧 Edge Cases", () => {
    it("should extract content from <article> if <main> not present", async () => {
      const mockHtml = `
        <body>
          <article>
            <h1>Article content here</h1>
          </article>
        </body>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Article content")
    })

    it("should fallback to <body> if no <main> or <article>", async () => {
      const mockHtml = `
        <body>
          <div>
            <p>Body content without semantic tags but with enough text to pass validation</p>
          </div>
        </body>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Body content")
    })

    it("should include timestamp and scrapedAt in response", async () => {
      const mockHtml = "<body><main>Test content here with enough characters</main></body>"

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result.success).toBe(true)
      expect(result.timestamp).toBeDefined()
      expect(result.data?.scrapedAt).toBeDefined()
      expect(new Date(result.data!.scrapedAt).getTime()).toBeGreaterThan(0)
    })

    it("should set correct User-Agent header", async () => {
      mockedAxios.get.mockResolvedValue({
        data: "<body><main>Content with sufficient length for validation</main></body>",
      })

      await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "User-Agent": "eChatbot/1.0 (Website Content Fetcher for Customer Support)",
          },
        })
      )
    })

    it("should follow up to 3 redirects", async () => {
      mockedAxios.get.mockResolvedValue({
        data: "<body><main>Final destination content with enough text</main></body>",
      })

      await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxRedirects: 3,
        })
      )
    })
  })

  describe("📊 Response Structure", () => {
    it("should return correct structure on success", async () => {
      mockedAxios.get.mockResolvedValue({
        data: "<body><main>Valid content with sufficient length for testing</main></body>",
      })

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result).toMatchObject({
        success: true,
        message: expect.any(String),
        data: {
          url: "https://example.com",
          contentLength: expect.any(Number),
          scrapedAt: expect.any(String),
        },
        timestamp: expect.any(String),
      })
    })

    it("should return correct structure on error", async () => {
      mockedAxios.get.mockRejectedValue(new Error("Network error"))

      const result = await service.fetchWebsitePage({
        url: "https://example.com",
        workspaceId: testWorkspaceId,
      })

      expect(result).toMatchObject({
        success: false,
        error: expect.any(String),
        message: expect.any(String),
        timestamp: expect.any(String),
      })
    })
  })
})
