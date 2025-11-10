/**
 * QueryAnalyzerAgent Multi-Language Tests
 *
 * Tests the QueryAnalyzerAgent's ability to:
 * 1. Understand queries in IT/EN/ES/PT
 * 2. Extract categories, suppliers, certifications, regions
 * 3. Translate keywords to Italian (base language)
 * 4. Handle conversational context
 *
 * Run: npm run test:unit -- query-analyzer-agent.test.ts
 */

import { PrismaClient } from "@prisma/client"
import { QueryAnalyzerAgentLLM } from "../../application/agents/QueryAnalyzerAgentLLM"

const prisma = new PrismaClient()
let queryAnalyzer: QueryAnalyzerAgentLLM
let workspaceId: string

// Get workspace ID from seed
beforeAll(async () => {
  const workspace = await prisma.workspace.findFirst({
    where: { slug: "bellitalia" },
  })
  if (!workspace) {
    throw new Error("Workspace not found. Run 'npm run seed' first.")
  }
  workspaceId = workspace.id
  queryAnalyzer = new QueryAnalyzerAgentLLM(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe("QueryAnalyzerAgent - Multi-Language", () => {
  describe("Italian Queries", () => {
    test("should extract region and certification from Italian query", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "formaggio sardo biologico",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Sardinia")
      expect(result.filters.certifications).toContain("isOrganic")
      expect(result.filters.keywords).toEqual(
        expect.arrayContaining(["formaggio", "sardo", "biologico"])
      )
    }, 15000)

    test("should extract multiple certifications", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "pasta integrale senza glutine vegana",
      })

      expect(result.success).toBe(true)
      expect(result.filters.certifications).toContain("isWholeGrain")
      expect(result.filters.certifications).toContain("isGlutenFree")
      expect(result.filters.certifications).toContain("isVegan")
    }, 15000)
  })

  describe("English Queries", () => {
    test("should translate English query to Italian keywords", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "organic sardinian cheese",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Sardinia")
      expect(result.filters.certifications).toContain("isOrganic")
      // Keywords should be translated to Italian
      expect(result.filters.keywords).toEqual(
        expect.arrayContaining(["formaggio", "sardo", "biologico"])
      )
    }, 15000)

    test("should handle region names in English", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "products from Sicily",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Sicily")
    }, 15000)
  })

  describe("Spanish Queries", () => {
    test("should translate Spanish query to Italian keywords", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "queso sardo orgánico",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Sardinia")
      expect(result.filters.certifications).toContain("isOrganic")
      expect(result.filters.keywords).toEqual(
        expect.arrayContaining(["formaggio", "sardo", "biologico"])
      )
    }, 15000)

    test("should handle Spanish certification terms", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "pasta vegana sin gluten",
      })

      expect(result.success).toBe(true)
      expect(result.filters.certifications).toContain("isVegan")
      expect(result.filters.certifications).toContain("isGlutenFree")
    }, 15000)
  })

  describe("Portuguese Queries", () => {
    test("should translate Portuguese query to Italian keywords", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "queijo sardo orgânico",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Sardinia")
      expect(result.filters.certifications).toContain("isOrganic")
      expect(result.filters.keywords).toEqual(
        expect.arrayContaining(["formaggio", "sardo", "biologico"])
      )
    }, 15000)

    test("should handle Portuguese certification terms", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "massa integral sem glúten",
      })

      expect(result.success).toBe(true)
      expect(result.filters.certifications).toContain("isWholeGrain")
      expect(result.filters.certifications).toContain("isGlutenFree")
    }, 15000)
  })

  describe("Conversational Context", () => {
    test("should refine search with conversational context", async () => {
      // First query: broad search
      const firstResult = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "show me cheese from Sardinia",
      })

      expect(firstResult.success).toBe(true)
      expect(firstResult.filters.regions).toContain("Sardinia")

      // Second query: refinement with context
      const secondResult = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "only organic ones",
        conversationContext: {
          lastQuery: "show me cheese from Sardinia",
          lastResponse: "Found 5 products from Sardinia",
        },
      })

      expect(secondResult.success).toBe(true)
      // Should inherit region from context
      expect(secondResult.filters.regions).toContain("Sardinia")
      // Should add new certification
      expect(secondResult.filters.certifications).toContain("isOrganic")
    }, 20000)
  })

  describe("Region Mapping", () => {
    test("should map 'parmigiano' to Emilia-Romagna", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "parmigiano reggiano",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Emilia-Romagna")
    }, 15000)

    test("should map 'mozzarella' to Campania", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "mozzarella di bufala",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Campania")
    }, 15000)

    test("should map 'gorgonzola' to Lombardy", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "gorgonzola cheese",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Lombardy")
    }, 15000)

    test("should map 'toscano' to Tuscany", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "pecorino toscano",
      })

      expect(result.success).toBe(true)
      expect(result.filters.regions).toContain("Tuscany")
    }, 15000)
  })

  describe("Error Handling", () => {
    test("should handle vague queries gracefully", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "something good",
      })

      expect(result.success).toBe(true)
      // Should fallback to keyword search
      expect(result.filters.keywords.length).toBeGreaterThan(0)
    }, 15000)

    test("should handle empty query", async () => {
      const result = await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "",
      })

      expect(result.success).toBe(true)
      expect(result.filters.keywords).toEqual([])
    }, 15000)
  })

  describe("Performance", () => {
    test("should complete analysis in under 5 seconds", async () => {
      const startTime = Date.now()

      await queryAnalyzer.analyzeQuery({
        workspaceId,
        query: "formaggio sardo biologico",
      })

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000)
    }, 15000)
  })
})
