import { api } from "./api"

// Shipping address interface
export interface ShippingAddress {
  street: string
  city: string
  zip: string
  country: string
}

// Invoice address interface
export interface InvoiceAddress {
  firstName?: string
  lastName?: string
  company?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  vatNumber?: string
  phone?: string
}

export interface Client {
  id: string
  name: string
  email: string
  phone?: string
  address?: string | ShippingAddress
  company?: string
  discount?: number
  language?: string
  currency?: string
  notes?: string
  serviceIds?: string[]
  isBlacklisted?: boolean
  isActive?: boolean
  gdprConsent?: boolean
  pushNotificationsConsent?: boolean
  activeChatbot?: boolean
  workspaceId: string
  createdAt: string
  updatedAt: string
  invoiceAddress?: InvoiceAddress
  salesId?: string | null
}

export interface CreateClientData {
  name: string
  email: string
  phone?: string
  address?: string
  company?: string
  discount?: number
  language?: string
  currency?: string
  notes?: string
  serviceIds?: string[]
  isBlacklisted?: boolean
  isActive?: boolean
  gdprConsent?: boolean
  pushNotificationsConsent?: boolean
  activeChatbot?: boolean
  workspaceId: string
  salesId?: string | null
}

export interface UpdateClientData extends Partial<CreateClientData> {
  id: string
  invoiceAddress?: InvoiceAddress
}

export interface ClientsResponse {
  success: boolean
  data: Client[]
  message?: string
}

/**
 * Get all clients for a specific workspace
 */
export const getAllForWorkspace = async (
  workspaceId: string
): Promise<Client[]> => {
  try {
    if (!workspaceId) {
      throw new Error("WorkspaceId is required for getAllForWorkspace")
    }

    const requestUrl = `/workspaces/${workspaceId}/customers`
    const response = await api.get<{ data: Client[] }>(requestUrl)

    if (!response.data) {
      throw new Error("Empty API response")
    }

    return response.data.data || []
  } catch (error) {
    throw new Error(
      `Error fetching clients: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

/**
 * Get a single client by ID
 */
export const getById = async (id: string): Promise<Client> => {
  try {
    const response = await api.get<{ data: Client }>(`/customers/${id}`)
    return response.data.data
  } catch (error) {
    throw new Error(
      `Error fetching client by ID: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

/**
 * Create a new client
 */
export const create = async (clientData: CreateClientData): Promise<Client> => {
  try {
    const response = await api.post<{ data: Client }>("/customers", clientData)
    return response.data.data
  } catch (error) {
    throw new Error(
      `Error creating client: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

/**
 * Update an existing client
 */
export const update = async (
  id: string,
  workspaceId: string,
  clientData: UpdateClientData
): Promise<Client> => {
  try {
    const response = await api.put<{ data: Client }>(
      `/workspaces/${workspaceId}/customers/${id}`,
      clientData
    )
    return response.data.data
  } catch (error) {
    throw new Error(
      `Error updating client: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

/**
 * Delete a client
 */
export const deleteClient = async (id: string): Promise<void> => {
  try {
    await api.delete(`/customers/${id}`)
  } catch (error) {
    throw new Error(
      `Error deleting client: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

// Export the clients API object
export const clientsApi = {
  getAllForWorkspace,
  getById,
  create,
  update,
  delete: deleteClient,
}
