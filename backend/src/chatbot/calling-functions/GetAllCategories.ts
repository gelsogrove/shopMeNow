/**
 * GetAllCategories Calling Function
 *
 * 🚨 REGOLA CRITICA PROMPT: Questa funzione mostra TUTTE le categorie disponibili
 * - VIETATO RIASSUMERE: NON riassumere, NON abbreviare, NON limitare la lista
 * - FORMATO OBBLIGATORIO: • Nome Categoria
 * - COMPLETEZZA OBBLIGATORIA: L'utente DEVE vedere OGNI SINGOLA categoria disponibile
 */

import { prisma } from "../../lib/prisma"
import logger from "../../utils/logger"

export interface GetAllCategoriesParams {
  phoneNumber: string
  workspaceId: string
  customerId?: string
  message: string
  language?: string
}

export interface CategoryInfo {
  id: string
  name: string
  description: string
}

export interface GetAllCategoriesResult {
  response: string
  categories: CategoryInfo[]
  totalCategories: number
}

/**
 * Funzione per ottenere tutte le categorie disponibili
 */
export async function GetAllCategories(
  params: GetAllCategoriesParams
): Promise<GetAllCategoriesResult> {
  const { phoneNumber, workspaceId, customerId, language = "it" } = params

  try {
    console.log(`🔍 GetAllCategories: Starting for workspace ${workspaceId}`)

    // Get all active categories
    const categories = await prisma.categories.findMany({
      where: {
        workspaceId: workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    console.log(`🔍 GetAllCategories: Found ${categories.length} categories`)

    if (categories.length === 0) {
      // Translation Layer will translate to target language
      const response =
        "Mi dispiace, al momento non abbiamo categorie disponibili."

      return {
        response,
        categories: [],
        totalCategories: 0,
      }
    }

    // Format categories list - Translation Layer will translate everything
    const categoryList = categories
      .map((cat) => `• ${cat.name} - ${cat.description}`)
      .join("\n")

    // Always return in Italian - Translation Layer will translate
    const response = `Ecco le nostre categorie disponibili:\n\n${categoryList}\n\nPosso aiutarti a trovare prodotti specifici in una di queste categorie!`

    console.log(
      `✅ GetAllCategories: Successfully formatted ${categories.length} categories`
    )

    return {
      response,
      categories,
      totalCategories: categories.length,
    }
  } catch (error) {
    console.error("❌ GetAllCategories: Error:", error)
    logger.error("GetAllCategories error:", error)

    // Always return in Italian - Translation Layer will translate
    const errorResponse =
      "Mi dispiace, si è verificato un errore nel recuperare le categorie. Riprova più tardi."

    return {
      response: errorResponse,
      categories: [],
      totalCategories: 0,
    }
  }
}
