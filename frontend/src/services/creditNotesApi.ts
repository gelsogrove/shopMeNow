import { api } from "./api"

export interface CreditNote {
  id: string
  creditNoteCode: string
  orderId: string
  amount: number
  reason: string
  createdAt: string
  createdById: string | null
  order: {
    id: string
    orderCode: string
    status: string
    totalAmount: number
    customer: {
      id: string
      name: string
      email: string | null
    }
  }
}

export interface CreateCreditNoteDto {
  amount: number
  reason: string
}

export const creditNotesApi = {
  /**
   * Create a credit note for a delivered order
   */
  async create(
    workspaceId: string,
    orderId: string,
    data: CreateCreditNoteDto
  ): Promise<CreditNote> {
    const response = await api.post(
      `/workspaces/${workspaceId}/orders/${orderId}/credit-notes`,
      data
    )
    return response.data
  },

  /**
   * Get all credit notes for an order
   */
  async getByOrderId(
    workspaceId: string,
    orderId: string
  ): Promise<CreditNote[]> {
    const response = await api.get(
      `/workspaces/${workspaceId}/orders/${orderId}/credit-notes`
    )
    return response.data
  },

  /**
   * Get a single credit note by ID
   */
  async getById(
    workspaceId: string,
    creditNoteId: string
  ): Promise<CreditNote> {
    const response = await api.get(
      `/workspaces/${workspaceId}/credit-notes/${creditNoteId}`
    )
    return response.data
  },

  /**
   * Get all credit notes for a workspace
   */
  async getAll(
    workspaceId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      customerId?: string
    }
  ): Promise<CreditNote[]> {
    const params = new URLSearchParams()
    if (options?.startDate) {
      params.append("startDate", options.startDate.toISOString())
    }
    if (options?.endDate) {
      params.append("endDate", options.endDate.toISOString())
    }
    if (options?.customerId) {
      params.append("customerId", options.customerId)
    }

    const queryString = params.toString()
    const url = `/workspaces/${workspaceId}/credit-notes${queryString ? `?${queryString}` : ""}`
    const response = await api.get(url)
    return response.data
  },

  /**
   * Delete a credit note
   */
  async delete(workspaceId: string, creditNoteId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/credit-notes/${creditNoteId}`)
  },
}
