import { PrismaClient, Certification } from "@prisma/client"
import { CertificationRepository } from "../repositories/certification.repository"
import logger from "../utils/logger"

export class CertificationService {
  private certificationRepository: CertificationRepository

  constructor(private prisma: PrismaClient) {
    this.certificationRepository = new CertificationRepository(prisma)
  }

  /**
   * Get all certifications for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<Certification[]> {
    return this.certificationRepository.findByWorkspace(workspaceId)
  }

  /**
   * Get all certifications with product counts
   */
  async getAllWithCounts(workspaceId: string) {
    return this.certificationRepository.findByWorkspaceWithCounts(workspaceId)
  }

  /**
   * Get certification by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<Certification | null> {
    return this.certificationRepository.findById(id, workspaceId)
  }

  /**
   * Create new certification
   */
  async create(workspaceId: string, name: string): Promise<Certification> {
    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error("Certification name is required")
    }

    if (trimmedName.length > 50) {
      throw new Error("Certification name too long (max 50 characters)")
    }

    // Check for duplicate (case-insensitive)
    const existing = await this.certificationRepository.findByName(
      trimmedName,
      workspaceId
    )
    if (existing) {
      throw new Error("Certification already exists")
    }

    return this.certificationRepository.create(workspaceId, trimmedName)
  }

  /**
   * Update certification name
   */
  async update(
    id: string,
    workspaceId: string,
    name: string
  ): Promise<Certification> {
    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error("Certification name is required")
    }

    if (trimmedName.length > 50) {
      throw new Error("Certification name too long (max 50 characters)")
    }

    // Check if certification exists
    const certification = await this.certificationRepository.findById(
      id,
      workspaceId
    )
    if (!certification) {
      throw new Error("Certification not found")
    }

    // Check for duplicate name (case-insensitive), excluding current certification
    const existing = await this.certificationRepository.findByName(
      trimmedName,
      workspaceId
    )
    if (existing && existing.id !== id) {
      throw new Error("Certification name already exists")
    }

    return this.certificationRepository.update(id, workspaceId, trimmedName)
  }

  /**
   * Delete certification (only if not used by products)
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    // Check if certification exists
    const certification = await this.certificationRepository.findById(
      id,
      workspaceId
    )
    if (!certification) {
      throw new Error("Certification not found")
    }

    // Check if certification is used by products
    const productCount =
      await this.certificationRepository.countProductsUsing(id)
    if (productCount > 0) {
      throw new Error(
        `Cannot delete. Used by ${productCount} products. Remove from products first.`
      )
    }

    // Delete certification
    await this.certificationRepository.delete(id, workspaceId)
    logger.info(`Certification deleted: ${id} (${certification.name})`)
  }

  /**
   * Validate certification IDs belong to workspace
   */
  async validateCertificationIds(
    certificationIds: string[],
    workspaceId: string
  ): Promise<boolean> {
    if (certificationIds.length === 0) return true

    const certifications = await this.certificationRepository.findByWorkspace(
      workspaceId
    )
    const validIds = certifications.map((c) => c.id)

    return certificationIds.every((id) => validIds.includes(id))
  }
}
