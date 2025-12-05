import { Suppliers } from "@echatbot/database"
import {
  CreateSupplierData,
  SupplierRepository,
  UpdateSupplierData,
} from "../../repositories/supplier.repository"

export class SupplierService {
  private repository: SupplierRepository

  constructor() {
    this.repository = new SupplierRepository()
  }

  async getAllSuppliers(workspaceId: string): Promise<Suppliers[]> {
    return this.repository.findAll(workspaceId)
  }

  async getSupplierById(
    id: string,
    workspaceId: string
  ): Promise<Suppliers | null> {
    return this.repository.findById(id, workspaceId)
  }

  async createSupplier(data: CreateSupplierData): Promise<Suppliers> {
    return this.repository.create(data)
  }

  async updateSupplier(
    id: string,
    workspaceId: string,
    data: UpdateSupplierData
  ): Promise<Suppliers> {
    return this.repository.update(id, workspaceId, data)
  }

  async deleteSupplier(id: string, workspaceId: string): Promise<Suppliers> {
    return this.repository.delete(id, workspaceId)
  }

  async getSupplierCount(workspaceId: string): Promise<number> {
    return this.repository.count(workspaceId)
  }
}
