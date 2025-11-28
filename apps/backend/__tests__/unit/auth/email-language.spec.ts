/**
 * Unit Tests: Email Language Support
 * 
 * Tests that emails are sent in the correct language based on:
 * - Accept-Language header
 * - User preference
 * - Default fallback (Italian)
 */

import { describe, it, expect } from '@jest/globals'
import { detectLanguageFromHeader } from '../../../src/utils/email-templates'

describe('Email Language Detection', () => {
  describe('detectLanguageFromHeader()', () => {
    it('should detect Italian from it-IT header', () => {
      const result = detectLanguageFromHeader('it-IT')
      expect(result).toBe('it')
    })

    it('should detect English from en-US header', () => {
      const result = detectLanguageFromHeader('en-US')
      expect(result).toBe('en')
    })

    it('should detect Spanish from es-ES header', () => {
      const result = detectLanguageFromHeader('es-ES')
      expect(result).toBe('es')
    })

    it('should detect Portuguese from pt-PT header', () => {
      const result = detectLanguageFromHeader('pt-PT')
      expect(result).toBe('pt')
    })

    it('should handle simple language codes (no region)', () => {
      expect(detectLanguageFromHeader('it')).toBe('it')
      expect(detectLanguageFromHeader('en')).toBe('en')
      expect(detectLanguageFromHeader('es')).toBe('es')
      expect(detectLanguageFromHeader('pt')).toBe('pt')
    })

    it('should handle multiple languages in Accept-Language (choose first)', () => {
      const result = detectLanguageFromHeader('es-ES,en;q=0.9,it;q=0.8')
      expect(result).toBe('es')
    })

    it('should fallback to Italian for unsupported language', () => {
      const result = detectLanguageFromHeader('fr-FR')
      expect(result).toBe('it')
    })

    it('should fallback to Italian for undefined header', () => {
      const result = detectLanguageFromHeader(undefined)
      expect(result).toBe('it')
    })

    it('should fallback to Italian for empty header', () => {
      const result = detectLanguageFromHeader('')
      expect(result).toBe('it')
    })

    it('should handle case-insensitive headers', () => {
      expect(detectLanguageFromHeader('EN-US')).toBe('en')
      expect(detectLanguageFromHeader('Es-ES')).toBe('es')
      expect(detectLanguageFromHeader('PT-pt')).toBe('pt')
    })

    it('should handle quality values correctly', () => {
      // Italian has highest priority (q=1.0 implicit)
      const result = detectLanguageFromHeader('en;q=0.8,it;q=0.9,es;q=0.7')
      expect(result).toBe('it')
    })

    it('should extract language from complex Accept-Language headers', () => {
      const complexHeader = 'en-US,en;q=0.9,it-IT;q=0.8,it;q=0.7,es-ES;q=0.6,es;q=0.5'
      const result = detectLanguageFromHeader(complexHeader)
      expect(result).toBe('en')
    })
  })
})
