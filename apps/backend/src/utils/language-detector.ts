/**
 * Language Detection Utility
 *
 * Detects customer language from phone prefix and provides localized texts
 */

export interface RegistrationText {
  link: string
  validity: string
}

// 🚨 ONLY supported prefixes: IT, ES, PT (Andrea's rule)
// For unrecognized prefixes → return "" → caller uses workspace.defaultLanguage
const PHONE_PREFIX_TO_LANGUAGE: Record<string, string> = {
  "+39": "it", // Italy
  "+34": "es", // Spain
  "+351": "pt", // Portugal
}

// 🚨 ONLY IT, ES, PT - other languages handled by LLM translation layer
const REGISTRATION_TEXTS: Record<string, RegistrationText> = {
  it: {
    link: "Completa la tua registrazione",
    validity: "Link valido per 24 ore",
  },
  es: {
    link: "Completa tu registro",
    validity: "Enlace válido por 24 horas",
  },
  pt: {
    link: "Complete seu cadastro",
    validity: "Link válido por 24 horas",
  },
}

/**
 * Detect language from phone number prefix
 * @param phone Phone number with country code (e.g., +390212345678)
 * @returns Language code (it, es, pt) or empty string if unrecognized
 * NOTE: If empty string returned, caller MUST use workspace.defaultLanguage as fallback
 */
export function detectLanguageFromPhonePrefix(phone: string): string {
  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = phone.replace(/[\s\-()]/g, "")

  // Extract prefix (first 1-4 digits after +)
  const prefixMatch = cleanPhone.match(/^(\+\d{1,4})/)
  if (!prefixMatch) {
    return "" // No prefix found → caller uses workspace.defaultLanguage
  }

  const prefix = prefixMatch[1]

  // Try exact match first (e.g., +39, +34, +351)
  if (PHONE_PREFIX_TO_LANGUAGE[prefix]) {
    return PHONE_PREFIX_TO_LANGUAGE[prefix]
  }

  // Try shorter prefixes (e.g., +351 before +35, then +3)
  // Start from longest to shortest
  for (let len = Math.min(prefix.length, 4); len >= 2; len--) {
    const shortPrefix = prefix.substring(0, len)
    if (PHONE_PREFIX_TO_LANGUAGE[shortPrefix]) {
      return PHONE_PREFIX_TO_LANGUAGE[shortPrefix]
    }
  }

  return "" // Unrecognized prefix → caller uses workspace.defaultLanguage
}

/**
 * Get registration link texts in detected language
 * @param language Language code (it, es, pt, en, etc.)
 * @returns Localized texts for registration link
 */
export function getRegistrationText(language: string): RegistrationText {
  return (
    REGISTRATION_TEXTS[language] || REGISTRATION_TEXTS["it"] // Default to Italian (base language)
  )
}

/**
 * Get language name from code
 * @param languageCode Language code (it, es, pt, en)
 * @returns Human-readable language name
 */
export function getLanguageName(languageCode: string): string {
  const languageNames: Record<string, string> = {
    it: "Italiano",
    es: "Español",
    pt: "Português",
  }
  return languageNames[languageCode] || "Italiano" // Default to Italian (base language)
}
