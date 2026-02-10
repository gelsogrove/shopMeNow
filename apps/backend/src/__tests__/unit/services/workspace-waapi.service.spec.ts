import { PrismaClient } from '@prisma/client'
import { WorkspaceService } from '../../../application/services/workspace.service'
import { WaapiClientService } from '../../../services/waapi-client.service'

// Mock WaapiClientService
jest.mock('../../../services/waapi-client.service')

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaClient

describe('WorkspaceService - WaAPI Methods', () => {
  let workspaceService: WorkspaceService
  let mockWaapiClient: jest.Mocked<WaapiClientService>

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset environment variables
    process.env.APP_WEBHOOK_BASE_URL = 'https://echatbot.ai'

    // Create service instance
    workspaceService = new WorkspaceService(mockPrisma)

    // Get mocked WaapiClient instance
    mockWaapiClient = (workspaceService as any).waapiClient as jest.Mocked<WaapiClientService>
  })

  describe('initializeWaapiInstance', () => {
    const workspaceId = 'ws_123'
    const userId = 'user_123'
    const phoneNumber = '+393331234567'
    const displayName = 'My Shop Bot'

    // SCENARIO: User with active subscription creates WaAPI instance
    // RULE: Should verify subscription, create instance, set webhook, get QR, update workspace
    it('should successfully initialize WaAPI instance with valid subscription', async () => {
      // Mock user with valid subscription
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        planType: 'BASIC',
        creditBalance: 10.0,
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      })

      // Mock WaAPI client methods
      const instanceId = 'wa_inst_123456'
      const qrCodeData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      mockWaapiClient.createInstance = jest.fn().mockResolvedValue(instanceId)
      mockWaapiClient.setWebhook = jest.fn().mockResolvedValue(undefined)
      mockWaapiClient.getQrCode = jest.fn().mockResolvedValue(qrCodeData)

      // Mock workspace update in transaction
      const updatedWorkspace = {
        id: workspaceId,
        whatsappProvider: 'waapi',
        waapiInstanceId: instanceId,
        waapiInstanceStatus: 'pending',
        waapiPhoneNumber: phoneNumber,
        waapiPhoneName: displayName,
        waapiQrCodeData: qrCodeData,
        channelStatus: false,
      }

      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback({
          workspace: {
            update: jest.fn().mockResolvedValue(updatedWorkspace),
          },
        })
      })

      const result = await workspaceService.initializeWaapiInstance(
        workspaceId,
        userId,
        phoneNumber,
        displayName
      )

      // Verify user subscription check
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          planType: true,
          creditBalance: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      })

      // Verify WaAPI client calls
      expect(mockWaapiClient.createInstance).toHaveBeenCalledWith(phoneNumber, displayName)
      expect(mockWaapiClient.setWebhook).toHaveBeenCalledWith(
        instanceId,
        `https://echatbot.ai/api/waapi/webhook/${instanceId}`
      )
      expect(mockWaapiClient.getQrCode).toHaveBeenCalledWith(instanceId)

      // Verify result
      expect(result.waapiInstanceId).toBe(instanceId)
      expect(result.waapiInstanceStatus).toBe('pending')
      expect(result.waapiQrCodeData).toBe(qrCodeData)
    })

    // SCENARIO: User on expired trial tries to create instance
    // RULE: Should throw error before calling WaAPI
    it('should reject if trial expired', async () => {
      const expiredDate = new Date('2025-01-01')

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        planType: 'FREE_TRIAL',
        creditBalance: 10.0,
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: expiredDate,
      })

      await expect(
        workspaceService.initializeWaapiInstance(workspaceId, userId, phoneNumber, displayName)
      ).rejects.toThrow('Trial expired. Please upgrade to create a channel.')

      // Verify WaAPI client was NOT called
      expect(mockWaapiClient.createInstance).not.toHaveBeenCalled()
    })

    // SCENARIO: User with inactive subscription tries to create instance
    // RULE: Should throw error before calling WaAPI
    it('should reject if subscription inactive', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        planType: 'BASIC',
        creditBalance: 10.0,
        subscriptionStatus: 'CANCELED',
        trialEndsAt: null,
      })

      await expect(
        workspaceService.initializeWaapiInstance(workspaceId, userId, phoneNumber, displayName)
      ).rejects.toThrow('Active subscription required. Please upgrade your plan.')

      // Verify WaAPI client was NOT called
      expect(mockWaapiClient.createInstance).not.toHaveBeenCalled()
    })

    // SCENARIO: User with insufficient credits tries to create instance
    // RULE: Should throw error before calling WaAPI (minimum €5.00 required)
    it('should reject if credits below €5.00', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        planType: 'BASIC',
        creditBalance: 3.5, // Below minimum
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      })

      await expect(
        workspaceService.initializeWaapiInstance(workspaceId, userId, phoneNumber, displayName)
      ).rejects.toThrow('Insufficient credits. Minimum €5.00 required to create channel.')

      // Verify WaAPI client was NOT called
      expect(mockWaapiClient.createInstance).not.toHaveBeenCalled()
    })

    // SCENARIO: User not found in database
    // RULE: Should throw error
    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null)

      await expect(
        workspaceService.initializeWaapiInstance(workspaceId, userId, phoneNumber, displayName)
      ).rejects.toThrow('User not found')
    })
  })

  describe('disconnectWaapiInstance', () => {
    const workspaceId = 'ws_123'
    const userId = 'user_123'
    const instanceId = 'wa_inst_123456'

    // SCENARIO: Workspace owner disconnects WaAPI instance
    // RULE: Should delete instance from WaAPI and clear workspace fields
    it('should successfully disconnect instance if user is owner', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: instanceId,
        ownerId: userId,
      })

      mockWaapiClient.deleteInstance = jest.fn().mockResolvedValue(undefined)

      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback({
          workspace: {
            update: jest.fn().mockResolvedValue({
              id: workspaceId,
              waapiInstanceId: null,
              waapiInstanceStatus: null,
              channelStatus: false,
            }),
          },
        })
      })

      await workspaceService.disconnectWaapiInstance(workspaceId, userId)

      // Verify instance deletion
      expect(mockWaapiClient.deleteInstance).toHaveBeenCalledWith(instanceId)
    })

    // SCENARIO: Non-owner user tries to disconnect instance
    // RULE: Should reject with "Access denied" error
    it('should reject if user is not workspace owner', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: instanceId,
        ownerId: 'different_user_id', // Different owner
      })

      await expect(
        workspaceService.disconnectWaapiInstance(workspaceId, userId)
      ).rejects.toThrow('Access denied')

      // Verify WaAPI client was NOT called
      expect(mockWaapiClient.deleteInstance).not.toHaveBeenCalled()
    })

    // SCENARIO: Workspace not found in database
    // RULE: Should throw error
    it('should throw error if workspace not found', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue(null)

      await expect(
        workspaceService.disconnectWaapiInstance(workspaceId, userId)
      ).rejects.toThrow('Workspace not found')
    })

    // SCENARIO: Workspace has no WaAPI instance configured
    // RULE: Should throw error
    it('should throw error if no instance to disconnect', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: null, // No instance
        ownerId: userId,
      })

      await expect(
        workspaceService.disconnectWaapiInstance(workspaceId, userId)
      ).rejects.toThrow('No WaAPI instance to disconnect')
    })
  })

  describe('regenerateWaapiQr', () => {
    const workspaceId = 'ws_123'
    const userId = 'user_123'
    const instanceId = 'wa_inst_123456'

    // SCENARIO: QR code expired, user requests new one
    // RULE: Should fetch new QR from WaAPI and update workspace
    it('should regenerate QR code successfully', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: instanceId,
        waapiInstanceStatus: 'pending',
        ownerId: userId,
      })

      const newQrCodeData = 'data:image/png;base64,NEW_QR_DATA'
      mockWaapiClient.getQrCode = jest.fn().mockResolvedValue(newQrCodeData)

      mockPrisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiQrCodeData: newQrCodeData,
        waapiQrGeneratedAt: expect.any(Date),
      })

      await workspaceService.regenerateWaapiQr(workspaceId, userId)

      // Verify QR code fetch
      expect(mockWaapiClient.getQrCode).toHaveBeenCalledWith(instanceId)

      // Verify workspace update
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: {
          waapiQrCodeData: newQrCodeData,
          waapiQrGeneratedAt: expect.any(Date),
        },
      })
    })

    // SCENARIO: Instance already authenticated (status='ready')
    // RULE: Should reject with error (cannot regenerate QR for ready instance)
    it('should reject if instance already ready', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: instanceId,
        waapiInstanceStatus: 'ready', // Already connected
        ownerId: userId,
      })

      await expect(workspaceService.regenerateWaapiQr(workspaceId, userId)).rejects.toThrow(
        'Instance already connected'
      )

      // Verify WaAPI client was NOT called
      expect(mockWaapiClient.getQrCode).not.toHaveBeenCalled()
    })

    // SCENARIO: Workspace not found
    // RULE: Should throw error
    it('should throw error if workspace not found', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue(null)

      await expect(workspaceService.regenerateWaapiQr(workspaceId, userId)).rejects.toThrow(
        'Workspace not found'
      )
    })

    // SCENARIO: Non-owner user tries to regenerate QR
    // RULE: Should reject with "Access denied"
    it('should reject if user is not workspace owner', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: instanceId,
        waapiInstanceStatus: 'pending',
        ownerId: 'different_user_id',
      })

      await expect(workspaceService.regenerateWaapiQr(workspaceId, userId)).rejects.toThrow(
        'Access denied'
      )

      expect(mockWaapiClient.getQrCode).not.toHaveBeenCalled()
    })

    // SCENARIO: Workspace has no WaAPI instance
    // RULE: Should throw error
    it('should throw error if no instance configured', async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: null,
        ownerId: userId,
      })

      await expect(workspaceService.regenerateWaapiQr(workspaceId, userId)).rejects.toThrow(
        'No WaAPI instance found'
      )
    })
  })
})
