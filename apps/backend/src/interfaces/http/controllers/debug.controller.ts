import { Request, Response } from "express"
import { ProductRepository } from "../../../repositories/product.repository"
import logger from "../../../utils/logger"

export class DebugController {
  constructor(private productRepository: ProductRepository) {}

  async searchProducts(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId
      const { query } = req.body

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Query parameter required",
        })
      }

      logger.info("🔍 DEBUG SEARCH: Analyzing query", {
        query,
        workspaceId,
      })

      // Extract tokens from query - NO language-specific mappings
      // Let the repository/LLM handle semantic understanding
      const tokens = query
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((t: string) => t.length > 2)

      const filters = {
        keywords: tokens.length > 0 ? tokens : undefined,
      }

      logger.info("🔧 Built Filters (language-agnostic)", {
        filters,
      })

      // Execute search
      const startTime = Date.now()
      const results = await this.productRepository.searchProducts(
        workspaceId,
        filters
      )
      const executionTimeMs = Date.now() - startTime

      logger.info("✅ Search Completed", {
        resultsCount: results.length,
        executionTimeMs,
      })

      return res.json({
        success: true,
        query: { originalQuery: query, tokens },
        filters,
        results,
        totalFound: results.length,
        executionTimeMs,
      })
    } catch (error) {
      logger.error("❌ Debug search error:", error)
      return res.status(500).json({
        success: false,
        error: "Search failed",
        message: (error as any).message,
      })
    }
  }
}
