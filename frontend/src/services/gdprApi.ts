import { api } from "./api"

export interface GdprContent {
  gdpr_ita: string
  gdpr_esp: string
  gdpr_eng: string
  gdpr_prt: string
}

export const gdprApi = {
  /**
   * Get GDPR content for a workspace (all 4 languages)
   */
  async getContent(workspaceId: string): Promise<GdprContent | null> {
    const url = `/workspaces/${workspaceId}/gdpr`
    try {
      const response = await api.get(url)
      return response.data
    } catch (error) {
      console.error("Error fetching GDPR content:", error)
      return null
    }
  },

  /**
   * Update GDPR content for a workspace (all 4 languages)
   */
  async updateContent(
    workspaceId: string,
    data: GdprContent
  ): Promise<GdprContent> {
    const url = `/workspaces/${workspaceId}/gdpr`
    const response = await api.put(url, data)
    return response.data
  },
}
