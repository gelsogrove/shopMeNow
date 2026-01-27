/**
 * Campaign Credit Guard Job - Unit Tests
 *
 * Validates that campaigns are deactivated when credit/subscription is insufficient.
 */

// === MOCKS MUST BE DECLARED BEFORE ANY IMPORTS ===

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

const mockHasOwnerCredit = jest.fn()

jest.mock('../src/services/billing.service', () => ({
  BillingService: jest.fn().mockImplementation(() => ({
    hasOwnerCredit: mockHasOwnerCredit,
  })),
}))

const mockCampaignFindMany = jest.fn()
const mockCampaignUpdate = jest.fn()

jest.mock('../src/config/database', () => ({
  prisma: {
    campaign: {
      findMany: mockCampaignFindMany,
      update: mockCampaignUpdate,
    },
  },
}))

// === NOW IMPORT MODULES ===
import { campaignCreditGuardJob } from '../src/jobs/campaign-credit-guard.job'

describe('Campaign Credit Guard Job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasOwnerCredit.mockResolvedValue(true)
  })

  it('should log and return when no active campaigns', async () => {
    mockCampaignFindMany.mockResolvedValue([])

    await campaignCreditGuardJob()

    expect(mockCampaignFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, workspaceId: true },
    })
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[CAMPAIGN-CREDIT] No active campaigns to check'
    )
    expect(mockCampaignUpdate).not.toHaveBeenCalled()
  })

  it('should deactivate campaigns when credit/subscription is insufficient', async () => {
    mockHasOwnerCredit.mockResolvedValue(false)
    mockCampaignFindMany.mockResolvedValue([
      { id: 'camp-1', name: 'Campaign 1', workspaceId: 'ws-1' },
    ])

    await campaignCreditGuardJob()

    expect(mockCampaignUpdate).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: { isActive: false },
    })
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Deactivated campaign Campaign 1 (camp-1)')
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Checked 1 campaigns. Disabled 1')
    )
  })

  it('should keep campaigns active when credit/subscription is sufficient', async () => {
    mockHasOwnerCredit.mockResolvedValue(true)
    mockCampaignFindMany.mockResolvedValue([
      { id: 'camp-2', name: 'Campaign 2', workspaceId: 'ws-2' },
    ])

    await campaignCreditGuardJob()

    expect(mockCampaignUpdate).not.toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Checked 1 campaigns. Disabled 0')
    )
  })

  it('should log errors and continue when credit check fails', async () => {
    mockHasOwnerCredit.mockRejectedValue(new Error('Billing error'))
    mockCampaignFindMany.mockResolvedValue([
      { id: 'camp-3', name: 'Campaign 3', workspaceId: 'ws-3' },
    ])

    await campaignCreditGuardJob()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error checking campaign camp-3'),
      expect.any(Error)
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Checked 1 campaigns. Disabled 0')
    )
  })
})
