import { api } from "@/services/api"

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'

export const workspaceApi = {
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
}
