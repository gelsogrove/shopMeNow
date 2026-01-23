import { api } from "./api"

export type PayPalStatus = "CONNECTED" | "DISCONNECTED"

export interface PayPalStatusResponse {
  paypalStatus: PayPalStatus
  isPaymentConnected?: boolean
  paypalEmail?: string | null
  paypalMerchantId?: string | null
  paypalEnvironment?: string | null
  paypalConnectedAt?: string | null
}

export interface PayPalConfigResponse {
  configured: boolean
  environment: string
  redirectUri?: string
}

export const getPayPalStatus = async (): Promise<PayPalStatusResponse> => {
  const response = await api.get("/paypal/status")
  return response.data.data
}

export const getPayPalConfig = async (): Promise<PayPalConfigResponse> => {
  const response = await api.get("/paypal/config")
  return response.data.data
}

export const getPayPalConnectUrl = async (): Promise<string> => {
  // NEW: Use Subscriptions flow instead of OAuth Connect
  const response = await api.post("/paypal/subscriptions")
  return response.data.data.approveLink
}

export const disconnectPayPal = async (): Promise<void> => {
  await api.post("/paypal/disconnect")
}
