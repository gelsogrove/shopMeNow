/**
 * AddProduct - LLM-Callable Function
 *
 * Aggiunge uno o più prodotti al carrello del cliente.
 * Utilizzata quando il cliente confirma: "Sì, voglio aggiungerlo/i al carrello"
 *
 * ⚠️ IMPORTANTE: Questa funzione deve essere chiamata SOLO DOPO la conferma del cliente
 *
 * @see docs/prompt_agent.md - Sezione "addProduct()"
 */

import logger from "../../utils/logger"

import { CallingFunctionsService } from "../../services/calling-functions.service"

export interface ProductToAdd {
  sku: string // Codice del prodotto
  quantity: number // Quantità (default: 1)
  notes?: string // Note opzionali
}

export interface AddProductRequest {
  customerId: string
  workspaceId: string
  products: ProductToAdd[] // Array di prodotti da aggiungere (anche singolo prodotto)
}

export interface AddProductResult {
  success: boolean
  message: string
  totalAdded: number // Numero totale prodotti aggiunti
  skipped: number // Numero prodotti saltati (esauriti, errori)
  cartUrl?: string // URL pubblico del carrello con token
  expiresAt?: string
  timestamp: string
  error?: string
  details?: Array<{
    // Dettagli per ogni prodotto
    sku: string
    productName?: string
    success: boolean
    message?: string
  }>
}

/**
 * Aggiunge uno o più prodotti al carrello
 *
 * @param request - Request parameters con customerId, workspaceId, products[]
 * @returns Result con riepilogo aggiunte e link carrello
 */
export async function addProduct(
  request: AddProductRequest
): Promise<AddProductResult> {
  try {
    logger.info("🛒 AddProduct called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      productsCount: request.products?.length || 0,
      products: request.products,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId || !request.products) {
      logger.error("❌ Missing required parameters in AddProduct")
      return {
        success: false,
        error: "Parametri richiesti mancanti",
        message:
          "Impossibile aggiungere i prodotti al carrello. Parametri incompleti.",
        totalAdded: 0,
        skipped: 0,
        timestamp: new Date().toISOString(),
      }
    }

    // Validazione array prodotti
    if (!Array.isArray(request.products) || request.products.length === 0) {
      logger.error("❌ Invalid products array in AddProduct")
      return {
        success: false,
        error: "Array prodotti non valido",
        message: "Devi fornire almeno un prodotto da aggiungere al carrello.",
        totalAdded: 0,
        skipped: 0,
        timestamp: new Date().toISOString(),
      }
    }

    const callingFunctionsService = new CallingFunctionsService()
    const details: AddProductResult["details"] = []
    let totalAdded = 0
    let skipped = 0
    let cartUrl: string | undefined
    let expiresAt: string | undefined

    // Itera su ogni prodotto e aggiungilo al carrello
    for (const product of request.products) {
      try {
        // Validazione quantità
        const quantity = product.quantity || 1
        if (quantity < 1 || !Number.isInteger(quantity)) {
          logger.warn(
            `⚠️ Invalid quantity for ${product.sku}: ${quantity}`
          )
          skipped++
          details.push({
            sku: product.sku,
            success: false,
            message: "Quantità non valida",
          })
          continue
        }

        // Chiama il servizio per aggiungere il prodotto
        const result = await callingFunctionsService.addProductToCart({
          customerId: request.customerId,
          workspaceId: request.workspaceId,
          sku: product.sku,
          quantity,
          notes: product.notes,
        })

        if (result.success) {
          totalAdded++
          // Salva cartUrl e expiresAt dalla prima aggiunta riuscita
          if (!cartUrl && result.cartUrl) {
            cartUrl = result.cartUrl
            expiresAt = result.expiresAt
          }
          details.push({
            sku: product.sku,
            productName: result.productName,
            success: true,
            message: result.message,
          })
        } else {
          skipped++
          details.push({
            sku: product.sku,
            success: false,
            message: result.message || result.error,
          })
        }
      } catch (error) {
        logger.error(`❌ Error adding product ${product.sku}:`, error)
        skipped++
        details.push({
          sku: product.sku,
          success: false,
          message:
            error instanceof Error ? error.message : "Errore sconosciuto",
        })
      }
    }

    // Genera messaggio di riepilogo
    let message = ""
    if (totalAdded > 0 && skipped === 0) {
      message = `✅ Ho aggiunto ${totalAdded} prodotto/i al carrello!`
    } else if (totalAdded > 0 && skipped > 0) {
      message = `✅ Ho aggiunto ${totalAdded} prodotto/i al carrello. ⚠️ ${skipped} prodotto/i non disponibile/i.`
    } else {
      message = `❌ Nessun prodotto aggiunto. Tutti i ${skipped} prodotti non sono disponibili.`
    }

    // ✅ Aggiungi link al carrello e scadenza al messaggio
    if (totalAdded > 0 && cartUrl) {
      message += `\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`
    }

    const finalResult: AddProductResult = {
      success: totalAdded > 0,
      message,
      totalAdded,
      skipped,
      cartUrl,
      expiresAt,
      timestamp: new Date().toISOString(),
      details,
    }

    logger.info("✅ AddProduct result:", finalResult)
    return finalResult
  } catch (error) {
    logger.error("❌ Error in AddProduct:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message:
        "Impossibile aggiungere i prodotti al carrello. Riprova più tardi.",
      totalAdded: 0,
      skipped: 0,
      timestamp: new Date().toISOString(),
    }
  }
}
