/**
 * WebhookDispatchService Credential Injection Tests
 *
 * RULE: Tests exercise actual WebhookDispatchService.dispatch() with axios mocked
 * to capture headers, URL, and body before HTTP call.
 *
 * Tests for:
 * - Header injection (Bearer format, custom headers, plain values)
 * - Querystring injection (URL encoding, multiple params, format templates)
 * - Body injection (flat fields, nested dot notation)
 * - Format template application ("Bearer ${value}", custom)
 * - Mixed locations in single dispatch
 * - Missing credential -> error before HTTP call
 * - Unknown location -> error before HTTP call
 * - Empty mapping -> normal dispatch without injection
 */

import axios from 'axios'
import { WebhookDispatchService, CredentialMapping } from '../../../src/services/webhook-dispatch.service'

// SCENARIO: Mock axios so dispatch() never makes real HTTP calls
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('WebhookDispatchService Credential Injection', () => {
  let service: WebhookDispatchService

  const basePayload = {
    function: 'test_function',
    parameters: { key: 'value' },
    context: { workspaceId: 'ws-test-123', customerId: 'cust-456' },
  }

  beforeEach(() => {
    service = new WebhookDispatchService()
    jest.clearAllMocks()

    // RULE: Mock returns success so dispatch() completes normally
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { success: true },
    })
  })

  // -- Header Injection ---------------------------------------------------

  describe('Header Injection', () => {
    it('should inject Bearer token into Authorization header', async () => {
      // SCENARIO: Stripe-style Bearer auth injected at dispatch time
      const credentialsMapping: CredentialMapping = {
        stripe_auth: {
          location: 'header',
          paramName: 'Authorization',
          format: 'Bearer ${value}',
          variableName: 'STRIPE_API_KEY',
        },
      }
      const credentials = new Map([['STRIPE_API_KEY', 'sk_live_test123']])

      await service.dispatch({
        url: 'https://api.stripe.com/webhook',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      // RULE: axios.post called once with credential in headers
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
      const [calledUrl, , config] = mockedAxios.post.mock.calls[0]
      expect(calledUrl).toBe('https://api.stripe.com/webhook')
      expect(config.headers['Authorization']).toBe('Bearer sk_live_test123')
    })

    it('should inject plain value into custom header (no format)', async () => {
      // SCENARIO: API key in X-API-Key header without format wrapping
      const credentialsMapping: CredentialMapping = {
        api_key: {
          location: 'header',
          paramName: 'X-API-Key',
          variableName: 'MY_API_KEY',
        },
      }
      const credentials = new Map([['MY_API_KEY', 'abc123def456']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, , config] = mockedAxios.post.mock.calls[0]
      // RULE: Without format template, raw credential value is used
      expect(config.headers['X-API-Key']).toBe('abc123def456')
    })

    it('should apply Basic auth format template', async () => {
      // SCENARIO: Twilio-style Basic auth (base64 credentials)
      const credentialsMapping: CredentialMapping = {
        twilio_auth: {
          location: 'header',
          paramName: 'Authorization',
          format: 'Basic ${value}',
          variableName: 'TWILIO_TOKEN',
        },
      }
      const credentials = new Map([['TWILIO_TOKEN', 'dXNlcjpwYXNz']])

      await service.dispatch({
        url: 'https://api.twilio.com/hook',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, , config] = mockedAxios.post.mock.calls[0]
      expect(config.headers['Authorization']).toBe('Basic dXNlcjpwYXNz')
    })

    it('should preserve Content-Type and timestamp headers', async () => {
      // SCENARIO: Injecting auth must not destroy standard headers
      const credentialsMapping: CredentialMapping = {
        auth: {
          location: 'header',
          paramName: 'Authorization',
          format: 'Bearer ${value}',
          variableName: 'TOKEN',
        },
      }
      const credentials = new Map([['TOKEN', 'tok_123']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, , config] = mockedAxios.post.mock.calls[0]
      // RULE: Standard headers preserved alongside injected ones
      expect(config.headers['Content-Type']).toBe('application/json')
      expect(config.headers['X-Echatbot-Event']).toBe('function_call')
      expect(config.headers['X-Echatbot-Timestamp']).toBeDefined()
      expect(config.headers['Authorization']).toBe('Bearer tok_123')
    })
  })

  // -- Querystring Injection ------------------------------------------------

  describe('Querystring Injection', () => {
    it('should append credential as URL query parameter', async () => {
      // SCENARIO: SendGrid-style API key in querystring
      const credentialsMapping: CredentialMapping = {
        sg_key: {
          location: 'querystring',
          paramName: 'api_key',
          variableName: 'SENDGRID_KEY',
        },
      }
      const credentials = new Map([['SENDGRID_KEY', 'SG.abc123']])

      await service.dispatch({
        url: 'https://api.sendgrid.com/v3/send',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [calledUrl] = mockedAxios.post.mock.calls[0]
      // RULE: URL has api_key appended as querystring
      expect(calledUrl).toContain('?api_key=')
      expect(calledUrl).toContain(encodeURIComponent('SG.abc123'))
    })

    it('should URL-encode special characters in querystring values', async () => {
      // SCENARIO: Credential contains chars requiring URL encoding (/ + = &)
      const credentialsMapping: CredentialMapping = {
        token: {
          location: 'querystring',
          paramName: 'token',
          variableName: 'SPECIAL_TOKEN',
        },
      }
      const credentials = new Map([['SPECIAL_TOKEN', 'abc/def+ghi=jkl&mno']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [calledUrl] = mockedAxios.post.mock.calls[0]
      // RULE: encodeURIComponent applied to the value
      expect(calledUrl).toContain(encodeURIComponent('abc/def+ghi=jkl&mno'))
      expect(calledUrl).not.toContain('abc/def+ghi') // raw chars MUST be encoded
    })

    it('should append multiple querystring params with & separator', async () => {
      // SCENARIO: Two credentials both injected into querystring
      const credentialsMapping: CredentialMapping = {
        uid: {
          location: 'querystring',
          paramName: 'uid',
          variableName: 'USER_ID',
        },
        token: {
          location: 'querystring',
          paramName: 'token',
          variableName: 'API_TOKEN',
        },
      }
      const credentials = new Map([
        ['USER_ID', '12345'],
        ['API_TOKEN', 'secret_abc'],
      ])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [calledUrl] = mockedAxios.post.mock.calls[0]
      // RULE: First param uses ?, subsequent use &
      expect(calledUrl).toContain('uid=12345')
      expect(calledUrl).toContain('token=secret_abc')
      expect(calledUrl).toMatch(/\?.*&/)
    })

    it('should apply format template to querystring values', async () => {
      // SCENARIO: Querystring value needs format wrapping
      const credentialsMapping: CredentialMapping = {
        key: {
          location: 'querystring',
          paramName: 'auth',
          format: 'token_${value}',
          variableName: 'TOKEN',
        },
      }
      const credentials = new Map([['TOKEN', 'abc123']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [calledUrl] = mockedAxios.post.mock.calls[0]
      // RULE: Formatted value URL-encoded in querystring
      expect(calledUrl).toContain('auth=' + encodeURIComponent('token_abc123'))
    })
  })

  // -- Body Injection -------------------------------------------------------

  describe('Body Injection', () => {
    it('should inject credential into flat body field', async () => {
      // SCENARIO: Simple top-level body field injection
      const credentialsMapping: CredentialMapping = {
        api_key: {
          location: 'body',
          paramName: 'api_key',
          variableName: 'MY_KEY',
        },
      }
      const credentials = new Map([['MY_KEY', 'key_abc123']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, calledBody] = mockedAxios.post.mock.calls[0]
      const parsed = JSON.parse(calledBody)
      // RULE: Credential injected at top level of body
      expect(parsed.api_key).toBe('key_abc123')
    })

    it('should inject credential into nested path via dot notation', async () => {
      // SCENARIO: Credential goes into config.stripe.api_key (3 levels deep)
      const credentialsMapping: CredentialMapping = {
        stripe: {
          location: 'body',
          paramName: 'config.stripe.api_key',
          variableName: 'STRIPE_KEY',
        },
      }
      const credentials = new Map([['STRIPE_KEY', 'sk_live_nested']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, calledBody] = mockedAxios.post.mock.calls[0]
      const parsed = JSON.parse(calledBody)
      // RULE: Dot notation creates nested object hierarchy
      expect(parsed.config).toBeDefined()
      expect(parsed.config.stripe).toBeDefined()
      expect(parsed.config.stripe.api_key).toBe('sk_live_nested')
    })

    it('should inject multiple credentials under same parent object', async () => {
      // SCENARIO: Two credentials both under auth.* parent
      const credentialsMapping: CredentialMapping = {
        stripe: {
          location: 'body',
          paramName: 'auth.stripe_key',
          variableName: 'STRIPE_KEY',
        },
        mailchimp: {
          location: 'body',
          paramName: 'auth.mailchimp_key',
          variableName: 'MAILCHIMP_KEY',
        },
      }
      const credentials = new Map([
        ['STRIPE_KEY', 'sk_live_stripe'],
        ['MAILCHIMP_KEY', 'mc_abc123'],
      ])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, calledBody] = mockedAxios.post.mock.calls[0]
      const parsed = JSON.parse(calledBody)
      // RULE: Both credentials coexist under shared parent
      expect(parsed.auth.stripe_key).toBe('sk_live_stripe')
      expect(parsed.auth.mailchimp_key).toBe('mc_abc123')
    })

    it('should apply format template to body values', async () => {
      // SCENARIO: Body value wrapped in Bearer format
      const credentialsMapping: CredentialMapping = {
        key: {
          location: 'body',
          paramName: 'credentials.token',
          format: 'Bearer ${value}',
          variableName: 'TOKEN',
        },
      }
      const credentials = new Map([['TOKEN', 'jwt_abc']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, calledBody] = mockedAxios.post.mock.calls[0]
      const parsed = JSON.parse(calledBody)
      expect(parsed.credentials.token).toBe('Bearer jwt_abc')
    })

    it('should preserve original payload fields alongside injected body credentials', async () => {
      // SCENARIO: Body injection must not overwrite existing payload data
      const credentialsMapping: CredentialMapping = {
        key: {
          location: 'body',
          paramName: 'secret_key',
          variableName: 'SECRET',
        },
      }
      const credentials = new Map([['SECRET', 'sec_123']])

      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [, calledBody] = mockedAxios.post.mock.calls[0]
      const parsed = JSON.parse(calledBody)
      // RULE: Original payload preserved
      expect(parsed.function).toBe('test_function')
      expect(parsed.parameters.key).toBe('value')
      expect(parsed.context.workspaceId).toBe('ws-test-123')
      // RULE: Credential injected alongside
      expect(parsed.secret_key).toBe('sec_123')
    })
  })

  // -- Mixed Locations ------------------------------------------------------

  describe('Mixed Locations', () => {
    it('should inject credentials into header + querystring + body simultaneously', async () => {
      // SCENARIO: Real-world pattern: auth in header, tracking in qs, secret in body
      const credentialsMapping: CredentialMapping = {
        auth: {
          location: 'header',
          paramName: 'Authorization',
          format: 'Bearer ${value}',
          variableName: 'AUTH_TOKEN',
        },
        tracking: {
          location: 'querystring',
          paramName: 'tracking_id',
          variableName: 'TRACKING_ID',
        },
        secret: {
          location: 'body',
          paramName: 'security.webhook_secret',
          variableName: 'WEBHOOK_SECRET',
        },
      }
      const credentials = new Map([
        ['AUTH_TOKEN', 'jwt_token_abc'],
        ['TRACKING_ID', 'track_123'],
        ['WEBHOOK_SECRET', 'secret_xyz'],
      ])

      await service.dispatch({
        url: 'https://example.com/webhook',
        payload: basePayload,
        credentialsMapping,
        credentials,
      })

      const [calledUrl, calledBody, config] = mockedAxios.post.mock.calls[0]

      // RULE: Header has auth
      expect(config.headers['Authorization']).toBe('Bearer jwt_token_abc')
      // RULE: URL has tracking param
      expect(calledUrl).toContain('tracking_id=track_123')
      // RULE: Body has nested secret
      const parsed = JSON.parse(calledBody)
      expect(parsed.security.webhook_secret).toBe('secret_xyz')
    })
  })

  // -- Error Handling -------------------------------------------------------

  describe('Error Handling', () => {
    it('should throw CREDENTIAL_INJECTION_FAILED when credential is missing from map', async () => {
      // SCENARIO: Mapping references MISSING_TOKEN but credentials map is empty
      const credentialsMapping: CredentialMapping = {
        auth: {
          location: 'header',
          paramName: 'Authorization',
          format: 'Bearer ${value}',
          variableName: 'MISSING_TOKEN',
        },
      }
      const credentials = new Map<string, string>()

      // RULE: dispatch() throws CREDENTIAL_INJECTION_FAILED wrapping missing credential
      await expect(
        service.dispatch({
          url: 'https://example.com/api',
          payload: basePayload,
          credentialsMapping,
          credentials,
        })
      ).rejects.toThrow('CREDENTIAL_INJECTION_FAILED')

      // RULE: axios must NOT be called (failure before HTTP)
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })

    it('should include variable name in error message for missing credential', async () => {
      // SCENARIO: Error message should identify which variable is missing
      const credentialsMapping: CredentialMapping = {
        auth: {
          location: 'header',
          paramName: 'Authorization',
          variableName: 'NONEXISTENT_VAR',
        },
      }
      const credentials = new Map<string, string>()

      await expect(
        service.dispatch({
          url: 'https://example.com/api',
          payload: basePayload,
          credentialsMapping,
          credentials,
        })
      ).rejects.toThrow('NONEXISTENT_VAR')
    })

    it('should throw for unknown credential location type', async () => {
      // SCENARIO: Invalid location value not in header/querystring/body
      const credentialsMapping = {
        bad: {
          location: 'cookie' as any,
          paramName: 'session',
          variableName: 'SESSION_TOKEN',
        },
      }
      const credentials = new Map([['SESSION_TOKEN', 'session_abc']])

      await expect(
        service.dispatch({
          url: 'https://example.com/api',
          payload: basePayload,
          credentialsMapping,
          credentials,
        })
      ).rejects.toThrow('CREDENTIAL_INJECTION_FAILED')

      expect(mockedAxios.post).not.toHaveBeenCalled()
    })

    it('should dispatch normally when mapping is empty', async () => {
      // SCENARIO: Empty credentialsMapping -> no injection, normal dispatch
      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
        credentialsMapping: {},
        credentials: new Map(),
      })

      // RULE: Dispatch proceeds without injection
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
      const [, , config] = mockedAxios.post.mock.calls[0]
      // RULE: No extra auth headers injected
      expect(config.headers['Authorization']).toBeUndefined()
    })

    it('should dispatch normally when no credentialsMapping provided', async () => {
      // SCENARIO: Missing credentialsMapping entirely -> standard dispatch
      await service.dispatch({
        url: 'https://example.com/api',
        payload: basePayload,
      })

      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    })
  })
})
