import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
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

  async fixPlaygroundFlags(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.body

      if (!phoneNumber || typeof phoneNumber !== "string") {
        return res.status(400).json({
          success: false,
          error: "phoneNumber is required",
        })
      }

      const customer = await prisma.customers.findFirst({
        where: {
          OR: [
            { phone: phoneNumber },
            { phone: { contains: phoneNumber.replace(/\D/g, "") } },
          ],
        },
      })

      if (!customer) {
        return res.json({
          success: false,
          message: `Customer with phone ${phoneNumber} not found`,
        })
      }

      const result = await prisma.chatSession.updateMany({
        where: { customerId: customer.id },
        data: { isPlayground: false },
      })

      logger.info("✅ Fixed playground flags", {
        customerId: customer.id,
        phoneNumber: customer.phone,
        sessionsUpdated: result.count,
      })

      return res.json({
        success: true,
        customer: { id: customer.id, name: customer.name, phone: customer.phone },
        sessionsUpdated: result.count,
      })
    } catch (error) {
      logger.error("❌ Fix playground flags error:", error)
      return res.status(500).json({
        success: false,
        error: "Fix failed",
        message: (error as any).message,
      })
    }
  }
}
