/**
 * GetAllServices Calling Function
 *
 * 🚨 REGOLA CRITICA PROMPT: Questa funzione mostra TUTTI i servizi disponibili
 * - VIETATO RIASSUMERE: NON riassumere, NON abbreviare, NON limitare la lista
 * - FORMATO OBBLIGATORIO: • Nome Servizio - €prezzo
 * - COMPLETEZZA OBBLIGATORIA: L'utente DEVE vedere OGNI SINGOLO servizio disponibile
 */

import { prisma } from "../../lib/prisma"
import logger from "../../utils/logger"

export interface GetAllServicesParams {
  phoneNumber: string
  workspaceId: string
  customerId?: string
  message: string
  language?: string
}

export interface ServiceInfo {
  id: string
  name: string
  description: string
  price: number
  isActive: boolean
}

export interface GetAllServicesResult {
  response: string
  services: ServiceInfo[]
  totalServices: number
}

/**
 * Funzione per ottenere tutti i servizi disponibili
 */
export async function GetAllServices(
  params: GetAllServicesParams
): Promise<GetAllServicesResult> {
  const { phoneNumber, workspaceId, customerId, language = "it" } = params

  try {
    console.log(`🔍 GetAllServices: Starting for workspace ${workspaceId}`)

    // Get all active services
    const services = await prisma.services.findMany({
      where: {
        workspaceId: workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    console.log(`🔍 GetAllServices: Found ${services.length} services`)

    if (services.length === 0) {
      // Translation Layer will translate to target language
      const response =
        "Mi dispiace, al momento non abbiamo servizi disponibili."

      return {
        response,
        services: [],
        totalServices: 0,
      }
    }

    // Format services list
    const serviceList = services
      .map((service) => `• ${service.name} - €${service.price.toFixed(2)}`)
      .join("\n")

    // Always return in Italian - Translation Layer will translate
    const response = `Ecco i nostri servizi disponibili:\n\n${serviceList}\n\nPosso aiutarti a prenotare uno di questi servizi!`

    console.log(
      `✅ GetAllServices: Successfully formatted ${services.length} services`
    )

    return {
      response,
      services,
      totalServices: services.length,
    }
  } catch (error) {
    console.error("❌ GetAllServices: Error:", error)
    logger.error("GetAllServices error:", error)

    // Always return in Italian - Translation Layer will translate
    const errorResponse =
      "Mi dispiace, si è verificato un errore nel recuperare i servizi. Riprova più tardi."

    return {
      response: errorResponse,
      services: [],
      totalServices: 0,
    }
  }
}
