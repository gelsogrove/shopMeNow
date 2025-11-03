/**
 * Language Detection Utility
 * 
 * Detects customer language from phone prefix and provides localized texts
 */

export interface RegistrationText {
  link: string
  validity: string
}

const PHONE_PREFIX_TO_LANGUAGE: Record<string, string> = {
  "+39": "it", // Italy
  "+34": "es", // Spain
  "+351": "pt", // Portugal
  "+1": "en", // USA/Canada
  "+44": "en", // UK
  "+33": "fr", // France
  "+49": "de", // Germany
}

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
  en: {
    link: "Complete your registration",
    validity: "Link valid for 24 hours",
  },
  fr: {
    link: "Complétez votre inscription",
    validity: "Lien valable 24 heures",
  },
  de: {
    link: "Vervollständigen Sie Ihre Registrierung",
    validity: "Link 24 Stunden gültig",
  },
}

/**
 * Detect language from phone number prefix
 * @param phone Phone number with country code (e.g., +390212345678)
 * @returns Language code (it, es, pt, en, etc.) - defaults to "en"
 */
export function detectLanguageFromPhonePrefix(phone: string): string {
  // Extract prefix (first 1-4 digits after +)
  const prefixMatch = phone.match(/^(\+\d{1,4})/)
  if (!prefixMatch) {
    return "en" // Default to English
  }

  const prefix = prefixMatch[1]

  // Try exact match first
  if (PHONE_PREFIX_TO_LANGUAGE[prefix]) {
    return PHONE_PREFIX_TO_LANGUAGE[prefix]
  }

  // Try shorter prefixes (e.g., +351 before +35)
  for (let len = prefix.length; len >= 2; len--) {
    const shortPrefix = prefix.substring(0, len)
    if (PHONE_PREFIX_TO_LANGUAGE[shortPrefix]) {
      return PHONE_PREFIX_TO_LANGUAGE[shortPrefix]
    }
  }

  return "en" // Default fallback
}

/**
 * Get registration link texts in detected language
 * @param language Language code (it, es, pt, en, etc.)
 * @returns Localized texts for registration link
 */
export function getRegistrationText(language: string): RegistrationText {
  return (
    REGISTRATION_TEXTS[language] ||
    REGISTRATION_TEXTS["en"] // Default to English
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
    en: "English",
    fr: "Français",
    de: "Deutsch",
  }
  return languageNames[languageCode] || "English"
}
