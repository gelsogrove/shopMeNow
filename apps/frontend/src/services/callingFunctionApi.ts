import { api } from "./api"

export interface CallingFunction {
    id: string
    workspaceId: string
    functionName: string
    description: string
    parameters: any
    executionType: "INTERNAL" | "WEBHOOK" | "DELEGATE_TO_AGENT"
    isActive: boolean
    isSystemFunction: boolean
    webhookUrl?: string | null
    responseInstructions?: string | null
    credentialsMapping?: Record<string, any> | null
}

export const callingFunctionsApi = {
    list: async (workspaceId: string): Promise<CallingFunction[]> => {
        const response = await api.get(`/workspaces/${workspaceId}/functions`)
        // API returns { functions: [...] }
        return response.data?.functions ?? []
    },

    create: async (workspaceId: string, data: Partial<CallingFunction>): Promise<CallingFunction> => {
        const response = await api.post(`/workspaces/${workspaceId}/functions`, data)
        return response.data
    },

    update: async (workspaceId: string, functionName: string, data: Partial<CallingFunction>): Promise<CallingFunction> => {
        const response = await api.patch(`/workspaces/${workspaceId}/functions/${functionName}`, data)
        return response.data
    },

    delete: async (workspaceId: string, functionName: string): Promise<void> => {
        await api.delete(`/workspaces/${workspaceId}/functions/${functionName}`)
    },

    testWebhook: async (workspaceId: string, data: { url: string; timeout?: number; secret?: string }): Promise<any> => {
        // Note: secret is deprecated but kept if API expects it for now
        const response = await api.post(`/workspaces/${workspaceId}/functions/test-webhook`, data)
        return response.data
    }
}
