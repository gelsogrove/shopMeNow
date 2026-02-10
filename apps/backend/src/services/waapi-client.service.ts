import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

interface WaapiInstanceResponse {
  id: string;
  status: string;
  phone_number?: string;
  phone_name?: string;
  webhook_url?: string;
}

interface WaapiQrResponse {
  qr_code: string; // Base64 data URL
}

export class WaapiClientService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.WAAPI_BASE_URL || 'https://api.waapi.app/v1',
      headers: {
        'Authorization': `Bearer ${process.env.WAAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30s timeout
    });

    // Log requests (mask token)
    this.client.interceptors.request.use((config) => {
      logger.info('[WaAPI-Client] Request:', {
        method: config.method,
        url: config.url,
        data: config.data
      });
      return config;
    });

    // Log responses
    this.client.interceptors.response.use(
      (response) => {
        logger.info('[WaAPI-Client] Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('[WaAPI-Client] Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Create new WaAPI instance
   * @param phoneNumber WhatsApp number (E.164 format: +39...)
   * @param displayName Optional display name
   * @returns Instance ID
   */
  async createInstance(phoneNumber: string, displayName?: string): Promise<string> {
    try {
      const { data } = await this.client.post<WaapiInstanceResponse>('/instances', {
        phone_number: phoneNumber,
        phone_name: displayName || 'eChatbot AI'
      });

      logger.info('[WaAPI] Instance created:', { instanceId: data.id, phoneNumber: this.maskPhoneNumber(phoneNumber) });
      return data.id;
    } catch (error: any) {
      logger.error('[WaAPI] Failed to create instance:', error);
      throw new Error(`WaAPI instance creation failed: ${error.message}`);
    }
  }

  /**
   * Set webhook URL and events for instance
   * MUST be called immediately after instance creation
   */
  async setWebhook(instanceId: string, webhookUrl: string): Promise<void> {
    try {
      await this.client.put(`/instances/${instanceId}`, {
        webhook_url: webhookUrl,
        webhook_events: ['qr', 'authenticated', 'ready', 'disconnected', 'auth_failure']
      });

      logger.info('[WaAPI] Webhook configured:', { instanceId, webhookUrl });
    } catch (error: any) {
      logger.error('[WaAPI] Failed to set webhook:', error);
      throw new Error(`WaAPI webhook setup failed: ${error.message}`);
    }
  }

  /**
   * Get current QR code for instance
   * @returns Base64 data URL
   */
  async getQrCode(instanceId: string): Promise<string> {
    try {
      const { data } = await this.client.get<WaapiQrResponse>(`/instances/${instanceId}/qr`);
      return data.qr_code;
    } catch (error: any) {
      logger.error('[WaAPI] Failed to get QR code:', error);
      throw new Error(`WaAPI QR retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get instance status
   */
  async getInstanceStatus(instanceId: string): Promise<WaapiInstanceResponse> {
    try {
      const { data } = await this.client.get<WaapiInstanceResponse>(`/instances/${instanceId}`);
      return data;
    } catch (error: any) {
      logger.error('[WaAPI] Failed to get instance status:', error);
      throw new Error(`WaAPI status check failed: ${error.message}`);
    }
  }

  /**
   * Delete instance (irreversible)
   * Called when switching provider or deleting workspace
   */
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      await this.client.delete(`/instances/${instanceId}`);
      logger.info('[WaAPI] Instance deleted:', { instanceId });
    } catch (error: any) {
      logger.error('[WaAPI] Failed to delete instance:', error);
      throw new Error(`WaAPI deletion failed: ${error.message}`);
    }
  }

  /**
   * Validate webhook signature (if WaAPI provides one)
   * @param payload Raw webhook body
   * @param signature Signature header from WaAPI
   * @returns true if valid
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    // TODO: Implement HMAC validation when WaAPI docs specify the algorithm
    // For now, rely on instance ID validation in handler
    return true;
  }

  /**
   * Mask phone number for logging (PII protection)
   * @private
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 4);
  }
}
