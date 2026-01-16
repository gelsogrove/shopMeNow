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
  const response = await api.post("/paypal/connect-url")
  return response.data.data.url
}

export const disconnectPayPal = async (): Promise<void> => {
  await api.post("/paypal/disconnect")
}
