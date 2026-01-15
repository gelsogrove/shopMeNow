/**
 * @file workspace-widget-config.spec.ts
 * @description Unit tests for widget configuration (widgetLogoUrl, widgetTitle, widgetLanguage, widgetPrimaryColor)
 */

import { Request, Response, NextFunction } from 'express'
import { WorkspaceController } from '../../../src/interfaces/http/controllers/workspace.controller'
import { WorkspaceService } from '../../../src/application/services/workspace.service'
import { prisma } from '@echatbot/database'

// Mock prisma globally
jest.mock('@echatbot/database', () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock storage service
jest.mock('../../../src/services/storage.service', () => ({
  storageService: {
    uploadImage: jest.fn(),
    deleteImage: jest.fn(),
  },
}))


describe('WorkspaceController - Widget Configuration', () => {
  let controller: WorkspaceController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  let updateSpy: jest.SpyInstance
  let getByIdSpy: jest.SpyInstance
  let workspaceServiceInstance: WorkspaceService

  const testWorkspaceId = 'test-workspace-id'
  const testUserId = 'test-user-id'
  const testWidgetLogoUrl = '/uploads/users/widget-logo_1234.png'

  beforeEach(() => {
    controller = new WorkspaceController()
    workspaceServiceInstance = (controller as any).workspaceService
    updateSpy = jest.spyOn(workspaceServiceInstance, 'update')
    getByIdSpy = jest.spyOn(workspaceServiceInstance, 'getById')
    
    mockReq = {
      params: { id: testWorkspaceId },
      body: {},
      user: { id: testUserId },
      headers: {},
    } as any

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any
    
    mockNext = jest.fn() as NextFunction
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('updateWorkspace - Widget Configuration Fields', () => {
    it('should update widgetLogoUrl, widgetTitle, widgetLanguage, widgetPrimaryColor', async () => {
      const widgetConfig = {
        widgetLogoUrl: testWidgetLogoUrl,
        widgetTitle: 'Customer Support Chat',
        widgetLanguage: 'en',
        widgetPrimaryColor: '#ff5722',
      }

      mockReq.body = widgetConfig

      // Mock workspace member check (SUPER_ADMIN)
      ;(prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
        role: 'SUPER_ADMIN',
        userId: testUserId,
        workspaceId: testWorkspaceId,
      })

      // Mock workspace exists
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: testWorkspaceId,
        name: 'Test Workspace',
      })

      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        ...widgetConfig,
        updatedAt: new Date(),
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(updateSpy).toHaveBeenCalledWith(
        testWorkspaceId,
        expect.objectContaining(widgetConfig)
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining(widgetConfig)
      )
    })

    it('should update channel + WhatsApp fields when provided', async () => {
      const payload = {
        enableWhatsapp: true,
        enableWidget: true,
        whatsappPhoneNumber: "+1234567890",
        whatsappApiKey: "api-key-123",
        whatsappPhoneNumberId: "123456789012345",
        whatsappVerifyToken: "verify-token-abc",
        widgetTitle: "Customer Support",
        widgetLanguage: "en",
        widgetPrimaryColor: "#10b981",
      }

      mockReq.body = payload

      ;(prisma.workspaceMember.findFirst as jest.Mock).mockResolvedValue({
        role: 'SUPER_ADMIN',
        userId: testUserId,
        workspaceId: testWorkspaceId,
      })

      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: testWorkspaceId,
        name: 'Test Workspace',
      })

      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        ...payload,
        updatedAt: new Date(),
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(updateSpy).toHaveBeenCalledWith(
        testWorkspaceId,
        expect.objectContaining(payload)
      )

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining(payload)
      )
    })

    it('should update only widgetTitle without affecting other fields', async () => {
      mockReq.body = { widgetTitle: 'New Chat Title' }

      mockPrisma.workspaceMember.findFirst.mockResolvedValue({
        role: 'SUPER_ADMIN',
        userId: testUserId,
        workspaceId: testWorkspaceId,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: testWorkspaceId,
        widgetLogoUrl: testWidgetLogoUrl,
        widgetLanguage: 'it',
        widgetPrimaryColor: '#22c55e',
      })

      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        widgetTitle: 'New Chat Title',
        widgetLogoUrl: testWidgetLogoUrl, // Unchanged
        widgetLanguage: 'it', // Unchanged
        widgetPrimaryColor: '#22c55e', // Unchanged
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          widgetTitle: 'New Chat Title',
          widgetLogoUrl: testWidgetLogoUrl,
        })
      )
    })

    it('should NOT confuse widgetLogoUrl with logoUrl (channel logo)', async () => {
      const channelLogo = '/uploads/channels/channel-logo.png'
      const widgetLogo = '/uploads/users/widget-logo.png'

      mockReq.body = {
        logoUrl: channelLogo, // Channel logo (admin UI)
        widgetLogoUrl: widgetLogo, // Widget logo (customer-facing)
      }

      mockPrisma.workspaceMember.findFirst.mockResolvedValue({
        role: 'SUPER_ADMIN',
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: testWorkspaceId,
      })

      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        logoUrl: channelLogo,
        widgetLogoUrl: widgetLogo,
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(updateSpy).toHaveBeenCalledWith(
        testWorkspaceId,
        expect.objectContaining({
          logoUrl: channelLogo,
          widgetLogoUrl: widgetLogo,
        })
      )

      const response = (mockRes.json as jest.Mock).mock.calls[0][0]
      expect(response.logoUrl).toBe(channelLogo)
      expect(response.widgetLogoUrl).toBe(widgetLogo)
      expect(response.logoUrl).not.toBe(response.widgetLogoUrl)
    })
  })

  describe('getWorkspaceById - Widget Configuration Fields', () => {
    it('should return widgetLogoUrl, widgetTitle, widgetLanguage, widgetPrimaryColor', async () => {
      const workspaceData = {
        id: testWorkspaceId,
        name: 'Test Workspace',
        logoUrl: '/uploads/channels/logo.png', // Channel logo
        widgetLogoUrl: testWidgetLogoUrl, // Widget logo
        widgetTitle: 'Customer Chat',
        widgetLanguage: 'it',
        widgetPrimaryColor: '#22c55e',
      }

      mockPrisma.workspaceMember.findFirst.mockResolvedValue({
        role: 'SUPER_ADMIN',
        userId: testUserId,
        workspaceId: testWorkspaceId,
      })

      getByIdSpy.mockResolvedValue(workspaceData as any)

      await controller.getWorkspaceById(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          widgetLogoUrl: testWidgetLogoUrl,
          widgetTitle: 'Customer Chat',
          widgetLanguage: 'it',
          widgetPrimaryColor: '#22c55e',
        })
      )
    })

    it('should return null widget fields if not configured', async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({
        role: 'SUPER_ADMIN',
      })

      getByIdSpy.mockResolvedValue({
        id: testWorkspaceId,
        name: 'Test Workspace',
        widgetLogoUrl: null,
        widgetTitle: null,
        widgetLanguage: 'it', // Default
        widgetPrimaryColor: '#22c55e', // Default
      } as any)

      await controller.getWorkspaceById(mockReq as Request, mockRes as Response, mockNext)

      const response = (mockRes.json as jest.Mock).mock.calls[0][0]
      expect(response.widgetLogoUrl).toBeNull()
      expect(response.widgetTitle).toBeNull()
    })
  })

  describe('Widget Logo Upload - Separate from Channel Logo', () => {
    it('should upload logo and save as widgetLogoUrl (not logoUrl)', async () => {
      // This test verifies that logo upload can be directed to widgetLogoUrl
      // In the actual flow, frontend saves uploaded logo to widgetLogoUrl via PUT /workspaces/:id
      
      const uploadedLogoUrl = '/uploads/users/new-widget-logo_5678.png'
      
      mockReq.body = { widgetLogoUrl: uploadedLogoUrl }

      mockPrisma.workspaceMember.findFirst.mockResolvedValue({
        role: 'SUPER_ADMIN',
      })

      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        widgetLogoUrl: uploadedLogoUrl,
        logoUrl: '/uploads/channels/old-channel-logo.png', // Unchanged
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(updateSpy).toHaveBeenCalledWith(
        testWorkspaceId,
        expect.objectContaining({
          widgetLogoUrl: uploadedLogoUrl,
        })
      )

      const response = (mockRes.json as jest.Mock).mock.calls[0][0]
      expect(response.widgetLogoUrl).toBe(uploadedLogoUrl)
    })
  })

  describe('Security - Widget Configuration', () => {
    it('should rely on middleware for role checks (controller does not block)', async () => {
      mockReq.body = { widgetTitle: 'Hacked Chat' }

      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        widgetTitle: 'Hacked Chat',
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(updateSpy).toHaveBeenCalled()
    })

    it('should rely on middleware for workspace isolation (controller does not block)', async () => {
      const otherWorkspaceId = 'other-workspace-id'
      mockReq.params.id = otherWorkspaceId

      updateSpy.mockResolvedValue({
        id: otherWorkspaceId,
        widgetTitle: 'Updated Chat',
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      expect(updateSpy).toHaveBeenCalled()
    })
  })

  describe('Data Persistence - Refresh Scenario', () => {
    it('should persist widget config across GET requests (simulating page refresh)', async () => {
      const savedConfig = {
        widgetLogoUrl: testWidgetLogoUrl,
        widgetTitle: 'Support Chat',
        widgetLanguage: 'es',
        widgetPrimaryColor: '#3b82f6',
      }

      // Simulate user saves config
      mockReq.body = savedConfig
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'SUPER_ADMIN' })
      updateSpy.mockResolvedValue({
        id: testWorkspaceId,
        ...savedConfig,
      })

      await controller.updateWorkspace(mockReq as Request, mockRes as Response, mockNext)

      // Clear mocks to simulate fresh page load
      jest.clearAllMocks()

      // Simulate page refresh (GET request)
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'SUPER_ADMIN' })
      getByIdSpy.mockResolvedValue({
        id: testWorkspaceId,
        ...savedConfig,
      } as any)

      await controller.getWorkspaceById(mockReq as Request, mockRes as Response, mockNext)

      // Verify all config fields are returned after refresh
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining(savedConfig)
      )
    })
  })
})
