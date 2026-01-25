/**
 * Unit tests for push-campaign helpers (variable replacement + translation)
 */

// Mock logger to keep output clean
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock translation service
const translateMessageMock = jest.fn()
jest.mock('../src/services/translation.service', () => ({
  __esModule: true,
  translationService: {
    translateMessage: translateMessageMock,
  },
}))

describe('push-campaigns.job helpers', () => {
  const { __test } = require('../src/jobs/push-campaigns.job')
  const { buildMessageContent, normalizeLanguage } = __test

  beforeEach(() => {
    translateMessageMock.mockReset()
  })

  describe('normalizeLanguage', () => {
    it('normalizes known languages', () => {
      expect(normalizeLanguage('EN')).toBe('en')
      expect(normalizeLanguage('es-MX')).toBe('es')
      expect(normalizeLanguage('PT')).toBe('pt')
      expect(normalizeLanguage('it')).toBe('it')
    })

    it('defaults to it on unknown or null', () => {
      expect(normalizeLanguage('xx')).toBe('it')
      expect(normalizeLanguage(null)).toBe('it')
      expect(normalizeLanguage(undefined)).toBe('it')
    })
  })

  describe('buildMessageContent', () => {
    const baseCampaign = {
      bodyPreview: 'Hi {{firstName}} {{lastName}} from {{company}}! {{unknown}}',
    }
    const baseCustomer = {
      name: 'Mario Rossi',
      email: 'mario@example.com',
      company: 'Acme',
      phone: '+390000000',
      language: 'EN',
    }

    it('replaces known variables and keeps unknown placeholders', async () => {
      translateMessageMock.mockResolvedValueOnce('translated')

      const result = await buildMessageContent({
        campaign: baseCampaign,
        customer: baseCustomer,
        workspaceName: 'WorkspaceX',
      })

      expect(translateMessageMock).toHaveBeenCalledWith(
        'Hi Mario Rossi from Acme! {{unknown}}',
        'en'
      )
      expect(result).toBe('translated')
    })

    it('falls back to original message when translation throws', async () => {
      translateMessageMock.mockRejectedValueOnce(new Error('fail'))

      const result = await buildMessageContent({
        campaign: baseCampaign,
        customer: baseCustomer,
        workspaceName: 'WorkspaceX',
      })

      expect(result).toContain('Mario Rossi')
      expect(result).toContain('{{unknown}}')
    })

    it('uses workspace name and handles missing customer fields', async () => {
      translateMessageMock.mockResolvedValueOnce('ok')
      const minimalCustomer = {
        name: '',
        email: '',
        company: '',
        phone: '+1',
        language: 'ES',
      }

      await buildMessageContent({
        campaign: { bodyPreview: 'Hello {{workspace}}' },
        customer: minimalCustomer,
        workspaceName: 'MyWS',
      })

      expect(translateMessageMock).toHaveBeenCalledWith(
        'Hello MyWS',
        'es'
      )
    })
  })
})
