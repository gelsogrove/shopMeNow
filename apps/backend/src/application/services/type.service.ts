import { PrismaClient, Type } from "@echatbot/database"
import { TypeRepository } from "../../repositories/type.repository"
import logger from "../../utils/logger"

export class TypeService {
  private typeRepository: TypeRepository

  constructor(private prisma: PrismaClient) {
    this.typeRepository = new TypeRepository(prisma)
  }

  /**
   * Get all transport types for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<Type[]> {
    return this.typeRepository.findByWorkspace(workspaceId)
  }

  /**
   * Get all transport types with product counts
   */
  async getAllWithCounts(workspaceId: string) {
    return this.typeRepository.findByWorkspaceWithCounts(workspaceId)
  }

  /**
   * Get transport type by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<Type | null> {
    return this.typeRepository.findById(id, workspaceId)
  }

  /**
   * Create new transport type
   */
  async create(workspaceId: string, name: string): Promise<Type> {
    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error("Transport type name is required")
    }

    if (trimmedName.length > 50) {
      throw new Error("Transport type name too long (max 50 characters)")
    }

    // Check for duplicate (case-insensitive)
    const existing = await this.typeRepository.findByName(
      trimmedName,
      workspaceId
    )
    if (existing) {
      throw new Error("Transport type already exists")
    }

    return this.typeRepository.create(workspaceId, trimmedName)
  }

  /**
   * Update transport type name
   */
  async update(
    id: string,
    workspaceId: string,
    name: string
  ): Promise<Type> {
    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error("Transport type name is required")
    }

    if (trimmedName.length > 50) {
      throw new Error("Transport type name too long (max 50 characters)")
    }

    // Check if transport type exists
    const type = await this.typeRepository.findById(
      id,
      workspaceId
    )
    if (!type) {
      throw new Error("Transport type not found")
    }

    // Check for duplicate name (case-insensitive), excluding current transport type
    const existing = await this.typeRepository.findByName(
      trimmedName,
      workspaceId
    )
    if (existing && existing.id !== id) {
      throw new Error("Transport type name already exists")
    }

    return this.typeRepository.update(id, workspaceId, trimmedName)
  }

  /**
   * Delete transport type (only if not used by products)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    // Check if transport type exists
    const type = await this.typeRepository.findById(
      id,
      workspaceId
    )
    if (!type) {
      throw new Error("Transport type not found")
    }

    // Check if transport type is used by products
    const productCount =
      await this.typeRepository.countProductsUsing(id)
    if (productCount > 0) {
      throw new Error(
        `Cannot delete. Used by ${productCount} products. Remove from products first.`
      )
    }

    // Delete transport type
    await this.typeRepository.delete(id, workspaceId)
    logger.info(`Transport type deleted: ${id} (${type.name})`)
  }

  /**
   * Validate transport type IDs belong to workspace
   */
  async validateTypeIds(
    typeIds: string[],
    workspaceId: string
  ): Promise<boolean> {
    if (typeIds.length === 0) return true

    const types = await this.typeRepository.findByWorkspace(
      workspaceId
    )
    const validIds = types.map((t) => t.id)

    return typeIds.every((id) => validIds.includes(id))
  }
}
