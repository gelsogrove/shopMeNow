/**
 * SearchProduct - LLM-Callable Function
 *
 * Registra la ricerca di un prodotto da parte del cliente.
 * Viene usata quando l'utente cerca un prodotto (anche se non presente nel DB).
 * Raccoglie dati per analytics: "Top Searched Products".
 *
 * Utilizzata quando l'utente chiede: "Hai il Panettone italiano?", "Mi piace il Panettone", "Cerco vino rosso", etc.
 *
 * ⚠️ IMPORTANTE: Questa funzione è in BACKGROUND - l'LLM continua a rispondere normalmente.
 * Non interrompe il flusso conversazionale.
 *
 * @see docs/prompt_agent.md - Sezione "searchProduct()"
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

export interface SearchProductRequest {
  customerId: string
  workspaceId: string
  productName: string // Es: "Panettone italiano", "Vino rosso", "Burrata"
}

export interface SearchProductResult {
  success: boolean
  message: string // Messaggio di conferma (internal use, non inviato al cliente)
  searchId?: string // ID della ricerca salvata
  timestamp: string
  error?: string
}

/**
 * Registra ricerca prodotto nel database per analytics
 *
 * @param request - Request parameters con customerId, workspaceId, productName
 * @returns Result con conferma del salvataggio
 */
export async function searchProduct(
  request: SearchProductRequest
): Promise<SearchProductResult> {
  try {
    logger.info("🔍 SearchProduct called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      productName: request.productName,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId || !request.productName) {
      logger.error("❌ Missing required parameters in SearchProduct")
      return {
        success: false,
        error: "Parametri richiesti mancanti",
        message: "Impossibile registrare ricerca. Parametri incompleti.",
        timestamp: new Date().toISOString(),
      }
    }

    // Validazione lunghezza productName (max 255 char)
    if (request.productName.length > 255) {
      logger.error("❌ Product name too long:", request.productName.length)
      return {
        success: false,
        error: "Nome prodotto troppo lungo",
        message: "Nome prodotto supera limite caratteri.",
        timestamp: new Date().toISOString(),
      }
    }

    // Validazione: productName deve essere una stringa non vuota
    if (request.productName.trim().length === 0) {
      logger.error("❌ Empty product name")
      return {
        success: false,
        error: "Nome prodotto vuoto",
        message: "Inserire un nome prodotto valido.",
        timestamp: new Date().toISOString(),
      }
    }

    // prisma imported

    try {
      // Salva ricerca nel database
      const productSearch = await prisma.productSearch.create({
        data: {
          query: request.productName.trim(),
          customerId: request.customerId,
          workspaceId: request.workspaceId,
        },
      })

      logger.info("✅ SearchProduct saved:", {
        searchId: productSearch.id,
        productName: request.productName,
      })

      await prisma.$disconnect()

      return {
        success: true,
        message: `Ricerca registrata: "${request.productName}"`,
        searchId: productSearch.id,
        timestamp: new Date().toISOString(),
      }
    } catch (dbError) {
      logger.error("❌ Database error in SearchProduct:", dbError)
      await prisma.$disconnect()

      return {
        success: false,
        error: dbError instanceof Error ? dbError.message : "Database error",
        message: "Errore nel salvataggio della ricerca.",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    logger.error("❌ Error in SearchProduct:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message: "Errore interno del sistema.",
      timestamp: new Date().toISOString(),
    }
  }
}
