/**
 * 🧪 PLATFORM CONFIG CONTROLLER TESTS
 *
 * Unit tests for PlatformConfigController.
 *
 * Tests:
 * - GET /api/platform-config (public)
 * - GET /api/platform-config/flags/check (public)
 * - GET /api/platform-config/admin (authenticated)
 * - PUT /api/platform-config/:key (authenticated)
 * - POST /api/platform-config/flags/:key/toggle (authenticated)
 * - POST /api/platform-config/cache/invalidate (authenticated)
 *
 * @author Andrea Gelso - eChatbot Platform
 */

// Mock logger BEFORE imports
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock the service
jest.mock("../../../src/services/platform-config.service", () => ({
  platformConfigService: {
    getPublicConfig: jest.fn(),
    getAdminConfig: jest.fn(),
    updateConfig: jest.fn(),
    toggleFlag: jest.fn(),
    invalidateCache: jest.fn(),
    canLogin: jest.fn(),
    canRegister: jest.fn(),
    isWorkingInProgress: jest.fn(),
    getFlag: jest.fn(),
  },
}))

import { Request, Response } from "express"
import { platformConfigController } from "../../../src/interfaces/http/controllers/platform-config.controller"
import { platformConfigService } from "../../../src/services/platform-config.service"

describe("PlatformConfigController", () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockJson: jest.Mock
  let mockStatus: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockJson = jest.fn().mockReturnThis()
    mockStatus = jest.fn().mockReturnThis()

    mockRequest = {
      params: {},
      body: {},
    }

    mockResponse = {
      json: mockJson,
      status: mockStatus,
    }
  })

  describe("getPublicConfig", () => {
    const mockConfig = {
      prices: {
        BASIC_MONTHLY: { current: 19, original: 29 },
        PREMIUM_MONTHLY: { current: 39, original: 49 },
      },
      flags: {
        canLogin: true,
        canRegister: true,
      },
      limits: {
        FREE_PRODUCTS: 50,
      },
    }

    it("should return public config successfully", async () => {
      ;(platformConfigService.getPublicConfig as jest.Mock).mockResolvedValue(
        mockConfig
      )

      await platformConfigController.getPublicConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockConfig,
      })
    })

    it("should handle errors", async () => {
      ;(platformConfigService.getPublicConfig as jest.Mock).mockRejectedValue(
        new Error("Database error")
      )

      await platformConfigController.getPublicConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: "Failed to fetch platform configuration",
      })
    })
  })

  describe("checkFlags", () => {
    it("should return all feature flags", async () => {
      ;(platformConfigService.canLogin as jest.Mock).mockResolvedValue(true)
      ;(platformConfigService.canRegister as jest.Mock).mockResolvedValue(false)
      ;(platformConfigService.isWorkingInProgress as jest.Mock).mockResolvedValue(
        true
      )
      ;(platformConfigService.getFlag as jest.Mock).mockResolvedValue(false)

      await platformConfigController.checkFlags(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          canLogin: true,
          canRegister: false,
          workingInProgress: true,
          cantryDemo: false,
          registerFirst: false,
        },
      })
    })
  })

  describe("getAdminConfig", () => {
    const mockAdminConfig = {
      prices: [
        { key: "BASIC_MONTHLY", current: 19, original: 29, description: "Basic plan" },
      ],
      flags: [{ key: "canLogin", value: true, description: "Allow login" }],
      limits: [{ key: "FREE_PRODUCTS", value: 50, description: "Max products" }],
    }

    it("should return admin config successfully", async () => {
      ;(platformConfigService.getAdminConfig as jest.Mock).mockResolvedValue(
        mockAdminConfig
      )

      await platformConfigController.getAdminConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockAdminConfig,
      })
    })
  })

  describe("updateConfig", () => {
    it("should update config successfully", async () => {
      mockRequest.params = { key: "BASIC_MONTHLY" }
      mockRequest.body = { value: "25", originalValue: "29" }

      const updatedConfig = {
        key: "BASIC_MONTHLY",
        type: "PRICE",
        value: "25",
        originalValue: "29",
        description: "Basic plan",
        isActive: true,
      }

      ;(platformConfigService.updateConfig as jest.Mock).mockResolvedValue(
        updatedConfig
      )

      await platformConfigController.updateConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: updatedConfig,
      })
    })

    it("should return 400 if key is missing", async () => {
      mockRequest.params = {}
      mockRequest.body = { value: "25" }

      await platformConfigController.updateConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: "Configuration key is required",
      })
    })

    it("should return 400 if value is missing", async () => {
      mockRequest.params = { key: "BASIC_MONTHLY" }
      mockRequest.body = {}

      await platformConfigController.updateConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: "Value is required",
      })
    })

    it("should return 404 if key not found", async () => {
      mockRequest.params = { key: "NON_EXISTENT" }
      mockRequest.body = { value: "25" }

      ;(platformConfigService.updateConfig as jest.Mock).mockResolvedValue(null)

      await platformConfigController.updateConfig(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: "Configuration key not found: NON_EXISTENT",
      })
    })
  })

  describe("toggleFlag", () => {
    it("should toggle flag successfully", async () => {
      mockRequest.params = { key: "canLogin" }

      ;(platformConfigService.toggleFlag as jest.Mock).mockResolvedValue(false)

      await platformConfigController.toggleFlag(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          key: "canLogin",
          value: false,
        },
      })
    })

    it("should return 400 if key is missing", async () => {
      mockRequest.params = {}

      await platformConfigController.toggleFlag(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: "Flag key is required",
      })
    })
  })

  describe("invalidateCache", () => {
    it("should invalidate cache successfully", async () => {
      ;(platformConfigService.invalidateCache as jest.Mock).mockResolvedValue(
        undefined
      )

      await platformConfigController.invalidateCache(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Cache invalidated successfully",
      })
    })
  })
})
