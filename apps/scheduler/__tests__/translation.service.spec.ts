/**
 * Translation Service - Unit Tests
 * 
 * Tests for AI-powered translation service:
 * - Language detection & normalization
 * - Translation API integration
 * - Security filtering (profanity, spam, phishing)
 * - Error handling & fallbacks
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as jest.Mock

// Store original env
const originalEnv = process.env

describe('Translation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    // Setup environment
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: 'test-api-key-123',
      LLM_BASE_URL: 'https://test.openrouter.ai/api/v1',
      LLM_MODEL: 'openai/gpt-4o-mini',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Initialization', () => {
    it('should initialize with API key from env', () => {
      const { TranslationService } = require('../src/services/translation.service')
      new TranslationService()
      
      expect(mockLogger.info).toHaveBeenCalledWith('✅ [TRANSLATION] Service initialized')
    })

    it('should warn if API key is missing', () => {
      delete process.env.OPENROUTER_API_KEY
      
      const { TranslationService } = require('../src/services/translation.service')
      new TranslationService()
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('OPENROUTER_API_KEY not found')
      )
    })
  })

  describe('Language Handling', () => {
    it('should return original message when target is Italian (IT)', async () => {
      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao mondo!', 'IT')
      
      expect(result).toBe('Ciao mondo!')
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Target language is Italian')
      )
    })

    it('should handle lowercase language codes', async () => {
      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', 'it')
      
      expect(result).toBe('Ciao!')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should translate to English when target is EN', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Hello World!',
            },
          }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao Mondo!', 'EN')
      
      expect(result).toBe('Hello World!')
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should translate to Spanish when target is ES', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '¡Hola Mundo!',
            },
          }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao Mondo!', 'ES')
      
      expect(result).toBe('¡Hola Mundo!')
    })

    it('should translate to Portuguese when target is PT', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Olá Mundo!',
            },
          }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao Mondo!', 'PT')
      
      expect(result).toBe('Olá Mundo!')
    })

    it('should handle legacy ENG format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Hello!' },
          }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      await service.translateMessage('Ciao!', 'ENG')
      
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should default to English for unknown language codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Hello!' },
          }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      await service.translateMessage('Ciao!', 'XX')
      
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should default to Italian when language is null', async () => {
      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', null as unknown as string)
      
      expect(result).toBe('Ciao!')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('API Integration', () => {
    it('should call OpenRouter API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Translated text' } }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      await service.translateMessage('Test message', 'EN')
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key-123',
            'HTTP-Referer': 'https://shopme.com',
            'X-Title': 'ShopME Campaign Translation',
          }),
        })
      )
    })

    it('should use correct model from env', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Result' } }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      await service.translateMessage('Test', 'EN')
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.model).toBe('openai/gpt-4o-mini')
      expect(callBody.temperature).toBe(0.3) // Low temp for consistent translations
      expect(callBody.max_tokens).toBe(1000)
    })

    it('should include message in prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Result' } }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      await service.translateMessage('Promo speciale 50%!', 'EN')
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.messages[0].content).toContain('Promo speciale 50%!')
      expect(callBody.messages[0].content).toContain('English') // Target language name
    })
  })

  describe('Error Handling', () => {
    it('should return original message on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', 'EN')
      
      expect(result).toBe('Ciao!') // Fallback to original
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('API error: 500')
      )
    })

    it('should return original message on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', 'EN')
      
      expect(result).toBe('Ciao!') // Fallback to original
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[TRANSLATION] Error:',
        expect.any(Error)
      )
    })

    it('should return original message on empty API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', 'EN')
      
      expect(result).toBe('Ciao!') // Fallback to original
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty response from LLM')
      )
    })

    it('should return original message on null content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: null } }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', 'EN')
      
      expect(result).toBe('Ciao!') // Fallback to original
    })

    it('should return original message when no API key', async () => {
      delete process.env.OPENROUTER_API_KEY
      
      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao!', 'EN')
      
      expect(result).toBe('Ciao!') // Fallback to original
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No API key')
      )
    })
  })

  describe('Content Trimming', () => {
    it('should trim whitespace from translated content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: '  Hello World!  \n\n' },
          }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      const result = await service.translateMessage('Ciao Mondo!', 'EN')
      
      expect(result).toBe('Hello World!')
    })
  })

  describe('Logging', () => {
    it('should log successful translation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello!' } }],
        }),
      })

      const { TranslationService } = require('../src/services/translation.service')
      const service = new TranslationService()
      
      await service.translateMessage('Ciao!', 'EN')
      
      expect(mockLogger.info).toHaveBeenCalledWith('[TRANSLATION] Translating to English...')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully translated to English')
      )
    })
  })

  describe('Singleton Export', () => {
    it('should export a singleton instance', () => {
      const { translationService } = require('../src/services/translation.service')
      const { translationService: secondImport } = require('../src/services/translation.service')
      
      expect(translationService).toBeDefined()
      expect(translationService).toBe(secondImport)
    })
  })
})
