import { api } from "./api"

export interface Supplier {
  id: string
  companyName: string
  description?: string
  website?: string
  phone?: string
  email?: string
  contactName?: string
  region?: string
  country?: string
  logoUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  workspaceId: string
  _count?: {
    products: number
  }
}

export interface CreateSupplierData {
  companyName: string
  description?: string
  website?: string
  phone?: string
  email?: string
  contactName?: string
  region?: string
  country?: string
  logoUrl?: string
}

export interface UpdateSupplierData extends CreateSupplierData {
  isActive?: boolean
}

export const supplierApi = {
  async getAll(workspaceId: string): Promise<Supplier[]> {
    const response = await api.get(`/workspaces/${workspaceId}/suppliers`)
    return response.data
  },

  async getById(workspaceId: string, id: string): Promise<Supplier> {
    const response = await api.get(`/workspaces/${workspaceId}/suppliers/${id}`)
    return response.data
  },

  async create(
    workspaceId: string,
    data: CreateSupplierData | FormData
  ): Promise<Supplier> {
    const response = await api.post(
      `/workspaces/${workspaceId}/suppliers`,
      data,
      data instanceof FormData
        ? {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        : undefined
    )
    return response.data
  },

  async update(
    workspaceId: string,
    id: string,
    data: UpdateSupplierData | FormData
  ): Promise<Supplier> {
    const response = await api.put(
      `/workspaces/${workspaceId}/suppliers/${id}`,
      data,
      data instanceof FormData
        ? {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        : undefined
    )
    return response.data
  },

  async delete(workspaceId: string, id: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/suppliers/${id}`)
  },
}
