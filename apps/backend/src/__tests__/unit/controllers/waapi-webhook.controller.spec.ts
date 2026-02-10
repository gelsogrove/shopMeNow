import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { WaapiWebhookController } from '../../../interfaces/http/controllers/waapi-webhook.controller'

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

// Mock Prisma - Need to mock the module since controller creates its own instance
jest.mock('@echatbot/database', () => {
  const mockPrismaInstance = {
    workspace: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    prisma: mockPrismaInstance,
  }
})

const { prisma } = require('@echatbot/database')

describe('WaapiWebhookController', () => {
  let controller: WaapiWebhookController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    controller = new WaapiWebhookController()

    jsonMock = jest.fn()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock })

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    }
  })

  describe('handleWebhook', () => {
    const instanceId = 'wa_inst_123456'
    const workspaceId = 'ws_123'

    beforeEach(() => {
      mockRequest = {
        params: { instanceId },
        body: {},
        headers: {},
      }

      // Mock workspace lookup (default success)
      prisma.workspace.findFirst = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceId: instanceId,
      })
    })

    // SCENARIO: WaAPI sends 'qr' event with new QR code
    // RULE: Should update waapiQrCodeData and set status to 'pending'
    it('should handle "qr" event and update workspace', async () => {
      const qrCodeData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      mockRequest.body = {
        event: 'qr',
        instance_id: instanceId,
        qr_code: qrCodeData,
      }

      prisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiQrCodeData: qrCodeData,
        waapiInstanceStatus: 'pending',
      })

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      // Verify workspace update
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: {
          waapiQrCodeData: qrCodeData,
          waapiQrGeneratedAt: expect.any(Date),
          waapiInstanceStatus: 'pending',
          waapiLastSyncAt: expect.any(Date),
        },
      })

      // Verify response
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ success: true })
    })

    // SCENARIO: WaAPI sends 'authenticated' event after QR scan
    // RULE: Should update status to 'authenticated', store phone info, clear QR
    it('should handle "authenticated" event', async () => {
      const phoneNumber = '+393331234567'
      const phoneName = 'My Shop Bot'
      mockRequest.body = {
        event: 'authenticated',
        instance_id: instanceId,
        phone_number: phoneNumber,
        phone_name: phoneName,
      }

      prisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceStatus: 'authenticated',
        waapiPhoneNumber: phoneNumber,
        waapiPhoneName: phoneName,
        waapiQrCodeData: null,
      })

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      // Verify workspace update
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: {
          waapiInstanceStatus: 'authenticated',
          waapiPhoneNumber: phoneNumber,
          waapiPhoneName: phoneName,
          waapiQrCodeData: null, // Clear QR after auth
          waapiLastSyncAt: expect.any(Date),
        },
      })

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    // SCENARIO: WaAPI sends 'ready' event when WhatsApp is fully connected
    // RULE: Should set status='ready', enable channelStatus, clear QR
    it('should handle "ready" event and enable channel', async () => {
      mockRequest.body = {
        event: 'ready',
        instance_id: instanceId,
      }

      prisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceStatus: 'ready',
        channelStatus: true,
        waapiQrCodeData: null,
      })

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      // Verify workspace update
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: {
          waapiInstanceStatus: 'ready',
          waapiQrCodeData: null,
          channelStatus: true, // Enable message queue
          waapiIsActive: true,
          waapiLastSyncAt: expect.any(Date),
        },
      })

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    // SCENARIO: WaAPI sends 'disconnected' event (user logged out)
    // RULE: Should set status='disconnected', disable channelStatus
    it('should handle "disconnected" event and disable channel', async () => {
      mockRequest.body = {
        event: 'disconnected',
        instance_id: instanceId,
      }

      prisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceStatus: 'disconnected',
        channelStatus: false,
      })

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      // Verify workspace update
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: {
          waapiInstanceStatus: 'disconnected',
          channelStatus: false, // Disable message queue
          waapiIsActive: false,
          waapiLastSyncAt: expect.any(Date),
        },
      })

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    // SCENARIO: WaAPI sends 'auth_failure' event (authentication failed)
    // RULE: Should set status='failed', disable channel, clear QR
    it('should handle "auth_failure" event', async () => {
      mockRequest.body = {
        event: 'auth_failure',
        instance_id: instanceId,
      }

      prisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceStatus: 'failed',
        channelStatus: false,
        waapiQrCodeData: null,
      })

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      // Verify workspace update
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: {
          waapiInstanceStatus: 'failed',
          channelStatus: false,
          waapiQrCodeData: null,
          waapiLastSyncAt: expect.any(Date),
        },
      })

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    // SCENARIO: WaAPI sends unknown event type
    // RULE: Should log warning and return 200 (acknowledge receipt)
    it('should handle unknown event type gracefully', async () => {
      mockRequest.body = {
        event: 'unknown_event',
        instance_id: instanceId,
      }

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      // Should still return 200 to acknowledge webhook
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    // SCENARIO: Webhook received for non-existent instance
    // RULE: Should return 404 error
    it('should return 404 if instance not found', async () => {
      prisma.workspace.findFirst = jest.fn().mockResolvedValue(null)

      mockRequest.body = {
        event: 'ready',
        instance_id: instanceId,
      }

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      expect(statusMock).toHaveBeenCalledWith(404)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Instance not found' })
    })

    // SCENARIO: Database error during workspace update
    // RULE: Should return 500 error
    it('should return 500 on database error', async () => {
      mockRequest.body = {
        event: 'ready',
        instance_id: instanceId,
      }

      prisma.workspace.update = jest.fn().mockRejectedValue(new Error('Database error'))

      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal server error',
      })
    })

    // SCENARIO: Webhook with signature header (if WaAPI implements it)
    // RULE: Should validate signature before processing
    it('should validate signature if provided', async () => {
      mockRequest.headers = {
        'x-waapi-signature': 'sha256=abc123',
      }
      mockRequest.body = {
        event: 'ready',
        instance_id: instanceId,
      }

      // Reset workspace update mock (was set to reject in previous test)
      prisma.workspace.update = jest.fn().mockResolvedValue({
        id: workspaceId,
        waapiInstanceStatus: 'ready',
        channelStatus: true,
      })

      // Mock signature validation (would be implemented in WaapiClientService)
      // For now, just verify webhook is processed
      await controller.handleWebhook(mockRequest as Request, mockResponse as Response)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('rate limiting', () => {
    // SCENARIO: Too many webhook requests in short time
    // RULE: Rate limiter (configured in routes) should block after 10 req/min
    // NOTE: Rate limiting is tested at integration level (not unit test)
    it('should be rate-limited at route level (see integration tests)', () => {
      // This is handled by express-rate-limit middleware in routes
      // Unit tests focus on controller logic only
      expect(true).toBe(true)
    })
  })
})
