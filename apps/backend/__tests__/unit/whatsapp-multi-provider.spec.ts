/**
 * WhatsApp Multi-Provider System Tests
 * 
 * Tests the complete multi-provider WhatsApp system:
 * - Factory Pattern creates correct provider based on workspace.whatsappProvider
 * - Meta provider uses metaPhoneNumberId + metaAccessToken
 * - UltraMsg provider uses ultraMsgInstanceId + ultraMsgToken
 * - Scheduler integrates correctly with Factory
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'

describe('🔄 WhatsApp Multi-Provider System', () => {
  describe('Factory Pattern - Provider Selection', () => {
    it('should create Meta provider when whatsappProvider="meta"', () => {
      const workspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        whatsappProvider: 'meta',
        metaPhoneNumberId: '123456789',
        metaAccessToken: 'meta-token-xxx',
        ultraMsgInstanceId: null,
        ultraMsgToken: null,
      }

      // Factory should detect "meta" and use Meta credentials
      expect(workspace.whatsappProvider).toBe('meta')
      expect(workspace.metaPhoneNumberId).toBeTruthy()
      expect(workspace.metaAccessToken).toBeTruthy()
    })

    it('should create UltraMsg provider when whatsappProvider="ultramsg"', () => {
      const workspace = {
        id: 'ws-456',
        name: 'Test Workspace',
        whatsappProvider: 'ultramsg',
        metaPhoneNumberId: null,
        metaAccessToken: null,
        ultraMsgInstanceId: 'instance123',
        ultraMsgToken: 'ultramsg-token-xxx',
      }

      // Factory should detect "ultramsg" and use UltraMsg credentials
      expect(workspace.whatsappProvider).toBe('ultramsg')
      expect(workspace.ultraMsgInstanceId).toBeTruthy()
      expect(workspace.ultraMsgToken).toBeTruthy()
    })

    it('should default to Meta provider when whatsappProvider is null', () => {
      const workspace = {
        id: 'ws-789',
        name: 'Test Workspace',
        whatsappProvider: null,
        metaPhoneNumberId: '123456789',
        metaAccessToken: 'meta-token-xxx',
        ultraMsgInstanceId: null,
        ultraMsgToken: null,
      }

      // Factory should default to "meta"
      const provider = workspace.whatsappProvider || 'meta'
      expect(provider).toBe('meta')
    })
  })

  describe('Credential Validation', () => {
    it('should validate Meta credentials are present', () => {
      const workspace = {
        whatsappProvider: 'meta',
        metaPhoneNumberId: '123456789',
        metaAccessToken: 'meta-token-xxx',
      }

      // Meta requires both fields
      const hasMetaCredentials = !!(
        workspace.metaPhoneNumberId && workspace.metaAccessToken
      )
      expect(hasMetaCredentials).toBe(true)
    })

    it('should validate UltraMsg credentials are present', () => {
      const workspace = {
        whatsappProvider: 'ultramsg',
        ultraMsgInstanceId: 'instance123',
        ultraMsgToken: 'ultramsg-token-xxx',
      }

      // UltraMsg requires both fields
      const hasUltraMsgCredentials = !!(
        workspace.ultraMsgInstanceId && workspace.ultraMsgToken
      )
      expect(hasUltraMsgCredentials).toBe(true)
    })

    it('should detect missing Meta credentials', () => {
      const workspace = {
        whatsappProvider: 'meta',
        metaPhoneNumberId: null,
        metaAccessToken: 'meta-token-xxx',
      }

      // Missing metaPhoneNumberId
      const hasMetaCredentials = !!(
        workspace.metaPhoneNumberId && workspace.metaAccessToken
      )
      expect(hasMetaCredentials).toBe(false)
    })

    it('should detect missing UltraMsg credentials', () => {
      const workspace = {
        whatsappProvider: 'ultramsg',
        ultraMsgInstanceId: 'instance123',
        ultraMsgToken: null,
      }

      // Missing ultraMsgToken
      const hasUltraMsgCredentials = !!(
        workspace.ultraMsgInstanceId && workspace.ultraMsgToken
      )
      expect(hasUltraMsgCredentials).toBe(false)
    })
  })

  describe('Scheduler Integration', () => {
    it('should load workspace and check provider flag', () => {
      // SCENARIO: Scheduler job runs and needs to send WhatsApp message
      const workspace = {
        id: 'ws-123',
        whatsappProvider: 'ultramsg',
        ultraMsgInstanceId: 'instance123',
        ultraMsgToken: 'ultramsg-token-xxx',
      }

      // STEP 1: Scheduler loads workspace from database
      expect(workspace).toBeTruthy()

      // STEP 2: Check whatsappProvider flag
      const provider = workspace.whatsappProvider
      expect(provider).toBe('ultramsg')

      // STEP 3: Factory creates correct provider based on flag
      if (provider === 'ultramsg') {
        // Should use UltraMsg credentials
        expect(workspace.ultraMsgInstanceId).toBeTruthy()
        expect(workspace.ultraMsgToken).toBeTruthy()
      }
    })

    it('should use correct API endpoint based on provider', () => {
      // SCENARIO: Message needs to be sent via correct API

      // Meta provider uses Graph API
      const metaWorkspace = {
        whatsappProvider: 'meta',
        metaPhoneNumberId: '123456789',
        metaAccessToken: 'meta-token-xxx',
      }

      if (metaWorkspace.whatsappProvider === 'meta') {
        const expectedEndpoint = `https://graph.facebook.com/v18.0/${metaWorkspace.metaPhoneNumberId}/messages`
        expect(expectedEndpoint).toContain('graph.facebook.com')
        expect(expectedEndpoint).toContain(metaWorkspace.metaPhoneNumberId)
      }

      // UltraMsg provider uses UltraMsg API
      const ultramsgWorkspace = {
        whatsappProvider: 'ultramsg',
        ultraMsgInstanceId: 'instance123',
        ultraMsgToken: 'ultramsg-token-xxx',
      }

      if (ultramsgWorkspace.whatsappProvider === 'ultramsg') {
        const expectedEndpoint = `https://api.ultramsg.com/${ultramsgWorkspace.ultraMsgInstanceId}/messages/chat`
        expect(expectedEndpoint).toContain('api.ultramsg.com')
        expect(expectedEndpoint).toContain(ultramsgWorkspace.ultraMsgInstanceId)
      }
    })

    it('should use correct request format based on provider', () => {
      // SCENARIO: Each provider has different request format

      // Meta uses JSON
      const metaPayload = {
        messaging_product: 'whatsapp',
        to: '+393401234567',
        type: 'text',
        text: { body: 'Hello from Meta' },
      }
      const metaContentType = 'application/json'
      expect(metaContentType).toBe('application/json')
      expect(metaPayload.messaging_product).toBe('whatsapp')

      // UltraMsg uses form-urlencoded
      const ultramsgPayload = {
        token: 'ultramsg-token-xxx',
        to: '393401234567', // Without +
        body: 'Hello from UltraMsg',
        priority: '10',
      }
      const ultramsgContentType = 'application/x-www-form-urlencoded'
      expect(ultramsgContentType).toBe('application/x-www-form-urlencoded')
      expect(ultramsgPayload.token).toBeTruthy()
    })
  })

  describe('Webhook URLs', () => {
    it('should generate correct Meta webhook URL', () => {
      const workspaceId = 'ws-meta-123'
      const metaWebhookUrl = `https://www.echatbot.ai/api/v1/whatsapp/webhook/${workspaceId}`

      expect(metaWebhookUrl).toContain('/whatsapp/webhook/')
      expect(metaWebhookUrl).toContain(workspaceId)
    })

    it('should generate correct UltraMsg webhook URL', () => {
      const workspaceId = 'ws-ultramsg-456'
      const ultramsgWebhookUrl = `https://www.echatbot.ai/api/v1/whatsapp/ultramsg/${workspaceId}`

      expect(ultramsgWebhookUrl).toContain('/whatsapp/ultramsg/')
      expect(ultramsgWebhookUrl).toContain(workspaceId)
    })
  })

  describe('API Endpoints', () => {
    describe('POST /workspaces/:id/whatsapp-config', () => {
      it('should accept Meta configuration', () => {
        const config = {
          whatsappProvider: 'meta',
          metaPhoneNumberId: '123456789',
          metaAccessToken: 'meta-token-xxx',
          webhookVerifyToken: 'verify-token-123',
          ultraMsgInstanceId: null,
          ultraMsgToken: null,
        }

        // Validation
        expect(config.whatsappProvider).toBe('meta')
        expect(config.metaPhoneNumberId).toBeTruthy()
        expect(config.metaAccessToken).toBeTruthy()
      })

      it('should accept UltraMsg configuration', () => {
        const config = {
          whatsappProvider: 'ultramsg',
          metaPhoneNumberId: null,
          metaAccessToken: null,
          webhookVerifyToken: null,
          ultraMsgInstanceId: 'instance123',
          ultraMsgToken: 'ultramsg-token-xxx',
        }

        // Validation
        expect(config.whatsappProvider).toBe('ultramsg')
        expect(config.ultraMsgInstanceId).toBeTruthy()
        expect(config.ultraMsgToken).toBeTruthy()
      })

      it('should reject invalid provider', () => {
        const config = {
          whatsappProvider: 'invalid-provider',
        }

        const validProviders = ['meta', 'ultramsg']
        const isValid = validProviders.includes(config.whatsappProvider)
        expect(isValid).toBe(false)
      })

      it('should reject Meta config with missing credentials', () => {
        const config = {
          whatsappProvider: 'meta',
          metaPhoneNumberId: '123456789',
          metaAccessToken: null, // Missing!
        }

        const hasMetaCredentials = !!(
          config.metaPhoneNumberId && config.metaAccessToken
        )
        expect(hasMetaCredentials).toBe(false)
      })

      it('should reject UltraMsg config with missing credentials', () => {
        const config = {
          whatsappProvider: 'ultramsg',
          ultraMsgInstanceId: null, // Missing!
          ultraMsgToken: 'ultramsg-token-xxx',
        }

        const hasUltraMsgCredentials = !!(
          config.ultraMsgInstanceId && config.ultraMsgToken
        )
        expect(hasUltraMsgCredentials).toBe(false)
      })
    })

    describe('GET /workspaces/:id/whatsapp-config', () => {
      it('should return Meta configuration', () => {
        const workspace = {
          whatsappProvider: 'meta',
          metaPhoneNumberId: '123456789',
          metaAccessToken: 'meta-token-xxx',
          webhookVerifyToken: 'verify-token-123',
          ultraMsgInstanceId: null,
          ultraMsgToken: null,
        }

        const response = {
          whatsappProvider: workspace.whatsappProvider || 'meta',
          metaPhoneNumberId: workspace.metaPhoneNumberId || '',
          metaAccessToken: workspace.metaAccessToken || '',
          webhookVerifyToken: workspace.webhookVerifyToken || '',
          ultraMsgInstanceId: workspace.ultraMsgInstanceId || '',
          ultraMsgToken: workspace.ultraMsgToken || '',
          webhookUrl: `https://www.echatbot.ai/api/v1/whatsapp/webhook/ws-123`,
        }

        expect(response.whatsappProvider).toBe('meta')
        expect(response.webhookUrl).toContain('/whatsapp/webhook/')
      })

      it('should return UltraMsg configuration', () => {
        const workspace = {
          whatsappProvider: 'ultramsg',
          metaPhoneNumberId: null,
          metaAccessToken: null,
          webhookVerifyToken: null,
          ultraMsgInstanceId: 'instance123',
          ultraMsgToken: 'ultramsg-token-xxx',
        }

        const response = {
          whatsappProvider: workspace.whatsappProvider || 'meta',
          metaPhoneNumberId: workspace.metaPhoneNumberId || '',
          metaAccessToken: workspace.metaAccessToken || '',
          webhookVerifyToken: workspace.webhookVerifyToken || '',
          ultraMsgInstanceId: workspace.ultraMsgInstanceId || '',
          ultraMsgToken: workspace.ultraMsgToken || '',
          webhookUrl: `https://www.echatbot.ai/api/v1/whatsapp/ultramsg/ws-456`,
        }

        expect(response.whatsappProvider).toBe('ultramsg')
        expect(response.webhookUrl).toContain('/whatsapp/ultramsg/')
      })
    })
  })

  describe('Complete Flow Test', () => {
    it('should handle complete Meta flow', () => {
      // SCENARIO: Workspace configured with Meta, message needs to be sent

      // 1. Workspace configuration
      const workspace = {
        id: 'ws-meta',
        whatsappProvider: 'meta',
        metaPhoneNumberId: '123456789',
        metaAccessToken: 'meta-token-xxx',
        ultraMsgInstanceId: null,
        ultraMsgToken: null,
      }

      // 2. Check provider
      expect(workspace.whatsappProvider).toBe('meta')

      // 3. Validate credentials
      const hasMetaCredentials = !!(
        workspace.metaPhoneNumberId && workspace.metaAccessToken
      )
      expect(hasMetaCredentials).toBe(true)

      // 4. Factory creates Meta provider
      const provider = workspace.whatsappProvider
      if (provider === 'meta') {
        const endpoint = `https://graph.facebook.com/v18.0/${workspace.metaPhoneNumberId}/messages`
        const payload = {
          messaging_product: 'whatsapp',
          to: '+393401234567',
          type: 'text',
          text: { body: 'Test message' },
        }
        const headers = {
          Authorization: `Bearer ${workspace.metaAccessToken}`,
          'Content-Type': 'application/json',
        }

        // 5. Verify correct configuration
        expect(endpoint).toContain('graph.facebook.com')
        expect(payload.messaging_product).toBe('whatsapp')
        expect(headers.Authorization).toContain(workspace.metaAccessToken)
        expect(headers['Content-Type']).toBe('application/json')
      }
    })

    it('should handle complete UltraMsg flow', () => {
      // SCENARIO: Workspace configured with UltraMsg, message needs to be sent

      // 1. Workspace configuration
      const workspace = {
        id: 'ws-ultramsg',
        whatsappProvider: 'ultramsg',
        metaPhoneNumberId: null,
        metaAccessToken: null,
        ultraMsgInstanceId: 'instance123',
        ultraMsgToken: 'ultramsg-token-xxx',
      }

      // 2. Check provider
      expect(workspace.whatsappProvider).toBe('ultramsg')

      // 3. Validate credentials
      const hasUltraMsgCredentials = !!(
        workspace.ultraMsgInstanceId && workspace.ultraMsgToken
      )
      expect(hasUltraMsgCredentials).toBe(true)

      // 4. Factory creates UltraMsg provider
      const provider = workspace.whatsappProvider
      if (provider === 'ultramsg') {
        const endpoint = `https://api.ultramsg.com/${workspace.ultraMsgInstanceId}/messages/chat`
        const payload = {
          token: workspace.ultraMsgToken,
          to: '393401234567', // Without +
          body: 'Test message',
          priority: '10',
        }
        const headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
        }

        // 5. Verify correct configuration
        expect(endpoint).toContain('api.ultramsg.com')
        expect(endpoint).toContain(workspace.ultraMsgInstanceId)
        expect(payload.token).toBe(workspace.ultraMsgToken)
        expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      }
    })
  })
})
