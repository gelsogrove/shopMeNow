/**
 * OrderOptimizationAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Analyze transport costs using OrderOptimizationService
 * 2. Generate natural language explanation via GPT-4.1
 * 3. Provide optimization suggestions
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4.1 for Premium feature)
 * - System prompt from template file (10-order-optimization.template.md)
 * - Data calculated by OrderOptimizationService (deterministic)
 * - Returns Italian response (Router handles translation to customer language)
 *
 * Flow:
 * 1. CallingFunctions triggers "OPTIMIZE_ORDER" action
 * 2. OrderOptimizationService calculates transport analysis
 * 3. This agent generates human-friendly explanation
 * 4. Response goes through Translation Agent
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - Premium/Enterprise plan gating done BEFORE calling this agent
 *
 * @feature optimize-transport (specs/optimize-transport/)
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { OrderOptimizationService, TransportAnalysis } from "../services/order-optimization.service"
import logger from "../../utils/logger"
import * as fs from "fs"
import * as path from "path"

// ============================================================================
// TYPES
// ============================================================================

export interface OptimizationAgentInput {
  workspaceId: string
  customerId: string
  customerLanguage?: string
}

export interface OptimizationAgentOutput {
  success: boolean
  explanation: string           // Human-readable response (Italian)
  recommendations: string[]     // List of suggestions
  nextAction: "continue_shopping" | "proceed_checkout" | "view_products"
  analysis?: TransportAnalysis  // Raw data for debugging
  tokensUsed?: number
  executionTimeMs?: number
  error?: string
}

// ============================================================================
// AGENT
// ============================================================================

export class OrderOptimizationAgentLLM {
  private prisma: PrismaClient
  private orderOptimizationService: OrderOptimizationService
  private openRouterApiKey: string
  private openRouterBaseUrl: string
  
  // GPT-4.1 for Premium feature (higher quality)
  private readonly MODEL = "openai/gpt-4.1"
  private readonly TIMEOUT_MS = 30000

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.orderOptimizationService = new OrderOptimizationService(prisma)
    
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required for OrderOptimizationAgentLLM")
    }
  }

  /**
   * Process optimization request
   * 
   * @param input - Workspace and customer context
   * @returns Optimization explanation and suggestions
   */
  async process(input: OptimizationAgentInput): Promise<OptimizationAgentOutput> {
    const startTime = Date.now()

    try {
      logger.info("🚚 OrderOptimizationAgentLLM: Processing", {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
      })

      // STEP 1: Check if transport prices are configured
      const isConfigured = await this.orderOptimizationService.hasTransportPricesConfigured(
        input.workspaceId
      )

      if (!isConfigured) {
        return {
          success: false,
          explanation: "Al momento non posso calcolare i costi di spedizione perché i prezzi dei trasporti non sono configurati. Puoi comunque continuare con il tuo ordine.",
          recommendations: [],
          nextAction: "proceed_checkout",
          executionTimeMs: Date.now() - startTime,
          error: "TRANSPORT_PRICES_NOT_CONFIGURED",
        }
      }

      // STEP 2: Analyze cart transport costs
      const analysis = await this.orderOptimizationService.analyzeCart(
        input.workspaceId,
        input.customerId
      )

      if (analysis.isEmpty) {
        return {
          success: true,
          explanation: "Il tuo carrello è vuoto. Aggiungi qualche prodotto per vedere l'analisi dei costi di spedizione!",
          recommendations: [],
          nextAction: "continue_shopping",
          analysis,
          executionTimeMs: Date.now() - startTime,
        }
      }

      // STEP 3: Get available products for suggestions
      const cartProductIds = analysis.allocationByItem.map(item => item.productId)
      const availableProducts = await this.orderOptimizationService.getAvailableProductsForOptimization(
        input.workspaceId,
        cartProductIds,
        5 // Limit 5 products per transport type
      )

      // STEP 4: Call LLM to generate explanation
      const llmInput = {
        analysis: {
          transports: analysis.transports.map(t => ({
            typeName: t.typeName,
            transportPrice: t.transportPrice,
            totalQuantity: t.totalQuantity,
            productCount: t.productCount,
          })),
          totalUnits: analysis.totalUnits,
          totalProductsCost: analysis.totalProductsCost,
          totalTransportCost: analysis.totalTransportCost,
          grandTotal: analysis.grandTotal,
          shippingCostPerUnit: analysis.shippingCostPerUnit,
          ivaAmount: analysis.ivaAmount,
        },
        availableProducts: availableProducts.slice(0, 3), // Limit to 3 transport types
        customerLanguage: input.customerLanguage || "it",
      }

      const llmResponse = await this.callLLM(llmInput)

      return {
        success: true,
        explanation: llmResponse.explanation,
        recommendations: llmResponse.recommendations || [],
        nextAction: llmResponse.nextAction || "continue_shopping",
        analysis,
        tokensUsed: llmResponse.tokensUsed,
        executionTimeMs: Date.now() - startTime,
      }

    } catch (error) {
      logger.error("❌ OrderOptimizationAgentLLM error:", error)
      
      return {
        success: false,
        explanation: "Mi dispiace, c'è stato un problema nell'analisi dei costi di spedizione. Riprova tra qualche secondo.",
        recommendations: [],
        nextAction: "proceed_checkout",
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Call LLM to generate explanation
   */
  private async callLLM(input: any): Promise<{
    explanation: string
    recommendations: string[]
    nextAction: "continue_shopping" | "proceed_checkout" | "view_products"
    tokensUsed?: number
  }> {
    try {
      // Load system prompt from template
      const systemPrompt = this.loadSystemPrompt()

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: this.MODEL,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: JSON.stringify(input, null, 2),
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://echatbot.ai",
            "X-Title": "eChatbot Order Optimization",
          },
          timeout: this.TIMEOUT_MS,
        }
      )

      const content = response.data.choices[0]?.message?.content
      const tokensUsed = response.data.usage?.total_tokens

      if (!content) {
        throw new Error("Empty response from LLM")
      }

      // Parse JSON response
      const parsed = JSON.parse(content)

      return {
        explanation: parsed.explanation || this.getFallbackExplanation(input),
        recommendations: parsed.recommendations || [],
        nextAction: parsed.nextAction || "continue_shopping",
        tokensUsed,
      }

    } catch (error) {
      logger.error("LLM call failed:", error)
      
      // Return fallback response using service's format method
      return {
        explanation: this.getFallbackExplanation(input),
        recommendations: [],
        nextAction: "continue_shopping",
      }
    }
  }

  /**
   * Load system prompt from template file
   */
  private loadSystemPrompt(): string {
    try {
      const templatePath = path.join(
        __dirname,
        "..",
        "services",
        "..",
        "..",
        "templates",
        "ecommerce",
        "10-order-optimization.template.md"
      )
      
      // Simplified path
      const simplePath = path.join(
        process.cwd(),
        "src",
        "templates",
        "ecommerce",
        "10-order-optimization.template.md"
      )

      // Try both paths
      for (const p of [simplePath, templatePath]) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, "utf-8")
          // Extract just the system prompt section
          const systemPromptMatch = content.match(/## System Prompt\s*([\s\S]*?)(?=##|$)/)
          if (systemPromptMatch) {
            return systemPromptMatch[1].trim()
          }
          return content
        }
      }

      logger.warn("Template file not found, using inline prompt")
      return this.getInlineSystemPrompt()

    } catch (error) {
      logger.warn("Error loading template, using inline prompt:", error)
      return this.getInlineSystemPrompt()
    }
  }

  /**
   * Inline system prompt fallback
   */
  private getInlineSystemPrompt(): string {
    return `Sei un assistente specializzato nell'ottimizzazione dei costi di spedizione per ordini e-commerce.

Analizza i dati JSON forniti e genera una risposta in italiano che spiega:
1. Quali trasporti sono richiesti e quanto costano
2. Come l'utente può ottimizzare i costi

VINCOLI:
- Usa SOLO i dati forniti, non inventare
- NON menzionare mai l'IVA
- Tono amichevole e non aggressivo

Rispondi in JSON con: explanation (string), recommendations (array), nextAction (string).`
  }

  /**
   * Fallback explanation when LLM fails
   */
  private getFallbackExplanation(input: any): string {
    const analysis = input.analysis
    const lines: string[] = []

    lines.push("🚚 **Riepilogo dei tuoi costi di spedizione**")
    lines.push("")

    if (analysis.transports && analysis.transports.length > 0) {
      lines.push("**Trasporti richiesti:**")
      for (const t of analysis.transports) {
        const emoji = t.typeName.toLowerCase().includes("frozen") ? "🧊" :
                      t.typeName.toLowerCase().includes("refriger") ? "❄️" : "📦"
        lines.push(`${emoji} ${t.typeName}: €${t.transportPrice.toFixed(2)} (${t.totalQuantity} prodotti)`)
      }
      lines.push("")
    }

    lines.push(`💰 **Totale spedizione**: €${analysis.totalTransportCost.toFixed(2)}`)
    lines.push(`📋 **Totale ordine**: €${analysis.grandTotal.toFixed(2)}`)
    lines.push("")
    lines.push("Cosa vuoi fare?")
    lines.push("1. 🧊 Mostra prodotti Frozen")
    lines.push("2. ❄️ Mostra prodotti Refrigerati")
    lines.push("3. 📦 Mostra prodotti Temperatura Ambiente")
    lines.push("4. 🛒 Torna al carrello")

    return lines.join("\n")
  }
}
