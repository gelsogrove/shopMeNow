/**
 * AddProduct - LLM-Callable Function
 *
 * Aggiunge un prodotto al carrello del cliente.
 * Utilizzata quando il cliente confirma: "Sì, voglio aggiungerlo al carrello"
 *
 * ⚠️ IMPORTANTE: Questa funzione deve essere chiamata SOLO DOPO la conferma del cliente
 *
 * @see docs/prompt_agent.md - Sezione "addProduct()"
 */

import logger from "../../utils/logger"

import { CallingFunctionsService } from "../../services/calling-functions.service"

export interface AddProductRequest {
  customerId: string
  workspaceId: string
  productCode: string // Codice del prodotto da aggiungere
  quantity: number // Quantità da aggiungere (default: 1)
  notes?: string // Note optional (es: "grande", "bio", etc.)
}

export interface AddProductResult {
  success: boolean
  message: string
  cartCode?: string // Codice carrello per accesso pubblico
  productName?: string
  quantity?: number
  cartUrl?: string // URL pubblico del carrello con token
  expiresAt?: string
  timestamp: string
  error?: string
}

/**
 * Aggiunge un prodotto al carrello
 *
 * @param request - Request parameters con customerId, workspaceId, productCode, quantity
 * @returns Result con confirmazione e link carrello
 */
export async function AddProduct(
  request: AddProductRequest
): Promise<AddProductResult> {
  try {
    logger.info("🛒 AddProduct called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      productCode: request.productCode,
      quantity: request.quantity || 1,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId || !request.productCode) {
      logger.error("❌ Missing required parameters in AddProduct")
      return {
        success: false,
        error: "Parametri richiesti mancanti",
        message:
          "Impossibile aggiungere il prodotto al carrello. Parametri incompleti.",
        timestamp: new Date().toISOString(),
      }
    }

    const quantity = request.quantity || 1

    // Validazione quantità positiva
    if (quantity < 1 || !Number.isInteger(quantity)) {
      logger.error("❌ Invalid quantity in AddProduct:", quantity)
      return {
        success: false,
        error: "Quantità non valida",
        message: "La quantità deve essere un numero intero positivo.",
        timestamp: new Date().toISOString(),
      }
    }

    const callingFunctionsService = new CallingFunctionsService()

    // Chiama il servizio per aggiungere il prodotto
    const result = await callingFunctionsService.addProductToCart({
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      productCode: request.productCode,
      quantity,
      notes: request.notes,
    })

    logger.info("✅ AddProduct result:", result)
    return result
  } catch (error) {
    logger.error("❌ Error in AddProduct:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message:
        "Impossibile aggiungere il prodotto al carrello. Riprova più tardi.",
      timestamp: new Date().toISOString(),
    }
  }
}
