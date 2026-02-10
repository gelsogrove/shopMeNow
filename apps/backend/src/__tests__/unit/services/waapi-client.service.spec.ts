import axios from 'axios'
import { WaapiClientService } from '../../../services/waapi-client.service'

// Mock logger to avoid console noise during tests
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('WaapiClientService', () => {
  let waapiClient: WaapiClientService
  const BASE_URL = 'https://api.waapi.app/v1'
  const API_KEY = 'test_waapi_key'
  let mockAxiosInstance: any

  beforeAll(() => {
    // Set environment variables
    process.env.WAAPI_BASE_URL = BASE_URL
    process.env.WAAPI_API_KEY = API_KEY
  })

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: {
        baseURL: BASE_URL,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    }

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance)

    // Create new instance for each test
    waapiClient = new WaapiClientService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createInstance', () => {
    // SCENARIO: User initiates WaAPI onboarding with valid phone number
    // RULE: Must create instance and return instanceId
    it('should create instance and return instanceId', async () => {
      const phoneNumber = '+393331234567'
      const displayName = 'My Shop Bot'
      const mockResponse = {
        id: 'wa_inst_123456',
        status: 'pending',
        phone_number: phoneNumber,
        phone_name: displayName,
      }

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse })

      const instanceId = await waapiClient.createInstance(phoneNumber, displayName)

      expect(instanceId).toBe('wa_inst_123456')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instances', {
        phone_number: phoneNumber,
        phone_name: displayName,
      })
    })

    // SCENARIO: User provides only phone number, no display name
    // RULE: Should use default display name 'eChatbot AI'
    it('should use default display name if not provided', async () => {
      const phoneNumber = '+393331234567'
      const mockResponse = {
        id: 'wa_inst_123456',
        status: 'pending',
      }

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse })

      await waapiClient.createInstance(phoneNumber)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instances', {
        phone_number: phoneNumber,
        phone_name: 'eChatbot AI',
      })
    })

    // SCENARIO: WaAPI API returns 500 error
    // RULE: Should throw error with descriptive message
    it('should throw error on API failure', async () => {
      const phoneNumber = '+393331234567'

      mockAxiosInstance.post.mockRejectedValue(new Error('Internal Server Error'))

      await expect(waapiClient.createInstance(phoneNumber)).rejects.toThrow(
        'WaAPI instance creation failed'
      )
    })

    // SCENARIO: Network timeout during instance creation
    // RULE: Should throw error after timeout
    it('should throw error on network timeout', async () => {
      const phoneNumber = '+393331234567'

      mockAxiosInstance.post.mockRejectedValue(new Error('Timeout'))

      await expect(waapiClient.createInstance(phoneNumber)).rejects.toThrow()
    })
  })

  describe('setWebhook', () => {
    // SCENARIO: After instance creation, configure webhook URL
    // RULE: Should send PUT request with webhook URL and events
    it('should configure webhook URL and events', async () => {
      const instanceId = 'wa_inst_123456'
      const webhookUrl = 'https://echatbot.ai/api/waapi/webhook/wa_inst_123456'

      mockAxiosInstance.put.mockResolvedValue({ data: { success: true } })

      await waapiClient.setWebhook(instanceId, webhookUrl)

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/instances/${instanceId}`, {
        webhook_url: webhookUrl,
        webhook_events: ['qr', 'authenticated', 'ready', 'disconnected', 'auth_failure'],
      })
    })

    // SCENARIO: WaAPI API fails to configure webhook
    // RULE: Should throw error with descriptive message
    it('should throw error on webhook setup failure', async () => {
      const instanceId = 'wa_inst_123456'
      const webhookUrl = 'https://echatbot.ai/api/waapi/webhook/wa_inst_123456'

      mockAxiosInstance.put.mockRejectedValue(new Error('Invalid URL'))

      await expect(waapiClient.setWebhook(instanceId, webhookUrl)).rejects.toThrow(
        'WaAPI webhook setup failed'
      )
    })
  })

  describe('getQrCode', () => {
    // SCENARIO: User needs to scan QR code to authenticate
    // RULE: Should return base64 data URL
    it('should return base64 QR code data', async () => {
      const instanceId = 'wa_inst_123456'
      const mockQrData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      const mockResponse = {
        qr_code: mockQrData,
      }

      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse })

      const qrCode = await waapiClient.getQrCode(instanceId)

      expect(qrCode).toBe(mockQrData)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/instances/${instanceId}/qr`)
    })

    // SCENARIO: QR code expired or instance already authenticated
    // RULE: Should throw error
    it('should throw error if QR code unavailable', async () => {
      const instanceId = 'wa_inst_123456'

      mockAxiosInstance.get.mockRejectedValue(new Error('QR not available'))

      await expect(waapiClient.getQrCode(instanceId)).rejects.toThrow(
        'WaAPI QR retrieval failed'
      )
    })
  })

  describe('getInstanceStatus', () => {
    // SCENARIO: Check current status of WhatsApp instance
    // RULE: Should return full instance details
    it('should return instance status details', async () => {
      const instanceId = 'wa_inst_123456'
      const mockResponse = {
        id: instanceId,
        status: 'ready',
        phone_number: '+393331234567',
        phone_name: 'My Shop Bot',
        webhook_url: 'https://echatbot.ai/api/waapi/webhook/wa_inst_123456',
      }

      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse })

      const status = await waapiClient.getInstanceStatus(instanceId)

      expect(status).toEqual(mockResponse)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/instances/${instanceId}`)
    })

    // SCENARIO: Instance not found in WaAPI
    // RULE: Should throw error
    it('should throw error if instance not found', async () => {
      const instanceId = 'invalid_id'

      mockAxiosInstance.get.mockRejectedValue(new Error('Instance not found'))

      await expect(waapiClient.getInstanceStatus(instanceId)).rejects.toThrow(
        'WaAPI status check failed'
      )
    })
  })

  describe('deleteInstance', () => {
    // SCENARIO: User disconnects WhatsApp or switches provider
    // RULE: Should delete instance from WaAPI
    it('should delete instance successfully', async () => {
      const instanceId = 'wa_inst_123456'

      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } })

      await waapiClient.deleteInstance(instanceId)

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/instances/${instanceId}`)
    })

    // SCENARIO: WaAPI API fails to delete instance
    // RULE: Should throw error with descriptive message
    it('should throw error on deletion failure', async () => {
      const instanceId = 'wa_inst_123456'

      mockAxiosInstance.delete.mockRejectedValue(new Error('Server error'))

      await expect(waapiClient.deleteInstance(instanceId)).rejects.toThrow(
        'WaAPI deletion failed'
      )
    })

    // SCENARIO: Instance already deleted
    // RULE: Should throw error
    it('should throw error if instance not found', async () => {
      const instanceId = 'invalid_id'

      mockAxiosInstance.delete.mockRejectedValue(new Error('Not found'))

      await expect(waapiClient.deleteInstance(instanceId)).rejects.toThrow(
        'WaAPI deletion failed'
      )
    })
  })

  describe('validateWebhookSignature', () => {
    // SCENARIO: WaAPI sends webhook with signature (if implemented)
    // RULE: Currently returns true (signature validation not yet implemented)
    it('should return true for any signature (placeholder)', () => {
      const payload = '{"event": "ready"}'
      const signature = 'sha256=abc123'

      const isValid = waapiClient.validateWebhookSignature(payload, signature)

      expect(isValid).toBe(true)
    })
  })

  describe('HTTP client configuration', () => {
    // SCENARIO: Verify HTTP client is properly configured
    // RULE: Should have correct base URL, auth header, and timeout
    it('should have correct base URL and headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: BASE_URL,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      })
    })
  })
})
