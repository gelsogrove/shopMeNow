/**
 * getLinkOrderByCode - LLM-Callable Function
 *
 * Genera un link sicuro per visualizzare i dettagli di un ordine specifico.
 * Utilizzata quando l'utente chiede: "dammi ordine", "mostrami ultimo ordine", "fattura ordine XXX"
 *
 * @see docs/prompt_agent.md - Line 247: Definizione della calling function
 */

import { CallingFunctionsService } from "../../services/calling-functions.service"
import logger from "../../utils/logger"

export interface GetLinkOrderByCodeRequest {
  customerId: string
  workspaceId: string
  orderCode?: string
  documentType?: string // 'order' | 'invoice' (future use)
  language?: string // 'it' | 'en' | 'es' | 'pt'
}

/**
 * Generates a secure link to view order details
 *
 * @param request - Request parameters
 * @returns Token response with secure link
 */
export async function getLinkOrderByCode(
  request: GetLinkOrderByCodeRequest
): Promise<any> {
  try {
    logger.info("📄 getLinkOrderByCode called with:", request)
    const callingFunctionsService = new CallingFunctionsService()

    // Use getOrdersListLink which handles both specific orders and order lists
    const result = await callingFunctionsService.getOrdersListLink({
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      orderCode: request.orderCode, // If provided, shows specific order; otherwise shows all orders
    })

    logger.info("✅ getLinkOrderByCode result:", result)
    return result
  } catch (error) {
    logger.error("❌ Error in getLinkOrderByCode:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message: "Impossibile generare il link all'ordine. Riprova più tardi.",
      timestamp: new Date().toISOString(),
    }
  }
}
