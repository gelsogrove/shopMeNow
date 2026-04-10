import { getAuthToken, makeApiClient } from "../auth"

const SANDBOX_WORKSPACE_ID = "echatbot-hq-support"

export interface ScenarioConfig {
  customerName: string
  customerPhone: string
  isRegistered?: boolean
  messages: string[]
  workspaceId?: string
  overrides?: {
    reminderEnabled?: boolean
    humanSupportEnabled?: boolean
    hasSalesAgents?: boolean
    sellsProductsAndServices?: boolean
    toneOfVoice?: "casual" | "formal" | "professional"
    channelStatus?: boolean
    debugMode?: boolean
  }
}

export interface TurnResult {
  userMessage: string
  botResponse: string
  agentUsed?: string
  error?: string
}

export interface ScenarioResult {
  scenarioId: string
  workspaceId: string
  customerPhone: string
  conversation: TurnResult[]
  summary: string
}

export async function runScenario(config: ScenarioConfig): Promise<ScenarioResult> {
  const token = getAuthToken()
  const api = makeApiClient(token)
  const workspaceId = config.workspaceId || SANDBOX_WORKSPACE_ID
  const scenarioId = `scenario_${Date.now()}`

  let originalSettings: Record<string, unknown> | null = null

  try {
    // 1. Apply workspace overrides if provided
    if (config.overrides && Object.keys(config.overrides).length > 0) {
      const wsResponse = await api.get(`/workspaces/${workspaceId}`)
      originalSettings = wsResponse.data as Record<string, unknown>
      await api.patch(`/workspaces/${workspaceId}`, config.overrides)
    }

    // 2. Run conversation turn by turn
    const conversation: TurnResult[] = []
    let sessionId: string | null = null

    for (const message of config.messages) {
      try {
        const response = await api.post(`/workspaces/${workspaceId}/simulate`, {
          customerPhone: config.customerPhone,
          customerName: config.customerName,
          isRegistered: config.isRegistered ?? false,
          message,
          sessionId,
        })

        const data = response.data as Record<string, unknown>
        sessionId = (data.sessionId as string) || sessionId

        conversation.push({
          userMessage: message,
          botResponse: (data.response as string) || (data.message as string) || JSON.stringify(data),
          agentUsed: data.agentUsed as string | undefined,
        })

        // Small delay to avoid race conditions
        await new Promise((r) => setTimeout(r, 500))
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
        conversation.push({
          userMessage: message,
          botResponse: "",
          error: axiosErr.response?.data?.message || axiosErr.message || "Unknown error",
        })
      }
    }

    // 3. Build summary
    const errors = conversation.filter((t) => t.error).length
    const summary = [
      `Scenario: ${scenarioId}`,
      `Workspace: ${workspaceId}`,
      `Customer: ${config.customerName} (${config.customerPhone})`,
      `Registered: ${config.isRegistered ?? false}`,
      `Messages: ${conversation.length} | Errors: ${errors}`,
      `Overrides: ${JSON.stringify(config.overrides || {})}`,
    ].join("\n")

    return { scenarioId, workspaceId, customerPhone: config.customerPhone, conversation, summary }
  } finally {
    // 4. Restore original workspace settings
    if (originalSettings && config.overrides) {
      try {
        const fieldsToRestore: Record<string, unknown> = {}
        for (const key of Object.keys(config.overrides)) {
          if (originalSettings[key] !== undefined) {
            fieldsToRestore[key] = originalSettings[key]
          }
        }
        await api.patch(`/workspaces/${workspaceId}`, fieldsToRestore)
      } catch {
        // best-effort restore
      }
    }

    // 5. Cleanup test customer
    try {
      await api.delete(
        `/workspaces/${workspaceId}/customers/phone/${encodeURIComponent(config.customerPhone)}`
      )
    } catch {
      // best-effort cleanup
    }
  }
}
