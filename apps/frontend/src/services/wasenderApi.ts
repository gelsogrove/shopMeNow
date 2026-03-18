/**
 * WasenderAPI Service
 * WhatsApp self-registration via QR code using WasenderAPI ($4.50-6/session)
 * Two-step flow: initialize session → connect → scan QR → connected
 */
import { api } from './api'

export interface InitializeWasenderRequest {
  phoneNumber?: string
}

export interface InitializeWasenderResponse {
  wasenderSessionId: string
  wasenderApiKey: string
  wasenderSessionStatus: string
  wasenderQrString?: string | null
}

export interface WasenderStatusResponse {
  wasenderSessionId?: string | null
  wasenderApiKey?: string | null
  wasenderSessionStatus?: string | null
  wasenderPhoneNumber?: string | null
  wasenderIsActive?: boolean
  wasenderQrString?: string | null
  wasenderQrGeneratedAt?: string | null
}

export interface RegenerateWasenderQrResponse {
  wasenderQrString: string
  wasenderSessionStatus: string
}

/**
 * Step 1 + 2: Create session and connect to get QR code
 */
export const initializeWasenderSession = async (
  workspaceId: string,
  data?: InitializeWasenderRequest
): Promise<InitializeWasenderResponse> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/wasender/initialize`,
    data || {}
  )
  return response.data
}

/**
 * Disconnect (pause) the Wasender session — phone stays owned, can reconnect
 */
export const disconnectWasenderSession = async (workspaceId: string): Promise<void> => {
  await api.post(`/workspaces/${workspaceId}/wasender/disconnect`)
}

/**
 * Permanently delete the Wasender session from WasenderAPI servers
 */
export const deleteWasenderSession = async (workspaceId: string): Promise<void> => {
  await api.post(`/workspaces/${workspaceId}/wasender/delete`)
}

/**
 * Re-trigger QR code generation for an existing pending session
 */
export const regenerateWasenderQr = async (
  workspaceId: string
): Promise<RegenerateWasenderQrResponse> => {
  const response = await api.post(`/workspaces/${workspaceId}/wasender/regenerate-qr`)
  return response.data
}

/**
 * Poll current Wasender session status
 */
export const getWasenderStatus = async (
  workspaceId: string
): Promise<WasenderStatusResponse> => {
  const response = await api.get(`/workspaces/${workspaceId}`)
  // Workspace endpoint returns full workspace object — extract wasender fields
  const w = response.data
  return {
    wasenderSessionId: w.wasenderSessionId,
    wasenderApiKey: w.wasenderApiKey,
    wasenderSessionStatus: w.wasenderSessionStatus,
    wasenderPhoneNumber: w.wasenderPhoneNumber,
    wasenderIsActive: w.wasenderIsActive,
    wasenderQrString: w.wasenderQrString,
    wasenderQrGeneratedAt: w.wasenderQrGeneratedAt,
  }
}

/**
 * Restart the Wasender session (recover without re-scan if phone is still linked)
 */
export const restartWasenderSession = async (workspaceId: string): Promise<void> => {
  await api.post(`/workspaces/${workspaceId}/wasender/restart`)
}

/**
 * Sync session status from WasenderAPI → fixes stale DB state.
 * Call on settings page load to detect if session is already connected.
 * Also sets channelStatus=true in DB when confirmed connected (fixes chatbot not responding).
 */
export const syncWasenderStatus = async (
  workspaceId: string
): Promise<WasenderStatusResponse> => {
  const response = await api.post(`/workspaces/${workspaceId}/wasender/sync-status`)
  return response.data
}

export default {
  initializeWasenderSession,
  disconnectWasenderSession,
  deleteWasenderSession,
  regenerateWasenderQr,
  restartWasenderSession,
  getWasenderStatus,
  syncWasenderStatus,
}
