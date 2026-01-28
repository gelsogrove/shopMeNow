import { PrismaClient, Type } from "@echatbot/database"
import logger from "../utils/logger"

export class TypeRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all transport types for a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<Type[]> {
    return this.prisma.type.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    })
  }

  /**
   * Find transport type by ID with workspace validation
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<Type | null> {
    return this.prisma.type.findFirst({
      where: { id, workspaceId },
    })
  }

  /**
   * Find transport type by name (case-insensitive) in workspace
   */
  async findByName(
    name: string,
    workspaceId: string
  ): Promise<Type | null> {
    return this.prisma.type.findFirst({
      where: {
        workspaceId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    })
  }

  /**
   * Create a new transport type
   */
  async create(
    workspaceId: string,
    name: string
  ): Promise<Type> {
    return this.prisma.type.create({
      data: {
        workspaceId,
        name: name.trim(),
      },
    })
  }

  /**
   * Update transport type name
   */
  async update(
    id: string,
    workspaceId: string,
    name: string
  ): Promise<Type> {
    return this.prisma.type.update({
      where: { id },
      data: { name: name.trim() },
    })
  }

  /**
   * Delete transport type (only if not used by products)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    await this.prisma.type.delete({
      where: { id },
    })
  }

  /**
   * Count products using this transport type
   */
  async countProductsUsing(typeId: string): Promise<number> {
    const count = await this.prisma.productType.count({
      where: { typeId },
    })
    return count
  }

  /**
   * Get transport types with product counts
   */
  async findByWorkspaceWithCounts(
    workspaceId: string
  ): Promise<Array<Type & { _count: { productTypes: number } }>> {
    return this.prisma.type.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { productTypes: true },
        },
      },
      orderBy: { name: "asc" },
    })
  }

  /**
   * Get active transport types with prices for a workspace
   * Used for transport cost calculation in cart optimization
   * @param workspaceId Workspace ID
   * @returns Active transport types with prices
   */
  async findActiveWithPrices(
    workspaceId: string
  ): Promise<Array<{ id: string; name: string; price: number; isActive: boolean }>> {
    const types = await this.prisma.type.findMany({
      where: { 
        workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    })
    
    // Convert Decimal to number for price
    return types.map(t => ({
      ...t,
      price: Number(t.price),
    }))
  }

  /**
   * Check if workspace has transport types with prices configured
   * @param workspaceId Workspace ID
   * @returns true if at least one active transport type has price > 0
   */
  async hasConfiguredPrices(workspaceId: string): Promise<boolean> {
    const count = await this.prisma.type.count({
      where: {
        workspaceId,
        isActive: true,
        price: { gt: 0 },
      },
    })
    return count > 0
  }
}
