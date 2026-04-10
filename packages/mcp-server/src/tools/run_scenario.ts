import { getAuthToken, makeApiClient } from "../auth"

const DEFAULT_WORKSPACE_ID = "echatbot-hq-support"

export interface StartSessionConfig {
  customerName: string
  customerPhone: string
  isRegistered?: boolean
  workspaceId?: string
  overrides?: Record<string, unknown>
}

export interface StartSessionResult {
  sessionId: string
  customerId: string
  workspaceId: string
  customerName: string
  customerPhone: string
  isRegistered: boolean
}

export interface SendMessageResult {
  response: string
  agentUsed?: string
  intent?: string
  tokensUsed?: number
}

/**
 * Start a new interactive simulation session.
 * Creates test customer + chat session on Heroku.
 * Returns sessionId and customerId to use with sendMessage.
 */
export async function startSession(config: StartSessionConfig): Promise<StartSessionResult> {
  const token = getAuthToken()
  const api = makeApiClient(token)
  const workspaceId = config.workspaceId || DEFAULT_WORKSPACE_ID

  // Apply workspace overrides if provided
  if (config.overrides && Object.keys(config.overrides).length > 0) {
    await api.patch(`/workspaces/${workspaceId}`, config.overrides)
  }

  // Send a silent "init" to create the customer + session
  // We use an empty init call via the simulate endpoint
  const response = await api.post(`/workspaces/${workspaceId}/simulate`, {
    customerPhone: config.customerPhone,
    customerName: config.customerName,
    isRegistered: config.isRegistered ?? false,
    message: "__init__",
    sessionId: null,
  })

  const data = response.data as Record<string, unknown>

  return {
    sessionId: data.sessionId as string,
    customerId: data.customerId as string,
    workspaceId,
    customerName: config.customerName,
    customerPhone: config.customerPhone,
    isRegistered: config.isRegistered ?? false,
  }
}

/**
 * Send a single message in an active session.
 * Returns the bot response immediately.
 */
export async function sendMessage(params: {
  sessionId: string
  customerId: string
  workspaceId: string
  message: string
}): Promise<SendMessageResult> {
  const token = getAuthToken()
  const api = makeApiClient(token)

  const response = await api.post(`/workspaces/${params.workspaceId}/simulate`, {
    customerPhone: null,
    customerName: null,
    isRegistered: false,
    message: params.message,
    sessionId: params.sessionId,
    customerId: params.customerId,
  })

  const data = response.data as Record<string, unknown>

  return {
    response: (data.response as string) || (data.message as string) || "",
    agentUsed: data.agentUsed as string | undefined,
    intent: data.intent as string | undefined,
    tokensUsed: data.tokensUsed as number | undefined,
  }
}

/**
 * End a session and clean up the test customer.
 */
export async function endSession(params: {
  customerId: string
  customerPhone: string
  workspaceId: string
}): Promise<void> {
  const token = getAuthToken()
  const api = makeApiClient(token)

  try {
    await api.delete(
      `/workspaces/${params.workspaceId}/customers/phone/${encodeURIComponent(params.customerPhone)}`
    )
  } catch {
    // best-effort cleanup
  }
}
