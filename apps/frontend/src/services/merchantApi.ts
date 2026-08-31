import { logger } from "@/lib/logger"
import { api } from "./api"

// Merchant advertising (Andrea, 2026-08-31): the workspace owner (e.g. a Pro
// Loco) resells push packages to local merchants. Merchants buy visibility;
// they are NOT the chatbot's customers.

export interface Merchant {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  location?: string | null
  billingName?: string | null
  vatNumber?: string | null
  taxCode?: string | null
  sdiCode?: string | null
  pec?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingZip?: string | null
  billingProvince?: string | null
  billingCountry?: string | null
  isActive: boolean
  quotaRemaining: number
  createdAt: string
  updatedAt: string
}

export interface MerchantPush {
  id: string
  workspaceId: string
  merchantId: string
  title: string
  text: string
  photoUrl?: string | null
  videoUrl?: string | null
  location?: string | null
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MerchantStats {
  merchantId: string
  name: string
  isActive: boolean
  quotaRemaining: number
  totalPurchased: number
  totalSent: number
  topups: Array<{
    id: string
    amount: number
    note?: string | null
    createdAt: string
  }>
  monthlySent: Array<{ month: string; sent: number }>
}

export type MerchantFormData = Partial<
  Omit<Merchant, "id" | "workspaceId" | "quotaRemaining" | "createdAt" | "updatedAt">
> & { name: string }

export type MerchantPushFormData = Partial<
  Omit<MerchantPush, "id" | "workspaceId" | "merchantId" | "createdAt" | "updatedAt">
> & { title: string; text: string }

const base = (workspaceId: string) => `/workspaces/${workspaceId}/merchants`

async function request<T>(label: string, fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await fn()
    return response.data
  } catch (error) {
    logger.error(`Error ${label}:`, error)
    throw error
  }
}

export const merchantApi = {
  getMerchants: (workspaceId: string) =>
    request<Merchant[]>("getting merchants", () => api.get(base(workspaceId))),

  getMerchant: (workspaceId: string, id: string) =>
    request<Merchant>("getting merchant", () => api.get(`${base(workspaceId)}/${id}`)),

  createMerchant: (workspaceId: string, data: MerchantFormData) =>
    request<Merchant>("creating merchant", () => api.post(base(workspaceId), data)),

  updateMerchant: (workspaceId: string, id: string, data: Partial<MerchantFormData>) =>
    request<Merchant>("updating merchant", () =>
      api.put(`${base(workspaceId)}/${id}`, data)
    ),

  deleteMerchant: (workspaceId: string, id: string) =>
    request<void>("deleting merchant", () => api.delete(`${base(workspaceId)}/${id}`)),

  topUpQuota: (workspaceId: string, id: string, amount: number, note?: string) =>
    request<Merchant>("topping up quota", () =>
      api.post(`${base(workspaceId)}/${id}/quota/topup`, { amount, note })
    ),

  getStats: (workspaceId: string, id: string) =>
    request<MerchantStats>("getting merchant stats", () =>
      api.get(`${base(workspaceId)}/${id}/stats`)
    ),

  getPushes: (workspaceId: string, merchantId: string) =>
    request<MerchantPush[]>("getting pushes", () =>
      api.get(`${base(workspaceId)}/${merchantId}/pushes`)
    ),

  createPush: (workspaceId: string, merchantId: string, data: MerchantPushFormData) =>
    request<MerchantPush>("creating push", () =>
      api.post(`${base(workspaceId)}/${merchantId}/pushes`, data)
    ),

  updatePush: (
    workspaceId: string,
    merchantId: string,
    pushId: string,
    data: Partial<MerchantPushFormData>
  ) =>
    request<MerchantPush>("updating push", () =>
      api.put(`${base(workspaceId)}/${merchantId}/pushes/${pushId}`, data)
    ),

  deletePush: (workspaceId: string, merchantId: string, pushId: string) =>
    request<void>("deleting push", () =>
      api.delete(`${base(workspaceId)}/${merchantId}/pushes/${pushId}`)
    ),
}
