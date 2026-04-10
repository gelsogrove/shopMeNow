/**
 * changeLanguage - LLM-Callable Function
 *
 * Updates the customer's preferred language in the database.
 * Called when: customer says "I want to speak in English", "voglio parlare in inglese",
 * "quiero hablar en español", etc.
 *
 * Supported languages: it (Italian), en (English), es (Spanish), pt (Portuguese)
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

const SUPPORTED_LANGUAGES: Record<string, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  pt: "Português",
}

export interface ChangeLanguageRequest {
  workspaceId: string
  customerId: string
  language: string // ISO 639-1: "it", "en", "es", "pt"
}

export interface ChangeLanguageResult {
  success: boolean
  message: string
  previousLanguage?: string
  newLanguage?: string
  newLanguageLabel?: string
  error?: string
  timestamp: string
}

export async function changeLanguage(
  request: ChangeLanguageRequest
): Promise<ChangeLanguageResult> {
  try {
    logger.info("🌍 changeLanguage called:", {
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      language: request.language,
    })

    if (!request.workspaceId || !request.customerId || !request.language) {
      return {
        success: false,
        message: "Missing required parameters",
        error: "workspaceId, customerId, and language are required",
        timestamp: new Date().toISOString(),
      }
    }

    // Normalize language code to lowercase
    const langCode = request.language.toLowerCase().trim()

    // Validate supported language
    if (!SUPPORTED_LANGUAGES[langCode]) {
      const supportedList = Object.entries(SUPPORTED_LANGUAGES)
        .map(([code, label]) => `${label} (${code})`)
        .join(", ")

      return {
        success: false,
        message: `Language "${request.language}" is not supported. Supported languages: ${supportedList}`,
        error: "UNSUPPORTED_LANGUAGE",
        timestamp: new Date().toISOString(),
      }
    }

    // Get customer to check current language
    const customer = await prisma.customers.findFirst({
      where: {
        id: request.customerId,
        workspaceId: request.workspaceId,
      },
      select: { id: true, language: true },
    })

    if (!customer) {
      return {
        success: false,
        message: "Customer not found",
        error: "CUSTOMER_NOT_FOUND",
        timestamp: new Date().toISOString(),
      }
    }

    const previousLanguage = customer.language || "en"

    // Skip if already the same language
    if (previousLanguage === langCode) {
      return {
        success: true,
        message: `Language is already set to ${SUPPORTED_LANGUAGES[langCode]}.`,
        previousLanguage: langCode,
        newLanguage: langCode,
        newLanguageLabel: SUPPORTED_LANGUAGES[langCode],
        timestamp: new Date().toISOString(),
      }
    }

    // Update customer language
    await prisma.customers.update({
      where: { id: customer.id },
      data: { language: langCode },
    })

    logger.info("✅ Customer language updated:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      previousLanguage,
      newLanguage: langCode,
    })

    return {
      success: true,
      message: `Language changed to ${SUPPORTED_LANGUAGES[langCode]}. From now on I will respond in ${SUPPORTED_LANGUAGES[langCode]}.`,
      previousLanguage,
      newLanguage: langCode,
      newLanguageLabel: SUPPORTED_LANGUAGES[langCode],
      timestamp: new Date().toISOString(),
    }
  } catch (error: any) {
    logger.error("❌ changeLanguage failed:", error)
    return {
      success: false,
      message: "Failed to change language. Please try again.",
      error: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
    }
  }
}
