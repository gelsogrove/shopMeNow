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
    attachedLlm?: string | null
    attachedFlowKey?: string | null
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

    testWebhook: async (workspaceId: string, data: { url: string; timeout?: number }): Promise<any> => {
        const response = await api.post(`/workspaces/${workspaceId}/functions/test-webhook`, data)
        return response.data
    },

    getAgentTypes: async (workspaceId: string): Promise<{ agentTypes: string[] }> => {
        const response = await api.get(`/workspaces/${workspaceId}/functions/agent-types`)
        return response.data
    },

    reinstall: async (workspaceId: string, functionName: string): Promise<CallingFunction> => {
        const response = await api.post(`/workspaces/${workspaceId}/functions/${functionName}/reinstall`)
        return response.data
    },

    getSystemMissing: async (workspaceId: string): Promise<{ missing: Array<{ functionName: string; description: string; executionType: string; attachedLlm?: string | null }> }> => {
        const response = await api.get(`/workspaces/${workspaceId}/functions/system-missing`)
        return response.data
    }
}
