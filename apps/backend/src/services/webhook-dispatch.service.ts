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

export class WebhookDispatchService {
    /**
     * Dispatch a function call to a client's webhook with HMAC signing
     */
    async dispatch(options: {
        url: string
        secret?: string
        timeout?: number
        payload: WebhookPayload
    }): Promise<any> {
        const { url, secret, timeout = 10000, payload } = options

        const timestamp = Date.now().toString()
        const body = JSON.stringify(payload)

        // Generate headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Echatbot-Event': 'function_call',
            'X-Echatbot-Timestamp': timestamp,
        }

        try {
            logger.info(`🌐 Dispatching webhook to ${url}`, {
                function: payload.function,
                workspaceId: payload.context.workspaceId
            })

            const response = await axios.post(url, payload, {
                headers,
                timeout,
                validateStatus: (status) => status >= 200 && status < 300
            })

            return response.data
        } catch (error: any) {
            if (error.code === 'ECONNABORTED') {
                logger.error(`⏱️ Webhook timeout (${timeout}ms) for ${url}`)
                throw new Error('WEBHOOK_TIMEOUT')
            }

            const statusCode = error.response?.status
            const errorData = error.response?.data

            logger.error(`❌ Webhook dispatch failed to ${url}`, {
                statusCode,
                error: error.message,
                data: errorData
            })

            throw new Error(`WEBHOOK_ERROR: ${statusCode || 'CONNECTION_FAILED'}`)
        }
    }
}
