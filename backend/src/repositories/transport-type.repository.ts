import { PrismaClient, TransportType } from "@prisma/client"
import logger from "../utils/logger"

export class TransportTypeRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all transport types for a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<TransportType[]> {
    return this.prisma.transportType.findMany({
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
  ): Promise<TransportType | null> {
    return this.prisma.transportType.findFirst({
      where: { id, workspaceId },
    })
  }

  /**
   * Find transport type by name (case-insensitive) in workspace
   */
  async findByName(
    name: string,
    workspaceId: string
  ): Promise<TransportType | null> {
    return this.prisma.transportType.findFirst({
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
  ): Promise<TransportType> {
    return this.prisma.transportType.create({
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
  ): Promise<TransportType> {
    return this.prisma.transportType.update({
      where: { id },
      data: { name: name.trim() },
    })
  }

  /**
   * Delete transport type (only if not used by products)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    await this.prisma.transportType.delete({
      where: { id },
    })
  }

  /**
   * Count products using this transport type
   */
  async countProductsUsing(transportTypeId: string): Promise<number> {
    const count = await this.prisma.productTransportType.count({
      where: { transportTypeId },
    })
    return count
  }

  /**
   * Get transport types with product counts
   */
  async findByWorkspaceWithCounts(
    workspaceId: string
  ): Promise<Array<TransportType & { _count: { productTransportTypes: number } }>> {
    return this.prisma.transportType.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { productTransportTypes: true },
        },
      },
      orderBy: { name: "asc" },
    })
  }
}
