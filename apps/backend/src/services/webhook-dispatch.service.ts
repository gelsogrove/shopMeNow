import axios from 'axios'
import crypto from 'crypto'
import logger from '../utils/logger'

export interface WebhookPayload {
    function: string
    parameters: Record<string, any>
    context: {
        workspaceId: string
        customerId: string
        customerLanguage?: string
    }
}

export interface CredentialMapping {
    [credentialName: string]: {
        location: 'header' | 'querystring' | 'body'
        paramName: string
        format?: string // e.g., "Bearer ${value}" or "${value}"
        variableName: string // Name of the environment variable to use
    }
}

export class WebhookDispatchService {
    /**
     * Dispatch a function call to a client's webhook with optional credential injection
     *
     * Credential Injection:
     * - Supports multiple locations: header, querystring, body
     * - Format templates: "Bearer ${value}" or custom patterns
     * - Credentials decrypted at runtime, never logged
     *
     * HMAC Signing:
     * - Signature computed over timestamp + body
     * - Allows webhook receiver to verify authenticity
     */
    async dispatch(options: {
        url: string
        secret?: string
        timeout?: number
        payload: WebhookPayload
        credentialsMapping?: CredentialMapping
        credentials?: Map<string, string> // Pre-loaded credentials for testing
    }): Promise<any> {
        const { url, secret, timeout = 10000, payload, credentialsMapping, credentials } = options

        const timestamp = Date.now().toString()
        let body = JSON.stringify(payload)

        // Generate headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Echatbot-Event': 'function_call',
            'X-Echatbot-Timestamp': timestamp,
        }

        let finalUrl = url

        // 🔐 Inject credentials if mapping provided
        if (credentialsMapping && Object.keys(credentialsMapping).length > 0) {
            try {
                const { bodyWithCredentials, headersWithCredentials, urlWithCredentials } =
                    this.injectCredentials(body, headers, finalUrl, credentialsMapping, credentials || new Map())

                body = bodyWithCredentials
                headers['Content-Type'] = 'application/json'
                Object.assign(headers, headersWithCredentials)
                finalUrl = urlWithCredentials

                logger.info(`🔐 Credentials injected for webhook dispatch`, {
                    function: payload.function,
                    workspaceId: payload.context.workspaceId,
                    locations: Object.keys(credentialsMapping),
                })
            } catch (error) {
                logger.error(`❌ Failed to inject credentials:`, error)
                throw new Error(`CREDENTIAL_INJECTION_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        // 🔐 Generate HMAC-SHA256 signature when secret is configured
        // Format: HMAC-SHA256(timestamp + '.' + body, secret)
        // Receiver verifies with: crypto.createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex')
        if (secret) {
            const signature = crypto
                .createHmac('sha256', secret)
                .update(timestamp + '.' + body)
                .digest('hex')
            headers['X-Echatbot-Signature'] = `sha256=${signature}`
        }

        try {
            logger.info(`🌐 Dispatching webhook to ${finalUrl}`, {
                function: payload.function,
                workspaceId: payload.context.workspaceId,
                credentialsCount: credentialsMapping ? Object.keys(credentialsMapping).length : 0,
            })

            const response = await axios.post(finalUrl, body, {
                headers,
                timeout,
                validateStatus: (status) => status >= 200 && status < 300,
            })

            return response.data
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                logger.error(`⏱️ Webhook timeout (${timeout}ms) for ${finalUrl}`)
                throw new Error('WEBHOOK_TIMEOUT')
            }

            const statusCode = error.response?.status
            const errorData = error.response?.data

            logger.error(`❌ Webhook dispatch failed to ${finalUrl}`, {
                statusCode,
                error: error.message,
                data: errorData,
            })

            throw new Error(`WEBHOOK_ERROR: ${statusCode || 'CONNECTION_FAILED'}`)
        }
    }

    /**
     * Inject credentials into webhook URL, headers, and/or body
     *
     * Supports three locations:
     * 1. Header: e.g., Authorization: "Bearer sk_live_xxx"
     * 2. Querystring: e.g., ?api_key=sk_live_xxx
     * 3. Body: e.g., { credentials: { stripe_key: "sk_live_xxx" } }
     *
     * Returns modified body, headers, and URL
     */
    private injectCredentials(
        body: string,
        headers: Record<string, string>,
        url: string,
        credentialsMapping: CredentialMapping,
        credentials: Map<string, string>
    ): { bodyWithCredentials: string; headersWithCredentials: Record<string, string>; urlWithCredentials: string } {
        const headersWithCredentials = { ...headers }
        let urlWithCredentials = url
        let bodyJson = JSON.parse(body)

        const injectedLocations: string[] = []

        for (const [credName, mapping] of Object.entries(credentialsMapping)) {
            const { location, paramName, format, variableName } = mapping

            // Get credential from map
            const credentialValue = credentials.get(variableName)
            if (!credentialValue) {
                logger.warn(`⚠️ Credential not found for variable: ${variableName}`, {
                    credentialName: credName,
                })
                throw new Error(`Missing credential: ${variableName}`)
            }

            // Format the value (apply format template if provided)
            const formattedValue = format ? format.replace('${value}', credentialValue) : credentialValue

            switch (location) {
                case 'header': {
                    // Inject into HTTP header
                    headersWithCredentials[paramName] = formattedValue
                    injectedLocations.push(`header:${paramName}`)
                    break
                }

                case 'querystring': {
                    // Inject into URL querystring (apply format template consistently with header)
                    const separator = urlWithCredentials.includes('?') ? '&' : '?'
                    urlWithCredentials += `${separator}${paramName}=${encodeURIComponent(formattedValue)}`
                    injectedLocations.push(`querystring:${paramName}`)
                    break
                }

                case 'body': {
                    // Inject into request body (nested path)
                    // Supports dot notation: "credentials.stripe_key" → { credentials: { stripe_key: "..." } }
                    const pathParts = paramName.split('.')
                    let current = bodyJson

                    for (let i = 0; i < pathParts.length - 1; i++) {
                        const part = pathParts[i]
                        if (!current[part]) {
                            current[part] = {}
                        }
                        current = current[part]
                    }

                    current[pathParts[pathParts.length - 1]] = formattedValue
                    injectedLocations.push(`body:${paramName}`)
                    break
                }

                default: {
                    throw new Error(`Unknown credential location: ${location}`)
                }
            }
        }

        logger.info(`✅ Credentials injected at ${injectedLocations.length} location(s)`, {
            locations: injectedLocations,
        })

        return {
            bodyWithCredentials: JSON.stringify(bodyJson),
            headersWithCredentials,
            urlWithCredentials,
        }
    }
}
