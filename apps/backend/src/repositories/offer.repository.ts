import logger from "../utils/logger"
import { Offer } from "../domain/entities/offer.entity"
import { IOfferRepository } from "../domain/repositories/offer.repository.interface"
import { prisma } from "../lib/prisma"

// Interface for extended offer data with categoryIds
interface ExtendedOfferData extends Record<string, any> {
  categoryIds?: string[]
}

/**
 * Implementation of Offer Repository using Prisma
 */
export class OfferRepository implements IOfferRepository {
  /**
   * Find all offers in a workspace
   */
  async findAll(workspaceId: string): Promise<Offer[]> {
    const offers = await prisma.offers.findMany({
      where: { workspaceId },
      include: {
        category: true,
        categories: true,
      },
    })

    return offers.map((offer) => {
      // Create a new object instead of modifying the prisma result directly
      const offerData: ExtendedOfferData = {
        ...offer,
        categoryIds:
          offer.categories.length > 0
            ? offer.categories.map((cat) => cat.id)
            : offer.categoryId
              ? [offer.categoryId]
              : [],
      }

      return new Offer(offerData)
    })
  }

  /**
   * Find active offers in a workspace, optionally filtered by category
   */
  async findActive(workspaceId: string, categoryId?: string): Promise<Offer[]> {
    const now = new Date()

    const where: any = {
      workspaceId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    }

    if (categoryId) {
      where.OR = [
        { categoryId: categoryId },
        { categories: { some: { id: categoryId } } },
      ]
    }

    try {
      const offers = await prisma.offers.findMany({
        where,
        include: {
          category: true,
          categories: true,
        },
      })

      return offers.map((offer) => {
        // Create a new object instead of modifying the prisma result directly
        const offerData: ExtendedOfferData = {
          ...offer,
          categoryIds:
            offer.categories.length > 0
              ? offer.categories.map((cat) => cat.id)
              : offer.categoryId
                ? [offer.categoryId]
                : [],
        }

        return new Offer(offerData)
      })
    } catch (error) {
      logger.error("Error finding active offers:", error)
      throw error
    }
  }

  /**
   * Get active offers in a workspace, optionally filtered by category
   * This is an alias for findActive for backward compatibility
   */
  async getActiveOffers(
    workspaceId: string,
    categoryId?: string
  ): Promise<Offer[]> {
    return this.findActive(workspaceId, categoryId)
  }

  /**
   * Find a single offer by ID and workspace
   */
  async findById(id: string, workspaceId: string): Promise<Offer | null> {
    const offer = await prisma.offers.findFirst({
      where: { id, workspaceId },
      include: {
        category: true,
        categories: true,
      },
    })

    if (!offer) return null

    // Create a new object instead of modifying the prisma result directly
    const offerData: ExtendedOfferData = {
      ...offer,
      categoryIds:
        offer.categories.length > 0
          ? offer.categories.map((cat) => cat.id)
          : offer.categoryId
            ? [offer.categoryId]
            : [],
    }

    return new Offer(offerData)
  }

  /**
   * Create a new offer
   */
  async create(data: any): Promise<Offer> {
    try {
      // Extract categoryIds but don't include it in the prisma operation
      const { categoryIds, ...prismaData } = data

      logger.debug("Creating offer in repository with data:", prismaData)
      logger.debug("CategoryIds:", categoryIds)

      // Prepare the create data with category connections
      const createData: any = {
        ...prismaData,
      }

      // Handle category relationships
      if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
        // Use many-to-many relationship for multiple categories
        createData.categories = {
          connect: categoryIds.map((id) => ({ id })),
        }

        // Also set the first category as the primary category for backward compatibility
        createData.categoryId = categoryIds[0]
      }

      const offer = await prisma.offers.create({
        data: createData,
        include: {
          category: true,
          categories: true,
        },
      })

      // Create a new object with both the prisma result and additional data
      const offerData: ExtendedOfferData = {
        ...offer,
        categoryIds:
          offer.categories.length > 0
            ? offer.categories.map((cat) => cat.id)
            : offer.categoryId
              ? [offer.categoryId]
              : [],
      }

      logger.debug("Successfully created offer in repository:", offer)
      return new Offer(offerData)
    } catch (error) {
      logger.error(`Error creating offer in repository:`, error)
      throw new Error(
        `Failed to create offer: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /**
   * Update an existing offer
   */
  async update(id: string, data: any): Promise<Offer> {
    try {
      logger.info(`Updating offer with ID: ${id}`)
      logger.debug(`Original update data:`, data)

      // Extract fields that shouldn't be sent to Prisma
      const { createdAt, updatedAt, categoryIds, ...updateData } = data

      logger.debug(`Processed update data (without categoryIds):`, updateData)
      logger.debug(`CategoryIds to update:`, categoryIds)

      // Ensure the offer exists and belongs to the specified workspace
      const existingOffer = await prisma.offers.findFirst({
        where: {
          id,
          workspaceId: updateData.workspaceId,
        },
        include: {
          category: true,
          categories: true,
        },
      })

      if (!existingOffer) {
        throw new Error(
          `Offer with ID ${id} not found in workspace ${updateData.workspaceId}`
        )
      }

      // Handle category relationships
      if (categoryIds !== undefined) {
        if (
          categoryIds === null ||
          (Array.isArray(categoryIds) && categoryIds.length === 0)
        ) {
          // Clear all category relationships
          updateData.categoryId = null
          updateData.categories = {
            set: [], // This will disconnect all categories
          }
          logger.debug(`Clearing all category relationships`)
        } else if (Array.isArray(categoryIds) && categoryIds.length > 0) {
          // Set new category relationships
          updateData.categories = {
            set: categoryIds.map((id) => ({ id })),
          }

          // Also set the first category as the primary category for backward compatibility
          updateData.categoryId = categoryIds[0]
          logger.debug(
            `Setting categories to ${categoryIds.join(", ")} and primary categoryId to ${updateData.categoryId}`
          )
        }
      }

      try {
        const offer = await prisma.offers.update({
          where: { id },
          data: updateData,
          include: {
            category: true,
            categories: true,
          },
        })

        // Create a new object with both the prisma result and additional data
        const offerData: ExtendedOfferData = {
          ...offer,
          categoryIds:
            offer.categories.length > 0
              ? offer.categories.map((cat) => cat.id)
              : offer.categoryId
                ? [offer.categoryId]
                : [],
        }

        logger.info(`Successfully updated offer with ID: ${id}`)
        return new Offer(offerData)
      } catch (prismaError) {
        logger.error(`Prisma error updating offer with ID ${id}:`, prismaError)
        throw prismaError
      }
    } catch (error) {
      logger.error(`Error updating offer with ID ${id}:`, error)
      throw new Error(
        `Failed to update offer: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /**
   * Delete an offer
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.offers.delete({
        where: { id },
      })
      return true
    } catch (error) {
      logger.error(`Error deleting offer with ID ${id}:`, error)
      return false
    }
  }
}
