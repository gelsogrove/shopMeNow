import {
  Campaign,
  CampaignFrequency,
  CampaignTargetType,
  PrismaClient,
} from "@echatbot/database"
import logger from "../../utils/logger"

export interface CreateCampaignData {
  workspaceId: string
  name: string
  messagePreview: string
  frequency: CampaignFrequency
  targetType: CampaignTargetType
  customerIds?: string[]
  templateName?: string
  templateParams?: any
  isActive?: boolean
}

export interface UpdateCampaignData {
  name?: string
  messagePreview?: string
  frequency?: CampaignFrequency
  targetType?: CampaignTargetType
  customerIds?: string[]
  templateName?: string
  templateParams?: any
  isActive?: boolean
}

/**
 * Service for managing WhatsApp marketing campaigns
 * Handles CRUD operations and campaign logic
 */
export class CampaignService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all campaigns for a workspace
   */
  async findAllByWorkspace(workspaceId: string): Promise<Campaign[]> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              sends: true,
              feedbacks: true,
            },
          },
        },
      })

      return campaigns
    } catch (error) {
      logger.error(
        `Error fetching campaigns for workspace ${workspaceId}:`,
        error
      )
      throw new Error("Failed to fetch campaigns")
    }
  }

  /**
   * Get campaign by ID
   */
  async findById(id: string, workspaceId: string): Promise<Campaign | null> {
    try {
      const campaign = await this.prisma.campaign.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          _count: {
            select: {
              sends: true,
              feedbacks: true,
            },
          },
        },
      })

      return campaign
    } catch (error) {
      logger.error(`Error fetching campaign ${id}:`, error)
      throw new Error("Failed to fetch campaign")
    }
  }

  /**
   * Create a new campaign
   */
  async create(data: CreateCampaignData): Promise<Campaign> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: data.workspaceId, deletedAt: null },
        select: {
          owner: {
            select: {
              creditBalance: true,
              subscriptionStatus: true,
              planType: true,
            },
          },
        },
      })

      if (!workspace?.owner) {
        throw new Error("Owner non trovato per il controllo credito")
      }

      if (workspace.owner.subscriptionStatus !== "ACTIVE") {
        throw new Error("Sottoscrizione non attiva: attiva il piano prima di creare campagne")
      }

      const planConfig = await this.prisma.planConfiguration.findUnique({
        where: { planType: workspace.owner.planType },
        select: { messageCost: true },
      })
      const messageCost = Number(planConfig?.messageCost ?? 0.1)
      const currentBalance = Number(workspace.owner.creditBalance)

      if (currentBalance < messageCost) {
        throw new Error("Credito insufficiente per creare la campagna")
      }

      const campaign = await this.prisma.campaign.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          messagePreview: data.messagePreview,
          frequency: data.frequency,
          targetType: data.targetType,
          customerIds: data.customerIds || [],
          templateName: data.templateName,
          templateParams: data.templateParams,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      })

      logger.info(
        `Created campaign ${campaign.id} for workspace ${data.workspaceId}`
      )
      return campaign
    } catch (error) {
      logger.error("Error creating campaign:", error)
      throw new Error("Failed to create campaign")
    }
  }

  /**
   * Update a campaign
   */
  async update(
    id: string,
    workspaceId: string,
    data: UpdateCampaignData
  ): Promise<Campaign | null> {
    try {
      // Verify campaign belongs to workspace
      const existing = await this.findById(id, workspaceId)
      if (!existing) {
        return null
      }

      const updated = await this.prisma.campaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.messagePreview !== undefined && {
            messagePreview: data.messagePreview,
          }),
          ...(data.frequency !== undefined && { frequency: data.frequency }),
          ...(data.targetType !== undefined && { targetType: data.targetType }),
          ...(data.customerIds !== undefined && {
            customerIds: data.customerIds,
          }),
          ...(data.templateName !== undefined && {
            templateName: data.templateName,
          }),
          ...(data.templateParams !== undefined && {
            templateParams: data.templateParams,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      })

      logger.info(`Updated campaign ${id}`)
      return updated
    } catch (error) {
      logger.error(`Error updating campaign ${id}:`, error)
      throw new Error("Failed to update campaign")
    }
  }

  /**
   * Delete a campaign
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Verify campaign belongs to workspace
      const existing = await this.findById(id, workspaceId)
      if (!existing) {
        return false
      }

      await this.prisma.campaign.delete({
        where: { id },
      })

      logger.info(`Deleted campaign ${id}`)
      return true
    } catch (error) {
      logger.error(`Error deleting campaign ${id}:`, error)
      throw new Error("Failed to delete campaign")
    }
  }

  /**
   * Toggle campaign active status
   */
  async toggleActive(
    id: string,
    workspaceId: string
  ): Promise<Campaign | null> {
    try {
      const campaign = await this.findById(id, workspaceId)
      if (!campaign) {
        return null
      }

      const updated = await this.prisma.campaign.update({
        where: { id },
        data: { isActive: !campaign.isActive },
      })

      logger.info(`Toggled campaign ${id} active status to ${updated.isActive}`)
      return updated
    } catch (error) {
      logger.error(`Error toggling campaign ${id} active status:`, error)
      throw new Error("Failed to toggle campaign active status")
    }
  }

  /**
   * Get active campaigns for scheduler
   */
  async findActiveCampaigns(): Promise<Campaign[]> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: { isActive: true },
        include: {
          workspace: {
            select: {
              id: true,
              whatsappPhoneNumber: true,
              whatsappApiKey: true,
            },
          },
        },
      })

      return campaigns
    } catch (error) {
      logger.error("Error fetching active campaigns:", error)
      throw new Error("Failed to fetch active campaigns")
    }
  }

  /**
   * Update last run timestamp for campaign
   */
  async updateLastRun(id: string): Promise<void> {
    try {
      await this.prisma.campaign.update({
        where: { id },
        data: { lastRunAt: new Date() },
      })

      logger.info(`Updated last run timestamp for campaign ${id}`)
    } catch (error) {
      logger.error(`Error updating last run for campaign ${id}:`, error)
      throw new Error("Failed to update campaign last run")
    }
  }
}
