import { api } from "@/services/api"

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'

export const workspaceApi = {
  async getAll(): Promise<any[]> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('backoffice_token') || ''}`,
    }

    const response = await fetch(
      `${API_BASE}/users/admin/workspaces`,
      { method: 'GET', headers }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch workspaces')
    }

    return response.json()
  },

  async getWidgetEmbedCode(workspaceId: string): Promise<{ embedCode: string }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('backoffice_token') || ''}`,
    }

    const response = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/widget/embed-code`,
      { method: 'GET', headers }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch embed code')
    }

    return response.json()
  },

  async getWhatsAppConfig(workspaceId: string): Promise<{
    success: boolean
    data: {
      whatsappProvider: 'meta' | 'ultramsg'
      metaPhoneNumberId: string
      metaAccessToken: string
      webhookVerifyToken: string
      ultraMsgInstanceId: string
      ultraMsgToken: string
      webhookUrl: string
    }
  }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('backoffice_token') || ''}`,
    }

    const response = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/whatsapp-config`,
      { method: 'GET', headers }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch WhatsApp config')
    }

    return response.json()
  },

  async updateWhatsAppConfig(
    workspaceId: string,
    config: {
      whatsappProvider: 'meta' | 'ultramsg'
      metaPhoneNumberId?: string
      metaAccessToken?: string
      webhookVerifyToken?: string
      ultraMsgInstanceId?: string
      ultraMsgToken?: string
    }
  ): Promise<{
    success: boolean
    message: string
    data?: {
      whatsappProvider: string
      webhookUrl: string
    }
  }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('backoffice_token') || ''}`,
    }

    const response = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/whatsapp-config`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update WhatsApp config')
    }

    return response.json()
  },
}
