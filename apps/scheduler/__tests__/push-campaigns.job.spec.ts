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

// Mock database config enums used by helpers
jest.mock('../src/config/database', () => ({
  __esModule: true,
  prisma: {},
  Prisma: {},
  CampaignFrequency: {
    ONCE: 'ONCE',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    SEMIANNUAL: 'SEMIANNUAL',
  },
  CampaignTargetType: {
    ALL: 'ALL',
    TAGS: 'TAGS',
    MANUAL: 'MANUAL',
  },
  PushCampaignStatus: {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    DRAFT: 'DRAFT',
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
  const { buildMessageContent, normalizeLanguage, computeCompletionUpdate } = __test

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

    it('defaults to en on unknown or null (system default = English)', () => {
      expect(normalizeLanguage('xx')).toBe('en')
      expect(normalizeLanguage(null)).toBe('en')
      expect(normalizeLanguage(undefined)).toBe('en')
    })
  })

  describe('buildMessageContent', () => {
    const baseCampaign = {
      message: 'Hi {{firstName}} {{lastName}} from {{company}}! {{unknown}}',
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
        campaign: { message: 'Hello {{workspace}}' },
        customer: minimalCustomer,
        workspaceName: 'MyWS',
      })

      expect(translateMessageMock).toHaveBeenCalledWith(
        'Hello MyWS',
        'es'
      )
    })
  })

  describe('computeCompletionUpdate', () => {
    it('deactivates one-time campaigns after completion', () => {
      const result = computeCompletionUpdate({ frequency: 'ONCE' }, new Date())
      expect(result.finalStatus).toBe('COMPLETED')
      expect(result.shouldDeactivate).toBe(true)
      expect(result.nextRunAt).toBeNull()
    })

    it('keeps recurring campaigns scheduled with next run', () => {
      const result = computeCompletionUpdate({ frequency: 'WEEKLY' }, new Date())
      expect(result.finalStatus).toBe('SCHEDULED')
      expect(result.shouldDeactivate).toBe(false)
      expect(result.nextRunAt).toBeInstanceOf(Date)
    })
  })
})
