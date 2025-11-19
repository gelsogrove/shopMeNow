import { PrismaClient, TransportType } from "@prisma/client"
import { TransportTypeRepository } from "../repositories/transport-type.repository"
import logger from "../utils/logger"

export class TransportTypeService {
  private transportTypeRepository: TransportTypeRepository

  constructor(private prisma: PrismaClient) {
    this.transportTypeRepository = new TransportTypeRepository(prisma)
  }

  /**
   * Get all transport types for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TransportType[]> {
    return this.transportTypeRepository.findByWorkspace(workspaceId)
  }

  /**
   * Get all transport types with product counts
   */
  async getAllWithCounts(workspaceId: string) {
    return this.transportTypeRepository.findByWorkspaceWithCounts(workspaceId)
  }

  /**
   * Get transport type by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TransportType | null> {
    return this.transportTypeRepository.findById(id, workspaceId)
  }

  /**
   * Create new transport type
   */
  async create(workspaceId: string, name: string): Promise<TransportType> {
    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error("Transport type name is required")
    }

    if (trimmedName.length > 50) {
      throw new Error("Transport type name too long (max 50 characters)")
    }

    // Check for duplicate (case-insensitive)
    const existing = await this.transportTypeRepository.findByName(
      trimmedName,
      workspaceId
    )
    if (existing) {
      throw new Error("Transport type already exists")
    }

    return this.transportTypeRepository.create(workspaceId, trimmedName)
  }

  /**
   * Update transport type name
   */
  async update(
    id: string,
    workspaceId: string,
    name: string
  ): Promise<TransportType> {
    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error("Transport type name is required")
    }

    if (trimmedName.length > 50) {
      throw new Error("Transport type name too long (max 50 characters)")
    }

    // Check if transport type exists
    const transportType = await this.transportTypeRepository.findById(
      id,
      workspaceId
    )
    if (!transportType) {
      throw new Error("Transport type not found")
    }

    // Check for duplicate name (case-insensitive), excluding current transport type
    const existing = await this.transportTypeRepository.findByName(
      trimmedName,
      workspaceId
    )
    if (existing && existing.id !== id) {
      throw new Error("Transport type name already exists")
    }

    return this.transportTypeRepository.update(id, workspaceId, trimmedName)
  }

  /**
   * Delete transport type (only if not used by products)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    // Check if transport type exists
    const transportType = await this.transportTypeRepository.findById(
      id,
      workspaceId
    )
    if (!transportType) {
      throw new Error("Transport type not found")
    }

    // Check if transport type is used by products
    const productCount =
      await this.transportTypeRepository.countProductsUsing(id)
    if (productCount > 0) {
      throw new Error(
        `Cannot delete. Used by ${productCount} products. Remove from products first.`
      )
    }

    // Delete transport type
    await this.transportTypeRepository.delete(id, workspaceId)
    logger.info(`Transport type deleted: ${id} (${transportType.name})`)
  }

  /**
   * Validate transport type IDs belong to workspace
   */
  async validateTransportTypeIds(
    transportTypeIds: string[],
    workspaceId: string
  ): Promise<boolean> {
    if (transportTypeIds.length === 0) return true

    const transportTypes = await this.transportTypeRepository.findByWorkspace(
      workspaceId
    )
    const validIds = transportTypes.map((t) => t.id)

    return transportTypeIds.every((id) => validIds.includes(id))
  }
}
