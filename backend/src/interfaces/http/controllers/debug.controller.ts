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

      // Analyze query to extract intent
      const queryAnalysis = this.analyzeQuery(query)

      logger.info("📊 Query Analysis Result", {
        analysis: queryAnalysis,
      })

      // Build filters based on analysis
      const filters = this.buildFilters(queryAnalysis)

      logger.info("🔧 Built Filters", {
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
        query: queryAnalysis,
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

  private analyzeQuery(query: string): any {
    const lowerQuery = query.toLowerCase()

    const analysis: any = {
      originalQuery: query,
      keywords: [],
      categories: [],
      attributes: [],
      certifications: [],
    }

    // CATEGORY MAPPING
    const categoryMappings: Record<string, string> = {
      latticini: "Cheeses",
      formaggi: "Cheeses",
      caseificio: "Cheeses",
      pasta: "Pasta",
      dessert: "Desserts",
      dolci: "Desserts",
      condimenti: "Condiments",
      olio: "Condiments",
      aceto: "Condiments",
      bevande: "Beverages",
      vino: "Beverages",
      salumi: "Cured Meats",
      carni: "Cured Meats",
      prosciutto: "Cured Meats",
      conserve: "Preserves",
      specialita: "Specialties",
      surgelati: "Frozen Products",
      congelati: "Frozen Products",
    }

    // ATTRIBUTE MAPPING
    const attributeMappings: Record<string, string> = {
      fresco: "fresh",
      fresca: "fresh",
      "appena fatto": "fresh",
      surgelato: "frozen",
      congelato: "frozen",
    }

    // CERTIFICATION MAPPING
    const certificationMappings: Record<string, string> = {
      halal: "halal",
      hallal: "halal",
      vegan: "vegan",
      vegano: "vegan",
      vegetale: "vegan",
      integrale: "whole-grain",
      integrali: "whole-grain",
      "senza glutine": "gluten-free",
      glutenfree: "gluten-free",
      bio: "bio",
      biologico: "bio",
      organic: "bio",
    }

    // Extract tokens
    const tokens = lowerQuery.split(/[\s,]+/).filter((t) => t.length > 2)

    // Map tokens to categories
    for (const token of tokens) {
      if (categoryMappings[token]) {
        if (!analysis.categories.includes(categoryMappings[token])) {
          analysis.categories.push(categoryMappings[token])
        }
      }
    }

    // Map tokens to attributes
    for (const token of tokens) {
      if (attributeMappings[token]) {
        if (!analysis.attributes.includes(attributeMappings[token])) {
          analysis.attributes.push(attributeMappings[token])
        }
      }
    }

    // Map tokens to certifications
    for (const token of tokens) {
      if (certificationMappings[token]) {
        if (!analysis.certifications.includes(certificationMappings[token])) {
          analysis.certifications.push(certificationMappings[token])
        }
      }
    }

    // If no categories/attributes/certifications, use as keywords
    if (
      analysis.categories.length === 0 &&
      analysis.attributes.length === 0 &&
      analysis.certifications.length === 0
    ) {
      analysis.keywords = tokens
    }

    return analysis
  }

  private buildFilters(analysis: any): any {
    return {
      keywords: analysis.keywords.length > 0 ? analysis.keywords : undefined,
      categoryNames:
        analysis.categories.length > 0 ? analysis.categories : undefined,
      attributes:
        analysis.attributes.length > 0 ? analysis.attributes : undefined,
      certifications:
        analysis.certifications.length > 0
          ? analysis.certifications
          : undefined,
    }
  }
}
