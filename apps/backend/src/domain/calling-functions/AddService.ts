/**
 * AddService - LLM-Callable Function
 *
 * Aggiunge uno o più servizi al carrello del cliente.
 * Utilizzata quando il cliente chiede servizi (es: "aggiungi servizio consegna", "voglio il gift wrapping")
 *
 * ⚠️ IMPORTANTE: Questa funzione deve essere chiamata SOLO DOPO la conferma del cliente
 *
 * @see docs/prompt_agent.md - Sezione "addService()"
 */

import logger from "../../utils/logger"

import { CallingFunctionsService } from "../../services/calling-functions.service"

export interface ServiceToAdd {
  serviceCode: string // Codice del servizio (es: "SRV-001", "SRV-DELIVERY")
  quantity: number // Quantità (default: 1)
  notes?: string // Note opzionali
}

export interface AddServiceRequest {
  customerId: string
  workspaceId: string
  services: ServiceToAdd[] // Array di servizi da aggiungere (anche singolo servizio)
}

export interface AddServiceResult {
  success: boolean
  message: string
  totalAdded: number // Numero totale servizi aggiunti
  skipped: number // Numero servizi saltati (non disponibili, errori)
  cartUrl?: string // URL pubblico del carrello con token
  expiresAt?: string
  timestamp: string
  error?: string
  details?: Array<{
    // Dettagli per ogni servizio
    serviceCode: string
    serviceName?: string
    success: boolean
    message?: string
  }>
}

/**
 * Aggiunge uno o più servizi al carrello
 *
 * @param request - Request parameters con customerId, workspaceId, services[]
 * @returns Result con riepilogo aggiunte e link carrello
 */
export async function addService(
  request: AddServiceRequest
): Promise<AddServiceResult> {
  try {
    logger.info("🛠️ AddService called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      servicesCount: request.services?.length || 0,
      services: request.services,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId || !request.services) {
      logger.error("❌ Missing required parameters in AddService")
      return {
        success: false,
        error: "Parametri richiesti mancanti",
        message:
          "Impossibile aggiungere i servizi al carrello. Parametri incompleti.",
        totalAdded: 0,
        skipped: 0,
        timestamp: new Date().toISOString(),
      }
    }

    // Validazione array servizi
    if (!Array.isArray(request.services) || request.services.length === 0) {
      logger.error("❌ Invalid services array in AddService")
      return {
        success: false,
        error: "Array servizi non valido",
        message: "Devi fornire almeno un servizio da aggiungere al carrello.",
        totalAdded: 0,
        skipped: 0,
        timestamp: new Date().toISOString(),
      }
    }

    const callingFunctionsService = new CallingFunctionsService()
    const details: AddServiceResult["details"] = []
    let totalAdded = 0
    let skipped = 0
    let cartUrl: string | undefined
    let expiresAt: string | undefined

    // Itera su ogni servizio e aggiungilo al carrello
    for (const service of request.services) {
      try {
        // Validazione quantità
        const quantity = service.quantity || 1
        if (quantity < 1 || !Number.isInteger(quantity)) {
          logger.warn(
            `⚠️ Invalid quantity for ${service.serviceCode}: ${quantity}`
          )
          skipped++
          details.push({
            serviceCode: service.serviceCode,
            success: false,
            message: "Quantità non valida",
          })
          continue
        }

        // Chiama il servizio per aggiungere il servizio
        const result = await callingFunctionsService.addServiceToCart({
          customerId: request.customerId,
          workspaceId: request.workspaceId,
          serviceCode: service.serviceCode,
          quantity,
          notes: service.notes,
        })

        if (result.success) {
          totalAdded++
          // Salva cartUrl e expiresAt dalla prima aggiunta riuscita
          if (!cartUrl && result.cartUrl) {
            cartUrl = result.cartUrl
            expiresAt = result.expiresAt
          }
          details.push({
            serviceCode: service.serviceCode,
            serviceName: result.serviceName,
            success: true,
            message: result.message,
          })
        } else {
          skipped++
          details.push({
            serviceCode: service.serviceCode,
            success: false,
            message: result.message || result.error,
          })
        }
      } catch (error) {
        logger.error(`❌ Error adding service ${service.serviceCode}:`, error)
        skipped++
        details.push({
          serviceCode: service.serviceCode,
          success: false,
          message:
            error instanceof Error ? error.message : "Errore sconosciuto",
        })
      }
    }

    // Genera messaggio di riepilogo
    let message = ""
    if (totalAdded > 0 && skipped === 0) {
      message = `✅ Ho aggiunto ${totalAdded} servizio/i al carrello!`
    } else if (totalAdded > 0 && skipped > 0) {
      message = `✅ Ho aggiunto ${totalAdded} servizio/i al carrello. ⚠️ ${skipped} servizio/i non disponibile/i.`
    } else {
      message = `❌ Nessun servizio aggiunto. Tutti i ${skipped} servizi non sono disponibili.`
    }

    // ✅ Aggiungi link al carrello e scadenza al messaggio
    if (totalAdded > 0 && cartUrl) {
      message += `\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`
    }

    const finalResult: AddServiceResult = {
      success: totalAdded > 0,
      message,
      totalAdded,
      skipped,
      cartUrl,
      expiresAt,
      timestamp: new Date().toISOString(),
      details,
    }

    logger.info("✅ AddService result:", finalResult)
    return finalResult
  } catch (error) {
    logger.error("❌ Error in AddService:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message:
        "Impossibile aggiungere i servizi al carrello. Riprova più tardi.",
      totalAdded: 0,
      skipped: 0,
      timestamp: new Date().toISOString(),
    }
  }
}
