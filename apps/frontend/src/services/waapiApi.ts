/**
 * WaAPI Service - WhatsApp Self-Registration API
 * Allows users to connect WhatsApp via QR code without Meta Business API
 */
import { api } from './api';

export interface InitializeWaapiRequest {
  phoneNumber: string;
  displayName?: string;
}

export interface InitializeWaapiResponse {
  waapiQrCodeData: string;
  waapiInstanceStatus: string;
  waapiPhoneNumber: string;
  waapiInstanceId?: string;
}

export interface WaapiStatusResponse {
  status: string;
  phoneNumber: string;
  instanceId?: string;
}

/**
 * Initialize WaAPI instance and generate QR code
 */
export const initializeWaapiInstance = async (
  workspaceId: string,
  data: InitializeWaapiRequest
): Promise<InitializeWaapiResponse> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/waapi/initialize`,
    data
  );
  return response.data;
};

/**
 * Disconnect WaAPI instance (CRITICAL - irreversible)
 */
export const disconnectWaapiInstance = async (
  workspaceId: string
): Promise<void> => {
  await api.post(`/workspaces/${workspaceId}/waapi/disconnect`);
};

/**
 * Regenerate QR code for existing pending instance
 */
export const regenerateWaapiQr = async (
  workspaceId: string
): Promise<string> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/waapi/regenerate-qr`
  );
  return response.data;
};

/**
 * Get current WaAPI instance status
 */
export const getWaapiStatus = async (
  workspaceId: string
): Promise<WaapiStatusResponse> => {
  const response = await api.get(
    `/workspaces/${workspaceId}/waapi/status`
  );
  return response.data;
};

export default {
  initializeWaapiInstance,
  disconnectWaapiInstance,
  regenerateWaapiQr,
  getWaapiStatus,
};
