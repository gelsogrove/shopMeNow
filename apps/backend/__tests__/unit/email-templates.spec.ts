/**
 * Unit Tests for Email Templates
 * 
 * Tests multilingual email template system:
 * - Translation retrieval for all languages (IT/EN/ES/PT)
 * - Fallback to English when language not supported
 * - Language detection from Accept-Language header
 * - Content validation for all email types
 */

import {
  getEmailTranslation,
  detectLanguageFromHeader,
  SupportedLanguage,
} from '../../src/utils/email-templates'

describe('Email Templates - Multilingual Support', () => {
  describe('getEmailTranslation()', () => {
    it('should return Italian translations when language is "it"', () => {
      const translations = getEmailTranslation('it')

      expect(translations.welcome.subject).toBe('Benvenuto su eChatbot! 🎉')
      expect(translations.welcome.greeting).toBe('Ciao')
      expect(translations.resetPassword.subject).toBe(
        'Reimposta la tua Password - eChatbot'
      )
      expect(translations.resetPassword.greeting).toBe('Ciao')
    })

    it('should return English translations when language is "en"', () => {
      const translations = getEmailTranslation('en')

      expect(translations.welcome.subject).toBe('Welcome to eChatbot! 🎉')
      expect(translations.welcome.greeting).toBe('Hi')
      expect(translations.resetPassword.subject).toBe(
        'Reset Your Password - eChatbot'
      )
      expect(translations.resetPassword.greeting).toBe('Hello')
    })

    it('should return Spanish translations when language is "es"', () => {
      const translations = getEmailTranslation('es')

      expect(translations.welcome.subject).toBe('¡Bienvenido a eChatbot! 🎉')
      expect(translations.welcome.greeting).toBe('Hola')
      expect(translations.resetPassword.subject).toBe(
        'Restablece tu Contraseña - eChatbot'
      )
      expect(translations.resetPassword.greeting).toBe('Hola')
    })

    it('should return Portuguese translations when language is "pt"', () => {
      const translations = getEmailTranslation('pt')

      expect(translations.welcome.subject).toBe('Bem-vindo ao eChatbot! 🎉')
      expect(translations.welcome.greeting).toBe('Olá')
      expect(translations.resetPassword.subject).toBe(
        'Redefina sua Senha - eChatbot'
      )
      expect(translations.resetPassword.greeting).toBe('Olá')
    })

    it('should fallback to English when language is undefined', () => {
      const translations = getEmailTranslation(undefined)

      expect(translations.welcome.subject).toBe('Welcome to eChatbot! 🎉')
      expect(translations.welcome.greeting).toBe('Hi')
    })

    it('should fallback to English when language is not supported', () => {
      const translations = getEmailTranslation('fr' as SupportedLanguage)

      expect(translations.welcome.subject).toBe('Welcome to eChatbot! 🎉')
      expect(translations.resetPassword.subject).toBe(
        'Reset Your Password - eChatbot'
      )
    })
  })

  describe('Welcome Email Content Validation', () => {
    const languages: SupportedLanguage[] = ['it', 'en', 'es', 'pt']

    languages.forEach((lang) => {
      describe(`Language: ${lang}`, () => {
        let translations: ReturnType<typeof getEmailTranslation>

        beforeAll(() => {
          translations = getEmailTranslation(lang)
        })

        it('should have all required welcome email fields', () => {
          expect(translations.welcome.subject).toBeTruthy()
          expect(translations.welcome.greeting).toBeTruthy()
          expect(translations.welcome.intro).toBeTruthy()
          expect(translations.welcome.accountCreated).toBeTruthy()
          expect(translations.welcome.features).toBeInstanceOf(Array)
          expect(translations.welcome.features.length).toBeGreaterThan(0)
          expect(translations.welcome.getStarted).toBeTruthy()
          expect(translations.welcome.footer).toBeTruthy()
          expect(translations.welcome.rights).toBeTruthy()
          expect(translations.welcome.disclaimer).toBeTruthy()
        })

        it('should have at least 3 features listed', () => {
          expect(translations.welcome.features.length).toBeGreaterThanOrEqual(3)
        })

        it('should have non-empty feature descriptions', () => {
          translations.welcome.features.forEach((feature) => {
            expect(feature).toBeTruthy()
            expect(feature.length).toBeGreaterThan(0)
          })
        })
      })
    })
  })

  describe('Reset Password Email Content Validation', () => {
    const languages: SupportedLanguage[] = ['it', 'en', 'es', 'pt']

    languages.forEach((lang) => {
      describe(`Language: ${lang}`, () => {
        let translations: ReturnType<typeof getEmailTranslation>

        beforeAll(() => {
          translations = getEmailTranslation(lang)
        })

        it('should have all required reset password email fields', () => {
          expect(translations.resetPassword.subject).toBeTruthy()
          expect(translations.resetPassword.greeting).toBeTruthy()
          expect(translations.resetPassword.intro).toBeTruthy()
          expect(translations.resetPassword.resetButton).toBeTruthy()
          expect(translations.resetPassword.copyLink).toBeTruthy()
          expect(translations.resetPassword.warningTitle).toBeTruthy()
          expect(translations.resetPassword.warnings).toBeInstanceOf(Array)
          expect(translations.resetPassword.warnings.length).toBeGreaterThan(0)
          expect(translations.resetPassword.footer).toBeTruthy()
          expect(translations.resetPassword.rights).toBeTruthy()
        })

        it('should have at least 2 security warnings', () => {
          expect(
            translations.resetPassword.warnings.length
          ).toBeGreaterThanOrEqual(2)
        })

        it('should have non-empty warning messages', () => {
          translations.resetPassword.warnings.forEach((warning) => {
            expect(warning).toBeTruthy()
            expect(warning.length).toBeGreaterThan(0)
          })
        })
      })
    })
  })

  describe('detectLanguageFromHeader()', () => {
    it('should detect Italian from "it-IT"', () => {
      const lang = detectLanguageFromHeader('it-IT')
      expect(lang).toBe('it')
    })

    it('should detect Italian from "it"', () => {
      const lang = detectLanguageFromHeader('it')
      expect(lang).toBe('it')
    })

    it('should detect English from "en-US"', () => {
      const lang = detectLanguageFromHeader('en-US')
      expect(lang).toBe('en')
    })

    it('should detect English from "en-GB"', () => {
      const lang = detectLanguageFromHeader('en-GB')
      expect(lang).toBe('en')
    })

    it('should detect Spanish from "es-ES"', () => {
      const lang = detectLanguageFromHeader('es-ES')
      expect(lang).toBe('es')
    })

    it('should detect Spanish from "es-MX"', () => {
      const lang = detectLanguageFromHeader('es-MX')
      expect(lang).toBe('es')
    })

    it('should detect Portuguese from "pt-BR"', () => {
      const lang = detectLanguageFromHeader('pt-BR')
      expect(lang).toBe('pt')
    })

    it('should detect Portuguese from "pt-PT"', () => {
      const lang = detectLanguageFromHeader('pt-PT')
      expect(lang).toBe('pt')
    })

    it('should handle complex Accept-Language header with multiple languages', () => {
      const lang = detectLanguageFromHeader('it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7')
      expect(lang).toBe('it')
    })

    it('should pick first supported language from preference list', () => {
      const lang = detectLanguageFromHeader('fr-FR,es-ES;q=0.9,en;q=0.8')
      expect(lang).toBe('es') // French not supported, Spanish is first supported
    })

    it('should fallback to Italian when no Accept-Language header provided', () => {
      const lang = detectLanguageFromHeader(undefined)
      expect(lang).toBe('it')
    })

    it('should fallback to Italian when Accept-Language is empty', () => {
      const lang = detectLanguageFromHeader('')
      expect(lang).toBe('it')
    })

    it('should fallback to Italian when no supported language in header', () => {
      const lang = detectLanguageFromHeader('fr-FR,de-DE,ja-JP')
      expect(lang).toBe('it')
    })

    it('should handle malformed Accept-Language header gracefully', () => {
      const lang = detectLanguageFromHeader('invalid-header')
      expect(lang).toBe('it')
    })

    it('should be case-insensitive', () => {
      const lang1 = detectLanguageFromHeader('IT-it')
      const lang2 = detectLanguageFromHeader('IT')
      expect(lang1).toBe('it')
      expect(lang2).toBe('it')
    })
  })

  describe('Translation Consistency', () => {
    it('should have same structure for all languages', () => {
      const languages: SupportedLanguage[] = ['it', 'en', 'es', 'pt']
      const structures = languages.map((lang) => {
        const t = getEmailTranslation(lang)
        return {
          welcomeKeys: Object.keys(t.welcome).sort(),
          resetPasswordKeys: Object.keys(t.resetPassword).sort(),
        }
      })

      // All languages should have the same keys
      const firstStructure = structures[0]
      structures.forEach((structure) => {
        expect(structure.welcomeKeys).toEqual(firstStructure.welcomeKeys)
        expect(structure.resetPasswordKeys).toEqual(
          firstStructure.resetPasswordKeys
        )
      })
    })

    it('should have same number of features for all languages', () => {
      const languages: SupportedLanguage[] = ['it', 'en', 'es', 'pt']
      const featureCounts = languages.map(
        (lang) => getEmailTranslation(lang).welcome.features.length
      )

      const firstCount = featureCounts[0]
      featureCounts.forEach((count) => {
        expect(count).toBe(firstCount)
      })
    })

    it('should have same number of warnings for all languages', () => {
      const languages: SupportedLanguage[] = ['it', 'en', 'es', 'pt']
      const warningCounts = languages.map(
        (lang) => getEmailTranslation(lang).resetPassword.warnings.length
      )

      const firstCount = warningCounts[0]
      warningCounts.forEach((count) => {
        expect(count).toBe(firstCount)
      })
    })
  })
})
