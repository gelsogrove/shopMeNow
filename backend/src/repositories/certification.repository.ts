import { PrismaClient, Certification } from "@prisma/client"
import logger from "../utils/logger"

export class CertificationRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all certifications for a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<Certification[]> {
    return this.prisma.certification.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    })
  }

  /**
   * Find certification by ID with workspace validation
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<Certification | null> {
    return this.prisma.certification.findFirst({
      where: { id, workspaceId },
    })
  }

  /**
   * Find certification by name (case-insensitive) in workspace
   */
  async findByName(
    name: string,
    workspaceId: string
  ): Promise<Certification | null> {
    return this.prisma.certification.findFirst({
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
   * Create a new certification
   */
  async create(
    workspaceId: string,
    name: string
  ): Promise<Certification> {
    return this.prisma.certification.create({
      data: {
        workspaceId,
        name: name.trim(),
      },
    })
  }

  /**
   * Update certification name
   */
  async update(
    id: string,
    workspaceId: string,
    name: string
  ): Promise<Certification> {
    return this.prisma.certification.update({
      where: { id },
      data: { name: name.trim() },
    })
  }

  /**
   * Delete certification (only if not used by products)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    await this.prisma.certification.delete({
      where: { id },
    })
  }

  /**
   * Count products using this certification
   */
  async countProductsUsing(certificationId: string): Promise<number> {
    const count = await this.prisma.productCertification.count({
      where: { certificationId },
    })
    return count
  }

  /**
   * Get certifications with product counts
   */
  async findByWorkspaceWithCounts(
    workspaceId: string
  ): Promise<Array<Certification & { _count: { productCertifications: number } }>> {
    return this.prisma.certification.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { productCertifications: true },
        },
      },
      orderBy: { name: "asc" },
    })
  }
}
